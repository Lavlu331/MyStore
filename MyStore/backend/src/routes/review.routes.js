const router = require('express').Router();
const r = require('../controllers/review.controller');
const { authenticate } = require('../middleware/auth');

router.get('/mine', authenticate, r.mine);
router.get('/product/:productId', r.listForProduct);              // public
router.get('/status/:productId', authenticate, r.status);
router.post('/product/:productId', authenticate, r.save);
router.delete('/:id', authenticate, r.remove);

module.exports = router;
