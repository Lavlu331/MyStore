// One place for price maths, used by the cart quote AND by checkout (so they always agree).
// All calculations are done in integer cents to avoid decimal rounding errors.
const toCents = (v) => Math.round(Number(v) * 100);
const fromCents = (c) => (c / 100).toFixed(2);

class PricingError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function getSettings(db) {
  const [rows] = await db.execute(
    "SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('delivery_charge', 'free_delivery_threshold')");
  const m = Object.fromEntries(rows.map((r) => [r.setting_key, Number(r.setting_value) || 0]));
  return { delivery_charge: m.delivery_charge || 0, free_delivery_threshold: m.free_delivery_threshold || 0 };
}

async function cartSubtotalCents(db, userId) {
  const [rows] = await db.execute(
    `SELECT ci.quantity, fn_effective_price(p.id) AS unit_price
     FROM carts c JOIN cart_items ci ON ci.cart_id = c.id JOIN products p ON p.id = ci.product_id
     WHERE c.user_id = ? AND p.is_active = 1`, [userId]);
  return rows.reduce((sum, r) => sum + toCents(r.unit_price) * r.quantity, 0);
}

// db = pool or a transaction connection. lockCoupon = true inside checkout (FOR UPDATE).
async function calculate({ db, userId, subtotalCents, couponCode, lockCoupon = false }) {
  let discountCents = 0;
  let coupon = null;
  const code = String(couponCode || '').trim().toUpperCase();

  if (code) {
    const [rows] = await db.execute(
      `SELECT *, (starts_at IS NULL OR starts_at <= NOW()) AS started,
                 (expires_at IS NULL OR expires_at > NOW()) AS not_expired
       FROM coupons WHERE code = ? ${lockCoupon ? 'FOR UPDATE' : ''}`, [code]);
    const c = rows[0];
    if (!c || !c.is_active) throw new PricingError(400, 'This coupon code is not valid');
    if (!c.started) throw new PricingError(400, 'This coupon is not active yet');
    if (!c.not_expired) throw new PricingError(400, 'This coupon has expired');
    if (c.usage_limit !== null && c.used_count >= c.usage_limit) throw new PricingError(400, 'This coupon has been fully used');
    if (subtotalCents < toCents(c.min_order_amount))
      throw new PricingError(400, `Minimum order amount for this coupon is ${Number(c.min_order_amount).toFixed(2)}`);
    const [[{ n }]] = await db.execute(
      'SELECT COUNT(*) AS n FROM coupon_redemptions WHERE coupon_id = ? AND user_id = ?', [c.id, userId]);
    if (n >= c.per_user_limit) throw new PricingError(400, 'You have already used this coupon');

    if (c.discount_type === 'percent') {
      discountCents = Math.floor((subtotalCents * Number(c.discount_value)) / 100);
      if (c.max_discount !== null) discountCents = Math.min(discountCents, toCents(c.max_discount));
    } else {
      discountCents = toCents(c.discount_value);
    }
    discountCents = Math.min(discountCents, subtotalCents);
    coupon = { id: c.id, code: c.code };
  }

  const settings = await getSettings(db);
  const afterDiscount = subtotalCents - discountCents;
  const free = settings.free_delivery_threshold > 0 && afterDiscount >= toCents(settings.free_delivery_threshold);
  const deliveryCents = subtotalCents === 0 || free ? 0 : toCents(settings.delivery_charge);

  return { subtotalCents, discountCents, deliveryCents, totalCents: afterDiscount + deliveryCents, coupon, settings };
}

const formatTotals = (r) => ({
  subtotal: fromCents(r.subtotalCents), discount: fromCents(r.discountCents),
  delivery: fromCents(r.deliveryCents), total: fromCents(r.totalCents),
  coupon_code: r.coupon ? r.coupon.code : null,
  free_delivery_threshold: r.settings.free_delivery_threshold,
});

module.exports = { calculate, cartSubtotalCents, getSettings, formatTotals, fromCents, toCents, PricingError };
