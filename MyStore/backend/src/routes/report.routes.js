const router = require('express').Router();
const r = require('../controllers/report.controller');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/role');

router.use(authenticate);

// Inventory reports: admin + inventory manager
const stockStaff = authorize('admin', 'inventory_manager');
router.get('/inventory', stockStaff, r.inventory);
router.get('/warehouse-stock', stockStaff, r.warehouseStock);
router.get('/low-stock', stockStaff, r.lowStock);

// Sales and money reports: admin only
router.get('/dashboard', authorize('admin'), r.dashboard);
router.get('/overview', authorize('admin'), r.overview);
router.get('/sales', authorize('admin'), r.salesByPeriod);
router.get('/sales-summary', authorize('admin'), r.salesSummary);
router.get('/monthly-sales', authorize('admin'), r.monthlySalesView);
router.get('/monthly-sales/:year/:month', authorize('admin'), r.monthlySalesProc);
router.get('/best-selling', authorize('admin'), r.bestSelling);
router.get('/order-status', authorize('admin'), r.orderStatus);
router.get('/payments', authorize('admin'), r.payments);

module.exports = router;
