/**
 * groupRoutes.js  (v2)
 * ─────────────────────
 * Groups module routes — updated for BSS-KKKT-2026-004
 *
 * Mount in server.js / app.js:
 *   const groupRoutes = require('./routes/groupRoutes');
 *   app.use('/api/groups', groupRoutes);
 *
 * Route overview
 * ────────────────────────────────────────────────────────────────────
 * Groups
 *   GET    /api/groups                         list groups (?type= ?year= ?is_archived=)
 *   POST   /api/groups                         create group [pastor, elder]
 *   GET    /api/groups/:id                     get one group
 *   PUT    /api/groups/:id                     update group [pastor, elder]
 *   PATCH  /api/groups/:id/archive             archive group [pastor, elder]
 *   DELETE /api/groups/:id                     hard-delete [pastor]
 *
 * Membership
 *   GET    /api/groups/:id/members             list members (?year= ?status=)
 *   POST   /api/groups/:id/members             add member [pastor, elder, group_leader]
 *   PUT    /api/groups/:id/members/:mid        edit membership [pastor, elder, group_leader]
 *   DELETE /api/groups/:id/members/:mid        soft-remove (→ former) [pastor, elder, group_leader]
 *   DELETE /api/groups/:id/members/:mid/hard   hard-delete membership [pastor]
 *
 * History & cross-member
 *   GET    /api/groups/:id/history             all memberships grouped by year
 *   GET    /api/groups/member/:userId          all groups a member has ever been in
 *   PUT    /api/groups/member/:userId/sync     sync a member's group memberships
 * ────────────────────────────────────────────────────────────────────
 */

const router  = require('express').Router();
const { body, param, query } = require('express-validator');
const validate   = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

const {
  getGroups,
  getGroup,
  createGroup,
  updateGroup,
  archiveGroup,
  deleteGroup,
  getGroupMembers,
  addGroupMember,
  updateGroupMember,
  removeGroupMember,
  hardRemoveGroupMember,
  getGroupHistory,
  getMemberGroups,
  syncMemberGroups,
} = require('../controllers/groupController');

const VALID_TYPES = ['jumuiya', 'ministry', 'administrative', 'other',
                     'huduma', 'kwaya', 'idara', 'kamati'];

// ── All routes require authentication ─────────────────────────────────────────
router.use(authenticate);

// ─────────────────────────────────────────────────────────────────────────────
// Groups CRUD
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/',
  [
    query('type')
      .optional()
      .isIn(VALID_TYPES)
      .withMessage(`type must be one of: ${VALID_TYPES.join(', ')}`),
    query('types')
      .optional()
      .isString()
      .withMessage('types must be a comma-separated string'),
    query('year')
      .optional()
      .isInt({ min: 1900, max: 2200 })
      .withMessage('year must be a valid year'),
    query('is_archived')
      .optional()
      .isIn(['0', '1'])
      .withMessage('is_archived must be 0 or 1'),
  ],
  validate,
  getGroups
);

router.post(
  '/',
  authorize('pastor', 'elder'),
  [
    body('name')
      .trim().notEmpty()
      .withMessage('Group name is required'),
    body('name_sw')
      .optional({ nullable: true })
      .trim(),
    body('type')
      .isIn(VALID_TYPES)
      .withMessage(`type must be one of: ${VALID_TYPES.join(', ')}`),
    body('year')
      .optional({ nullable: true })
      .isInt({ min: 1900, max: 2200 })
      .withMessage('year must be a valid year (e.g. 2008)'),
    body('start_date')
      .optional({ nullable: true })
      .isISO8601()
      .withMessage('start_date must be YYYY-MM-DD'),
    body('end_date')
      .optional({ nullable: true })
      .isISO8601()
      .withMessage('end_date must be YYYY-MM-DD'),
    body('leader_id')
      .optional({ nullable: true })
      .isInt({ min: 1 })
      .withMessage('leader_id must be a positive integer'),
  ],
  validate,
  createGroup
);

router.get(
  '/:id',
  [param('id').isInt({ min: 1 }).withMessage('id must be a positive integer')],
  validate,
  getGroup
);

router.put(
  '/:id',
  authorize('pastor', 'elder'),
  [
    param('id').isInt({ min: 1 }).withMessage('id must be a positive integer'),
    body('type')
      .optional()
      .isIn(VALID_TYPES)
      .withMessage(`type must be one of: ${VALID_TYPES.join(', ')}`),
    body('year')
      .optional({ nullable: true })
      .isInt({ min: 1900, max: 2200 })
      .withMessage('year must be a valid year'),
    body('start_date')
      .optional({ nullable: true })
      .isISO8601()
      .withMessage('start_date must be YYYY-MM-DD'),
    body('end_date')
      .optional({ nullable: true })
      .isISO8601()
      .withMessage('end_date must be YYYY-MM-DD'),
    body('is_archived')
      .optional()
      .isBoolean()
      .withMessage('is_archived must be boolean'),
    body('leader_id')
      .optional({ nullable: true })
      .isInt({ min: 1 })
      .withMessage('leader_id must be a positive integer'),
  ],
  validate,
  updateGroup
);


// ─────────────────────────────────────────────────────────────────────────────
// Cross-member lookup & sync — must come BEFORE /:id to avoid route collision
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/member/:userId',
  [param('userId').isInt({ min: 1 }).withMessage('userId must be a positive integer')],
  validate,
  getMemberGroups
);

router.put(
  '/member/:userId/sync',
  [
    param('userId').isInt({ min: 1 }).withMessage('userId must be a positive integer'),
    body('groupIds')
      .isArray()
      .withMessage('groupIds must be an array'),
    body('groupIds.*')
      .isInt({ min: 1 })
      .withMessage('each groupId must be a positive integer'),
  ],
  validate,
  syncMemberGroups
);


router.patch(
  '/:id/archive',
  authorize('pastor', 'elder'),
  [
    param('id').isInt({ min: 1 }).withMessage('id must be a positive integer'),
    body('end_date')
      .optional({ nullable: true })
      .isISO8601()
      .withMessage('end_date must be YYYY-MM-DD'),
  ],
  validate,
  archiveGroup
);

router.delete(
  '/:id',
  authorize('pastor'),
  [param('id').isInt({ min: 1 }).withMessage('id must be a positive integer')],
  validate,
  deleteGroup
);

// ─────────────────────────────────────────────────────────────────────────────
// Group Membership
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/:id/members',
  [
    param('id').isInt({ min: 1 }).withMessage('id must be a positive integer'),
    query('year')
      .optional()
      .isInt({ min: 1900, max: 2200 })
      .withMessage('year must be a valid year'),
    query('status')
      .optional()
      .isIn(['active', 'former', 'all'])
      .withMessage('status must be active | former | all'),
  ],
  validate,
  getGroupMembers
);

router.post(
  '/:id/members',
  authorize('pastor', 'elder', 'group_leader'),
  [
    param('id').isInt({ min: 1 }).withMessage('id must be a positive integer'),
    body('user_id')
      .isInt({ min: 1 })
      .withMessage('user_id is required and must be a positive integer'),
    body('year')
      .optional({ nullable: true })
      .isInt({ min: 1900, max: 2200 })
      .withMessage('year must be a valid year (e.g. 2008)'),
    body('role_in_group')
      .optional({ nullable: true })
      .isString()
      .isLength({ max: 150 })
      .withMessage('role_in_group must be a string under 150 characters'),
    body('joined_date')
      .optional({ nullable: true })
      .isISO8601()
      .withMessage('joined_date must be YYYY-MM-DD'),
    body('notes')
      .optional({ nullable: true })
      .isString(),
  ],
  validate,
  addGroupMember
);

router.put(
  '/:id/members/:membershipId',
  authorize('pastor', 'elder', 'group_leader'),
  [
    param('id').isInt({ min: 1 }).withMessage('id must be a positive integer'),
    param('membershipId').isInt({ min: 1 }).withMessage('membershipId must be a positive integer'),
    body('year')
      .optional({ nullable: true })
      .isInt({ min: 1900, max: 2200 })
      .withMessage('year must be a valid year'),
    body('role_in_group')
      .optional({ nullable: true })
      .isString()
      .isLength({ max: 150 }),
    body('joined_date')
      .optional({ nullable: true })
      .isISO8601()
      .withMessage('joined_date must be YYYY-MM-DD'),
    body('left_date')
      .optional({ nullable: true })
      .isISO8601()
      .withMessage('left_date must be YYYY-MM-DD'),
    body('status')
      .optional()
      .isIn(['active', 'former'])
      .withMessage('status must be active or former'),
    body('notes')
      .optional({ nullable: true })
      .isString(),
  ],
  validate,
  updateGroupMember
);

// Soft-remove (→ former)
router.delete(
  '/:id/members/:membershipId',
  authorize('pastor', 'elder', 'group_leader'),
  [
    param('id').isInt({ min: 1 }),
    param('membershipId').isInt({ min: 1 }),
    body('left_date')
      .optional({ nullable: true })
      .isISO8601()
      .withMessage('left_date must be YYYY-MM-DD'),
  ],
  validate,
  removeGroupMember
);

// Hard-delete (data-entry correction only)
router.delete(
  '/:id/members/:membershipId/hard',
  authorize('pastor'),
  [
    param('id').isInt({ min: 1 }),
    param('membershipId').isInt({ min: 1 }),
  ],
  validate,
  hardRemoveGroupMember
);

// ─────────────────────────────────────────────────────────────────────────────
// History
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/:id/history',
  [param('id').isInt({ min: 1 }).withMessage('id must be a positive integer')],
  validate,
  getGroupHistory
);

module.exports = router;