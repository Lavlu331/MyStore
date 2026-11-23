const router = require('express').Router();
const c = require('../controllers/cart.controller');
const { authenticate } = require('../middleware/auth');

router.use(authenticate); // every cart route needs a logged-in user
router.get('/', c.get);
router.delete('/', c.clear);
router.post('/quote', c.quote);
router.post('/items', c.addItem);
router.put('/items/:productId', c.updateItem);
router.delete('/items/:productId', c.removeItem);

module.exports = router;
