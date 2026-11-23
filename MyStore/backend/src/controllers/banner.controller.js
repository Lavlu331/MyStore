const pool = require('../config/db');

const bad = (message) => { const e = new Error(message); e.status = 400; return e; };
const LINK_RE = /^(\/[^\s]*|https?:\/\/[^\s]+)$/;   // an internal path or a web address (no javascript: links)

function parse(body, creating) {
  const out = {};
  if (creating || body.title !== undefined) {
    const t = String(body.title || '').trim();
    if (!t) throw bad('Title is required');
    if (t.length > 150) throw bad('Title is too long');
    out.title = t;
  }
  if (body.subtitle !== undefined) {
    const s = String(body.subtitle || '').trim();
    if (s.length > 255) throw bad('Subtitle is too long');
    out.subtitle = s || null;
  }
  if (body.image_url !== undefined) {
    const u = String(body.image_url || '').trim();
    if (u.length > 500) throw bad('Image address is too long');
    if (u && !/^(\/uploads\/|https?:\/\/)/.test(u)) throw bad('The image must be an uploaded file or a web address');
    out.image_url = u || null;
  }
  if (body.link_url !== undefined) {
    const l = String(body.link_url || '').trim();
    if (l.length > 255) throw bad('Link is too long');
    if (l && !LINK_RE.test(l)) throw bad('A link must start with / or http(s)://');
    out.link_url = l || null;
  }
  if (body.sort_order !== undefined) {
    const n = Number(body.sort_order);
    if (!Number.isInteger(n) || n < -1000 || n > 1000) throw bad('Order must be a whole number');
    out.sort_order = n;
  }
  if (body.is_active !== undefined) out.is_active = body.is_active ? 1 : 0;
  return out;
}

const fail = (err, res, next) => (err.status ? res.status(err.status).json({ message: err.message }) : next(err));

// PUBLIC: active banners in display order
exports.list = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, title, subtitle, image_url, link_url FROM banners WHERE is_active = 1 ORDER BY sort_order ASC, id DESC');
    res.json(rows);
  } catch (err) { next(err); }
};

// ADMIN
exports.adminList = async (req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM banners ORDER BY sort_order ASC, id DESC');
    res.json(rows.map((b) => ({ ...b, is_active: b.is_active !== 0 })));
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const data = parse(req.body, true);
    const cols = Object.keys(data);
    const [r] = await pool.execute(
      `INSERT INTO banners (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, cols.map((c) => data[c]));
    res.status(201).json({ id: r.insertId, message: 'Banner created' });
  } catch (err) { fail(err, res, next); }
};

exports.update = async (req, res, next) => {
  try {
    const data = parse(req.body, false);
    const cols = Object.keys(data);
    if (!cols.length) return res.status(400).json({ message: 'Nothing to update' });
    const [r] = await pool.execute(
      `UPDATE banners SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [...cols.map((c) => data[c]), req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ message: 'Banner not found' });
    res.json({ message: 'Banner updated' });
  } catch (err) { fail(err, res, next); }
};

exports.remove = async (req, res, next) => {
  try {
    const [r] = await pool.execute('DELETE FROM banners WHERE id = ?', [req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ message: 'Banner not found' });
    res.json({ message: 'Banner deleted' });
  } catch (err) { next(err); }
};
