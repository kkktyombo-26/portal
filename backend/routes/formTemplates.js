// routes/formTemplates.js
const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} = require('../controllers/formController');

router.use(authenticate);

// All authenticated users can list / fetch templates (visibility filtered in controller)
router.get('/',    getTemplates);
router.get('/:id', getTemplate);

// Only pastor & elder can create / edit
router.post('/',    authorize('pastor', 'elder'), createTemplate);
router.put('/:id',  authorize('pastor', 'elder'), updateTemplate);

// Only pastor can hard-delete (soft-delete in controller)
router.delete('/:id', authorize('pastor'), deleteTemplate);

module.exports = router;