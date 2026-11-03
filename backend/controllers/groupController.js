/**
 * groupController.js  (v2)
 * ─────────────────────────
 * Groups module — updated for BSS-KKKT-2026-004
 *
 * What changed from v1
 * ────────────────────
 * • group type ENUM is now: jumuiya | ministry | administrative | other
 * • Groups have start_date, end_date, year, is_archived
 * • Membership is now stored in `group_members` (join table), NOT users.group_id
 *   — each membership has: year, role_in_group, joined_date, left_date, status, notes
 *   — historical records supported (e.g. "Baraza la Wazee 2008")
 * • getGroupMembers now accepts ?year= and ?status= filters
 * • addGroupMember accepts year, role_in_group, joined_date, notes
 * • removeGroupMember sets left_date + status=former (soft-remove, not DELETE)
 * • New: archiveGroup, getGroupHistory
 *
 * Access
 * ──────
 * pastor        — full CRUD on all groups
 * elder         — full CRUD on all groups
 * group_leader  — read all; manage members of their own group only
 * member        — read active groups only
 */

const db = require('../config/db');

const VALID_TYPES   = ['jumuiya', 'ministry', 'administrative', 'other'];
const MANAGERS      = ['pastor', 'elder'];
const ALL_MANAGERS  = ['pastor', 'elder', 'group_leader'];

// ─────────────────────────────────────────────────────────────────────────────
// Shared SELECT fragment — used in getGroups + getGroup
// ─────────────────────────────────────────────────────────────────────────────
const GROUP_SELECT = `
  SELECT
    g.*,
    u.full_name                             AS leader_name,
    COUNT(DISTINCT gm_active.id)            AS active_member_count,
    COUNT(DISTINCT gm_all.id)               AS total_member_count
  FROM \`groups\` g
  LEFT JOIN users        u         ON u.id        = g.leader_id
  LEFT JOIN group_members gm_active ON gm_active.group_id = g.id
                                   AND gm_active.status = 'active'
  LEFT JOIN group_members gm_all    ON gm_all.group_id   = g.id
`;


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — GROUPS CRUD
// ═══════════════════════════════════════════════════════════════════════════════

// ── GET /api/groups ───────────────────────────────────────────────────────────
// Query params: ?type=jumuiya  ?year=2008  ?is_archived=0|1
exports.getGroups = async (req, res, next) => {
  try {
    const { type, year, is_archived } = req.query;

    const conditions = [];
    const params     = [];

    if (type) {
      if (!VALID_TYPES.includes(type)) {
        return res.status(400).json({
          success: false,
          message: `type must be one of: ${VALID_TYPES.join(', ')}`,
        });
      }
      conditions.push('g.type = ?');
      params.push(type);
    }

    if (year) {
      conditions.push('g.year = ?');
      params.push(year);
    }

    // Default: hide archived groups unless explicitly requested
    if (is_archived !== undefined && is_archived !== '') {
      conditions.push('g.is_archived = ?');
      params.push(Number(is_archived));
    } else {
      conditions.push('g.is_archived = 0');
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await db.execute(
      `${GROUP_SELECT}
       ${where}
       GROUP BY g.id, u.full_name
       ORDER BY g.type, g.year DESC, g.name`,
      params
    );

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

// ── GET /api/groups/:id ───────────────────────────────────────────────────────
exports.getGroup = async (req, res, next) => {
  try {
    const [rows] = await db.execute(
      `${GROUP_SELECT}
       WHERE g.id = ?
       GROUP BY g.id, u.full_name`,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

// ── POST /api/groups ──────────────────────────────────────────────────────────
exports.createGroup = async (req, res, next) => {
  try {
    const { role } = req.user;
    if (!MANAGERS.includes(role)) {
      return res.status(403).json({ success: false, message: 'Only pastor or elder can create groups.' });
    }

    const {
      name,
      name_sw,
      type        = 'other',
      leader_id,
      description,
      year,
      start_date,
      end_date,
    } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'name is required.' });
    }
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `type must be one of: ${VALID_TYPES.join(', ')}`,
      });
    }
    if (end_date && start_date && new Date(end_date) < new Date(start_date)) {
      return res.status(400).json({ success: false, message: 'end_date cannot be before start_date.' });
    }

    // Derive is_archived from end_date being set
    const is_archived = end_date ? 1 : 0;

    const [result] = await db.execute(`
      INSERT INTO \`groups\`
        (name, name_sw, type, leader_id, description,
         year, start_date, end_date, is_archived)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      String(name).trim(),
      name_sw     ? String(name_sw).trim() : null,
      type,
      leader_id   || null,
      description || null,
      year        || null,
      start_date  || null,
      end_date    || null,
      is_archived,
    ]);

    const [rows] = await db.execute(
      `${GROUP_SELECT} WHERE g.id = ? GROUP BY g.id, u.full_name`,
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: `Group "${name}" created.`,
      data:    rows[0],
    });
  } catch (err) { next(err); }
};

// ── PUT /api/groups/:id ───────────────────────────────────────────────────────
exports.updateGroup = async (req, res, next) => {
  try {
    const { role } = req.user;
    if (!MANAGERS.includes(role)) {
      return res.status(403).json({ success: false, message: 'Only pastor or elder can update groups.' });
    }

    const [existing] = await db.execute(
      'SELECT * FROM `groups` WHERE id = ?', [req.params.id]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    const {
      name, name_sw, type, leader_id, description,
      year, start_date, end_date, is_archived,
    } = req.body;

    if (type && !VALID_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `type must be one of: ${VALID_TYPES.join(', ')}`,
      });
    }

    const resolvedEndDate   = end_date   !== undefined ? (end_date   || null) : existing[0].end_date;
    const resolvedStartDate = start_date !== undefined ? (start_date || null) : existing[0].start_date;

    if (resolvedEndDate && resolvedStartDate && new Date(resolvedEndDate) < new Date(resolvedStartDate)) {
      return res.status(400).json({ success: false, message: 'end_date cannot be before start_date.' });
    }

    // Auto-sync is_archived with end_date if not explicitly set
    let resolvedArchived = existing[0].is_archived;
    if (is_archived !== undefined) {
      resolvedArchived = is_archived ? 1 : 0;
    } else if (end_date !== undefined) {
      resolvedArchived = end_date ? 1 : 0;
    }

    const fields = [], params = [];

    if (name        !== undefined) { fields.push('name = ?');        params.push(String(name).trim()); }
    if (name_sw     !== undefined) { fields.push('name_sw = ?');     params.push(name_sw     || null); }
    if (type        !== undefined) { fields.push('type = ?');        params.push(type); }
    if (leader_id   !== undefined) { fields.push('leader_id = ?');   params.push(leader_id   || null); }
    if (description !== undefined) { fields.push('description = ?'); params.push(description || null); }
    if (year        !== undefined) { fields.push('year = ?');        params.push(year        || null); }
    if (start_date  !== undefined) { fields.push('start_date = ?');  params.push(resolvedStartDate); }
    if (end_date    !== undefined) { fields.push('end_date = ?');    params.push(resolvedEndDate); }

    fields.push('is_archived = ?');
    params.push(resolvedArchived);

    if (fields.length === 1) { // only is_archived was pushed (no real changes)
      return res.status(400).json({ success: false, message: 'No updatable fields provided.' });
    }

    params.push(req.params.id);
    await db.execute(
      `UPDATE \`groups\` SET ${fields.join(', ')} WHERE id = ?`,
      params
    );

    const [rows] = await db.execute(
      `${GROUP_SELECT} WHERE g.id = ? GROUP BY g.id, u.full_name`,
      [req.params.id]
    );

    res.json({ success: true, message: 'Group updated.', data: rows[0] });
  } catch (err) { next(err); }
};

// ── PATCH /api/groups/:id/archive ─────────────────────────────────────────────
// Convenience endpoint: archive a group (sets end_date + is_archived=1).
exports.archiveGroup = async (req, res, next) => {
  try {
    const { role } = req.user;
    if (!MANAGERS.includes(role)) {
      return res.status(403).json({ success: false, message: 'Only pastor or elder can archive groups.' });
    }

    const [existing] = await db.execute(
      'SELECT id, name, is_archived FROM `groups` WHERE id = ?', [req.params.id]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }
    if (existing[0].is_archived) {
      return res.status(400).json({ success: false, message: 'Group is already archived.' });
    }

    const end_date = req.body.end_date || new Date().toISOString().slice(0, 10);

    await db.execute(
      'UPDATE `groups` SET is_archived = 1, end_date = ? WHERE id = ?',
      [end_date, req.params.id]
    );

    // Mark all active memberships as former
    await db.execute(
      `UPDATE group_members
       SET status = 'former', left_date = COALESCE(left_date, ?)
       WHERE group_id = ? AND status = 'active'`,
      [end_date, req.params.id]
    );

    const [rows] = await db.execute(
      `${GROUP_SELECT} WHERE g.id = ? GROUP BY g.id, u.full_name`,
      [req.params.id]
    );

    res.json({
      success: true,
      message: `Group "${existing[0].name}" archived.`,
      data:    rows[0],
    });
  } catch (err) { next(err); }
};

// ── DELETE /api/groups/:id ────────────────────────────────────────────────────
// Hard delete. group_members cascade. Pastor only.
exports.deleteGroup = async (req, res, next) => {
  try {
    const { role } = req.user;
    if (role !== 'pastor') {
      return res.status(403).json({ success: false, message: 'Only pastor can permanently delete groups.' });
    }

    const [existing] = await db.execute(
      'SELECT id, name FROM `groups` WHERE id = ?', [req.params.id]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    const [[{ member_count }]] = await db.execute(
      'SELECT COUNT(*) AS member_count FROM group_members WHERE group_id = ?',
      [req.params.id]
    );

    await db.execute('DELETE FROM `groups` WHERE id = ?', [req.params.id]);

    res.json({
      success: true,
      message: `Group "${existing[0].name}" permanently deleted.`,
      removed_memberships: member_count,
    });
  } catch (err) { next(err); }
};


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — GROUP MEMBERSHIP
// ═══════════════════════════════════════════════════════════════════════════════

// ── GET /api/groups/:id/members ───────────────────────────────────────────────
// Query params: ?year=2008  ?status=active|former
exports.getGroupMembers = async (req, res, next) => {
  try {
    const { year, status } = req.query;

    const conditions = ['gm.group_id = ?'];
    const params     = [req.params.id];

    if (year) {
      conditions.push('gm.year = ?');
      params.push(year);
    }

    // Default: show active members; pass ?status=former or ?status=all to override
    if (status === 'all') {
      // no extra condition
    } else if (status === 'former') {
      conditions.push("gm.status = 'former'");
    } else {
      conditions.push("gm.status = 'active'");
    }

    const [rows] = await db.execute(`
      SELECT
        gm.id               AS membership_id,
        gm.group_id,
        gm.member_id,
        gm.year,
        gm.role_in_group,
        gm.joined_date,
        gm.left_date,
        gm.status,
        gm.notes,
        gm.created_at       AS membership_created_at,
        u.full_name,
        u.phone,
        u.avatar,
        u.profile_photo_url,
        u.role              AS system_role,
        u.gender,
        u.member_status
      FROM group_members gm
      JOIN users u ON u.id = gm.member_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY
        gm.year DESC,
        gm.role_in_group IS NULL,
        gm.role_in_group,
        u.full_name
    `, params);

    // Build summary for the response
    const summary = {
      total:  rows.length,
      active: rows.filter(r => r.status === 'active').length,
      former: rows.filter(r => r.status === 'former').length,
      years:  [...new Set(rows.map(r => r.year).filter(Boolean))].sort((a, b) => b - a),
    };

    res.json({ success: true, summary, data: rows });
  } catch (err) { next(err); }
};

// ── POST /api/groups/:id/members ──────────────────────────────────────────────
// Add a member to a group. Supports historical entries (year, joined_date).
exports.addGroupMember = async (req, res, next) => {
  try {
    const { role, id: callerId, group_id: callerGroupId } = req.user;

    if (!ALL_MANAGERS.includes(role)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const groupId = parseInt(req.params.id);

    // group_leader can only add to their own group
    if (role === 'group_leader' && callerGroupId !== groupId) {
      return res.status(403).json({ success: false, message: 'You can only manage your own group.' });
    }

    const {
      user_id,
      year,
      role_in_group,
      joined_date,
      notes,
    } = req.body;

    if (!user_id) {
      return res.status(400).json({ success: false, message: 'user_id is required.' });
    }

    // Verify group exists
    const [group] = await db.execute(
      'SELECT id, name, year AS group_year FROM `groups` WHERE id = ?', [groupId]
    );
    if (!group.length) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    // Verify member exists
    const [member] = await db.execute(
      'SELECT id, full_name FROM users WHERE id = ?', [user_id]
    );
    if (!member.length) {
      return res.status(404).json({ success: false, message: 'Member not found.' });
    }

    // Resolve year: caller-supplied → group's year → current year
    const resolvedYear = year || group[0].group_year || new Date().getFullYear();

    // Check for duplicate (same member, group, year, role)
    const [dup] = await db.execute(`
      SELECT id FROM group_members
      WHERE group_id = ? AND member_id = ? AND year = ?
        AND (role_in_group = ? OR (role_in_group IS NULL AND ? IS NULL))
    `, [groupId, user_id, resolvedYear, role_in_group || null, role_in_group || null]);

    if (dup.length) {
      return res.status(409).json({
        success: false,
        message: `${member[0].full_name} is already in this group for ${resolvedYear}${role_in_group ? ` as ${role_in_group}` : ''}.`,
        existing_membership_id: dup[0].id,
      });
    }

    const [result] = await db.execute(`
      INSERT INTO group_members
        (group_id, member_id, year, role_in_group, joined_date, status, notes)
      VALUES (?, ?, ?, ?, ?, 'active', ?)
    `, [
      groupId,
      user_id,
      resolvedYear,
      role_in_group || null,
      joined_date   || null,
      notes         || null,
    ]);

    const [rows] = await db.execute(`
      SELECT gm.*, u.full_name, u.phone, u.avatar, u.profile_photo_url
      FROM group_members gm
      JOIN users u ON u.id = gm.member_id
      WHERE gm.id = ?
    `, [result.insertId]);

    res.status(201).json({
      success: true,
      message: `${member[0].full_name} added to group${year ? ` (${resolvedYear})` : ''}.`,
      data:    rows[0],
    });
  } catch (err) { next(err); }
};

// ── PUT /api/groups/:id/members/:membershipId ─────────────────────────────────
// Edit a membership record (role, dates, notes).
exports.updateGroupMember = async (req, res, next) => {
  try {
    const { role, group_id: callerGroupId } = req.user;
    if (!ALL_MANAGERS.includes(role)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const groupId      = parseInt(req.params.id);
    const membershipId = parseInt(req.params.membershipId);

    if (role === 'group_leader' && callerGroupId !== groupId) {
      return res.status(403).json({ success: false, message: 'You can only manage your own group.' });
    }

    const [existing] = await db.execute(
      'SELECT * FROM group_members WHERE id = ? AND group_id = ?',
      [membershipId, groupId]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Membership record not found.' });
    }

    const { year, role_in_group, joined_date, left_date, status, notes } = req.body;

    const fields = [], params = [];

    if (year          !== undefined) { fields.push('year = ?');           params.push(year          || null); }
    if (role_in_group !== undefined) { fields.push('role_in_group = ?');  params.push(role_in_group || null); }
    if (joined_date   !== undefined) { fields.push('joined_date = ?');    params.push(joined_date   || null); }
    if (left_date     !== undefined) { fields.push('left_date = ?');      params.push(left_date     || null); }
    if (notes         !== undefined) { fields.push('notes = ?');          params.push(notes         || null); }
    if (status !== undefined) {
      if (!['active', 'former'].includes(status)) {
        return res.status(400).json({ success: false, message: 'status must be active or former.' });
      }
      fields.push('status = ?');
      params.push(status);
    }

    if (!fields.length) {
      return res.status(400).json({ success: false, message: 'No updatable fields provided.' });
    }

    params.push(membershipId);
    await db.execute(
      `UPDATE group_members SET ${fields.join(', ')} WHERE id = ?`, params
    );

    const [rows] = await db.execute(`
      SELECT gm.*, u.full_name, u.phone, u.avatar, u.profile_photo_url
      FROM group_members gm JOIN users u ON u.id = gm.member_id
      WHERE gm.id = ?
    `, [membershipId]);

    res.json({ success: true, message: 'Membership updated.', data: rows[0] });
  } catch (err) { next(err); }
};

// ── DELETE /api/groups/:id/members/:membershipId ──────────────────────────────
// Soft-remove: sets status=former + left_date. Does NOT hard-delete the record.
// Historical records are preserved.
exports.removeGroupMember = async (req, res, next) => {
  try {
    const { role, group_id: callerGroupId } = req.user;
    if (!ALL_MANAGERS.includes(role)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const groupId      = parseInt(req.params.id);
    const membershipId = parseInt(req.params.membershipId);

    if (role === 'group_leader' && callerGroupId !== groupId) {
      return res.status(403).json({ success: false, message: 'You can only manage your own group.' });
    }

    const [existing] = await db.execute(`
      SELECT gm.*, u.full_name
      FROM group_members gm JOIN users u ON u.id = gm.member_id
      WHERE gm.id = ? AND gm.group_id = ?
    `, [membershipId, groupId]);

    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Membership record not found.' });
    }
    if (existing[0].status === 'former') {
      return res.status(400).json({
        success: false,
        message: `${existing[0].full_name} is already marked as a former member.`,
      });
    }

    const left_date = req.body.left_date || new Date().toISOString().slice(0, 10);

    await db.execute(
      `UPDATE group_members SET status = 'former', left_date = ? WHERE id = ?`,
      [left_date, membershipId]
    );

    res.json({
      success:   true,
      message:   `${existing[0].full_name} marked as former member (left ${left_date}).`,
      left_date,
    });
  } catch (err) { next(err); }
};

// ── DELETE /api/groups/:id/members/:membershipId/hard ─────────────────────────
// Hard delete — only use to correct a data-entry mistake. Pastor only.
exports.hardRemoveGroupMember = async (req, res, next) => {
  try {
    const { role } = req.user;
    if (role !== 'pastor') {
      return res.status(403).json({ success: false, message: 'Only pastor can hard-delete membership records.' });
    }

    const [existing] = await db.execute(
      'SELECT gm.*, u.full_name FROM group_members gm JOIN users u ON u.id = gm.member_id WHERE gm.id = ? AND gm.group_id = ?',
      [req.params.membershipId, req.params.id]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Membership record not found.' });
    }

    await db.execute('DELETE FROM group_members WHERE id = ?', [req.params.membershipId]);

    res.json({
      success: true,
      message: `Membership record for ${existing[0].full_name} permanently deleted.`,
    });
  } catch (err) { next(err); }
};


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — HISTORY & REPORTING
// ═══════════════════════════════════════════════════════════════════════════════

// ── GET /api/groups/:id/history ───────────────────────────────────────────────
// Returns all membership records for a group, grouped by year.
// Useful for viewing "who was in this group in each year".
exports.getGroupHistory = async (req, res, next) => {
  try {
    const [rows] = await db.execute(`
      SELECT
        gm.year,
        gm.id               AS membership_id,
        gm.role_in_group,
        gm.joined_date,
        gm.left_date,
        gm.status,
        gm.notes,
        u.id                AS member_id,
        u.full_name,
        u.phone,
        u.gender,
        u.avatar,
        u.profile_photo_url
      FROM group_members gm
      JOIN users u ON u.id = gm.member_id
      WHERE gm.group_id = ?
      ORDER BY gm.year DESC, gm.status, gm.role_in_group IS NULL, gm.role_in_group, u.full_name
    `, [req.params.id]);

    // Group by year for a structured response
    const byYear = {};
    for (const row of rows) {
      const y = row.year || 'unknown';
      if (!byYear[y]) byYear[y] = { year: y, members: [], active: 0, former: 0 };
      byYear[y].members.push(row);
      if (row.status === 'active') byYear[y].active++;
      else byYear[y].former++;
    }

    const history = Object.values(byYear).sort((a, b) => {
      if (a.year === 'unknown') return 1;
      if (b.year === 'unknown') return -1;
      return b.year - a.year;
    });

    res.json({
      success: true,
      total_records: rows.length,
      years_covered: history.length,
      data: history,
    });
  } catch (err) { next(err); }
};

// ── GET /api/groups/member/:userId ────────────────────────────────────────────
// All groups a specific member has ever belonged to (across all years).
exports.getMemberGroups = async (req, res, next) => {
  try {
    const { role, id: callerId } = req.user;
    const targetId = parseInt(req.params.userId);

    // Members can only see their own history; managers see all
    if (!ALL_MANAGERS.includes(role) && callerId !== targetId) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const [rows] = await db.execute(`
      SELECT
        gm.id               AS membership_id,
        gm.year,
        gm.role_in_group,
        gm.joined_date,
        gm.left_date,
        gm.status,
        gm.notes,
        g.id                AS group_id,
        g.name              AS group_name,
        g.name_sw           AS group_name_sw,
        g.type              AS group_type,
        g.start_date        AS group_start_date,
        g.end_date          AS group_end_date,
        g.is_archived       AS group_is_archived
      FROM group_members gm
      JOIN \`groups\` g ON g.id = gm.group_id
      WHERE gm.member_id = ?
      ORDER BY gm.year DESC, gm.status, g.type, g.name
    `, [targetId]);

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};