const pool = require('../config/db');

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (err, res, next) => (err instanceof HttpError ? res.status(err.status).json({ message: err.message }) : next(err));
const int = (v) => { const n = Number(v); return Number.isInteger(n) ? n : NaN; };

// ---------- READ ----------
// GET /api/inventory?warehouse_id=&search=&low=true&page=&limit=
exports.list = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    const where = ['1=1']; const params = [];
    if (req.query.warehouse_id) { where.push('wi.warehouse_id = ?'); params.push(int(req.query.warehouse_id)); }
    if (req.query.search) { where.push('p.name LIKE ?'); params.push(`%${req.query.search}%`); }
    if (req.query.low === 'true') where.push('p.is_active = 1 AND wi.low_stock_threshold IS NOT NULL AND wi.quantity <= wi.low_stock_threshold');
    const whereSql = where.join(' AND ');

    const [rows] = await pool.query(
      `SELECT wi.product_id, p.name AS product_name, wi.warehouse_id, w.name AS warehouse_name,
              wi.quantity, wi.low_stock_threshold,
              (wi.low_stock_threshold IS NOT NULL AND wi.quantity <= wi.low_stock_threshold) AS is_low,
              wi.updated_at
       FROM warehouse_inventory wi
       JOIN products p ON p.id = wi.product_id
       JOIN warehouses w ON w.id = wi.warehouse_id
       WHERE ${whereSql} ORDER BY p.name, w.name LIMIT ? OFFSET ?`,
      [...params, limit, (page - 1) * limit]
    );
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM warehouse_inventory wi JOIN products p ON p.id = wi.product_id WHERE ${whereSql}`, params);
    res.json({ page, limit, total, items: rows.map((r) => ({ ...r, is_low: !!r.is_low })) });
  } catch (err) { next(err); }
};

exports.lowStock = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT wi.product_id, p.name AS product_name, wi.warehouse_id, w.name AS warehouse_name,
              wi.quantity, wi.low_stock_threshold
       FROM warehouse_inventory wi
       JOIN products p ON p.id = wi.product_id AND p.is_active = 1
       JOIN warehouses w ON w.id = wi.warehouse_id
       WHERE wi.low_stock_threshold IS NOT NULL AND wi.quantity <= wi.low_stock_threshold
       ORDER BY wi.quantity ASC, p.name`
    );
    res.json(rows);
  } catch (err) { next(err); }
};

exports.searchProducts = async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim().slice(0, 200);
    const [rows] = await pool.execute(
      'SELECT id, name FROM products WHERE is_active = 1 AND (name LIKE ? OR id = ?) ORDER BY name, id LIMIT 50',
      [`%${search}%`, /^\d+$/.test(search) ? search : 0]);
    res.json(rows);
  } catch (err) { next(err); }
};

exports.warehouses = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, address, city, country, contact_person, phone FROM warehouses WHERE is_active = 1 ORDER BY name');
    res.json(rows);
  } catch (err) { next(err); }
};

// GET /api/inventory/transactions?product_id=&warehouse_id=&type=&page=&limit=   (audit log)
exports.transactions = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    const where = ['1=1']; const params = [];
    if (req.query.product_id) { where.push('t.product_id = ?'); params.push(int(req.query.product_id)); }
    if (req.query.warehouse_id) { where.push('t.warehouse_id = ?'); params.push(int(req.query.warehouse_id)); }
    if (req.query.type) { where.push('t.transaction_type = ?'); params.push(req.query.type); }
    const whereSql = where.join(' AND ');

    const [rows] = await pool.query(
      `SELECT t.id, t.product_id, p.name AS product_name, t.warehouse_id, w.name AS warehouse_name,
              t.transaction_type, t.quantity, t.previous_stock, t.new_stock,
              t.reference_id, t.note, u.name AS performed_by_name, t.created_at
       FROM inventory_transactions t
       JOIN products p ON p.id = t.product_id
       JOIN warehouses w ON w.id = t.warehouse_id
       LEFT JOIN users u ON u.id = t.performed_by
       WHERE ${whereSql} ORDER BY t.created_at DESC, t.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, (page - 1) * limit]
    );
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM inventory_transactions t WHERE ${whereSql}`, params);
    res.json({ page, limit, total, transactions: rows });
  } catch (err) { next(err); }
};

// ---------- WRITE (always inside a transaction + logged) ----------
// Lock (and create if missing) the stock row of a product in a warehouse
async function lockStockRow(conn, productId, warehouseId) {
  await conn.execute(
    'INSERT IGNORE INTO warehouse_inventory (product_id, warehouse_id, quantity) VALUES (?, ?, 0)', [productId, warehouseId]);
  const [rows] = await conn.execute(
    'SELECT quantity FROM warehouse_inventory WHERE product_id = ? AND warehouse_id = ? FOR UPDATE', [productId, warehouseId]);
  if (!rows.length) throw new HttpError(400, 'Invalid product_id or warehouse_id');
  return rows[0].quantity;
}

async function applyChange({ productId, warehouseId, newQuantity, type, note, userId, delta }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const previous = await lockStockRow(conn, productId, warehouseId);
    const target = newQuantity !== undefined ? newQuantity : previous + delta;
    if (target < 0) throw new HttpError(409, `Stock cannot go below zero (current: ${previous})`);

    // This UPDATE also fires your trg_low_stock_notification trigger automatically
    await conn.execute(
      'UPDATE warehouse_inventory SET quantity = ? WHERE product_id = ? AND warehouse_id = ?',
      [target, productId, warehouseId]);
    await conn.execute(
      `INSERT INTO inventory_transactions
         (product_id, warehouse_id, transaction_type, quantity, previous_stock, new_stock, note, performed_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [productId, warehouseId, type, target - previous, previous, target, note || null, userId]);
    await conn.commit();
    return { product_id: productId, warehouse_id: warehouseId, previous_stock: previous, new_stock: target };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally { conn.release(); }
}

// POST { product_id, warehouse_id, quantity, note }   -> adds stock
exports.restock = async (req, res, next) => {
  try {
    const productId = int(req.body.product_id), warehouseId = int(req.body.warehouse_id), qty = int(req.body.quantity);
    if (!(productId > 0) || !(warehouseId > 0) || !(qty > 0))
      return res.status(400).json({ message: 'product_id, warehouse_id and a positive quantity are required' });
    res.status(201).json(await applyChange({
      productId, warehouseId, delta: qty, type: 'restock', note: req.body.note || 'Manual restock', userId: req.user.id }));
  } catch (err) { fail(err, res, next); }
};

// POST { product_id, warehouse_id, new_quantity, note }   -> sets exact stock (stock count / correction)
exports.adjust = async (req, res, next) => {
  try {
    const productId = int(req.body.product_id), warehouseId = int(req.body.warehouse_id), newQty = int(req.body.new_quantity);
    if (!(productId > 0) || !(warehouseId > 0) || !(newQty >= 0))
      return res.status(400).json({ message: 'product_id, warehouse_id and new_quantity (0 or more) are required' });
    if (!req.body.note || !String(req.body.note).trim())
      return res.status(400).json({ message: 'A note explaining the adjustment is required' });
    res.json(await applyChange({
      productId, warehouseId, newQuantity: newQty, type: 'adjustment', note: String(req.body.note).trim(), userId: req.user.id }));
  } catch (err) { fail(err, res, next); }
};

// PATCH { product_id, warehouse_id, low_stock_threshold }
exports.setThreshold = async (req, res, next) => {
  try {
    const productId = int(req.body.product_id), warehouseId = int(req.body.warehouse_id), th = int(req.body.low_stock_threshold);
    if (!(productId > 0) || !(warehouseId > 0) || !(th >= 0))
      return res.status(400).json({ message: 'product_id, warehouse_id and low_stock_threshold (0 or more) are required' });
    const [r] = await pool.execute(
      'UPDATE warehouse_inventory SET low_stock_threshold = ? WHERE product_id = ? AND warehouse_id = ?', [th, productId, warehouseId]);
    if (!r.affectedRows) return res.status(404).json({ message: 'No stock record for this product and warehouse' });
    res.json({ message: 'Threshold updated' });
  } catch (err) { next(err); }
};
