const pool = require('../config/db');
const { calculate, cartSubtotalCents, formatTotals } = require('../utils/pricing');

// One cart per user (carts.user_id is UNIQUE). Create it on first use.
async function getCartId(userId) {
  await pool.execute('INSERT IGNORE INTO carts (user_id) VALUES (?)', [userId]);
  const [rows] = await pool.execute('SELECT id FROM carts WHERE user_id = ?', [userId]);
  return rows[0].id;
}

const stockOf = async (productId, db = pool) => {
  const [[row]] = await db.execute('SELECT fn_get_total_stock(?) AS stock', [productId]);
  return Number(row.stock);
};

const parseQty = (v) => {
  const n = Number(v);
  return Number.isInteger(n) ? n : NaN;
};

exports.get = async (req, res, next) => {
  try {
    const cartId = await getCartId(req.user.id);
    const [items] = await pool.execute(
      `SELECT ci.product_id, ci.quantity, p.name, p.price, p.discount_price,
              fn_effective_price(p.id) AS unit_price,
              p.is_active, fn_get_total_stock(p.id) AS available_stock,
              (SELECT image_url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.id LIMIT 1) AS image
       FROM cart_items ci JOIN products p ON p.id = ci.product_id
       WHERE ci.cart_id = ? ORDER BY ci.id`,
      [cartId]
    );
    let cents = 0;
    const lines = items.map((i) => {
      const line = Math.round(Number(i.unit_price) * 100) * i.quantity;
      cents += line;
      return { ...i, line_total: (line / 100).toFixed(2) };
    });
    res.json({ items: lines, total: (cents / 100).toFixed(2) });
  } catch (err) { next(err); }
};

// POST { product_id, quantity }  (adds to the existing quantity)
exports.addItem = async (req, res, next) => {
  let conn;
  try {
    const productId = parseQty(req.body.product_id);
    const qty = parseQty(req.body.quantity ?? 1);
    if (!(productId > 0) || !(qty > 0)) return res.status(400).json({ message: 'Valid product_id and quantity are required' });

    const [p] = await pool.execute('SELECT id FROM products WHERE id = ? AND is_active = 1', [productId]);
    if (!p.length) return res.status(404).json({ message: 'Product not found' });

    const cartId = await getCartId(req.user.id);
    conn = await pool.getConnection();
    await conn.beginTransaction();
    // Serialize additions and checkout on the same cart before reading its quantities.
    await conn.execute('SELECT id FROM carts WHERE user_id = ? FOR UPDATE', [req.user.id]);
    const [existing] = await conn.execute(
      'SELECT quantity FROM cart_items WHERE cart_id = ? AND product_id = ?', [cartId, productId]);
    const newQty = (existing[0]?.quantity || 0) + qty;
    const stock = await stockOf(productId, conn);
    if (newQty > stock) {
      await conn.rollback();
      return res.status(409).json({ message: `Only ${stock} in stock` });
    }

    await conn.execute(
      `INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)`,
      [cartId, productId, newQty]
    );
    await conn.commit();
    res.status(201).json({ message: 'Added to cart', quantity: newQty });
  } catch (err) {
    if (conn) await conn.rollback().catch(() => conn.destroy());
    next(err);
  } finally {
    conn?.release();
  }
};

// PUT { quantity }  (sets the quantity; 0 removes the item)
exports.updateItem = async (req, res, next) => {
  try {
    const productId = parseQty(req.params.productId);
    const qty = parseQty(req.body.quantity);
    if (!(productId > 0) || !(qty >= 0)) return res.status(400).json({ message: 'Valid quantity is required' });

    const cartId = await getCartId(req.user.id);
    if (qty === 0) {
      await pool.execute('DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?', [cartId, productId]);
      return res.json({ message: 'Item removed' });
    }
    const stock = await stockOf(productId);
    if (qty > stock) return res.status(409).json({ message: `Only ${stock} in stock` });

    const [r] = await pool.execute(
      'UPDATE cart_items SET quantity = ? WHERE cart_id = ? AND product_id = ?', [qty, cartId, productId]);
    if (!r.affectedRows) return res.status(404).json({ message: 'Item not in cart' });
    res.json({ message: 'Quantity updated', quantity: qty });
  } catch (err) { next(err); }
};

exports.removeItem = async (req, res, next) => {
  try {
    const cartId = await getCartId(req.user.id);
    const [r] = await pool.execute(
      'DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?', [cartId, req.params.productId]);
    if (!r.affectedRows) return res.status(404).json({ message: 'Item not in cart' });
    res.json({ message: 'Item removed' });
  } catch (err) { next(err); }
};

exports.clear = async (req, res, next) => {
  try {
    const cartId = await getCartId(req.user.id);
    await pool.execute('DELETE FROM cart_items WHERE cart_id = ?', [cartId]);
    res.json({ message: 'Cart cleared' });
  } catch (err) { next(err); }
};

// POST /api/cart/quote  { coupon_code? }  -> subtotal, discount, delivery charge and total
exports.quote = async (req, res, next) => {
  try {
    const subtotalCents = await cartSubtotalCents(pool, req.user.id);
    const r = await calculate({ db: pool, userId: req.user.id, subtotalCents, couponCode: req.body.coupon_code });
    res.json(formatTotals(r));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    next(err);
  }
};
