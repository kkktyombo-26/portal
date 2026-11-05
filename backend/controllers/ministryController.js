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
// controllers/ministryController.js

exports.getMemberMinistries = async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (req.user.id !== Number(userId) &&
        !['pastor', 'elder', 'group_leader'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    const [rows] = await db.execute(
      `SELECT mm.ministry_id        AS id,   -- ← normalised to 'id'
              mm.ministry_id,                -- keep raw column too for compat
              m.name_sw AS name, m.name_en, m.category
       FROM   member_ministries mm
       JOIN   ministries m ON m.id = mm.ministry_id
       WHERE  mm.member_id = ?
         AND  mm.status    = 'active'        -- ← only active memberships
       ORDER  BY m.sort_order, m.category, m.name_sw`,
      [userId]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

// PUT /api/ministries/member/:userId/sync
// Replaces the member's ministry memberships with the supplied ID array.
// Body: { ministryIds: number[] }

// ═══════════════════════════════════════════════════════════
// PUT /api/ministries/member/:userId/sync
//
// Replaces a member's full ministry membership set.
// - New IDs      → INSERT (preserves any existing role/notes if row exists)
// - Kept IDs     → re-activate if formerly retired
// - Removed IDs  → soft-retire (status = 'former', left_date = today)
//
// Hard DELETE is intentionally avoided so that historical membership
// records (role_in_ministry, joined_date, notes) are never lost.
//
// Body: { ministryIds: number[] }
// ═══════════════════════════════════════════════════════════
exports.syncMemberMinistries = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { ministryIds = [] } = req.body;

    // ── Auth guard ──────────────────────────────────────────────────
    if (
      req.user.id !== Number(userId) &&
      !['pastor', 'elder', 'group_leader'].includes(req.user.role)
    ) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    // ── Validate body ───────────────────────────────────────────────
    if (!Array.isArray(ministryIds)) {
      return res.status(400).json({
        success: false,
        message: 'ministryIds must be an array.',
      });
    }

    // Deduplicate and strip non-positive integers
    const desiredIds = [...new Set(ministryIds.map(Number).filter(n => Number.isInteger(n) && n > 0))];

    // ── Validate that every supplied ID actually exists ─────────────
    if (desiredIds.length > 0) {
      const ph = desiredIds.map(() => '?').join(', ');
      const [validRows] = await db.execute(
        `SELECT id FROM ministries WHERE id IN (${ph}) AND is_active = 1`,
        desiredIds
      );
      const validIds = validRows.map(r => r.id);
      const invalid  = desiredIds.filter(id => !validIds.includes(id));
      if (invalid.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid or inactive ministry IDs: ${invalid.join(', ')}.`,
        });
      }
    }

    // ── Fetch current memberships (all statuses) ────────────────────
    const [existing] = await db.execute(
      `SELECT ministry_id, status
       FROM   member_ministries
       WHERE  member_id = ?`,
      [userId]
    );

    const activeIds  = existing.filter(r => r.status === 'active') .map(r => r.ministry_id);
    const formerIds  = existing.filter(r => r.status === 'former') .map(r => r.ministry_id);
    const allKnownIds = existing.map(r => r.ministry_id);

    // ── Classify changes ────────────────────────────────────────────
    // toInsert  — desired AND no row exists yet (brand new)
    const toInsert   = desiredIds.filter(id => !allKnownIds.includes(id));

    // toActivate — desired AND a 'former' row already exists (re-joining)
    const toActivate = desiredIds.filter(id => formerIds.includes(id));

    // toRetire   — currently 'active' AND NOT in desired set
    const toRetire   = activeIds.filter(id => !desiredIds.includes(id));

    // ── 1. Insert brand-new memberships ────────────────────────────
    if (toInsert.length > 0) {
      const ph   = toInsert.map(() => '(?, ?, ?, ?)').join(', ');
      const flat = toInsert.flatMap(id => [
        userId,
        id,
        'active',
        new Date().toISOString().slice(0, 10), // joined_date = today
      ]);
      await db.execute(
        `INSERT INTO member_ministries
           (member_id, ministry_id, status, joined_date)
         VALUES ${ph}`,
        flat
      );
    }

    // ── 2. Re-activate formerly retired memberships ─────────────────
    // Clears left_date and restores status — preserves role_in_ministry,
    // notes, and original joined_date so history is not overwritten.
    if (toActivate.length > 0) {
      const ph = toActivate.map(() => '?').join(', ');
      await db.execute(
        `UPDATE member_ministries
         SET    status     = 'active',
                left_date  = NULL,
                updated_at = NOW()
         WHERE  member_id    = ?
           AND  ministry_id  IN (${ph})
           AND  status       = 'former'`,
        [userId, ...toActivate]
      );
    }

    // ── 3. Soft-retire removed memberships ──────────────────────────
    // Keeps the row and all its metadata; just closes the term.
    if (toRetire.length > 0) {
      const ph = toRetire.map(() => '?').join(', ');
      await db.execute(
        `UPDATE member_ministries
         SET    status     = 'former',
                left_date  = CURDATE(),
                updated_at = NOW()
         WHERE  member_id   = ?
           AND  ministry_id IN (${ph})
           AND  status      = 'active'`,
        [userId, ...toRetire]
      );
    }

    // ── 4. Return the member's current active memberships ───────────
    const [current] = await db.execute(
      `SELECT mm.ministry_id        AS id,
              mm.ministry_id,
              mm.status,
              mm.role_in_ministry,
              mm.joined_date,
              m.name_sw  AS name,
              m.name_en,
              m.category
       FROM   member_ministries mm
       JOIN   ministries        m  ON m.id = mm.ministry_id
       WHERE  mm.member_id = ?
         AND  mm.status    = 'active'
       ORDER  BY m.sort_order, m.category, m.name_sw`,
      [userId]
    );

    console.log(
      `Ministry sync — user ${userId}: ` +
      `+${toInsert.length} inserted, ` +
      `↺${toActivate.length} re-activated, ` +
      `−${toRetire.length} retired`
    );

    return res.json({
      success: true,
      message: 'Ministry memberships updated.',
      summary: {
        inserted:    toInsert.length,
        reactivated: toActivate.length,
        retired:     toRetire.length,
      },
      ministries: current,
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