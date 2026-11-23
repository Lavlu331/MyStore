const { test } = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../../src/config/db');
const { create } = require('../../src/controllers/order.controller');

test('two concurrent checkouts of one cart create just one order', async (t) => {
  let connectionCount = 0;
  let orderCount = 0;
  let paymentCount = 0;
  let stock = 5;
  let cartHasItem = true;
  let secondReachedCart;
  let firstFinished;
  const secondAtCart = new Promise((resolve) => { secondReachedCart = resolve; });
  const firstDone = new Promise((resolve) => { firstFinished = resolve; });

  t.mock.method(pool, 'getConnection', async () => {
    const first = ++connectionCount === 1;
    let clearCart = false;
    return {
      async beginTransaction() {},
      async commit() {
        if (clearCart) cartHasItem = false;
        if (first) firstFinished();
      },
      async rollback() { if (first) firstFinished(); },
      release() {},
      async query(sql) {
        assert.match(sql, /^INSERT INTO order_items/);
      },
      async execute(sql, params) {
        if (sql.startsWith('SELECT id FROM carts')) {
          if (!first) {
            secondReachedCart();
            if (sql.endsWith('FOR UPDATE')) await firstDone;
          }
          return [[{ id: 1 }]];
        }
        if (sql.includes('FROM cart_items ci')) {
          const items = cartHasItem ? [{ product_id: 1, quantity: 1, name: 'Test item', is_active: 1, unit_price: '10.00' }] : [];
          if (first) await secondAtCart;
          return [items];
        }
        if (sql.includes('FROM users')) return [[{ street: 'Test Road', city: 'Dhaka', phone: '01700000000' }]];
        if (sql.includes('FROM settings')) return [[]];
        if (sql.startsWith('INSERT INTO orders')) return [{ insertId: ++orderCount }];
        if (sql.startsWith('INSERT INTO order_status_history')) return [];
        if (sql.includes('FROM warehouse_inventory')) return [[{ warehouse_id: 1, quantity: stock }]];
        if (sql.startsWith('UPDATE warehouse_inventory')) { stock -= params[0]; return []; }
        if (sql.includes('INSERT INTO inventory_transactions')) return [];
        if (sql.startsWith('INSERT INTO payments')) { paymentCount++; return []; }
        if (sql.startsWith('DELETE FROM cart_items')) { clearCart = true; return []; }
        assert.fail(`Unexpected SQL: ${sql}`);
      },
    };
  });

  const checkout = async () => {
    const response = {};
    await create({ user: { id: 1 }, body: {} }, {
      status(code) { response.status = code; return this; },
      json(body) { response.body = body; },
    }, (error) => { throw error; });
    return response;
  };

  const [first, second] = await Promise.all([checkout(), checkout()]);
  assert.equal(first.status, 201);
  assert.deepEqual(second, { status: 400, body: { message: 'Your cart is empty' } });
  assert.equal(orderCount, 1);
  assert.equal(paymentCount, 1);
  assert.equal(stock, 4);
  assert.equal(cartHasItem, false);
});


test('checkout forwards a connection-acquisition failure to Express', async (t) => {
  const failure = new Error('Database connection unavailable');
  t.mock.method(pool, 'getConnection', async () => { throw failure; });

  const next = t.mock.fn();
  await create({ user: { id: 1 }, body: {} }, {}, next);

  assert.equal(next.mock.callCount(), 1);
  assert.equal(next.mock.calls[0].arguments[0], failure);
});

test('checkout starts a fresh transaction after MariaDB reports a changed record', async (t) => {
  const changed = Object.assign(new Error('Record changed'), { code: 'ER_CHECKREAD' });
  const steps = [];
  let attempts = 0;
  t.mock.method(pool, 'getConnection', async () => {
    const attempt = ++attempts;
    return {
      async beginTransaction() { steps.push(`begin ${attempt}`); },
      async execute() {
        if (attempt === 1) throw changed;
        return [[]];
      },
      async rollback() { steps.push(`rollback ${attempt}`); },
      release() { steps.push(`release ${attempt}`); },
    };
  });

  const response = { status: t.mock.fn(() => response), json: t.mock.fn() };
  const next = t.mock.fn();
  await create({ user: { id: 1 }, body: {} }, response, next);

  assert.deepEqual(steps, ['begin 1', 'rollback 1', 'release 1', 'begin 2', 'rollback 2', 'release 2']);
  assert.equal(response.status.mock.calls[0].arguments[0], 400);
  assert.deepEqual(response.json.mock.calls[0].arguments[0], { message: 'Your cart is empty' });
  assert.equal(next.mock.callCount(), 0);
});

test('checkout limits MariaDB retries and returns a conflict when they are exhausted', async (t) => {
  const changed = Object.assign(new Error('Record changed'), { code: 'ER_CHECKREAD' });
  const rollback = t.mock.fn(async () => {});
  const release = t.mock.fn();
  t.mock.method(pool, 'getConnection', async () => ({
    async beginTransaction() {},
    async execute() { throw changed; },
    rollback,
    release,
  }));

  const response = { status: t.mock.fn(() => response), json: t.mock.fn() };
  const next = t.mock.fn();
  await create({ user: { id: 1 }, body: {} }, response, next);

  assert.equal(rollback.mock.callCount(), 3);
  assert.equal(release.mock.callCount(), 3);
  assert.equal(response.status.mock.calls[0].arguments[0], 409);
  assert.equal(next.mock.callCount(), 0);
});
