const pool = require('../config/db');
const { calculate, fromCents } = require('../utils/pricing');

// Values taken from your payments table ENUMs
const PAYMENT_COD = 'cash_on_delivery';
const PAY_PENDING = 'pending';
const PAY_PAID = 'completed';
const PAY_FAILED = 'failed';
const PAY_REFUNDED = 'refunded';

// Allowed order status changes
const TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'returned'],
  delivered: ['returned'],
  cancelled: [],
  returned: [],
};
const CUSTOMER_CAN_CANCEL = ['pending', 'confirmed'];

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (err, res, next) => (err.status ? res.status(err.status).json({ message: err.message }) : next(err));

// ---------- CHECKOUT ----------
const MAX_CHECKOUT_ATTEMPTS = 3;

// POST /api/orders  { street, city, postal_code, country, phone, payment_method }
exports.create = async (req, res, next) => {
  for (let attempt = 1; attempt <= MAX_CHECKOUT_ATTEMPTS; attempt++) {
    let order;
    try {
      order = await createOrder(req.user.id, req.body);
    } catch (err) {
      // MariaDB rolls back the transaction if a locking read sees a newer row.
      if (err.code !== 'ER_CHECKREAD') return fail(err, res, next);
      if (attempt === MAX_CHECKOUT_ATTEMPTS)
        return fail(new HttpError(409, 'Stock changed during checkout. Please try again.'), res, next);
      continue;
    }
    return res.status(201).json(order);
  }
};

// Address fields fall back to the default delivery address, then the legacy profile.
async function createOrder(userId, body) {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // Lock before reading cart items so another checkout waits until this one commits or rolls back.
    const [carts] = await conn.execute('SELECT id FROM carts WHERE user_id = ? FOR UPDATE', [userId]);
    const [items] = carts.length ? await conn.execute(
      `SELECT ci.product_id, ci.quantity, p.name, p.price, p.discount_price, p.is_active,
              fn_effective_price(p.id) AS unit_price
       FROM cart_items ci JOIN products p ON p.id = ci.product_id
       WHERE ci.cart_id = ? ORDER BY ci.product_id`, [carts[0].id]) : [[]];
    if (!items.length) throw new HttpError(400, 'Your cart is empty');

    const paymentMethod = body.payment_method || PAYMENT_COD;
    if (paymentMethod !== PAYMENT_COD) throw new HttpError(400, 'Only cash on delivery is supported right now');

    const [[u]] = await conn.execute(
      `SELECT COALESCE(a.street, u.street) AS street, COALESCE(a.city, u.city) AS city,
              CASE WHEN a.id IS NULL THEN u.postal_code ELSE a.postal_code END AS postal_code,
              CASE WHEN a.id IS NULL THEN u.country ELSE a.country END AS country,
              COALESCE(a.phone, u.phone) AS phone
       FROM users u
       LEFT JOIN addresses a ON a.user_id = u.id AND a.is_default = 1
       WHERE u.id = ? ORDER BY a.id LIMIT 1`, [userId]);
    const ship = {
      street: body.street || u.street, city: body.city || u.city,
      postal_code: body.postal_code || u.postal_code, country: body.country || u.country,
      phone: body.phone || u.phone,
    };
    if (!ship.street || !ship.city || !ship.phone)
      throw new HttpError(400, 'Shipping street, city and phone are required');

    // Prices always come from the database, never from the client
    let totalCents = 0;
    const lines = items.map((i) => {
      if (!i.is_active) throw new HttpError(409, `"${i.name}" is no longer available`);
      const unitCents = Math.round(Number(i.unit_price) * 100);   // the price right now (flash sale included)
      totalCents += unitCents * i.quantity;
      return { ...i, unitCents };
    });

    // Coupon, delivery charge and final total (the coupon row is locked so it cannot be over-used)
    const priced = await calculate({ db: conn, userId, subtotalCents: totalCents, couponCode: body.coupon_code, lockCoupon: true });

    const [order] = await conn.execute(
      `INSERT INTO orders (user_id, total_amount, subtotal, discount_amount, delivery_charge, coupon_code,
                           street, city, postal_code, country, phone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, fromCents(priced.totalCents), fromCents(priced.subtotalCents), fromCents(priced.discountCents),
       fromCents(priced.deliveryCents), priced.coupon ? priced.coupon.code : null,
       ship.street, ship.city, ship.postal_code || null, ship.country || null, ship.phone]
    );
    const orderId = order.insertId;
    if (priced.coupon) {
      await conn.execute('INSERT INTO coupon_redemptions (coupon_id, user_id, order_id) VALUES (?, ?, ?)', [priced.coupon.id, userId, orderId]);
      await conn.execute('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?', [priced.coupon.id]);
    }
    await conn.execute(
      'INSERT INTO order_status_history (order_id, status, note, changed_by) VALUES (?, ?, ?, ?)',
      [orderId, 'pending', 'Order placed', userId]
    );

    await conn.query(
      'INSERT INTO order_items (order_id, product_id, product_name, price, quantity, subtotal) VALUES ?',
      [lines.map((l) => [orderId, l.product_id, l.name, (l.unitCents / 100).toFixed(2), l.quantity,
        ((l.unitCents * l.quantity) / 100).toFixed(2)])]
    );

    // Deduct stock. Rows are locked (FOR UPDATE) so two customers can never buy the same last item.
    for (const l of lines) {
      const [stockRows] = await conn.execute(
        'SELECT warehouse_id, quantity FROM warehouse_inventory WHERE product_id = ? ORDER BY warehouse_id FOR UPDATE',
        [l.product_id]
      );
      const available = stockRows.reduce((s, r) => s + r.quantity, 0);
      if (available < l.quantity)
        throw new HttpError(409, `Not enough stock for "${l.name}" (available: ${available})`);

      let remaining = l.quantity;
      for (const row of [...stockRows].sort((a, b) => b.quantity - a.quantity)) {
        if (!remaining) break;
        const take = Math.min(row.quantity, remaining);
        if (take <= 0) continue;
        await conn.execute(
          'UPDATE warehouse_inventory SET quantity = quantity - ? WHERE product_id = ? AND warehouse_id = ?',
          [take, l.product_id, row.warehouse_id]
        );
        await conn.execute(
          `INSERT INTO inventory_transactions
             (product_id, warehouse_id, transaction_type, quantity, previous_stock, new_stock, reference_id, note, performed_by)
           VALUES (?, ?, 'sale', ?, ?, ?, ?, ?, ?)`,
          [l.product_id, row.warehouse_id, -take, row.quantity, row.quantity - take, orderId, `Order #${orderId}`, userId]
        );
        remaining -= take;
      }
    }

    await conn.execute(
      'INSERT INTO payments (order_id, user_id, payment_method, amount, status) VALUES (?, ?, ?, ?, ?)',
      [orderId, userId, paymentMethod, fromCents(priced.totalCents), PAY_PENDING]
    );
    await conn.execute('DELETE FROM cart_items WHERE cart_id = ?', [carts[0].id]);

    await conn.commit();
    return { order_id: orderId, total_amount: fromCents(priced.totalCents), status: 'pending' };
  } catch (err) {
    if (conn) await conn.rollback().catch(() => conn.destroy());
    throw err;
  } finally { conn?.release(); }
}

// ---------- STATUS CHANGE / CANCEL (shared) ----------
// Puts back the stock of a cancelled/returned order into the SAME warehouses it was taken from.
async function restoreStock(conn, orderId, actorId, reason) {
  const [sales] = await conn.execute(
    `SELECT product_id, warehouse_id, SUM(-quantity) AS qty
     FROM inventory_transactions
     WHERE reference_id = ? AND transaction_type = 'sale'
     GROUP BY product_id, warehouse_id ORDER BY product_id, warehouse_id`,
    [orderId]
  );
  for (const s of sales) {
    const [[inv]] = await conn.execute(
      'SELECT quantity FROM warehouse_inventory WHERE product_id = ? AND warehouse_id = ? FOR UPDATE',
      [s.product_id, s.warehouse_id]
    );
    const back = Number(s.qty);
    await conn.execute(
      'UPDATE warehouse_inventory SET quantity = quantity + ? WHERE product_id = ? AND warehouse_id = ?',
      [back, s.product_id, s.warehouse_id]
    );
    await conn.execute(
      `INSERT INTO inventory_transactions
         (product_id, warehouse_id, transaction_type, quantity, previous_stock, new_stock, reference_id, note, performed_by)
       VALUES (?, ?, 'return', ?, ?, ?, ?, ?, ?)`,
      [s.product_id, s.warehouse_id, back, inv.quantity, inv.quantity + back, orderId, reason, actorId]
    );
  }
}

// A cancelled order gives its coupon use back
async function releaseCoupon(conn, orderId) {
  const [rows] = await conn.execute('SELECT coupon_id FROM coupon_redemptions WHERE order_id = ?', [orderId]);
  for (const r of rows)
    await conn.execute('UPDATE coupons SET used_count = GREATEST(used_count - 1, 0) WHERE id = ?', [r.coupon_id]);
  await conn.execute('DELETE FROM coupon_redemptions WHERE order_id = ?', [orderId]);
}

async function changeStatus({ orderId, newStatus, actorId, ownerId = null, note = null }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute('SELECT id, user_id, status FROM orders WHERE id = ? FOR UPDATE', [orderId]);
    if (!rows.length || (ownerId && rows[0].user_id !== ownerId)) throw new HttpError(404, 'Order not found');

    const current = rows[0].status;
    if (ownerId && !CUSTOMER_CAN_CANCEL.includes(current))
      throw new HttpError(409, `An order that is "${current}" can no longer be cancelled`);
    if (!(TRANSITIONS[current] || []).includes(newStatus))
      throw new HttpError(409, `Cannot change status from "${current}" to "${newStatus}"`);

    if (newStatus === 'cancelled' || newStatus === 'returned')
      await restoreStock(conn, orderId, actorId, `Order #${orderId} ${newStatus}`);
    if (newStatus === 'cancelled') await releaseCoupon(conn, orderId);
    if (newStatus === 'delivered')
      await conn.execute('UPDATE payments SET status = ?, paid_at = NOW() WHERE order_id = ?', [PAY_PAID, orderId]);
    // Cancelled before payment -> failed; returned after payment was collected -> refunded
    if (newStatus === 'cancelled')
      await conn.execute('UPDATE payments SET status = ? WHERE order_id = ? AND status = ?', [PAY_FAILED, orderId, PAY_PENDING]);
    if (newStatus === 'returned')
      await conn.execute('UPDATE payments SET status = ? WHERE order_id = ? AND status = ?', [PAY_REFUNDED, orderId, PAY_PAID]);

    await conn.execute('UPDATE orders SET status = ? WHERE id = ?', [newStatus, orderId]);
    await conn.execute(
      'INSERT INTO order_status_history (order_id, status, note, changed_by) VALUES (?, ?, ?, ?)',
      [orderId, newStatus, note, actorId]
    );
    await conn.commit();
    return { order_id: orderId, status: newStatus };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally { conn.release(); }
}

// Customer cancels own order
exports.cancel = async (req, res, next) => {
  try {
    res.json(await changeStatus({ orderId: Number(req.params.id), newStatus: 'cancelled', actorId: req.user.id, ownerId: req.user.id, note: 'Cancelled by customer' }));
  } catch (err) { fail(err, res, next); }
};

// Admin updates status: PATCH { "status": "confirmed" }
exports.updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!Object.keys(TRANSITIONS).includes(status)) return res.status(400).json({ message: 'Invalid status' });
    res.json(await changeStatus({ orderId: Number(req.params.id), newStatus: status, actorId: req.user.id, note: req.body.note ? String(req.body.note).slice(0, 255) : null }));
  } catch (err) { fail(err, res, next); }
};

// ---------- READ ----------
exports.myOrders = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, total_amount, status, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC, id DESC',
      [req.user.id]
    );
    if (rows.length) {
      const [items] = await pool.query(
        `SELECT oi.order_id, oi.product_id, oi.product_name, oi.quantity,
                (SELECT image_url FROM product_images pi WHERE pi.product_id = oi.product_id ORDER BY pi.id LIMIT 1) AS image
         FROM order_items oi WHERE oi.order_id IN (?) ORDER BY oi.id`, [rows.map((r) => r.id)]);
      const byOrder = {};
      items.forEach((it) => { (byOrder[it.order_id] ||= []).push(it); });
      rows.forEach((r) => {
        const list = byOrder[r.id] || [];
        r.item_count = list.reduce((n, it) => n + it.quantity, 0);
        r.items = list.slice(0, 4).map(({ product_id, product_name, quantity, image }) => ({ product_id, product_name, quantity, image }));
      });
    }
    res.json(rows);
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    const [orders] = await pool.execute(
      'SELECT o.*, u.name AS customer_name, u.email AS customer_email FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = ?',
      [req.params.id]);
    const order = orders[0];
    // Customers only see their own orders; admins can see all
    if (!order || (req.user.role !== 'admin' && order.user_id !== req.user.id))
      return res.status(404).json({ message: 'Order not found' });
    const [items] = await pool.execute(
      'SELECT product_id, product_name, price, quantity, subtotal FROM order_items WHERE order_id = ?', [order.id]);
    const [payments] = await pool.execute(
      'SELECT payment_method, amount, status, transaction_id, paid_at FROM payments WHERE order_id = ?', [order.id]);
    const [history] = await pool.execute(
      'SELECT status, note, created_at FROM order_status_history WHERE order_id = ? ORDER BY created_at, id', [order.id]);
    res.json({ ...order, items, payment: payments[0] || null, history });
  } catch (err) { next(err); }
};

// ADMIN: GET /api/orders/manage/all?status=&page=&limit=
exports.listAll = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    const where = []; const params = [];
    if (req.query.status) { where.push('o.status = ?'); params.push(req.query.status); }
    const search = String(req.query.search || '').trim().slice(0, 200);
    if (search) {
      const id = /^#?\d+$/.test(search) ? search.replace(/^#/, '') : 0;
      where.push('(o.id = ? OR u.name LIKE ? OR u.email LIKE ?)');
      params.push(id, `%${search}%`, `%${search}%`);
    }
    const { from, to } = req.query;
    const validDate = (value) => {
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const date = new Date(value + 'T00:00:00Z');
      return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && value >= '1000-01-01';
    };
    if ((from && !validDate(from)) || (to && !validDate(to)) || (from && to && from > to))
      return res.status(400).json({ message: 'Choose a valid date range' });
    if (from) { where.push('o.created_at >= ?'); params.push(from); }
    if (to) { where.push('o.created_at < DATE_ADD(?, INTERVAL 1 DAY)'); params.push(to); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [rows] = await pool.query(
      `SELECT o.id, o.total_amount, o.status, o.created_at, u.name AS customer_name, u.email AS customer_email
       FROM orders o JOIN users u ON u.id = o.user_id ${whereSql}
       ORDER BY o.created_at DESC, o.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, (page - 1) * limit]
    );
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM orders o JOIN users u ON u.id = o.user_id ${whereSql}`, params);
    res.json({ page, limit, total, orders: rows });
  } catch (err) { next(err); }
};

// POST /api/orders/:id/reorder  -> puts the items of one of your earlier orders back into your cart ("Buy it again")
exports.reorder = async (req, res, next) => {
  let conn;
  try {
    const orderId = Number(req.params.id);
    const [orders] = await pool.execute('SELECT id FROM orders WHERE id = ? AND user_id = ?', [orderId, req.user.id]);
    if (!orders.length) return res.status(404).json({ message: 'Order not found' });

    // Ensure the cart exists before the transaction, then lock the same row used by checkout.
    await pool.execute('INSERT IGNORE INTO carts (user_id) VALUES (?)', [req.user.id]);
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [[cart]] = await conn.execute('SELECT id FROM carts WHERE user_id = ? FOR UPDATE', [req.user.id]);

    const [items] = await conn.execute(
      `SELECT oi.product_id, oi.product_name, oi.quantity AS qty, p.is_active, fn_get_total_stock(oi.product_id) AS stock
       FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?`, [orderId]);

    const added = []; const skipped = [];
    for (const it of items) {
      if (!it.product_id || it.is_active !== 1) { skipped.push({ name: it.product_name, reason: 'no longer available' }); continue; }
      const stock = Number(it.stock);
      if (stock <= 0) { skipped.push({ name: it.product_name, reason: 'out of stock' }); continue; }
      const [ex] = await conn.execute('SELECT quantity FROM cart_items WHERE cart_id = ? AND product_id = ?', [cart.id, it.product_id]);
      const existing = ex[0]?.quantity || 0;
      const target = Math.min(existing + it.qty, stock);
      if (target <= existing) { skipped.push({ name: it.product_name, reason: 'your cart already has all that is in stock' }); continue; }
      await conn.execute(
        `INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)`, [cart.id, it.product_id, target]);
      added.push({ name: it.product_name, quantity: target - existing, limited: target < existing + it.qty });
    }
    await conn.commit();
    res.json({ added, skipped });
  } catch (err) {
    if (conn) await conn.rollback().catch(() => conn.destroy());
    next(err);
  } finally { conn?.release(); }
};
