const pool = require('../config/db');
const { CARD_SQL } = require('./product.controller');

const bad = (message) => { const e = new Error(message); e.status = 400; return e; };
const fail = (err, res, next) => (err.status ? res.status(err.status).json({ message: err.message }) : next(err));

const DT_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/;
const dt = (v, label) => {
  const s = String(v || '').trim();
  if (!DT_RE.test(s)) throw bad(`${label} must look like 2026-12-01 10:00`);
  const t = s.replace('T', ' ');
  return t.length === 16 ? `${t}:00` : t;
};

// Dates are sent as plain "YYYY-MM-DDTHH:mm" text so the browser never converts time zones;
// the live/upcoming/ended state and all countdowns are worked out by MySQL's own clock.
const FMT = (col) => `DATE_FORMAT(s.${col}, '%Y-%m-%dT%H:%i')`;
const STATE = `CASE WHEN s.is_active = 0 THEN 'disabled' WHEN NOW() < s.starts_at THEN 'upcoming'
                     WHEN NOW() >= s.ends_at THEN 'ended' ELSE 'live' END`;

// PUBLIC: GET /api/flash-sales/active?limit=  -> the live sale (ending soonest), its products and the next sale
exports.active = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 24, 1), 60);
    const [sales] = await pool.query(
      `SELECT s.id, s.title, TIMESTAMPDIFF(SECOND, NOW(), s.ends_at) AS seconds_left
       FROM flash_sales s WHERE s.is_active = 1 AND NOW() >= s.starts_at AND NOW() < s.ends_at
       ORDER BY s.ends_at ASC LIMIT 1`);
    const [upcoming] = await pool.query(
      `SELECT s.title, TIMESTAMPDIFF(SECOND, NOW(), s.starts_at) AS seconds_until_start
       FROM flash_sales s WHERE s.is_active = 1 AND s.starts_at > NOW() ORDER BY s.starts_at ASC LIMIT 1`);
    let products = [];
    if (sales.length) {
      [products] = await pool.query(
        `${CARD_SQL} JOIN flash_sale_items i ON i.product_id = p.id AND i.flash_sale_id = ?
         WHERE p.is_active = 1 ORDER BY (p.price - i.sale_price) / p.price DESC LIMIT ?`, [sales[0].id, limit]);
    }
    res.json({ sale: sales[0] || null, products, upcoming: upcoming[0] || null });
  } catch (err) { next(err); }
};

// ---------------- ADMIN ----------------
exports.clock = async (req, res, next) => {
  try {
    const [[clock]] = await pool.query(
      "SELECT IF(@@session.time_zone = 'SYSTEM', @@system_time_zone, @@session.time_zone) AS time_zone");
    res.json(clock);
  } catch (err) { next(err); }
};

exports.list = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.id, s.title, ${FMT('starts_at')} AS starts_at, ${FMT('ends_at')} AS ends_at, s.is_active,
              ${STATE} AS state,
              (SELECT COUNT(*) FROM flash_sale_items i WHERE i.flash_sale_id = s.id) AS item_count
       FROM flash_sales s ORDER BY s.starts_at DESC, s.id DESC`);
    res.json(rows.map((r) => ({ ...r, is_active: r.is_active !== 0 })));
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    const [sales] = await pool.query(
      `SELECT s.id, s.title, ${FMT('starts_at')} AS starts_at, ${FMT('ends_at')} AS ends_at, s.is_active, ${STATE} AS state
       FROM flash_sales s WHERE s.id = ?`, [req.params.id]);
    if (!sales.length) return res.status(404).json({ message: 'Flash sale not found' });
    const [items] = await pool.query(
      `SELECT i.product_id, p.name, p.price, p.discount_price, i.sale_price,
              (SELECT image_url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.id LIMIT 1) AS image
       FROM flash_sale_items i JOIN products p ON p.id = i.product_id
       WHERE i.flash_sale_id = ? ORDER BY p.name`, [req.params.id]);
    res.json({ ...sales[0], is_active: sales[0].is_active !== 0, items });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const title = String(req.body.title || '').trim();
    if (!title) throw bad('Title is required');
    if (title.length > 100) throw bad('Title is too long');
    const starts = dt(req.body.starts_at, 'Start time');
    const ends = dt(req.body.ends_at, 'End time');
    if (ends <= starts) throw bad('The end time must be after the start time');
    const [r] = await pool.execute('INSERT INTO flash_sales (title, starts_at, ends_at) VALUES (?, ?, ?)', [title, starts, ends]);
    res.status(201).json({ id: r.insertId, message: 'Flash sale created' });
  } catch (err) { fail(err, res, next); }
};

exports.update = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(starts_at, '%Y-%m-%d %H:%i:%s') AS starts_at, DATE_FORMAT(ends_at, '%Y-%m-%d %H:%i:%s') AS ends_at
       FROM flash_sales WHERE id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Flash sale not found' });

    const sets = []; const values = [];
    if (req.body.title !== undefined) {
      const t = String(req.body.title || '').trim();
      if (!t) throw bad('Title is required');
      if (t.length > 100) throw bad('Title is too long');
      sets.push('title = ?'); values.push(t);
    }
    const starts = req.body.starts_at !== undefined ? dt(req.body.starts_at, 'Start time') : rows[0].starts_at;
    const ends = req.body.ends_at !== undefined ? dt(req.body.ends_at, 'End time') : rows[0].ends_at;
    if (ends <= starts) throw bad('The end time must be after the start time');
    if (req.body.starts_at !== undefined) { sets.push('starts_at = ?'); values.push(starts); }
    if (req.body.ends_at !== undefined) { sets.push('ends_at = ?'); values.push(ends); }
    if (req.body.is_active !== undefined) { sets.push('is_active = ?'); values.push(req.body.is_active ? 1 : 0); }
    if (!sets.length) throw bad('Nothing to update');

    await pool.execute(`UPDATE flash_sales SET ${sets.join(', ')} WHERE id = ?`, [...values, req.params.id]);
    res.json({ message: 'Flash sale updated' });
  } catch (err) { fail(err, res, next); }
};

// Past orders keep their own price snapshot, so a sale can be deleted safely
exports.remove = async (req, res, next) => {
  try {
    const [r] = await pool.execute('DELETE FROM flash_sales WHERE id = ?', [req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ message: 'Flash sale not found' });
    res.json({ message: 'Flash sale deleted' });
  } catch (err) { next(err); }
};

// POST /api/flash-sales/:id/items  { product_id, sale_price }   (adds the product or changes its sale price)
exports.addItem = async (req, res, next) => {
  try {
    const productId = Number(req.body.product_id);
    const salePrice = Number(req.body.sale_price);
    if (!Number.isInteger(productId) || productId <= 0) throw bad('Choose a product');

    const [sales] = await pool.execute('SELECT id FROM flash_sales WHERE id = ?', [req.params.id]);
    if (!sales.length) return res.status(404).json({ message: 'Flash sale not found' });
    const [prods] = await pool.execute('SELECT price, discount_price, is_active FROM products WHERE id = ?', [productId]);
    if (!prods.length || !prods[0].is_active) throw bad('This product does not exist or is inactive');

    const current = Number(prods[0].discount_price ?? prods[0].price);
    if (!Number.isFinite(salePrice) || salePrice <= 0 || salePrice >= current)
      throw bad(`The sale price must be more than 0 and lower than the current price (${current.toFixed(2)})`);

    await pool.execute(
      `INSERT INTO flash_sale_items (flash_sale_id, product_id, sale_price) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE sale_price = VALUES(sale_price)`, [req.params.id, productId, salePrice.toFixed(2)]);
    res.status(201).json({ message: 'Product added to the sale' });
  } catch (err) { fail(err, res, next); }
};

exports.removeItem = async (req, res, next) => {
  try {
    const [r] = await pool.execute('DELETE FROM flash_sale_items WHERE flash_sale_id = ? AND product_id = ?', [req.params.id, req.params.productId]);
    if (!r.affectedRows) return res.status(404).json({ message: 'This product is not in the sale' });
    res.json({ message: 'Product removed from the sale' });
  } catch (err) { next(err); }
};
