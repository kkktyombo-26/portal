/**
 * routes/phoneLogin.js
 * ─────────────────────
 * Phone-number OTP login routes (NextSMS).
 *
 * Mounted at /api/auth in server.js, so the final URLs are:
 *   POST /api/auth/phone-login/request   ← send OTP
 *   POST /api/auth/phone-login/verify    ← verify OTP + get JWT
 */

const express    = require('express');
const rateLimit  = require('express-rate-limit');
const { requestPhoneOTP, verifyPhoneOTP } = require('../controllers/phoneLoginController');

const router = express.Router();

// ── IP-level rate limiter (last line of defence) ──────────────────────────────
// Max 10 requests per IP per 15 minutes across both endpoints.
// The controller adds a tighter per-phone limit on top of this.
const otpLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,  // 15 minutes
  max:              10,
  standardHeaders:  true,
  legacyHeaders:    false,
  message: {
    success: false,
    message: 'Maombi mengi sana kutoka kwa anwani hii. Jaribu tena baadaye.',
  },
});

// POST /api/auth/phone-login/request
router.post('/phone-login/request', otpLimiter, requestPhoneOTP);

// POST /api/auth/phone-login/verify
router.post('/phone-login/verify',  otpLimiter, verifyPhoneOTP);

module.exports = router;