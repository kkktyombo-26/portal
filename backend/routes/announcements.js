const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getAnnouncements, createAnnouncement, deleteAnnouncement } = require('../controllers/announcementController');
const { body } = require('express-validator');
const validate = require('../middleware/validate');

router.use(authenticate);
router.get('/', getAnnouncements);
router.post('/', [
  body('title_en').trim().notEmpty().withMessage('English title is required'),
  body('title_sw').trim().notEmpty().withMessage('Swahili title is required'),
  body('body_en').trim().notEmpty().withMessage('English body is required'),
  body('body_sw').trim().notEmpty().withMessage('Swahili body is required'),
], validate, authorize('pastor', 'elder', 'group_leader'), createAnnouncement);
router.delete('/:id', deleteAnnouncement);

module.exports = router;
