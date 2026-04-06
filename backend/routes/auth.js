const router = require('express').Router();
const { body } = require('express-validator');
const { register, login, me } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');

const {
  requestOTP,
  verifyOTP,
  resetPassword,
} = require('../controllers/forgotPasswordController');


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

router.get('/me', authenticate, me);

module.exports = router;
