/**
 * pledgeApi.js
 * ─────────────
 * API client for the Pledge Campaign module.
 * Ref: BSS-KKKT-2026-003
 *
 * Import from here:
 *   import { pledgeApi } from '@/lib/pledgeApi';
 *
 * Uses the shared axios instance from lib/api.js — token attachment,
 * 401 redirect, and error normalisation are all handled there.
 *
 * All methods return Axios promises.  The caller is responsible for
 * .then(r => r.data) and error handling.
 *
 * Base URL: http://localhost:4000/api  (from shared api instance)
 * Pledge routes mounted at: /pledges   (app.use('/api/pledges', pledgeRoutes))
 */

import api from './api';

// ─── Campaigns ────────────────────────────────────────────────────────────────

/** GET  /pledges/campaigns  — list all campaigns (filtered by role server-side) */
const getCampaigns = (params = {}) =>
  api.get('/pledges/campaigns', { params });

/** GET  /pledges/campaigns/:id  — single campaign with totals */
const getCampaign = (campaignId) =>
  api.get(`/pledges/campaigns/${campaignId}`);

/** POST /pledges/campaigns  — create a new campaign (pastor/elder/group_leader) */
const createCampaign = (data) =>
  api.post('/pledges/campaigns', data);

/** PUT  /pledges/campaigns/:id  — update campaign details */
const updateCampaign = (campaignId, data) =>
  api.put(`/pledges/campaigns/${campaignId}`, data);

/** PATCH /pledges/campaigns/:id/toggle  — toggle active/inactive */
const toggleCampaign = (campaignId) =>
  api.patch(`/pledges/campaigns/${campaignId}/toggle`);

/** DELETE /pledges/campaigns/:id  — soft-delete (pastor/elder only) */
const deleteCampaign = (campaignId) =>
  api.delete(`/pledges/campaigns/${campaignId}`);

// ─── Member Pledges ───────────────────────────────────────────────────────────

/**
 * GET /pledges/campaigns/:id/members
 * List all pledge subscriptions for a campaign (managers only).
 */
const getCampaignPledges = (campaignId) =>
  api.get(`/pledges/campaigns/${campaignId}/members`);

/**
 * GET /pledges/members/:userId
 * List all pledge subscriptions for a member (admin & self).
 */
const getMemberPledges = (userId) =>
  api.get(`/pledges/members/${userId}`);

/**
 * POST /pledges/campaigns/:campaignId/members
 * Subscribe a member to a campaign.
 * Body: { member_id?, annual_amount, pledge_number?, signed_date? }
 * managers → any member_id; members → self only (status: pending)
 */
const addMemberPledge = (campaignId, data) =>
  api.post(`/pledges/campaigns/${campaignId}/members`, data);

/**
 * PUT /pledges/member-pledges/:pledgeId
 * Update a member's pledge.
 * Body: { annual_amount?, pledge_number?, signed_date?, is_fulfilled?, notes?, status? }
 * pastor|elder → all fields incl. status
 * group_leader → amount, pledge_number, signed_date, notes
 * member       → annual_amount, notes (pending only)
 */
const updateMemberPledge = (pledgeId, data) =>
  api.put(`/pledges/member-pledges/${pledgeId}`, data);

/**
 * DELETE /pledges/member-pledges/:pledgeId
 * Remove a pledge subscription (pastor/elder only).
 */
const deleteMemberPledge = (pledgeId) =>
  api.delete(`/pledges/member-pledges/${pledgeId}`);

// ─── Payments ─────────────────────────────────────────────────────────────────

/**
 * GET /pledges/member-pledges/:pledgeId/payments
 * List payment instalments for one pledge subscription.
 */
const getPayments = (pledgeId) =>
  api.get(`/pledges/member-pledges/${pledgeId}/payments`);

/**
 * POST /pledges/member-pledges/:pledgeId/payments
 * Record a new payment instalment.
 * Body: { amount, payment_date, payment_method?, receipt_number?, notes? }
 * managers → confirmed immediately; members → pending_confirmation
 */
const addPayment = (pledgeId, data) =>
  api.post(`/pledges/member-pledges/${pledgeId}/payments`, data);

/**
 * PUT /pledges/payments/:paymentId
 * Confirm, reject, or correct a payment (managers only).
 * Body: { status?, amount?, payment_date?, payment_method?, receipt_number?, notes? }
 */
const updatePayment = (paymentId, data) =>
  api.put(`/pledges/payments/${paymentId}`, data);

/**
 * DELETE /pledges/payments/:paymentId
 * Void / delete a payment record (pastor/elder only).
 */
const deletePayment = (paymentId) =>
  api.delete(`/pledges/payments/${paymentId}`);

// ─── Reports ──────────────────────────────────────────────────────────────────

/**
 * GET /pledges/report
 * Aggregated pledge summary (backed by v_pledge_summary).
 * Params: year, campaign_id, group_id, is_fulfilled, scope
 * Returns: { success, totals, data: rows[] }
 */
const getReport = (params = {}) =>
  api.get('/pledges/report', { params });


const getCampaignMembers = (campaignId) =>
  api.get(`/pledges/campaigns/${campaignId}/members`);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** GET /pledges/types  — lookup list of pledge types */
const getTypes = () =>
  api.get('/pledges/types');

// ─── Named export (matches existing api.js pattern) ───────────────────────────

export const pledgeApi = {
  // campaigns
  getCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  toggleCampaign,
  deleteCampaign,
    getCampaignMembers,

  // member pledges
  getCampaignPledges,
  getMemberPledges,
  addMemberPledge,
  updateMemberPledge,
  deleteMemberPledge,

  // payments
  getPayments,
  addPayment,
  updatePayment,
  deletePayment,

  // reports
  getReport,

  // helpers
  getTypes,
};