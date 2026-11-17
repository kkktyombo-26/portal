/**
 * meetingsController.js
 * ──────────────────────
 * Vikao na Maazimio — Meetings & Resolutions module
 * Ref: BSS-KKKT-2026-006 + BSS-KKKT-2026-007
 *
 * Scope model:
 *   meetings.group_id IS NULL     → Church-level
 *   meetings.group_id IS NOT NULL → Group-scoped
 *
 * Access model:
 *   pastor / elder     — full CRUD on all meetings
 *   group_leader       — full CRUD on their own group's meetings only
 *   member             — read-only on church-level + their own groups' meetings
 */

const db  = require('../config/db');
const { uploadFileStreamToR2, deleteImageFromR2 } = require('../utils/r2');

// ── Constants ─────────────────────────────────────────────────────────────────

const MANAGERS     = ['pastor', 'elder'];
const ALL_MANAGERS = ['pastor', 'elder', 'group_leader'];

const VALID_STATUSES      = ['scheduled', 'held', 'cancelled', 'postponed'];
const VALID_ATTENDANCE    = ['present', 'apology', 'absent'];
const VALID_RESOLUTION_ST = ['pending', 'in_progress', 'completed', 'cancelled', 'deferred'];
const VALID_DOC_TYPES     = ['minutes', 'agenda', 'report', 'photo', 'other'];

// ── CLIENT_URL — used when building RSVP / attend links ──────────────────────
const CLIENT_URL = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');

// ── Shared SELECT fragment ────────────────────────────────────────────────────

const MEETING_SELECT = `
  SELECT
    m.*,
    g.name                        AS group_name,
    g.type                        AS group_type,
    mt.name_sw                    AS meeting_type_name_sw,
    mt.name_en                    AS meeting_type_name_en,
    mt.scope_default              AS meeting_type_scope,
    conv.full_name                AS convened_by_name,
    sec.full_name                 AS secretary_name,
    COUNT(DISTINCT ma.id)         AS attendee_count,
    COUNT(DISTINCT mr.id)         AS resolution_count,
    SUM(mr.implementation_status IN ('pending','in_progress'))
                                  AS open_resolution_count
  FROM meetings m
  LEFT JOIN \`groups\`       g    ON g.id    = m.group_id
  LEFT JOIN meeting_types    mt   ON mt.id   = m.meeting_type_id
  LEFT JOIN users            conv ON conv.id = m.convened_by_id
  LEFT JOIN users            sec  ON sec.id  = m.secretary_id
  LEFT JOIN meeting_attendees ma  ON ma.meeting_id = m.id
  LEFT JOIN meeting_resolutions mr ON mr.meeting_id = m.id
`;

// ── Helper: may a user manage this meeting? ───────────────────────────────────
function canManageMeeting(user, meeting) {
  if (MANAGERS.includes(user.role)) return true;
  if (user.role === 'group_leader' && meeting.group_id) {
    return user.group_id === meeting.group_id;
  }
  return false;
}

// ── Helper: build scope WHERE clause for a user ───────────────────────────────
async function buildScopeCondition(user) {
  if (MANAGERS.includes(user.role)) {
    return { condition: '1=1', params: [] };
  }

  if (user.role === 'group_leader' && user.group_id) {
    return {
      condition: '(m.group_id IS NULL OR m.group_id = ?)',
      params: [user.group_id],
    };
  }

  // Regular member — church-level + groups they belong to
  const [memberships] = await db.execute(
    `SELECT DISTINCT group_id FROM group_members
     WHERE member_id = ? AND status = 'active'`,
    [user.id]
  );
  const groupIds = memberships.map(r => r.group_id);

  if (!groupIds.length) {
    return { condition: 'm.group_id IS NULL', params: [] };
  }

  const ph = groupIds.map(() => '?').join(', ');
  return {
    condition: `(m.group_id IS NULL OR m.group_id IN (${ph}))`,
    params: groupIds,
  };
}

// ── Helper: build WhatsApp invite message ─────────────────────────────────────
function buildWaMessage(member, meeting, groupName) {
  const scope   = groupName ? `Kikao cha ${groupName}` : 'Kikao cha Kanisa';
  const dateStr = new Date(meeting.meeting_date).toLocaleDateString('sw-TZ', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const timeStr = meeting.start_time ? ` saa ${meeting.start_time.slice(0, 5)}` : '';
  const venue   = meeting.venue ? ` — ${meeting.venue}` : '';
  const link    = `${CLIENT_URL}/dashboard/attend/${meeting.id}`;

  return (
    `Habari ${member.full_name.split(' ')[0]},\n\n` +
    `Unaalikwa kuhudhuria *${scope}*:\n\n` +
    `📋 *${meeting.title}*\n` +
    `📅 ${dateStr}${timeStr}${venue}\n\n` +
    `Tafadhali thibitisha uhudhuria wako kupitia kiungo hiki:\n` +
    `${link}\n\n` +
    `_KKKT Yombo_`
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — MEETING TYPES
// ═══════════════════════════════════════════════════════════════════════════════

exports.getMeetingTypes = async (req, res, next) => {
  try {
    const { scope } = req.query;
    const conditions = ['is_active = 1'];
    const params     = [];

    if (scope) {
      conditions.push('scope_default = ?');
      params.push(scope);
    }

    const [rows] = await db.execute(
      `SELECT * FROM meeting_types WHERE ${conditions.join(' AND ')} ORDER BY sort_order, name_sw`,
      params
    );

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — MEETINGS CRUD
// ═══════════════════════════════════════════════════════════════════════════════

exports.getMeetings = async (req, res, next) => {
  try {
    const { group_id, scope, status, from, to, upcoming } = req.query;

    const { condition: scopeCond, params: scopeParams } =
      await buildScopeCondition(req.user);

    const conditions = [scopeCond];
    const params     = [...scopeParams];

    if (group_id) {
      conditions.push('m.group_id = ?');
      params.push(group_id);
    } else if (scope === 'church') {
      conditions.push('m.group_id IS NULL');
    } else if (scope === 'group') {
      conditions.push('m.group_id IS NOT NULL');
    }

    if (upcoming === '1') {
      conditions.push("m.status = 'scheduled'");
      conditions.push('m.meeting_date >= CURDATE()');
    } else {
      if (status) {
        if (!VALID_STATUSES.includes(status)) {
          return res.status(400).json({
            success: false,
            message: `status must be one of: ${VALID_STATUSES.join(', ')}`,
          });
        }
        conditions.push('m.status = ?');
        params.push(status);
      }
    }

    if (from) { conditions.push('m.meeting_date >= ?'); params.push(from); }
    if (to)   { conditions.push('m.meeting_date <= ?'); params.push(to);   }

    const [rows] = await db.execute(
      `${MEETING_SELECT}
       WHERE ${conditions.join(' AND ')}
       GROUP BY m.id
       ORDER BY m.meeting_date DESC, m.start_time DESC`,
      params
    );

    res.json({ success: true, total: rows.length, data: rows });
  } catch (err) { next(err); }
};

exports.getMeeting = async (req, res, next) => {
  try {
    const [rows] = await db.execute(
      `${MEETING_SELECT} WHERE m.id = ? GROUP BY m.id`,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Meeting not found.' });
    }

    const meeting = rows[0];

    if (!MANAGERS.includes(req.user.role)) {
      const { condition, params } = await buildScopeCondition(req.user);
      const [check] = await db.execute(
        `SELECT id FROM meetings m WHERE m.id = ? AND (${condition})`,
        [req.params.id, ...params]
      );
      if (!check.length) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    }

    res.json({ success: true, data: meeting });
  } catch (err) { next(err); }
};

exports.createMeeting = async (req, res, next) => {
  try {
    const { role } = req.user;

    if (!ALL_MANAGERS.includes(role)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const {
      group_id, meeting_type_id, title, meeting_date,
      start_time, end_time, venue,
      convened_by_id, secretary_id,
      quorum_met, total_attendees,
      agenda, summary,
      status = 'scheduled',
      cancellation_reason,
    } = req.body;

    if (!meeting_type_id) {
      return res.status(400).json({ success: false, message: 'meeting_type_id is required.' });
    }
    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, message: 'title is required.' });
    }
    if (!meeting_date) {
      return res.status(400).json({ success: false, message: 'meeting_date is required.' });
    }
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `status must be one of: ${VALID_STATUSES.join(', ')}`,
      });
    }

    if (role === 'group_leader') {
      if (!group_id) {
        return res.status(403).json({
          success: false,
          message: 'Group leaders cannot create church-level meetings.',
        });
      }
      if (Number(group_id) !== req.user.group_id) {
        return res.status(403).json({
          success: false,
          message: 'You can only create meetings for your own group.',
        });
      }
    }

    const [typeRows] = await db.execute(
      'SELECT id FROM meeting_types WHERE id = ? AND is_active = 1',
      [meeting_type_id]
    );
    if (!typeRows.length) {
      return res.status(400).json({ success: false, message: 'Invalid meeting_type_id.' });
    }

    if (group_id) {
      const [grpRows] = await db.execute(
        'SELECT id FROM `groups` WHERE id = ? AND is_archived = 0',
        [group_id]
      );
      if (!grpRows.length) {
        return res.status(400).json({ success: false, message: 'Group not found or archived.' });
      }
    }

    const [result] = await db.execute(`
      INSERT INTO meetings
        (group_id, meeting_type_id, title, meeting_date,
         start_time, end_time, venue,
         convened_by_id, secretary_id,
         quorum_met, total_attendees,
         agenda, summary, status, cancellation_reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      group_id          || null,
      meeting_type_id,
      String(title).trim(),
      meeting_date,
      start_time        || null,
      end_time          || null,
      venue             || null,
      convened_by_id    || null,
      secretary_id      || null,
      quorum_met        != null ? (quorum_met ? 1 : 0) : null,
      total_attendees   || null,
      agenda            || null,
      summary           || null,
      status,
      cancellation_reason || null,
    ]);

    const [rows] = await db.execute(
      `${MEETING_SELECT} WHERE m.id = ? GROUP BY m.id`,
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: `Meeting "${title}" created.`,
      data:    rows[0],
    });
  } catch (err) { next(err); }
};

exports.updateMeeting = async (req, res, next) => {
  try {
    const [existing] = await db.execute(
      'SELECT * FROM meetings WHERE id = ?', [req.params.id]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Meeting not found.' });
    }
    if (!canManageMeeting(req.user, existing[0])) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const {
      meeting_type_id, title, meeting_date,
      start_time, end_time, venue,
      convened_by_id, secretary_id,
      quorum_met, total_attendees,
      agenda, summary, status,
      cancellation_reason,
    } = req.body;

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `status must be one of: ${VALID_STATUSES.join(', ')}`,
      });
    }

    const fields = [], params = [];

    if (meeting_type_id  !== undefined) { fields.push('meeting_type_id = ?');       params.push(meeting_type_id  || null); }
    if (title            !== undefined) { fields.push('title = ?');                 params.push(String(title).trim()); }
    if (meeting_date     !== undefined) { fields.push('meeting_date = ?');          params.push(meeting_date     || null); }
    if (start_time       !== undefined) { fields.push('start_time = ?');            params.push(start_time       || null); }
    if (end_time         !== undefined) { fields.push('end_time = ?');              params.push(end_time         || null); }
    if (venue            !== undefined) { fields.push('venue = ?');                 params.push(venue            || null); }
    if (convened_by_id   !== undefined) { fields.push('convened_by_id = ?');        params.push(convened_by_id   || null); }
    if (secretary_id     !== undefined) { fields.push('secretary_id = ?');          params.push(secretary_id     || null); }
    if (quorum_met       !== undefined) { fields.push('quorum_met = ?');            params.push(quorum_met != null ? (quorum_met ? 1 : 0) : null); }
    if (total_attendees  !== undefined) { fields.push('total_attendees = ?');       params.push(total_attendees  || null); }
    if (agenda           !== undefined) { fields.push('agenda = ?');                params.push(agenda           || null); }
    if (summary          !== undefined) { fields.push('summary = ?');               params.push(summary          || null); }
    if (status           !== undefined) { fields.push('status = ?');                params.push(status); }
    if (cancellation_reason !== undefined) { fields.push('cancellation_reason = ?'); params.push(cancellation_reason || null); }

    if (!fields.length) {
      return res.status(400).json({ success: false, message: 'No updatable fields provided.' });
    }

    params.push(req.params.id);
    await db.execute(`UPDATE meetings SET ${fields.join(', ')} WHERE id = ?`, params);

    const [rows] = await db.execute(
      `${MEETING_SELECT} WHERE m.id = ? GROUP BY m.id`,
      [req.params.id]
    );

    res.json({ success: true, message: 'Meeting updated.', data: rows[0] });
  } catch (err) { next(err); }
};

exports.deleteMeeting = async (req, res, next) => {
  try {
    if (!MANAGERS.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only pastor or elder can delete meetings.' });
    }

    const [existing] = await db.execute(
      'SELECT id, title FROM meetings WHERE id = ?', [req.params.id]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Meeting not found.' });
    }

    const [docs] = await db.execute(
      'SELECT file_url FROM meeting_documents WHERE meeting_id = ?', [req.params.id]
    );

    await db.execute('DELETE FROM meetings WHERE id = ?', [req.params.id]);

    for (const doc of docs) {
      deleteImageFromR2(doc.file_url).catch(e =>
        console.error(`R2 cleanup failed for ${doc.file_url}:`, e.message)
      );
    }

    res.json({
      success: true,
      message: `Meeting "${existing[0].title}" deleted.`,
      documents_removed: docs.length,
    });
  } catch (err) { next(err); }
};


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — ATTENDEES
// ═══════════════════════════════════════════════════════════════════════════════

exports.getAttendees = async (req, res, next) => {
  try {
    const [rows] = await db.execute(`
      SELECT
        ma.id               AS attendance_id,
        ma.member_id,
        ma.attendance_type,
        ma.role_in_meeting,
        ma.notes,
        ma.rsvp_at,
        ma.confirmed_at,
        ma.confirmed_by_id,
        ma.created_at,
        u.full_name,
        u.phone,
        u.gender,
        u.avatar,
        u.profile_photo_url,
        u.role              AS system_role,
        cb.full_name        AS confirmed_by_name
      FROM meeting_attendees ma
      JOIN users u  ON u.id  = ma.member_id
      LEFT JOIN users cb ON cb.id = ma.confirmed_by_id
      WHERE ma.meeting_id = ?
      ORDER BY
        ma.role_in_meeting IS NOT NULL DESC,
        ma.role_in_meeting,
        u.full_name
    `, [req.params.id]);

    // Summary counts cover all attendance_type variants
    const summary = {
      total:            rows.length,
      // RSVP (self-reported)
      rsvp_yes:         rows.filter(r => r.attendance_type === 'rsvp_yes').length,
      rsvp_apology:     rows.filter(r => r.attendance_type === 'rsvp_apology').length,
      rsvp_no:          rows.filter(r => r.attendance_type === 'rsvp_no').length,
      // Manager-confirmed
      present:          rows.filter(r => r.attendance_type === 'present').length,
      apology:          rows.filter(r => r.attendance_type === 'apology').length,
      absent:           rows.filter(r => r.attendance_type === 'absent').length,
      // Convenience roll-ups
      confirmed_total:  rows.filter(r => r.confirmed_at).length,
      awaiting_confirm: rows.filter(r => r.attendance_type.startsWith('rsvp_') && !r.confirmed_at).length,
    };

    res.json({ success: true, summary, data: rows });
  } catch (err) { next(err); }
};

exports.addAttendee = async (req, res, next) => {
  try {
    const [meeting] = await db.execute(
      'SELECT id, group_id FROM meetings WHERE id = ?', [req.params.id]
    );
    if (!meeting.length) {
      return res.status(404).json({ success: false, message: 'Meeting not found.' });
    }
    if (!canManageMeeting(req.user, meeting[0])) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const { member_id, attendance_type = 'present', role_in_meeting, notes } = req.body;

    if (!member_id) {
      return res.status(400).json({ success: false, message: 'member_id is required.' });
    }
    if (!VALID_ATTENDANCE.includes(attendance_type)) {
      return res.status(400).json({
        success: false,
        message: `attendance_type must be one of: ${VALID_ATTENDANCE.join(', ')}`,
      });
    }

    const [member] = await db.execute(
      'SELECT id, full_name FROM users WHERE id = ?', [member_id]
    );
    if (!member.length) {
      return res.status(404).json({ success: false, message: 'Member not found.' });
    }

    const [dup] = await db.execute(
      'SELECT id FROM meeting_attendees WHERE meeting_id = ? AND member_id = ?',
      [req.params.id, member_id]
    );
    if (dup.length) {
      return res.status(409).json({
        success: false,
        message: `${member[0].full_name} is already recorded for this meeting.`,
        attendance_id: dup[0].id,
      });
    }

    const [result] = await db.execute(`
      INSERT INTO meeting_attendees
        (meeting_id, member_id, attendance_type, role_in_meeting, notes)
      VALUES (?, ?, ?, ?, ?)
    `, [req.params.id, member_id, attendance_type, role_in_meeting || null, notes || null]);

    const [rows] = await db.execute(`
      SELECT ma.*, u.full_name, u.phone, u.gender, u.avatar, u.profile_photo_url
      FROM meeting_attendees ma JOIN users u ON u.id = ma.member_id
      WHERE ma.id = ?
    `, [result.insertId]);

    res.status(201).json({
      success: true,
      message: `${member[0].full_name} added as attendee.`,
      data:    rows[0],
    });
  } catch (err) { next(err); }
};

exports.bulkSyncAttendees = async (req, res, next) => {
  try {
    const [meeting] = await db.execute(
      'SELECT id, group_id FROM meetings WHERE id = ?', [req.params.id]
    );
    if (!meeting.length) {
      return res.status(404).json({ success: false, message: 'Meeting not found.' });
    }
    if (!canManageMeeting(req.user, meeting[0])) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const { attendees = [] } = req.body;

    if (!Array.isArray(attendees)) {
      return res.status(400).json({ success: false, message: 'attendees must be an array.' });
    }

    const meetingId = parseInt(req.params.id);

    await db.execute('DELETE FROM meeting_attendees WHERE meeting_id = ?', [meetingId]);

    if (attendees.length > 0) {
      const ph   = attendees.map(() => '(?, ?, ?, ?, ?)').join(', ');
      const flat = attendees.flatMap(a => [
        meetingId,
        a.member_id,
        VALID_ATTENDANCE.includes(a.attendance_type) ? a.attendance_type : 'present',
        a.role_in_meeting || null,
        a.notes           || null,
      ]);
      await db.execute(
        `INSERT INTO meeting_attendees
           (meeting_id, member_id, attendance_type, role_in_meeting, notes)
         VALUES ${ph}`,
        flat
      );
    }

    const presentCount = attendees.filter(
      a => !a.attendance_type || a.attendance_type === 'present'
    ).length;
    await db.execute(
      'UPDATE meetings SET total_attendees = ? WHERE id = ?',
      [presentCount, meetingId]
    );

    res.json({
      success: true,
      message: `${attendees.length} attendee record(s) saved.`,
      total:   attendees.length,
    });
  } catch (err) { next(err); }
};

exports.updateAttendee = async (req, res, next) => {
  try {
    const [existing] = await db.execute(
      `SELECT ma.*, u.full_name
       FROM meeting_attendees ma JOIN users u ON u.id = ma.member_id
       WHERE ma.id = ? AND ma.meeting_id = ?`,
      [req.params.attendanceId, req.params.id]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Attendance record not found.' });
    }

    const [meeting] = await db.execute(
      'SELECT id, group_id FROM meetings WHERE id = ?', [req.params.id]
    );
    if (!canManageMeeting(req.user, meeting[0])) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const { attendance_type, role_in_meeting, notes } = req.body;

    if (attendance_type && !VALID_ATTENDANCE.includes(attendance_type)) {
      return res.status(400).json({
        success: false,
        message: `attendance_type must be one of: ${VALID_ATTENDANCE.join(', ')}`,
      });
    }

    const fields = [], params = [];
    if (attendance_type !== undefined) { fields.push('attendance_type = ?'); params.push(attendance_type); }
    if (role_in_meeting !== undefined) { fields.push('role_in_meeting = ?'); params.push(role_in_meeting || null); }
    if (notes           !== undefined) { fields.push('notes = ?');           params.push(notes           || null); }

    if (!fields.length) {
      return res.status(400).json({ success: false, message: 'No updatable fields provided.' });
    }

    params.push(req.params.attendanceId);
    await db.execute(`UPDATE meeting_attendees SET ${fields.join(', ')} WHERE id = ?`, params);

    res.json({ success: true, message: `Attendance for ${existing[0].full_name} updated.` });
  } catch (err) { next(err); }
};

exports.removeAttendee = async (req, res, next) => {
  try {
    const [existing] = await db.execute(
      `SELECT ma.*, u.full_name
       FROM meeting_attendees ma JOIN users u ON u.id = ma.member_id
       WHERE ma.id = ? AND ma.meeting_id = ?`,
      [req.params.attendanceId, req.params.id]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Attendance record not found.' });
    }

    const [meeting] = await db.execute(
      'SELECT id, group_id FROM meetings WHERE id = ?', [req.params.id]
    );
    if (!canManageMeeting(req.user, meeting[0])) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    await db.execute('DELETE FROM meeting_attendees WHERE id = ?', [req.params.attendanceId]);

    res.json({ success: true, message: `${existing[0].full_name} removed from attendees.` });
  } catch (err) { next(err); }
};


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — RESOLUTIONS (MAAMUZI)
// ═══════════════════════════════════════════════════════════════════════════════

exports.getResolutions = async (req, res, next) => {
  try {
    const { status } = req.query;
    const conditions = ['mr.meeting_id = ?'];
    const params     = [req.params.id];

    if (status) {
      if (!VALID_RESOLUTION_ST.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `status must be one of: ${VALID_RESOLUTION_ST.join(', ')}`,
        });
      }
      conditions.push('mr.implementation_status = ?');
      params.push(status);
    }

    const [rows] = await db.execute(`
      SELECT mr.*, u.full_name AS responsible_name, u.phone AS responsible_phone
      FROM meeting_resolutions mr
      LEFT JOIN users u ON u.id = mr.responsible_member_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY mr.resolution_number ASC
    `, params);

    res.json({ success: true, total: rows.length, data: rows });
  } catch (err) { next(err); }
};

exports.addResolution = async (req, res, next) => {
  try {
    const [meeting] = await db.execute(
      'SELECT id, group_id FROM meetings WHERE id = ?', [req.params.id]
    );
    if (!meeting.length) {
      return res.status(404).json({ success: false, message: 'Meeting not found.' });
    }
    if (!canManageMeeting(req.user, meeting[0])) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const {
      resolution_number, description,
      responsible_member_id, responsible_note,
      deadline, implementation_status = 'pending', progress_notes,
    } = req.body;

    if (!description || !String(description).trim()) {
      return res.status(400).json({ success: false, message: 'description is required.' });
    }

    let resolvedNumber = resolution_number;
    if (!resolvedNumber) {
      const [[{ max_num }]] = await db.execute(
        'SELECT COALESCE(MAX(resolution_number), 0) AS max_num FROM meeting_resolutions WHERE meeting_id = ?',
        [req.params.id]
      );
      resolvedNumber = max_num + 1;
    }

    const [dup] = await db.execute(
      'SELECT id FROM meeting_resolutions WHERE meeting_id = ? AND resolution_number = ?',
      [req.params.id, resolvedNumber]
    );
    if (dup.length) {
      return res.status(409).json({
        success: false,
        message: `Resolution #${resolvedNumber} already exists for this meeting.`,
      });
    }

    const [result] = await db.execute(`
      INSERT INTO meeting_resolutions
        (meeting_id, resolution_number, description,
         responsible_member_id, responsible_note,
         deadline, implementation_status, progress_notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      req.params.id, resolvedNumber, String(description).trim(),
      responsible_member_id || null, responsible_note || null,
      deadline || null, implementation_status, progress_notes || null,
    ]);

    const [rows] = await db.execute(`
      SELECT mr.*, u.full_name AS responsible_name
      FROM meeting_resolutions mr
      LEFT JOIN users u ON u.id = mr.responsible_member_id
      WHERE mr.id = ?
    `, [result.insertId]);

    res.status(201).json({
      success: true,
      message: `Resolution #${resolvedNumber} added.`,
      data:    rows[0],
    });
  } catch (err) { next(err); }
};

exports.updateResolution = async (req, res, next) => {
  try {
    const [existing] = await db.execute(
      'SELECT * FROM meeting_resolutions WHERE id = ? AND meeting_id = ?',
      [req.params.resolutionId, req.params.id]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Resolution not found.' });
    }

    const [meeting] = await db.execute(
      'SELECT id, group_id FROM meetings WHERE id = ?', [req.params.id]
    );
    if (!canManageMeeting(req.user, meeting[0])) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const {
      description, responsible_member_id, responsible_note,
      deadline, implementation_status, completion_date, progress_notes,
    } = req.body;

    if (implementation_status && !VALID_RESOLUTION_ST.includes(implementation_status)) {
      return res.status(400).json({
        success: false,
        message: `implementation_status must be one of: ${VALID_RESOLUTION_ST.join(', ')}`,
      });
    }

    const fields = [], params = [];
    if (description           !== undefined) { fields.push('description = ?');             params.push(String(description).trim()); }
    if (responsible_member_id !== undefined) { fields.push('responsible_member_id = ?');   params.push(responsible_member_id  || null); }
    if (responsible_note      !== undefined) { fields.push('responsible_note = ?');        params.push(responsible_note       || null); }
    if (deadline              !== undefined) { fields.push('deadline = ?');                params.push(deadline               || null); }
    if (implementation_status !== undefined) { fields.push('implementation_status = ?');   params.push(implementation_status); }
    if (completion_date       !== undefined) { fields.push('completion_date = ?');         params.push(completion_date        || null); }
    if (progress_notes        !== undefined) { fields.push('progress_notes = ?');          params.push(progress_notes         || null); }

    if (implementation_status === 'completed' && !completion_date && !existing[0].completion_date) {
      fields.push('completion_date = ?');
      params.push(new Date().toISOString().slice(0, 10));
    }

    if (!fields.length) {
      return res.status(400).json({ success: false, message: 'No updatable fields provided.' });
    }

    params.push(req.params.resolutionId);
    await db.execute(`UPDATE meeting_resolutions SET ${fields.join(', ')} WHERE id = ?`, params);

    const [rows] = await db.execute(`
      SELECT mr.*, u.full_name AS responsible_name
      FROM meeting_resolutions mr
      LEFT JOIN users u ON u.id = mr.responsible_member_id
      WHERE mr.id = ?
    `, [req.params.resolutionId]);

    res.json({ success: true, message: 'Resolution updated.', data: rows[0] });
  } catch (err) { next(err); }
};

exports.deleteResolution = async (req, res, next) => {
  try {
    if (!MANAGERS.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only pastor or elder can delete resolutions.' });
    }

    const [existing] = await db.execute(
      'SELECT id, resolution_number FROM meeting_resolutions WHERE id = ? AND meeting_id = ?',
      [req.params.resolutionId, req.params.id]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Resolution not found.' });
    }

    await db.execute('DELETE FROM meeting_resolutions WHERE id = ?', [req.params.resolutionId]);

    res.json({ success: true, message: `Resolution #${existing[0].resolution_number} deleted.` });
  } catch (err) { next(err); }
};


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5 — DOCUMENTS
// ═══════════════════════════════════════════════════════════════════════════════

exports.getDocuments = async (req, res, next) => {
  try {
    const [rows] = await db.execute(`
      SELECT md.*, u.full_name AS uploaded_by_name
      FROM meeting_documents md
      LEFT JOIN users u ON u.id = md.uploaded_by_id
      WHERE md.meeting_id = ?
      ORDER BY md.document_type, md.uploaded_at DESC
    `, [req.params.id]);

    res.json({ success: true, total: rows.length, data: rows });
  } catch (err) { next(err); }
};

exports.uploadDocument = async (req, res, next) => {
  try {
    const [meeting] = await db.execute(
      'SELECT id, group_id FROM meetings WHERE id = ?', [req.params.id]
    );
    if (!meeting.length) {
      return res.status(404).json({ success: false, message: 'Meeting not found.' });
    }
    if (!canManageMeeting(req.user, meeting[0])) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const { document_type = 'minutes', title } = req.body;

    if (!VALID_DOC_TYPES.includes(document_type)) {
      return res.status(400).json({
        success: false,
        message: `document_type must be one of: ${VALID_DOC_TYPES.join(', ')}`,
      });
    }

    const fileUrl      = await uploadFileStreamToR2(req.file, 'meetings/documents', 'pdf');
    const displayTitle = title ? String(title).trim() : req.file.originalname;

    const [result] = await db.execute(`
      INSERT INTO meeting_documents
        (meeting_id, document_type, title, file_url, file_size_kb, mime_type, uploaded_by_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      req.params.id,
      document_type,
      displayTitle,
      fileUrl,
      req.file.size ? Math.ceil(req.file.size / 1024) : null,
      req.file.mimetype || null,
      req.user.id,
    ]);

    const [rows] = await db.execute(`
      SELECT md.*, u.full_name AS uploaded_by_name
      FROM meeting_documents md
      LEFT JOIN users u ON u.id = md.uploaded_by_id
      WHERE md.id = ?
    `, [result.insertId]);

    res.status(201).json({ success: true, message: `Document "${displayTitle}" uploaded.`, data: rows[0] });
  } catch (err) { next(err); }
};

exports.deleteDocument = async (req, res, next) => {
  try {
    const [existing] = await db.execute(
      'SELECT * FROM meeting_documents WHERE id = ? AND meeting_id = ?',
      [req.params.documentId, req.params.id]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Document not found.' });
    }

    const [meeting] = await db.execute(
      'SELECT id, group_id FROM meetings WHERE id = ?', [req.params.id]
    );
    if (!canManageMeeting(req.user, meeting[0])) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    await db.execute('DELETE FROM meeting_documents WHERE id = ?', [req.params.documentId]);

    deleteImageFromR2(existing[0].file_url).catch(e =>
      console.error(`R2 cleanup failed for ${existing[0].file_url}:`, e.message)
    );

    res.json({ success: true, message: `Document "${existing[0].title}" deleted.` });
  } catch (err) { next(err); }
};


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6 — DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

exports.getOpenResolutions = async (req, res, next) => {
  try {
    const { overdue, group_id } = req.query;

    const { condition: scopeCond, params: scopeParams } =
      await buildScopeCondition(req.user);

    const conditions = [
      scopeCond,
      "mr.implementation_status IN ('pending','in_progress')",
    ];
    const params = [...scopeParams];

    if (overdue === '1') {
      conditions.push('mr.deadline < CURDATE()');
      conditions.push('mr.deadline IS NOT NULL');
    }
    if (group_id) {
      conditions.push('m.group_id = ?');
      params.push(group_id);
    }

    const [rows] = await db.execute(`
      SELECT
        mr.*,
        m.title           AS meeting_title,
        m.meeting_date,
        m.group_id,
        g.name            AS group_name,
        g.type            AS group_type,
        ru.full_name      AS responsible_name,
        ru.phone          AS responsible_phone,
        CASE
          WHEN mr.deadline IS NULL                                       THEN 'no_deadline'
          WHEN mr.deadline < CURDATE()                                   THEN 'overdue'
          WHEN mr.deadline <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)       THEN 'due_soon'
          ELSE 'on_track'
        END AS urgency
      FROM meeting_resolutions mr
      JOIN meetings m     ON m.id  = mr.meeting_id
      LEFT JOIN \`groups\` g ON g.id  = m.group_id
      LEFT JOIN users     ru ON ru.id = mr.responsible_member_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY
        CASE urgency WHEN 'overdue' THEN 1 WHEN 'due_soon' THEN 2 WHEN 'on_track' THEN 3 ELSE 4 END,
        mr.deadline ASC,
        m.meeting_date DESC
    `, params);

    const summary = {
      total:       rows.length,
      overdue:     rows.filter(r => r.urgency === 'overdue').length,
      due_soon:    rows.filter(r => r.urgency === 'due_soon').length,
      on_track:    rows.filter(r => r.urgency === 'on_track').length,
      no_deadline: rows.filter(r => r.urgency === 'no_deadline').length,
    };

    res.json({ success: true, summary, data: rows });
  } catch (err) { next(err); }
};

exports.getUpcomingMeetings = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 5, 20);

    const { condition: scopeCond, params: scopeParams } =
      await buildScopeCondition(req.user);

    const [rows] = await db.execute(
      `${MEETING_SELECT}
       WHERE (${scopeCond})
         AND m.status       = 'scheduled'
         AND m.meeting_date >= CURDATE()
       GROUP BY m.id
       ORDER BY m.meeting_date ASC, m.start_time ASC
       LIMIT ${limit}`,
      scopeParams
    );

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7 — SEND INVITES
// ═══════════════════════════════════════════════════════════════════════════════

exports.sendInvites = async (req, res, next) => {
  try {
    const { role } = req.user;
    if (!ALL_MANAGERS.includes(role)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const meetingId = parseInt(req.params.id);

    const [meetingRows] = await db.execute(
      `SELECT m.*, g.name AS group_name
       FROM meetings m
       LEFT JOIN \`groups\` g ON g.id = m.group_id
       WHERE m.id = ?`,
      [meetingId]
    );
    if (!meetingRows.length) {
      return res.status(404).json({ success: false, message: 'Meeting not found.' });
    }
    const meeting = meetingRows[0];

    if (role === 'group_leader' && meeting.group_id && meeting.group_id !== req.user.group_id) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const { member_ids, scope, jumuiya_name, resend = false } = req.body;

    let targetMembers = [];

    if (Array.isArray(member_ids) && member_ids.length > 0) {
      const ph = member_ids.map(() => '?').join(', ');
      const [rows] = await db.execute(
        `SELECT id, full_name, phone FROM users WHERE id IN (${ph}) AND member_status = 'hai'`,
        member_ids
      );
      targetMembers = rows;
    } else if (scope === 'group' && meeting.group_id) {
      const [rows] = await db.execute(
        `SELECT u.id, u.full_name, u.phone
         FROM group_members gm
         JOIN users u ON u.id = gm.member_id
         WHERE gm.group_id = ? AND gm.status = 'active' AND u.member_status = 'hai'`,
        [meeting.group_id]
      );
      targetMembers = rows;
    } else if (scope === 'church') {
      const [rows] = await db.execute(
        `SELECT id, full_name, phone FROM users WHERE member_status = 'hai' AND role != 'admin'`
      );
      targetMembers = rows;
    } else if (scope === 'jumuiya' && jumuiya_name) {
      const [rows] = await db.execute(
        `SELECT id, full_name, phone FROM users WHERE jumuiya = ? AND member_status = 'hai'`,
        [jumuiya_name]
      );
      targetMembers = rows;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Provide member_ids or a valid scope (group | church | jumuiya).',
      });
    }

    if (!targetMembers.length) {
      return res.status(400).json({ success: false, message: 'No eligible members found.' });
    }

    let toInvite = targetMembers;
    if (!resend) {
      const [alreadyInvited] = await db.execute(
        `SELECT member_id FROM meeting_attendance_invites WHERE meeting_id = ?`,
        [meetingId]
      );
      const invitedSet = new Set(alreadyInvited.map(r => r.member_id));
      toInvite = targetMembers.filter(m => !invitedSet.has(m.id));
    }

    if (!toInvite.length) {
      return res.status(200).json({
        success: true,
        message: 'Wanachama wote wameshainvitiwa tayari. Tumia resend=true kutuma tena.',
        sent: 0,
        skipped: targetMembers.length,
      });
    }

    const withPhone    = toInvite.filter(m => m.phone);
    const withoutPhone = toInvite.filter(m => !m.phone);

    let sent = 0, failed = 0;
    const failedMembers = [];

    let sendWA = null;
    try {
      const waUtil = require('../utils/whatsapp');
      sendWA = waUtil.sendMessage || waUtil.sendWA || waUtil.send || null;
    } catch { /* WA utility not available — record invites only */ }

    for (const member of withPhone) {
      const message    = buildWaMessage(member, meeting, meeting.group_name);
      let dispatched   = false;

      if (sendWA) {
        try {
          await sendWA(member.phone, message);
          dispatched = true;
        } catch (err) {
          console.error(`WA send failed for ${member.full_name} (${member.phone}):`, err.message);
          failed++;
          failedMembers.push({ id: member.id, name: member.full_name, reason: err.message });
        }
      } else {
        dispatched = true; // record invite; caller handles delivery
      }

      if (dispatched) {
        await db.execute(
          `INSERT INTO meeting_attendance_invites
             (meeting_id, member_id, channel, sent_by_id, sent_at)
           VALUES (?, ?, 'wa', ?, NOW())
           ON DUPLICATE KEY UPDATE sent_at = NOW(), sent_by_id = ?`,
          [meetingId, member.id, req.user.id, req.user.id]
        );
        sent++;
      }
    }

    for (const member of withoutPhone) {
      await db.execute(
        `INSERT INTO meeting_attendance_invites
           (meeting_id, member_id, channel, sent_by_id, sent_at)
         VALUES (?, ?, 'wa', ?, NOW())
         ON DUPLICATE KEY UPDATE sent_at = NOW(), sent_by_id = ?`,
        [meetingId, member.id, req.user.id, req.user.id]
      );
    }

    res.json({
      success: true,
      message: `Mialiko imetumwa kwa ${sent} mwanachama.`,
      summary: {
        total_targeted:  toInvite.length,
        sent,
        no_phone:        withoutPhone.length,
        failed,
        already_invited: targetMembers.length - toInvite.length,
      },
      failed_members: failedMembers.length ? failedMembers : undefined,
      rsvp_link: `${CLIENT_URL}/attend/${meetingId}`,
    });
  } catch (err) { next(err); }
};


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 8 — RSVP SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════

exports.getRsvpSummary = async (req, res, next) => {
  try {
    const meetingId = req.params.id;

    const [[inviteSummary]] = await db.execute(
      `SELECT
         COUNT(*)                          AS total_invited,
         SUM(responded_at IS NOT NULL)     AS total_responded,
         SUM(responded_at IS NULL)         AS total_pending
       FROM meeting_attendance_invites
       WHERE meeting_id = ?`,
      [meetingId]
    );

    const [rsvpBreakdown] = await db.execute(
      `SELECT attendance_type, COUNT(*) AS cnt
       FROM meeting_attendees
       WHERE meeting_id = ?
       GROUP BY attendance_type`,
      [meetingId]
    );

    const breakdown = {
      rsvp_yes: 0, rsvp_apology: 0, rsvp_no: 0,
      present:  0, apology:      0, absent:  0,
    };
    rsvpBreakdown.forEach(r => {
      if (r.attendance_type in breakdown) breakdown[r.attendance_type] = r.cnt;
    });

    res.json({
      success: true,
      data: {
        invited:           inviteSummary.total_invited   || 0,
        responded:         inviteSummary.total_responded || 0,
        awaiting_rsvp:     inviteSummary.total_pending   || 0,
        rsvp_yes:          breakdown.rsvp_yes,
        rsvp_apology:      breakdown.rsvp_apology,
        rsvp_no:           breakdown.rsvp_no,
        confirmed_present: breakdown.present,
        confirmed_apology: breakdown.apology,
        confirmed_absent:  breakdown.absent,
        rsvp_link:         `${CLIENT_URL}/attend/${meetingId}`,
      },
    });
  } catch (err) { next(err); }
};


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 9 — MEMBER SELF-RSVP
// ═══════════════════════════════════════════════════════════════════════════════

exports.getMyRsvp = async (req, res, next) => {
  try {
    const meetingId = req.params.id;
    const memberId  = req.user.id;

    const [meetingRows] = await db.execute(
      `SELECT id, title, meeting_date, start_time, end_time, venue,
              group_id, status,
              (SELECT name     FROM \`groups\`    WHERE id = meetings.group_id)        AS group_name,
              (SELECT name_sw  FROM meeting_types WHERE id = meetings.meeting_type_id) AS type_name
       FROM meetings WHERE id = ?`,
      [meetingId]
    );
    if (!meetingRows.length) {
      return res.status(404).json({ success: false, message: 'Kikao hakikupatikana.' });
    }

    const [inviteRows] = await db.execute(
      `SELECT id, sent_at, responded_at
       FROM meeting_attendance_invites
       WHERE meeting_id = ? AND member_id = ?`,
      [meetingId, memberId]
    );

    const [attendeeRows] = await db.execute(
      `SELECT id AS attendance_id, attendance_type, role_in_meeting,
              rsvp_at, confirmed_at
       FROM meeting_attendees
       WHERE meeting_id = ? AND member_id = ?`,
      [meetingId, memberId]
    );

    res.json({
      success: true,
      data: {
        meeting:   meetingRows[0],
        invited:   inviteRows.length > 0,
        invite:    inviteRows[0]   || null,
        attendee:  attendeeRows[0] || null,
        rsvp_link: `${CLIENT_URL}/attend/${meetingId}`,
      },
    });
  } catch (err) { next(err); }
};

exports.submitRsvp = async (req, res, next) => {
  try {
    const meetingId = parseInt(req.params.id);
    const memberId  = req.user.id;
    const { response } = req.body;

    const VALID_RSVP = ['rsvp_yes', 'rsvp_apology', 'rsvp_no'];
    if (!VALID_RSVP.includes(response)) {
      return res.status(400).json({
        success: false,
        message: `response lazima iwe moja ya: ${VALID_RSVP.join(', ')}`,
      });
    }

    const [meetingRows] = await db.execute(
      'SELECT id, title, status FROM meetings WHERE id = ?', [meetingId]
    );
    if (!meetingRows.length) {
      return res.status(404).json({ success: false, message: 'Kikao hakikupatikana.' });
    }
    if (meetingRows[0].status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Kikao hiki kimefutwa.' });
    }

    const [existing] = await db.execute(
      'SELECT id, attendance_type, confirmed_at FROM meeting_attendees WHERE meeting_id = ? AND member_id = ?',
      [meetingId, memberId]
    );

    if (existing.length && existing[0].confirmed_at) {
      return res.status(400).json({
        success: false,
        message: 'Uhudhuria wako umeshathitishwa na kiongozi. Huwezi kubadilisha tena.',
        current: existing[0].attendance_type,
      });
    }

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    if (existing.length) {
      await db.execute(
        `UPDATE meeting_attendees SET attendance_type = ?, rsvp_at = ? WHERE meeting_id = ? AND member_id = ?`,
        [response, now, meetingId, memberId]
      );
    } else {
      await db.execute(
        `INSERT INTO meeting_attendees (meeting_id, member_id, attendance_type, rsvp_at) VALUES (?, ?, ?, ?)`,
        [meetingId, memberId, response, now]
      );
    }

    await db.execute(
      `UPDATE meeting_attendance_invites
       SET responded_at = ?
       WHERE meeting_id = ? AND member_id = ? AND responded_at IS NULL`,
      [now, meetingId, memberId]
    );

    const labels = { rsvp_yes: 'Nitahudhuria', rsvp_apology: 'Sitatoa Udhuru', rsvp_no: 'Sitahudhuria' };

    res.json({
      success: true,
      message: `Jibu lako limehifadhiwa: "${labels[response]}".`,
      data: { meeting_id: meetingId, member_id: memberId, attendance_type: response, rsvp_at: now },
    });
  } catch (err) { next(err); }
};


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 10 — MANAGER CONFIRMATION
// ═══════════════════════════════════════════════════════════════════════════════

exports.confirmAttendee = async (req, res, next) => {
  try {
    if (!ALL_MANAGERS.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const meetingId    = parseInt(req.params.id);
    const attendanceId = parseInt(req.params.attendanceId);

    const [existing] = await db.execute(
      `SELECT ma.*, u.full_name
       FROM meeting_attendees ma
       JOIN users u ON u.id = ma.member_id
       WHERE ma.id = ? AND ma.meeting_id = ?`,
      [attendanceId, meetingId]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Rekodi ya uhudhuria haikupatikana.' });
    }

    const { attendance_type } = req.body;
    const CONFIRMED_TYPES = ['present', 'apology', 'absent'];

    if (!CONFIRMED_TYPES.includes(attendance_type)) {
      return res.status(400).json({
        success: false,
        message: `attendance_type lazima iwe moja ya: ${CONFIRMED_TYPES.join(', ')}`,
      });
    }

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    await db.execute(
      `UPDATE meeting_attendees
       SET attendance_type = ?, confirmed_at = ?, confirmed_by_id = ?
       WHERE id = ?`,
      [attendance_type, now, req.user.id, attendanceId]
    );

    await db.execute(
      `UPDATE meeting_attendance_invites
       SET responded_at = ?
       WHERE meeting_id = ? AND member_id = ? AND responded_at IS NULL`,
      [now, meetingId, existing[0].member_id]
    );

    res.json({
      success: true,
      message: `Uhudhuria wa ${existing[0].full_name} umethibitishwa kama "${attendance_type}".`,
      data: { attendance_id: attendanceId, full_name: existing[0].full_name, attendance_type, confirmed_at: now, confirmed_by_id: req.user.id },
    });
  } catch (err) { next(err); }
};

exports.confirmAll = async (req, res, next) => {
  try {
    if (!ALL_MANAGERS.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const meetingId = parseInt(req.params.id);
    const now       = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const [result] = await db.execute(
      `UPDATE meeting_attendees
       SET attendance_type = 'present', confirmed_at = ?, confirmed_by_id = ?
       WHERE meeting_id = ? AND attendance_type = 'rsvp_yes' AND confirmed_at IS NULL`,
      [now, req.user.id, meetingId]
    );

    res.json({
      success:   true,
      message:   `${result.affectedRows} mhudhuria wamethibitishwa kama "present".`,
      confirmed: result.affectedRows,
    });
  } catch (err) { next(err); }
};