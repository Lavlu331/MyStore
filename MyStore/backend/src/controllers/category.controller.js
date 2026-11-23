const pool = require('../config/db');

// PUBLIC: list active categories
exports.list = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, description, image FROM categories WHERE is_active = 1 ORDER BY name'
    );
    res.json(rows);
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, description, image FROM categories WHERE id = ? AND is_active = 1',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Category not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
};

// ADMIN
exports.create = async (req, res, next) => {
  try {
    const { name, description, image } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'Category name is required' });
    const [r] = await pool.execute(
      'INSERT INTO categories (name, description, image) VALUES (?, ?, ?)',
      [name.trim(), description || null, image || null]
    );
    res.status(201).json({ id: r.insertId, name: name.trim(), description: description || null, image: image || null });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Category name already exists' });
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const allowed = ['name', 'description', 'image', 'is_active'];
    const keys = allowed.filter((k) => req.body[k] !== undefined);
    if (!keys.length) return res.status(400).json({ message: 'Nothing to update' });

    const sql = `UPDATE categories SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`;
    const [r] = await pool.execute(sql, [...keys.map((k) => req.body[k]), req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ message: 'Category not found' });
    res.json({ message: 'Category updated' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Category name already exists' });
    next(err);
  }
};

// Soft delete (keeps products that reference this category intact)
exports.remove = async (req, res, next) => {
  try {
    const [r] = await pool.execute('UPDATE categories SET is_active = 0 WHERE id = ?', [req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ message: 'Category not found' });
    res.json({ message: 'Category deactivated' });
  } catch (err) { next(err); }
};

// ADMIN: all categories including inactive
exports.adminList = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, description, image, is_active FROM categories ORDER BY name');
    res.json(rows);
  } catch (err) { next(err); }
};
