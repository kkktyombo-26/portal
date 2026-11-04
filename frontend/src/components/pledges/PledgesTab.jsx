'use client';
/**
 * PledgesTab.jsx
 * ──────────────
 * Tab 2 — Per-campaign member pledge subscriptions.
 *
 * Styling: uses the KKKT DMP Yombo design system (globals.css component
 * layer + tailwind.config.js tokens). No raw blue/emerald/red utilities —
 * those colours don't exist in the custom Tailwind palette.
 *
 * Layout philosophy: single root background. White surfaces (.card / .modal)
 * are used only for the structured pledge items and the modal — never nested.
 *
 * Bilingual: every visible string goes through t() (en / sw). Add the keys
 * from translations-pledges.js to src/lib/i18n.js.
 *
 * Roles:
 *   pastor / elder     → subscribe any member, approve / reject, delete
 *   group_leader       → subscribe members of their group, delete within group
 *   member             → read-only
 *
 * Props (from page.jsx):
 *   selectedMember   { id, name }
 *   initialCampaign  { id }          — pre-selects a campaign in the modal
 *   campaigns        Campaign[]
 *   role             string
 *   fmtMoney / fmtDate / pctBar      formatters
 *   onDrillPayments  fn(pledge)
 *   lang             'en' | 'sw'
 */

import { useState, useEffect, useCallback } from 'react';
import { pledgeApi } from '../../lib/pledgeApi';
import { useTranslation } from '../../lib/i18n';

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_BADGE = {
  active:   'badge-success',
  pending:  'badge-warning',
  rejected: 'badge-danger',
  inactive: 'badge-neutral',
};

function StatusPill({ status, t }) {
  const known = ['active', 'pending', 'rejected', 'inactive'].includes(status);
  return (
    <span className={`badge ${STATUS_BADGE[status] ?? 'badge-neutral'}`}>
      {known ? t(`pl_status_${status}`) : status}
    </span>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ pct }) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div className="progress-bar">
      <div
        className={`progress-fill ${clamped >= 100 ? 'success' : ''}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

// ─── Subscribe modal ──────────────────────────────────────────────────────────

function SubscribeModal({ campaigns, subscribedIds, defaultCampaignId, onClose, onSave, t }) {
  const [campaignId, setCampaignId] = useState(defaultCampaignId ?? '');
  const [amount, setAmount]         = useState('');
  const [pledgeType, setPledgeType] = useState('annual');
  const [notes, setNotes]           = useState('');
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  // Active campaigns the member isn't already subscribed to
  const available = campaigns.filter(
    c => c.is_active && !subscribedIds.includes(c.id)
  );

  const handleSave = async () => {
    if (!campaignId) return setError(t('pl_err_select_campaign'));
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0)
      return setError(t('pl_err_invalid_amount'));

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
      setError(e?.response?.data?.message ?? t('pl_err_subscribe'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{t('pl_subscribe_title')}</h2>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-icon btn-sm"
            aria-label={t('cancel')}
          >
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="modal-body flex flex-col gap-4">
          {error && <div className="banner banner-danger">{error}</div>}

          <div className="form-group">
            <label className="form-label">{t('pl_campaign')}</label>
            <select
              className="select"
              value={campaignId}
              onChange={e => setCampaignId(e.target.value)}
            >
              <option value="">{t('pl_select_campaign')}</option>
              {available.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.year})</option>
              ))}
            </select>
            {available.length === 0 && (
              <p className="form-hint">{t('pl_no_campaigns_available')}</p>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">{t('pl_amount')} (TZS)</label>
            <input
              type="number"
              min="0"
              step="1000"
              className="input"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder={t('pl_amount_placeholder')}
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t('pl_type')}</label>
            <select
              className="select"
              value={pledgeType}
              onChange={e => setPledgeType(e.target.value)}
            >
              <option value="annual">{t('pl_type_annual')}</option>
              <option value="monthly">{t('pl_type_monthly')}</option>
              <option value="weekly">{t('pl_type_weekly')}</option>
              <option value="one_time">{t('pl_type_one_time')}</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">{t('pl_notes')}</label>
            <textarea
              rows={2}
              className="textarea"
              style={{ minHeight: 64 }}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={t('pl_notes_placeholder')}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">{t('cancel')}</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary">
            {saving ? t('pl_subscribing') : t('pl_subscribe')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export default function PledgesTab({
  selectedMember,
  initialCampaign,
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

  const canManage  = ['pastor', 'elder', 'group_leader'].includes(role);
  const canApprove = ['pastor', 'elder'].includes(role);

  const money = (n) => (fmtMoney ? fmtMoney(n) : Number(n).toLocaleString());
  const date  = (d) => (fmtDate ? fmtDate(d) : d);

  // ── Load pledges ────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!selectedMember?.id) return;
    setLoading(true);
    setError('');
    try {
      const r = await pledgeApi.getMemberPledges(selectedMember.id);
      setPledges(r.data?.data ?? r.data ?? []);
    } catch (e) {
      setError(e?.response?.data?.message ?? t('pl_err_load'));
    } finally {
      setLoading(false);
    }
  }, [selectedMember?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // ── Subscribe ───────────────────────────────────────────────────────────────

  const handleSubscribe = async (campaignId, data) => {
    await pledgeApi.addMemberPledge(campaignId, {
      member_id:     selectedMember.id,
      annual_amount: data.amount,
      pledge_type:   data.pledge_type,
      notes:         data.notes,
    });
    await load();
  };

  // ── Approve / Reject ────────────────────────────────────────────────────────

  const handleStatusChange = async (pledgeId, status) => {
    setActionLoading(prev => ({ ...prev, [pledgeId]: true }));
    setError('');
    try {
      await pledgeApi.updateMemberPledge(pledgeId, { status });
      await load();
    } catch (e) {
      setError(e?.response?.data?.message ?? t('pl_err_action'));
    } finally {
      setActionLoading(prev => ({ ...prev, [pledgeId]: false }));
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────

  const handleDelete = async (pledgeId) => {
    if (!confirm(t('pl_confirm_remove'))) return;
    setActionLoading(prev => ({ ...prev, [pledgeId]: true }));
    setError('');
    try {
      await pledgeApi.deleteMemberPledge(pledgeId);
      await load();
    } catch (e) {
      setError(e?.response?.data?.message ?? t('pl_err_delete'));
    } finally {
      setActionLoading(prev => ({ ...prev, [pledgeId]: false }));
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!selectedMember) {
    return (
      <div className="empty-state">
        <svg className="empty-state-icon" viewBox="0 0 40 40" fill="none">
          <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="1.5" />
          <path d="M20 13v7M20 24v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <p className="empty-state-body">{t('pl_select_member')}</p>
      </div>
    );
  }

  const subscribedIds = pledges.map(p => p.campaign_id).filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h4 className="text-lg font-semibold">
            {t('pl_title')} — {selectedMember.name}
          </h4>
          <p className="form-hint">
            {pledges.length} {pledges.length === 1 ? t('pl_subscription_one') : t('pl_subscription_many')}
          </p>
        </div>
        {canManage && (
          <button onClick={() => setShowSubscribe(true)} className="btn btn-primary">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            {t('pl_subscribe_title')}
          </button>
        )}
      </div>

      {/* Error */}
      {error && <div className="banner banner-danger">{error}</div>}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton" style={{ height: 120, borderRadius: 12 }} />
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && pledges.length === 0 && (
        <div className="empty-state">
          <svg className="empty-state-icon" viewBox="0 0 36 36" fill="none">
            <rect x="4" y="8" width="28" height="20" rx="3" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12 18h12M12 23h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <p className="empty-state-title">{t('pl_empty_title')}</p>
          {canManage && (
            <div className="empty-state-actions">
              <button onClick={() => setShowSubscribe(true)} className="btn btn-secondary">
                {t('pl_empty_cta')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Pledge cards */}
      {!loading && pledges.map(pledge => {
        const paid  = Number(pledge.total_paid ?? 0);
        const total = Number(pledge.pledged_amount ?? 0);
        const pct   = pctBar ? pctBar(paid, total) : (total > 0 ? Math.min(100, (paid / total) * 100) : 0);
        const busy       = !!actionLoading[pledge.id];
        const isPending  = pledge.status === 'pending';
        const isRejected = pledge.status === 'rejected';

        const borderColor = isPending
          ? 'var(--warning)'
          : isRejected
          ? 'var(--danger)'
          : undefined;

        return (
          <div
            key={pledge.id}
            className="card card-body flex flex-col gap-4"
            style={{
              borderColor,
              opacity: busy ? 0.6 : 1,
              pointerEvents: busy ? 'none' : undefined,
              transition: 'opacity var(--dur-base) var(--ease-out)',
            }}
          >
            {/* Campaign + status */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="card-title">{pledge.campaign_name}</p>
                <p className="card-subtitle">{pledge.campaign_year}</p>
              </div>
              <StatusPill status={pledge.status ?? 'active'} t={t} />
            </div>

            {/* Amounts + progress */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-sm" style={{ color: 'var(--text-secondary)' }}>
                <span>
                  {t('pl_paid')}: <strong style={{ color: 'var(--text-primary)' }}>{money(paid)}</strong>
                </span>
                <span>
                  {t('pl_pledged')}: <strong style={{ color: 'var(--text-primary)' }}>{money(total)}</strong>
                </span>
              </div>
              <ProgressBar pct={pct} />
              <p className="form-hint" style={{ marginTop: 0 }}>
                {Math.round(pct)}% {t('pl_fulfilled')}
              </p>
            </div>

            {/* Meta */}
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
              <span>
                {t('pl_type')}:{' '}
                <strong style={{ color: 'var(--text-secondary)' }}>
                  {pledge.pledge_type ? t(`pl_type_short_${pledge.pledge_type}`) : '—'}
                </strong>
              </span>
              {pledge.subscribed_at && (
                <span>
                  {t('pl_subscribed')}:{' '}
                  <strong style={{ color: 'var(--text-secondary)' }}>{date(pledge.subscribed_at)}</strong>
                </span>
              )}
              {pledge.last_payment_date && (
                <span>
                  {t('pl_last_payment')}:{' '}
                  <strong style={{ color: 'var(--text-secondary)' }}>{date(pledge.last_payment_date)}</strong>
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              {onDrillPayments && (
                <button onClick={() => onDrillPayments(pledge)} className="btn btn-ghost btn-sm">
                  {t('pl_view_payments')}
                </button>
              )}

              {canApprove && isPending && (
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={() => handleStatusChange(pledge.id, 'active')}
                    className="btn btn-primary btn-sm"
                  >
                    {t('pl_approve')}
                  </button>
                  <button
                    onClick={() => handleStatusChange(pledge.id, 'rejected')}
                    className="btn btn-secondary btn-sm"
                    style={{ color: 'var(--danger)' }}
                  >
                    {t('pl_reject')}
                  </button>
                </div>
              )}

              {canManage && !isPending && (
                <button
                  onClick={() => handleDelete(pledge.id)}
                  className="btn btn-ghost btn-sm ml-auto"
                  style={{ color: 'var(--danger)' }}
                >
                  {t('pl_remove')}
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
          subscribedIds={subscribedIds}
          defaultCampaignId={initialCampaign?.id ?? ''}
          onClose={() => setShowSubscribe(false)}
          onSave={handleSubscribe}
          t={t}
        />
      )}
    </div>
  );
}