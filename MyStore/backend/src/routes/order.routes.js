const router = require('express').Router();
const o = require('../controllers/order.controller');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/role');

router.use(authenticate);
router.post('/', o.create);
router.get('/', o.myOrders);
router.get('/manage/all', authorize('admin'), o.listAll);   // must stay above '/:id'
router.get('/:id', o.getOne);
router.post('/:id/cancel', o.cancel);
router.post('/:id/reorder', o.reorder);
router.patch('/:id/status', authorize('admin'), o.updateStatus);

module.exports = router;
