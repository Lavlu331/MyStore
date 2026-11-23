const router = require('express').Router();
const p = require('../controllers/product.controller');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/role');

router.get('/', p.list);
router.get('/featured', p.featured);   // must stay above '/:id'
router.get('/suggest', p.suggest);     // must stay above '/:id'
router.get('/by-ids', p.byIds);        // must stay above '/:id'
// admin routes must stay above '/:id'
router.get('/manage/all', authenticate, authorize('admin'), p.adminList);
router.get('/manage/:id', authenticate, authorize('admin'), p.adminGetOne);
router.get('/:id', p.getOne);
router.get('/:id/related', p.related);
router.post('/', authenticate, authorize('admin'), p.create);
router.put('/:id', authenticate, authorize('admin'), p.update);
router.delete('/:id', authenticate, authorize('admin'), p.remove);

module.exports = router;
