// routes/auth.js
const router   = require('express').Router();
const { body } = require('express-validator');

const { authenticate, authorize } = require('../middleware/auth');
const validate                    = require('../middleware/validate');

const { register, login, me, approveUser, rejectUser, getPendingUsers } = require('../controllers/authController');
const { requestOTP, verifyOTP, resetPassword }                          = require('../controllers/forgotPasswordController');
const { sendVerificationOTP, verifyEmailOTP }                           = require('../controllers/emailVerificationController');

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