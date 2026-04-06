const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

// Add these imports ↓
const { broadcast, notifyUser } = require('../socket/index');        // adjust path as needed
const { sendNotification, sendWelcomeEmail } = require('../services/emailService'); 

const generateToken = (user) => jwt.sign(
  { id: user.id, role: user.role, name: user.full_name, groupId: user.group_id },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
);

// ═══════════════════════════════════════════════════════════
// POST /api/auth/register
// ═══════════════════════════════════════════════════════════
exports.register = async (req, res, next) => {
  try {
    // Destructure it from req.body
const {
  full_name, email, password, role, group_id,
  phone, namba_ya_usharika,
  verifiedToken,
  profile_photo_url = null,   // ← NEW
} = req.body;

      // ── NEW: require a valid email-verification token ──────────────────────
    if (!verifiedToken) {
      return res.status(400).json({
        success: false,
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Email verification is required before registering.',
      });
    }

    const [tokenRows] = await db.execute(
      `SELECT id FROM email_verification_otps
        WHERE email = ? AND verified_token = ? AND token_expires_at > NOW()
        ORDER BY created_at DESC LIMIT 1`,
      [email, verifiedToken]
    );

    if (tokenRows.length === 0) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_VERIFICATION_TOKEN',
        message: 'Email verification token is invalid or has expired. Please verify your email again.',
      });
    }

    // Burn the token so it cannot be reused
    await db.execute(
      'UPDATE email_verification_otps SET verified_token = NULL WHERE id = ?',
      [tokenRows[0].id]
    );
    // 
 
    const [existing] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }
 
    const hashed = await bcrypt.hash(password, 12);
 
    // New members start inactive/unverified — a leader must approve them
// Add it to the INSERT
const [result] = await db.execute(
  `INSERT INTO users
     (full_name, email, password, role, group_id, phone, namba_ya_usharika,
      profile_photo_url, is_active, is_verified)          -- ← NEW column
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
  [
    full_name, email, hashed,
    role || 'member',
    group_id          || null,
    phone             || null,
    namba_ya_usharika || null,
    profile_photo_url || null,                            // ← NEW value
  ]
);
 
    const [rows] = await db.execute(
      `SELECT id, full_name, email, role, group_id, phone, namba_ya_usharika,
              is_active, is_verified, created_at
       FROM users WHERE id = ?`,
      [result.insertId]
    );
 
    const newUser = rows[0];
    const token   = generateToken(newUser);
 
    // ── Socket: tell all pastor/elder dashboards about the new application ──
    broadcast('new_member_application', {
      user: {
        id:                newUser.id,
        full_name:         newUser.full_name,
        email:             newUser.email,
        phone:             newUser.phone,
        namba_ya_usharika: newUser.namba_ya_usharika,
        created_at:        newUser.created_at,
      },
    });
 
    // ── Email: notify admin/pastor inbox ────────────────────────────────────
    const adminEmail = process.env.SUPPORT_EMAIL || process.env.GMAIL_USER;
    sendNotification(adminEmail, {
      title:        'Maombi Mapya ya Kujiunga',
      titleSwahili: 'New Member Application',
      message:      `${full_name} (${email}) ameomba kujiunga na kanisa. Tafadhali kagua na ukubali au ukatae ombi hili kwenye dashibodi.`,
      type:         'info',
      ctaLabel:     'Kagua Maombi',
      ctaUrl:       `${process.env.FRONTEND_URL}/dashboard/members/pending`,
    }).catch(err => console.error('⚠️  Admin notification email failed:', err.message));
 
    res.status(201).json({ success: true, token, user: newUser });
  } catch (err) { next(err); }
};
 
// ═══════════════════════════════════════════════════════════
// POST /api/auth/login
// ═══════════════════════════════════════════════════════════
exports.login = async (req, res, next) => {
  try {
    const { identifier, password } = req.body;
 
    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'Identifier and password are required.' });
    }
 
    const [rows] = await db.execute(
      `SELECT * FROM users
       WHERE email = ? OR phone = ? OR namba_ya_usharika = ?`,
      [identifier, identifier, identifier]
    );
 
    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }
 
    const user = rows[0];
 
    // Pending approval — let the frontend know with a specific code
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        code:    'ACCOUNT_PENDING',
        message: 'Akaunti yako bado haikuidhinishwa. Tafadhali subiri idhini ya kiongozi.',
      });
    }
 
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }
 
    await db.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
 
    const token = generateToken(user);
    const { password: _, ...safeUser } = user;
    res.json({ success: true, token, user: safeUser });
  } catch (err) { next(err); }
};
 
// ═══════════════════════════════════════════════════════════
// PATCH /api/auth/approve/:id   — pastor / elder only
// ═══════════════════════════════════════════════════════════
exports.approveUser = async (req, res, next) => {
  try {
    const { id } = req.params;
 
    const [rows] = await db.execute(
      'SELECT id, full_name, email FROM users WHERE id = ?', [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
 
    const user = rows[0];
 
    await db.execute(
      'UPDATE users SET is_active = 1, is_verified = 1 WHERE id = ?', [id]
    );
 
    // ── Socket: notify the user in real-time ──────────────────────────────
    notifyUser(id, 'account_approved', {
      message:    'Akaunti yako imeidhinishwa! Sasa unaweza kuingia.',
      message_en: 'Your account has been approved! You can now sign in.',
    });
 
    // ── Email: welcome email ───────────────────────────────────────────────
    sendWelcomeEmail(user.email, {
      memberName: user.full_name,
      role:       'Mwanakamati',
    }).catch(err => console.error('⚠️  Welcome email failed:', err.message));
 
    res.json({ success: true, message: `${user.full_name} approved successfully.` });
  } catch (err) { next(err); }
};
 
// ═══════════════════════════════════════════════════════════
// PATCH /api/auth/reject/:id    — pastor / elder only
// Body: { reason? }
// ═══════════════════════════════════════════════════════════
exports.rejectUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason = '' } = req.body;
 
    const [rows] = await db.execute(
      'SELECT id, full_name, email FROM users WHERE id = ?', [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
 
    const user = rows[0];
 
    // Keep the row but mark as inactive + unverified (soft reject)
    await db.execute(
      'UPDATE users SET is_active = 0, is_verified = 0 WHERE id = ?', [id]
    );
 
    // ── Socket: notify user in real-time ──────────────────────────────────
    notifyUser(id, 'account_rejected', {
      message:    'Ombi lako halikukubaliwa. Wasiliana na kanisa kwa maelezo zaidi.',
      message_en: 'Your application was not approved. Please contact the church for more information.',
      reason,
    });
 
    // ── Email: rejection notice ───────────────────────────────────────────
    sendNotification(user.email, {
      title:        'Kuhusu Ombi Lako',
      titleSwahili: 'Regarding Your Application',
      message:      `Ndugu ${user.full_name}, ombi lako la kujiunga halikukubaliwa kwa sasa.${reason ? ` Sababu: ${reason}.` : ''} Wasiliana na ofisi ya kanisa kwa maelezo zaidi.`,
      type:         'warning',
    }).catch(err => console.error('⚠️  Rejection email failed:', err.message));
 
    res.json({ success: true, message: `${user.full_name} rejected.` });
  } catch (err) { next(err); }
};
 
// ═══════════════════════════════════════════════════════════
// GET /api/auth/pending          — pastor / elder only
// ═══════════════════════════════════════════════════════════
// GET /api/auth/pending          — pastor / elder only
exports.getPendingUsers = async (req, res, next) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, full_name, email, phone, namba_ya_usharika,
              avatar, profile_photo_url,
              created_at
       FROM users
       WHERE is_active = 0 AND is_verified = 0
       ORDER BY created_at DESC`
    );
    res.json({ success: true, users: rows });
  } catch (err) { next(err); }
};
 
// ═══════════════════════════════════════════════════════════
// GET /api/auth/me
// ═══════════════════════════════════════════════════════════
exports.me = async (req, res, next) => {
  try {
    const [rows] = await db.execute(
      `SELECT u.id, u.full_name, u.email, u.role, u.phone, u.namba_ya_usharika,
              u.profile_photo_url, u.is_active, u.is_verified, u.created_at,
              g.name as group_name
       FROM users u
       LEFT JOIN \`groups\` g ON u.group_id = g.id
       WHERE u.id = ?`,
      [req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    res.json({ success: true, user: rows[0] });
  } catch (err) { next(err); }
};