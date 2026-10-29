// routes/siteContent.js
// Mount in server.js / app.js:
//   const siteContentRoutes = require('./routes/siteContent');
//   app.use('/api/site-content', siteContentRoutes);

const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const {
  getAllContent,
  getContent,
  upsertContent,
  deleteContent,
} = require('../controllers/siteContentController');

// ── Public reads ──────────────────────────────────────────────────────────────
router.get('/', getAllContent);
router.get('/:key', getContent);

// ── Protected writes — pastor or elder only ───────────────────────────────────
router.put(
  '/:key',
  authenticate,
  authorize('pastor', 'elder'),
  // Body must be a non-null object or array (any valid JSON)
  body().custom(val => {
    if (val === null || (typeof val !== 'object' && !Array.isArray(val))) {
      throw new Error('Body must be a JSON object or array.');
    }
    return true;
  }),
  validate,
  upsertContent
);

// ── Pastor-only delete (reset to hardcoded default) ───────────────────────────
router.delete(
  '/:key',
  authenticate,
  authorize('pastor'),
  deleteContent
);

module.exports = router;