const router = require('express').Router();
const s = require('../controllers/settings.controller');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/role');

router.get('/public', s.publicSettings);
router.get('/', authenticate, authorize('admin'), s.get);
router.put('/', authenticate, authorize('admin'), s.update);

module.exports = router;
