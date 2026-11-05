// routes/auth.js
const router   = require('express').Router();
const { body, query } = require('express-validator');

const { authenticate, authorize } = require('../middleware/auth');
const validate                    = require('../middleware/validate');

const {
  register,
  login,
  me,
  approveUser,
  rejectUser,
  getPendingUsers,
  adminCreateUser,
  adminBulkCreateUsers,
  getMembers,
} = require('../controllers/authController');

const { requestOTP, verifyOTP, resetPassword }       = require('../controllers/forgotPasswordController');
const { sendVerificationOTP, verifyEmailOTP }         = require('../controllers/emailVerificationController');

// ── Email verification (pre-registration) ────────────────
router.post('/send-verification-otp', [
  body('email').isEmail().withMessage('Valid email is required.'),
], validate, sendVerificationOTP);

router.post('/verify-email-otp', [
  body('email').isEmail().withMessage('Valid email is required.'),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits.'),
], validate, verifyEmailOTP);

// ── Public ────────────────────────────────────────────────
router.post('/register', [
  body('full_name').trim().notEmpty().withMessage('Full name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['pastor','elder','group_leader','member']).withMessage('Invalid role'),
], validate, register);

router.post('/login', [
  body('identifier').notEmpty().withMessage('Identifier and password are required.'),
  body('password').notEmpty().withMessage('Identifier and password are required.'),
], validate, login);

// ── Password reset ────────────────────────────────────────
router.post('/forgot-password', [
  body('identifier').notEmpty().withMessage('Identifier is required.'),
], validate, requestOTP);

router.post('/verify-otp', [
  body('identifier').notEmpty().withMessage('Identifier is required.'),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits.'),
], validate, verifyOTP);

router.post('/reset-password', [
  body('resetToken').notEmpty().withMessage('Reset token is required.'),
  body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters.'),
], validate, resetPassword);


// ── Admin direct-add — pastor / elder only ────────────────
router.post(
  '/admin-create',
  authenticate,
  authorize('pastor', 'elder'),
  [
    body('full_name')
      .trim().notEmpty()
      .withMessage('Full name is required.'),

    body('email')
      .optional({ checkFalsy: true })
      .isEmail()
      .withMessage('Invalid email address.'),

    body('phone')
      .optional({ checkFalsy: true })
      .trim(),

    body('ahadi_number')
      .optional({ checkFalsy: true })
      .trim(),

    body('role')
      .optional()
      .isIn(['pastor', 'elder', 'group_leader', 'member'])
      .withMessage('Invalid role.'),

    body('password')
      .optional()
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters.'),
  ],
  validate,
  adminCreateUser
);

// ── Admin bulk-create — pastor / elder only ───────────────
router.post(
  '/admin-bulk-create',
  authenticate,
  authorize('pastor', 'elder'),
  [
    body('users')
      .isArray({ min: 1, max: 1200 })
      .withMessage('users must be an array of 1–1200 items.'),

    body('users.*.full_name')
      .trim().notEmpty()
      .withMessage('Each row must have a full_name.'),

    body('users.*.email')
      .optional({ checkFalsy: true })
      .isEmail()
      .withMessage('Invalid email in row.'),

    body('users.*.ahadi_number')
      .optional({ checkFalsy: true })
      .trim(),

    body('users.*.role')
      .optional()
      .isIn(['pastor', 'elder', 'group_leader', 'member'])
      .withMessage('Invalid role in row.'),

    body('users.*.password')
      .optional()
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters.'),
  ],
  validate,
  adminBulkCreateUsers
);

// ── Get members — pastor / elder only ────────────────────
router.get(
  '/members',
  authenticate,
  authorize('pastor', 'elder'),
  [
    query('sortBy')
      .optional()
      .isIn([
        'full_name', 'jumuiya', 'gender', 'marital_status',
        'occupation', 'created_at', 'member_since', 'date_of_birth',
      ])
      .withMessage('Invalid sortBy field.'),

    query('order')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('order must be asc or desc.'),

    query('ministry')
      .optional({ checkFalsy: true })
      .isInt({ min: 1 })
      .withMessage('ministry must be a valid ID.'),

    query('group_id')
      .optional({ checkFalsy: true })
      .isInt({ min: 1 })
      .withMessage('group_id must be a valid ID.'),

    query('gender')
      .optional({ checkFalsy: true })
      .isIn(['Male', 'Female'])
      .withMessage('gender must be Male or Female.'),

    query('member_status')
      .optional({ checkFalsy: true })
      .isIn(['hai', 'amehamia', 'amefariki'])
      .withMessage('Invalid member_status.'),

    query('marital_status')
      .optional({ checkFalsy: true })
      .isIn([
        'Ameoa', 'Hajaoa', 'Ameolewa', 'Hajaolewa',
        'Mjane', 'Mgane', 'Talikiwa', 'Tengana',
      ])
      .withMessage('Invalid marital_status.'),

    query('page')
      .optional({ checkFalsy: true })
      .isInt({ min: 1 })
      .withMessage('page must be a positive integer.'),

    query('limit')
      .optional({ checkFalsy: true })
      .isInt({ min: 1, max: 200 })
      .withMessage('limit must be between 1 and 200.'),

    query('search')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('search must be under 100 characters.'),

    query('jumuiya')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('jumuiya must be under 100 characters.'),
  ],
  validate,
  getMembers
);


// ── Authenticated ─────────────────────────────────────────
router.get('/me', authenticate, me);

// ── Member approval — pastor or elder only ────────────────
router.get('/pending', authenticate, authorize('pastor', 'elder'), getPendingUsers);

router.patch('/approve/:id', authenticate, authorize('pastor', 'elder'), approveUser);

router.patch('/reject/:id',
  authenticate, authorize('pastor', 'elder'),
  [body('reason').optional().trim()],
  validate,
  rejectUser
);

module.exports = router;