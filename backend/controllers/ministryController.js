// controllers/ministryController.js

const db = require('../config/db');

// ═══════════════════════════════════════════════════════════
// MINISTRIES
// ═══════════════════════════════════════════════════════════

// GET /api/ministries
// Returns the active ministries catalogue ordered for UI grouping.
// name_sw is aliased to `name` for backward-compat with the ProfilePage
// component which reads m.name.
exports.getAll = async (req, res, next) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, name_sw AS name, name_en, category, sort_order
       FROM   ministries
       WHERE  is_active = 1
       ORDER  BY sort_order, category, name_sw`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

// GET /api/ministries/member/:userId
// Returns all ministry IDs + labels the member currently belongs to.
exports.getMemberMinistries = async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (req.user.id !== Number(userId) &&
        !['pastor', 'elder', 'group_leader'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    const [rows] = await db.execute(
      `SELECT mm.ministry_id,
              m.name_sw AS name, m.name_en, m.category
       FROM   member_ministries mm
       JOIN   ministries m ON m.id = mm.ministry_id
       WHERE  mm.member_id = ?
       ORDER  BY m.sort_order, m.category, m.name_sw`,
      [userId]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

// PUT /api/ministries/member/:userId/sync
// Replaces the member's ministry memberships with the supplied ID array.
// Body: { ministryIds: number[] }
exports.syncMemberMinistries = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { ministryIds = [] } = req.body;

    if (req.user.id !== Number(userId) &&
        !['pastor', 'elder', 'group_leader'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    if (!Array.isArray(ministryIds)) {
      return res.status(400).json({
        success: false,
        message: 'ministryIds must be an array.',
      });
    }

    const ids = ministryIds.map(Number).filter(Boolean);

    // Delete existing then batch-insert — ministries have no history to preserve.
    await db.execute(
      'DELETE FROM member_ministries WHERE member_id = ?',
      [userId]
    );

    if (ids.length > 0) {
      const placeholders = ids.map(() => '(?, ?)').join(', ');
      const flat         = ids.flatMap(id => [userId, id]);
      await db.execute(
        `INSERT INTO member_ministries (member_id, ministry_id) VALUES ${placeholders}`,
        flat
      );
    }

    res.json({
      success: true,
      message: 'Ministry memberships updated.',
      count:   ids.length,
    });
  } catch (err) { next(err); }
};


// ═══════════════════════════════════════════════════════════
// COMMITTEES  (Kamati — BSS-KKKT-2026-003)
// ═══════════════════════════════════════════════════════════

// GET /api/committees
// Returns the active committees catalogue.
exports.getAllCommittees = async (req, res, next) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, name, mandate, is_standing, sort_order
       FROM   committees
       WHERE  is_active = 1
       ORDER  BY sort_order, name`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

// GET /api/committees/member/:userId
// Returns the member's current (active) committee memberships.
// Includes role + term dates so the admin panel can display them.
exports.getMemberCommittees = async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (req.user.id !== Number(userId) &&
        !['pastor', 'elder', 'group_leader'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    const [rows] = await db.execute(
      `SELECT mc.id, mc.committee_id,
              c.name, c.mandate,
              mc.role, mc.term_start, mc.term_end,
              mc.status, mc.appointed_by
       FROM   member_committees mc
       JOIN   committees        c  ON c.id = mc.committee_id
       WHERE  mc.member_id = ?
         AND  mc.status    = 'active'
       ORDER  BY c.sort_order, c.name`,
      [userId]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

// PUT /api/committees/member/:userId/sync
// Checkbox-style sync from the ProfilePage (committee IDs only, no role/term).
// Unlike ministries, committees use a soft-retire approach so historical
// membership rows are kept with status = 'former' rather than deleted.
// Body: { committeeIds: number[] }
//
// For full role + term CRUD (admin panel), use separate POST/PATCH/DELETE
// endpoints against /api/committees/member/:userId/membership/:id.
exports.syncMemberCommittees = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { committeeIds = [] } = req.body;

    if (req.user.id !== Number(userId) &&
        !['pastor', 'elder', 'group_leader'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    if (!Array.isArray(committeeIds)) {
      return res.status(400).json({
        success: false,
        message: 'committeeIds must be an array.',
      });
    }

    const ids = committeeIds.map(Number).filter(Boolean);

    // ── Current active memberships ────────────────────────────
    const [existing] = await db.execute(
      `SELECT committee_id
       FROM   member_committees
       WHERE  member_id = ? AND status = 'active'`,
      [userId]
    );
    const existingIds = existing.map(r => r.committee_id);

    // Committees to add (desired but not yet active)
    const toAdd    = ids.filter(id => !existingIds.includes(id));
    // Committees to retire (currently active but dropped from desired set)
    const toRetire = existingIds.filter(id => !ids.includes(id));

    // ── Soft-retire removed committees ───────────────────────
    // Preserve historical rows; just close out the term.
    if (toRetire.length > 0) {
      const ph = toRetire.map(() => '?').join(', ');
      await db.execute(
        `UPDATE member_committees
         SET    status     = 'former',
                term_end   = CURDATE(),
                updated_at = NOW()
         WHERE  member_id    = ?
           AND  committee_id IN (${ph})
           AND  status       = 'active'`,
        [userId, ...toRetire]
      );
    }

    // ── Insert new memberships ────────────────────────────────
    // role / term_start are left NULL here; an admin can fill them
    // later via the detail panel.
    if (toAdd.length > 0) {
      const ph   = toAdd.map(() => '(?, ?, ?)').join(', ');
      const flat = toAdd.flatMap(id => [userId, id, 'active']);
      await db.execute(
        `INSERT INTO member_committees (member_id, committee_id, status)
         VALUES ${ph}`,
        flat
      );
    }

    res.json({
      success: true,
      message: 'Committee memberships updated.',
      added:   toAdd.length,
      retired: toRetire.length,
    });
  } catch (err) { next(err); }
};