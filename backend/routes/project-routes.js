/**
 * projectRoutes.js
 * ─────────────────
 * Routes: Miradi ya Usharika (Church Projects Module)
 * Ref: BSS-KKKT-2026-008
 *
 * Mount point (app.js):
 *   app.use('/api/projects', projectRoutes);
 *
 * Auth middleware assumed to be:
 *   authenticate  — verifies JWT, sets req.user
 *   authorize()   — role-based guard
 *
 * Role convention (matches authController.js pattern):
 *   'pastor'       — full access including DELETE and confidential docs
 *   'elder'        — full access including DELETE and confidential docs
 *   'group_leader' — read + create + update; no DELETE
 *   'member'       — read-only
 */

'use strict';

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/projectsController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require a valid JWT
router.use(authenticate);

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD SUMMARY
// Must be declared before /:id to avoid "summary" being matched as an id param.
// ─────────────────────────────────────────────────────────────────────────────

// GET  /api/projects/summary
router.get('/summary', authorize('pastor', 'elder', 'group_leader', 'member'), controller.getSummary);


// ═══════════════════════════════════════════════════════════════════════════════
// §9 — LAND ASSETS  /api/projects/land-assets
// Also declared before /:id to prevent route collision.
// ═══════════════════════════════════════════════════════════════════════════════

// GET  /api/projects/land-assets
router.get(
  '/land-assets',
  authorize('pastor', 'elder', 'group_leader', 'member'),
  controller.listLandAssets
);

// POST /api/projects/land-assets
router.post(
  '/land-assets',
  authorize('pastor', 'elder'),
  controller.createLandAsset
);

// GET  /api/projects/land-assets/:id
router.get(
  '/land-assets/:id',
  authorize('pastor', 'elder', 'group_leader', 'member'),
  controller.getLandAsset
);

// PATCH /api/projects/land-assets/:id
router.patch(
  '/land-assets/:id',
  authorize('pastor', 'elder'),
  controller.updateLandAsset
);

// POST  /api/projects/land-assets/:id/documents
router.post(
  '/land-assets/:id/documents',
  authorize('pastor', 'elder'),
  controller.addLandAssetDocument
);

// DELETE /api/projects/land-assets/:id/documents/:docId
router.delete(
  '/land-assets/:id/documents/:docId',
  authorize('pastor', 'elder'),
  controller.deleteLandAssetDocument
);


// ═══════════════════════════════════════════════════════════════════════════════
// §13 — PROJECTS  /api/projects
// ═══════════════════════════════════════════════════════════════════════════════

// GET  /api/projects
router.get(
  '/',
  authorize('pastor', 'elder', 'group_leader', 'member'),
  controller.listProjects
);

// POST /api/projects
router.post(
  '/',
  authorize('pastor', 'elder', 'group_leader'),
  controller.createProject
);

// GET  /api/projects/:id
router.get(
  '/:id',
  authorize('pastor', 'elder', 'group_leader', 'member'),
  controller.getProject
);

// PATCH /api/projects/:id
router.patch(
  '/:id',
  authorize('pastor', 'elder', 'group_leader'),
  controller.updateProject
);

// DELETE /api/projects/:id  — pastor/elder only
router.delete(
  '/:id',
  authorize('pastor', 'elder'),
  controller.deleteProject
);


// ═══════════════════════════════════════════════════════════════════════════════
// §10 — CONTRACTS  /api/projects/:projectId/contracts
// ═══════════════════════════════════════════════════════════════════════════════

// GET  /api/projects/:projectId/contracts
router.get(
  '/:projectId/contracts',
  authorize('pastor', 'elder', 'group_leader', 'member'),
  controller.listContracts
);

// POST /api/projects/:projectId/contracts
router.post(
  '/:projectId/contracts',
  authorize('pastor', 'elder', 'group_leader'),
  controller.createContract
);

// GET  /api/projects/:projectId/contracts/:contractId
router.get(
  '/:projectId/contracts/:contractId',
  authorize('pastor', 'elder', 'group_leader', 'member'),
  controller.getContract
);

// PATCH /api/projects/:projectId/contracts/:contractId
router.patch(
  '/:projectId/contracts/:contractId',
  authorize('pastor', 'elder', 'group_leader'),
  controller.updateContract
);

// DELETE /api/projects/:projectId/contracts/:contractId — pastor/elder only
router.delete(
  '/:projectId/contracts/:contractId',
  authorize('pastor', 'elder'),
  controller.deleteContract
);


// ─── CONTRACT VARIATIONS ─────────────────────────────────────────────────────

// GET  /api/projects/:projectId/contracts/:contractId/variations
router.get(
  '/:projectId/contracts/:contractId/variations',
  authorize('pastor', 'elder', 'group_leader', 'member'),
  controller.listVariations
);

// POST /api/projects/:projectId/contracts/:contractId/variations
router.post(
  '/:projectId/contracts/:contractId/variations',
  authorize('pastor', 'elder', 'group_leader'),
  controller.createVariation
);

// PATCH /api/projects/:projectId/contracts/:contractId/variations/:variationId
router.patch(
  '/:projectId/contracts/:contractId/variations/:variationId',
  authorize('pastor', 'elder'),
  controller.updateVariation
);


// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENTS  /api/projects/:projectId/payments
// ═══════════════════════════════════════════════════════════════════════════════

// GET  /api/projects/:projectId/payments
router.get(
  '/:projectId/payments',
  authorize('pastor', 'elder', 'group_leader', 'member'),
  controller.listPayments
);

// POST /api/projects/:projectId/payments
router.post(
  '/:projectId/payments',
  authorize('pastor', 'elder', 'group_leader'),
  controller.createPayment
);

// PATCH /api/projects/:projectId/payments/:paymentId
router.patch(
  '/:projectId/payments/:paymentId',
  authorize('pastor', 'elder'),
  controller.updatePayment
);

// DELETE /api/projects/:projectId/payments/:paymentId — pastor/elder only
router.delete(
  '/:projectId/payments/:paymentId',
  authorize('pastor', 'elder'),
  controller.deletePayment
);


// ═══════════════════════════════════════════════════════════════════════════════
// DOCUMENTS  /api/projects/:projectId/documents
// ═══════════════════════════════════════════════════════════════════════════════

// GET  /api/projects/:projectId/documents
// Controller handles confidential filtering internally based on req.user.role
router.get(
  '/:projectId/documents',
  authorize('pastor', 'elder', 'group_leader', 'member'),
  controller.listDocuments
);

// POST /api/projects/:projectId/documents
router.post(
  '/:projectId/documents',
  authorize('pastor', 'elder', 'group_leader'),
  controller.addDocument
);

// DELETE /api/projects/:projectId/documents/:documentId — pastor/elder only
router.delete(
  '/:projectId/documents/:documentId',
  authorize('pastor', 'elder'),
  controller.deleteDocument
);


// ═══════════════════════════════════════════════════════════════════════════════
// PHOTOS  /api/projects/:projectId/photos
// ═══════════════════════════════════════════════════════════════════════════════

// GET  /api/projects/:projectId/photos
router.get(
  '/:projectId/photos',
  authorize('pastor', 'elder', 'group_leader', 'member'),
  controller.listPhotos
);

// POST /api/projects/:projectId/photos
router.post(
  '/:projectId/photos',
  authorize('pastor', 'elder', 'group_leader'),
  controller.addPhoto
);

// PATCH /api/projects/:projectId/photos/:photoId
router.patch(
  '/:projectId/photos/:photoId',
  authorize('pastor', 'elder', 'group_leader'),
  controller.updatePhoto
);

// DELETE /api/projects/:projectId/photos/:photoId — pastor/elder only
router.delete(
  '/:projectId/photos/:photoId',
  authorize('pastor', 'elder'),
  controller.deletePhoto
);


module.exports = router;