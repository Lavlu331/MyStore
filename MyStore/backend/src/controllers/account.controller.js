const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const upload = require('../middleware/upload');
const { looksLikeImage } = require('../utils/imageSignature');
const { signToken } = require('./auth.controller');

const ACTIVE = "('pending', 'confirmed', 'processing', 'shipped')";

// GET /api/account/summary  -> the numbers shown on the "Your Account" page
exports.summary = async (req, res, next) => {
  try {
    const sql = `SELECT
      (SELECT COUNT(*) FROM orders WHERE user_id = ?) AS orders,
      (SELECT COUNT(*) FROM orders WHERE user_id = ? AND status IN ${ACTIVE}) AS active_orders,
      (SELECT COUNT(*) FROM orders WHERE user_id = ? AND status = 'delivered') AS delivered,
      (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE user_id = ? AND status = 'delivered') AS spent,
      (SELECT COALESCE(SUM(discount_amount), 0) FROM orders WHERE user_id = ? AND status NOT IN ('cancelled', 'returned')) AS saved,
      (SELECT COUNT(*) FROM reviews WHERE user_id = ?) AS reviews,
      (SELECT COUNT(*) FROM wishlist_items WHERE user_id = ?) AS wishlist,
      (SELECT COUNT(*) FROM addresses WHERE user_id = ?) AS addresses,
      (SELECT COUNT(*) FROM coupons c
         WHERE c.is_public = 1 AND c.is_active = 1
           AND (c.starts_at IS NULL OR c.starts_at <= NOW()) AND (c.expires_at IS NULL OR c.expires_at > NOW())
           AND (c.usage_limit IS NULL OR c.used_count < c.usage_limit)
           AND (SELECT COUNT(*) FROM coupon_redemptions r WHERE r.coupon_id = c.id AND r.user_id = ?) < c.per_user_limit) AS vouchers,
      (SELECT COUNT(DISTINCT oi.product_id) FROM order_items oi JOIN orders o ON o.id = oi.order_id
         WHERE o.user_id = ? AND o.status = 'delivered' AND oi.product_id IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.user_id = o.user_id AND r.product_id = oi.product_id)) AS to_review`;
    const [[row]] = await pool.execute(sql, Array(sql.split('?').length - 1).fill(req.user.id));
    const out = {};
    Object.entries(row).forEach(([k, v]) => { out[k] = Number(v); });
    res.json(out);
  } catch (err) { next(err); }
};

// ---------- profile photo ----------
const removeFile = (url) => {
  if (url && url.startsWith('/uploads/')) fs.unlink(path.join(upload.dir, path.basename(url)), () => {});
};

exports.uploadAvatar = (req, res) => {
  upload.single('image')(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.code === 'LIMIT_FILE_SIZE' ? 'Photo must be 2 MB or smaller' : err.message });
    if (!req.file) return res.status(400).json({ message: 'No photo received' });
    try {
      const head = Buffer.alloc(12);
      const fd = fs.openSync(req.file.path, 'r');
      fs.readSync(fd, head, 0, 12, 0);
      fs.closeSync(fd);
      if (!looksLikeImage(head, req.file.mimetype)) {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ message: 'The file is not a valid image' });
      }
      const [rows] = await pool.execute('SELECT avatar_url FROM users WHERE id = ?', [req.user.id]);
      const url = `/uploads/${req.file.filename}`;
      await pool.execute('UPDATE users SET avatar_url = ? WHERE id = ?', [url, req.user.id]);
      removeFile(rows[0]?.avatar_url);
      res.status(201).json({ avatar_url: url });
    } catch (e) { fs.unlink(req.file.path, () => {}); res.status(500).json({ message: 'Internal server error' }); }
  });
};

exports.removeAvatar = async (req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT avatar_url FROM users WHERE id = ?', [req.user.id]);
    await pool.execute('UPDATE users SET avatar_url = NULL WHERE id = ?', [req.user.id]);
    removeFile(rows[0]?.avatar_url);
    res.json({ message: 'Photo removed' });
  } catch (err) { next(err); }
};

// ---------- security ----------
// POST /api/account/revoke-sessions -> signs out every OTHER device; this device gets a fresh token
exports.revokeSessions = async (req, res, next) => {
  try {
    await pool.execute('UPDATE users SET token_version = token_version + 1 WHERE id = ?', [req.user.id]);
    const [[u]] = await pool.execute('SELECT id, role, token_version FROM users WHERE id = ?', [req.user.id]);
    res.json({ message: 'All other devices were signed out', token: signToken(u) });
  } catch (err) { next(err); }
};

// POST /api/account/deactivate { password }  -> a customer closes their own account
exports.deactivate = async (req, res, next) => {
  try {
    const password = req.body.password;
    if (typeof password !== 'string' || !password) return res.status(400).json({ message: 'Enter your password to confirm' });
    const [rows] = await pool.execute('SELECT password, role FROM users WHERE id = ?', [req.user.id]);
    if (rows[0].role !== 'customer') return res.status(403).json({ message: 'Staff accounts can only be deactivated by an administrator' });
    if (!(await bcrypt.compare(password, rows[0].password))) return res.status(401).json({ message: 'Password is incorrect' });

    const [[{ n }]] = await pool.execute(`SELECT COUNT(*) AS n FROM orders WHERE user_id = ? AND status IN ${ACTIVE}`, [req.user.id]);
    if (n > 0) return res.status(409).json({ message: `You still have ${n} order${n === 1 ? '' : 's'} in progress. Wait until they are delivered or cancel them first.` });

    await pool.execute('UPDATE users SET is_active = 0, token_version = token_version + 1 WHERE id = ?', [req.user.id]);
    res.json({ message: 'Your account has been deactivated' });
  } catch (err) { next(err); }
};

// GET /api/account/export -> everything the shop stores about you, as a JSON file (never includes the password)
exports.exportData = async (req, res, next) => {
  try {
    const uid = req.user.id;
    const [[profile]] = await pool.execute(
      `SELECT id, name, email, phone, role, street, city, postal_code, country, gender,
              DATE_FORMAT(birthday, '%Y-%m-%d') AS birthday, created_at FROM users WHERE id = ?`, [uid]);
    const [addresses] = await pool.execute('SELECT label, phone, street, city, postal_code, country, is_default, created_at FROM addresses WHERE user_id = ?', [uid]);
    const [orders] = await pool.execute(
      `SELECT id, status, total_amount, subtotal, discount_amount, delivery_charge, coupon_code, street, city, postal_code, country, phone, created_at
       FROM orders WHERE user_id = ? ORDER BY id`, [uid]);
    if (orders.length) {
      const [items] = await pool.query('SELECT order_id, product_name, price, quantity, subtotal FROM order_items WHERE order_id IN (?)', [orders.map((o) => o.id)]);
      orders.forEach((o) => { o.items = items.filter((i) => i.order_id === o.id).map(({ order_id, ...rest }) => rest); });
    }
    const [reviews] = await pool.execute(
      'SELECT p.name AS product, r.rating, r.comment, r.created_at FROM reviews r JOIN products p ON p.id = r.product_id WHERE r.user_id = ?', [uid]);
    const [wishlist] = await pool.execute(
      'SELECT p.name AS product, w.created_at FROM wishlist_items w JOIN products p ON p.id = w.product_id WHERE w.user_id = ?', [uid]);

    res.setHeader('Content-Disposition', 'attachment; filename="my-data.json"');
    res.json({ exported_at: new Date().toISOString(), profile, addresses, orders, reviews, wishlist });
  } catch (err) { next(err); }
};
