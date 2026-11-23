// End-to-end tests. They talk to the RUNNING backend and use your real database.
//   1. start the backend  (npm run dev)
//   2. ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=yourpassword npm run test:e2e
// Tip: add RATE_LIMIT_DISABLED=true to the backend's .env while running them repeatedly.
// The tests create their own customers, category, product and coupon, then deactivate them at the end.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');

const BASE = process.env.API_URL || 'http://localhost:5001/api';
const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch { /* empty body */ }
  return { status: res.status, data };
}
const expect = (res, status) => assert.equal(res.status, status, `expected ${status}, got ${res.status}: ${JSON.stringify(res.data)}`);

const skip = ADMIN_EMAIL && ADMIN_PASSWORD ? false : 'Set ADMIN_EMAIL and ADMIN_PASSWORD to run the end-to-end tests';

describe('Shop end-to-end', { skip }, () => {
  const run = Date.now();
  const password = `Aa1!${randomBytes(12).toString('hex')}`;
  const shipping = { street: 'Test Road 1', city: 'Testville', phone: '01700000000' };
  const savedShipping = { ...shipping, street: 'Saved delivery road', phone: '01800000000' };
  const ctx = {};   // shared state between the steps below

  const register = async (label) => {
    const r = await call('POST', '/auth/register', { body: {
      name: `E2E ${label} ${run}`, email: `e2e_${label}_${run}@example.test`, password,
      phone: '01700000000', street: 'Test Road 1', city: 'Testville' } });
    expect(r, 201);
    return { token: r.data.token, id: r.data.user.id };
  };
  const stockOf = async () => {
    const r = await call('GET', `/inventory?search=${encodeURIComponent(ctx.productName)}&warehouse_id=${ctx.warehouseId}`, { token: ctx.admin });
    expect(r, 200);
    return r.data.items.find((i) => i.product_id === ctx.productId)?.quantity;
  };

  before(async () => {
    const r = await call('POST', '/auth/login', { body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
    expect(r, 200);
    ctx.admin = r.data.token;
    const w = await call('GET', '/inventory/warehouses', { token: ctx.admin });
    expect(w, 200);
    assert.ok(w.data.length > 0, 'the database needs at least one active warehouse');
    ctx.warehouseId = w.data[0].id;
  });

  it('health check is ok', async () => {
    const r = await call('GET', '/health');
    expect(r, 200);
    assert.equal(r.data.database, 'connected');
  });

  it('protected routes reject visitors without a token', async () => {
    expect(await call('GET', '/cart'), 401);
    expect(await call('GET', '/inventory'), 401);
    expect(await call('GET', '/users'), 401);
  });

  it('registers two customers and rejects bad input', async () => {
    ctx.a = await register('a');
    ctx.b = await register('b');
    expect(await call('POST', '/auth/register', { body: { name: 'X', email: 'not-an-email', password } }), 400);
    expect(await call('POST', '/auth/register', { body: { name: 'X', email: `short_${run}@example.test`, password: '123' } }), 400);
    expect(await call('POST', '/auth/login', { body: { email: `e2e_a_${run}@example.test`, password: 'wrong-password' } }), 401);
  });

  it('customers cannot use admin or staff features', async () => {
    expect(await call('GET', '/users', { token: ctx.a.token }), 403);
    expect(await call('GET', '/reports/dashboard', { token: ctx.a.token }), 403);
    expect(await call('GET', '/reports/overview', { token: ctx.a.token }), 403);
    expect(await call('POST', '/products', { token: ctx.a.token, body: { name: 'Hack', price: 1 } }), 403);
    expect(await call('POST', '/inventory/restock', { token: ctx.a.token, body: { product_id: 1, warehouse_id: 1, quantity: 1 } }), 403);
  });

  it('admin creates a category, a product and adds stock', async () => {
    const c = await call('POST', '/categories', { token: ctx.admin, body: { name: `E2E Category ${run}` } });
    expect(c, 201);
    ctx.categoryId = c.data.id;
    ctx.productName = `E2E Product ${run}`;
    const p = await call('POST', '/products', { token: ctx.admin, body: { name: ctx.productName, price: 100, category_id: ctx.categoryId } });
    expect(p, 201);
    ctx.productId = p.data.id;
    const s = await call('POST', '/inventory/restock', { token: ctx.admin, body: { product_id: ctx.productId, warehouse_id: ctx.warehouseId, quantity: 5, note: 'e2e' } });
    expect(s, 201);
    assert.equal(s.data.new_stock, 5);
    const pub = await call('GET', `/products/${ctx.productId}`);
    expect(pub, 200);
    assert.equal(Number(pub.data.total_stock), 5);
  });

  it('admin dashboard overview returns its numbers and a full day-by-day series', async () => {
    const r = await call('GET', '/reports/overview?days=14', { token: ctx.admin });
    expect(r, 200);
    for (const key of ['revenue_month', 'orders_today', 'pending_orders', 'low_stock_count', 'customers']) {
      assert.equal(typeof r.data.kpi[key], 'number', key);
    }
    assert.equal(r.data.daily.length, 14);
    assert.ok(Array.isArray(r.data.statuses) && Array.isArray(r.data.recent_orders));
  });

  it('address book: first address becomes the default, the default can move, and a deleted default is replaced', async () => {
    const a1 = await call('POST', '/addresses', { token: ctx.a.token, body: { label: 'Home', phone: '01711111111', street: 'Road 1', city: 'Dhaka' } });
    expect(a1, 201);
    assert.equal(a1.data.is_default, true);
    const a2 = await call('POST', '/addresses', { token: ctx.a.token, body: { label: 'Office', phone: '01722222222', street: 'Road 2', city: 'Mymensingh' } });
    expect(a2, 201);
    assert.equal(a2.data.is_default, false);
    expect(await call('POST', '/addresses', { token: ctx.a.token, body: { street: 'No city or phone' } }), 400);
    expect(await call('PUT', `/addresses/${a2.data.id}/default`, { token: ctx.a.token }), 200);
    let list = (await call('GET', '/addresses', { token: ctx.a.token })).data;
    assert.equal(list.find((x) => x.is_default).id, a2.data.id);
    assert.equal(list.filter((x) => x.is_default).length, 1);
    assert.equal((await call('PUT', `/addresses/${a2.data.id}`, { token: ctx.b.token, body: { city: 'Hacked' } })).status, 404);   // not someone else's
    expect(await call('DELETE', `/addresses/${a2.data.id}`, { token: ctx.a.token }), 200);
    list = (await call('GET', '/addresses', { token: ctx.a.token })).data;
    assert.equal(list.length, 1);
    assert.equal(list[0].is_default, true);
    expect(await call('DELETE', `/addresses/${a1.data.id}`, { token: ctx.a.token }), 200);
  });

  it('public vouchers are listed for customers, private ones are not', async () => {
    const pub = await call('POST', '/coupons', { token: ctx.admin, body: { code: `PUB${run}`, discount_type: 'fixed', discount_value: 5, is_public: true } });
    expect(pub, 201);
    ctx.publicCouponId = pub.data.id;
    const v = await call('GET', '/coupons/available', { token: ctx.a.token });
    expect(v, 200);
    assert.ok(v.data.some((c) => c.code === `PUB${run}` && c.can_use === true), 'the public coupon should be listed');
    assert.ok(!v.data.some((c) => c.code === `E2E${run}`), 'a private coupon must not be listed');
  });

  it('cart refuses more than the available stock', async () => {
    expect(await call('POST', '/cart/items', { token: ctx.a.token, body: { product_id: ctx.productId, quantity: 2 } }), 201);
    expect(await call('POST', '/cart/items', { token: ctx.a.token, body: { product_id: ctx.productId, quantity: 10 } }), 409);
  });

  it('coupons: valid code discounts the cart, bad codes are refused', async () => {
    ctx.code = `E2E${run}`;
    const c = await call('POST', '/coupons', { token: ctx.admin, body: { code: ctx.code, discount_type: 'percent', discount_value: 10, per_user_limit: 1 } });
    expect(c, 201);
    ctx.couponId = c.data.id;
    const q = await call('POST', '/cart/quote', { token: ctx.a.token, body: { coupon_code: ctx.code } });
    expect(q, 200);
    assert.equal(q.data.subtotal, '200.00');
    assert.equal(q.data.discount, '20.00');
    assert.equal(Number(q.data.total), 180 + Number(q.data.delivery));
    expect(await call('POST', '/cart/quote', { token: ctx.a.token, body: { coupon_code: 'NO-SUCH-CODE' } }), 400);
  });

  it('checkout creates the order, deducts stock and empties the cart', async () => {
    expect(await call('POST', '/addresses', { token: ctx.a.token, body: savedShipping }), 201);
    const o = await call('POST', '/orders', { token: ctx.a.token, body: { coupon_code: ctx.code } });
    expect(o, 201);
    ctx.orderA = o.data.order_id;
    assert.equal(await stockOf(), 3);
    const cart = await call('GET', '/cart', { token: ctx.a.token });
    assert.equal(cart.data.items.length, 0);
    const detail = await call('GET', `/orders/${ctx.orderA}`, { token: ctx.a.token });
    expect(detail, 200);
    assert.equal(detail.data.coupon_code, ctx.code);
    assert.equal(detail.data.street, savedShipping.street);
    assert.equal(detail.data.phone, savedShipping.phone);
    assert.equal(detail.data.discount_amount, '20.00');
    assert.equal(detail.data.payment.status, 'pending');
    assert.ok(detail.data.history.length >= 1);
  });

  it('a coupon cannot be used twice by the same customer', async () => {
    expect(await call('POST', '/cart/items', { token: ctx.a.token, body: { product_id: ctx.productId, quantity: 1 } }), 201);
    const q = await call('POST', '/cart/quote', { token: ctx.a.token, body: { coupon_code: ctx.code } });
    expect(q, 400);
    assert.match(q.data.message, /already used/);
  });

  it("another customer cannot see someone else's order", async () => {
    expect(await call('GET', `/orders/${ctx.orderA}`, { token: ctx.b.token }), 404);
  });

  it('cancelling an order restores stock and gives the coupon back', async () => {
    const c = await call('POST', `/orders/${ctx.orderA}/cancel`, { token: ctx.a.token });
    expect(c, 200);
    assert.equal(c.data.status, 'cancelled');
    assert.equal(await stockOf(), 5);
    const q = await call('POST', '/cart/quote', { token: ctx.a.token, body: { coupon_code: ctx.code } });
    expect(q, 200);
    assert.equal(q.data.discount, '10.00');
    expect(await call('POST', `/orders/${ctx.orderA}/cancel`, { token: ctx.a.token }), 409);   // cannot cancel twice
  });

  it('flash sale lowers the price in the shop, the cart and the quote, and the price returns when it is deleted', async () => {
    const day = 24 * 60 * 60 * 1000;
    const fmt = (ms) => new Date(ms).toISOString().slice(0, 16);   // wide window (+-1 day) so time zones cannot matter
    const sale = await call('POST', '/flash-sales', { token: ctx.admin, body: { title: `E2E sale ${run}`, starts_at: fmt(Date.now() - day), ends_at: fmt(Date.now() + day) } });
    expect(sale, 201);
    ctx.saleId = sale.data.id;
    expect(await call('POST', `/flash-sales/${ctx.saleId}/items`, { token: ctx.admin, body: { product_id: ctx.productId, sale_price: 150 } }), 400);   // not lower than the current price
    expect(await call('POST', `/flash-sales/${ctx.saleId}/items`, { token: ctx.admin, body: { product_id: ctx.productId, sale_price: 60 } }), 201);

    const pub = await call('GET', `/products/${ctx.productId}`);
    assert.equal(pub.data.final_price, '60.00');
    assert.ok(pub.data.flash_seconds_left > 0);
    const active = await call('GET', '/flash-sales/active');
    expect(active, 200);
    assert.ok(active.data.sale, 'a live sale should be returned');
    const q = await call('POST', '/cart/quote', { token: ctx.a.token, body: {} });   // customer A has 1 item in the cart
    expect(q, 200);
    assert.equal(q.data.subtotal, '60.00');
    expect(await call('GET', '/flash-sales', { token: ctx.a.token }), 403);

    expect(await call('DELETE', `/flash-sales/${ctx.saleId}`, { token: ctx.admin }), 200);
    ctx.saleId = null;
    assert.equal((await call('GET', `/products/${ctx.productId}`)).data.final_price, '100.00');
  });

  it('buy it again puts an earlier order back into the cart, and only for its owner', async () => {
    const r = await call('POST', `/orders/${ctx.orderA}/reorder`, { token: ctx.a.token });
    expect(r, 200);
    assert.equal(r.data.added.length, 1);
    assert.equal(r.data.added[0].quantity, 2);
    const cart = await call('GET', '/cart', { token: ctx.a.token });
    assert.equal(cart.data.items[0].quantity, 3);   // 1 already in the cart + the 2 from the old order
    assert.equal((await call('POST', `/orders/${ctx.orderA}/reorder`, { token: ctx.b.token })).status, 404);
  });

  it('concurrent buy-it-again requests both update the same cart', async () => {
    expect(await call('DELETE', '/cart', { token: ctx.a.token }), 200);
    const results = await Promise.all(Array.from({ length: 2 }, () =>
      call('POST', `/orders/${ctx.orderA}/reorder`, { token: ctx.a.token })));
    for (const result of results) {
      expect(result, 200);
      assert.equal(result.data.added[0].quantity, 2);
    }
    const cart = await call('GET', '/cart', { token: ctx.a.token });
    expect(cart, 200);
    assert.equal(cart.data.items[0].quantity, 4);
  });

  it('OVERSELLING: two customers racing for the last item, only one wins', async () => {
    const adj = await call('POST', '/inventory/adjust', { token: ctx.admin, body: { product_id: ctx.productId, warehouse_id: ctx.warehouseId, new_quantity: 1, note: 'e2e race test' } });
    expect(adj, 200);
    expect(await call('DELETE', '/cart', { token: ctx.a.token }), 200);
    expect(await call('POST', '/cart/items', { token: ctx.a.token, body: { product_id: ctx.productId, quantity: 1 } }), 201);
    expect(await call('POST', '/cart/items', { token: ctx.b.token, body: { product_id: ctx.productId, quantity: 1 } }), 201);

    const [ra, rb] = await Promise.all([
      call('POST', '/orders', { token: ctx.a.token, body: shipping }),
      call('POST', '/orders', { token: ctx.b.token, body: shipping }),
    ]);
    assert.deepEqual([ra.status, rb.status].sort(), [201, 409], `A: ${ra.status} ${JSON.stringify(ra.data)} | B: ${rb.status} ${JSON.stringify(rb.data)}`);
    assert.equal(await stockOf(), 0);
    ctx.winner = ra.status === 201 ? { token: ctx.a.token, orderId: ra.data.order_id } : { token: ctx.b.token, orderId: rb.data.order_id };
  });

  it('order status follows the allowed flow and reviews need a delivered order', async () => {
    const id = ctx.winner.orderId;
    expect(await call('PATCH', `/orders/${id}/status`, { token: ctx.admin, body: { status: 'delivered' } }), 409);   // cannot skip steps
    expect(await call('POST', `/reviews/product/${ctx.productId}`, { token: ctx.winner.token, body: { rating: 5 } }), 403);
    for (const status of ['confirmed', 'processing', 'shipped', 'delivered']) {
      expect(await call('PATCH', `/orders/${id}/status`, { token: ctx.admin, body: { status, note: 'e2e' } }), 200);
    }
    const detail = await call('GET', `/orders/${id}`, { token: ctx.winner.token });
    assert.equal(detail.data.status, 'delivered');
    assert.equal(detail.data.payment.status, 'completed');
    assert.equal(detail.data.history.length, 5);
    const before = await call('GET', '/reviews/mine', { token: ctx.winner.token });
    expect(before, 200);
    assert.ok(before.data.toReview.some((p) => p.product_id === ctx.productId), 'a delivered, unreviewed product should wait for a review');
    expect(await call('POST', `/reviews/product/${ctx.productId}`, { token: ctx.winner.token, body: { rating: 5, comment: 'e2e review' } }), 201);
    const after = await call('GET', '/reviews/mine', { token: ctx.winner.token });
    assert.ok(after.data.reviews.some((r) => r.product_id === ctx.productId));
    assert.ok(!after.data.toReview.some((p) => p.product_id === ctx.productId));
    const reviews = await call('GET', `/reviews/product/${ctx.productId}`);
    assert.equal(reviews.data.summary.count, 1);
    assert.equal(reviews.data.summary.average, 5);
  });

  it('account area: summary, profile fields, photo upload and data export', async () => {
    const sum = await call('GET', '/account/summary', { token: ctx.a.token });
    expect(sum, 200);
    for (const k of ['orders', 'active_orders', 'spent', 'saved', 'reviews', 'wishlist', 'addresses', 'vouchers', 'to_review']) assert.equal(typeof sum.data[k], 'number', k);

    expect(await call('PUT', '/auth/me', { token: ctx.a.token, body: { birthday: '1999-05-17', gender: 'female' } }), 200);
    expect(await call('PUT', '/auth/me', { token: ctx.a.token, body: { birthday: '2999-01-01' } }), 400);
    expect(await call('PUT', '/auth/me', { token: ctx.a.token, body: { gender: 'robot' } }), 400);
    const me = await call('GET', '/auth/me', { token: ctx.a.token });
    assert.equal(me.data.birthday, '1999-05-17');
    assert.equal(me.data.gender, 'female');

    // a real 1x1 PNG is accepted, a text file pretending to be a PNG is refused
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
    const send = async (buffer, type) => {
      const form = new FormData();
      form.append('image', new Blob([buffer], { type }), 'photo.png');
      const res = await fetch(`${BASE}/account/avatar`, { method: 'POST', headers: { Authorization: `Bearer ${ctx.a.token}` }, body: form });
      return { status: res.status, data: await res.json().catch(() => ({})) };
    };
    const good = await send(png, 'image/png');
    expect(good, 201);
    assert.ok(good.data.avatar_url.startsWith('/uploads/'));
    expect(await send(Buffer.from('this is not an image at all'), 'image/png'), 400);
    assert.equal((await call('GET', '/auth/me', { token: ctx.a.token })).data.avatar_url, good.data.avatar_url);
    expect(await call('DELETE', '/account/avatar', { token: ctx.a.token }), 200);
    assert.equal((await call('GET', '/auth/me', { token: ctx.a.token })).data.avatar_url, null);

    const data = await call('GET', '/account/export', { token: ctx.a.token });
    expect(data, 200);
    assert.equal(data.data.profile.email, `e2e_a_${run}@example.test`);
    assert.ok(!JSON.stringify(data.data).includes('password'), 'the export must never contain the password');
  });

  it('security: a password change and "sign out other devices" end the older sessions', async () => {
    const oldToken = ctx.a.token;
    const changed = await call('PUT', '/auth/password', { token: oldToken, body: { current_password: password, new_password: 'N3w-Passw0rd!x' } });
    expect(changed, 200);
    assert.equal((await call('GET', '/auth/me', { token: oldToken })).status, 401);          // the old session is gone
    assert.equal((await call('GET', '/auth/me', { token: changed.data.token })).status, 200); // this device carries on
    const revoke = await call('POST', '/account/revoke-sessions', { token: changed.data.token });
    expect(revoke, 200);
    assert.equal((await call('GET', '/auth/me', { token: changed.data.token })).status, 401);
    ctx.a.token = revoke.data.token;
    assert.equal((await call('GET', '/auth/me', { token: ctx.a.token })).status, 200);
    expect(await call('POST', '/account/deactivate', { token: ctx.a.token, body: { password: 'wrong' } }), 401);
  });

  it('a deactivated account loses access immediately', async () => {
    assert.equal((await call('GET', '/auth/me', { token: ctx.b.token })).status, 200);
    expect(await call('PATCH', `/users/${ctx.b.id}`, { token: ctx.admin, body: { is_active: false } }), 200);
    assert.equal((await call('GET', '/auth/me', { token: ctx.b.token })).status, 401);
  });

  after(async () => {
    if (!ctx.admin) return;
    const quiet = (p) => p.catch(() => {});
    if (ctx.saleId) await quiet(call('DELETE', `/flash-sales/${ctx.saleId}`, { token: ctx.admin }));
    if (ctx.productId) await quiet(call('DELETE', `/products/${ctx.productId}`, { token: ctx.admin }));      // deactivate
    if (ctx.categoryId) await quiet(call('DELETE', `/categories/${ctx.categoryId}`, { token: ctx.admin }));
    if (ctx.couponId) await quiet(call('DELETE', `/coupons/${ctx.couponId}`, { token: ctx.admin }));
    if (ctx.publicCouponId) await quiet(call('DELETE', `/coupons/${ctx.publicCouponId}`, { token: ctx.admin }));
    for (const u of [ctx.a, ctx.b]) if (u) await quiet(call('PATCH', `/users/${u.id}`, { token: ctx.admin, body: { is_active: false } }));
  });
});
