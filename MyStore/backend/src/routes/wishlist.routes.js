const router = require('express').Router();
const w = require('../controllers/wishlist.controller');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);
router.get('/', w.list);
router.post('/', w.add);
router.delete('/:productId', w.remove);

module.exports = router;
