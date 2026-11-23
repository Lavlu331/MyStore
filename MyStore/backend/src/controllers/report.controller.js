const pool = require('../config/db');

const int = (v) => { const n = Number(v); return Number.isInteger(n) ? n : NaN; };

// CALL returns [ [rows...], OkPacket ]; we only want the rows
const callProc = async (sql, params = []) => {
  const [results] = await pool.query(sql, params);
  return Array.isArray(results[0]) ? results[0] : results;
};
const selectView = async (sql, params = []) => (await pool.query(sql, params))[0];

const paged = (req, def = 20) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || def, 1), 100);
  return { page, limit, offset: (page - 1) * limit };
};

// GET /api/reports/dashboard  (admin)
exports.dashboard = async (req, res, next) => {
  try {
    const [sales, orderStatus, lowStock, counts] = await Promise.all([
      selectView('SELECT * FROM vw_sales_summary'),
      callProc('CALL sp_order_status_report()'),
      selectView('SELECT COUNT(*) AS count FROM vw_low_stock_products'),
      selectView(
        `SELECT (SELECT COUNT(*) FROM products WHERE is_active = 1) AS active_products,
                (SELECT COUNT(*) FROM users WHERE role = 'customer' AND is_active = 1) AS customers,
                (SELECT COUNT(*) FROM orders WHERE status = 'pending') AS pending_orders`),
    ]);
    res.json({
      sales_summary: sales[0] || null,
      orders_by_status: orderStatus,
      low_stock_count: lowStock[0].count,
      ...counts[0],
    });
  } catch (err) { next(err); }
};

// GET /api/reports/sales?from=2026-11-01&to=2026-11-30   (delivered orders in a chosen period)
exports.salesByPeriod = async (req, res, next) => {
  try {
    const [[clock]] = await pool.query(
      `SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today,
              DATE_FORMAT(CURDATE(), '%Y-%m-01') AS month_start,
              IF(@@session.time_zone = 'SYSTEM', @@system_time_zone, @@session.time_zone) AS time_zone`);
    const { from = clock.month_start, to = clock.today } = req.query;
    const dateOk = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d)) && new Date(d).toISOString().slice(0, 10) === d;
    if (!dateOk(from) || !dateOk(to) || from > to)
      return res.status(400).json({ message: 'Use ?from=YYYY-MM-DD&to=YYYY-MM-DD (from must not be after to)' });

    const range = 'status = \'delivered\' AND created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)';
    const [[summary]] = await pool.query(
      `SELECT COUNT(*) AS delivered_orders, COALESCE(SUM(total_amount), 0) AS total_sales,
              COALESCE(AVG(total_amount), 0) AS average_order_value
       FROM orders WHERE ${range}`, [from, to]);
    const [daily] = await pool.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day, COUNT(*) AS orders, SUM(total_amount) AS sales
       FROM orders WHERE ${range} GROUP BY day ORDER BY day`, [from, to]);
    res.json({ from, to, time_zone: clock.time_zone, ...summary, daily });
  } catch (err) { next(err); }
};

exports.salesSummary = async (req, res, next) => {
  try { res.json((await selectView('SELECT * FROM vw_sales_summary'))[0] || {}); } catch (err) { next(err); }
};

exports.monthlySalesView = async (req, res, next) => {
  try { res.json(await selectView('SELECT * FROM vw_monthly_sales')); } catch (err) { next(err); }
};

// GET /api/reports/monthly-sales/2026/11  -> stored procedure
exports.monthlySalesProc = async (req, res, next) => {
  try {
    const year = int(req.params.year), month = int(req.params.month);
    if (!(year >= 2000 && year <= 2100) || !(month >= 1 && month <= 12))
      return res.status(400).json({ message: 'Invalid year or month' });
    const rows = await callProc('CALL sp_monthly_sales_report(?, ?)', [year, month]);
    res.json(rows[0] || {});
  } catch (err) { next(err); }
};

exports.bestSelling = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);
    res.json(await selectView('SELECT * FROM vw_best_selling_products LIMIT ?', [limit]));
  } catch (err) { next(err); }
};

exports.orderStatus = async (req, res, next) => {
  try { res.json(await callProc('CALL sp_order_status_report()')); } catch (err) { next(err); }
};

exports.payments = async (req, res, next) => {
  try {
    const { limit, offset } = paged(req);
    res.json(await selectView('SELECT * FROM vw_payment_report LIMIT ? OFFSET ?', [limit, offset]));
  } catch (err) { next(err); }
};

// ---- inventory reports (admin + inventory_manager) ----
exports.inventory = async (req, res, next) => {
  try { res.json(await selectView('SELECT * FROM vw_inventory_report')); } catch (err) { next(err); }
};

exports.warehouseStock = async (req, res, next) => {
  try { res.json(await selectView('SELECT * FROM vw_warehouse_stock')); } catch (err) { next(err); }
};

exports.lowStock = async (req, res, next) => {
  try { res.json(await callProc('CALL sp_low_stock_report()')); } catch (err) { next(err); }
};

// GET /api/reports/overview?days=14  (admin)  - everything the new dashboard shows, in a fixed shape
exports.overview = async (req, res, next) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days) || 14, 7), 90);

    const [[k]] = await pool.query(`
      SELECT
        (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status = 'delivered' AND DATE(created_at) = CURDATE()) AS revenue_today,
        (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status = 'delivered'
           AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')) AS revenue_month,
        (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status = 'delivered'
           AND created_at >= DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-01'), INTERVAL 1 MONTH)
           AND created_at < DATE_FORMAT(NOW(), '%Y-%m-01')) AS revenue_prev_month,
        (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status = 'delivered') AS revenue_total,
        (SELECT COUNT(*) FROM orders WHERE DATE(created_at) = CURDATE()) AS orders_today,
        (SELECT COUNT(*) FROM orders WHERE status = 'pending') AS pending_orders,
        (SELECT COUNT(*) FROM orders) AS total_orders,
        (SELECT COUNT(*) FROM users WHERE role = 'customer' AND is_active = 1) AS customers,
        (SELECT COUNT(*) FROM products WHERE is_active = 1) AS active_products,
        (SELECT COUNT(*) FROM warehouse_inventory wi JOIN products p ON p.id = wi.product_id AND p.is_active = 1
           WHERE wi.low_stock_threshold IS NOT NULL AND wi.quantity <= wi.low_stock_threshold) AS low_stock_count,
        DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today`);

    const [placed] = await pool.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day, COUNT(*) AS n FROM orders
       WHERE status <> 'cancelled' AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) GROUP BY day`, [days - 1]);
    const [revenue] = await pool.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day, COALESCE(SUM(total_amount), 0) AS amount FROM orders
       WHERE status = 'delivered' AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) GROUP BY day`, [days - 1]);

    // one row per day, including days without orders
    const placedBy = Object.fromEntries(placed.map((r) => [r.day, Number(r.n)]));
    const revenueBy = Object.fromEntries(revenue.map((r) => [r.day, Number(r.amount)]));
    const end = Date.parse(`${k.today}T00:00:00Z`);
    const daily = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      const day = new Date(end - i * 86400000).toISOString().slice(0, 10);
      daily.push({ day, orders: placedBy[day] || 0, revenue: revenueBy[day] || 0 });
    }

    const [statuses] = await pool.query('SELECT status, COUNT(*) AS n FROM orders GROUP BY status');
    const [topProducts] = await pool.query(
      `SELECT oi.product_id, oi.product_name AS name, SUM(oi.quantity) AS units, SUM(oi.subtotal) AS revenue
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE o.status NOT IN ('cancelled', 'returned')
       GROUP BY oi.product_id, oi.product_name ORDER BY units DESC LIMIT 5`);
    const [recentOrders] = await pool.query(
      `SELECT o.id, o.total_amount, o.status, o.created_at, u.name AS customer_name
       FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.created_at DESC, o.id DESC LIMIT 8`);
    const [lowStock] = await pool.query(
      `SELECT wi.product_id, p.name AS product_name, w.name AS warehouse_name, wi.quantity, wi.low_stock_threshold
       FROM warehouse_inventory wi
       JOIN products p ON p.id = wi.product_id AND p.is_active = 1
       JOIN warehouses w ON w.id = wi.warehouse_id
       WHERE wi.low_stock_threshold IS NOT NULL AND wi.quantity <= wi.low_stock_threshold
       ORDER BY wi.quantity ASC LIMIT 5`);

    const num = (v) => Number(v) || 0;
    res.json({
      kpi: {
        revenue_today: num(k.revenue_today), revenue_month: num(k.revenue_month), revenue_prev_month: num(k.revenue_prev_month),
        revenue_total: num(k.revenue_total), orders_today: num(k.orders_today), pending_orders: num(k.pending_orders),
        total_orders: num(k.total_orders), customers: num(k.customers), active_products: num(k.active_products),
        low_stock_count: num(k.low_stock_count),
      },
      daily,
      statuses: statuses.map((r) => ({ status: r.status, count: Number(r.n) })),
      top_products: topProducts.map((r) => ({ ...r, units: num(r.units), revenue: num(r.revenue) })),
      recent_orders: recentOrders,
      low_stock: lowStock,
    });
  } catch (err) { next(err); }
};
