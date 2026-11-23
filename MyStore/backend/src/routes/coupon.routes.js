const router = require('express').Router();
const c = require('../controllers/coupon.controller');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/role');

router.get('/available', authenticate, c.available);   // customers: the public vouchers

router.use(authenticate, authorize('admin'));
router.get('/', c.list);
router.post('/', c.create);
router.put('/:id', c.update);
router.delete('/:id', c.remove);

module.exports = router;
