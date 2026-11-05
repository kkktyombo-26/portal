'use client';

/**
 * ReportTab.jsx
 * ─────────────
 * Tab 4 — Filterable summary report from v_pledge_summary.
 *
 * API ref:
 *   getReport(params)  GET /api/pledges/report
 *   Returns:  { success: true, totals: {...}, data: Row[] }
 *
 * Props (from page.jsx):
 *   role       string
 *   fmtMoney   fn(amount)
 *   fmtDate    fn(dateStr)
 *   lang       string
 *
 * Bilingual: all visible strings go through t() (en / sw).
 * Add the rp_* keys from this file to src/lib/i18n.js.
 *
 * Styling: uses the KKKT DMP Yombo design system (globals.css component
 * layer + tailwind.config.js tokens). No raw blue/emerald/red/neutral
 * utilities — those colours don't exist in the custom palette.
 */

import { useState, useEffect, useCallback } from 'react';
import { pledgeApi } from '../../lib/pledgeApi';
import { groupApi }  from '../../lib/api';
import { useTranslation } from '../../lib/i18n';

// ─── Icons ────────────────────────────────────────────────────────────────────
const DownloadIcon = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    <path d="M6.5 1v8M3.5 6.5l3 3 3-3M2 11h9"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const EmptyIcon = () => (
  <svg width="36" height="36" viewBox="0 0 36 36" fill="none" className="empty-state-icon">
    <rect x="4" y="4" width="28" height="28" rx="4" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M12 22l5-6 4 4 4-6"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ─── Summary card ─────────────────────────────────────────────────────────────
function SummaryCard({ label, value, sub }) {
  return (
    <div className="card card-body" style={{ padding: '1rem 1.25rem' }}>
      <p style={{
        fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.07em',
        textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '0.25rem',
      }}>
        {label}
      </p>
      <p style={{
        fontSize: '1.375rem', fontWeight: 700,
        color: 'var(--text-primary)', fontFamily: 'Lora, serif',
        letterSpacing: '-0.02em', lineHeight: 1.2,
      }}>
        {value}
      </p>
      {sub && (
        <p className="form-hint" style={{ marginTop: '0.25rem' }}>{sub}</p>
      )}
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function Bar({ pct }) {
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

// ─── Main tab ─────────────────────────────────────────────────────────────────
export default function ReportTab({ role, fmtMoney, fmtDate, lang }) {
  const { t } = useTranslation(lang);

  const [campaigns, setCampaigns] = useState([]);
  const [groups,    setGroups]    = useState([]);

  // Filters
  const [year,       setYear]       = useState(new Date().getFullYear());
  const [campaignId, setCampaignId] = useState('');
  const [groupId,    setGroupId]    = useState('');
  const [status,     setStatus]     = useState('');

  // Results
  const [rows,    setRows]    = useState([]);
  const [totals,  setTotals]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const canViewGroups = ['pastor', 'elder', 'group_leader'].includes(role);

  const money = (n) => (fmtMoney ? fmtMoney(n) : Number(n).toLocaleString());

  // ── Bootstrap dropdowns ───────────────────────────────────────────────────
  useEffect(() => {
    pledgeApi.getCampaigns().then(r => {
      setCampaigns(r.data?.data ?? r.data ?? []);
    }).catch(() => {});

    if (canViewGroups) {
      groupApi.getGroups?.()?.then(r => {
        setGroups(r.data?.data ?? r.data ?? []);
      }).catch(() => {});
    }
  }, [canViewGroups]);

  // ── Fetch report ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (year)       params.year        = year;
      if (campaignId) params.campaign_id = campaignId;
      if (groupId)    params.group_id    = groupId;
      if (status)     params.status      = status;

      const r       = await pledgeApi.getReport(params);
      const payload = r.data ?? {};
      setTotals(payload.totals ?? null);
      setRows(payload.data ?? []);
    } catch (e) {
      setError(e?.response?.data?.message ?? t('rp_err_load'));
    } finally {
      setLoading(false);
    }
  }, [year, campaignId, groupId, status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // ── Derived totals ────────────────────────────────────────────────────────
const totalPledged = totals?.total_pledged ?? rows.reduce((s, r) => s + Number(r.annual_amount ?? 0), 0);
  const totalPaid    = totals?.total_paid    ?? rows.reduce((s, r) => s + Number(r.total_paid    ?? 0), 0);
  const totalBalance = totals?.total_balance ?? (totalPledged - totalPaid);
  const overallPct   = totalPledged > 0 ? Math.round((totalPaid / totalPledged) * 100) : 0;

  // ── Year options ──────────────────────────────────────────────────────────
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  // ── Export CSV ────────────────────────────────────────────────────────────
  const exportCsv = () => {
    if (!rows.length) return;
    const headers = [
      t('rp_col_member'), t('rp_col_campaign'), t('rp_col_group'),
      t('rp_col_type'), t('rp_col_pledged'), t('rp_col_paid'),
      t('rp_col_balance'), 'Status',
    ];
 const csvRows = rows.map(r => [
  r.member_name      ?? '',
  r.campaign_name    ?? '',
  r.campaign_scope   ?? '',     // ← use scope instead of group_name
  r.pledge_type_name ?? '',     // ← was pledge_type
  r.annual_amount    ?? 0,      // ← was pledged_amount
  r.total_paid       ?? 0,
  Number(r.balance_due ?? 0).toFixed(0),  // ← view already calculates this!
  r.pledge_status    ?? '',     // ← was status
]);
    const csv  = [headers, ...csvRows].map(row => row.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `pledge-report-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5" style={{ marginTop: '1.5rem' }}>

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h2 className="card-title" style={{ fontSize: '1rem' }}>{t('rp_title')}</h2>

        {rows.length > 0 && (
          <button className="btn btn-secondary btn-sm" onClick={exportCsv}>
            <DownloadIcon />
            {t('rp_export_csv')}
          </button>
        )}
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.625rem' }}>
        {/* Year */}
        <select
          className="select"
          style={{ width: 100 }}
          value={year}
          onChange={e => setYear(Number(e.target.value))}
        >
          {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        {/* Campaign */}
        <select
          className="select"
          style={{ minWidth: 180 }}
          value={campaignId}
          onChange={e => setCampaignId(e.target.value)}
        >
          <option value="">{t('rp_all_campaigns')}</option>
          {campaigns.map(c => (
            <option key={c.id} value={c.id}>{c.name} ({c.pledge_year})</option>
          ))}
        </select>

        {/* Group */}
        {canViewGroups && groups.length > 0 && (
          <select
            className="select"
            style={{ minWidth: 160 }}
            value={groupId}
            onChange={e => setGroupId(e.target.value)}
          >
            <option value="">{t('rp_all_groups')}</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        )}

        {/* Status */}
        <select
          className="select"
          style={{ width: 160 }}
          value={status}
          onChange={e => setStatus(e.target.value)}
        >
          <option value="">{t('rp_all_statuses')}</option>
          <option value="active">{t('pl_status_active')}</option>
          <option value="pending">{t('pl_status_pending')}</option>
          <option value="rejected">{t('pl_status_rejected')}</option>
        </select>
      </div>

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {error && <div className="banner banner-danger">{error}</div>}

      {/* ── Loading skeletons ─────────────────────────────────────────────── */}
      {loading && (
        <div className="flex flex-col gap-3">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12 }} />
            ))}
          </div>
          <div className="skeleton" style={{ height: 260, borderRadius: 12, marginTop: '0.25rem' }} />
        </div>
      )}

      {/* ── Summary cards ─────────────────────────────────────────────────── */}
      {!loading && (rows.length > 0 || totals) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <SummaryCard
            label={t('rp_total_pledged')}
            value={money(totalPledged)}
            sub={`${rows.length} ${t('rp_pledges')}`}
          />
          <SummaryCard
            label={t('rp_total_paid')}
            value={money(totalPaid)}
            sub={`${overallPct}% ${t('rp_fulfilled')}`}
          />
          <SummaryCard
            label={t('rp_outstanding')}
            value={money(totalBalance)}
            sub={`${100 - overallPct}% ${t('rp_remaining')}`}
          />
          <SummaryCard
            label={t('rp_overall_progress')}
            value={`${overallPct}%`}
            sub={totals?.active_campaigns
              ? `${totals.active_campaigns} ${t('rp_active_campaigns')}`
              : undefined}
          />
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {!loading && rows.length === 0 && (
        <div className="empty-state">
          <EmptyIcon />
          <p className="empty-state-body">{t('rp_no_data')}</p>
        </div>
      )}

      {/* ── Desktop table ─────────────────────────────────────────────────── */}
      {!loading && rows.length > 0 && (
        <>
          <div className="hidden md:block" style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ background: 'var(--surface-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                  {[
                    { label: t('rp_col_member'),   align: 'left'  },
                    canViewGroups
                      ? { label: t('rp_col_group'), align: 'left' }
                      : null,
                    { label: t('rp_col_campaign'), align: 'left'  },
                    { label: t('rp_col_type'),     align: 'left'  },
                    { label: t('rp_col_pledged'),  align: 'right' },
                    { label: t('rp_col_paid'),     align: 'right' },
                    { label: t('rp_col_balance'),  align: 'right' },
                    { label: t('rp_col_progress'), align: 'left'  },
                  ].filter(Boolean).map(col => (
                    <th
                      key={col.label}
                      style={{
                        padding: '0.625rem 1rem',
                        textAlign: col.align,
                        fontSize: '0.6875rem', fontWeight: 600,
                        letterSpacing: '0.06em', textTransform: 'uppercase',
                        color: 'var(--text-tertiary)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const pledged = Number(row.annual_amount ?? 0);
                  const paid    = Number(row.total_paid    ?? 0);
                 const balance = Number(row.balance_due  ?? 0); 
                  const pct     = pledged > 0 ? Math.round((paid / pledged) * 100) : 0;

                  return (
                    <tr
                      key={row.pledge_id ?? idx}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        transition: 'background var(--dur-base)',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-subtle)'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}
                    >
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                        {row.member_name ?? '—'}
                      </td>
                      {canViewGroups && (
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                         {row.campaign_scope ? ` · ${row.campaign_scope}` : ''}
                        </td>
                      )}
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {row.campaign_name ?? '—'}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>
                        {row.pledge_type_name ?? '—'} 
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
                        {money(pledged)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--success)' }}>
                        {money(paid)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>
                        {money(balance)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', minWidth: 120 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <Bar pct={pct} />
                          <span className="form-hint" style={{ marginTop: 0, textAlign: 'right' }}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Mobile cards ──────────────────────────────────────────────── */}
          <div className="md:hidden flex flex-col gap-3">
            {rows.map((row, idx) => {
              const pledged = Number(row.annual_amount ?? 0);
              const paid    = Number(row.total_paid    ?? 0);
              const balance = pledged - paid;
              const pct     = pledged > 0 ? Math.round((paid / pledged) * 100) : 0;

              return (
                <div key={row.pledge_id ?? idx} className="card card-body flex flex-col gap-3">
                  <div>
                    <p className="card-title" style={{ fontSize: '0.875rem' }}>{row.member_name ?? '—'}</p>
                    <p className="card-subtitle">
                      {row.campaign_name ?? '—'}
                     {row.campaign_scope ?? '—'}   
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <span>
                      {t('rp_col_pledged')}:{' '}
                      <strong style={{ color: 'var(--text-primary)' }}>{money(pledged)}</strong>
                    </span>
                    <span>
                      {t('rp_col_paid')}:{' '}
                      <strong style={{ color: 'var(--success)' }}>{money(paid)}</strong>
                    </span>
                    <span>
                      {t('rp_col_balance')}:{' '}
                      <strong style={{ color: 'var(--text-secondary)' }}>{money(balance)}</strong>
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <Bar pct={pct} />
                    <p className="form-hint" style={{ marginTop: 0 }}>{pct}% {t('rp_fulfilled')}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}