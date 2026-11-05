'use client';
/**
 * PaymentsTab.jsx
 * ───────────────
 * Tab 3 — Payment instalment confirmation workflow.
 *
 * Styling: uses the KKKT DMP Yombo design system (globals.css component
 * layer + tailwind.config.js tokens). No raw blue/emerald/red/neutral
 * utilities — those colours don't exist in the custom palette.
 *
 * Bilingual: all visible strings go through t() (en / sw).
 * Add the py_* keys below to src/lib/i18n.js.
 *
 * API refs (all exist in pledgeApi.js):
 *   getPayments(pledgeId)                           GET  /api/pledges/member-pledges/:id/payments
 *   addPayment(pledgeId, data)                      POST /api/pledges/member-pledges/:id/payments
 *   updatePayment(paymentId, { status })            PUT  /api/pledges/payments/:id
 *   deletePayment(paymentId)                        DELETE /api/pledges/payments/:id
 *
 * Props (from page.jsx):
 *   initialPledge  { pledge_id, member_name, campaign_name } | null  — drill-in from PledgesTab
 *   role           string
 *   fmtMoney       fn(amount)
 *   fmtDate        fn(dateStr)
 *   addToast       fn(msg, type)
 *   lang           'en' | 'sw'
 *
 * Translation keys needed (py_*):
 * ─────────────────────────────────────────────────────────────
 *  py_title                Payments / Malipo
 *  py_no_pledge_selected   Select a pledge to view payments / Chagua ahadi kuona malipo
 *  py_no_pledge_hint       Go to Pledges tab and click "View Payments" / Nenda kwenye kichupo cha Ahadi na bonyeza "Angalia malipo"
 *  py_pending_badge        {n} payment(s) awaiting confirmation / malipo {n} yanasubiri uthibitisho
 *  py_record_btn           Record Payment / Rekodi Malipo
 *  py_no_payments          No payments recorded yet. / Hakuna malipo yaliyorekodiwa bado.
 *  py_err_load             Failed to load payments. / Imeshindwa kupakia malipo.
 *  py_err_confirm          Confirmation failed. / Uthibitisho umeshindwa.
 *  py_err_reject           Rejection failed. / Kukataa kumeshindwa.
 *  py_err_delete           Delete failed. / Kufuta kumeshindwa.
 *  py_confirm_delete       Delete this payment record? This cannot be undone. / Futa rekodi hii ya malipo? Haitaweza kurudishwa.
 *  -- Table headers --
 *  py_col_member           Member / Mshirika
 *  py_col_campaign         Campaign / Kampeni
 *  py_col_amount           Amount / Kiasi
 *  py_col_date             Date / Tarehe
 *  py_col_method           Method / Njia
 *  py_col_receipt          Receipt / Risiti
 *  py_col_status           Status / Hali
 *  py_col_actions          Actions / Vitendo
 *  -- Payment status labels --
 *  py_status_confirmed              Confirmed / Imethibitishwa
 *  py_status_pending_confirmation   Awaiting confirmation / Inasubiri uthibitisho
 *  py_status_rejected               Rejected / Imekataliwa
 *  -- Record modal --
 *  py_record_title         Record Payment / Rekodi Malipo
 *  py_amount               Amount (TZS) / Kiasi (TZS)
 *  py_amount_placeholder   0
 *  py_payment_date         Payment Date / Tarehe ya Malipo
 *  py_method               Payment Method / Njia ya Malipo
 *  py_method_cash          Cash / Taslimu
 *  py_method_bank          Bank Transfer / Uhamisho wa Benki
 *  py_method_mobile        Mobile Money / Pesa za Simu
 *  py_method_cheque        Cheque / Hundi
 *  py_receipt              Receipt / Reference No. (optional) / Namba ya Risiti (hiari)
 *  py_receipt_placeholder  e.g. TXN-20260112
 *  py_notes                Notes (optional) / Maelezo (hiari)
 *  py_saving               Saving… / Inahifadhi…
 *  py_save                 Record Payment / Hifadhi Malipo
 *  py_err_invalid_amount   Enter a valid amount. / Ingiza kiasi sahihi.
 *  py_err_save             Failed to record payment. / Imeshindwa kuhifadhi malipo.
 *  -- Reject modal --
 *  py_reject_title         Reject Payment / Kataa Malipo
 *  py_reject_body          Provide a reason for rejecting this payment (optional). / Toa sababu ya kukataa malipo haya (hiari).
 *  py_reject_placeholder   e.g. Receipt number does not match… / mfano: Namba ya risiti haifanani…
 *  py_reject_btn           Reject Payment / Kataa Malipo
 *  -- Action buttons --
 *  py_confirm              Confirm / Thibitisha
 *  py_reject               Reject / Kataa
 *  py_delete               Delete / Futa
 *  py_rejection_reason     Reason: / Sababu:
 * ─────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback } from 'react';
import { pledgeApi } from '../../lib/pledgeApi';
import { useTranslation } from '../../lib/i18n';

// ─── Icons ────────────────────────────────────────────────────────────────────
const PlusIcon = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);
const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
    <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

// ─── Payment status pill ──────────────────────────────────────────────────────
// Maps to design-system badge classes only — no raw colour utilities.
const PAYMENT_STATUS_BADGE = {
  confirmed:            'badge-success',
  pending_confirmation: 'badge-warning',
  rejected:             'badge-danger',
};

function PaymentStatusPill({ status, t }) {
  const known = ['confirmed', 'pending_confirmation', 'rejected'].includes(status);
  return (
    <span className={`badge ${PAYMENT_STATUS_BADGE[status] ?? 'badge-neutral'}`}>
      {known ? t(`py_status_${status}`) : status}
    </span>
  );
}

// ─── Reject reason modal ──────────────────────────────────────────────────────
function RejectModal({ onConfirm, onCancel, t }) {
  const [reason, setReason] = useState('');
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h3 className="modal-title">{t('py_reject_title')}</h3>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onCancel} aria-label={t('cancel')}>
            <CloseIcon />
          </button>
        </div>
        <div className="modal-body flex flex-col gap-3">
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {t('py_reject_body')}
          </p>
          <textarea
            rows={3}
            className="textarea"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder={t('py_reject_placeholder')}
          />
        </div>
        <div className="modal-footer">
          <button onClick={onCancel} className="btn btn-ghost">{t('cancel')}</button>
          <button
            onClick={() => onConfirm(reason.trim())}
            className="btn btn-secondary"
            style={{ color: 'var(--danger)' }}
          >
            {t('py_reject_btn')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Record payment modal ─────────────────────────────────────────────────────
function RecordPaymentModal({ pledge, onClose, onSave, t }) {
  const [amount,      setAmount]      = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [method,      setMethod]      = useState('cash');
  const [receipt,     setReceipt]     = useState('');
  const [notes,       setNotes]       = useState('');
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');

  const handleSave = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0)
      return setError(t('py_err_invalid_amount'));
    setSaving(true);
    setError('');
    try {
      await onSave({
        amount:         Number(amount),
        payment_date:   paymentDate,
        payment_method: method,
        receipt_number: receipt.trim() || undefined,
        notes:          notes.trim()   || undefined,
      });
      onClose();
    } catch (e) {
      setError(e?.response?.data?.message ?? t('py_err_save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">{t('py_record_title')}</h2>
            {pledge && (
              <p className="card-subtitle" style={{ marginTop: '0.125rem' }}>
                {pledge.member_name} · {pledge.campaign_name}
              </p>
            )}
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon btn-sm" aria-label={t('cancel')}>
            <CloseIcon />
          </button>
        </div>

        <div className="modal-body flex flex-col gap-4">
          {error && <div className="banner banner-danger">{error}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">{t('py_amount')}</label>
              <input
                type="number" min="0" step="1000"
                className="input"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder={t('py_amount_placeholder')}
              />
            </div>
            <div className="form-group">
              <label className="form-label">{t('py_payment_date')}</label>
              <input
                type="date"
                className="input"
                value={paymentDate}
                onChange={e => setPaymentDate(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{t('py_method')}</label>
            <select
              className="select"
              value={method}
              onChange={e => setMethod(e.target.value)}
            >
              <option value="cash">{t('py_method_cash')}</option>
              <option value="bank_transfer">{t('py_method_bank')}</option>
              <option value="mobile_money">{t('py_method_mobile')}</option>
              <option value="cheque">{t('py_method_cheque')}</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">{t('py_receipt')}</label>
            <input
              type="text"
              className="input"
              value={receipt}
              onChange={e => setReceipt(e.target.value)}
              placeholder={t('py_receipt_placeholder')}
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t('py_notes')}</label>
            <textarea
              rows={2}
              className="textarea"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">{t('cancel')}</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary">
            {saving ? t('py_saving') : t('py_save')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────
export default function PaymentsTab({
  initialPledge = null,   // { pledge_id, member_name, campaign_name } from PledgesTab drill
  role,
  fmtMoney,
  fmtDate,
  addToast,
  lang,
}) {
  const { t } = useTranslation(lang);

  const [payments,      setPayments]      = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState('');
  const [showRecord,    setShowRecord]    = useState(false);
  const [rejectTarget,  setRejectTarget]  = useState(null); // paymentId
  const [actionLoading, setActionLoading] = useState({});   // paymentId → bool

  const canManage  = ['pastor', 'elder', 'group_leader'].includes(role);
  const canConfirm = ['pastor', 'elder'].includes(role);

  const money = (n) => (fmtMoney ? fmtMoney(n) : Number(n).toLocaleString());
  const date  = (d) => (fmtDate  ? fmtDate(d)  : d);

  // ── Load payments for the selected pledge ───────────────────────────────────
  // Uses pledgeApi.getPayments(pledgeId) → GET /pledges/member-pledges/:id/payments
  // Note: initialPledge.pledge_id is the PK from v_pledge_summary (not .id)
  const load = useCallback(async () => {
    if (!initialPledge?.pledge_id) return;
    setLoading(true);
    setError('');
    try {
      const r = await pledgeApi.getPayments(initialPledge.pledge_id);
      setPayments(r.data?.data ?? r.data ?? []);
    } catch (e) {
      setError(e?.response?.data?.message ?? t('py_err_load'));
    } finally {
      setLoading(false);
    }
  }, [initialPledge?.pledge_id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // ── Record payment ──────────────────────────────────────────────────────────
  const handleRecord = async (data) => {
    await pledgeApi.addPayment(initialPledge.pledge_id, data);
    await load();
    addToast?.(t('py_record_btn'), 'success');
  };

  // ── Confirm ─────────────────────────────────────────────────────────────────
  const handleConfirm = async (paymentId) => {
    setActionLoading(prev => ({ ...prev, [paymentId]: true }));
    try {
      await pledgeApi.updatePayment(paymentId, { status: 'confirmed' });
      await load();
    } catch (e) {
      setError(e?.response?.data?.message ?? t('py_err_confirm'));
    } finally {
      setActionLoading(prev => ({ ...prev, [paymentId]: false }));
    }
  };

  // ── Reject ──────────────────────────────────────────────────────────────────
  const handleReject = async (reason) => {
    const paymentId = rejectTarget;
    setRejectTarget(null);
    setActionLoading(prev => ({ ...prev, [paymentId]: true }));
    try {
      await pledgeApi.updatePayment(paymentId, {
        status: 'rejected',
        notes:  reason || undefined,
      });
      await load();
    } catch (e) {
      setError(e?.response?.data?.message ?? t('py_err_reject'));
    } finally {
      setActionLoading(prev => ({ ...prev, [paymentId]: false }));
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async (paymentId) => {
    if (!confirm(t('py_confirm_delete'))) return;
    setActionLoading(prev => ({ ...prev, [paymentId]: true }));
    try {
      await pledgeApi.deletePayment(paymentId);
      await load();
    } catch (e) {
      setError(e?.response?.data?.message ?? t('py_err_delete'));
    } finally {
      setActionLoading(prev => ({ ...prev, [paymentId]: false }));
    }
  };

  const pendingCount = payments.filter(p => p.status === 'pending_confirmation').length;

  // ── No pledge selected ──────────────────────────────────────────────────────
  if (!initialPledge?.pledge_id) {
    return (
      <div className="empty-state" style={{ marginTop: '1.5rem' }}>
        <svg className="empty-state-icon" viewBox="0 0 36 36" fill="none">
          <rect x="4" y="8" width="28" height="20" rx="3" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M12 18h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <p className="empty-state-title">{t('py_no_pledge_selected')}</p>
        <p className="empty-state-body">{t('py_no_pledge_hint')}</p>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5" style={{ marginTop: '1.5rem' }}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start',
        justifyContent: 'space-between', gap: '1rem',
        padding: '0.75rem 1rem',
        background: 'var(--surface-card)',
        borderRadius: 10,
        border: '1px solid var(--border-subtle)',
      }}>
        <div>
          <p style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '0.125rem' }}>
            {t('py_title')}
          </p>
          <p className="card-title" style={{ fontSize: '1rem' }}>
            {initialPledge.member_name}
          </p>
          <p className="card-subtitle">{initialPledge.campaign_name}</p>
          {pendingCount > 0 && canConfirm && (
            <p className="badge badge-warning" style={{ marginTop: '0.5rem', display: 'inline-flex' }}>
              {t('py_pending_badge').replace('{n}', pendingCount)}
            </p>
          )}
        </div>

        {canManage && (
          <button onClick={() => setShowRecord(true)} className="btn btn-primary btn-sm">
            <PlusIcon />
            {t('py_record_btn')}
          </button>
        )}
      </div>

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {error && <div className="banner banner-danger">{error}</div>}

      {/* ── Loading skeletons ─────────────────────────────────────────────── */}
      {loading && (
        <div className="flex flex-col gap-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton" style={{ height: 64, borderRadius: 10 }} />
          ))}
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {!loading && payments.length === 0 && (
        <div className="empty-state">
          <svg className="empty-state-icon" viewBox="0 0 36 36" fill="none">
            <rect x="4" y="8" width="28" height="20" rx="3" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M12 18h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <p className="empty-state-body">{t('py_no_payments')}</p>
          {canManage && (
            <div className="empty-state-actions">
              <button onClick={() => setShowRecord(true)} className="btn btn-secondary">
                {t('py_record_btn')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Desktop table ─────────────────────────────────────────────────── */}
      {!loading && payments.length > 0 && (
        <>
          <div className="hidden md:block" style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ background: 'var(--surface-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                  {[
                    t('py_col_amount'),
                    t('py_col_date'),
                    t('py_col_method'),
                    t('py_col_receipt'),
                    t('py_col_status'),
                    canConfirm ? t('py_col_actions') : null,
                  ].filter(Boolean).map((label, i) => (
                    <th
                      key={label}
                      style={{
                        padding: '0.625rem 1rem',
                        textAlign: i === 0 ? 'right' : 'left',
                        fontSize: '0.6875rem', fontWeight: 600,
                        letterSpacing: '0.06em', textTransform: 'uppercase',
                        color: 'var(--text-tertiary)', whiteSpace: 'nowrap',
                      }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map(p => {
                  const busy      = !!actionLoading[p.id];
                  const isPending = p.status === 'pending_confirmation';
                  return (
                    <tr
                      key={p.id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        opacity: busy ? 0.6 : 1,
                        pointerEvents: busy ? 'none' : undefined,
                        transition: 'background var(--dur-base), opacity var(--dur-base)',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-subtle)'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}
                    >
                      {/* Amount */}
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                        {money(p.amount)}
                      </td>
                      {/* Date */}
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {date(p.payment_date)}
                      </td>
                      {/* Method */}
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                        {(p.payment_method ?? '—').replace('_', ' ')}
                      </td>
                      {/* Receipt */}
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-tertiary)', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {p.receipt_number ?? '—'}
                      </td>
                      {/* Status */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <PaymentStatusPill status={p.status} t={t} />
                      </td>
                      {/* Actions */}
                      {canConfirm && (
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {isPending && (
                              <>
                                <button
                                  onClick={() => handleConfirm(p.id)}
                                  className="btn btn-primary btn-sm"
                                  style={{ fontSize: '0.75rem' }}
                                >
                                  {t('py_confirm')}
                                </button>
                                <button
                                  onClick={() => setRejectTarget(p.id)}
                                  className="btn btn-secondary btn-sm"
                                  style={{ fontSize: '0.75rem', color: 'var(--danger)' }}
                                >
                                  {t('py_reject')}
                                </button>
                              </>
                            )}
                            {canManage && (
                              <button
                                onClick={() => handleDelete(p.id)}
                                className="btn btn-ghost btn-sm"
                                style={{ fontSize: '0.75rem', color: 'var(--danger)' }}
                              >
                                {t('py_delete')}
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

          {/* ── Mobile cards ──────────────────────────────────────────────── */}
          <div className="md:hidden flex flex-col gap-3">
            {payments.map(p => {
              const busy      = !!actionLoading[p.id];
              const isPending = p.status === 'pending_confirmation';
              return (
                <div
                  key={p.id}
                  className="card card-body flex flex-col gap-3"
                  style={{
                    borderColor: isPending ? 'var(--warning)' : undefined,
                    opacity: busy ? 0.6 : 1,
                    pointerEvents: busy ? 'none' : undefined,
                    transition: 'opacity var(--dur-base) var(--ease-out)',
                  }}
                >
                  {/* Amount + status */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <p className="card-title" style={{ fontSize: '1.0625rem' }}>
                      {money(p.amount)}
                    </p>
                    <PaymentStatusPill status={p.status} t={t} />
                  </div>

                  {/* Meta row */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <span>
                      {t('py_col_date')}:{' '}
                      <strong style={{ color: 'var(--text-primary)' }}>{date(p.payment_date)}</strong>
                    </span>
                    <span>
                      {t('py_col_method')}:{' '}
                      <strong style={{ color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                        {(p.payment_method ?? '—').replace('_', ' ')}
                      </strong>
                    </span>
                    {p.receipt_number && (
                      <span>
                        {t('py_col_receipt')}:{' '}
                        <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                          {p.receipt_number}
                        </strong>
                      </span>
                    )}
                  </div>

                  {/* Rejection reason */}
                  {p.notes && p.status === 'rejected' && (
                    <p className="banner banner-danger" style={{ fontSize: '0.75rem', padding: '0.375rem 0.625rem' }}>
                      {t('py_rejection_reason')} {p.notes}
                    </p>
                  )}

                  {/* Confirm / Reject actions */}
                  {canConfirm && isPending && (
                    <div
                      style={{ display: 'flex', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}
                    >
                      <button
                        onClick={() => handleConfirm(p.id)}
                        className="btn btn-primary btn-sm"
                        style={{ flex: 1 }}
                      >
                        {t('py_confirm')}
                      </button>
                      <button
                        onClick={() => setRejectTarget(p.id)}
                        className="btn btn-secondary btn-sm"
                        style={{ flex: 1, color: 'var(--danger)' }}
                      >
                        {t('py_reject')}
                      </button>
                    </div>
                  )}

                  {/* Delete (always visible for managers on non-pending) */}
                  {canManage && !isPending && (
                    <div style={{ paddingTop: '0.25rem', borderTop: '1px solid var(--border-subtle)' }}>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--danger)' }}
                      >
                        {t('py_delete')}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      {showRecord && (
        <RecordPaymentModal
          pledge={initialPledge}
          onClose={() => setShowRecord(false)}
          onSave={handleRecord}
          t={t}
        />
      )}

      {rejectTarget && (
        <RejectModal
          onConfirm={handleReject}
          onCancel={() => setRejectTarget(null)}
          t={t}
        />
      )}
    </div>
  );
}