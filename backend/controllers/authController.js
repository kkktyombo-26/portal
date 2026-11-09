const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const { broadcast, notifyUser } = require('../socket/index');
const { sendNotification, sendWelcomeEmail } = require('../services/emailService');
const { requestPhoneOTP, verifyPhoneOTP } =
  require('../controllers/phoneLoginController');
  
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

// ── Helper: normalise boolean/string → TINYINT (1 / 0 / null) ───────────────
function toBit(val) {
  if (val === undefined || val === null || val === '') return null;
  return (val === true || val === 'true' || val === 1 || val === '1') ? 1 : 0;
}

// ── Helper: sync ministry memberships for a user ─────────────────────────────
// ministryIds: number[] — the full desired set (replaces existing)
async function syncMinistries(userId, ministryIds) {
  if (!Array.isArray(ministryIds) || ministryIds.length === 0) return;

  const ids = ministryIds.map(Number).filter(Boolean);
  if (ids.length === 0) return;

  // Delete all existing memberships for this user, then re-insert
  await db.execute(
    'DELETE FROM member_ministries WHERE member_id = ?',
    [userId]
  );

  const placeholders = ids.map(() => '(?, ?)').join(', ');
  const flat         = ids.flatMap(id => [userId, id]);

  await db.execute(
    `INSERT INTO member_ministries (member_id, ministry_id) VALUES ${placeholders}`,
    flat
  );
}


// ═══════════════════════════════════════════════════════════
// POST /api/auth/register
// Self-registration — OTP verified, account pending approval.
// ═══════════════════════════════════════════════════════════
exports.register = async (req, res, next) => {
  try {
    const {
      full_name,
      email,
      password,
      role              = 'member',
      group_id,
      phone,
      namba_ya_usharika,
      verifiedToken,
      profile_photo_url = null,

      // Basic profile fields a member may fill during sign-up
      gender,
      date_of_birth,
      place_of_birth,

      // Address
      street,
      district,
      region,
      postal_code,
      area_name,
      block_no,
      jumuiya,
      slp,
    } = req.body;

    // ── OTP gate ─────────────────────────────────────────────
    if (!verifiedToken) {
      return res.status(400).json({
        success: false,
        code:    'EMAIL_NOT_VERIFIED',
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
        code:    'INVALID_VERIFICATION_TOKEN',
        message: 'Email verification token is invalid or has expired. Please verify your email again.',
      });
    }

    await db.execute(
      'UPDATE email_verification_otps SET verified_token = NULL WHERE id = ?',
      [tokenRows[0].id]
    );

    // ── Duplicate guard ───────────────────────────────────────
    const [existing] = await db.execute(
      'SELECT id FROM users WHERE email = ?', [email]
    );
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered.',
      });
    }

    const hashed = await bcrypt.hash(password, 12);

    const [result] = await db.execute(
      `INSERT INTO users (
        full_name, email, password, role, group_id,
        phone, namba_ya_usharika, profile_photo_url,
        gender, date_of_birth, place_of_birth,
        street, district, region, postal_code,
        area_name, block_no, jumuiya, slp,
        is_active, is_verified
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        0, 0
      )`,
      [
        full_name,
        email,
        hashed,
        role,
        group_id          || null,
        phone             || null,
        namba_ya_usharika || null,
        profile_photo_url || null,
        gender            || null,
        date_of_birth     || null,
        place_of_birth    || null,
        street            || null,
        district          || null,
        region            || null,
        postal_code       || null,
        area_name         || null,
        block_no          || null,
        jumuiya           || null,
        slp               || null,
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
// Handles all profile fields + dependants + ministries.
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
      member_since,
      member_status,
      willing_to_volunteer,
      profile_photo_url,
      cv_url,

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

      // ── Residence ────────────────────────────────────────
      street,
      district,
      region,
      postal_code,
      area_name,
      block_no,
      jumuiya,
      slp,
      previous_church,
      neighbour_member_name,
      neighbour_member_phone,
      elder_name,
      elder_phone,

      // ── Spiritual ────────────────────────────────────────
      baptism_date,
      confirmation_date,
      takes_communion,

      // ── Relations ────────────────────────────────────────
      // Array of { full_name, date_of_birth?, relationship? }
      dependants  = [],
      // Array of ministry IDs (number[])
      ministries  = [],
    } = req.body;

    // ── Require at least email or phone ──────────────────────
    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        message: 'At least an email address or phone number is required.',
      });
    }

    // ── Duplicate guards ──────────────────────────────────────
    if (email) {
      const [dup] = await db.execute(
        'SELECT id FROM users WHERE email = ?', [email]
      );
      if (dup.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'A user with this email already exists.',
        });
      }
    }

    if (phone) {
      const [dupPhone] = await db.execute(
        'SELECT id FROM users WHERE phone = ?', [phone]
      );
      if (dupPhone.length > 0) {
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

    // ── INSERT user ───────────────────────────────────────────
    const [result] = await db.execute(
      `INSERT INTO users (
        full_name, email, password, role, group_id,
        phone, namba_ya_usharika, profile_photo_url, cv_url,

        gender, date_of_birth, place_of_birth,
        member_since, member_status, willing_to_volunteer,

        marital_status, marriage_type, marriage_date, marriage_place,
        spouse_name, spouse_phone, cohabiting_partner_name,

        occupation, workplace, education, profession,

        street, district, region, postal_code,
        area_name, block_no, jumuiya, slp,
        previous_church, neighbour_member_name, neighbour_member_phone,
        elder_name, elder_phone,

        baptism_date, confirmation_date, takes_communion,

        is_active, is_verified
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,

        ?, ?, ?,
        ?, ?, ?,

        ?, ?, ?, ?,
        ?, ?, ?,

        ?, ?, ?, ?,

        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?,

        ?, ?, ?,

        1, 1
      )`,
      [
        full_name,
        email                    || null,
        hashed,
        role,
        group_id                 || null,

        phone                    || null,
        namba_ya_usharika        || null,
        profile_photo_url        || null,
        cv_url                   || null,

        gender                   || null,
        date_of_birth            || null,
        place_of_birth           || null,
        member_since             || null,
        member_status            || null,
        toBit(willing_to_volunteer),

        marital_status           || null,
        marriage_type            || null,
        marriage_date            || null,
        marriage_place           || null,
        spouse_name              || null,
        spouse_phone             || null,
        cohabiting_partner_name  || null,

        occupation               || null,
        workplace                || null,
        education                || null,
        profession               || null,

        street                   || null,
        district                 || null,
        region                   || null,
        postal_code              || null,
        area_name                || null,
        block_no                 || null,
        jumuiya                  || null,
        slp                      || null,
        previous_church          || null,
        neighbour_member_name    || null,
        neighbour_member_phone   || null,
        elder_name               || null,
        elder_phone              || null,

        baptism_date             || null,
        confirmation_date        || null,
        toBit(takes_communion),
      ]
    );

    const newUserId = result.insertId;

    // ── Dependants ────────────────────────────────────────────
    const validDeps = (dependants ?? []).filter(d => d.full_name && String(d.full_name).trim());
    if (validDeps.length > 0) {
      const depValues = validDeps.map(d => [
        newUserId,
        String(d.full_name).trim(),
        d.date_of_birth || null,
        d.relationship  || null,
      ]);
      const placeholders = depValues.map(() => '(?, ?, ?, ?)').join(', ');
      await db.execute(
        `INSERT INTO member_dependants (member_id, full_name, date_of_birth, relationship)
         VALUES ${placeholders}`,
        depValues.flat()
      );
    }

    // ── Ministries ────────────────────────────────────────────
    await syncMinistries(newUserId, ministries);

    // ── Welcome email ─────────────────────────────────────────
    if (email) {
      sendWelcomeEmail(email, {
        memberName:        full_name,
        role,
        temporaryPassword: isGenerated ? rawPassword : null,
        addedBy:           req.user.name,
      }).catch(err => console.error('⚠️  Welcome email failed:', err.message));
    }

    // ── Broadcast ─────────────────────────────────────────────
    broadcast('member_added_by_admin', {
      id: newUserId, full_name, email: email || null, role, addedBy: req.user.name,
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
    if (users.length > 1200) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 1200 members per bulk upload.',
      });
    }

    const results = [];

    // ── Pre-flight: catch duplicates within the batch itself ──
    const seenPhones  = new Set();
    const seenAhadis  = new Set();
    const seenNames   = new Set();

    for (let i = 0; i < users.length; i++) {
      const row = i + 1;
      const {
        full_name,
        phone,
        ahadi_number,
        gender,
        marital_status,
        occupation,
        jumuiya,
        role     = 'member',
        group_id,
        password: suppliedPassword,
      } = users[i];

      // ── Basic validation ────────────────────────────────────
      if (!full_name || !String(full_name).trim()) {
        results.push({ row, status: 'skipped', reason: 'Missing full_name.' });
        continue;
      }
      if (!phone && !ahadi_number) {
        results.push({
          row,
          status: 'skipped',
          name:   full_name,
          reason: 'Phone or ahadi_number is required.',
        });
        continue;
      }

      const cleanName = String(full_name).trim();

      // ── Intra-batch duplicate checks ────────────────────────
      if (phone && seenPhones.has(phone)) {
        results.push({
          row,
          status: 'skipped',
          name:   cleanName,
          reason: `Duplicate phone in batch: "${phone}".`,
        });
        continue;
      }

      if (ahadi_number && seenAhadis.has(ahadi_number)) {
        results.push({
          row,
          status: 'skipped',
          name:   cleanName,
          reason: `Duplicate ahadi_number in batch: "${ahadi_number}".`,
        });
        continue;
      }

      if (seenNames.has(cleanName.toLowerCase())) {
        results.push({
          row,
          status: 'skipped',
          name:   cleanName,
          reason: `Duplicate full_name in batch: "${cleanName}".`,
        });
        continue;
      }

      // Track seen values before attempting DB insert
      if (phone)        seenPhones.add(phone);
      if (ahadi_number) seenAhadis.add(ahadi_number);
      seenNames.add(cleanName.toLowerCase());

      try {
        // ── Database duplicate checks ───────────────────────
        if (phone) {
          const [dupPhone] = await db.execute(
            'SELECT id FROM users WHERE phone = ?', [phone]
          );
          if (dupPhone.length > 0) {
            results.push({
              row,
              status: 'skipped',
              name:   cleanName,
              reason: `Phone "${phone}" already exists in database.`,
            });
            continue;
          }
        }

        if (ahadi_number) {
          const [dupAhadi] = await db.execute(
            'SELECT id FROM users WHERE ahadi_number = ?', [ahadi_number]
          );
          if (dupAhadi.length > 0) {
            results.push({
              row,
              status: 'skipped',
              name:   cleanName,
              reason: `Ahadi number "${ahadi_number}" already exists in database.`,
            });
            continue;
          }
        }

        // Check full_name against the database as well
        const [dupName] = await db.execute(
          'SELECT id FROM users WHERE LOWER(full_name) = LOWER(?) AND role = ?',
          [cleanName, role]
        );
        if (dupName.length > 0) {
          results.push({
            row,
            status: 'skipped',
            name:   cleanName,
            reason: `A member named "${cleanName}" already exists in database.`,
          });
          continue;
        }

        // ── Password ──────────────────────────────────────────
        const isGenerated = !suppliedPassword;
        const rawPassword = suppliedPassword || generateTempPassword();
        const hashed      = await bcrypt.hash(rawPassword, 12);

        // ── INSERT ────────────────────────────────────────────
        const [result] = await db.execute(
          `INSERT INTO users (
            full_name, phone, ahadi_number,
            gender, marital_status, occupation, jumuiya,
            role, group_id, password,
            is_active, is_verified
          ) VALUES (
            ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?,
            1, 1
          )`,
          [
            cleanName,
            phone          || null,
            ahadi_number   || null,
            gender         || null,
            marital_status || null,
            occupation     || null,
            jumuiya        || null,
            role,
            group_id       || null,
            hashed,
          ]
        );

        results.push({
          row,
          status:            'created',
          name:              cleanName,
          phone:             phone        || null,
          ahadi_number:      ahadi_number || null,
          userId:            result.insertId,
          temporaryPassword: isGenerated ? rawPassword : undefined,
        });

      } catch (rowErr) {
        console.error(`Bulk create row ${row} error:`, rowErr.message);
        results.push({ row, status: 'error', name: cleanName, reason: rowErr.message });
      }
    }

    // ── Summary ───────────────────────────────────────────────
    const created = results.filter(r => r.status === 'created');
    const skipped = results.filter(r => r.status === 'skipped');
    const errored = results.filter(r => r.status === 'error');

    if (created.length > 0) {
      broadcast('members_bulk_added_by_admin', {
        count:   created.length,
        addedBy: req.user.name,
        members: created.map(r => ({
          id:           r.userId,
          full_name:    r.name,
          phone:        r.phone,
          ahadi_number: r.ahadi_number,
        })),
      });
    }

    console.log(
      `Admin ${req.user.name} bulk-created ${created.length}/${users.length} members ` +
      `(${skipped.length} skipped, ${errored.length} errored)`
    );

    return res.status(201).json({
      success: true,
      summary: {
        total:   users.length,
        created: created.length,
        skipped: skipped.length,
        errored: errored.length,
      },
      results,
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// Drop this helper near the top of authController.js (alongside toBit, etc.)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Given any phone-like string, return all reasonable stored variants so the
 * login query can match regardless of how the number was saved at registration.
 *
 * Examples (all resolve to the same set):
 *   "255617833806"   → ["255617833806",  "+255617833806",  "0617833806"]
 *   "+255617833806"  → ["+255617833806", "255617833806",   "0617833806"]
 *   "0617833806"     → ["0617833806",    "255617833806",   "+255617833806"]
 */
function phoneVariants(raw) {
  // Strip everything that isn't a digit or a leading +
  const cleaned = raw.trim();
  const digits  = cleaned.replace(/\D/g, '');

  // Not phone-shaped — return as-is and let the query try email/namba
  if (digits.length < 9) return [cleaned];

  let local; // last 9 digits (Tanzanian subscriber number)

  if (digits.startsWith('255') && digits.length === 12) {
    local = digits.slice(3);                    // "617833806"
  } else if (digits.startsWith('0') && digits.length === 10) {
    local = digits.slice(1);                    // "617833806"
  } else if (digits.length === 9) {
    local = digits;                             // already bare
  } else {
    // Unknown format — just return cleaned variants
    return [cleaned, `+${digits}`, digits];
  }

  return [
    `0${local}`,          // "0617833806"
    `255${local}`,        // "255617833806"
    `+255${local}`,       // "+255617833806"
  ];
}


// ─────────────────────────────────────────────────────────────────────────────
// Replace the existing exports.login with this version
// ─────────────────────────────────────────────────────────────────────────────

exports.login = async (req, res, next) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Identifier and password are required.',
      });
    }

    // Build phone variants so "+255…", "255…", and "0…" all match
    const variants   = phoneVariants(identifier);
    const phoneParts = variants.map(() => 'phone = ?').join(' OR ');
    const phoneVals  = variants;

    const [rows] = await db.execute(
      `SELECT * FROM users
       WHERE email = ?
          OR namba_ya_usharika = ?
          OR (${phoneParts})`,
      [identifier, identifier, ...phoneVals]
    );

    if (rows.length === 0) {
      console.log(`Login failed: no user found for identifier "${identifier}" (tried phone variants: ${variants.join(', ')})`);
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const user = rows[0];

    if (!user.is_active) {
      console.log(`Login failed: user "${user.full_name}" (${identifier}) is inactive`);
      return res.status(403).json({
        success: false,
        code:    'ACCOUNT_PENDING',
        message: 'Akaunti yako bado haikuidhinishwa. Tafadhali subiri idhini ya kiongozi.',
      });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      console.log(`Login failed: invalid password for user "${user.full_name}" (${identifier})`);
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    await db.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    const token = generateToken(user);
    const { password: _, ...safeUser } = user;
    console.log('Login successful:', user.full_name);
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
              avatar, profile_photo_url, created_at
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





// ═══════════════════════════════════════════════════════════
// GET /api/auth/members          — pastor / elder only
//
// Query params (all optional, combinable):
//   sortBy        — full_name | jumuiya | gender | marital_status |
//                   occupation | created_at | member_since | date_of_birth
//                   (default: full_name)
//   order         — asc | desc  (default: asc)
//   jumuiya       — filter by exact jumuiya name
//   ministry      — filter by ministry ID (active memberships only)
//   gender        — Male | Female
//   marital_status
//   member_status — hai | amehamia | amefariki
//   group_id      — filter by group
//   search        — partial match on full_name, phone, ahadi_number,
//                   namba_ya_usharika, email, occupation, jumuiya
//   page          — page number (default: 1)
//   limit         — rows per page, max 500 (default: 100)
// ═══════════════════════════════════════════════════════════
exports.getMembers = async (req, res, next) => {
  try {
    // ── Allowed sort columns (whitelist — prevents SQL injection) ──
    const SORTABLE = new Set([
      'full_name', 'jumuiya', 'gender', 'marital_status',
      'occupation', 'created_at', 'member_since', 'date_of_birth',
    ]);

    // ── Parse & sanitise query params ──────────────────────────────
    const sortBy   = SORTABLE.has(req.query.sortBy) ? req.query.sortBy : 'full_name';
    const order    = req.query.order === 'desc' ? 'DESC' : 'ASC';
    const page     = Math.max(1, parseInt(req.query.page)  || 1);
    const limit    = Math.min(500, Math.max(1, parseInt(req.query.limit) || 100));
    const offset   = (page - 1) * limit;

    const filterJumuiya      = req.query.jumuiya        || null;
    const filterMinistry     = parseInt(req.query.ministry) || null;
    const filterGender       = req.query.gender         || null;
    const filterMarital      = req.query.marital_status || null;
    const filterMemberStatus = req.query.member_status  || null;
    const filterGroupId      = parseInt(req.query.group_id) || null;
    const search             = req.query.search         || null;

    // ── Build WHERE conditions ──────────────────────────────────────
    // Note: ministry filtering is handled via INNER JOIN (see below),
    // not a WHERE condition, so it is NOT added to conditions[].
    const conditions  = [];
    const whereParams = [];

    if (filterJumuiya) {
      conditions.push('u.jumuiya = ?');
      whereParams.push(filterJumuiya);
    }
    if (filterGender) {
      conditions.push('u.gender = ?');
      whereParams.push(filterGender);
    }
    if (filterMarital) {
      conditions.push('u.marital_status = ?');
      whereParams.push(filterMarital);
    }
    if (filterMemberStatus) {
      conditions.push('u.member_status = ?');
      whereParams.push(filterMemberStatus);
    }
    if (filterGroupId) {
      conditions.push('u.group_id = ?');
      whereParams.push(filterGroupId);
    }
    if (search) {
      conditions.push(`(
        u.full_name           LIKE ? OR
        u.phone               LIKE ? OR
        u.ahadi_number        LIKE ? OR
        u.namba_ya_usharika   LIKE ? OR
        u.email               LIKE ? OR
        u.occupation          LIKE ? OR
        u.jumuiya             LIKE ?
      )`);
      const like = `%${search}%`;
      whereParams.push(like, like, like, like, like, like, like);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    // ── Ministry INNER JOIN (param comes BEFORE whereParams) ────────
    // Using a JOIN rather than a subquery so COUNT(DISTINCT) works
    // correctly and the query remains sargable.
    const ministryJoin = filterMinistry
      ? `INNER JOIN member_ministries mm_filter
           ON  mm_filter.member_id  = u.id
           AND mm_filter.ministry_id = ?
           AND mm_filter.status      = 'active'`
      : '';

    // Final param arrays — ministry param must come before WHERE params
    const allParams = [
      ...(filterMinistry ? [filterMinistry] : []),
      ...whereParams,
    ];

    // ── COUNT (for pagination meta) ─────────────────────────────────
    const [[{ total }]] = await db.execute(
      `SELECT COUNT(DISTINCT u.id) AS total
       FROM   users u
       ${ministryJoin}
       ${whereClause}`,
      allParams
    );

    // ── Fetch page ──────────────────────────────────────────────────
    const [members] = await db.execute(
      `SELECT
         u.id,
         u.full_name,
         u.email,
         u.phone,
         u.ahadi_number,
         u.namba_ya_usharika,
         u.role,
         u.gender,
         u.date_of_birth,
         u.place_of_birth,
         u.member_status,
         u.marital_status,
         u.marriage_type,
         u.occupation,
         u.profession,
         u.education,
         u.workplace,
         u.jumuiya,
         u.block_no,
         u.area_name,
         u.slp,
         u.profile_photo_url,
         u.willing_to_volunteer,
         u.member_since,
         u.baptism_date,
         u.confirmation_date,
         u.takes_communion,
         u.is_active,
         u.last_login,
         u.created_at,
         g.name AS group_name,

         -- Ministries as a JSON array — { id, name, category }
         -- status = 'active' guard ensures we don't return former memberships
         (
           SELECT JSON_ARRAYAGG(
             JSON_OBJECT(
               'id',       m.id,
               'name',     m.name_sw,
               'name_en',  m.name_en,
               'category', m.category
             )
           )
           FROM   member_ministries mm2
           INNER  JOIN ministries m ON m.id = mm2.ministry_id
           WHERE  mm2.member_id = u.id
             AND  mm2.status    = 'active'
         ) AS ministries,

         -- Dependants count (avoids loading full dependant rows in list view)
         (
           SELECT COUNT(*)
           FROM   member_dependants md
           WHERE  md.member_id = u.id
         ) AS dependants_count

       FROM  users u
       LEFT  JOIN \`groups\` g ON g.id = u.group_id
       ${ministryJoin}
       ${whereClause}
       GROUP  BY u.id
       ORDER  BY u.${sortBy} ${order}
       LIMIT  ? OFFSET ?`,
      [...allParams, limit, offset]
    );

    // ── Parse JSON_ARRAYAGG (MySQL returns it as a string) ──────────
    const parsed = members.map(m => ({
      ...m,
      ministries: m.ministries
        ? (typeof m.ministries === 'string'
            ? JSON.parse(m.ministries)
            : m.ministries)
        : [],
    }));

    // ── Distinct jumuiya list (for filter dropdowns) ────────────────
    const [jumuiyaRows] = await db.execute(
      `SELECT DISTINCT jumuiya
       FROM   users
       WHERE  jumuiya IS NOT NULL
       ORDER  BY jumuiya ASC`
    );

    // ── Response ────────────────────────────────────────────────────
    return res.json({
      success: true,
      meta: {
        total,
        page,
        limit,
        pages:  Math.ceil(total / limit),
        sortBy,
        order,
        filters: {
          jumuiya:        filterJumuiya,
          ministry:       filterMinistry,
          gender:         filterGender,
          marital_status: filterMarital,
          member_status:  filterMemberStatus,
          group_id:       filterGroupId,
          search,
        },
      },
      jumuiya_options: jumuiyaRows.map(r => r.jumuiya),
      members: parsed,
    });
  } catch (err) { next(err); }
};




