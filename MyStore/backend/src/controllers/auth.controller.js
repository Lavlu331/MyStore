const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const signToken = (user) =>
  jwt.sign({ id: user.id, role: user.role, tv: user.token_version || 0 }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const normalizeEmail = (v) => String(v || '').trim().toLowerCase();
// bcrypt only reads the first 72 bytes, so longer passwords are refused instead of silently cut
const passwordProblem = (pw) => {
  if (typeof pw !== 'string' || pw.length < 8) return 'Password must be at least 8 characters';
  if (Buffer.byteLength(pw) > 72) return 'Password is too long (maximum 72 bytes)';
  return null;
};
// Same sizes as the database columns, so too-long input gives a clear message instead of a server error
const LIMITS = { name: 100, email: 150, phone: 20, street: 255, city: 100, postal_code: 20, country: 100 };
const tooLong = (obj) => Object.keys(LIMITS).find((k) => obj[k] !== undefined && obj[k] !== null && String(obj[k]).length > LIMITS[k]);

exports.register = async (req, res, next) => {
  try {
    const { password, phone, street, city, postal_code, country } = req.body;
    const name = String(req.body.name || '').trim();
    const email = normalizeEmail(req.body.email);
    if (!name || !email || !password)
      return res.status(400).json({ message: 'Name, email and password are required' });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ message: 'Please enter a valid email address' });
    const pwProblem = passwordProblem(password);
    if (pwProblem) return res.status(400).json({ message: pwProblem });
    const long = tooLong({ name, email, phone, street, city, postal_code, country });
    if (long) return res.status(400).json({ message: `${long.replace('_', ' ')} is too long` });

    const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) return res.status(409).json({ message: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    // Role is always "customer" here. Never trust a role sent by the client.
    const [result] = await pool.execute(
      `INSERT INTO users (name, email, password, phone, role, street, city, postal_code, country)
       VALUES (?, ?, ?, ?, 'customer', ?, ?, ?, ?)`,
      [name, email, passwordHash, phone || null, street || null, city || null,
       postal_code || null, country || null]
    );

    const user = { id: result.insertId, name, email, role: 'customer' };
    res.status(201).json({ token: signToken(user), user });
  } catch (err) { next(err); }
};

exports.login = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = req.body.password;
    if (!email || typeof password !== 'string' || !password)
      return res.status(400).json({ message: 'Email and password are required' });

    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    const user = rows[0];
    const ok = user && (await bcrypt.compare(password, user.password));
    if (!ok) return res.status(401).json({ message: 'Invalid email or password' });
    if (!user.is_active)
      return res.status(403).json({ message: 'This account has been deactivated' });

    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) { next(err); }
};

exports.me = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, name, email, phone, role, street, city, postal_code, country, is_active, created_at, avatar_url, gender, DATE_FORMAT(birthday, '%Y-%m-%d') AS birthday
       FROM users WHERE id = ?`,
      [req.user.id]
    );
    if (!rows.length || !rows[0].is_active)
      return res.status(404).json({ message: 'User not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
};

// PUT /api/auth/me  { name, phone, street, city, postal_code, country }
exports.updateProfile = async (req, res, next) => {
  try {
    const allowed = ['name', 'phone', 'street', 'city', 'postal_code', 'country', 'birthday', 'gender'];
    const keys = allowed.filter((k) => req.body[k] !== undefined);
    if (!keys.length) return res.status(400).json({ message: 'Nothing to update' });
    if (req.body.name !== undefined && !String(req.body.name).trim())
      return res.status(400).json({ message: 'Name cannot be empty' });
    const long = tooLong(Object.fromEntries(keys.map((k) => [k, req.body[k]])));
    if (long) return res.status(400).json({ message: `${long.replace('_', ' ')} is too long` });

    const body = { ...req.body };
    if (body.gender !== undefined) {
      const g = String(body.gender || '').trim().toLowerCase();
      if (g && !['male', 'female', 'other'].includes(g)) return res.status(400).json({ message: 'Invalid gender' });
      body.gender = g || null;
    }
    if (body.birthday !== undefined) {
      const b = String(body.birthday || '').trim();
      if (b) {
        const d = new Date(b);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(b) || Number.isNaN(d.getTime())) return res.status(400).json({ message: 'Birthday must be a valid date' });
        if (d > new Date() || d.getUTCFullYear() < 1900) return res.status(400).json({ message: 'Birthday is not a realistic date' });
      }
      body.birthday = b || null;
    }

    const values = keys.map((k) => (typeof body[k] === 'string' ? body[k].trim() || null : body[k]));
    await pool.execute(`UPDATE users SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, [...values, req.user.id]);
    const [rows] = await pool.execute(
      `SELECT id, name, email, phone, role, street, city, postal_code, country, is_active, created_at, avatar_url, gender, DATE_FORMAT(birthday, '%Y-%m-%d') AS birthday FROM users WHERE id = ?`,
      [req.user.id]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
};

// PUT /api/auth/password  { current_password, new_password }
exports.changePassword = async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    if (typeof current_password !== 'string' || !current_password || !new_password)
      return res.status(400).json({ message: 'Current and new password are required' });
    const pwProblem = passwordProblem(new_password);
    if (pwProblem) return res.status(400).json({ message: pwProblem });

    const [rows] = await pool.execute('SELECT password FROM users WHERE id = ?', [req.user.id]);
    if (!rows.length || !(await bcrypt.compare(current_password, rows[0].password)))
      return res.status(401).json({ message: 'Current password is incorrect' });

    await pool.execute('UPDATE users SET password = ?, token_version = token_version + 1 WHERE id = ?', [await bcrypt.hash(new_password, 10), req.user.id]);
    const [[fresh]] = await pool.execute('SELECT id, role, token_version FROM users WHERE id = ?', [req.user.id]);
    res.json({ message: 'Password changed. Your other devices were signed out.', token: signToken(fresh) });
  } catch (err) { next(err); }
};

exports.signToken = signToken;
