const pool = require('../config/db');

const bad = (message) => { const e = new Error(message); e.status = 400; return e; };
const fail = (err, res, next) => (err.status ? res.status(err.status).json({ message: err.message }) : next(err));

const LIMITS = { label: 30, phone: 20, street: 255, city: 100, postal_code: 20, country: 100 };
const REQUIRED = ['street', 'city', 'phone'];
const MAX_ADDRESSES = 10;

function clean(body, partial) {
  const out = {};
  for (const k of Object.keys(LIMITS)) {
    if (body[k] === undefined) {
      if (!partial && REQUIRED.includes(k)) throw bad(`${k.replace('_', ' ')} is required`);
      continue;
    }
    const v = String(body[k] ?? '').trim();
    if (REQUIRED.includes(k) && !v) throw bad(`${k.replace('_', ' ')} is required`);
    if (v.length > LIMITS[k]) throw bad(`${k.replace('_', ' ')} is too long`);
    out[k] = v || null;
  }
  if ('label' in out && !out.label) out.label = 'Home';
  if (!partial && !out.label) out.label = 'Home';
  return out;
}

// Keeps the old profile address columns equal to the default address (older code still reads them)
async function syncUser(conn, userId) {
  const [rows] = await conn.execute(
    'SELECT street, city, postal_code, country FROM addresses WHERE user_id = ? AND is_default = 1 LIMIT 1', [userId]);
  const a = rows[0] || { street: null, city: null, postal_code: null, country: null };
  await conn.execute('UPDATE users SET street = ?, city = ?, postal_code = ?, country = ? WHERE id = ?',
    [a.street, a.city, a.postal_code, a.country, userId]);
}

exports.list = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, label, phone, street, city, postal_code, country, is_default
       FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id ASC`, [req.user.id]);
    res.json(rows.map((a) => ({ ...a, is_default: a.is_default === 1 })));
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const data = clean(req.body, false);
    await conn.beginTransaction();
    const [[{ n }]] = await conn.execute('SELECT COUNT(*) AS n FROM addresses WHERE user_id = ? FOR UPDATE', [req.user.id]);
    if (n >= MAX_ADDRESSES) throw bad(`You can save up to ${MAX_ADDRESSES} addresses`);
    const isDefault = n === 0 || Boolean(req.body.is_default);
    if (isDefault) await conn.execute('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [req.user.id]);
    const cols = [...Object.keys(data), 'user_id', 'is_default'];
    const [r] = await conn.execute(
      `INSERT INTO addresses (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
      [...Object.values(data), req.user.id, isDefault ? 1 : 0]);
    if (isDefault) await syncUser(conn, req.user.id);
    await conn.commit();
    res.status(201).json({ id: r.insertId, is_default: isDefault, message: 'Address saved' });
  } catch (err) { if (conn) await conn.rollback().catch(() => conn.destroy()); fail(err, res, next); } finally { conn?.release(); }
};

exports.update = async (req, res, next) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const data = clean(req.body, true);
    const makeDefault = req.body.is_default === true;
    if (!Object.keys(data).length && !makeDefault) throw bad('Nothing to update');
    await conn.beginTransaction();
    const [own] = await conn.execute('SELECT id, is_default FROM addresses WHERE id = ? AND user_id = ? FOR UPDATE', [req.params.id, req.user.id]);
    if (!own.length) { await conn.rollback(); return res.status(404).json({ message: 'Address not found' }); }
    const cols = Object.keys(data);
    if (cols.length) await conn.execute(`UPDATE addresses SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [...cols.map((c) => data[c]), req.params.id]);
    if (makeDefault) {
      await conn.execute('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [req.user.id]);
      await conn.execute('UPDATE addresses SET is_default = 1 WHERE id = ?', [req.params.id]);
    }
    if (makeDefault || own[0].is_default === 1) await syncUser(conn, req.user.id);
    await conn.commit();
    res.json({ message: 'Address updated' });
  } catch (err) { if (conn) await conn.rollback().catch(() => conn.destroy()); fail(err, res, next); } finally { conn?.release(); }
};

exports.setDefault = async (req, res, next) => {
  req.body = { is_default: true };
  return exports.update(req, res, next);
};

exports.remove = async (req, res, next) => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [own] = await conn.execute('SELECT is_default FROM addresses WHERE id = ? AND user_id = ? FOR UPDATE', [req.params.id, req.user.id]);
    if (!own.length) { await conn.rollback(); return res.status(404).json({ message: 'Address not found' }); }
    await conn.execute('DELETE FROM addresses WHERE id = ?', [req.params.id]);
    if (own[0].is_default === 1) {
      // the oldest remaining address becomes the default
      await conn.execute('UPDATE addresses SET is_default = 1 WHERE user_id = ? ORDER BY id ASC LIMIT 1', [req.user.id]);
      await syncUser(conn, req.user.id);
    }
    await conn.commit();
    res.json({ message: 'Address deleted' });
  } catch (err) { if (conn) await conn.rollback().catch(() => conn.destroy()); next(err); } finally { conn?.release(); }
};
