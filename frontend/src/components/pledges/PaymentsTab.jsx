'use client';
/**
 * PaymentsTab.jsx
 * ───────────────
 * Tab 3 — Payment instalment confirmation workflow.
 *
 * Roles:
 *   pastor / elder     → record payments, confirm / reject pending_confirmation
 *   group_leader       → record payments for own group members
 *   member             → read-only
 *
 * API refs:
 *   getAllPayments(params)                           GET /api/pledges/payments
 *   addPayment(pledgeId, data)                      POST /api/pledges/member-pledges/:id/payments
 *   updatePayment(paymentId, { status, reason })    PUT  /api/pledges/payments/:id
 *   deletePayment(paymentId)                        DELETE /api/pledges/payments/:id
 *
 * Props (from page.jsx):
 *   filterPledge   { id, member_name, campaign_name }|null  — drill-in from PledgesTab
 *   campaigns      Campaign[]
 *   role           string
 *   fmtMoney       fn(amount)
 *   fmtDate        fn(dateStr)
 *   lang           string
 */

import { useState, useEffect, useCallback } from 'react';
import { pledgeApi } from '../../lib/pledgeApi';

// ─── Status pill ──────────────────────────────────────────────────────────────

const PAYMENT_STATUS_STYLES = {
  confirmed:            'bg-emerald-50 text-emerald-700 border border-emerald-200',
  pending_confirmation: 'bg-amber-50  text-amber-700  border border-amber-200',
  rejected:             'bg-red-50    text-red-700    border border-red-200',
};

const PAYMENT_STATUS_LABELS = {
  confirmed:            'Confirmed',
  pending_confirmation: 'Awaiting confirmation',
  rejected:             'Rejected',
};

function PaymentStatusPill({ status }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${PAYMENT_STATUS_STYLES[status] ?? 'bg-neutral-100 text-neutral-500 border border-neutral-200'}`}>
      {PAYMENT_STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ─── Reject reason modal ──────────────────────────────────────────────────────

function RejectModal({ onConfirm, onCancel }) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="px-6 py-4 border-b border-neutral-100">
          <h3 className="text-base font-semibold text-neutral-900">Reject Payment</h3>
        </div>
        <div className="px-6 py-4 space-y-3">
          <p className="text-sm text-neutral-600">Provide a reason for rejecting this payment (optional but recommended).</p>
          <textarea
            rows={3}
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. Receipt number does not match…"
            className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
          />
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-neutral-100">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-900">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason.trim())}
            className="px-5 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Reject Payment
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Record payment modal ─────────────────────────────────────────────────────

function RecordPaymentModal({ pledge, onClose, onSave }) {
  const [amount, setAmount]           = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod]           = useState('cash');
  const [receipt, setReceipt]         = useState('');
  const [notes, setNotes]             = useState('');
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  const handleSave = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0)
      return setError('Enter a valid amount.');
    setSaving(true);
    setError('');
    try {
      await onSave({
        amount: Number(amount),
        payment_date: paymentDate,
        payment_method: method,
        receipt_number: receipt.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (e) {
      setError(e?.response?.data?.message ?? 'Failed to record payment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">Record Payment</h2>
            {pledge && (
              <p className="text-xs text-neutral-500 mt-0.5">
                {pledge.member_name} · {pledge.campaign_name}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">Amount (TZS)</label>
              <input
                type="number" min="0" step="1000"
                value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0"
                className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">Payment Date</label>
              <input
                type="date"
                value={paymentDate} onChange={e => setPaymentDate(e.target.value)}
                className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Payment Method</label>
            <select
              value={method} onChange={e => setMethod(e.target.value)}
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="mobile_money">Mobile Money</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Receipt / Reference No. (optional)</label>
            <input
              type="text"
              value={receipt} onChange={e => setReceipt(e.target.value)}
              placeholder="e.g. TXN-20260112"
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Notes (optional)</label>
            <textarea
              rows={2}
              value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-neutral-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-900">Cancel</button>
          <button
            onClick={handleSave} disabled={saving}
            className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Record Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export default function PaymentsTab({
  filterPledge = null,
  campaigns = [],
  role,
  fmtMoney,
  fmtDate,
  lang,
}) {
  const [payments, setPayments]             = useState([]);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState('');

  // Filters
  const [filterCampaign, setFilterCampaign] = useState(filterPledge?.campaign_id ?? '');
  const [filterStatus, setFilterStatus]     = useState('');

  // Modals
  const [showRecord, setShowRecord]         = useState(false);
  const [rejectTarget, setRejectTarget]     = useState(null); // paymentId
  const [actionLoading, setActionLoading]   = useState({});   // paymentId → bool

  const canManage  = ['pastor', 'elder', 'group_leader'].includes(role);
  const canConfirm = ['pastor', 'elder'].includes(role);

  // ── Load payments ───────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (filterPledge?.id) params.pledge_id    = filterPledge.id;
      if (filterCampaign)   params.campaign_id  = filterCampaign;
      if (filterStatus)     params.status       = filterStatus;

      const r = await pledgeApi.getAllPayments(params);
      // Backend returns { success, data: [] }
      setPayments(r.data?.data ?? r.data ?? []);
    } catch (e) {
      setError(e?.response?.data?.message ?? 'Failed to load payments.');
    } finally {
      setLoading(false);
    }
  }, [filterPledge?.id, filterCampaign, filterStatus]);

  useEffect(() => { load(); }, [load]);

  // ── Record payment ──────────────────────────────────────────────────────────

  const handleRecord = async (data) => {
    if (!filterPledge?.id) throw new Error('No pledge selected.');
    await pledgeApi.addPayment(filterPledge.id, data);
    await load();
  };

  // ── Confirm ─────────────────────────────────────────────────────────────────

  const handleConfirm = async (paymentId) => {
    setActionLoading(prev => ({ ...prev, [paymentId]: true }));
    try {
      await pledgeApi.updatePayment(paymentId, { status: 'confirmed' });
      await load();
    } catch (e) {
      alert(e?.response?.data?.message ?? 'Confirmation failed.');
    } finally {
      setActionLoading(prev => ({ ...prev, [paymentId]: false }));
    }
  };

  // ── Reject ───────────────────────────────────────────────────────────────────

  const handleReject = async (reason) => {
    const paymentId = rejectTarget;
    setRejectTarget(null);
    setActionLoading(prev => ({ ...prev, [paymentId]: true }));
    try {
      await pledgeApi.updatePayment(paymentId, {
        status: 'rejected',
        rejection_reason: reason || undefined,
      });
      await load();
    } catch (e) {
      alert(e?.response?.data?.message ?? 'Rejection failed.');
    } finally {
      setActionLoading(prev => ({ ...prev, [paymentId]: false }));
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────────

  const handleDelete = async (paymentId) => {
    if (!confirm('Delete this payment record? This cannot be undone.')) return;
    setActionLoading(prev => ({ ...prev, [paymentId]: true }));
    try {
      await pledgeApi.deletePayment(paymentId);
      await load();
    } catch (e) {
      alert(e?.response?.data?.message ?? 'Delete failed.');
    } finally {
      setActionLoading(prev => ({ ...prev, [paymentId]: false }));
    }
  };

  // ── Pending count badge ──────────────────────────────────────────────────────

  const pendingCount = payments.filter(p => p.status === 'pending_confirmation').length;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">
            Payments
            {filterPledge && (
              <span className="ml-2 text-neutral-400 font-normal text-sm">
                — {filterPledge.member_name} · {filterPledge.campaign_name}
              </span>
            )}
          </h2>
          {pendingCount > 0 && canConfirm && (
            <p className="text-xs text-amber-600 mt-0.5">
              {pendingCount} payment{pendingCount !== 1 ? 's' : ''} awaiting confirmation
            </p>
          )}
        </div>
        {canManage && filterPledge?.id && (
          <button
            onClick={() => setShowRecord(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
            Record Payment
          </button>
        )}
      </div>

      {/* Filters */}
      {!filterPledge && (
        <div className="flex flex-wrap gap-3">
          <select
            value={filterCampaign}
            onChange={e => setFilterCampaign(e.target.value)}
            className="border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[180px]"
          >
            <option value="">All campaigns</option>
            {campaigns.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.year})</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="pending_confirmation">Awaiting confirmation</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5">{error}</div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-16 bg-neutral-100 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && payments.length === 0 && (
        <div className="text-center py-16 text-neutral-400">
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" className="mx-auto mb-3 opacity-40">
            <rect x="4" y="8" width="28" height="20" rx="3" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M12 18h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <p className="text-sm">No payments recorded yet.</p>
        </div>
      )}

      {/* Payments table (desktop) / cards (mobile) */}
      {!loading && payments.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-neutral-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200">
                  <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500">Member</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500">Campaign</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Amount</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500">Method</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500">Receipt</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500">Status</th>
                  {canConfirm && <th className="px-4 py-3 text-xs font-medium text-neutral-500">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {payments.map(p => {
                  const busy = !!actionLoading[p.id];
                  const isPending = p.status === 'pending_confirmation';
                  return (
                    <tr key={p.id} className={`hover:bg-neutral-50 transition-colors ${busy ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3 font-medium text-neutral-900">{p.member_name ?? '—'}</td>
                      <td className="px-4 py-3 text-neutral-600">{p.campaign_name ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-mono text-neutral-900">
                        {fmtMoney ? fmtMoney(p.amount) : Number(p.amount).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-neutral-600">{fmtDate ? fmtDate(p.payment_date) : p.payment_date}</td>
                      <td className="px-4 py-3 text-neutral-600 capitalize">{(p.payment_method ?? '—').replace('_', ' ')}</td>
                      <td className="px-4 py-3 text-neutral-500 font-mono text-xs">{p.receipt_number ?? '—'}</td>
                      <td className="px-4 py-3"><PaymentStatusPill status={p.status} /></td>
                      {canConfirm && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {isPending && (
                              <>
                                <button
                                  onClick={() => handleConfirm(p.id)}
                                  disabled={busy}
                                  className="text-xs px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-100 transition-colors disabled:opacity-50"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setRejectTarget(p.id)}
                                  disabled={busy}
                                  className="text-xs px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-100 transition-colors disabled:opacity-50"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            {canManage && (
                              <button
                                onClick={() => handleDelete(p.id)}
                                disabled={busy}
                                className="text-xs text-neutral-400 hover:text-red-500 transition-colors disabled:opacity-50"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {payments.map(p => {
              const busy = !!actionLoading[p.id];
              const isPending = p.status === 'pending_confirmation';
              return (
                <div
                  key={p.id}
                  className={`bg-white border rounded-xl p-4 space-y-2.5 ${busy ? 'opacity-60' : ''} ${isPending ? 'border-amber-200' : 'border-neutral-200'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">{p.member_name ?? '—'}</p>
                      <p className="text-xs text-neutral-500">{p.campaign_name ?? '—'}</p>
                    </div>
                    <PaymentStatusPill status={p.status} />
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
                    <span>Amount: <strong className="text-neutral-900">{fmtMoney ? fmtMoney(p.amount) : Number(p.amount).toLocaleString()}</strong></span>
                    <span>Date: <strong className="text-neutral-700">{fmtDate ? fmtDate(p.payment_date) : p.payment_date}</strong></span>
                    <span>Method: <strong className="text-neutral-700 capitalize">{(p.payment_method ?? '—').replace('_', ' ')}</strong></span>
                    {p.receipt_number && <span>Ref: <strong className="text-neutral-700 font-mono">{p.receipt_number}</strong></span>}
                  </div>

                  {p.rejection_reason && (
                    <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">
                      Reason: {p.rejection_reason}
                    </p>
                  )}

                  {(canConfirm && isPending) && (
                    <div className="flex gap-2 pt-1 border-t border-neutral-100">
                      <button
                        onClick={() => handleConfirm(p.id)}
                        disabled={busy}
                        className="flex-1 text-xs py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setRejectTarget(p.id)}
                        disabled={busy}
                        className="flex-1 text-xs py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Modals */}
      {showRecord && (
        <RecordPaymentModal
          pledge={filterPledge}
          onClose={() => setShowRecord(false)}
          onSave={handleRecord}
        />
      )}

      {rejectTarget && (
        <RejectModal
          onConfirm={handleReject}
          onCancel={() => setRejectTarget(null)}
        />
      )}
    </div>
  );
}