/**
 * pledgeApi.js
 * ─────────────
 * API client for the Pledge Campaign module.
 * Mirrors the pattern in lib/api.js — all methods return Axios promises.
 *
 * Append this export block to your existing lib/api.js, or import from here:
 *   import { pledgeApi } from '@/lib/pledgeApi';
 *
 * Base URL:  /api/pledges  (mounted in app.js via pledgeRoutes.js)
 */

import api from './api'; // re-uses the shared Axios instance with auth interceptors

export const pledgeApi = {

  // ── Pledge Types (catalogue) ─────────────────────────────────────────────
  // GET /api/pledges/types
  // Returns: [{ id, name_sw, name_en, description, is_active, sort_order }]
  getTypes: () =>
    api.get('/pledges/types'),

  // ── Campaigns ────────────────────────────────────────────────────────────
  // GET /api/pledges/campaigns
  // Returns: campaigns with subscriber_count, total_pledged, total_paid
  getCampaigns: () =>
    api.get('/pledges/campaigns'),

  // GET /api/pledges/campaigns/:id
  getCampaign: (id) =>
    api.get(`/pledges/campaigns/${id}`),

  // POST /api/pledges/campaigns
  // body: { name, pledge_type_id, scope, group_id?, member_id?,
  //         pledge_year, start_date?, end_date?, target_amount?, description? }
  createCampaign: (data) =>
    api.post('/pledges/campaigns', data),

  // PUT /api/pledges/campaigns/:id
  // body: { name?, description?, start_date?, end_date?, target_amount?, is_active? }
  updateCampaign: (id, data) =>
    api.put(`/pledges/campaigns/${id}`, data),

  // DELETE /api/pledges/campaigns/:id  (soft-delete: is_active = 0)
  deleteCampaign: (id) =>
    api.delete(`/pledges/campaigns/${id}`),

  // ── Member Pledges ────────────────────────────────────────────────────────
  // GET /api/pledges/campaigns/:id/members
  // Returns: all pledges in a campaign (from v_pledge_summary)
  getCampaignPledges: (campaignId) =>
    api.get(`/pledges/campaigns/${campaignId}/members`),

  // GET /api/pledges/members/:userId
  // Returns: all pledges across campaigns for one member
  getMemberPledges: (userId) =>
    api.get(`/pledges/members/${userId}`),

  // POST /api/pledges/campaigns/:id/members
  // body: { member_id, annual_amount, pledge_number?, signed_date?, notes? }
  addMemberPledge: (campaignId, data) =>
    api.post(`/pledges/campaigns/${campaignId}/members`, data),

  // PUT /api/pledges/member-pledges/:pledgeId
  // body: { annual_amount?, pledge_number?, signed_date?, is_fulfilled?, notes? }
  updateMemberPledge: (pledgeId, data) =>
    api.put(`/pledges/member-pledges/${pledgeId}`, data),

  // DELETE /api/pledges/member-pledges/:pledgeId  (hard-delete + cascade payments)
  deleteMemberPledge: (pledgeId) =>
    api.delete(`/pledges/member-pledges/${pledgeId}`),

  // ── Payments (installments) ───────────────────────────────────────────────
  // GET /api/pledges/member-pledges/:pledgeId/payments
  getPayments: (pledgeId) =>
    api.get(`/pledges/member-pledges/${pledgeId}/payments`),

  // POST /api/pledges/member-pledges/:pledgeId/payments
  // body: { amount, payment_date, payment_method?, receipt_number?, notes? }
  addPayment: (pledgeId, data) =>
    api.post(`/pledges/member-pledges/${pledgeId}/payments`, data),

  // DELETE /api/pledges/payments/:paymentId  (auto un-fulfills if needed)
  deletePayment: (paymentId) =>
    api.delete(`/pledges/payments/${paymentId}`),

  // ── Reporting ─────────────────────────────────────────────────────────────
  // GET /api/pledges/report
  // params: { year?, campaign_id?, group_id?, is_fulfilled?, scope? }
  getReport: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null)
      )
    ).toString();
    return api.get(`/pledges/report${qs ? `?${qs}` : ''}`);
  },
};