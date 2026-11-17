/**
 * meetingController.js
 * ─────────────────────
 * Vikao na Maazimio — Meetings & Resolutions module
 * Ref: BSS-KKKT-2026-006
 *
 * Scope model (matches migrate-meetings.js):
 *   meetings.group_id IS NULL     → Church-level  (Mkutano Mkuu, Baraza la Usharika …)
 *   meetings.group_id IS NOT NULL → Group-scoped  (Kamati, Kwaya, Umoja session …)
 *
 * Access model:
 *   pastor / elder     — full CRUD on all meetings (church + all groups)
 *   group_leader       — full CRUD on their own group's meetings only
 *   member             — read-only on church-level + their own groups' meetings
 *
 * Document uploads use the existing R2 infrastructure (uploadFileStreamToR2).
 *
 * Sections:
 *   1. Meeting Types  (catalogue — read-only for most, seeded at migration)
 *   2. Meetings       (CRUD + scope filtering)
 *   3. Attendees      (per-meeting attendance)
 *   4. Resolutions    (maamuzi — per-meeting decisions with status tracking)
 *   5. Documents      (minutes PDF + other file attachments via R2)
 *   6. Dashboard      (open resolutions, upcoming meetings)
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
  LEFT JOIN \`groups\`     g    ON g.id  = m.group_id
  LEFT JOIN meeting_types  mt   ON mt.id = m.meeting_type_id
  LEFT JOIN users          conv ON conv.id = m.convened_by_id
  LEFT JOIN users          sec  ON sec.id  = m.secretary_id
  LEFT JOIN meeting_attendees ma ON ma.meeting_id = m.id
  LEFT JOIN meeting_resolutions mr ON mr.meeting_id = m.id
`;

// ── Helper: check whether a user may manage a specific meeting ────────────────
// Returns true if the user is pastor/elder, or is group_leader for the
// meeting's group. For church-level meetings (group_id = null) only
// pastor/elder may manage.
function canManageMeeting(user, meeting) {
  if (MANAGERS.includes(user.role)) return true;
  if (user.role === 'group_leader' && meeting.group_id) {
    return user.group_id === meeting.group_id;
  }
  return false;
}

// ── Helper: build the scope WHERE clause for a given user ─────────────────────
// pastor/elder → all meetings
// group_leader → church-level + their group's meetings
// member       → church-level + groups they belong to
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

  // Regular member — church-level + groups they're active in
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


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — MEETING TYPES
// ═══════════════════════════════════════════════════════════════════════════════

// ── GET /api/meetings/types ───────────────────────────────────────────────────
exports.getMeetingTypes = async (req, res, next) => {
  try {
    const { scope } = req.query; // ?scope=church|group|both

    const conditions = ['is_active = 1'];
    const params     = [];

    if (scope) {
      conditions.push('scope_default = ?');
      params.push(scope);
    }

    const [rows] = await db.execute(
      `SELECT * FROM meeting_types
       WHERE ${conditions.join(' AND ')}
       ORDER BY sort_order, name_sw`,
      params
    );

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — MEETINGS CRUD
// ═══════════════════════════════════════════════════════════════════════════════

// ── GET /api/meetings ─────────────────────────────────────────────────────────
// Query params:
//   ?group_id=<id>       filter to a specific group (omit = all accessible)
//   ?scope=church|group  'church' = group_id IS NULL only; 'group' = group_id NOT NULL only
//   ?status=scheduled|held|cancelled|postponed
//   ?from=YYYY-MM-DD     meeting_date range start
//   ?to=YYYY-MM-DD       meeting_date range end
//   ?upcoming=1          shortcut: status=scheduled AND meeting_date >= today
exports.getMeetings = async (req, res, next) => {
  try {
    console.log('req.user →', req.user);
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

    const where = `WHERE ${conditions.join(' AND ')}`;

    const [rows] = await db.execute(
      `${MEETING_SELECT}
       ${where}
       GROUP BY m.id
       ORDER BY m.meeting_date DESC, m.start_time DESC`,
      params
    );

    res.json({ success: true, total: rows.length, data: rows });
  } catch (err) { next(err); }
};

// ── GET /api/meetings/:id ─────────────────────────────────────────────────────
exports.getMeeting = async (req, res, next) => {
  try {
    const [rows] = await db.execute(
      `${MEETING_SELECT}
       WHERE m.id = ?
       GROUP BY m.id`,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Meeting not found.' });
    }

    // Check read access
    const meeting = rows[0];
    if (!MANAGERS.includes(req.user.role)) {
      const { condition, params } = await buildScopeCondition(req.user);
      // Quick check: if meeting is in scope
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

// ── POST /api/meetings ────────────────────────────────────────────────────────
exports.createMeeting = async (req, res, next) => {
  try {
    const { role } = req.user;

    if (!ALL_MANAGERS.includes(role)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const {
      group_id,
      meeting_type_id,
      title,
      meeting_date,
      start_time,
      end_time,
      venue,
      convened_by_id,
      secretary_id,
      quorum_met,
      total_attendees,
      agenda,
      summary,
      status = 'scheduled',
      cancellation_reason,
    } = req.body;

    // Validation
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

    // group_leader can only create meetings for their own group
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

    // Verify meeting_type exists
    const [typeRows] = await db.execute(
      'SELECT id FROM meeting_types WHERE id = ? AND is_active = 1',
      [meeting_type_id]
    );
    if (!typeRows.length) {
      return res.status(400).json({ success: false, message: 'Invalid meeting_type_id.' });
    }

    // Verify group exists (if scoped)
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

// ── PUT /api/meetings/:id ─────────────────────────────────────────────────────
exports.updateMeeting = async (req, res, next) => {
  try {
    const [existing] = await db.execute(
      'SELECT * FROM meetings WHERE id = ?',
      [req.params.id]
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

    if (meeting_type_id  !== undefined) { fields.push('meeting_type_id = ?');   params.push(meeting_type_id  || null); }
    if (title            !== undefined) { fields.push('title = ?');             params.push(String(title).trim()); }
    if (meeting_date     !== undefined) { fields.push('meeting_date = ?');      params.push(meeting_date     || null); }
    if (start_time       !== undefined) { fields.push('start_time = ?');        params.push(start_time       || null); }
    if (end_time         !== undefined) { fields.push('end_time = ?');          params.push(end_time         || null); }
    if (venue            !== undefined) { fields.push('venue = ?');             params.push(venue            || null); }
    if (convened_by_id   !== undefined) { fields.push('convened_by_id = ?');    params.push(convened_by_id   || null); }
    if (secretary_id     !== undefined) { fields.push('secretary_id = ?');      params.push(secretary_id     || null); }
    if (quorum_met       !== undefined) { fields.push('quorum_met = ?');        params.push(quorum_met != null ? (quorum_met ? 1 : 0) : null); }
    if (total_attendees  !== undefined) { fields.push('total_attendees = ?');   params.push(total_attendees  || null); }
    if (agenda           !== undefined) { fields.push('agenda = ?');            params.push(agenda           || null); }
    if (summary          !== undefined) { fields.push('summary = ?');           params.push(summary          || null); }
    if (status           !== undefined) { fields.push('status = ?');            params.push(status); }
    if (cancellation_reason !== undefined) { fields.push('cancellation_reason = ?'); params.push(cancellation_reason || null); }

    if (!fields.length) {
      return res.status(400).json({ success: false, message: 'No updatable fields provided.' });
    }

    params.push(req.params.id);
    await db.execute(
      `UPDATE meetings SET ${fields.join(', ')} WHERE id = ?`,
      params
    );

    const [rows] = await db.execute(
      `${MEETING_SELECT} WHERE m.id = ? GROUP BY m.id`,
      [req.params.id]
    );

    res.json({ success: true, message: 'Meeting updated.', data: rows[0] });
  } catch (err) { next(err); }
};

// ── DELETE /api/meetings/:id ──────────────────────────────────────────────────
// Cascades: attendees, resolutions, documents are deleted by FK cascade.
// Hard delete — pastor/elder only.
exports.deleteMeeting = async (req, res, next) => {
  try {
    if (!MANAGERS.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only pastor or elder can delete meetings.' });
    }

    const [existing] = await db.execute(
      'SELECT id, title FROM meetings WHERE id = ?',
      [req.params.id]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Meeting not found.' });
    }

    // Fetch document URLs before cascade-delete so we can clean R2
    const [docs] = await db.execute(
      'SELECT file_url FROM meeting_documents WHERE meeting_id = ?',
      [req.params.id]
    );

    await db.execute('DELETE FROM meetings WHERE id = ?', [req.params.id]);

    // Best-effort R2 cleanup (don't block on failure)
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

// ── GET /api/meetings/:id/attendees ───────────────────────────────────────────
exports.getAttendees = async (req, res, next) => {
  try {
    const [rows] = await db.execute(`
      SELECT
        ma.id             AS attendance_id,
        ma.member_id,
        ma.attendance_type,
        ma.role_in_meeting,
        ma.notes,
        ma.created_at,
        u.full_name,
        u.phone,
        u.gender,
        u.avatar,
        u.profile_photo_url,
        u.role            AS system_role
      FROM meeting_attendees ma
      JOIN users u ON u.id = ma.member_id
      WHERE ma.meeting_id = ?
      ORDER BY
        ma.role_in_meeting IS NOT NULL DESC,
        ma.role_in_meeting,
        u.full_name
    `, [req.params.id]);

    const summary = {
      total:   rows.length,
      present: rows.filter(r => r.attendance_type === 'present').length,
      apology: rows.filter(r => r.attendance_type === 'apology').length,
      absent:  rows.filter(r => r.attendance_type === 'absent').length,
    };

    res.json({ success: true, summary, data: rows });
  } catch (err) { next(err); }
};

// ── POST /api/meetings/:id/attendees ──────────────────────────────────────────
// Add a single attendee. For bulk import use /attendees/bulk.
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

    // Check duplicate
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

// ── POST /api/meetings/:id/attendees/bulk ─────────────────────────────────────
// Bulk-replace attendee list.
// Body: { attendees: [{ member_id, attendance_type, role_in_meeting, notes }] }
// Existing records not in the new list are DELETED.
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

    // Clear existing
    await db.execute('DELETE FROM meeting_attendees WHERE meeting_id = ?', [meetingId]);

    // Insert new
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

    // Update total_attendees on the meeting row
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

// ── PUT /api/meetings/:id/attendees/:attendanceId ─────────────────────────────
exports.updateAttendee = async (req, res, next) => {
  try {
    const [existing] = await db.execute(
      'SELECT ma.*, u.full_name FROM meeting_attendees ma JOIN users u ON u.id = ma.member_id WHERE ma.id = ? AND ma.meeting_id = ?',
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
    if (attendance_type  !== undefined) { fields.push('attendance_type = ?');  params.push(attendance_type); }
    if (role_in_meeting  !== undefined) { fields.push('role_in_meeting = ?');  params.push(role_in_meeting || null); }
    if (notes            !== undefined) { fields.push('notes = ?');            params.push(notes           || null); }

    if (!fields.length) {
      return res.status(400).json({ success: false, message: 'No updatable fields provided.' });
    }

    params.push(req.params.attendanceId);
    await db.execute(`UPDATE meeting_attendees SET ${fields.join(', ')} WHERE id = ?`, params);

    res.json({ success: true, message: `Attendance for ${existing[0].full_name} updated.` });
  } catch (err) { next(err); }
};

// ── DELETE /api/meetings/:id/attendees/:attendanceId ─────────────────────────
exports.removeAttendee = async (req, res, next) => {
  try {
    const [existing] = await db.execute(
      'SELECT ma.*, u.full_name FROM meeting_attendees ma JOIN users u ON u.id = ma.member_id WHERE ma.id = ? AND ma.meeting_id = ?',
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

    res.json({
      success: true,
      message: `${existing[0].full_name} removed from attendees.`,
    });
  } catch (err) { next(err); }
};


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — RESOLUTIONS (MAAMUZI)
// ═══════════════════════════════════════════════════════════════════════════════

// ── GET /api/meetings/:id/resolutions ─────────────────────────────────────────
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
      SELECT
        mr.*,
        u.full_name AS responsible_name,
        u.phone     AS responsible_phone
      FROM meeting_resolutions mr
      LEFT JOIN users u ON u.id = mr.responsible_member_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY mr.resolution_number ASC
    `, params);

    res.json({ success: true, total: rows.length, data: rows });
  } catch (err) { next(err); }
};

// ── POST /api/meetings/:id/resolutions ────────────────────────────────────────
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
      resolution_number,
      description,
      responsible_member_id,
      responsible_note,
      deadline,
      implementation_status = 'pending',
      progress_notes,
    } = req.body;

    if (!description || !String(description).trim()) {
      return res.status(400).json({ success: false, message: 'description is required.' });
    }

    // Auto-assign resolution_number if not provided
    let resolvedNumber = resolution_number;
    if (!resolvedNumber) {
      const [[{ max_num }]] = await db.execute(
        'SELECT COALESCE(MAX(resolution_number), 0) AS max_num FROM meeting_resolutions WHERE meeting_id = ?',
        [req.params.id]
      );
      resolvedNumber = max_num + 1;
    }

    // Check for duplicate number
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
      req.params.id,
      resolvedNumber,
      String(description).trim(),
      responsible_member_id || null,
      responsible_note      || null,
      deadline              || null,
      implementation_status,
      progress_notes        || null,
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

// ── PUT /api/meetings/:id/resolutions/:resolutionId ───────────────────────────
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
    if (description            !== undefined) { fields.push('description = ?');              params.push(String(description).trim()); }
    if (responsible_member_id  !== undefined) { fields.push('responsible_member_id = ?');    params.push(responsible_member_id  || null); }
    if (responsible_note       !== undefined) { fields.push('responsible_note = ?');         params.push(responsible_note       || null); }
    if (deadline               !== undefined) { fields.push('deadline = ?');                 params.push(deadline               || null); }
    if (implementation_status  !== undefined) { fields.push('implementation_status = ?');    params.push(implementation_status); }
    if (completion_date        !== undefined) { fields.push('completion_date = ?');          params.push(completion_date        || null); }
    if (progress_notes         !== undefined) { fields.push('progress_notes = ?');           params.push(progress_notes         || null); }

    // Auto-set completion_date when marking complete
    if (implementation_status === 'completed' && !completion_date && !existing[0].completion_date) {
      fields.push('completion_date = ?');
      params.push(new Date().toISOString().slice(0, 10));
    }

    if (!fields.length) {
      return res.status(400).json({ success: false, message: 'No updatable fields provided.' });
    }

    params.push(req.params.resolutionId);
    await db.execute(
      `UPDATE meeting_resolutions SET ${fields.join(', ')} WHERE id = ?`,
      params
    );

    const [rows] = await db.execute(`
      SELECT mr.*, u.full_name AS responsible_name
      FROM meeting_resolutions mr
      LEFT JOIN users u ON u.id = mr.responsible_member_id
      WHERE mr.id = ?
    `, [req.params.resolutionId]);

    res.json({ success: true, message: 'Resolution updated.', data: rows[0] });
  } catch (err) { next(err); }
};

// ── DELETE /api/meetings/:id/resolutions/:resolutionId ────────────────────────
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

    res.json({
      success: true,
      message: `Resolution #${existing[0].resolution_number} deleted.`,
    });
  } catch (err) { next(err); }
};


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5 — DOCUMENTS (Minutes PDFs & attachments via R2)
// ═══════════════════════════════════════════════════════════════════════════════

// ── GET /api/meetings/:id/documents ───────────────────────────────────────────
exports.getDocuments = async (req, res, next) => {
  try {
    const [rows] = await db.execute(`
      SELECT
        md.*,
        u.full_name AS uploaded_by_name
      FROM meeting_documents md
      LEFT JOIN users u ON u.id = md.uploaded_by_id
      WHERE md.meeting_id = ?
      ORDER BY md.document_type, md.uploaded_at DESC
    `, [req.params.id]);

    res.json({ success: true, total: rows.length, data: rows });
  } catch (err) { next(err); }
};

// ── POST /api/meetings/:id/documents ──────────────────────────────────────────
// Expects multipart/form-data with field `file` (PDF, image, Word etc.)
// Uses uploadFileStreamToR2 with prefix `meetings/documents`.
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

    const {
      document_type = 'minutes',
      title,
    } = req.body;

    if (!VALID_DOC_TYPES.includes(document_type)) {
      return res.status(400).json({
        success: false,
        message: `document_type must be one of: ${VALID_DOC_TYPES.join(', ')}`,
      });
    }

    // Upload to R2 under meetings/documents/<uuid>.<ext>
    const fileUrl = await uploadFileStreamToR2(
      req.file,
      'meetings/documents',
      'pdf'
    );

    const displayTitle = title
      ? String(title).trim()
      : req.file.originalname;

    const [result] = await db.execute(`
      INSERT INTO meeting_documents
        (meeting_id, document_type, title, file_url,
         file_size_kb, mime_type, uploaded_by_id)
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

    res.status(201).json({
      success: true,
      message: `Document "${displayTitle}" uploaded.`,
      data:    rows[0],
    });
  } catch (err) { next(err); }
};

// ── DELETE /api/meetings/:id/documents/:documentId ────────────────────────────
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

    // Delete from DB first
    await db.execute('DELETE FROM meeting_documents WHERE id = ?', [req.params.documentId]);

    // Best-effort R2 cleanup
    deleteImageFromR2(existing[0].file_url).catch(e =>
      console.error(`R2 cleanup failed for ${existing[0].file_url}:`, e.message)
    );

    res.json({
      success: true,
      message: `Document "${existing[0].title}" deleted.`,
    });
  } catch (err) { next(err); }
};


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6 — DASHBOARD QUERIES
// ═══════════════════════════════════════════════════════════════════════════════

// ── GET /api/meetings/dashboard/open-resolutions ──────────────────────────────
// Returns all pending/in_progress resolutions the requesting user can see,
// optionally filtered by overdue (deadline < today).
// Powers the dashboard card "Maazimio ambayo hayajakamilika".
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
          WHEN mr.deadline IS NULL              THEN 'no_deadline'
          WHEN mr.deadline < CURDATE()          THEN 'overdue'
          WHEN mr.deadline <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) THEN 'due_soon'
          ELSE 'on_track'
        END               AS urgency
      FROM meeting_resolutions mr
      JOIN meetings m ON m.id = mr.meeting_id
      LEFT JOIN \`groups\` g   ON g.id  = m.group_id
      LEFT JOIN users     ru   ON ru.id = mr.responsible_member_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY
        CASE urgency
          WHEN 'overdue'    THEN 1
          WHEN 'due_soon'   THEN 2
          WHEN 'on_track'   THEN 3
          ELSE 4
        END,
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

// ── GET /api/meetings/dashboard/upcoming ──────────────────────────────────────
// Next N scheduled meetings the user can see (default: 5).

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
       LIMIT ${limit}`,          // ← inline the integer, don't bind it
      scopeParams                // ← no limit in params array
    );

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};
