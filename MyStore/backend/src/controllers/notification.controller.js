const pool = require('../config/db');

// Every user sees only their own notifications
exports.list = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 30, 1), 100);
    const unreadOnly = req.query.unread === 'true' ? 'AND is_read = 0' : '';
    const [rows] = await pool.query(
      `SELECT id, title, message, notification_type, product_id, warehouse_id, is_read, created_at
       FROM notifications WHERE user_id = ? ${unreadOnly}
       ORDER BY created_at DESC, id DESC LIMIT ?`,
      [req.user.id, limit]
    );
    res.json(rows.map((n) => ({ ...n, is_read: !!n.is_read })));
  } catch (err) { next(err); }
};

exports.unreadCount = async (req, res, next) => {
  try {
    const [[{ count }]] = await pool.execute(
      'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0', [req.user.id]);
    res.json({ unread: count });
  } catch (err) { next(err); }
};

exports.markRead = async (req, res, next) => {
  try {
    const [r] = await pool.execute(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!r.affectedRows) return res.status(404).json({ message: 'Notification not found' });
    res.json({ message: 'Marked as read' });
  } catch (err) { next(err); }
};

exports.markAllRead = async (req, res, next) => {
  try {
    await pool.execute('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [req.user.id]);
    res.json({ message: 'All notifications marked as read' });
  } catch (err) { next(err); }
};
