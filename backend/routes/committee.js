const express  = require('express');
const router   = express.Router();
const ctrl     = require('../controllers/ministryController');
const { authenticate, authorize } = require('../middleware/auth');

const ADMINS = ['pastor', 'elder', 'group_leader'];

// GET  /api/committees
// Open to all authenticated users — needed to populate the checkbox list
// on the profile page.
router.get('/', authenticate, ctrl.getAllCommittees);

// GET  /api/committees/member/:userId
// Members read their own; admins read anyone's.
router.get('/member/:userId', authenticate, ctrl.getMemberCommittees);

// PUT  /api/committees/member/:userId/sync
// Checkbox-style sync from the ProfilePage.
// Own-record check is enforced inside the controller; admins bypass it.
router.put('/member/:userId/sync', authenticate, ctrl.syncMemberCommittees);

module.exports = router;