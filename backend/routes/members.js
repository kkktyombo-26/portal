const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { getMembers, getMember, createMember, updateMember, deleteMember } = require('../controllers/memberController');

router.use(authenticate);

router.get('/',    authorize('pastor', 'elder', 'group_leader'), getMembers);
router.get('/:id', getMember);
router.post('/',   authorize('pastor'), [
  body('full_name').trim().notEmpty(),
  body('email').isEmail(),
], validate, createMember);
router.put('/:id', authorize('pastor', 'elder', 'group_leader'), updateMember);
router.delete('/:id', authorize('pastor'), deleteMember);

module.exports = router;
