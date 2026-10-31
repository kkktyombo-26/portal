const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const { broadcast, notifyUser } = require('../socket/index');
const { sendNotification, sendWelcomeEmail } = require('../services/emailService');

const generateToken = (user) => jwt.sign(
  { id: user.id, role: user.role, name: user.full_name, groupId: user.group_id },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
);

function generateTempPassword(length = 10) {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#';
  return Array.from({ length }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

// ═══════════════════════════════════════════════════════════
// POST /api/auth/register
// ═══════════════════════════════════════════════════════════
exports.register = async (req, res, next) => {
  try {
    const {
      full_name, email, password, role, group_id,
      phone, namba_ya_usharika,
      verifiedToken,
      profile_photo_url = null,
    } = req.body;

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

    await db.execute(
      'UPDATE email_verification_otps SET verified_token = NULL WHERE id = ?',
      [tokenRows[0].id]
    );

    const [existing] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    const hashed = await bcrypt.hash(password, 12);

    const [result] = await db.execute(
      `INSERT INTO users
         (full_name, email, password, role, group_id, phone, namba_ya_usharika,
          profile_photo_url, is_active, is_verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
      [
        full_name, email, hashed,
        role || 'member',
        group_id          || null,
        phone             || null,
        namba_ya_usharika || null,
        profile_photo_url || null,
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
// POST /api/auth/admin-create  — pastor / elder only
// Creates a fully active member, bypassing the OTP flow.
// Handles all extended profile fields + dependants.
// ═══════════════════════════════════════════════════════════
exports.adminCreateUser = async (req, res, next) => {
  try {
    const {
      // ── Account ──────────────────────────────────────────
      full_name,
      email,
      phone,
      role              = 'member',
      group_id,
      namba_ya_usharika,
      password: suppliedPassword,

      // ── Personal ─────────────────────────────────────────
      gender,
      date_of_birth,
      place_of_birth,

      // ── Marital ──────────────────────────────────────────
      marital_status,
      marriage_type,
      marriage_date,
      marriage_place,
      spouse_name,
      spouse_phone,
      cohabiting_partner_name,

      // ── Professional ─────────────────────────────────────
      occupation,
      workplace,
      education,
      profession,
      willing_to_volunteer,

      // ── Residence ────────────────────────────────────────
      jumuiya,
      block_no,
      area_name,
      slp,
      neighbour_member_name,
      neighbour_member_phone,
      elder_name,
      elder_phone,
      previous_church,

      // ── Dependants ────────────────────────────────────────
      // Array of { full_name, date_of_birth?, relationship? }
      dependants = [],
    } = req.body;

    // ── Require at least email or phone ──────────────────────
    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        message: 'At least an email address or phone number is required.',
      });
    }

    // ── Duplicate check on email ──────────────────────────────
    if (email) {
      const [existing] = await db.execute(
        'SELECT id FROM users WHERE email = ?', [email]
      );
      if (existing.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'A user with this email already exists.',
        });
      }
    }

    // ── Duplicate check on phone ──────────────────────────────
    if (phone) {
      const [existingPhone] = await db.execute(
        'SELECT id FROM users WHERE phone = ?', [phone]
      );
      if (existingPhone.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'A user with this phone number already exists.',
        });
      }
    }

    // ── Password ──────────────────────────────────────────────
    const isGenerated = !suppliedPassword;
    const rawPassword = suppliedPassword || generateTempPassword();
    const hashed      = await bcrypt.hash(rawPassword, 12);

    // ── Normalise willing_to_volunteer → TINYINT ──────────────
    // Frontend sends true/false (boolean) or 'true'/'false' (string from bulk)
    let volunteerVal = null;
    if (willing_to_volunteer !== undefined && willing_to_volunteer !== null && willing_to_volunteer !== '') {
      volunteerVal = (willing_to_volunteer === true || willing_to_volunteer === 'true') ? 1 : 0;
    }

    // ── INSERT user with all profile fields ───────────────────
    const [result] = await db.execute(
      `INSERT INTO users (
        full_name, email, password, role, group_id,
        phone, namba_ya_usharika,
        gender, date_of_birth, place_of_birth,
        marital_status, marriage_type, marriage_date, marriage_place,
        spouse_name, spouse_phone, cohabiting_partner_name,
        occupation, workplace, education, profession, willing_to_volunteer,
        jumuiya, block_no, area_name, slp,
        neighbour_member_name, neighbour_member_phone,
        elder_name, elder_phone, previous_church,
        is_active, is_verified
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        1, 1
      )`,
      [
        full_name,
        email                   || null,
        hashed,
        role,
        group_id                || null,

        phone                   || null,
        namba_ya_usharika       || null,

        gender                  || null,
        date_of_birth           || null,
        place_of_birth          || null,

        marital_status          || null,
        marriage_type           || null,
        marriage_date           || null,
        marriage_place          || null,

        spouse_name             || null,
        spouse_phone            || null,
        cohabiting_partner_name || null,

        occupation              || null,
        workplace               || null,
        education               || null,
        profession              || null,
        volunteerVal,

        jumuiya                 || null,
        block_no                || null,
        area_name               || null,
        slp                     || null,

        neighbour_member_name   || null,
        neighbour_member_phone  || null,

        elder_name              || null,
        elder_phone             || null,
        previous_church         || null,
      ]
    );

    const newUserId = result.insertId;

    // ── Insert dependants ─────────────────────────────────────
    if (Array.isArray(dependants) && dependants.length > 0) {
      const validDeps = dependants.filter(d => d.full_name && String(d.full_name).trim());

      if (validDeps.length > 0) {
        const depValues = validDeps.map(d => [
          newUserId,
          String(d.full_name).trim(),
          d.date_of_birth  || null,
          d.relationship   || null,
        ]);

        // Batch insert all dependants in one query
        const placeholders = depValues.map(() => '(?, ?, ?, ?)').join(', ');
        const flatValues   = depValues.flat();

        await db.execute(
          `INSERT INTO member_dependants (member_id, full_name, date_of_birth, relationship)
           VALUES ${placeholders}`,
          flatValues
        );
      }
    }

    // ── Welcome email ─────────────────────────────────────────
    if (email) {
      sendWelcomeEmail(email, {
        memberName:        full_name,
        role,
        temporaryPassword: isGenerated ? rawPassword : null,
        addedBy:           req.user.name,
      }).catch(err => console.error('⚠️  Welcome email failed:', err.message));
    }

    // ── Socket broadcast ──────────────────────────────────────
    broadcast('member_added_by_admin', {
      id:       newUserId,
      full_name,
      email:    email || null,
      role,
      addedBy:  req.user.name,
    });

    console.log(
      `Admin ${req.user.name} created member ${full_name} (${email || phone}) — id=${newUserId}`
    );

    res.status(201).json({
      success:           true,
      message:           `${full_name} has been added successfully.`,
      userId:            newUserId,
      temporaryPassword: isGenerated ? rawPassword : undefined,
    });
  } catch (err) { next(err); }
};


// ═══════════════════════════════════════════════════════════
// POST /api/auth/admin-bulk-create  — pastor / elder only
// ═══════════════════════════════════════════════════════════
exports.adminBulkCreateUsers = async (req, res, next) => {
  try {
    const { users } = req.body;

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'A non-empty "users" array is required.',
      });
    }

    if (users.length > 200) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 200 members per bulk upload.',
      });
    }

    const results = [];

    for (let i = 0; i < users.length; i++) {
      const row = i + 1;
      const {
        full_name,
        email,
        phone,
        role              = 'member',
        group_id,
        namba_ya_usharika,
        password: suppliedPassword,
        gender,
        date_of_birth,
        place_of_birth,
        marital_status,
        marriage_type,
        marriage_date,
        marriage_place,
        spouse_name,
        spouse_phone,
        cohabiting_partner_name,
        occupation,
        workplace,
        education,
        profession,
        willing_to_volunteer,
        jumuiya,
        block_no,
        area_name,
        slp,
        neighbour_member_name,
        neighbour_member_phone,
        elder_name,
        elder_phone,
        previous_church,
      } = users[i];

      // ── Basic validation ──────────────────────────────────
      if (!full_name || !String(full_name).trim()) {
        results.push({ row, status: 'skipped', reason: 'Missing full_name.' });
        continue;
      }
      if (!email && !phone) {
        results.push({ row, status: 'skipped', name: full_name, reason: 'Email or phone is required.' });
        continue;
      }

      try {
        // ── Duplicate guards ────────────────────────────────
        if (email) {
          const [dup] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
          if (dup.length > 0) {
            results.push({ row, status: 'skipped', name: full_name, reason: `Email "${email}" already exists.` });
            continue;
          }
        }

        if (phone) {
          const [dupPhone] = await db.execute('SELECT id FROM users WHERE phone = ?', [phone]);
          if (dupPhone.length > 0) {
            results.push({ row, status: 'skipped', name: full_name, reason: `Phone "${phone}" already exists.` });
            continue;
          }
        }

        // ── Password ──────────────────────────────────────
        const isGenerated = !suppliedPassword;
        const rawPassword = suppliedPassword || generateTempPassword();
        const hashed      = await bcrypt.hash(rawPassword, 12);

        // ── Normalise willing_to_volunteer ─────────────────
        let volunteerVal = null;
        if (willing_to_volunteer !== undefined && willing_to_volunteer !== null && willing_to_volunteer !== '') {
          volunteerVal = (willing_to_volunteer === true || willing_to_volunteer === 'true') ? 1 : 0;
        }

        // ── INSERT ─────────────────────────────────────────
        const [result] = await db.execute(
          `INSERT INTO users (
            full_name, email, password, role, group_id,
            phone, namba_ya_usharika,
            gender, date_of_birth, place_of_birth,
            marital_status, marriage_type, marriage_date, marriage_place,
            spouse_name, spouse_phone, cohabiting_partner_name,
            occupation, workplace, education, profession, willing_to_volunteer,
            jumuiya, block_no, area_name, slp,
            neighbour_member_name, neighbour_member_phone,
            elder_name, elder_phone, previous_church,
            is_active, is_verified
          ) VALUES (
            ?, ?, ?, ?, ?,
            ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?,
            ?, ?, ?,
            1, 1
          )`,
          [
            String(full_name).trim(),
            email                   || null,
            hashed,
            role,
            group_id                || null,

            phone                   || null,
            namba_ya_usharika       || null,

            gender                  || null,
            date_of_birth           || null,
            place_of_birth          || null,

            marital_status          || null,
            marriage_type           || null,
            marriage_date           || null,
            marriage_place          || null,

            spouse_name             || null,
            spouse_phone            || null,
            cohabiting_partner_name || null,

            occupation              || null,
            workplace               || null,
            education               || null,
            profession              || null,
            volunteerVal,

            jumuiya                 || null,
            block_no                || null,
            area_name               || null,
            slp                     || null,

            neighbour_member_name   || null,
            neighbour_member_phone  || null,

            elder_name              || null,
            elder_phone             || null,
            previous_church         || null,
          ]
        );

        const newUserId = result.insertId;

        // ── Welcome email ─────────────────────────────────
        if (email) {
          sendWelcomeEmail(email, {
            memberName:        String(full_name).trim(),
            role,
            temporaryPassword: isGenerated ? rawPassword : null,
            addedBy:           req.user.name,
          }).catch(err =>
            console.error(`⚠️  Welcome email failed for ${email}:`, err.message)
          );
        }

        results.push({
          row,
          status:            'created',
          name:              String(full_name).trim(),
          email:             email || null,
          userId:            newUserId,
          temporaryPassword: isGenerated ? rawPassword : undefined,
        });

      } catch (rowErr) {
        console.error(`Bulk create row ${row} error:`, rowErr.message);
        results.push({ row, status: 'error', name: full_name, reason: rowErr.message });
      }
    }

    // ── Summary ───────────────────────────────────────────────
    const created = results.filter(r => r.status === 'created');
    const skipped = results.filter(r => r.status !== 'created');

    if (created.length > 0) {
      broadcast('members_bulk_added_by_admin', {
        count:   created.length,
        addedBy: req.user.name,
        members: created.map(r => ({
          id:        r.userId,
          full_name: r.name,
          email:     r.email,
        })),
      });
    }

    console.log(
      `Admin ${req.user.name} bulk-created ${created.length}/${users.length} members ` +
      `(${skipped.length} skipped/errored)`
    );

    return res.status(201).json({
      success: true,
      summary: { total: users.length, created: created.length, skipped: skipped.length },
      results,
    });
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

    notifyUser(id, 'account_approved', {
      message:    'Akaunti yako imeidhinishwa! Sasa unaweza kuingia.',
      message_en: 'Your account has been approved! You can now sign in.',
    });

    sendWelcomeEmail(user.email, {
      memberName: user.full_name,
      role:       'Mwanakamati',
    }).catch(err => console.error('⚠️  Welcome email failed:', err.message));

    res.json({ success: true, message: `${user.full_name} approved successfully.` });
  } catch (err) { next(err); }
};


// ═══════════════════════════════════════════════════════════
// PATCH /api/auth/reject/:id    — pastor / elder only
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

    await db.execute(
      'UPDATE users SET is_active = 0, is_verified = 0 WHERE id = ?', [id]
    );

    notifyUser(id, 'account_rejected', {
      message:    'Ombi lako halikukubaliwa. Wasiliana na kanisa kwa maelezo zaidi.',
      message_en: 'Your application was not approved. Please contact the church for more information.',
      reason,
    });

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