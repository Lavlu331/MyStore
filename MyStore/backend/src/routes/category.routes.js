const router = require('express').Router();
const c = require('../controllers/category.controller');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/role');

router.get('/', c.list);
router.get('/manage/all', authenticate, authorize('admin'), c.adminList); // above '/:id'
router.get('/:id', c.getOne);
router.post('/', authenticate, authorize('admin'), c.create);
router.put('/:id', authenticate, authorize('admin'), c.update);
router.delete('/:id', authenticate, authorize('admin'), c.remove);

module.exports = router;
