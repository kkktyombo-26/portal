const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getEvents, createEvent, updateEvent, deleteEvent } = require('../controllers/eventController');
const { body } = require('express-validator');
const validate = require('../middleware/validate');

router.use(authenticate);

router.get('/', getEvents);

router.post('/', [
  body('title_en').trim().notEmpty().withMessage('English title is required'),
  body('title_sw').trim().notEmpty().withMessage('Swahili title is required'),
  body('event_date').isDate().withMessage('Valid date is required (YYYY-MM-DD)'),
  body('start_time').notEmpty().withMessage('Start time is required'),
], validate, authorize('pastor', 'elder'), createEvent);

router.put('/:id', authorize('pastor', 'elder'), updateEvent);

router.delete('/:id', authorize('pastor', 'elder'), deleteEvent);

module.exports = router;
