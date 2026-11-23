const router = require('express').Router();
const a = require('../controllers/address.controller');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);
router.get('/', a.list);
router.post('/', a.create);
router.put('/:id/default', a.setDefault);   // before '/:id'
router.put('/:id', a.update);
router.delete('/:id', a.remove);

module.exports = router;
