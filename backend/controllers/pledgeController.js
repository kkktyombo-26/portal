/**
 * pledgeController.js
 * ────────────────────
 * Pledge Campaign module for KKKT Yombo Portal
 * Ref: BSS-KKKT-2026-003
 *
 * Three layers:
 *  1. Pledge Campaigns   — admin creates a campaign (Jengo 2026, Uwakili 2026 …)
 *                          scoped to church | group | member
 *  2. Member Pledges     — a member's personal commitment to a campaign:
 *                          amount pledged, pledge card number, signed date
 *  3. Pledge Payments    — installment payments against a member pledge
 *                          (amount, date, method, receipt number)
 *
 * Access:
 *  - pastor, elder, group_leader can manage campaigns and pledges
 *  - group_leader scope is restricted to their own group's members
 *  - members can view their own pledges (read-only)
 *
 * Routes wired in pledgeRoutes.js.
 */

const db = require('../config/db');

// ── Role helper ───────────────────────────────────────────────────────────────
const MANAGERS = ['pastor', 'elder', 'group_leader'];

function canManage(role) {
  return MANAGERS.includes(role);
}

// ── Scope guard for group_leader ──────────────────────────────────────────────
// Ensures a group_leader can only touch members in their own group.
async function memberInLeaderGroup(memberId, leaderGroupId) {
  const [rows] = await db.execute(
    'SELECT id FROM users WHERE id = ? AND group_id = ?',
    [memberId, leaderGroupId]
  );
  return rows.length > 0;
}


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — PLEDGE CAMPAIGNS
// ═══════════════════════════════════════════════════════════════════════════════

// ── GET /api/pledges/campaigns ────────────────────────────────────────────────
// Returns all campaigns visible to the caller.
// group_leader only sees campaigns scoped to their group or church-wide.
exports.getCampaigns = async (req, res, next) => {
  try {
    const { role, id: userId, groupId } = req.user;

    let sql = `
      SELECT
        pc.*,
        pt.name_sw                          AS pledge_type_name,
        pt.name_en                          AS pledge_type_name_en,
        u.full_name                         AS created_by_name,
        g.name                              AS group_name,
        mu.full_name                        AS target_member_name,
        COUNT(DISTINCT mp.id)               AS subscriber_count,
        COALESCE(SUM(mp.annual_amount), 0)  AS total_pledged,
        COALESCE(SUM(pp.amount), 0)         AS total_paid
      FROM pledge_campaigns pc
      JOIN  pledge_types pt   ON pt.id  = pc.pledge_type_id
      JOIN  users        u    ON u.id   = pc.created_by
      LEFT JOIN \`groups\`  g    ON g.id   = pc.group_id
      LEFT JOIN users      mu   ON mu.id  = pc.member_id
      LEFT JOIN member_pledges mp ON mp.campaign_id = pc.id
      LEFT JOIN pledge_payments pp ON pp.pledge_id = mp.id
    `;

    const params = [];

    if (role === 'group_leader') {
      // Group leaders see church-wide + their own group campaigns
      sql += ` WHERE pc.is_active = 1
                 AND (pc.scope = 'church'
                      OR (pc.scope = 'group' AND pc.group_id = ?))`;
      params.push(groupId);
    } else if (role === 'member') {
      // Members see church-wide active campaigns only (so they can self-pledge)
      sql += ` WHERE pc.is_active = 1 AND pc.scope = 'church'`;
    } else if (!canManage(role)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    sql += `
      GROUP BY
        pc.id, pt.name_sw, pt.name_en,
        u.full_name, g.name, mu.full_name
      ORDER BY pc.pledge_year DESC, pc.created_at DESC
    `;

    const [rows] = await db.execute(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

// ── GET /api/pledges/campaigns/:id ────────────────────────────────────────────
exports.getCampaign = async (req, res, next) => {
  try {
    const { role, groupId } = req.user;

    const [rows] = await db.execute(`
      SELECT
        pc.*,
        pt.name_sw                          AS pledge_type_name,
        pt.name_en                          AS pledge_type_name_en,
        u.full_name                         AS created_by_name,
        g.name                              AS group_name,
        mu.full_name                        AS target_member_name,
        COUNT(DISTINCT mp.id)               AS subscriber_count,
        COALESCE(SUM(mp.annual_amount), 0)  AS total_pledged,
        COALESCE(SUM(pp.amount), 0)         AS total_paid
      FROM pledge_campaigns pc
      JOIN  pledge_types pt   ON pt.id  = pc.pledge_type_id
      JOIN  users        u    ON u.id   = pc.created_by
      LEFT JOIN \`groups\`  g    ON g.id   = pc.group_id
      LEFT JOIN users      mu   ON mu.id  = pc.member_id
      LEFT JOIN member_pledges mp ON mp.campaign_id = pc.id
      LEFT JOIN pledge_payments pp ON pp.pledge_id = mp.id
      WHERE pc.id = ?
      GROUP BY
        pc.id, pt.name_sw, pt.name_en,
        u.full_name, g.name, mu.full_name
    `, [req.params.id]);

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Campaign not found.' });
    }

    const campaign = rows[0];

    // group_leader access check
    if (role === 'group_leader') {
      if (campaign.scope === 'group' && campaign.group_id !== groupId) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
      if (campaign.scope === 'member') {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    } else if (role === 'member') {
      // Members can only view church-wide active campaigns
      if (!campaign.is_active || campaign.scope !== 'church') {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    } else if (!canManage(role)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    res.json({ success: true, data: campaign });
  } catch (err) { next(err); }
};

// ── POST /api/pledges/campaigns ───────────────────────────────────────────────
// Admin creates a new pledge campaign.
exports.createCampaign = async (req, res, next) => {
  try {
    const { role, id: userId, groupId } = req.user;
    if (!canManage(role)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const {
      name,
      pledge_type_id,
      description,
      scope        = 'church',
      group_id,
      member_id,
      pledge_year,
      start_date,
      end_date,
      target_amount = 0,
    } = req.body;

    // ── Validation ──────────────────────────────────────────
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Campaign name is required.' });
    }
    if (!pledge_type_id) {
      return res.status(400).json({ success: false, message: 'pledge_type_id is required.' });
    }
    if (!pledge_year) {
      return res.status(400).json({ success: false, message: 'pledge_year is required.' });
    }
    if (!['church', 'group', 'member'].includes(scope)) {
      return res.status(400).json({ success: false, message: 'scope must be church | group | member.' });
    }
    if (scope === 'group' && !group_id) {
      return res.status(400).json({ success: false, message: 'group_id is required when scope is group.' });
    }
    if (scope === 'member' && !member_id) {
      return res.status(400).json({ success: false, message: 'member_id is required when scope is member.' });
    }

    // group_leader can only create group-scoped campaigns for their own group
    if (role === 'group_leader') {
      if (scope === 'church') {
        return res.status(403).json({ success: false, message: 'Group leaders cannot create church-wide campaigns.' });
      }
      if (scope === 'group' && Number(group_id) !== groupId) {
        return res.status(403).json({ success: false, message: 'You can only create campaigns for your own group.' });
      }
    }

    // Verify pledge_type exists
    const [typeRows] = await db.execute(
      'SELECT id FROM pledge_types WHERE id = ? AND is_active = 1',
      [pledge_type_id]
    );
    if (!typeRows.length) {
      return res.status(400).json({ success: false, message: 'Invalid or inactive pledge_type_id.' });
    }

    const [result] = await db.execute(`
      INSERT INTO pledge_campaigns
        (name, pledge_type_id, description, scope, group_id, member_id,
         pledge_year, start_date, end_date, target_amount, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      String(name).trim(),
      pledge_type_id,
      description   || null,
      scope,
      scope === 'group'   ? (group_id  || null) : null,
      scope === 'member'  ? (member_id || null) : null,
      pledge_year,
      start_date    || null,
      end_date      || null,
      Number(target_amount) || 0,
      userId,
    ]);

    const [newRows] = await db.execute(`
      SELECT pc.*, pt.name_sw AS pledge_type_name, u.full_name AS created_by_name
      FROM pledge_campaigns pc
      JOIN pledge_types pt ON pt.id = pc.pledge_type_id
      JOIN users        u  ON u.id  = pc.created_by
      WHERE pc.id = ?
    `, [result.insertId]);

    res.status(201).json({
      success: true,
      message: `Campaign "${name}" created.`,
      data:    newRows[0],
    });
  } catch (err) { next(err); }
};

// ── PUT /api/pledges/campaigns/:id ────────────────────────────────────────────
exports.updateCampaign = async (req, res, next) => {
  try {
    const { role, id: userId, groupId } = req.user;
    if (!canManage(role)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const [existing] = await db.execute(
      'SELECT * FROM pledge_campaigns WHERE id = ?',
      [req.params.id]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Campaign not found.' });
    }

    const c = existing[0];

    // group_leader scope guard
    if (role === 'group_leader') {
      if (c.scope === 'church' || c.scope === 'member') {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
      if (c.group_id !== groupId) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    }

    const {
      name, description, start_date, end_date,
      target_amount, is_active,
    } = req.body;

    // Only allow safe fields to be updated — scope / type / year are immutable
    const fields = [], params = [];
    if (name          !== undefined) { fields.push('name = ?');          params.push(String(name).trim()); }
    if (description   !== undefined) { fields.push('description = ?');   params.push(description || null); }
    if (start_date    !== undefined) { fields.push('start_date = ?');    params.push(start_date  || null); }
    if (end_date      !== undefined) { fields.push('end_date = ?');      params.push(end_date    || null); }
    if (target_amount !== undefined) { fields.push('target_amount = ?'); params.push(Number(target_amount) || 0); }
    if (is_active     !== undefined) { fields.push('is_active = ?');     params.push(is_active ? 1 : 0); }

    if (!fields.length) {
      return res.status(400).json({ success: false, message: 'No updatable fields provided.' });
    }

    params.push(req.params.id);
    await db.execute(`UPDATE pledge_campaigns SET ${fields.join(', ')} WHERE id = ?`, params);

    const [updated] = await db.execute(`
      SELECT pc.*, pt.name_sw AS pledge_type_name, u.full_name AS created_by_name
      FROM pledge_campaigns pc
      JOIN pledge_types pt ON pt.id = pc.pledge_type_id
      JOIN users        u  ON u.id  = pc.created_by
      WHERE pc.id = ?
    `, [req.params.id]);

    res.json({ success: true, message: 'Campaign updated.', data: updated[0] });
  } catch (err) { next(err); }
};

// ── DELETE /api/pledges/campaigns/:id ─────────────────────────────────────────
// Soft-delete (set is_active = 0). Pastor/elder only.
exports.deleteCampaign = async (req, res, next) => {
  try {
    const { role } = req.user;
    if (!['pastor', 'elder'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Only pastor or elder can delete campaigns.' });
    }

    const [existing] = await db.execute(
      'SELECT id, name FROM pledge_campaigns WHERE id = ?', [req.params.id]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Campaign not found.' });
    }

    // Check for existing member pledges — warn but allow
    const [[{ count }]] = await db.execute(
      'SELECT COUNT(*) AS count FROM member_pledges WHERE campaign_id = ?',
      [req.params.id]
    );

    await db.execute(
      'UPDATE pledge_campaigns SET is_active = 0 WHERE id = ?',
      [req.params.id]
    );

    res.json({
      success: true,
      message: `Campaign "${existing[0].name}" deactivated.`,
      affected_pledges: count,
    });
  } catch (err) { next(err); }
};


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — MEMBER PLEDGES
// ═══════════════════════════════════════════════════════════════════════════════

// ── GET /api/pledges/campaigns/:id/members ────────────────────────────────────
// All member pledges for a specific campaign (with payment summary).
exports.getCampaignPledges = async (req, res, next) => {
  try {
    const { role, id: userId, groupId } = req.user;
    if (!canManage(role)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const campaignId = req.params.id;

    // group_leader access check
    if (role === 'group_leader') {
      const [c] = await db.execute(
        'SELECT scope, group_id FROM pledge_campaigns WHERE id = ?', [campaignId]
      );
      if (!c.length) return res.status(404).json({ success: false, message: 'Campaign not found.' });
      if (c[0].scope === 'group' && c[0].group_id !== groupId) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    }

    const [rows] = await db.execute(`
      SELECT * FROM v_pledge_summary
      WHERE campaign_id = ?
      ORDER BY member_name
    `, [campaignId]);

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

// ── GET /api/pledges/members/:userId ─────────────────────────────────────────
// All pledges for one specific member (across all campaigns).
exports.getMemberPledges = async (req, res, next) => {
  try {
    const { role, id: callerId, groupId } = req.user;
    const targetId = parseInt(req.params.userId);

    // Members can view their own; managers can view anyone in scope
    if (!canManage(role) && callerId !== targetId) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    if (role === 'group_leader') {
      const inGroup = await memberInLeaderGroup(targetId, groupId);
      if (!inGroup && callerId !== targetId) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    }

    const [rows] = await db.execute(`
      SELECT * FROM v_pledge_summary
      WHERE member_id = ?
      ORDER BY campaign_year DESC, pledge_type_name
    `, [targetId]);

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

// ── POST /api/pledges/campaigns/:id/members ───────────────────────────────────
// Subscribe a member to a campaign with their personal pledge details.
//
// WHO CAN CALL THIS:
//   - pastor / elder / group_leader  → can pledge on behalf of any member in scope
//   - member                         → can only pledge for themselves (self-pledge)
//                                      on church-wide active campaigns
//
// MEMBER SELF-PLEDGE:
//   - member_id in the body is ignored; the caller's own id is always used.
//   - pledge_number and signed_date are optional (admin can fill them later).
//   - The pledge is created with status = 'pending' so admin can review/approve.
//
exports.addMemberPledge = async (req, res, next) => {
  try {
    const { role, id: callerId, groupId } = req.user;

    const isMember  = role === 'member';
    const isManager = canManage(role);

    if (!isManager && !isMember) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const campaignId = parseInt(req.params.id);

    const {
      annual_amount,
      pledge_number,
      signed_date,
      notes,
    } = req.body;

    // For managers, member_id comes from body; for self-pledge it's always the caller.
    let member_id = isMember ? callerId : req.body.member_id;

    if (!isMember && !member_id) {
      return res.status(400).json({ success: false, message: 'member_id is required.' });
    }
    if (!annual_amount || Number(annual_amount) <= 0) {
      return res.status(400).json({ success: false, message: 'annual_amount must be greater than 0.' });
    }

    // Fetch campaign details
    const [campaigns] = await db.execute(
      'SELECT * FROM pledge_campaigns WHERE id = ? AND is_active = 1',
      [campaignId]
    );
    if (!campaigns.length) {
      return res.status(404).json({ success: false, message: 'Campaign not found or inactive.' });
    }
    const campaign = campaigns[0];

    // ── Member self-pledge scope guard ───────────────────────────────────────
    // Members may only pledge to church-wide campaigns.
    if (isMember && campaign.scope !== 'church') {
      return res.status(403).json({
        success: false,
        message: 'Self-pledge is only allowed on church-wide campaigns.',
      });
    }

    // ── group_leader scope guard ─────────────────────────────────────────────
    if (role === 'group_leader') {
      if (campaign.scope === 'group' && campaign.group_id !== groupId) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
      const inGroup = await memberInLeaderGroup(member_id, groupId);
      if (!inGroup) {
        return res.status(403).json({ success: false, message: 'That member is not in your group.' });
      }
    }

    // Prevent duplicate pledge for same member + campaign
    const [dup] = await db.execute(
      'SELECT id FROM member_pledges WHERE campaign_id = ? AND member_id = ?',
      [campaignId, member_id]
    );
    if (dup.length) {
      return res.status(409).json({
        success: false,
        message: 'You already have a pledge in this campaign.',
        existing_pledge_id: dup[0].id,
      });
    }

    // Members' self-pledges start as 'pending'; admin-entered pledges are 'active'.
    const status = isMember ? 'pending' : 'active';

    const [result] = await db.execute(`
      INSERT INTO member_pledges
        (campaign_id, member_id, pledge_type_id, pledge_year,
         pledge_number, annual_amount, signed_date, notes, is_fulfilled, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `, [
      campaignId,
      member_id,
      campaign.pledge_type_id,
      campaign.pledge_year,
      pledge_number || null,
      Number(annual_amount),
      signed_date   || null,
      notes         || null,
      status,
    ]);

    const [rows] = await db.execute(
      'SELECT * FROM v_pledge_summary WHERE pledge_id = ?',
      [result.insertId]
    );

    const message = isMember
      ? 'Pledge submitted and is pending admin review.'
      : 'Member pledge added.';

    res.status(201).json({
      success: true,
      message,
      status,
      data: rows[0] || { id: result.insertId },
    });
  } catch (err) { next(err); }
};

// ── PUT /api/pledges/member-pledges/:pledgeId ─────────────────────────────────
// Update a member's pledge details.
//
// WHO CAN DO WHAT:
//   - member          → can edit annual_amount / notes on their OWN pledge,
//                        but ONLY while status = 'pending' (before admin approval).
//   - group_leader    → can edit in-scope pledges (amount, card, date, notes).
//   - pastor / elder  → full update including status (approve / reject) and is_fulfilled.
//
// STATUS TRANSITIONS (admin-only field):
//   pending  → active   (admin approves the member's self-pledge)
//   pending  → rejected (admin rejects it)
//   active   → pending  (admin reopens for editing — rare)
//
exports.updateMemberPledge = async (req, res, next) => {
  try {
    const { role, id: callerId, groupId } = req.user;

    const isMember  = role === 'member';
    const isSenior  = ['pastor', 'elder'].includes(role);
    const isManager = canManage(role);

    if (!isManager && !isMember) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const pledgeId = parseInt(req.params.pledgeId);

    const [pledges] = await db.execute(
      `SELECT mp.*, pc.group_id AS campaign_group_id, pc.scope AS campaign_scope
       FROM member_pledges mp
       LEFT JOIN pledge_campaigns pc ON pc.id = mp.campaign_id
       WHERE mp.id = ?`,
      [pledgeId]
    );
    if (!pledges.length) {
      return res.status(404).json({ success: false, message: 'Member pledge not found.' });
    }
    const pledge = pledges[0];

    // ── Member self-edit guard ───────────────────────────────────────────────
    if (isMember) {
      if (pledge.member_id !== callerId) {
        return res.status(403).json({ success: false, message: 'You can only edit your own pledge.' });
      }
      if (pledge.status !== 'pending') {
        return res.status(403).json({
          success: false,
          message: 'Your pledge has already been reviewed and can no longer be edited. Contact an admin.',
        });
      }
    }

    // ── group_leader guard ───────────────────────────────────────────────────
    if (role === 'group_leader') {
      const inGroup = await memberInLeaderGroup(pledge.member_id, groupId);
      if (!inGroup) return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const { annual_amount, pledge_number, signed_date, is_fulfilled, notes, status } = req.body;

    // Validate status transition (senior admins only)
    const VALID_STATUSES = ['pending', 'active', 'rejected'];
    if (status !== undefined) {
      if (!isSenior) {
        return res.status(403).json({ success: false, message: 'Only pastor or elder can change pledge status.' });
      }
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `status must be one of: ${VALID_STATUSES.join(', ')}.`,
        });
      }
    }

    const fields = [], params = [];

    // Members can only change amount and notes
    if (annual_amount !== undefined) {
      if (Number(annual_amount) <= 0) {
        return res.status(400).json({ success: false, message: 'annual_amount must be greater than 0.' });
      }
      fields.push('annual_amount = ?'); params.push(Number(annual_amount));
    }
    if (notes !== undefined) { fields.push('notes = ?'); params.push(notes || null); }

    // Manager-only fields
    if (!isMember) {
      if (pledge_number !== undefined) { fields.push('pledge_number = ?'); params.push(pledge_number || null); }
      if (signed_date   !== undefined) { fields.push('signed_date = ?');   params.push(signed_date   || null); }
      if (is_fulfilled  !== undefined) { fields.push('is_fulfilled = ?');  params.push(is_fulfilled ? 1 : 0); }
    }

    // Senior-admin-only fields
    if (isSenior && status !== undefined) {
      fields.push('status = ?'); params.push(status);
    }

    if (!fields.length) {
      return res.status(400).json({ success: false, message: 'No updatable fields provided.' });
    }

    params.push(pledgeId);
    await db.execute(`UPDATE member_pledges SET ${fields.join(', ')} WHERE id = ?`, params);

    const [updated] = await db.execute(
      'SELECT * FROM v_pledge_summary WHERE pledge_id = ?', [pledgeId]
    );

    const message = status === 'active'
      ? 'Pledge approved.'
      : status === 'rejected'
        ? 'Pledge rejected.'
        : 'Pledge updated.';

    res.json({ success: true, message, data: updated[0] });
  } catch (err) { next(err); }
};

// ── DELETE /api/pledges/member-pledges/:pledgeId ──────────────────────────────
// Hard delete — removes the pledge AND all its payments. Pastor/elder only.
exports.deleteMemberPledge = async (req, res, next) => {
  try {
    const { role } = req.user;
    if (!['pastor', 'elder'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Only pastor or elder can delete pledges.' });
    }

    const [existing] = await db.execute(
      'SELECT id, member_id FROM member_pledges WHERE id = ?', [req.params.pledgeId]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Member pledge not found.' });
    }

    // Payments cascade-delete via FK, but let's count for the response
    const [[{ count }]] = await db.execute(
      'SELECT COUNT(*) AS count FROM pledge_payments WHERE pledge_id = ?',
      [req.params.pledgeId]
    );

    await db.execute('DELETE FROM member_pledges WHERE id = ?', [req.params.pledgeId]);

    res.json({
      success: true,
      message: 'Member pledge and all related payments deleted.',
      deleted_payments: count,
    });
  } catch (err) { next(err); }
};


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — PLEDGE PAYMENTS (INSTALLMENTS)
// ═══════════════════════════════════════════════════════════════════════════════

// ── GET /api/pledges/member-pledges/:pledgeId/payments ────────────────────────
exports.getPayments = async (req, res, next) => {
  try {
    const { role, id: callerId, groupId } = req.user;
    const pledgeId = parseInt(req.params.pledgeId);

    const [pledgeRows] = await db.execute(
      'SELECT * FROM member_pledges WHERE id = ?', [pledgeId]
    );
    if (!pledgeRows.length) {
      return res.status(404).json({ success: false, message: 'Pledge not found.' });
    }
    const pledge = pledgeRows[0];

    // Access: member sees own, managers see all in scope
    if (!canManage(role) && callerId !== pledge.member_id) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    if (role === 'group_leader') {
      const inGroup = await memberInLeaderGroup(pledge.member_id, groupId);
      if (!inGroup) return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const [rows] = await db.execute(`
      SELECT
        pp.*,
        u.full_name AS recorded_by_name
      FROM pledge_payments pp
      JOIN users u ON u.id = pp.recorded_by
      WHERE pp.pledge_id = ?
      ORDER BY pp.payment_date DESC, pp.created_at DESC
    `, [pledgeId]);

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

// ── POST /api/pledges/member-pledges/:pledgeId/payments ──────────────────────
// Record a new installment payment.
//
// WHO CAN CALL THIS:
//   - member   → can submit a payment against their OWN pledge (pledge must be
//                 'active'). Payment is created with status = 'pending_confirmation'
//                 so an admin must confirm it. receipt_number is optional for members.
//   - managers → record confirmed payments on behalf of anyone in scope.
//                Payment is created with status = 'confirmed' immediately.
//
// Auto-marks pledge as fulfilled when confirmed total_paid >= annual_amount.
//
exports.addPayment = async (req, res, next) => {
  try {
    const { role, id: callerId, groupId } = req.user;

    const isMember  = role === 'member';
    const isManager = canManage(role);

    if (!isManager && !isMember) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const pledgeId = parseInt(req.params.pledgeId);

    const {
      amount,
      payment_date,
      payment_method = 'cash',
      receipt_number,
      notes,
    } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'amount must be greater than 0.' });
    }
    if (!payment_date) {
      return res.status(400).json({ success: false, message: 'payment_date is required.' });
    }

    const VALID_METHODS = ['cash', 'bank_transfer', 'mobile_money', 'cheque'];
    if (!VALID_METHODS.includes(payment_method)) {
      return res.status(400).json({
        success: false,
        message: `payment_method must be one of: ${VALID_METHODS.join(', ')}.`,
      });
    }

    // Fetch pledge to verify it exists
    const [pledgeRows] = await db.execute(
      'SELECT * FROM member_pledges WHERE id = ?', [pledgeId]
    );
    if (!pledgeRows.length) {
      return res.status(404).json({ success: false, message: 'Member pledge not found.' });
    }
    const pledge = pledgeRows[0];

    // ── Member self-payment guard ────────────────────────────────────────────
    if (isMember) {
      if (pledge.member_id !== callerId) {
        return res.status(403).json({ success: false, message: 'You can only submit payments for your own pledge.' });
      }
      if (pledge.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'You can only submit payments on an active (approved) pledge.',
        });
      }
    }

    // ── group_leader scope guard ─────────────────────────────────────────────
    if (role === 'group_leader') {
      const inGroup = await memberInLeaderGroup(pledge.member_id, groupId);
      if (!inGroup) return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    // Members' payments need admin confirmation; managers' payments are confirmed immediately.
    const paymentStatus = isMember ? 'pending_confirmation' : 'confirmed';

    // Insert payment
    const [result] = await db.execute(`
      INSERT INTO pledge_payments
        (pledge_id, amount, payment_date, payment_method, receipt_number, notes, recorded_by, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      pledgeId,
      Number(amount),
      payment_date,
      payment_method,
      receipt_number || null,
      notes          || null,
      callerId,
      paymentStatus,
    ]);

    // Auto-check fulfillment: only count CONFIRMED payments
    const [[{ total_paid }]] = await db.execute(
      `SELECT COALESCE(SUM(amount), 0) AS total_paid
       FROM pledge_payments
       WHERE pledge_id = ? AND status = 'confirmed'`,
      [pledgeId]
    );

    let autoFulfilled = false;
    if (!isMember) {
      autoFulfilled = pledge.annual_amount > 0 && total_paid >= pledge.annual_amount;
      if (autoFulfilled && !pledge.is_fulfilled) {
        await db.execute(
          'UPDATE member_pledges SET is_fulfilled = 1 WHERE id = ?',
          [pledgeId]
        );
      }
    }

    // Return updated pledge summary + the new payment row
    const [summary] = await db.execute(
      'SELECT * FROM v_pledge_summary WHERE pledge_id = ?', [pledgeId]
    );
    const [payment] = await db.execute(
      `SELECT pp.*, u.full_name AS recorded_by_name
       FROM pledge_payments pp JOIN users u ON u.id = pp.recorded_by
       WHERE pp.id = ?`,
      [result.insertId]
    );

    const message = isMember
      ? 'Payment submitted and is pending admin confirmation.'
      : 'Payment recorded.';

    res.status(201).json({
      success:        true,
      message,
      status:         paymentStatus,
      auto_fulfilled: autoFulfilled,
      payment:        payment[0],
      pledge_summary: summary[0],
    });
  } catch (err) { next(err); }
};

// ── PUT /api/pledges/payments/:paymentId ──────────────────────────────────────
// Admin confirms or updates a pending installment submitted by a member.
//
// WHO CAN CALL THIS:
//   - pastor / elder  → can confirm, reject, or correct any payment field.
//   - group_leader    → can confirm payments for members in their group.
//
// STATUS TRANSITIONS:
//   pending_confirmation → confirmed  (admin verifies the payment)
//   pending_confirmation → rejected   (admin rejects — wrong amount, bad method …)
//   confirmed            → confirmed  (admin corrects a confirmed payment's details)
//
exports.updatePayment = async (req, res, next) => {
  try {
    const { role, id: callerId, groupId } = req.user;
    if (!canManage(role)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const paymentId = parseInt(req.params.paymentId);

    const [existingRows] = await db.execute(
      `SELECT pp.*, mp.member_id, mp.annual_amount, mp.is_fulfilled, mp.status AS pledge_status
       FROM pledge_payments pp
       JOIN member_pledges mp ON mp.id = pp.pledge_id
       WHERE pp.id = ?`,
      [paymentId]
    );
    if (!existingRows.length) {
      return res.status(404).json({ success: false, message: 'Payment not found.' });
    }
    const existing = existingRows[0];

    // group_leader scope guard
    if (role === 'group_leader') {
      const inGroup = await memberInLeaderGroup(existing.member_id, groupId);
      if (!inGroup) return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const {
      status,
      amount,
      payment_date,
      payment_method,
      receipt_number,
      notes,
    } = req.body;

    const VALID_PAYMENT_STATUSES = ['confirmed', 'rejected'];
    if (status !== undefined && !VALID_PAYMENT_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `status must be one of: ${VALID_PAYMENT_STATUSES.join(', ')}.`,
      });
    }

    const VALID_METHODS = ['cash', 'bank_transfer', 'mobile_money', 'cheque'];
    if (payment_method !== undefined && !VALID_METHODS.includes(payment_method)) {
      return res.status(400).json({
        success: false,
        message: `payment_method must be one of: ${VALID_METHODS.join(', ')}.`,
      });
    }
    if (amount !== undefined && Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'amount must be greater than 0.' });
    }

    const fields = [], params = [];
    if (status         !== undefined) { fields.push('status = ?');         params.push(status); }
    if (amount         !== undefined) { fields.push('amount = ?');         params.push(Number(amount)); }
    if (payment_date   !== undefined) { fields.push('payment_date = ?');   params.push(payment_date); }
    if (payment_method !== undefined) { fields.push('payment_method = ?'); params.push(payment_method); }
    if (receipt_number !== undefined) { fields.push('receipt_number = ?'); params.push(receipt_number || null); }
    if (notes          !== undefined) { fields.push('notes = ?');          params.push(notes || null); }
    // Track who confirmed/updated the payment
    fields.push('confirmed_by = ?'); params.push(callerId);

    if (fields.length === 1) { // only confirmed_by was added, nothing real changed
      return res.status(400).json({ success: false, message: 'No updatable fields provided.' });
    }

    params.push(paymentId);
    await db.execute(`UPDATE pledge_payments SET ${fields.join(', ')} WHERE id = ?`, params);

    // Re-check fulfillment after a status change
    let autoFulfilled = false;
    if (status === 'confirmed') {
      const [[{ total_paid }]] = await db.execute(
        `SELECT COALESCE(SUM(amount), 0) AS total_paid
         FROM pledge_payments
         WHERE pledge_id = ? AND status = 'confirmed'`,
        [existing.pledge_id]
      );
      autoFulfilled = existing.annual_amount > 0 && total_paid >= existing.annual_amount;
      if (autoFulfilled && !existing.is_fulfilled) {
        await db.execute(
          'UPDATE member_pledges SET is_fulfilled = 1 WHERE id = ?',
          [existing.pledge_id]
        );
      }
    }

    // If a confirmed payment is now rejected, un-fulfill the pledge if needed
    if (status === 'rejected' && existing.is_fulfilled) {
      const [[{ total_paid }]] = await db.execute(
        `SELECT COALESCE(SUM(amount), 0) AS total_paid
         FROM pledge_payments
         WHERE pledge_id = ? AND status = 'confirmed'`,
        [existing.pledge_id]
      );
      if (total_paid < existing.annual_amount) {
        await db.execute(
          'UPDATE member_pledges SET is_fulfilled = 0 WHERE id = ?',
          [existing.pledge_id]
        );
      }
    }

    const [updatedPayment] = await db.execute(
      `SELECT pp.*, u.full_name AS recorded_by_name,
              cu.full_name AS confirmed_by_name
       FROM pledge_payments pp
       JOIN users u ON u.id = pp.recorded_by
       LEFT JOIN users cu ON cu.id = pp.confirmed_by
       WHERE pp.id = ?`,
      [paymentId]
    );
    const [summary] = await db.execute(
      'SELECT * FROM v_pledge_summary WHERE pledge_id = ?', [existing.pledge_id]
    );

    const message = status === 'confirmed'
      ? 'Payment confirmed.'
      : status === 'rejected'
        ? 'Payment rejected.'
        : 'Payment updated.';

    res.json({
      success:        true,
      message,
      auto_fulfilled: autoFulfilled,
      payment:        updatedPayment[0],
      pledge_summary: summary[0],
    });
  } catch (err) { next(err); }
};

// ── DELETE /api/pledges/payments/:paymentId ───────────────────────────────────
// Remove a payment (e.g. data-entry error). Pastor/elder only.
// Automatically un-fulfills the pledge if it was auto-marked.
exports.deletePayment = async (req, res, next) => {
  try {
    const { role } = req.user;
    if (!['pastor', 'elder'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Only pastor or elder can delete payments.' });
    }

    const [existing] = await db.execute(
      'SELECT * FROM pledge_payments WHERE id = ?', [req.params.paymentId]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Payment not found.' });
    }

    const pledgeId = existing[0].pledge_id;

    await db.execute('DELETE FROM pledge_payments WHERE id = ?', [req.params.paymentId]);

    // Re-check fulfillment after deletion
    const [[{ total_paid }]] = await db.execute(
      'SELECT COALESCE(SUM(amount), 0) AS total_paid FROM pledge_payments WHERE pledge_id = ?',
      [pledgeId]
    );
    const [pledgeRows] = await db.execute(
      'SELECT annual_amount, is_fulfilled FROM member_pledges WHERE id = ?', [pledgeId]
    );
    if (pledgeRows.length) {
      const { annual_amount, is_fulfilled } = pledgeRows[0];
      if (is_fulfilled && total_paid < annual_amount) {
        await db.execute(
          'UPDATE member_pledges SET is_fulfilled = 0 WHERE id = ?', [pledgeId]
        );
      }
    }

    res.json({ success: true, message: 'Payment deleted.' });
  } catch (err) { next(err); }
};


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — REPORTING
// ═══════════════════════════════════════════════════════════════════════════════

// ── GET /api/pledges/report ───────────────────────────────────────────────────
// Summary report: filter by year, campaign, group, or fulfillment status.
// Returns totals + per-member breakdown.
exports.getReport = async (req, res, next) => {
  try {
    const { role, id: userId, groupId } = req.user;
    if (!canManage(role)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const {
      year,
      campaign_id,
      group_id,
      is_fulfilled,
      scope,
    } = req.query;

    const conditions = [];
    const params     = [];

    if (year)        { conditions.push('campaign_year = ?');       params.push(year); }
    if (campaign_id) { conditions.push('campaign_id = ?');         params.push(campaign_id); }
    if (is_fulfilled !== undefined && is_fulfilled !== '') {
                       conditions.push('is_fulfilled = ?');         params.push(Number(is_fulfilled)); }
    if (scope)       { conditions.push('campaign_scope = ?');      params.push(scope); }

    // group_leader is restricted to their own group's members
    if (role === 'group_leader') {
      conditions.push(`member_id IN (
        SELECT id FROM users WHERE group_id = ?
      )`);
      params.push(groupId);
    } else if (group_id) {
      conditions.push(`member_id IN (
        SELECT id FROM users WHERE group_id = ?
      )`);
      params.push(group_id);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Per-member detail
    const [rows] = await db.execute(
      `SELECT * FROM v_pledge_summary ${where} ORDER BY campaign_year DESC, member_name`,
      params
    );

    // Aggregated totals
    const totals = rows.reduce((acc, r) => {
      acc.count++;
      acc.total_pledged += Number(r.annual_amount || 0);
      acc.total_paid    += Number(r.total_paid    || 0);
      if (Number(r.auto_fulfilled) || Number(r.is_fulfilled)) acc.fulfilled++;
      return acc;
    }, { count: 0, total_pledged: 0, total_paid: 0, fulfilled: 0 });

    totals.balance_due       = totals.total_pledged - totals.total_paid;
    totals.fulfillment_rate  = totals.count
      ? Math.round((totals.fulfilled / totals.count) * 100)
      : 0;

    res.json({
      success: true,
      totals,
      data: rows,
    });
  } catch (err) { next(err); }
};

// ── GET /api/pledges/types ────────────────────────────────────────────────────
// Returns the pledge_types catalogue (Jengo, Uwakili, Mabenchi …)
exports.getPledgeTypes = async (req, res, next) => {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM pledge_types WHERE is_active = 1 ORDER BY sort_order, name_sw'
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};