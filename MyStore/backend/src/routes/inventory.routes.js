const router = require('express').Router();
const i = require('../controllers/inventory.controller');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/role');

// Only inventory managers and admins
router.use(authenticate, authorize('admin', 'inventory_manager'));

router.get('/', i.list);
router.get('/low-stock', i.lowStock);
router.get('/products', i.searchProducts);
router.get('/warehouses', i.warehouses);
router.get('/transactions', i.transactions);
router.post('/restock', i.restock);
router.post('/adjust', i.adjust);
router.patch('/threshold', i.setThreshold);

module.exports = router;
