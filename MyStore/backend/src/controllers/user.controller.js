const pool = require('../config/db');

const ROLES = ['customer', 'inventory_manager', 'admin'];

// GET /api/users?search=&role=&page=&limit=
exports.list = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    const where = ['1=1']; const params = [];
    if (req.query.search) { where.push('(u.name LIKE ? OR u.email LIKE ?)'); params.push(`%${req.query.search}%`, `%${req.query.search}%`); }
    if (ROLES.includes(req.query.role)) { where.push('u.role = ?'); params.push(req.query.role); }
    const whereSql = where.join(' AND ');

    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.is_active, u.created_at,
              (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS orders_count
       FROM users u WHERE ${whereSql} ORDER BY u.created_at DESC, u.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, (page - 1) * limit]);
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM users u WHERE ${whereSql}`, params);
    res.json({ page, limit, total, users: rows.map((u) => ({ ...u, is_active: u.is_active !== 0 })) });
  } catch (err) { next(err); }
};

exports.history = async (req, res, next) => {
  try {
    const [entries] = await pool.execute(
      `SELECT audit.id, audit.actor_id, actor.name AS actor_name, audit.previous_role,
              audit.new_role, audit.previous_active, audit.new_active, audit.created_at
       FROM admin_user_audit audit LEFT JOIN users actor ON actor.id = audit.actor_id
       WHERE audit.user_id = ? ORDER BY audit.id DESC LIMIT 50`, [req.params.id]);
    res.json(entries);
  } catch (err) { next(err); }
};

// PATCH /api/users/:id  { role?, is_active? }
exports.update = async (req, res, next) => {
  let conn;
  try {
    const id = Number(req.params.id);
    if (id === req.user.id) return res.status(400).json({ message: 'You cannot change your own role or status' });

    const sets = []; const values = [];
    if (req.body.role !== undefined) {
      if (!ROLES.includes(req.body.role)) return res.status(400).json({ message: 'Invalid role' });
      sets.push('role = ?'); values.push(req.body.role);
    }
    if (req.body.is_active !== undefined) { sets.push('is_active = ?'); values.push(req.body.is_active ? 1 : 0); }
    if (!sets.length) return res.status(400).json({ message: 'Nothing to update' });

    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [[previous]] = await conn.execute('SELECT role, is_active FROM users WHERE id = ? FOR UPDATE', [id]);
    if (!previous) {
      await conn.rollback();
      return res.status(404).json({ message: 'User not found' });
    }
    const role = req.body.role ?? previous.role;
    const active = req.body.is_active === undefined ? Number(previous.is_active) : Number(Boolean(req.body.is_active));
    if (role !== previous.role || active !== Number(previous.is_active)) {
      await conn.execute(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...values, id]);
      await conn.execute(
        `INSERT INTO admin_user_audit (user_id, actor_id, previous_role, new_role, previous_active, new_active)
         VALUES (?, ?, ?, ?, ?, ?)`, [id, req.user.id, previous.role, role, previous.is_active, active]);
    }
    await conn.commit();
    res.json({ message: 'User updated' });
  } catch (err) {
    if (conn) await conn.rollback().catch(() => conn.destroy());
    next(err);
  } finally { conn?.release(); }
};
