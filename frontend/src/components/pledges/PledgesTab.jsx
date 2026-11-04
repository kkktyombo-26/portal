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
 *   member             → read own pledges only
 *
 * Props (from page.jsx):
 *   selectedMember    { id, name } | null   — controlled from page; can be set here too
 *   onSelectMember    fn({ id, name })       — lifts member selection up to page
 *   initialCampaign   { id } | null          — pre-selects a campaign filter
 *   campaigns         Campaign[]
 *   role              string
 *   fmtMoney / fmtDate / pctBar             formatters
 *   onDrillPayments   fn(pledge)
 *   addToast          fn(msg, type)
 *   lang              'en' | 'sw'
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
const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <circle cx="6.5" cy="6.5" r="4.5"/>
    <path d="M10.5 10.5l3.5 3.5"/>
  </svg>
);

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

// ─── Member picker ────────────────────────────────────────────────────────────
/**
 * Shown at the top of the tab whenever no member is selected.
 * Fetches the member list from the API (filtered by campaign if one is active)
 * and lets the user pick one.
 *
 * For the 'member' role we skip the picker entirely — the page wires
 * selectedMember to the logged-in user before rendering this tab.
 */
function MemberPicker({ campaignId, onSelect, t }) {
  const [query,   setQuery]   = useState('');
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      setLoading(true);
      setError('');
      try {
        // If a campaign is active, we can scope the member list to its subscribers;
        // otherwise fall back to the full members list.
        const res = campaignId
          ? await pledgeApi.getCampaignMembers(campaignId)
          : await pledgeApi.getMembers();
        if (!cancelled) {
          setMembers(res.data?.data ?? res.data ?? []);
        }
      } catch (e) {
        if (!cancelled) setError(e?.response?.data?.message ?? t('pl_err_load_members'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetch();
    return () => { cancelled = true; };
  }, [campaignId]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = members.filter(m =>
    !query.trim() ||
    m.name?.toLowerCase().includes(query.toLowerCase()) ||
    m.phone?.includes(query)
  );

  return (
    <div style={{ maxWidth: 480 }}>
      <p className="card-title" style={{ marginBottom: '0.75rem' }}>{t('pl_pick_member')}</p>

      {/* Search box */}
      <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
        <span style={{
          position: 'absolute', left: '0.75rem', top: '50%',
          transform: 'translateY(-50%)', color: 'var(--text-tertiary)',
          pointerEvents: 'none',
        }}>
          <SearchIcon />
        </span>
        <input
          className="input"
          style={{ paddingLeft: '2.25rem' }}
          placeholder={t('pl_search_member')}
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      {error && <div className="banner banner-danger" style={{ marginBottom: '0.5rem' }}>{error}</div>}

      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton" style={{ height: 44, borderRadius: 8 }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="form-hint">{t('pl_no_members_found')}</p>
      ) : (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '0.25rem',
          maxHeight: 320, overflowY: 'auto',
        }}>
          {filtered.map(m => (
            <button
              key={m.id}
              className="btn btn-ghost"
              style={{
                justifyContent: 'flex-start', textAlign: 'left',
                padding: '0.5rem 0.75rem', borderRadius: 8,
              }}
              onClick={() => onSelect({ id: m.id, name: m.name })}
            >
              <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{m.name}</span>
              {m.phone && (
                <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                  {m.phone}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Subscribe modal ──────────────────────────────────────────────────────────
function SubscribeModal({ campaigns, subscribedIds, defaultCampaignId, onClose, onSave, t }) {
  const [campaignId, setCampaignId] = useState(defaultCampaignId ?? '');
  const [amount,     setAmount]     = useState('');
  const [pledgeType, setPledgeType] = useState('annual');
  const [notes,      setNotes]      = useState('');
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');

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
        amount:      Number(amount),
        pledge_type: pledgeType,
        notes:       notes.trim() || undefined,
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
          <button onClick={onClose} className="btn btn-ghost btn-icon btn-sm" aria-label={t('cancel')}>
            <CloseIcon />
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
                <option key={c.id} value={c.id}>{c.name} ({c.pledge_year})</option>
              ))}
            </select>
            {available.length === 0 && (
              <p className="form-hint">{t('pl_no_campaigns_available')}</p>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">{t('pl_amount')} (TZS)</label>
            <input
              type="number" min="0" step="1000"
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
  onSelectMember,
  initialCampaign,
  campaigns = [],
  role,
  fmtMoney,
  fmtDate,
  pctBar,
  onDrillPayments,
  addToast,
  lang,
}) {
  const { t } = useTranslation(lang);

  const [pledges,       setPledges]       = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState('');
  const [showSubscribe, setShowSubscribe] = useState(false);
  const [actionLoading, setActionLoading] = useState({}); // pledgeId → bool

  // Campaign filter — pre-seeded from drillToPledges, user can change it
  const [filterCampaign, setFilterCampaign] = useState(initialCampaign?.id ?? '');

  // Sync filter when page changes the initialCampaign (e.g. second drill)
  useEffect(() => {
    setFilterCampaign(initialCampaign?.id ?? '');
  }, [initialCampaign?.id]);

  const canManage  = ['pastor', 'elder', 'group_leader'].includes(role);
  const canApprove = ['pastor', 'elder'].includes(role);

  const money = (n) => (fmtMoney ? fmtMoney(n) : Number(n).toLocaleString());
  const date  = (d) => (fmtDate  ? fmtDate(d)  : d);

  // ── Load pledges for the selected member ────────────────────────────────────
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

  // ── Filter pledges by selected campaign ─────────────────────────────────────
  const visiblePledges = filterCampaign
    ? pledges.filter(p => String(p.campaign_id) === String(filterCampaign))
    : pledges;

  const subscribedIds = pledges.map(p => p.campaign_id).filter(Boolean);

  // ── If no member selected: show picker (or empty state for 'member' role) ───
  if (!selectedMember) {
    // 'member' role: page.jsx should wire selectedMember = logged-in user.
    // If it doesn't, show a soft message rather than the picker.
    if (role === 'member') {
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

    // For leaders / admins: show the member picker
    return (
      <div style={{ marginTop: '1.5rem' }}>
        <MemberPicker
          campaignId={filterCampaign || null}
          onSelect={onSelectMember}
          t={t}
        />
      </div>
    );
  }

  // ── Render pledges for selected member ───────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">

      {/* ── Member context bar ───────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '1rem', flexWrap: 'wrap', marginTop: '1.5rem',
        padding: '0.75rem 1rem',
        background: 'var(--surface-card)',
        borderRadius: 10,
        border: '1px solid var(--border-subtle)',
      }}>
        <div>
          <p style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '0.125rem' }}>
            {t('pl_viewing_member')}
          </p>
          <p className="card-title" style={{ fontSize: '1rem' }}>{selectedMember.name}</p>
          <p className="form-hint" style={{ marginTop: '0.125rem' }}>
            {visiblePledges.length}{' '}
            {visiblePledges.length === 1 ? t('pl_subscription_one') : t('pl_subscription_many')}
            {filterCampaign && campaigns.find(c => String(c.id) === String(filterCampaign)) && (
              <> · {campaigns.find(c => String(c.id) === String(filterCampaign)).name}</>
            )}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Campaign filter */}
          {campaigns.length > 0 && (
            <select
              className="select"
              style={{ width: 200 }}
              value={filterCampaign}
              onChange={e => setFilterCampaign(e.target.value)}
            >
              <option value="">{t('pl_all_campaigns')}</option>
              {campaigns.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.pledge_year})</option>
              ))}
            </select>
          )}

          {/* Change member (leaders only) */}
          {canManage && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => onSelectMember(null)}
            >
              {t('pl_change_member')}
            </button>
          )}

          {/* Subscribe button */}
          {canManage && (
            <button onClick={() => setShowSubscribe(true)} className="btn btn-primary btn-sm">
              <PlusIcon />
              {t('pl_subscribe_title')}
            </button>
          )}
        </div>
      </div>

      {/* ── Error banner ─────────────────────────────────────────────────── */}
      {error && <div className="banner banner-danger">{error}</div>}

      {/* ── Loading skeletons ─────────────────────────────────────────────── */}
      {loading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton" style={{ height: 120, borderRadius: 12 }} />
          ))}
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {!loading && visiblePledges.length === 0 && (
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

      {/* ── Pledge cards ──────────────────────────────────────────────────── */}
      {!loading && visiblePledges.map(pledge => {
        const paid  = Number(pledge.total_paid     ?? 0);
        const total = Number(pledge.pledged_amount ?? 0);
        const pct   = pctBar
          ? pctBar(paid, total)
          : (total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0);
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
                <p className="card-subtitle">{pledge.campaign_year ?? pledge.pledge_year}</p>
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
            <div
              className="flex flex-wrap items-center gap-2 pt-3"
              style={{ borderTop: '1px solid var(--border-subtle)' }}
            >
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

      {/* ── Subscribe modal ───────────────────────────────────────────────── */}
      {showSubscribe && (
        <SubscribeModal
          campaigns={campaigns}
          subscribedIds={subscribedIds}
          defaultCampaignId={filterCampaign || initialCampaign?.id || ''}
          onClose={() => setShowSubscribe(false)}
          onSave={handleSubscribe}
          t={t}
        />
      )}
    </div>
  );
}