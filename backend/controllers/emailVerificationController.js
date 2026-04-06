// controllers/emailVerificationController.js
const crypto = require('crypto');
const db     = require('../config/db');
const { sendOTP } = require('../services/emailService');

function generateOTP() {
  return String(crypto.randomInt(100000, 999999));
}

// ═══════════════════════════════════════════════════════════
// POST /api/auth/send-verification-otp
// Body: { email }
// Generates a 6-digit OTP, stores it in password_reset_otps
// (reusing the same table — purpose column distinguishes it),
// and emails it to the address.
// ═══════════════════════════════════════════════════════════
exports.sendVerificationOTP = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    // Reject if the email is already registered and active
    const [existing] = await db.execute(
      'SELECT id, is_active FROM users WHERE email = ?',
      [email]
    );
    if (existing.length > 0 && existing[0].is_active) {
      return res.status(409).json({
        success: false,
        code: 'EMAIL_TAKEN',
        message: 'This email is already registered.',
      });
    }

    // Invalidate any previous unused verification OTPs for this email
    await db.execute(
      `UPDATE email_verification_otps
          SET used = 1
        WHERE email = ? AND used = 0`,
      [email]
    );

    // Generate and persist new OTP (10-minute window)
    const otp       = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
      .toISOString().slice(0, 19).replace('T', ' ');

    await db.execute(
      `INSERT INTO email_verification_otps (email, otp, expires_at) VALUES (?, ?, ?)`,
      [email, otp, expiresAt]
    );

    // Fire the email (reuse existing sendOTP with 'verify_email' purpose)
    await sendOTP(email, otp, 'verify_email', 10);

    res.json({ success: true, message: 'Verification OTP sent.' });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════
// POST /api/auth/verify-email-otp
// Body: { email, otp }
// Returns a short-lived verifiedToken the register endpoint
// will require, so the OTP cannot be skipped.
// ═══════════════════════════════════════════════════════════
exports.verifyEmailOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required.' });
    }

    // Find a valid, unused OTP for this email
    const [rows] = await db.execute(
      `SELECT id FROM email_verification_otps
        WHERE email = ? AND otp = ? AND used = 0 AND expires_at > NOW()
        ORDER BY created_at DESC LIMIT 1`,
      [email, otp]
    );

    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    }

    // Mark OTP consumed
    await db.execute(
      'UPDATE email_verification_otps SET used = 1 WHERE id = ?',
      [rows[0].id]
    );

    // Issue a 15-minute verification token that register will validate
    const verifiedToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry   = new Date(Date.now() + 15 * 60 * 1000)
      .toISOString().slice(0, 19).replace('T', ' ');

    // Store against the email row so register can cross-check it
    await db.execute(
      `UPDATE email_verification_otps
          SET verified_token = ?, token_expires_at = ?
        WHERE id = ?`,
      [verifiedToken, tokenExpiry, rows[0].id]
    );

    res.json({ success: true, verifiedToken });
  } catch (err) { next(err); }
};