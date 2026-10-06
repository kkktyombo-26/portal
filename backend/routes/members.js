const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { getMembers, getMember, createMember, updateMember, deleteMember } = require('../controllers/memberController');

// ── ADD THIS ──
const {
  getProfile, updateProfile,
  getDependants, addDependant, removeDependant,
} = require('../controllers/memberProfileController');

router.use(authenticate);

router.get('/',    authorize('pastor', 'elder', 'group_leader'), getMembers);
router.get('/:id', getMember);
router.post('/',   authorize('pastor'), [
  body('full_name').trim().notEmpty(),
  body('email').isEmail(),
], validate, createMember);
router.put('/:id', authorize('pastor', 'elder', 'group_leader'), updateMember);
router.delete('/:id', authorize('pastor'), deleteMember);

// ── ADD THESE ──
router.get('/:id/profile',  getProfile);
router.put('/:id/profile',  updateProfile);

router.get('/:id/dependants',           getDependants);
router.post('/:id/dependants', authorize('pastor', 'elder'), [
  body('full_name').trim().notEmpty().withMessage('full_name is required'),
  body('date_of_birth').optional().isDate(),
  body('relationship').optional().trim(),
], validate, addDependant);
router.delete('/:id/dependants/:depId', authorize('pastor', 'elder'), removeDependant);

module.exports = router;