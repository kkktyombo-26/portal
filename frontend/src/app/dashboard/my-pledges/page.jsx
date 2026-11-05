'use client';
/**
 * /app/dashboard/my-pledges/page.jsx
 * ────────────────────────────────────
 * Member self-service Pledges page — themed to KKKT DMP design system
 * (Stone #44403C · Amber #F59E0B) with full EN/SW bilinguality.
 */

import { useState, useEffect, useCallback } from 'react';
import { pledgeApi } from '../../../lib/pledgeApi';
import { useAuth } from '../../../hooks/useAuth';
import { useTranslation } from '../../../lib/i18n';
import Modal from '../../../components/ui/Modal';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtMoney = (n) =>
  Number(n ?? 0).toLocaleString('sw-TZ', {
    style: 'currency',
    currency: 'TZS',
    maximumFractionDigits: 0,
  });

const fmtDate = (d, lang = 'sw') =>
  d
    ? new Date(d).toLocaleDateString(lang === 'sw' ? 'sw-TZ' : 'en-GB', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '—';

// ─── Translation keys added to i18n (extend your translations object) ─────────
// All UI strings are keyed via t(). Keys listed here must exist in translations.js.
// Keys: pledges_title, pledges_subtitle, pledges_my, pledges_available,
//       pledges_active, pledges_total_pledged, pledges_total_paid,
//       pledges_no_pledges, pledges_no_pledges_sub, pledges_browse,
//       pledges_pending_notice, pledges_rejected_notice,
//       pledges_view_payments, pledges_withdraw,
//       pledges_last_payment, pledges_pledge_history, pledges_no_payments,
//       pledges_total_confirmed, pledges_make_pledge, pledges_already_subscribed,
//       pledges_campaign, pledges_select, pledges_amount_label,
//       pledges_how_pay, pledges_pay_full, pledges_pay_monthly,
//       pledges_pay_weekly, pledges_pay_once, pledges_note_label,
//       pledges_note_placeholder, pledges_approval_notice,
//       pledges_submit, pledges_submitting, pledges_withdraw_confirm,
//       pledges_target, pledges_pledged, pledges_paid, pledges_balance,
//       pledges_available_notice, pledges_all_subscribed, pledges_no_campaigns,
//       payment_confirmed, payment_pending, payment_rejected,
//       pledge_annual, pledge_monthly, pledge_weekly, pledge_one_time
//
// If these keys aren't in your translations file yet, the t() fallback returns
// the key string itself — add them when you wire up translations.

// ─── Status pill ──────────────────────────────────────────────────────────────

function StatusPill({ status, t }) {
  const map = {
    active: {
      labelKey: 'active',
      cls: 'bg-gold-50 text-gold-700 border-gold-200',
    },
    pending: {
      labelKey: 'pledges_status_pending',
      cls: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    rejected: {
      labelKey: 'pledges_status_rejected',
      cls: 'bg-red-50 text-red-700 border-red-200',
    },
  };

  // Fallback labels if translation keys aren't wired yet
  const fallbackLabels = {
    active: 'Active',
    pending: 'Awaiting Approval',
    rejected: 'Rejected',
  };

  const { labelKey, cls } = map[status] ?? {
    labelKey: status,
    cls: 'bg-neutral-100 text-neutral-500 border-neutral-200',
  };

  const label = t(labelKey) !== labelKey ? t(labelKey) : fallbackLabels[status] ?? status;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded text-2xs font-semibold tracking-wide border ${cls}`}
    >
      {label}
    </span>
  );
}

// ─── Progress ring ─────────────────────────────────────────────────────────────

function RingProgress({ pct }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const dash = circ * Math.min(1, pct / 100);
  const color = pct >= 100 ? '#15803D' : pct >= 50 ? '#F59E0B' : '#D97706';

  return (
    <svg width="56" height="56" viewBox="0 0 56 56" className="shrink-0">
      <circle cx="28" cy="28" r={r} fill="none" stroke="#F5F5F4" strokeWidth="4" />
      <circle
        cx="28"
        cy="28"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 28 28)"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      <text
        x="28"
        y="32"
        textAnchor="middle"
        fontSize="10"
        fill="#44403C"
        fontWeight="600"
        fontFamily="Inter, sans-serif"
      >
        {Math.round(pct)}%
      </text>
    </svg>
  );
}

// ─── Payment history drawer ────────────────────────────────────────────────────

function PaymentDrawer({ pledge, onClose, t, lang }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    pledgeApi
      .getPayments(pledge.pledge_id)
      .then((r) => setPayments(r.data?.data ?? r.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [pledge.pledge_id]);

  const statusDot = (status) => {
    if (status === 'confirmed') return 'bg-green-600';
    if (status === 'rejected') return 'bg-red-500';
    return 'bg-amber-400';
  };

  const statusLabel = (status) => {
    if (status === 'confirmed') return t('payment_confirmed') !== 'payment_confirmed' ? t('payment_confirmed') : 'Confirmed';
    if (status === 'rejected') return t('payment_rejected') !== 'payment_rejected' ? t('payment_rejected') : 'Rejected';
    return t('payment_pending') !== 'payment_pending' ? t('payment_pending') : 'Pending';
  };

  const statusTextCls = (status) => {
    if (status === 'confirmed') return 'text-green-700';
    if (status === 'rejected') return 'text-red-600';
    return 'text-amber-700';
  };

  const totalConfirmed = payments
    .filter((p) => p.status === 'confirmed')
    .reduce((s, p) => s + Number(p.amount ?? 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col"
        style={{ maxHeight: '82vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <div>
            <h3
              className="text-base font-semibold text-neutral-900"
              style={{ fontFamily: 'Lora, Georgia, serif' }}
            >
              {t('pledges_history') !== 'pledges_history' ? t('pledges_history') : 'Payment History'}
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">{pledge.campaign_name}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-neutral-100 text-neutral-400 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M4 4l8 8M12 4L4 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
          {loading && (
            <p className="text-sm text-neutral-400 text-center py-10">
              {t('loading')}
            </p>
          )}

          {!loading && payments.length === 0 && (
            <div className="text-center py-10">
              <p className="text-sm text-neutral-500">
                {t('pledges_no_payments') !== 'pledges_no_payments'
                  ? t('pledges_no_payments')
                  : 'No payments recorded yet.'}
              </p>
            </div>
          )}

          {!loading &&
            payments.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-4 py-3 border-b border-neutral-100 last:border-0"
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot(p.status)}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-neutral-900">{fmtMoney(p.amount)}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {fmtDate(p.payment_date, lang)} ·{' '}
                    {(p.payment_method ?? '').replace('_', ' ')}
                    {p.receipt_number ? ` · ${p.receipt_number}` : ''}
                  </p>
                  {p.rejection_reason && (
                    <p className="text-xs text-red-500 mt-0.5">{p.rejection_reason}</p>
                  )}
                </div>
                <span className={`text-xs font-medium shrink-0 ${statusTextCls(p.status)}`}>
                  {statusLabel(p.status)}
                </span>
              </div>
            ))}
        </div>

        {/* Summary footer */}
        {!loading && payments.length > 0 && (
          <div className="px-6 py-4 border-t border-neutral-100 rounded-b-2xl"
               style={{ background: '#F5F4F0' }}>
            <div className="flex justify-between items-center">
              <span className="text-xs text-neutral-500 uppercase tracking-wide font-medium">
                {t('pledges_total_confirmed') !== 'pledges_total_confirmed'
                  ? t('pledges_total_confirmed')
                  : 'Total Confirmed'}
              </span>
              <span className="text-sm font-bold text-green-700">{fmtMoney(totalConfirmed)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Subscribe modal ───────────────────────────────────────────────────────────

function SubscribeModal({ campaigns, existingCampaignIds, onClose, onSave, t }) {
  const available = campaigns.filter(
    (c) => c.is_active && !existingCampaignIds.includes(c.id)
  );

  const [campaignId, setCampaignId] = useState('');
  const [amount, setAmount] = useState('');
  const [pledgeType, setPledgeType] = useState('annual');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const payTypes = [
    { value: 'annual',   labelKey: 'pledges_pay_full',    fallback: 'Full amount at once' },
    { value: 'monthly',  labelKey: 'pledges_pay_monthly', fallback: 'Monthly instalments' },
    { value: 'weekly',   labelKey: 'pledges_pay_weekly',  fallback: 'Weekly instalments' },
    { value: 'one_time', labelKey: 'pledges_pay_once',    fallback: 'One-time gift' },
  ];

  const handleSave = async () => {
    if (!campaignId) return setError(t('pledges_select_campaign') !== 'pledges_select_campaign' ? t('pledges_select_campaign') : 'Select a campaign.');
    if (!amount || Number(amount) <= 0) return setError(t('pledges_valid_amount') !== 'pledges_valid_amount' ? t('pledges_valid_amount') : 'Enter a valid amount.');
    setSaving(true);
    setError('');
    try {
      await onSave(Number(campaignId), {
        annual_amount: Number(amount),
        pledge_type: pledgeType,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (e) {
      setError(e?.response?.data?.message ?? (t('pledges_submit_error') !== 'pledges_submit_error' ? t('pledges_submit_error') : 'Submission failed. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const labelCls = 'block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1';
  const inputCls =
    'w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm text-neutral-900 bg-white focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30 transition-colors';

  return (
    <Modal isOpen onClose={onClose} title={t('pledges_make_pledge') !== 'pledges_make_pledge' ? t('pledges_make_pledge') : 'Make a Pledge'}>
      {available.length === 0 ? (
        <p className="text-sm text-neutral-500 text-center py-6">
          {t('pledges_already_subscribed') !== 'pledges_already_subscribed'
            ? t('pledges_already_subscribed')
            : 'You are already subscribed to all active campaigns.'}
        </p>
      ) : (
        <div className="space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5">
              {error}
            </div>
          )}

          <div>
            <label className={labelCls}>
              {t('pledges_campaign') !== 'pledges_campaign' ? t('pledges_campaign') : 'Campaign'}
            </label>
            <select
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              className={inputCls}
              style={{ appearance: 'none' }}
            >
              <option value="">
                {t('pledges_select') !== 'pledges_select' ? t('pledges_select') : '— Select —'}
              </option>
              {available.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.year})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>
              {t('pledges_amount_label') !== 'pledges_amount_label'
                ? t('pledges_amount_label')
                : 'My Pledge Amount (TZS)'}
            </label>
            <input
              type="number"
              min="0"
              step="1000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>
              {t('pledges_how_pay') !== 'pledges_how_pay' ? t('pledges_how_pay') : 'How will I pay?'}
            </label>
            <select
              value={pledgeType}
              onChange={(e) => setPledgeType(e.target.value)}
              className={inputCls}
              style={{ appearance: 'none' }}
            >
              {payTypes.map((pt) => (
                <option key={pt.value} value={pt.value}>
                  {t(pt.labelKey) !== pt.labelKey ? t(pt.labelKey) : pt.fallback}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>
              {t('pledges_note_label') !== 'pledges_note_label'
                ? t('pledges_note_label')
                : 'Note (optional)'}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                t('pledges_note_placeholder') !== 'pledges_note_placeholder'
                  ? t('pledges_note_placeholder')
                  : 'Any note to church leaders…'
              }
              className={`${inputCls} resize-none`}
              style={{ height: 'auto' }}
            />
          </div>

          <p className="text-xs text-neutral-400 leading-relaxed">
            {t('pledges_approval_notice') !== 'pledges_approval_notice'
              ? t('pledges_approval_notice')
              : 'Your pledge will be sent to church leaders for approval before it appears as active.'}
          </p>

          <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 text-sm font-semibold text-white rounded-lg transition-colors disabled:opacity-50"
              style={{ background: saving ? '#D97706' : '#F59E0B' }}
            >
              {saving
                ? (t('pledges_submitting') !== 'pledges_submitting' ? t('pledges_submitting') : 'Submitting…')
                : (t('pledges_submit') !== 'pledges_submit' ? t('pledges_submit') : 'Submit Pledge')}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Pledge card ──────────────────────────────────────────────────────────────

function PledgeCard({ pledge, onViewPayments, onDelete, t, lang }) {
  const paid = Number(pledge.total_paid ?? 0);
  const total = Number(pledge.annual_amount ?? 0);
 const balance = Number(pledge.balance_due ?? 0);
  const pct = total > 0 ? (paid / total) * 100 : 0;

  const pledgeTypeLabels = {
    annual:   t('pledge_annual')   !== 'pledge_annual'   ? t('pledge_annual')   : 'Annual',
    monthly:  t('pledge_monthly')  !== 'pledge_monthly'  ? t('pledge_monthly')  : 'Monthly',
    weekly:   t('pledge_weekly')   !== 'pledge_weekly'   ? t('pledge_weekly')   : 'Weekly',
    one_time: t('pledge_one_time') !== 'pledge_one_time' ? t('pledge_one_time') : 'One-time',
  };

  const borderCls =
    pledge.pledge_status === 'pending'
      ? 'border-amber-300'
      : pledge.pledge_status === 'rejected'
      ? 'border-red-300'
      : 'border-neutral-200';

  return (
    <div className={`bg-white border ${borderCls} rounded-2xl overflow-hidden shadow-sm`}>
      {/* Amber accent top bar — only for active pledges */}
      {pledge.pledge_status === 'active' && (
        <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #B45309 0%, #FCD34D 50%, #B45309 100%)' }} />
      )}
      {pledge.pledge_status === 'pending' && (
        <div className="h-0.5 w-full bg-amber-400" />
      )}
      {pledge.pledge_status === 'rejected' && (
        <div className="h-0.5 w-full bg-red-400" />
      )}

      <div className="p-5 space-y-4">
        {/* Top row */}
        <div className="flex items-start gap-4">
          <RingProgress pct={pct} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <p
                  className="text-sm font-semibold text-neutral-900 leading-tight"
                  style={{ fontFamily: 'Lora, Georgia, serif' }}
                >
                  {pledge.campaign_name}
                </p>
                <p className="text-xs text-neutral-500 mt-0.5">{pledge.campaign_year}</p>
              </div>
              <StatusPill status={pledge.status ?? 'active'} t={t} />
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              {pledgeTypeLabels[pledge.pledge_type ?? 'annual']}{' '}
              {t('pledges_pledge') !== 'pledges_pledge' ? t('pledges_pledge') : 'pledge'}
            </p>
          </div>
        </div>

        {/* Amount grid */}
        <div className="grid grid-cols-3 gap-2">
          <div
            className="rounded-xl py-3 text-center"
            style={{ background: '#F5F4F0' }}
          >
            <p className="text-2xs font-semibold text-neutral-500 uppercase tracking-wide">
              {t('pledges_pledged') !== 'pledges_pledged' ? t('pledges_pledged') : 'Pledged'}
            </p>
            <p className="text-sm font-bold text-neutral-900 mt-0.5">{fmtMoney(total)}</p>
          </div>
          <div className="bg-green-50 rounded-xl py-3 text-center">
            <p className="text-2xs font-semibold text-green-600 uppercase tracking-wide">
              {t('pledges_paid') !== 'pledges_paid' ? t('pledges_paid') : 'Paid'}
            </p>
            <p className="text-sm font-bold text-green-700 mt-0.5">{fmtMoney(paid)}</p>
          </div>
          <div
            className="rounded-xl py-3 text-center"
            style={{ background: '#F5F4F0' }}
          >
            <p className="text-2xs font-semibold text-neutral-500 uppercase tracking-wide">
              {t('pledges_balance') !== 'pledges_balance' ? t('pledges_balance') : 'Balance'}
            </p>
            <p className="text-sm font-bold text-neutral-900 mt-0.5">{fmtMoney(balance)}</p>
          </div>
        </div>

        {/* Status notices */}
        {pledge.status === 'rejected' && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2 leading-relaxed">
            {t('pledges_rejected_notice') !== 'pledges_rejected_notice'
              ? t('pledges_rejected_notice')
              : 'This pledge was not approved. Contact church leadership for more information.'}
          </div>
        )}
        {pledge.pledge_status === 'pending' && (
          <div className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 leading-relaxed">
            {t('pledges_pending_notice') !== 'pledges_pending_notice'
              ? t('pledges_pending_notice')
              : 'Awaiting approval from church leadership.'}
          </div>
        )}

        {/* Last payment */}
        {pledge.last_payment_date && (
          <p className="text-xs text-neutral-400">
            {t('pledges_last_payment') !== 'pledges_last_payment'
              ? t('pledges_last_payment')
              : 'Last payment:'}{' '}
            {fmtDate(pledge.last_payment_date, lang)}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1 border-t border-neutral-100">
          <button
            onClick={() => onViewPayments(pledge)}
            className="text-xs font-medium transition-colors"
            style={{ color: '#D97706' }}
            onMouseEnter={(e) => (e.target.style.color = '#B45309')}
            onMouseLeave={(e) => (e.target.style.color = '#D97706')}
          >
            {t('pledges_view_payments') !== 'pledges_view_payments'
              ? t('pledges_view_payments')
              : 'View payments'}{' '}
            →
          </button>
          {pledge.pledge_status === 'pending' && (
            <button
              onClick={() => onDelete(pledge.pledge_id)}
              className="text-xs text-red-400 hover:text-red-600 ml-auto transition-colors"
            >
              {t('pledges_withdraw') !== 'pledges_withdraw'
                ? t('pledges_withdraw')
                : 'Withdraw'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Available campaign card ──────────────────────────────────────────────────

function CampaignCard({ campaign, onPledge, t }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #B45309 0%, #FCD34D 50%, #B45309 100%)' }} />
      <div className="p-5 space-y-3">
        <div>
          <p
            className="text-sm font-semibold text-neutral-900"
            style={{ fontFamily: 'Lora, Georgia, serif' }}
          >
            {campaign.name}
          </p>
          <p className="text-xs text-neutral-500 mt-0.5">
            {campaign.year}
            {campaign.scope ? ` · ${campaign.scope}` : ''}
          </p>
        </div>

        {campaign.description && (
          <p className="text-xs text-neutral-600 leading-relaxed">{campaign.description}</p>
        )}

        {campaign.target_amount && (
          <p className="text-xs text-neutral-500">
            {t('pledges_target') !== 'pledges_target' ? t('pledges_target') : 'Campaign target'}:{' '}
            <strong className="text-neutral-900 font-semibold">
              {fmtMoney(campaign.target_amount)}
            </strong>
          </p>
        )}

        <button
          onClick={() => onPledge(campaign)}
          className="w-full mt-1 py-2.5 text-sm font-semibold text-white rounded-xl transition-colors"
          style={{ background: '#F59E0B' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#D97706')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#F59E0B')}
        >
          {t('pledges_make_pledge') !== 'pledges_make_pledge'
            ? t('pledges_make_pledge')
            : 'Make a Pledge'}
        </button>
      </div>
    </div>
  );
}

// ─── Summary stat ─────────────────────────────────────────────────────────────

function StatCard({ label, value, accent }) {
  return (
    <div
      className="bg-white border border-neutral-200 rounded-2xl px-4 py-4 text-center relative overflow-hidden shadow-sm"
    >
      <div
        className="absolute top-0 left-0 right-0 h-0.5"
        style={{ background: '#F59E0B' }}
      />
      <p className="text-2xs font-semibold text-neutral-500 uppercase tracking-wide">{label}</p>
      <p
        className={`text-base font-bold mt-1 ${accent ? 'text-green-700' : 'text-neutral-900'}`}
        style={{ fontFamily: 'Lora, Georgia, serif' }}
      >
        {value}
      </p>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function MyPledgesPage() {
  const { user, lang } = useAuth();
  const { t } = useTranslation(lang);

  const [myPledges, setMyPledges] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [activeTab, setActiveTab] = useState('my');
  const [drawerPledge, setDrawerPledge] = useState(null);
  const [showSubscribe, setShowSubscribe] = useState(false);

  // ── Load data ────────────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [pledgesRes, campaignsRes] = await Promise.all([
        pledgeApi.getMemberPledges(user.id),
        pledgeApi.getCampaigns(),
      ]);
      setMyPledges(pledgesRes.data?.data ?? pledgesRes.data ?? []);
      setCampaigns(campaignsRes.data?.data ?? campaignsRes.data ?? []);
    } catch (e) {
      setError(
        e?.response?.data?.message ??
          (t('pledges_load_error') !== 'pledges_load_error'
            ? t('pledges_load_error')
            : 'Failed to load your pledges.')
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ── Subscribe ────────────────────────────────────────────────────────────────

  const handleSubscribe = async (campaignId, data) => {
    await pledgeApi.addMemberPledge(campaignId, {
      ...data,
      member_id: user.id,
    });
    await loadAll();
  };

  // ── Delete ───────────────────────────────────────────────────────────────────

  const handleDelete = async (pledgeId) => {
    const confirmMsg =
      t('pledges_withdraw_confirm') !== 'pledges_withdraw_confirm'
        ? t('pledges_withdraw_confirm')
        : 'Withdraw this pledge?';
    if (!confirm(confirmMsg)) return;
    try {
      await pledgeApi.deleteMemberPledge(pledgeId);
      await loadAll();
    } catch (e) {
      alert(e?.response?.data?.message ?? 'Could not withdraw pledge.');
    }
  };

  // ── Derived ──────────────────────────────────────────────────────────────────

  const existingCampaignIds = myPledges.map((p) => Number(p.campaign_id));
  const availableCampaigns = campaigns.filter(
    (c) => !existingCampaignIds.includes(c.id)
  );

  const totalPledged = myPledges.reduce((s, p) => s + Number(p.annual_amount ?? 0), 0);
  const totalPaid = myPledges.reduce((s, p) => s + Number(p.total_paid ?? 0), 0);
  const activePledgesCount = myPledges.filter((p) => p.status === 'active').length;

  // ── Tab labels ────────────────────────────────────────────────────────────────

  const tabMyLabel =
    (t('pledges_my') !== 'pledges_my' ? t('pledges_my') : 'My Pledges') +
    (myPledges.length ? ` (${myPledges.length})` : '');

  const tabAvailLabel =
    (t('pledges_available') !== 'pledges_available' ? t('pledges_available') : 'Available') +
    (availableCampaigns.length ? ` (${availableCampaigns.length})` : '');

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ background: '#F5F4F0', minHeight: '100%' }}>
      {/* Page header — stone-900 dark bar matching design system */}
      <div
        className="relative overflow-hidden px-5 py-5 md:px-8"
        style={{ background: '#292524' }}
      >
        {/* Amber gradient top line */}
        <div
          className="absolute top-0 left-0 right-0 h-0.5"
          style={{
            background: 'linear-gradient(90deg, #B45309 0%, #FCD34D 50%, #B45309 100%)',
          }}
        />
        {/* Subtle grid texture */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v1H0zM0 0h1v40H0z' fill='%23ffffff' fill-opacity='.04'/%3E%3C/svg%3E\")",
          }}
        />
        <p
          className="text-xs font-semibold uppercase tracking-widest mb-1"
          style={{ color: '#FBBF24', position: 'relative' }}
        >
          {t('pledges_eyebrow') !== 'pledges_eyebrow'
            ? t('pledges_eyebrow')
            : lang === 'sw'
            ? 'Mchango Wangu'
            : 'My Giving'}
        </p>
        <h1
          className="text-lg font-bold text-white"
          style={{ fontFamily: 'Lora, Georgia, serif', position: 'relative' }}
        >
          {t('pledges_title') !== 'pledges_title'
            ? t('pledges_title')
            : lang === 'sw'
            ? 'Sadaka na Ahadi Zangu'
            : 'My Pledges'}
        </h1>
        <p
          className="text-sm mt-0.5"
          style={{ color: 'rgba(255,255,255,.60)', position: 'relative' }}
        >
          {t('pledges_subtitle') !== 'pledges_subtitle'
            ? t('pledges_subtitle')
            : lang === 'sw'
            ? 'Fuatilia ahadi na maendeleo ya malipo'
            : 'Track your commitments and payment progress'}
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 pb-14 space-y-5">
        {/* Error banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {/* Summary strip */}
        {!loading && myPledges.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              label={
                t('pledges_active') !== 'pledges_active'
                  ? t('pledges_active')
                  : lang === 'sw'
                  ? 'Zinazofanya Kazi'
                  : 'Active'
              }
              value={activePledgesCount}
            />
            <StatCard
              label={
                t('pledges_total_pledged') !== 'pledges_total_pledged'
                  ? t('pledges_total_pledged')
                  : lang === 'sw'
                  ? 'Jumla Ahadi'
                  : 'Total Pledged'
              }
              value={fmtMoney(totalPledged)}
            />
            <StatCard
              label={
                t('pledges_total_paid') !== 'pledges_total_paid'
                  ? t('pledges_total_paid')
                  : lang === 'sw'
                  ? 'Jumla Iliyolipwa'
                  : 'Total Paid'
              }
              value={fmtMoney(totalPaid)}
              accent
            />
          </div>
        )}

        {/* Tabs — pill style matching design system */}
        <div
          className="flex gap-1 p-1 rounded-xl"
          style={{ background: '#E7E5E4' }}
        >
          {[
            { key: 'my', label: tabMyLabel },
            { key: 'available', label: tabAvailLabel },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex-1 py-2 text-sm font-medium rounded-lg transition-all"
              style={
                activeTab === tab.key
                  ? {
                      background: '#FFFFFF',
                      color: '#D97706',
                      boxShadow: '0 1px 3px rgba(68,64,60,.10)',
                    }
                  : { color: '#78716C' }
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Loading skeletons */}
        {loading && (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-52 rounded-2xl animate-pulse"
                style={{ background: '#E7E5E4' }}
              />
            ))}
          </div>
        )}

        {/* My Pledges tab */}
        {!loading && activeTab === 'my' && (
          <>
            {myPledges.length === 0 ? (
              <div className="text-center py-16">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ background: '#FFFBEB' }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17 5.8 21.3l2.4-7.4L2 9.4h7.6L12 2z"
                      stroke="#D97706"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <p
                  className="text-sm font-semibold text-neutral-800"
                  style={{ fontFamily: 'Lora, Georgia, serif' }}
                >
                  {t('pledges_no_pledges') !== 'pledges_no_pledges'
                    ? t('pledges_no_pledges')
                    : lang === 'sw'
                    ? 'Hakuna ahadi bado'
                    : 'No pledges yet'}
                </p>
                <p className="text-xs text-neutral-500 mt-1 mb-5">
                  {t('pledges_no_pledges_sub') !== 'pledges_no_pledges_sub'
                    ? t('pledges_no_pledges_sub')
                    : lang === 'sw'
                    ? 'Jiunge na kampeni ili kuanza kutoa mchango'
                    : 'Join an active campaign to start contributing'}
                </p>
                <button
                  onClick={() => setActiveTab('available')}
                  className="px-5 py-2 text-sm font-semibold text-white rounded-xl transition-colors"
                  style={{ background: '#F59E0B' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#D97706')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#F59E0B')}
                >
                  {t('pledges_browse') !== 'pledges_browse'
                    ? t('pledges_browse')
                    : lang === 'sw'
                    ? 'Tazama Kampeni'
                    : 'Browse Campaigns'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {myPledges.map((pledge) => (
                  <PledgeCard
                    key={pledge.pledge_id}
                    pledge={pledge}
                    onViewPayments={setDrawerPledge}
                    onDelete={handleDelete}
                    t={t}
                    lang={lang}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Available Campaigns tab */}
        {!loading && activeTab === 'available' && (
          <>
            {availableCampaigns.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-sm text-neutral-500">
                  {campaigns.length === 0
                    ? (t('pledges_no_campaigns') !== 'pledges_no_campaigns'
                        ? t('pledges_no_campaigns')
                        : lang === 'sw'
                        ? 'Hakuna kampeni zinazoendelea sasa hivi.'
                        : 'No active campaigns at the moment.')
                    : (t('pledges_all_subscribed') !== 'pledges_all_subscribed'
                        ? t('pledges_all_subscribed')
                        : lang === 'sw'
                        ? 'Umejisajili kwa kampeni zote zinazoendelea.'
                        : 'You are subscribed to all active campaigns.')}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-neutral-500 leading-relaxed">
                  {t('pledges_available_notice') !== 'pledges_available_notice'
                    ? t('pledges_available_notice')
                    : lang === 'sw'
                    ? 'Ahadi yako itapelekwa kwa viongozi wa kanisa kwa idhini.'
                    : 'Your pledge will be submitted for approval from church leadership.'}
                </p>
                {availableCampaigns.map((campaign) => (
                  <CampaignCard
                    key={campaign.id}
                    campaign={campaign}
                    onPledge={() => setShowSubscribe(campaign)}
                    t={t}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Payment history drawer */}
      {drawerPledge && (
        <PaymentDrawer
          pledge={drawerPledge}
          onClose={() => setDrawerPledge(null)}
          t={t}
          lang={lang}
        />
      )}

      {/* Subscribe modal */}
      {showSubscribe && (
        <SubscribeModal
          campaigns={campaigns}
          existingCampaignIds={existingCampaignIds}
          onClose={() => setShowSubscribe(false)}
          onSave={handleSubscribe}
          t={t}
        />
      )}
    </div>
  );
}