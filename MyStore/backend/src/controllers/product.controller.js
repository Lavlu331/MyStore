const pool = require('../config/db');

const SORTS = {
  newest: 'p.created_at DESC',
  price_asc: 'final_price ASC',
  price_desc: 'final_price DESC',
  name_asc: 'p.name ASC',
  stock_desc: 'total_stock DESC',
  rating_desc: 'rating_avg DESC, rating_count DESC',
  sold_desc: 'sold DESC',
};

// PUBLIC: GET /api/products?search=&category=&minPrice=&maxPrice=&inStock=true&sort=&page=&limit=
exports.list = async (req, res, next) => {
  try {
    const { search, category, minPrice, maxPrice, inStock, sort, minRating } = req.query;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 12, 1), 50);

    const where = ['p.is_active = 1'];
    const params = [];
    if (search) { where.push('(p.name LIKE ? OR p.description LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
    if (category) { where.push('p.category_id = ?'); params.push(parseInt(category)); }
    if (minPrice) { where.push('fn_effective_price(p.id) >= ?'); params.push(Number(minPrice)); }
    if (maxPrice) { where.push('fn_effective_price(p.id) <= ?'); params.push(Number(maxPrice)); }
    if (inStock === 'true') where.push('fn_get_total_stock(p.id) > 0');
    if (Number(minRating) > 0) { where.push('(SELECT AVG(rv.rating) FROM reviews rv WHERE rv.product_id = p.id) >= ?'); params.push(Number(minRating)); }
    const whereSql = where.join(' AND ');
    const orderSql = SORTS[sort] || SORTS.newest;

    // pool.query (not execute) because LIMIT/OFFSET placeholders are fussy with prepared statements
    const [rows] = await pool.query(
      `SELECT p.id, p.name, p.description, p.price, p.discount_price,
              fn_effective_price(p.id) AS final_price,
              fn_flash_seconds_left(p.id) AS flash_seconds_left,
              p.category_id, c.name AS category_name,
              (SELECT image_url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.id LIMIT 1) AS image,
              fn_get_total_stock(p.id) AS total_stock,
    (SELECT ROUND(AVG(rv.rating), 1) FROM reviews rv WHERE rv.product_id = p.id) AS rating_avg,
    (SELECT COUNT(*) FROM reviews rv WHERE rv.product_id = p.id) AS rating_count,
    (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi JOIN orders o ON o.id = oi.order_id
     WHERE oi.product_id = p.id AND o.status NOT IN ('cancelled', 'returned')) AS sold
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE ${whereSql}
       ORDER BY ${orderSql}
       LIMIT ? OFFSET ?`,
      [...params, limit, (page - 1) * limit]
    );
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM products p WHERE ${whereSql}`, params);

    res.json({ page, limit, total, totalPages: Math.ceil(total / limit), products: rows });
  } catch (err) { next(err); }
};

// PUBLIC: single product with all images
exports.getOne = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.id, p.name, p.description, p.price, p.discount_price,
              fn_effective_price(p.id) AS final_price,
              fn_flash_seconds_left(p.id) AS flash_seconds_left,
              p.category_id, c.name AS category_name,
              fn_get_total_stock(p.id) AS total_stock,
    (SELECT ROUND(AVG(rv.rating), 1) FROM reviews rv WHERE rv.product_id = p.id) AS rating_avg,
    (SELECT COUNT(*) FROM reviews rv WHERE rv.product_id = p.id) AS rating_count,
    (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi JOIN orders o ON o.id = oi.order_id
     WHERE oi.product_id = p.id AND o.status NOT IN ('cancelled', 'returned')) AS sold
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.id = ? AND p.is_active = 1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Product not found' });
    const [images] = await pool.execute(
      'SELECT id, image_url FROM product_images WHERE product_id = ? ORDER BY id', [req.params.id]
    );
    res.json({ ...rows[0], images });
  } catch (err) { next(err); }
};

const validPrices = (price, discount) => {
  if (price !== undefined && (isNaN(price) || Number(price) < 0)) return 'Price must be a positive number';
  if (discount !== undefined && discount !== null && (isNaN(discount) || Number(discount) < 0))
    return 'Discount price must be a positive number';
  if (price !== undefined && discount != null && Number(discount) >= Number(price))
    return 'Discount price must be lower than price';
  return null;
};

const handleFk = (err, res, next) => {
  if (err.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ message: 'Invalid category_id' });
  next(err);
};

// ADMIN: create product (+ optional images: ["url1","url2"])
// Stock is NOT set here; it is managed through the inventory module (warehouse_inventory).
exports.create = async (req, res, next) => {
  const { name, description, price, discount_price, category_id, images } = req.body;
  if (!name || price === undefined) return res.status(400).json({ message: 'Name and price are required' });
  const priceError = validPrices(price, discount_price);
  if (priceError) return res.status(400).json({ message: priceError });

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [r] = await conn.execute(
      'INSERT INTO products (name, description, price, discount_price, category_id) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), description || null, price, discount_price ?? null, category_id || null]
    );
    if (Array.isArray(images) && images.length) {
      await conn.query('INSERT INTO product_images (product_id, image_url) VALUES ?', [
        images.map((url) => [r.insertId, url]),
      ]);
    }
    await conn.commit();
    res.status(201).json({ id: r.insertId, message: 'Product created' });
  } catch (err) {
    if (conn) await conn.rollback().catch(() => conn.destroy());
    handleFk(err, res, next);
  } finally { conn?.release(); }
};

// ADMIN: update any of the allowed fields; if "images" is sent, it replaces the image list
exports.update = async (req, res, next) => {
  const allowed = ['name', 'description', 'price', 'discount_price', 'category_id', 'is_active'];
  const keys = allowed.filter((k) => req.body[k] !== undefined);
  const { images } = req.body;
  if (!keys.length && !Array.isArray(images)) return res.status(400).json({ message: 'Nothing to update' });

  const priceError = validPrices(req.body.price, req.body.discount_price);
  if (priceError) return res.status(400).json({ message: priceError });

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [exists] = await conn.execute('SELECT id, price, discount_price FROM products WHERE id = ?', [req.params.id]);
    if (!exists.length) { await conn.rollback(); return res.status(404).json({ message: 'Product not found' }); }

    // Re-check the price/discount rule against the stored values when only one of them is sent
    const newPrice = req.body.price ?? exists[0].price;
    const newDiscount = req.body.discount_price !== undefined ? req.body.discount_price : exists[0].discount_price;
    if (newDiscount != null && Number(newDiscount) >= Number(newPrice)) {
      await conn.rollback();
      return res.status(400).json({ message: 'Discount price must be lower than price' });
    }

    if (keys.length) {
      await conn.execute(
        `UPDATE products SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`,
        [...keys.map((k) => req.body[k]), req.params.id]
      );
    }
    if (Array.isArray(images)) {
      await conn.execute('DELETE FROM product_images WHERE product_id = ?', [req.params.id]);
      if (images.length) {
        await conn.query('INSERT INTO product_images (product_id, image_url) VALUES ?', [
          images.map((url) => [req.params.id, url]),
        ]);
      }
    }
    await conn.commit();
    res.json({ message: 'Product updated' });
  } catch (err) {
    if (conn) await conn.rollback().catch(() => conn.destroy());
    handleFk(err, res, next);
  } finally { conn?.release(); }
};

// ADMIN: soft delete (old orders still reference the product)
exports.remove = async (req, res, next) => {
  try {
    const [r] = await pool.execute('UPDATE products SET is_active = 0 WHERE id = ?', [req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ message: 'Product not found' });
    res.json({ message: 'Product deactivated' });
  } catch (err) { next(err); }
};

// ADMIN: list ALL products (including inactive). GET /api/products/manage/all?search=&page=&limit=
exports.adminList = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    const where = ['1=1']; const params = [];
    const search = String(req.query.search || '').trim().slice(0, 200);
    if (/^#?[1-9]\d{0,9}$/.test(search)) {
      where.push('(p.id = ? OR p.name LIKE ?)');
      params.push(Number(search.replace(/^#/, '')), `%${search}%`);
    } else if (search) {
      where.push('p.name LIKE ?');
      params.push(`%${search}%`);
    }
    if (req.query.active === 'true') where.push('p.is_active = 1');
    if (/^\d+$/.test(req.query.category || '')) { where.push('p.category_id = ?'); params.push(req.query.category); }
    if (req.query.inactive === 'true') where.push('p.is_active = 0');
    if (req.query.out_of_stock === 'true') where.push('COALESCE(fn_get_total_stock(p.id), 0) <= 0');
    if (req.query.no_photo === 'true') where.push('NOT EXISTS (SELECT 1 FROM product_images pi WHERE pi.product_id = p.id AND pi.image_url <> \'\')');
    const whereSql = where.join(' AND ');
    const [rows] = await pool.query(
      `SELECT p.id, p.name, p.price, p.discount_price, p.category_id, c.name AS category_name,
              p.is_active, fn_get_total_stock(p.id) AS total_stock,
              (SELECT image_url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.id LIMIT 1) AS image,
    (SELECT ROUND(AVG(rv.rating), 1) FROM reviews rv WHERE rv.product_id = p.id) AS rating_avg,
    (SELECT COUNT(*) FROM reviews rv WHERE rv.product_id = p.id) AS rating_count,
    (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi JOIN orders o ON o.id = oi.order_id
     WHERE oi.product_id = p.id AND o.status NOT IN ('cancelled', 'returned')) AS sold
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
       WHERE ${whereSql} ORDER BY p.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, (page - 1) * limit]
    );
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM products p WHERE ${whereSql}`, params);
    res.json({ page, limit, total, totalPages: Math.ceil(total / limit), products: rows });
  } catch (err) { next(err); }
};

// ADMIN: one product for the edit form (inactive allowed)
exports.adminGetOne = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, name, description, price, discount_price, category_id, is_active FROM products WHERE id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Product not found' });
    const [images] = await pool.execute(
      'SELECT id, image_url FROM product_images WHERE product_id = ? ORDER BY id', [req.params.id]);
    res.json({ ...rows[0], images });
  } catch (err) { next(err); }
};

// ---------- Storefront helpers ----------
const CARD_SQL = `SELECT p.id, p.name, p.price, p.discount_price,
    fn_effective_price(p.id) AS final_price,
              fn_flash_seconds_left(p.id) AS flash_seconds_left,
    p.category_id, c.name AS category_name,
    (SELECT image_url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.id LIMIT 1) AS image,
    fn_get_total_stock(p.id) AS total_stock,
    (SELECT ROUND(AVG(rv.rating), 1) FROM reviews rv WHERE rv.product_id = p.id) AS rating_avg,
    (SELECT COUNT(*) FROM reviews rv WHERE rv.product_id = p.id) AS rating_count,
    (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi JOIN orders o ON o.id = oi.order_id
     WHERE oi.product_id = p.id AND o.status NOT IN ('cancelled', 'returned')) AS sold
  FROM products p LEFT JOIN categories c ON c.id = p.category_id`;

// PUBLIC: GET /api/products/featured  -> home page sections
exports.featured = async (req, res, next) => {
  try {
    const [newArrivals] = await pool.query(
      `${CARD_SQL} WHERE p.is_active = 1 ORDER BY p.created_at DESC, p.id DESC LIMIT 8`);
    const [onSale] = await pool.query(
      `${CARD_SQL} WHERE p.is_active = 1 AND p.price > 0 AND fn_effective_price(p.id) < p.price
       ORDER BY (p.price - fn_effective_price(p.id)) / p.price DESC LIMIT 8`);
    const [bestSellers] = await pool.query(
      `${CARD_SQL}
       JOIN (SELECT oi.product_id, SUM(oi.quantity) AS sold
             FROM order_items oi JOIN orders o ON o.id = oi.order_id
             WHERE o.status NOT IN ('cancelled', 'returned') AND oi.product_id IS NOT NULL
             GROUP BY oi.product_id) s ON s.product_id = p.id
       WHERE p.is_active = 1 ORDER BY s.sold DESC LIMIT 8`);
    res.json({ newArrivals, onSale, bestSellers });
  } catch (err) { next(err); }
};

// PUBLIC: GET /api/products/suggest?q=  -> search-as-you-type
exports.suggest = async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json([]);
    const [rows] = await pool.query(
      `SELECT p.id, p.name, fn_effective_price(p.id) AS final_price,
              fn_flash_seconds_left(p.id) AS flash_seconds_left,
              (SELECT image_url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.id LIMIT 1) AS image
       FROM products p WHERE p.is_active = 1 AND p.name LIKE ?
       ORDER BY (p.name LIKE ?) DESC, p.name LIMIT 6`,
      [`%${q}%`, `${q}%`]);
    res.json(rows);
  } catch (err) { next(err); }
};

// PUBLIC: GET /api/products/:id/related  -> same category
exports.related = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [[prod]] = await pool.query('SELECT category_id FROM products WHERE id = ?', [id]);
    if (!prod) return res.status(404).json({ message: 'Product not found' });
    if (!prod.category_id) return res.json([]);
    const [rows] = await pool.query(
      `${CARD_SQL} WHERE p.is_active = 1 AND p.id <> ? AND p.category_id = ?
       ORDER BY p.created_at DESC LIMIT 4`, [id, prod.category_id]);
    res.json(rows);
  } catch (err) { next(err); }
};

// PUBLIC: GET /api/products/by-ids?ids=3,7,9  -> product cards in that order (recently viewed)
exports.byIds = async (req, res, next) => {
  try {
    const ids = String(req.query.ids || '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 12);
    if (!ids.length) return res.json([]);
    const [rows] = await pool.query(`${CARD_SQL} WHERE p.is_active = 1 AND p.id IN (?)`, [ids]);
    rows.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    res.json(rows);
  } catch (err) { next(err); }
};

// shared with the flash sale controller
module.exports.CARD_SQL = CARD_SQL;
