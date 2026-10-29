const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  // Users
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  getStats,
  changePassword,
  // Dependants (Feature 5)
  getDependants,
  addDependant,
  updateDependant,
  deleteDependant,
} = require('../controllers/userController');

router.use(authenticate);

// ── Stats ────────────────────────────────────────────────────────────────────
// Role check is also enforced inside the controller, but kept here too so the
// middleware rejects unauthorized requests before they hit the DB.
router.get('/stats', authorize('pastor'), getStats);

// ── Users ────────────────────────────────────────────────────────────────────
router.get('/',     authorize('pastor', 'elder', 'group_leader'), getUsers);
router.get('/:id',  authorize('pastor', 'elder', 'group_leader'), getUser);
router.put('/:id',  authorize('pastor', 'elder', 'group_leader', 'member'), updateUser);
router.delete('/:id', authorize('pastor'), deleteUser);

router.put('/:id/password',   authorize('pastor', 'member'), changePassword);

// ── Dependants ───────────────────────────────────────────────────────────────
// pastor  → full access
// elder / group_leader → read only (getDependants enforces group scope)
// member  → may read and manage their own dependants
router.get('/:id/dependants',           authorize('pastor', 'elder', 'group_leader', 'member'), getDependants);
router.post('/:id/dependants',          authorize('pastor', 'member'), addDependant);
router.patch('/:id/dependants/:depId',  authorize('pastor', 'member'), updateDependant);
router.delete('/:id/dependants/:depId', authorize('pastor'), deleteDependant);

module.exports = router;