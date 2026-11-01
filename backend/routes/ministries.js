// routes/ministries.js

const router = require('express').Router();
const { body, param } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  getAll,
  getMemberMinistries,
  syncMemberMinistries,
} = require('../controllers/ministryController');

// ── GET /api/ministries
// Public to all authenticated users — used to populate the
// Spiritual tab checkboxes.
router.get('/', authenticate, getAll);

// ── GET /api/ministries/member/:userId
// Returns the ministry IDs a specific member belongs to.
router.get(
  '/member/:userId',
  authenticate,
  [param('userId').isInt({ min: 1 }).withMessage('Invalid userId.')],
  validate,
  getMemberMinistries
);

// ── PUT /api/ministries/member/:userId/sync
// Replace a member's full ministry membership set.
// Members can sync their own; pastors/elders/group_leaders can sync anyone's.
router.put(
  '/member/:userId/sync',
  authenticate,
  [
    param('userId').isInt({ min: 1 }).withMessage('Invalid userId.'),
    body('ministryIds').isArray().withMessage('ministryIds must be an array.'),
    body('ministryIds.*').isInt({ min: 1 }).withMessage('Each ministryId must be a positive integer.'),
  ],
  validate,
  syncMemberMinistries
);

module.exports = router;