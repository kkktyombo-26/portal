// controllers/ministryController.js

const db = require('../config/db');

// ═══════════════════════════════════════════════════════════
// GET /api/ministries
// Returns the full ministries catalogue, ordered by category.
// ═══════════════════════════════════════════════════════════
exports.getAll = async (req, res, next) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, name, category, description
       FROM ministries
       ORDER BY category, name`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════
// GET /api/ministries/member/:userId
// Returns all ministry IDs the member currently belongs to.
// ═══════════════════════════════════════════════════════════
exports.getMemberMinistries = async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Members can only read their own; admins can read anyone's
    if (req.user.id !== Number(userId) && !['pastor', 'elder', 'group_leader'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    const [rows] = await db.execute(
      `SELECT mm.ministry_id, m.name, m.category
       FROM member_ministries mm
       JOIN ministries m ON m.id = mm.ministry_id
       WHERE mm.member_id = ?
       ORDER BY m.category, m.name`,
      [userId]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════
// PUT /api/ministries/member/:userId/sync
// Replaces the member's ministry memberships with the
// supplied array of ministry IDs.
// Body: { ministryIds: number[] }
// ═══════════════════════════════════════════════════════════
exports.syncMemberMinistries = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { ministryIds = [] } = req.body;

    // Members can only update their own; admins can update anyone's
    if (req.user.id !== Number(userId) && !['pastor', 'elder', 'group_leader'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    if (!Array.isArray(ministryIds)) {
      return res.status(400).json({ success: false, message: 'ministryIds must be an array.' });
    }

    const ids = ministryIds.map(Number).filter(Boolean);

    // Delete existing, then batch-insert the new set
    await db.execute(
      'DELETE FROM member_ministries WHERE member_id = ?',
      [userId]
    );

    if (ids.length > 0) {
      const placeholders = ids.map(() => '(?, ?)').join(', ');
      const flat = ids.flatMap(id => [userId, id]);
      await db.execute(
        `INSERT INTO member_ministries (member_id, ministry_id) VALUES ${placeholders}`,
        flat
      );
    }

    res.json({ success: true, message: 'Ministry memberships updated.', count: ids.length });
  } catch (err) { next(err); }
};