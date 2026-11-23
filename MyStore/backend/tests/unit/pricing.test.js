const test = require('node:test');
const assert = require('node:assert/strict');
const { calculate, formatTotals, toCents, fromCents } = require('../../src/utils/pricing');

const baseCoupon = {
  id: 1, code: 'SAVE10', is_active: 1, started: 1, not_expired: 1, usage_limit: null, used_count: 0,
  min_order_amount: '0', per_user_limit: 1, max_discount: null, discount_type: 'percent', discount_value: '10',
};

// A fake database: answers only the three kinds of queries the pricing code makes
const fakeDb = ({ coupon = null, settings = {}, usedByUser = 0 } = {}) => ({
  execute: async (sql) => {
    if (sql.includes('FROM coupons')) return [coupon ? [coupon] : []];
    if (sql.includes('coupon_redemptions')) return [[{ n: usedByUser }]];
    if (sql.includes('FROM settings')) return [Object.entries(settings).map(([k, v]) => ({ setting_key: k, setting_value: String(v) }))];
    throw new Error(`unexpected query: ${sql}`);
  },
});
const price = (opts, subtotalCents, code = 'SAVE10') =>
  calculate({ db: fakeDb(opts), userId: 1, subtotalCents, couponCode: code });

test('money helpers avoid decimal errors', () => {
  assert.equal(toCents('19.99'), 1999);
  assert.equal(toCents(0.1 + 0.2), 30);
  assert.equal(fromCents(1999), '19.99');
});

test('percent coupon plus delivery charge', async () => {
  const r = await price({ coupon: baseCoupon, settings: { delivery_charge: 60, free_delivery_threshold: 1000 } }, 50000);
  assert.equal(r.discountCents, 5000);
  assert.equal(r.totalCents, 45000 + 6000);
});

test('no coupon, no settings: total equals subtotal', async () => {
  const r = await price({}, 12345, '');
  assert.equal(r.totalCents, 12345);
  assert.equal(r.deliveryCents, 0);
  assert.equal(r.coupon, null);
});

test('free delivery applies on the amount AFTER the discount', async () => {
  const settings = { delivery_charge: 60, free_delivery_threshold: 1000 };
  assert.equal((await price({ settings }, 100000, '')).deliveryCents, 0);          // exactly at the threshold
  assert.equal((await price({ settings }, 99999, '')).deliveryCents, 6000);        // one cent below
  const r = await price({ coupon: baseCoupon, settings }, 105000);                 // 1050 - 10% = 945 < 1000
  assert.equal(r.deliveryCents, 6000);
});

test('percent discount is rounded down and can be capped', async () => {
  assert.equal((await price({ coupon: baseCoupon }, 333)).discountCents, 33);
  assert.equal((await price({ coupon: { ...baseCoupon, max_discount: '30' } }, 50000)).discountCents, 3000);
});

test('a fixed discount never exceeds the subtotal', async () => {
  const r = await price({ coupon: { ...baseCoupon, discount_type: 'fixed', discount_value: '200' } }, 15000);
  assert.equal(r.discountCents, 15000);
  assert.equal(r.totalCents, 0);
});

test('an empty cart has no delivery charge', async () => {
  const r = await price({ settings: { delivery_charge: 60 } }, 0, '');
  assert.equal(r.totalCents, 0);
});

test('coupon codes are case-insensitive', async () => {
  const r = await calculate({ db: fakeDb({ coupon: baseCoupon }), userId: 1, subtotalCents: 10000, couponCode: '  save10 ' });
  assert.equal(r.coupon.code, 'SAVE10');
});

test('invalid coupons are rejected with a clear message', async () => {
  const cases = [
    ['unknown code', {}, /not valid/],
    ['inactive', { coupon: { ...baseCoupon, is_active: 0 } }, /not valid/],
    ['not started', { coupon: { ...baseCoupon, started: 0 } }, /not active yet/],
    ['expired', { coupon: { ...baseCoupon, not_expired: 0 } }, /expired/],
    ['fully used', { coupon: { ...baseCoupon, usage_limit: 5, used_count: 5 } }, /fully used/],
    ['below minimum order', { coupon: { ...baseCoupon, min_order_amount: '1000' } }, /Minimum order/],
    ['already used by this customer', { coupon: baseCoupon, usedByUser: 1 }, /already used/],
  ];
  for (const [label, opts, pattern] of cases) {
    await assert.rejects(() => price(opts, 50000), (err) => {
      assert.equal(err.status, 400, label);
      assert.match(err.message, pattern, label);
      return true;
    });
  }
});

test('formatTotals returns money strings for the API', async () => {
  const r = await price({ coupon: baseCoupon, settings: { delivery_charge: 60 } }, 20000);
  assert.deepEqual(formatTotals(r), {
    subtotal: '200.00', discount: '20.00', delivery: '60.00', total: '240.00', coupon_code: 'SAVE10', free_delivery_threshold: 0,
  });
});
