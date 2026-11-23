const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// Verifies the JWT, then re-reads the user's CURRENT role and status from the database,
// so a role change or a deactivation takes effect immediately (not only after the token expires).
exports.authenticate = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Authentication required' });

  let payload;
  try { payload = jwt.verify(token, process.env.JWT_SECRET); }
  catch { return res.status(401).json({ message: 'Invalid or expired token', code: 'AUTH_EXPIRED' }); }

  try {
    const [rows] = await pool.execute('SELECT id, role, is_active, token_version FROM users WHERE id = ?', [payload.id]);
    if (!rows.length || rows[0].is_active === 0)
      return res.status(401).json({ message: 'Account not found or deactivated', code: 'AUTH_EXPIRED' });
    // "Sign out of all devices" raises token_version, which ends every older session
    if ((payload.tv || 0) !== (rows[0].token_version || 0))
      return res.status(401).json({ message: 'You were signed out. Please log in again.', code: 'AUTH_EXPIRED' });
    req.user = { id: rows[0].id, role: rows[0].role };
    next();
  } catch (err) { next(err); }
};
