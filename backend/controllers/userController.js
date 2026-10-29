const db = require('../config/db');
const bcrypt = require('bcryptjs');

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Columns visible to pastor (full profile).
 * No SQL comments inside this string — they break MySQL when interpolated.
 * Excludes `slp` — removed per BSS-KKKT-2026-001 review.
 */
const PASTOR_COLUMNS = `
  u.id, u.full_name, u.email, u.role, u.phone,
  u.avatar, u.profile_photo_url,
  u.is_active, u.created_at,
  u.gender, u.date_of_birth, u.place_of_birth, u.member_status,
  u.marital_status, u.marriage_type, u.marriage_date, u.marriage_place,
  u.spouse_name, u.spouse_phone, u.cohabiting_partner_name,
  u.occupation, u.workplace, u.education, u.profession,
  u.willing_to_volunteer,
  u.jumuiya, u.block_no, u.area_name,
  u.neighbour_member_name, u.neighbour_member_phone,
  u.elder_name, u.elder_phone, u.previous_church,
  g.name AS group_name
`.trim();

/**
 * Reduced column set for elder / group_leader.
 * No SQL comments inside this string.
 */
const LEADER_COLUMNS = `
  u.id, u.full_name, u.role, u.phone,
  u.avatar, u.profile_photo_url,
  u.is_active, u.created_at,
  u.gender, u.member_status,
  u.occupation, u.workplace,
  u.jumuiya, u.block_no, u.area_name,
  g.name AS group_name
`.trim();

// Allowed values for ENUM fields — validated server-side to prevent bad data
const ALLOWED = {
  gender:         new Set(['Male', 'Female']),
  member_status:  new Set(['hai', 'amehamia', 'amefariki']),
  marital_status: new Set([
    'Ameoa', 'Hajaoa', 'Ameolewa', 'Hajaolewa',
    'Mjane', 'Mgane', 'Talikiwa', 'Tengana',
  ]),
  marriage_type:  new Set(['Kikristo', 'Siya Kikristo']),
};

/**
 * Append a field/value pair to a dynamic UPDATE builder only when the value
 * is present and (for ENUMs) is a valid option.
 */
function push(fields, params, column, value, allowedSet = null) {
  if (value === undefined) return;
  if (allowedSet && !allowedSet.has(value)) return;
  fields.push(`${column} = ?`);
  params.push(value);
}


// ─── Users ──────────────────────────────────────────────────────────────────

exports.getUsers = async (req, res, next) => {
  try {
    const { role, groupId } = req.user;
    let sql, params = [];

    if (role === 'pastor') {
      sql = `SELECT ${PASTOR_COLUMNS}
             FROM users u LEFT JOIN \`groups\` g ON u.group_id = g.id
             ORDER BY u.created_at DESC`;
    } else if (['elder', 'group_leader'].includes(role)) {
      sql = `SELECT ${LEADER_COLUMNS}
             FROM users u LEFT JOIN \`groups\` g ON u.group_id = g.id
             WHERE u.group_id = ?
             ORDER BY u.created_at DESC`;
      params = [groupId];
    } else {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const [rows] = await db.execute(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

exports.getUser = async (req, res, next) => {
  try {
    const { role, groupId } = req.user;

    const [rows] = await db.execute(
      `SELECT ${PASTOR_COLUMNS},
              u.group_id,
              g.type AS group_type
       FROM users u LEFT JOIN \`groups\` g ON u.group_id = g.id
       WHERE u.id = ?`,
      [req.params.id]
    );

    if (rows.length === 0)
      return res.status(404).json({ success: false, message: 'User not found.' });

    const user = rows[0];

    if (role === 'group_leader' && user.group_id !== groupId)
      return res.status(403).json({ success: false, message: 'Access denied.' });

    delete user.group_id;

    res.json({ success: true, data: user });
  } catch (err) { next(err); }
};

exports.updateUser = async (req, res, next) => {
  try {
    const { role } = req.user;
    const targetId = parseInt(req.params.id);

    if (role !== 'pastor' && req.user.id !== targetId)
      return res.status(403).json({ success: false, message: 'Access denied.' });

    const body = req.body;
    const fields = [], params = [];

    push(fields, params, 'full_name', body.full_name);
    push(fields, params, 'phone',     body.phone);

    push(fields, params, 'gender',         body.gender,         ALLOWED.gender);
    push(fields, params, 'date_of_birth',  body.date_of_birth);
    push(fields, params, 'place_of_birth', body.place_of_birth);

    push(fields, params, 'marital_status',         body.marital_status,         ALLOWED.marital_status);
    push(fields, params, 'marriage_type',           body.marriage_type,           ALLOWED.marriage_type);
    push(fields, params, 'marriage_date',           body.marriage_date);
    push(fields, params, 'marriage_place',          body.marriage_place);
    push(fields, params, 'spouse_name',             body.spouse_name);
    push(fields, params, 'spouse_phone',            body.spouse_phone);
    push(fields, params, 'cohabiting_partner_name', body.cohabiting_partner_name);

    push(fields, params, 'occupation',           body.occupation);
    push(fields, params, 'workplace',            body.workplace);
    push(fields, params, 'education',            body.education);
    push(fields, params, 'profession',           body.profession);
    push(fields, params, 'willing_to_volunteer', body.willing_to_volunteer);

    push(fields, params, 'jumuiya',                body.jumuiya);
    push(fields, params, 'block_no',               body.block_no);
    push(fields, params, 'area_name',              body.area_name);
    push(fields, params, 'neighbour_member_name',  body.neighbour_member_name);
    push(fields, params, 'neighbour_member_phone', body.neighbour_member_phone);
    push(fields, params, 'elder_name',             body.elder_name);
    push(fields, params, 'elder_phone',            body.elder_phone);
    push(fields, params, 'previous_church',        body.previous_church);

    if (role === 'pastor') {
      push(fields, params, 'role',          body.role);
      push(fields, params, 'group_id',      body.group_id);
      push(fields, params, 'is_active',     body.is_active);
      push(fields, params, 'member_status', body.member_status, ALLOWED.member_status);
    }

    if (fields.length === 0)
      return res.status(400).json({ success: false, message: 'No fields to update.' });

    params.push(targetId);
    await db.execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);

    const [rows] = await db.execute(
      `SELECT id, full_name, email, role, phone,
              avatar, profile_photo_url, is_active, member_status
       FROM users WHERE id = ?`,
      [targetId]
    );
    res.json({ success: true, data: rows[0], message: 'User updated.' });
  } catch (err) { next(err); }
};

exports.deleteUser = async (req, res, next) => {
  try {
    if (req.user.role !== 'pastor')
      return res.status(403).json({ success: false, message: 'Access denied.' });

    const [result] = await db.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0)
      return res.status(404).json({ success: false, message: 'User not found.' });

    res.json({ success: true, message: 'Member removed.' });
  } catch (err) { next(err); }
};

exports.getStats = async (req, res, next) => {
  try {
    if (req.user.role !== 'pastor')
      return res.status(403).json({ success: false, message: 'Access denied.' });

    const [[total]]         = await db.execute('SELECT COUNT(*) AS count FROM users');
    const [[active]]        = await db.execute('SELECT COUNT(*) AS count FROM users WHERE is_active = 1');
    const [[groups]]        = await db.execute('SELECT COUNT(*) AS count FROM `groups`');
    const [[announcements]] = await db.execute(
      'SELECT COUNT(*) AS count FROM announcements WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)'
    );
    const [[transferred]] = await db.execute(
      "SELECT COUNT(*) AS count FROM users WHERE member_status = 'amehamia'"
    );
    const [[deceased]] = await db.execute(
      "SELECT COUNT(*) AS count FROM users WHERE member_status = 'amefariki'"
    );

    res.json({
      success: true,
      data: {
        totalMembers:        total.count,
        activeMembers:       active.count,
        totalGroups:         groups.count,
        recentAnnouncements: announcements.count,
        transferredMembers:  transferred.count,
        deceasedMembers:     deceased.count,
      },
    });
  } catch (err) { next(err); }
};


// ─── Dependants (Feature 5) ──────────────────────────────────────────────────

exports.getDependants = async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM member_dependants WHERE member_id = ? ORDER BY id ASC',
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.addDependant = async (req, res) => {
  try {
    const { full_name, relationship, date_of_birth } = req.body;
    const [result] = await db.execute(
      'INSERT INTO member_dependants (member_id, full_name, relationship, date_of_birth) VALUES (?, ?, ?, ?)',
      [req.params.id, full_name, relationship, date_of_birth || null]
    );
    const [rows] = await db.execute(
      'SELECT * FROM member_dependants WHERE id = ?',
      [result.insertId]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.removeDependant = async (req, res) => {
  try {
    await db.execute(
      'DELETE FROM member_dependants WHERE id = ? AND member_id = ?',
      [req.params.depId, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
exports.updateDependant = async (req, res, next) => {
  try {
    const { role, id: userId } = req.user;
    const memberId = parseInt(req.params.id);
    const depId    = parseInt(req.params.depId);

    if (role !== 'pastor' && userId !== memberId)
      return res.status(403).json({ success: false, message: 'Access denied.' });

    const [dep] = await db.execute(
      'SELECT id FROM member_dependants WHERE id = ? AND member_id = ?',
      [depId, memberId]
    );
    if (dep.length === 0)
      return res.status(404).json({ success: false, message: 'Dependant not found.' });

    const { full_name, date_of_birth, relationship } = req.body;
    const fields = [], params = [];
    push(fields, params, 'full_name',     full_name);
    push(fields, params, 'date_of_birth', date_of_birth);
    push(fields, params, 'relationship',  relationship);

    if (fields.length === 0)
      return res.status(400).json({ success: false, message: 'No fields to update.' });

    params.push(depId);
    await db.execute(
      `UPDATE member_dependants SET ${fields.join(', ')} WHERE id = ?`,
      params
    );

    const [rows] = await db.execute(
      'SELECT id, full_name, date_of_birth, relationship, created_at FROM member_dependants WHERE id = ?',
      [depId]
    );
    res.json({ success: true, data: rows[0], message: 'Dependant updated.' });
  } catch (err) { next(err); }
};

exports.deleteDependant = async (req, res, next) => {
  try {
    const { role, id: userId } = req.user;
    const memberId = parseInt(req.params.id);
    const depId    = parseInt(req.params.depId);

    // Members may delete their own dependants; pastors may delete anyone's
    if (role !== 'pastor' && userId !== memberId)
      return res.status(403).json({ success: false, message: 'Access denied.' });

    const [result] = await db.execute(
      'DELETE FROM member_dependants WHERE id = ? AND member_id = ?',
      [depId, memberId]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ success: false, message: 'Dependant not found.' });

    res.json({ success: true, message: 'Dependant removed.' });
  } catch (err) { next(err); }
};

// ── Add this to the bottom of userController.js ──────────────────────────────
// Requires: const bcrypt = require('bcryptjs');  ← already at the top of your file

exports.changePassword = async (req, res, next) => {
  try {
    const { role, id: callerId } = req.user;
    const targetId = parseInt(req.params.id);

    // Members may only change their own password
    if (role !== 'pastor' && callerId !== targetId)
      return res.status(403).json({ success: false, message: 'Access denied.' });

    const { current_password, new_password } = req.body;

    if (!new_password || new_password.length < 8)
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters.',
      });

    // Fetch current hash
    const [rows] = await db.execute(
      'SELECT password FROM users WHERE id = ?',
      [targetId]
    );
    if (rows.length === 0)
      return res.status(404).json({ success: false, message: 'User not found.' });

    // Pastors resetting another user's password skip the current-password check
    if (role !== 'pastor' || callerId === targetId) {
      if (!current_password)
        return res.status(400).json({
          success: false,
          message: 'Current password is required.',
        });

      const match = await bcrypt.compare(current_password, rows[0].password);
      if (!match)
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect.',
        });
    }

    const hash = await bcrypt.hash(new_password, 12);
    await db.execute('UPDATE users SET password = ? WHERE id = ?', [hash, targetId]);

    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) { next(err); }
};