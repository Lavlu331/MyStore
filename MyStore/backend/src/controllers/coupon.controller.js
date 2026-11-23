const pool = require('../config/db');

const DATE_RE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?$/;
const bad = (message) => { const e = new Error(message); e.status = 400; return e; };
const optNumber = (v, label, { min = 0 } = {}) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min) throw bad(`${label} must be a number of ${min} or more`);
  return n;
};
const optInt = (v, label) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw bad(`${label} must be a whole number of 1 or more`);
  return n;
};
const optDate = (v, label) => {
  if (v === undefined || v === null || v === '') return null;
  if (!DATE_RE.test(String(v))) throw bad(`${label} is not a valid date`);
  return String(v).replace('T', ' ');
};

// Turns the request body into column values (only for fields that were sent)
function parse(body, { creating }) {
  const out = {};
  if (creating) {
    const code = String(body.code || '').trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,50}$/.test(code)) throw bad('Code must be 3-50 characters: letters, numbers, - or _');
    out.code = code;
  }
  if (creating || body.discount_type !== undefined) {
    if (!['percent', 'fixed'].includes(body.discount_type)) throw bad('Discount type must be percent or fixed');
    out.discount_type = body.discount_type;
  }
  if (creating || body.discount_value !== undefined) {
    const v = Number(body.discount_value);
    if (!Number.isFinite(v) || v <= 0) throw bad('Discount value must be greater than 0');
    out.discount_value = v;
  }
  const type = out.discount_type || body.discount_type;
  if (type === 'percent' && out.discount_value > 100) throw bad('A percent discount cannot be more than 100');
  if (body.description !== undefined) out.description = String(body.description || '').trim().slice(0, 255) || null;
  if (body.max_discount !== undefined) out.max_discount = optNumber(body.max_discount, 'Maximum discount');
  if (body.min_order_amount !== undefined) out.min_order_amount = optNumber(body.min_order_amount, 'Minimum order amount') ?? 0;
  if (body.usage_limit !== undefined) out.usage_limit = optInt(body.usage_limit, 'Usage limit');
  if (body.per_user_limit !== undefined) out.per_user_limit = optInt(body.per_user_limit, 'Per-user limit') ?? 1;
  if (body.starts_at !== undefined) out.starts_at = optDate(body.starts_at, 'Start date');
  if (body.expires_at !== undefined) out.expires_at = optDate(body.expires_at, 'Expiry date');
  if (body.is_active !== undefined) out.is_active = body.is_active ? 1 : 0;
  if (body.is_public !== undefined) out.is_public = body.is_public ? 1 : 0;
  return out;
}

const fail = (err, res, next) => {
  if (err.status) return res.status(err.status).json({ message: err.message });
  if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'This coupon code already exists' });
  next(err);
};

exports.list = async (req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM coupons ORDER BY created_at DESC, id DESC');
    res.json(rows.map((c) => ({ ...c, is_active: c.is_active !== 0, is_public: c.is_public === 1 })));
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const data = parse(req.body, { creating: true });
    const cols = Object.keys(data);
    const [r] = await pool.execute(
      `INSERT INTO coupons (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, cols.map((c) => data[c]));
    res.status(201).json({ id: r.insertId, message: 'Coupon created' });
  } catch (err) { fail(err, res, next); }
};

exports.update = async (req, res, next) => {
  try {
    const data = parse(req.body, { creating: false });
    const cols = Object.keys(data);
    if (!cols.length) return res.status(400).json({ message: 'Nothing to update' });
    const [r] = await pool.execute(
      `UPDATE coupons SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [...cols.map((c) => data[c]), req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ message: 'Coupon not found' });
    res.json({ message: 'Coupon updated' });
  } catch (err) { fail(err, res, next); }
};

// Soft delete: past orders still point at the coupon
exports.remove = async (req, res, next) => {
  try {
    const [r] = await pool.execute('UPDATE coupons SET is_active = 0 WHERE id = ?', [req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ message: 'Coupon not found' });
    res.json({ message: 'Coupon deactivated' });
  } catch (err) { next(err); }
};

// AUTH (any customer): GET /api/coupons/available -> coupons marked "public" that can still be used
exports.available = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT c.id, c.code, c.description, c.discount_type, c.discount_value, c.max_discount, c.min_order_amount,
              c.per_user_limit, DATE_FORMAT(c.expires_at, '%Y-%m-%d %H:%i') AS expires_at,
              (SELECT COUNT(*) FROM coupon_redemptions r WHERE r.coupon_id = c.id AND r.user_id = ?) AS used_by_me
       FROM coupons c
       WHERE c.is_public = 1 AND c.is_active = 1
         AND (c.starts_at IS NULL OR c.starts_at <= NOW()) AND (c.expires_at IS NULL OR c.expires_at > NOW())
         AND (c.usage_limit IS NULL OR c.used_count < c.usage_limit)
       ORDER BY c.expires_at IS NULL, c.expires_at ASC, c.id DESC`, [req.user.id]);
    res.json(rows.map((c) => ({ ...c, used_by_me: Number(c.used_by_me), can_use: Number(c.used_by_me) < c.per_user_limit })));
  } catch (err) { next(err); }
};
