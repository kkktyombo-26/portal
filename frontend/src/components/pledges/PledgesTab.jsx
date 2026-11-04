'use client';
/**
 * PledgesTab.jsx
 * ──────────────
 * Tab 2 — Per-campaign member pledge subscriptions.
 *
 * Roles:
 *   pastor / elder     → subscribe any member, approve / reject pending pledges, delete
 *   group_leader       → subscribe members of their own group, delete within group
 *   member             → read-only (can delete their own pledge via My Pledges page)
 *
 * API refs (all from pledgeApi):
 *   getMemberPledges(memberId)                    GET /api/pledges/member/:memberId
 *   getCampaigns()                                GET /api/pledges/campaigns
 *   addMemberPledge(campaignId, data)             POST /api/pledges/campaigns/:id/members
 *   updateMemberPledge(pledgeId, { status })      PUT  /api/pledges/member-pledges/:id
 *   deleteMemberPledge(pledgeId)                  DELETE /api/pledges/member-pledges/:id
 *
 * Props (from page.jsx):
 *   selectedMember  { id, name }   — the member being viewed
 *   campaigns       Campaign[]     — full campaign list (already fetched by page)
 *   role            string         — current user's role
 *   fmtMoney        fn(amount)     — locale-aware money formatter
 *   fmtDate         fn(dateStr)    — locale-aware date formatter
 *   pctBar          fn(paid, total)→ 0–100 — percentage helper
 *   onDrillPayments fn(pledge)     — navigate to PaymentsTab filtered to this pledge
 *   lang            string
 */

import { useState, useEffect, useCallback } from 'react';
import { pledgeApi } from '../../lib/pledgeApi';
import { useTranslation } from '../../lib/i18n';

// ─── Status pill ──────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  active:   'bg-emerald-50 text-emerald-700 border border-emerald-200',
  pending:  'bg-amber-50  text-amber-700  border border-amber-200',
  rejected: 'bg-red-50    text-red-700    border border-red-200',
  inactive: 'bg-neutral-100 text-neutral-500 border border-neutral-200',
};

function StatusPill({ status }) {
  const label = {
    active:   'Active',
    pending:  'Pending approval',
    rejected: 'Rejected',
    inactive: 'Inactive',
  }[status] ?? status;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[status] ?? STATUS_STYLES.inactive}`}>
      {label}
    </span>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ pct }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const color = clamped >= 100 ? 'bg-emerald-500' : clamped >= 50 ? 'bg-blue-500' : 'bg-amber-400';
  return (
    <div className="w-full bg-neutral-100 rounded-full h-1.5 overflow-hidden">
      <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

// ─── Subscribe modal ──────────────────────────────────────────────────────────

function SubscribeModal({ campaigns, onClose, onSave, fmtMoney }) {
  const [campaignId, setCampaignId]     = useState('');
  const [amount, setAmount]             = useState('');
  const [pledgeType, setPledgeType]     = useState('annual');
  const [notes, setNotes]               = useState('');
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState('');

  // Only show active campaigns the member isn't yet subscribed to
  const active = campaigns.filter(c => c.is_active);

  const handleSave = async () => {
    if (!campaignId) return setError('Select a campaign.');
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0)
      return setError('Enter a valid pledge amount.');

    setSaving(true);
    setError('');
    try {
      await onSave(Number(campaignId), {
        amount: Number(amount),
        pledge_type: pledgeType,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (e) {
      setError(e?.response?.data?.message ?? 'Failed to subscribe. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <h2 className="text-base font-semibold text-neutral-900">Subscribe to Campaign</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 transition-colors">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Campaign</label>
            <select
              value={campaignId}
              onChange={e => setCampaignId(e.target.value)}
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Select campaign —</option>
              {active.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.year})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Pledge Amount (TZS)</label>
            <input
              type="number"
              min="0"
              step="1000"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="e.g. 500,000"
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Pledge Type</label>
            <select
              value={pledgeType}
              onChange={e => setPledgeType(e.target.value)}
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="annual">Annual (lump-sum)</option>
              <option value="monthly">Monthly instalments</option>
              <option value="weekly">Weekly instalments</option>
              <option value="one_time">One-time gift</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Notes (optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any notes about this pledge…"
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-neutral-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Subscribing…' : 'Subscribe'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export default function PledgesTab({
  selectedMember,
  campaigns = [],
  role,
  fmtMoney,
  fmtDate,
  pctBar,
  onDrillPayments,
  lang,
}) {
  const { t } = useTranslation(lang);

  const [pledges, setPledges]             = useState([]);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState('');
  const [showSubscribe, setShowSubscribe] = useState(false);
  const [actionLoading, setActionLoading] = useState({}); // pledgeId → bool

  const canManage = ['pastor', 'elder', 'group_leader'].includes(role);
  const canApprove = ['pastor', 'elder'].includes(role);

  // ── Load pledges ──────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!selectedMember?.id) return;
    setLoading(true);
    setError('');
    try {
      const r = await pledgeApi.getMemberPledges(selectedMember.id);
      // Backend returns { success, data: [] }
      setPledges(r.data?.data ?? r.data ?? []);
    } catch (e) {
      setError(e?.response?.data?.message ?? 'Failed to load pledges.');
    } finally {
      setLoading(false);
    }
  }, [selectedMember?.id]);

  useEffect(() => { load(); }, [load]);

  // ── Subscribe ──────────────────────────────────────────────────────────────

  const handleSubscribe = async (campaignId, data) => {
  await pledgeApi.addMemberPledge(campaignId, {
  annual_amount: Number(amount),
  notes: notes.trim() || undefined,
});
    await load();
  };

  // ── Approve / Reject ───────────────────────────────────────────────────────

  const handleStatusChange = async (pledgeId, status) => {
    setActionLoading(prev => ({ ...prev, [pledgeId]: true }));
    try {
      await pledgeApi.updateMemberPledge(pledgeId, { status });
      await load();
    } catch (e) {
      alert(e?.response?.data?.message ?? 'Action failed.');
    } finally {
      setActionLoading(prev => ({ ...prev, [pledgeId]: false }));
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = async (pledgeId) => {
    if (!confirm('Remove this pledge subscription?')) return;
    setActionLoading(prev => ({ ...prev, [pledgeId]: true }));
    try {
      await pledgeApi.deleteMemberPledge(pledgeId);
      await load();
    } catch (e) {
      alert(e?.response?.data?.message ?? 'Delete failed.');
    } finally {
      setActionLoading(prev => ({ ...prev, [pledgeId]: false }));
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!selectedMember) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="mb-3 opacity-40">
          <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M20 13v7M20 24v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <p className="text-sm">Select a member to view their pledges.</p>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">
            Pledges — {selectedMember.name}
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            {pledges.length} subscription{pledges.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowSubscribe(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
            Subscribe to Campaign
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-neutral-100 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && pledges.length === 0 && (
        <div className="text-center py-16 text-neutral-400">
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" className="mx-auto mb-3 opacity-40">
            <rect x="4" y="8" width="28" height="20" rx="3" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M12 18h12M12 23h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <p className="text-sm">No pledge subscriptions yet.</p>
          {canManage && (
            <button
              onClick={() => setShowSubscribe(true)}
              className="mt-3 text-sm text-blue-600 hover:underline"
            >
              Subscribe to a campaign
            </button>
          )}
        </div>
      )}

      {/* Pledge cards */}
      {!loading && pledges.map(pledge => {
        const paid    = Number(pledge.total_paid ?? 0);
        const total   = Number(pledge.pledged_amount ?? 0);
        const pct     = pctBar ? pctBar(paid, total) : (total > 0 ? Math.min(100, (paid / total) * 100) : 0);
        const busy    = !!actionLoading[pledge.id];
        const isPending  = pledge.status === 'pending';
        const isRejected = pledge.status === 'rejected';

        return (
          <div
            key={pledge.id}
            className={`bg-white border rounded-xl p-4 space-y-3 transition-opacity ${busy ? 'opacity-60 pointer-events-none' : ''} ${isPending ? 'border-amber-200' : isRejected ? 'border-red-200' : 'border-neutral-200'}`}
          >
            {/* Campaign name + status */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-neutral-900">{pledge.campaign_name}</p>
                <p className="text-xs text-neutral-500 mt-0.5">{pledge.campaign_year}</p>
              </div>
              <StatusPill status={pledge.status ?? 'active'} />
            </div>

            {/* Amounts + progress */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <span>Paid: <strong className="text-neutral-900">{fmtMoney ? fmtMoney(paid) : paid.toLocaleString()}</strong></span>
                <span>Pledged: <strong className="text-neutral-900">{fmtMoney ? fmtMoney(total) : total.toLocaleString()}</strong></span>
              </div>
              <ProgressBar pct={pct} />
              <p className="text-xs text-neutral-400">{Math.round(pct)}% fulfilled</p>
            </div>

            {/* Meta */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
              <span>Type: <strong className="text-neutral-700 capitalize">{(pledge.pledge_type ?? '—').replace('_', ' ')}</strong></span>
              {pledge.subscribed_at && (
                <span>Subscribed: <strong className="text-neutral-700">{fmtDate ? fmtDate(pledge.subscribed_at) : pledge.subscribed_at}</strong></span>
              )}
              {pledge.last_payment_date && (
                <span>Last payment: <strong className="text-neutral-700">{fmtDate ? fmtDate(pledge.last_payment_date) : pledge.last_payment_date}</strong></span>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-neutral-100">
              {/* View payments */}
              {onDrillPayments && (
                <button
                  onClick={() => onDrillPayments(pledge)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  View payments →
                </button>
              )}

              {/* Approve / Reject — pastor / elder only on pending pledges */}
              {canApprove && isPending && (
                <>
                  <button
                    onClick={() => handleStatusChange(pledge.id, 'active')}
                    className="ml-auto text-xs px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleStatusChange(pledge.id, 'rejected')}
                    className="text-xs px-3 py-1 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    Reject
                  </button>
                </>
              )}

              {/* Delete */}
              {canManage && !isPending && (
                <button
                  onClick={() => handleDelete(pledge.id)}
                  className="ml-auto text-xs text-red-500 hover:text-red-700 transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* Subscribe modal */}
      {showSubscribe && (
        <SubscribeModal
          campaigns={campaigns}
          onClose={() => setShowSubscribe(false)}
          onSave={handleSubscribe}
          fmtMoney={fmtMoney}
        />
      )}
    </div>
  );
}