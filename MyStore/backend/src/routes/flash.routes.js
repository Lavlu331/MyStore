const router = require('express').Router();
const f = require('../controllers/flash.controller');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/role');

router.get('/active', f.active);                                    // public; must stay above '/:id'

router.use(authenticate, authorize('admin'));
router.get('/', f.list);
router.post('/', f.create);
router.get('/clock', f.clock);
router.get('/:id', f.getOne);
router.put('/:id', f.update);
router.delete('/:id', f.remove);
router.post('/:id/items', f.addItem);
router.delete('/:id/items/:productId', f.removeItem);

module.exports = router;
