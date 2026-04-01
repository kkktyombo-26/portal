const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getGroups, createGroup, updateGroup, deleteGroup,getGroup ,getGroupMembers} = require('../controllers/groupController');
const { body } = require('express-validator');
const validate = require('../middleware/validate');

router.use(authenticate);
router.get('/', getGroups);
router.post('/', [
  body('name').trim().notEmpty().withMessage('Group name is required'),
  body('name_sw').trim().notEmpty().withMessage('Swahili group name is required'),
  body('type').isIn(['choir','youth','elders','women','men','children','other']).withMessage('Invalid group type'),
], validate, authorize('pastor'), createGroup);
router.put('/:id', authorize('pastor'), updateGroup);
router.delete('/:id', authorize('pastor'), deleteGroup);

router.get('/:id', getGroup);  // add after router.get('/');
router.get('/:id/members', getGroupMembers);

module.exports = router;
