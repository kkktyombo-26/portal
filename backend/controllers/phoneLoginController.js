/**
 * controllers/phoneLoginController.js
 * ─────────────────────────────────────
 * Passwordless phone-number OTP login via NextSMS.
 *
 * Because NextSMS is a plain SMS gateway (not a verify service),
 * we manage OTP generation, hashing, expiry and attempt-counting
 * ourselves using the phone_login_otps table.
 *
 * Flow:
 *   POST /api/auth/phone-login/request
 *     1. Normalise phone to 255XXXXXXXXX (NextSMS format)
 *     2. Check phone exists in users (is_active = 1)
 *        — queries all stored formats simultaneously
 *     3. Rate-limit: max 3 OTP requests per phone per 10 minutes
 *     4. Invalidate any previous unused OTPs
 *     5. Generate 6-digit OTP, bcrypt-hash and store it
 *     6. Generate a plain-text password, bcrypt-hash and save to users.password
 *     7. Send a single SMS containing both the OTP and the new password
 *
 *   POST /api/auth/phone-login/verify
 *     1. Fetch latest unused, unexpired OTP for the phone
 *     2. Check attempt count (max 5)
 *     3. bcrypt.compare the submitted code
 *     4. Mark OTP used, fetch user, issue JWT
 *
 * Security:
 *   • OTP stored as bcrypt hash — never plain text
 *   • 5-minute OTP expiry
 *   • Max 5 wrong attempts before OTP invalidated
 *   • Max 3 OTP requests per phone per 10 minutes
 *   • IP-level rate limiting at the route layer (express-rate-limit)
 *   • Password stored as bcrypt hash — plain text only appears in SMS
 *
 * Supported input formats (all resolve to 255XXXXXXXXX internally):
 *   +255 617 833 806   → 255617833806
 *   +255617833806      → 255617833806
 *   255 617 833 806    → 255617833806
 *   255617833806       → 255617833806
 *   0617833806         → 255617833806
 *   0617 833 806       → 255617833806
 *   617833806          → 255617833806
 */

const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const db     = require('../config/db');
const { sendSMS } = require('../services/smsService');

// ── Constants ─────────────────────────────────────────────────────────────────
const OTP_LENGTH      = 6;
const OTP_TTL_MINUTES = 5;
const MAX_ATTEMPTS    = 5;
const MAX_REQUESTS    = 3;      // per phone per 10 minutes
const REQUEST_WINDOW  = 10;     // minutes
const LOGIN_URL       = 'www.kkktdmpyombo.org/auth/login';

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateOTP() {
  // Cryptographically random 6-digit number, zero-padded
  return String(crypto.randomInt(0, 1_000_000)).padStart(OTP_LENGTH, '0');
}

/**
 * generatePassword
 * ────────────────
 * Produces a memorable but reasonably secure 10-character password.
 * Character set deliberately avoids visually ambiguous characters
 * (0/O, 1/l/I) so the SMS recipient can type it accurately.
 *
 * Example output: "mK4#vP9!rX"
 */
function generatePassword() {
  const lower   = 'abcdefghjkmnpqrstuvwxyz';
  const upper   = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const digits  = '23456789';
  const symbols = '!@#';

  // Guarantee at least one of each class, then fill the rest randomly
  const all = lower + upper + digits + symbols;
  const pick = (set) => set[crypto.randomInt(0, set.length)];

  const chars = [
    pick(lower),
    pick(upper),
    pick(digits),
    pick(symbols),
    // Remaining 6 chars from the full set
    ...Array.from({ length: 6 }, () => pick(all)),
  ];

  // Shuffle so the guaranteed chars aren't always in fixed positions
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}

function generateToken(user) {
  return jwt.sign(
    {
      id:      user.id,
      role:    user.role,
      name:    user.full_name,
      groupId: user.group_id,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

/**
 * normalisePhone
 * ──────────────
 * Strips all whitespace, dashes, parentheses, then converts any
 * Tanzanian phone format to the canonical 255XXXXXXXXX form used
 * by NextSMS and stored in the database.
 *
 * Handled patterns:
 *   +255 617 833 806  →  255617833806
 *   +255617833806     →  255617833806
 *   255 617 833 806   →  255617833806
 *   255617833806      →  255617833806
 *   0617 833 806      →  255617833806
 *   0617833806        →  255617833806
 *   617833806         →  255617833806   (bare 9-digit)
 */
function normalisePhone(raw) {
  if (!raw) return null;

  // Remove ALL spaces, dashes, parentheses, dots
  let p = String(raw).replace(/[\s\-().]/g, '');

  if (p.startsWith('+255')) return p.slice(1);         // +255... → 255...
  if (p.startsWith('255'))  return p;                  // already canonical
  if (p.startsWith('0'))    return '255' + p.slice(1); // 07... → 2557...
  if (p.length === 9)       return '255' + p;          // bare 9-digit
  return '255' + p;                                    // last-resort prefix
}

/**
 * phoneVariants
 * ─────────────
 * Returns every format the same number might be stored as in the DB.
 * This handles legacy data where numbers were saved in different formats
 * before normalisation was enforced.
 *
 * Example for 255617833806:
 *   ['255617833806', '+255617833806', '0617833806', '617833806']
 */
function phoneVariants(canonical) {
  // canonical is always 255XXXXXXXXX (12 digits)
  const local    = canonical.slice(3);          // 9-digit: 617833806
  const withZero = '0' + local;                 // 0617833806
  const withPlus = '+' + canonical;             // +255617833806

  return [canonical, withPlus, withZero, local];
}


// ═══════════════════════════════════════════════════════════════════════════
// POST /api/auth/phone-login/request
// ═══════════════════════════════════════════════════════════════════════════
exports.requestPhoneOTP = async (req, res, next) => {
  try {
    const rawPhone = req.body.phone;

    if (!rawPhone) {
      console.warn('[PhoneOTP] Request missing phone number');
      return res.status(400).json({
        success: false,
        message: 'Phone number is required. / Nambari ya simu inahitajika.',
      });
    }

    const phone    = normalisePhone(rawPhone);
    const variants = phoneVariants(phone);

    // ── 1. Look up user — match against all stored formats ───────────────────
    // Build  WHERE phone IN (?, ?, ?, ?)  dynamically
    const placeholders = variants.map(() => '?').join(', ');

    const [rows] = await db.execute(
      `SELECT id, full_name, phone, is_active
       FROM   users
       WHERE  phone IN (${placeholders})
       LIMIT  1`,
      variants
    );

    if (rows.length === 0 || !rows[0].is_active) {
      console.log(`[PhoneOTP] Request for unknown/inactive phone: ${phone} (variants: ${variants.join(', ')})`);
      return res.status(404).json({
        success: false,
        code:    'PHONE_NOT_FOUND',
        message:
          'Nambari hii haijasajiliwa. Tafadhali wasiliana na ofisi ya parokia kupata usaidizi. ' +
          '/ This number is not registered. Please contact the parish office for assistance.',
      });
    }

    const user = rows[0];

    // Use the canonical form of the phone as stored in DB for all subsequent
    // operations so OTP table rows stay consistent regardless of input format
    const canonicalPhone = normalisePhone(user.phone);

    // ── 2. Rate-limit: max 3 OTP requests per phone per 10 minutes ──────────
    const [[{ recentCount }]] = await db.execute(
      `SELECT COUNT(*) AS recentCount
       FROM   phone_login_otps
       WHERE  phone      = ?
         AND  created_at > DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
      [canonicalPhone, REQUEST_WINDOW]
    );

    if (recentCount >= MAX_REQUESTS) {
      console.log(`[PhoneOTP] Rate limit exceeded for phone: ${canonicalPhone}`);
      return res.status(429).json({
        success: false,
        code:    'RATE_LIMITED',
        message:
          `Ombi nyingi sana. Tafadhali subiri dakika ${REQUEST_WINDOW} kisha jaribu tena. ` +
          `/ Too many requests. Please wait ${REQUEST_WINDOW} minutes and try again.`,
      });
    }

    // ── 3. Invalidate all previous unused OTPs for this phone ───────────────
    await db.execute(
      `UPDATE phone_login_otps SET used = 1 WHERE phone = ? AND used = 0`,
      [canonicalPhone]
    );

    // ── 4. Generate, hash and store OTP ─────────────────────────────────────
    const otp       = generateOTP();
    const otpHash   = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    await db.execute(
      `INSERT INTO phone_login_otps (phone, otp_hash, expires_at)
       VALUES (?, ?, ?)`,
      [canonicalPhone, otpHash, expiresAt]
    );

    // ── 5. Generate a new plain-text password, hash it, save to users ────────
    // A fresh password is issued every time an OTP is requested.
    // The plain text is included in the SMS below and never stored.
    const plainPassword  = generatePassword();
    const hashedPassword = await bcrypt.hash(plainPassword, 12);

    await db.execute(
      `UPDATE users SET password = ? WHERE id = ?`,
      [hashedPassword, user.id]
    );

    // ── 6. Build Swahili SMS containing OTP + login credentials ──────────────
    const firstName = user.full_name.split(' ')[0];

    const message =
      `Habari ${firstName},\n` +
      `Nambari yako ya uthibitisho (OTP): ${otp}\n` +
      `Inaisha baada ya dakika ${OTP_TTL_MINUTES}.\n\n` +
      `Unaweza pia kuingia kwa nambari yako ya simu na nenosiri hili:\n` +
      `Simu: ${canonicalPhone}\n` +
      `Nenosiri: ${plainPassword}\n` +
      `Tovuti: ${LOGIN_URL}\n\n` +
      `Usimwambie mtu yeyote nenosiri hili.`;

    // ── 7. Send via NextSMS ──────────────────────────────────────────────────
    await sendSMS(canonicalPhone, message);

    console.log(`[PhoneOTP] OTP + password sent → userId=${user.id} phone=${canonicalPhone}`);

    return res.json({
      success: true,
      message:
        'OTP na nenosiri vimetumwa kwa nambari yako ya simu. OTP itaisha baada ya dakika 5. ' +
        '/ OTP and password sent to your phone number. OTP expires in 5 minutes.',
    });

  } catch (err) {

    // Surface NextSMS delivery errors cleanly (don't leak internals)
    if (err.message?.startsWith('NextSMS')) {
      console.log(`[PhoneOTP] SMS delivery failed: ${err.message}`);
      return res.status(502).json({
        success: false,
        code:    'SMS_FAILED',
        message:
          'Imeshindwa kutuma OTP kwa sasa. Tafadhali jaribu tena. ' +
          '/ Failed to send OTP at this time. Please try again.',
      });
    }
    next(err);
  }
};


// ═══════════════════════════════════════════════════════════════════════════
// POST /api/auth/phone-login/verify
// ═══════════════════════════════════════════════════════════════════════════
exports.verifyPhoneOTP = async (req, res, next) => {
  try {
    const { phone: rawPhone, otp } = req.body;

    if (!rawPhone || !otp) {
      console.log(`[PhoneOTP] Verification request missing phone number or OTP`);
      return res.status(400).json({
        success: false,
        message:
          'Nambari ya simu na OTP zinahitajika. ' +
          '/ Phone number and OTP are required.',
      });
    }

    const phone    = normalisePhone(rawPhone);
    const variants = phoneVariants(phone);

    const FAIL = {
      success: false,
      code:    'OTP_INVALID',
      message:
        'OTP si sahihi au imeisha muda wake. Tafadhali omba OTP mpya. ' +
        '/ OTP is invalid or has expired. Please request a new OTP.',
    };

    // ── 1. Fetch latest unused, unexpired OTP ────────────────────────────────
    // Try canonical form first, then variants (handles legacy stored formats)
    const placeholders = variants.map(() => '?').join(', ');

    const [otpRows] = await db.execute(
      `SELECT id, otp_hash, expires_at, attempts, phone
       FROM   phone_login_otps
       WHERE  phone      IN (${placeholders})
         AND  used       = 0
         AND  expires_at > NOW()
       ORDER  BY created_at DESC
       LIMIT  1`,
      variants
    );

    if (otpRows.length === 0) {
      console.log(`[PhoneOTP] No valid OTP found for phone: ${phone}`);
      return res.status(400).json(FAIL);
    }

    const record = otpRows[0];

    // ── 2. Check attempt count ───────────────────────────────────────────────
    if (record.attempts >= MAX_ATTEMPTS) {
      await db.execute(
        `UPDATE phone_login_otps SET used = 1 WHERE id = ?`,
        [record.id]
      );
      return res.status(400).json({
        success: false,
        code:    'TOO_MANY_ATTEMPTS',
        message:
          'Umejaribu mara nyingi sana. Tafadhali omba OTP mpya. ' +
          '/ Too many failed attempts. Please request a new OTP.',
      });
    }

    // ── 3. Verify OTP ────────────────────────────────────────────────────────
    const isValid = await bcrypt.compare(String(otp), record.otp_hash);

    if (!isValid) {
      await db.execute(
        `UPDATE phone_login_otps SET attempts = attempts + 1 WHERE id = ?`,
        [record.id]
      );

      const remaining = MAX_ATTEMPTS - (record.attempts + 1);

      if (remaining <= 0) {
        await db.execute(
          `UPDATE phone_login_otps SET used = 1 WHERE id = ?`,
          [record.id]
        );
        return res.status(400).json({
          success: false,
          code:    'TOO_MANY_ATTEMPTS',
          message:
            'Umejaribu mara nyingi sana. Tafadhali omba OTP mpya. ' +
            '/ Too many failed attempts. Please request a new OTP.',
        });
      }

      return res.status(400).json({
        success: false,
        code:    'OTP_WRONG',
        message:
          `OTP si sahihi. Majaribio ${remaining} yaliyobaki. ` +
          `/ Incorrect OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
        attemptsRemaining: remaining,
      });
    }

    // ── 4. Mark OTP as used ──────────────────────────────────────────────────
    await db.execute(
      `UPDATE phone_login_otps SET used = 1 WHERE id = ?`,
      [record.id]
    );

    // ── 5. Fetch the user — match all variants ───────────────────────────────
    const [userRows] = await db.execute(
      `SELECT id, full_name, email, role, group_id, phone,
              namba_ya_usharika, profile_photo_url,
              is_active, is_verified, created_at
       FROM   users
       WHERE  phone IN (${placeholders})
       LIMIT  1`,
      variants
    );

    if (userRows.length === 0 || !userRows[0].is_active) {
      console.log(`[PhoneOTP] User not found or inactive: ${phone}`);
      return res.status(403).json({
        success: false,
        code:    'ACCOUNT_INACTIVE',
        message:
          'Akaunti haikupatikana au bado haikuidhinishwa. ' +
          '/ Account not found or not yet activated.',
      });
    }

    const user = userRows[0];

    // ── 6. Update last_login ─────────────────────────────────────────────────
    await db.execute(
      `UPDATE users SET last_login = NOW() WHERE id = ?`,
      [user.id]
    );

    // ── 7. Issue JWT and respond ─────────────────────────────────────────────
    const token = generateToken(user);

    console.log(`[PhoneOTP] ✅ Login success — userId=${user.id} phone=${normalisePhone(user.phone)}`);

    return res.json({
      success: true,
      token,
      user,
    });

  } catch (err) { next(err); }
};