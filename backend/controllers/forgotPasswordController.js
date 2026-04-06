const bcrypt  = require('bcryptjs');
const crypto  = require('crypto');
const db      = require('../config/db');
const { sendOTP } = require('../services/emailService');

// ─── generate 6-digit OTP ────────────────────────────────
function generateOTP() {
  return String(crypto.randomInt(100000, 999999));
}

// ═══════════════════════════════════════════════════════════
// POST /api/auth/forgot-password
// Body: { identifier }  — email | phone | namba_ya_usharika
// ═══════════════════════════════════════════════════════════
exports.requestOTP = async (req, res, next) => {
  try {
    const { identifier } = req.body;
    if (!identifier) {
      return res.status(400).json({ success: false, message: 'Identifier is required.' });
    }

    // Find user by any of the three identifier fields
    const [rows] = await db.execute(
      `SELECT id, full_name, email FROM users
       WHERE email = ? OR phone = ? OR namba_ya_usharika = ?`,
      [identifier, identifier, identifier]
    );

  // When no user found — return sent: false instead of advancing
if (rows.length === 0) {
  return res.json({ 
    success: true, 
    sent: false,           // ← new field
    message: 'If an account exists, an OTP has been sent.' 
  });
}

    const user = rows[0];

    console.log('we got user', user);

    // Invalidate any existing unused OTPs for this user
    await db.execute(
      `UPDATE password_reset_otps SET used = 1 WHERE user_id = ? AND used = 0`,
      [user.id]
    );

    // Generate and store new OTP (expires in 10 minutes)
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');

    await db.execute(
      `INSERT INTO password_reset_otps (user_id, otp, expires_at) VALUES (?, ?, ?)`,
      [user.id, otp, expiresAt]
    );

    // Send OTP email
    await sendOTP(user.email, otp, 'reset_password', 10)

    res.json({ success: true, message: 'If an account exists, an OTP has been sent.' });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════
// POST /api/auth/verify-otp
// Body: { identifier, otp }
// Returns a short-lived reset token on success
// ═══════════════════════════════════════════════════════════
exports.verifyOTP = async (req, res, next) => {
  try {
    const { identifier, otp } = req.body;
    if (!identifier || !otp) {
      console.log('Missing identifier or OTP', { identifier, otp });
      return res.status(400).json({ success: false, message: 'Identifier and OTP are required.' });
    }

    // Find user
    const [users] = await db.execute(
      `SELECT id FROM users WHERE email = ? OR phone = ? OR namba_ya_usharika = ?`,
      [identifier, identifier, identifier]
    );
    if (users.length === 0) {
      console.log('User not found', { identifier });
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    } 

    const userId = users[0].id;

    // Find valid OTP
    const [otpRows] = await db.execute(
      `SELECT id FROM password_reset_otps
       WHERE user_id = ? AND otp = ? AND used = 0 AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [userId, otp]
    );

    if (otpRows.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    }

    // Mark OTP as used
    await db.execute(
      `UPDATE password_reset_otps SET used = 1 WHERE id = ?`,
      [otpRows[0].id]
    );

    // Issue a short-lived reset token (store in DB, valid 15 min)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date(Date.now() + 15 * 60 * 1000)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');

    await db.execute(
      `UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?`,
      [resetToken, tokenExpiry, userId]
    );
console.log('OTP verified, reset token issued', { userId, resetToken, tokenExpiry });
    res.json({ success: true, resetToken });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════
// POST /api/auth/reset-password
// Body: { resetToken, newPassword }
// ═══════════════════════════════════════════════════════════
exports.resetPassword = async (req, res, next) => {
  try {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) {
      return res.status(400).json({ success: false, message: 'Reset token and new password are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    // Find user by valid reset token
    const [rows] = await db.execute(
      `SELECT id FROM users
       WHERE reset_token = ? AND reset_token_expires > NOW()`,
      [resetToken]
    );

    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Reset token is invalid or has expired.' });
    }

    const userId = rows[0].id;
    const hashed = await bcrypt.hash(newPassword, 12);

    // Update password and clear the reset token
    await db.execute(
      `UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?`,
      [hashed, userId]
    );

    res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
  } catch (err) { next(err); }
};