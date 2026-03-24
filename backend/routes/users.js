const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getUsers, getUser, updateUser, deleteUser, getStats } = require('../controllers/userController');

router.use(authenticate);
router.get('/stats', authorize('pastor'), getStats);
router.get('/', authorize('pastor', 'elder', 'group_leader'), getUsers);
router.get('/:id', authorize('pastor', 'elder', 'group_leader'), getUser);
router.put('/:id', updateUser);
router.delete('/:id', authorize('pastor'), deleteUser);

module.exports = router;
