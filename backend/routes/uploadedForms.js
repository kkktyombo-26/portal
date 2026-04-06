// routes/uploadedForms.js
const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getUploadedForms,
  getUploadedForm,
  createUploadedForm,
  updateUploadedForm,
  deleteUploadedForm,
} = require('../controllers/uploadedFormController');

router.use(authenticate);

router.get('/',    getUploadedForms);
router.get('/:id', getUploadedForm);

router.post('/',    authorize('pastor', 'elder'), createUploadedForm);
router.put('/:id',  authorize('pastor', 'elder'), updateUploadedForm);
router.delete('/:id', authorize('pastor'),        deleteUploadedForm);

module.exports = router;