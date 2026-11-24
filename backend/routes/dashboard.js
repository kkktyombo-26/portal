
// routes/dashboard.js
const express = require('express');
const router  = express.Router();

const { authenticate }      = require('../middleware/auth');
const { getSidebarCounts }  = require('../controllers/dashboardController');

// GET /api/dashboard/counts
// Badge numbers for the sidebar. Every authenticated role may call it; the
// controller decides which counts that role is entitled to receive.
router.get('/counts', authenticate, getSidebarCounts);

module.exports = router;