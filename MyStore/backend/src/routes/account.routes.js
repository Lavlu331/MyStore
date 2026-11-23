const router = require('express').Router();
const a = require('../controllers/account.controller');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);
router.get('/summary', a.summary);
router.get('/export', a.exportData);
router.post('/avatar', a.uploadAvatar);
router.delete('/avatar', a.removeAvatar);
router.post('/revoke-sessions', a.revokeSessions);
router.post('/deactivate', a.deactivate);

module.exports = router;
