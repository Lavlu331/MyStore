const router = require('express').Router();
const n = require('../controllers/notification.controller');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);
router.get('/', n.list);
router.get('/unread-count', n.unreadCount);
router.patch('/read-all', n.markAllRead);   // must stay above '/:id/read'
router.patch('/:id/read', n.markRead);

module.exports = router;
