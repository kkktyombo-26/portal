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
 *     4. Mark OTP used, issue verifiedToken (registration) or JWT (login)
 *     5. If user exists and is active → login path (JWT)
 *        If no user found → registration path (verifiedToken only)
 *
 * Security:
 *   • OTP stored as bcrypt hash — never plain text
 *   • 5-minute OTP expiry
 *   • Max 5 wrong attempts before OTP invalidated
 *   • Max 3 OTP requests per phone per 10 minutes
 *   • IP-level rate limiting at the route layer (express-rate-limit)
 *   • Password stored as bcrypt hash — plain text only appears in SMS
 *   • verifiedToken is a 32-byte random hex, expires in 15 minutes
 *
 * Supported input formats (all resolve to 255XXXXXXXXX internally):
 *   +255 617 833 806   → 255617833806
 *   +255617833806      → 255617833806
 *   255 617 833 806    → 255617833806
 *   255617833806       → 255617833806
 *   0617833806         → 255617833806
 *   0617 833 806       → 255617833806
 *   617833806          → 255617833806
 *
 * DB requirement — phone_login_otps must have:
 *   verified_token   VARCHAR(64)  NULL
 *   token_expires_at DATETIME     NULL
 *   UNIQUE INDEX on verified_token
 */

const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const db     = require('../config/db');
const { sendSMS } = require('../services/smsService');

// ── Constants ─────────────────────────────────────────────────────────────────
const OTP_LENGTH            = 6;
const OTP_TTL_MINUTES       = 5;
const VERIFIED_TOKEN_MINUTES = 15;   // how long the registration token is valid
const MAX_ATTEMPTS          = 5;
const MAX_REQUESTS          = 3;     // per phone per REQUEST_WINDOW minutes
const REQUEST_WINDOW        = 10;    // minutes
const LOGIN_URL             = 'www.kkktdmpyombo.org/auth/login';

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
 */
function generatePassword() {
  const lower   = 'abcdefghjkmnpqrstuvwxyz';
  const upper   = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const digits  = '23456789';
  const symbols = '!@#';

  const all  = lower + upper + digits + symbols;
  const pick = (set) => set[crypto.randomInt(0, set.length)];

  const chars = [
    pick(lower),
    pick(upper),
    pick(digits),
    pick(symbols),
    ...Array.from({ length: 6 }, () => pick(all)),
  ];

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
 */
function normalisePhone(raw) {
  if (!raw) return null;

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
 * Handles legacy data where numbers were saved in different formats.
 */
function phoneVariants(canonical) {
  const local    = canonical.slice(3);  // 9-digit: 617833806
  const withZero = '0' + local;         // 0617833806
  const withPlus = '+' + canonical;     // +255617833806

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
    // A missing user is NOT an error here — the phone may belong to a new
    // registrant. We still send the OTP; the verify step decides the path.
    const placeholders = variants.map(() => '?').join(', ');

    const [rows] = await db.execute(
      `SELECT id, full_name, phone, is_active
       FROM   users
       WHERE  phone IN (${placeholders})
       LIMIT  1`,
      variants
    );

    const existingUser = rows[0] ?? null;

    // If a user exists but their account is inactive (pending approval),
    // block the OTP request so they can't bypass the approval gate.
    if (existingUser && !existingUser.is_active) {
      console.log(`[PhoneOTP] Request for inactive account: ${phone}`);
      return res.status(403).json({
        success: false,
        code:    'ACCOUNT_PENDING',
        message:
          'Akaunti yako bado haikuidhinishwa. Tafadhali subiri idhini ya kiongozi. ' +
          '/ Your account is pending approval. Please wait for a leader to approve it.',
      });
    }

    // Use the canonical form of the stored phone (or the input if new user)
    const canonicalPhone = existingUser
      ? normalisePhone(existingUser.phone)
      : phone;

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

    // ── 5. Build SMS ──────────────────────────────────────────────────────────
    // For existing users: include a refreshed password (original behaviour).
    // For new registrants: OTP only — they'll set their password in the form.
    let message;

    if (existingUser) {
      // Regenerate password for existing user (keeps original login-via-SMS UX)
      const plainPassword  = generatePassword();
      const hashedPassword = await bcrypt.hash(plainPassword, 12);

      await db.execute(
        `UPDATE users SET password = ? WHERE id = ?`,
        [hashedPassword, existingUser.id]
      );

      const firstName = existingUser.full_name.split(' ')[0];
      message =
        `Habari ${firstName},\n` +
        `Nambari yako ya uthibitisho (OTP): ${otp}\n` +
        `Inaisha baada ya dakika ${OTP_TTL_MINUTES}.\n\n` +
        `Unaweza pia kuingia kwa nambari yako ya simu na nenosiri hili:\n` +
        `Simu: ${canonicalPhone}\n` +
        `Nenosiri: ${plainPassword}\n` +
        `Tovuti: ${LOGIN_URL}\n\n` +
        `Usimwambie mtu yeyote nenosiri hili.`;
    } else {
      // New registrant — OTP only
      message =
        `Habari,\n` +
        `Nambari yako ya uthibitisho (OTP) kwa ajili ya usajili: ${otp}\n` +
        `Inaisha baada ya dakika ${OTP_TTL_MINUTES}.\n\n` +
        `KKKT Yombo DMP — ${LOGIN_URL}`;
    }

    // ── 6. Send via NextSMS ──────────────────────────────────────────────────
    await sendSMS(canonicalPhone, message);

    console.log(
      `[PhoneOTP] OTP sent → phone=${canonicalPhone} ` +
      `(${existingUser ? `userId=${existingUser.id}` : 'new registrant'})`
    );

    return res.json({
      success: true,
      message:
        'OTP imetumwa kwa nambari yako ya simu. Itaisha baada ya dakika 5. ' +
        '/ OTP sent to your phone number. It expires in 5 minutes.',
    });

  } catch (err) {
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
//
// Two outcomes depending on whether a user account exists for the phone:
//
//   isRegistration: true  — no account found; return verifiedToken so the
//                           frontend can proceed to /api/auth/register
//
//   isRegistration: false — existing active account; return JWT (normal login)
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

    // ── 4. Mark OTP used ─────────────────────────────────────────────────────
    await db.execute(
      `UPDATE phone_login_otps SET used = 1 WHERE id = ?`,
      [record.id]
    );

    // ── 4b. Generate and store a short-lived verified token ──────────────────
    // This token is carried by the frontend into POST /api/auth/register.
    // It proves the phone was verified without needing the full OTP flow again.
    const verifiedToken  = crypto.randomBytes(32).toString('hex');
    const tokenExpiresAt = new Date(Date.now() + VERIFIED_TOKEN_MINUTES * 60 * 1000);

    await db.execute(
      `UPDATE phone_login_otps
          SET verified_token   = ?,
              expires_at = ?
        WHERE id = ?`,
      [verifiedToken, tokenExpiresAt, record.id]
    );
    

    // ── 5. Check whether a user account exists for this phone ────────────────
    const [userRows] = await db.execute(
      `SELECT id, full_name, email, role, group_id, phone,
              namba_ya_usharika, profile_photo_url,
              is_active, is_verified, created_at
       FROM   users
       WHERE  phone IN (${placeholders})
       LIMIT  1`,
      variants
    );

    // ── Registration path — phone verified but no account yet ────────────────
    if (userRows.length === 0) {
      console.log(`[PhoneOTP] ✅ Phone verified (new registrant) — phone=${phone}`);
      return res.json({
        success:        true,
        isRegistration: true,
        verifiedToken,          // carry this into POST /api/auth/register
        phone,                  // canonical form — frontend pre-fills the field
      });
    }

    const user = userRows[0];

    // Inactive (pending) accounts — block login
    if (!user.is_active) {
      console.log(`[PhoneOTP] Account inactive: ${phone}`);
      return res.status(403).json({
        success: false,
        code:    'ACCOUNT_INACTIVE',
        message:
          'Akaunti yako bado haikuidhinishwa. Tafadhali subiri idhini ya kiongozi. ' +
          '/ Your account has not been approved yet. Please wait for a leader to approve it.',
      });
    }

    // ── Login path — existing active user ────────────────────────────────────
    await db.execute(
      `UPDATE users SET last_login = NOW() WHERE id = ?`,
      [user.id]
    );

    const token = generateToken(user);

    console.log(`[PhoneOTP] ✅ Login success — userId=${user.id} phone=${normalisePhone(user.phone)}`);

    return res.json({
      success:        true,
      isRegistration: false,
      token,
      user,
      // verifiedToken is also returned here in case the client ever needs it,
      // but for a login it should be ignored.
      verifiedToken,
    });

  } catch (err) { next(err); }
};