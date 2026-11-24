// controllers/dashboardController.js
//
// GET /api/dashboard/counts
//
// Powers the badge numbers next to the sidebar nav items.
//
// Design notes
// ────────────
// 1. Every count here is *actionable* — it answers "is there something waiting
//    for me?", not "how many rows exist?". A badge that permanently reads 143
//    stops carrying information, so totals (all members, every announcement
//    ever posted) are deliberately not returned.
//
// 2. The whole thing is ONE database round trip. Each count is a scalar
//    subquery stitched into a single SELECT. A seven-query fan-out would cost
//    seven times the latency on an endpoint the sidebar polls.
//
// 3. Counts are built per role. A member never receives a pendingMembers
//    number at all, so the response cannot leak the existence of data the
//    caller is not allowed to see.

const db = require('../config/db');

const MANAGERS        = ['pastor', 'elder'];
const PLEDGE_MANAGERS = ['pastor', 'elder', 'group_leader'];

// How far back "new announcements" looks. Interpolated directly into SQL —
// it is a module constant, never user input.
const ANNOUNCEMENT_WINDOW_DAYS = 7;

/**
 * Build the meetings visibility condition for the `m` table alias.
 *
 * Mirrors buildScopeCondition() in meetingsController.js, with one fix: the
 * JWT payload stores the group as `groupId` (camelCase — see generateToken in
 * authController.js and phoneLoginController.js), so `user.group_id` is always
 * undefined on a decoded token. We read `groupId` first and fall back to
 * `group_id` so older tokens still in circulation keep working.
 */
async function buildMeetingScope(user) {
  if (MANAGERS.includes(user.role)) {
    return { condition: '1=1', params: [] };
  }

  const groupId = user.groupId ?? user.group_id ?? null;

  if (user.role === 'group_leader' && groupId) {
    return {
      condition: '(m.group_id IS NULL OR m.group_id = ?)',
      params: [groupId],
    };
  }

  // Regular member — church-level meetings plus any group they belong to.
  const [memberships] = await db.execute(
    `SELECT DISTINCT group_id FROM group_members
      WHERE member_id = ? AND status = 'active'`,
    [user.id]
  );

  const groupIds = memberships.map(r => r.group_id).filter(Boolean);

  if (!groupIds.length) {
    return { condition: 'm.group_id IS NULL', params: [] };
  }

  const placeholders = groupIds.map(() => '?').join(', ');
  return {
    condition: `(m.group_id IS NULL OR m.group_id IN (${placeholders}))`,
    params: groupIds,
  };
}

/**
 * Assemble the list of counts this particular user is entitled to.
 * Each entry is { key, sql, params } where sql is a complete scalar subquery.
 */
async function buildCountSpec(user) {
  const role    = user.role;
  const groupId = user.groupId ?? user.group_id ?? null;

  const { condition: mScope, params: mScopeParams } = await buildMeetingScope(user);

  const spec = [];

  // ── Members awaiting approval ──────────────────────────────────────────────
  // The clearest action queue in the app. Matches getPendingUsers().
  if (MANAGERS.includes(role)) {
    spec.push({
      key: 'pendingMembers',
      sql: `SELECT COUNT(*) FROM users
             WHERE is_active = 0 AND is_verified = 0`,
      params: [],
    });
  }

  // ── Announcements posted recently ─────────────────────────────────────────
  // Scoped the same way getAnnouncements() scopes its list, so the badge and
  // the page always agree.
  if (role === 'pastor') {
    spec.push({
      key: 'newAnnouncements',
      sql: `SELECT COUNT(*) FROM announcements a
             WHERE a.created_at >= DATE_SUB(NOW(), INTERVAL ${ANNOUNCEMENT_WINDOW_DAYS} DAY)`,
      params: [],
    });
  } else {
    spec.push({
      key: 'newAnnouncements',
      sql: `SELECT COUNT(*) FROM announcements a
             WHERE a.created_at >= DATE_SUB(NOW(), INTERVAL ${ANNOUNCEMENT_WINDOW_DAYS} DAY)
               AND (a.scope = 'church' OR (a.scope = 'group' AND a.group_id = ?))`,
      params: [groupId || 0],
    });
  }

  // ── Events still to come (Ratiba) ─────────────────────────────────────────
  spec.push({
    key: 'upcomingEvents',
    sql: `SELECT COUNT(*) FROM events
           WHERE event_date >= CURDATE()`,
    params: [],
  });

  // ── Scheduled meetings still to come (Vikao) ──────────────────────────────
  spec.push({
    key: 'upcomingMeetings',
    sql: `SELECT COUNT(*) FROM meetings m
           WHERE (${mScope})
             AND m.status       = 'scheduled'
             AND m.meeting_date >= CURDATE()`,
    params: [...mScopeParams],
  });

  // ── Open and overdue resolutions (Maazimio) ───────────────────────────────
  // Only pastor/elder see the Maazimio nav item, so only they get the counts.
  if (MANAGERS.includes(role)) {
    spec.push({
      key: 'openResolutions',
      sql: `SELECT COUNT(*) FROM meeting_resolutions mr
             JOIN meetings m ON m.id = mr.meeting_id
             WHERE (${mScope})
               AND mr.implementation_status IN ('pending', 'in_progress')`,
      params: [...mScopeParams],
    });

    spec.push({
      key: 'overdueResolutions',
      sql: `SELECT COUNT(*) FROM meeting_resolutions mr
             JOIN meetings m ON m.id = mr.meeting_id
             WHERE (${mScope})
               AND mr.implementation_status IN ('pending', 'in_progress')
               AND mr.deadline IS NOT NULL
               AND mr.deadline < CURDATE()`,
      params: [...mScopeParams],
    });
  }

  // ── Pledge payments awaiting confirmation ─────────────────────────────────
  // Deliberately unscoped by group, to match the existing pending-payments
  // endpoint in pledgeController.js. If that endpoint ever gains group
  // scoping, mirror it here or the badge will disagree with the page.
  if (PLEDGE_MANAGERS.includes(role)) {
    spec.push({
      key: 'pendingPledgePayments',
      sql: `SELECT COUNT(*) FROM pledge_payments
             WHERE status = 'pending_confirmation'`,
      params: [],
    });
  }

  return spec;
}

// ── GET /api/dashboard/counts ────────────────────────────────────────────────
exports.getSidebarCounts = async (req, res, next) => {
  try {
    const spec = await buildCountSpec(req.user);

    if (!spec.length) {
      return res.json({ success: true, counts: {} });
    }

    const select = spec
      .map(s => `(${s.sql}) AS \`${s.key}\``)
      .join(',\n       ');

    const params = spec.flatMap(s => s.params);

    const [rows] = await db.execute(`SELECT ${select}`, params);
    const row    = rows[0] || {};

    // COUNT() can come back as a string depending on driver settings —
    // coerce so the client never has to think about it.
    const counts = {};
    for (const { key } of spec) {
      counts[key] = Number(row[key] ?? 0);
    }

    // Short cache window: the sidebar polls, and two tabs open on the same
    // account should not each hit the database every few seconds.
    res.set('Cache-Control', 'private, max-age=15');
    res.json({ success: true, counts });
  } catch (err) {
    next(err);
  }
};