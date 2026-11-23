const router = require('express').Router();
const u = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/role');

router.use(authenticate, authorize('admin'));
router.get('/', u.list);
router.get('/:id/history', u.history);
router.patch('/:id', u.update);

module.exports = router;
