const pool = require('../config/db');

exports.list = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT p.id, p.name, p.price, p.discount_price,
              fn_effective_price(p.id) AS final_price,
              fn_flash_seconds_left(p.id) AS flash_seconds_left,
              p.category_id, c.name AS category_name,
              (SELECT image_url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.id LIMIT 1) AS image,
              fn_get_total_stock(p.id) AS total_stock,
    (SELECT ROUND(AVG(rv.rating), 1) FROM reviews rv WHERE rv.product_id = p.id) AS rating_avg,
    (SELECT COUNT(*) FROM reviews rv WHERE rv.product_id = p.id) AS rating_count,
    (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi JOIN orders o ON o.id = oi.order_id
     WHERE oi.product_id = p.id AND o.status NOT IN ('cancelled', 'returned')) AS sold
       FROM wishlist_items w
       JOIN products p ON p.id = w.product_id AND p.is_active = 1
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE w.user_id = ? ORDER BY w.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
};

exports.add = async (req, res, next) => {
  try {
    const productId = Number(req.body.product_id);
    if (!Number.isInteger(productId) || productId <= 0) return res.status(400).json({ message: 'product_id is required' });
    const [p] = await pool.execute('SELECT id FROM products WHERE id = ? AND is_active = 1', [productId]);
    if (!p.length) return res.status(404).json({ message: 'Product not found' });
    await pool.execute('INSERT IGNORE INTO wishlist_items (user_id, product_id) VALUES (?, ?)', [req.user.id, productId]);
    res.status(201).json({ message: 'Added to wishlist' });
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    await pool.execute('DELETE FROM wishlist_items WHERE user_id = ? AND product_id = ?', [req.user.id, req.params.productId]);
    res.json({ message: 'Removed from wishlist' });
  } catch (err) { next(err); }
};
