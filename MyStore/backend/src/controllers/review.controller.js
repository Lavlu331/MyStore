const pool = require('../config/db');

const int = (v) => { const n = Number(v); return Number.isInteger(n) ? n : NaN; };

// "Rahim Uddin" -> "Rahim U."  (we never show full names or emails publicly)
const shortName = (name) => {
  const parts = String(name || 'Customer').trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
};

// PUBLIC: GET /api/reviews/product/:productId?page=&limit=   -> rating summary + reviews
exports.listForProduct = async (req, res, next) => {
  try {
    const productId = int(req.params.productId);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50);

    const [[s]] = await pool.query(
      `SELECT COUNT(*) AS count, ROUND(AVG(rating), 1) AS average,
              COALESCE(SUM(rating = 1), 0) AS r1, COALESCE(SUM(rating = 2), 0) AS r2,
              COALESCE(SUM(rating = 3), 0) AS r3, COALESCE(SUM(rating = 4), 0) AS r4,
              COALESCE(SUM(rating = 5), 0) AS r5
       FROM reviews WHERE product_id = ?`, [productId]);
    const [rows] = await pool.query(
      `SELECT r.id, r.rating, r.comment, r.created_at, r.updated_at, u.name
       FROM reviews r JOIN users u ON u.id = r.user_id
       WHERE r.product_id = ? ORDER BY r.created_at DESC, r.id DESC LIMIT ? OFFSET ?`,
      [productId, limit, (page - 1) * limit]);

    res.json({
      summary: {
        count: Number(s.count), average: s.average === null ? null : Number(s.average),
        distribution: { 1: Number(s.r1), 2: Number(s.r2), 3: Number(s.r3), 4: Number(s.r4), 5: Number(s.r5) },
      },
      page, limit, totalPages: Math.ceil(Number(s.count) / limit),
      reviews: rows.map((r) => ({ id: r.id, rating: r.rating, comment: r.comment, created_at: r.created_at, reviewer: shortName(r.name) })),
    });
  } catch (err) { next(err); }
};

// Only customers who RECEIVED the product (delivered order) may review it
const hasReceived = async (userId, productId) => {
  const [rows] = await pool.execute(
    `SELECT 1 FROM orders o JOIN order_items oi ON oi.order_id = o.id
     WHERE o.user_id = ? AND o.status = 'delivered' AND oi.product_id = ? LIMIT 1`, [userId, productId]);
  return rows.length > 0;
};

// AUTH: GET /api/reviews/status/:productId  -> can this user review, and what did they write?
exports.status = async (req, res, next) => {
  try {
    const productId = int(req.params.productId);
    const [mine] = await pool.execute(
      'SELECT id, rating, comment FROM reviews WHERE user_id = ? AND product_id = ?', [req.user.id, productId]);
    res.json({ can_review: await hasReceived(req.user.id, productId), my_review: mine[0] || null });
  } catch (err) { next(err); }
};

// AUTH: POST /api/reviews/product/:productId  { rating: 1-5, comment }   (creates or updates your review)
exports.save = async (req, res, next) => {
  try {
    const productId = int(req.params.productId);
    const rating = int(req.body.rating);
    const comment = String(req.body.comment || '').trim().slice(0, 1000) || null;
    if (!(rating >= 1 && rating <= 5)) return res.status(400).json({ message: 'Rating must be between 1 and 5' });

    const [p] = await pool.execute('SELECT id FROM products WHERE id = ?', [productId]);
    if (!p.length) return res.status(404).json({ message: 'Product not found' });
    if (!(await hasReceived(req.user.id, productId)))
      return res.status(403).json({ message: 'You can review a product after your order with it has been delivered' });

    await pool.execute(
      `INSERT INTO reviews (user_id, product_id, rating, comment) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment)`,
      [req.user.id, productId, rating, comment]);
    res.status(201).json({ message: 'Review saved' });
  } catch (err) { next(err); }
};

// AUTH: DELETE /api/reviews/:id   (your own review; admins can remove any)
exports.remove = async (req, res, next) => {
  try {
    const [r] = req.user.role === 'admin'
      ? await pool.execute('DELETE FROM reviews WHERE id = ?', [req.params.id])
      : await pool.execute('DELETE FROM reviews WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!r.affectedRows) return res.status(404).json({ message: 'Review not found' });
    res.json({ message: 'Review deleted' });
  } catch (err) { next(err); }
};

// AUTH: GET /api/reviews/mine -> products waiting for a review (delivered, not reviewed yet) and the customer's own reviews
exports.mine = async (req, res, next) => {
  try {
    const [toReview] = await pool.execute(
      `SELECT oi.product_id, MAX(oi.product_name) AS name, MAX(o.id) AS order_id, MAX(o.updated_at) AS delivered_at,
              (SELECT image_url FROM product_images pi WHERE pi.product_id = oi.product_id ORDER BY pi.id LIMIT 1) AS image
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE o.user_id = ? AND o.status = 'delivered' AND oi.product_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.user_id = o.user_id AND r.product_id = oi.product_id)
       GROUP BY oi.product_id ORDER BY order_id DESC`, [req.user.id]);
    const [reviews] = await pool.execute(
      `SELECT r.id, r.product_id, p.name, r.rating, r.comment, r.created_at,
              (SELECT image_url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.id LIMIT 1) AS image
       FROM reviews r JOIN products p ON p.id = r.product_id
       WHERE r.user_id = ? ORDER BY r.created_at DESC, r.id DESC`, [req.user.id]);
    res.json({ toReview, reviews });
  } catch (err) { next(err); }
};
