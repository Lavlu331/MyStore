const router = require('express').Router();
const b = require('../controllers/banner.controller');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/role');

router.get('/', b.list);                                                   // public
router.get('/manage/all', authenticate, authorize('admin'), b.adminList);  // must stay above '/:id'
router.post('/', authenticate, authorize('admin'), b.create);
router.put('/:id', authenticate, authorize('admin'), b.update);
router.delete('/:id', authenticate, authorize('admin'), b.remove);

module.exports = router;
