/**
 * routes/meetings.js
 * ───────────────────
 * Vikao na Maazimio — Meetings & Resolutions routes
 * Ref: BSS-KKKT-2026-006
 *
 * Mount in server.js:
 *   const meetingRoutes = require('./routes/meetings');
 *   app.use('/api/meetings', meetingRoutes);
 */

const express = require('express');
const multer  = require('multer');
const router  = express.Router();

const { authenticate } = require('../middleware/auth');
const c = require('../controllers/meetingsController');

// Multer — disk storage for R2 stream uploads (same pattern as r2-routes.js)
const upload = multer({ dest: 'uploads/' });

// ── Meeting Types (catalogue) ─────────────────────────────────────────────────
router.get('/types',                    authenticate, c.getMeetingTypes);

// ── Dashboard (put before /:id to avoid param collision) ─────────────────────
router.get('/dashboard/open-resolutions', authenticate, c.getOpenResolutions);
router.get('/dashboard/upcoming',         authenticate, c.getUpcomingMeetings);

// ── Meetings CRUD ─────────────────────────────────────────────────────────────
router.get('/',      authenticate, c.getMeetings);
router.post('/',     authenticate, c.createMeeting);
router.get('/:id',   authenticate, c.getMeeting);
router.put('/:id',   authenticate, c.updateMeeting);
router.delete('/:id',authenticate, c.deleteMeeting);

// ── Attendees ─────────────────────────────────────────────────────────────────
router.get('/:id/attendees',                    authenticate, c.getAttendees);
router.post('/:id/attendees',                   authenticate, c.addAttendee);
router.post('/:id/attendees/bulk',              authenticate, c.bulkSyncAttendees);
router.put('/:id/attendees/:attendanceId',      authenticate, c.updateAttendee);
router.delete('/:id/attendees/:attendanceId',   authenticate, c.removeAttendee);

// ── Resolutions (Maamuzi) ─────────────────────────────────────────────────────
router.get('/:id/resolutions',                  authenticate, c.getResolutions);
router.post('/:id/resolutions',                 authenticate, c.addResolution);
router.put('/:id/resolutions/:resolutionId',    authenticate, c.updateResolution);
router.delete('/:id/resolutions/:resolutionId', authenticate, c.deleteResolution);

// ── Documents (PDF / file uploads via R2) ─────────────────────────────────────
router.get('/:id/documents',                    authenticate, c.getDocuments);
router.post('/:id/documents',
  authenticate,
  upload.single('file'),       // field name: 'file'
  c.uploadDocument
);
router.delete('/:id/documents/:documentId',     authenticate, c.deleteDocument);

module.exports = router;