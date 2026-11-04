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
 * Note: this component fetches its own campaigns and groups to populate
 * the filter dropdowns — no prop-drilling needed.
 */

import { useState, useEffect, useCallback } from 'react';
import { pledgeApi } from '../../lib/pledgeApi';
import { groupApi } from '../../lib/api';

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-xl px-5 py-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="text-2xl font-semibold text-neutral-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-neutral-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function Bar({ pct }) {
  const c = pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-blue-500' : 'bg-amber-400';
  return (
    <div className="w-full bg-neutral-100 rounded-full h-1.5 overflow-hidden">
      <div className={`h-1.5 rounded-full ${c}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export default function ReportTab({ role, fmtMoney, fmtDate, lang }) {
  const [campaigns, setCampaigns] = useState([]);
  const [groups, setGroups]       = useState([]);

  // Filters
  const [year, setYear]               = useState(new Date().getFullYear());
  const [campaignId, setCampaignId]   = useState('');
  const [groupId, setGroupId]         = useState('');
  const [status, setStatus]           = useState('');

  // Results
  const [rows, setRows]               = useState([]);
  const [totals, setTotals]           = useState(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');

  const canViewGroups = ['pastor', 'elder', 'group_leader'].includes(role);

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

      const r = await pledgeApi.getReport(params);
      // Backend: { success, totals: {...}, data: Row[] }
      const payload = r.data ?? {};
      setTotals(payload.totals ?? null);
      setRows(payload.data ?? []);
    } catch (e) {
      setError(e?.response?.data?.message ?? 'Failed to load report.');
    } finally {
      setLoading(false);
    }
  }, [year, campaignId, groupId, status]);

  // Run on mount + whenever filters change
  useEffect(() => { load(); }, [load]);

  // ── Derived totals (fallback if backend doesn't send them) ────────────────

  const totalPledged = totals?.total_pledged ?? rows.reduce((s, r) => s + Number(r.pledged_amount ?? 0), 0);
  const totalPaid    = totals?.total_paid    ?? rows.reduce((s, r) => s + Number(r.total_paid ?? 0), 0);
  const totalBalance = totals?.total_balance ?? (totalPledged - totalPaid);
  const overallPct   = totalPledged > 0 ? Math.round((totalPaid / totalPledged) * 100) : 0;

  // ── Year options ──────────────────────────────────────────────────────────

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  // ── Export CSV helper ─────────────────────────────────────────────────────

  const exportCsv = () => {
    if (!rows.length) return;
    const headers = ['Member', 'Campaign', 'Group', 'Pledge Type', 'Pledged', 'Paid', 'Balance', 'Status'];
    const csvRows = rows.map(r => [
      r.member_name ?? '',
      r.campaign_name ?? '',
      r.group_name ?? '',
      r.pledge_type ?? '',
      r.pledged_amount ?? 0,
      r.total_paid ?? 0,
      (Number(r.pledged_amount ?? 0) - Number(r.total_paid ?? 0)).toFixed(0),
      r.status ?? '',
    ]);
    const csv = [headers, ...csvRows].map(row => row.map(v => `"${v}"`).join(',')).join('\n');
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
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-base font-semibold text-neutral-900">Pledge Report</h2>
        {rows.length > 0 && (
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 px-4 py-2 text-sm border border-neutral-200 text-neutral-600 rounded-lg hover:bg-neutral-50 transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M6.5 1v8M3.5 6.5l3 3 3-3M2 11h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Export CSV
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {/* Year */}
        <select
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          className="border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        {/* Campaign */}
        <select
          value={campaignId}
          onChange={e => setCampaignId(e.target.value)}
          className="border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[180px]"
        >
          <option value="">All campaigns</option>
          {campaigns.map(c => (
            <option key={c.id} value={c.id}>{c.name} ({c.year})</option>
          ))}
        </select>

        {/* Group */}
        {canViewGroups && groups.length > 0 && (
          <select
            value={groupId}
            onChange={e => setGroupId(e.target.value)}
            className="border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[160px]"
          >
            <option value="">All groups</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        )}

        {/* Status */}
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5">{error}</div>
      )}

      {/* Summary cards */}
      {!loading && (rows.length > 0 || totals) && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard
            label="Total Pledged"
            value={fmtMoney ? fmtMoney(totalPledged) : totalPledged.toLocaleString()}
            sub={`${rows.length} pledges`}
          />
          <SummaryCard
            label="Total Paid"
            value={fmtMoney ? fmtMoney(totalPaid) : totalPaid.toLocaleString()}
            sub={`${overallPct}% fulfilled`}
          />
          <SummaryCard
            label="Outstanding"
            value={fmtMoney ? fmtMoney(totalBalance) : totalBalance.toLocaleString()}
            sub={`${100 - overallPct}% remaining`}
          />
          <SummaryCard
            label="Overall Progress"
            value={`${overallPct}%`}
            sub={totals?.active_campaigns ? `${totals.active_campaigns} active campaigns` : undefined}
          />
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-20 bg-neutral-100 rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="h-64 bg-neutral-100 rounded-xl animate-pulse mt-4" />
        </div>
      )}

      {/* Empty */}
      {!loading && rows.length === 0 && (
        <div className="text-center py-16 text-neutral-400">
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" className="mx-auto mb-3 opacity-40">
            <rect x="4" y="4" width="28" height="28" rx="4" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M12 22l5-6 4 4 4-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p className="text-sm">No data for the selected filters.</p>
        </div>
      )}

      {/* Data table */}
      {!loading && rows.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-neutral-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200">
                  <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500">Member</th>
                  {canViewGroups && <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500">Group</th>}
                  <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500">Campaign</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500">Type</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Pledged</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Paid</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Balance</th>
                  <th className="px-4 py-3 text-xs font-medium text-neutral-500">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {rows.map((row, idx) => {
                  const pledged = Number(row.pledged_amount ?? 0);
                  const paid    = Number(row.total_paid ?? 0);
                  const balance = pledged - paid;
                  const pct     = pledged > 0 ? Math.round((paid / pledged) * 100) : 0;

                  return (
                    <tr key={row.pledge_id ?? idx} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-neutral-900">{row.member_name ?? '—'}</td>
                      {canViewGroups && <td className="px-4 py-3 text-neutral-600">{row.group_name ?? '—'}</td>}
                      <td className="px-4 py-3 text-neutral-600">{row.campaign_name ?? '—'}</td>
                      <td className="px-4 py-3 text-neutral-500 capitalize">{(row.pledge_type ?? '—').replace('_', ' ')}</td>
                      <td className="px-4 py-3 text-right font-mono text-neutral-900">
                        {fmtMoney ? fmtMoney(pledged) : pledged.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-700">
                        {fmtMoney ? fmtMoney(paid) : paid.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-neutral-500">
                        {fmtMoney ? fmtMoney(balance) : balance.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 w-40">
                        <div className="space-y-1">
                          <Bar pct={pct} />
                          <p className="text-xs text-neutral-400 text-right">{pct}%</p>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {rows.map((row, idx) => {
              const pledged = Number(row.pledged_amount ?? 0);
              const paid    = Number(row.total_paid ?? 0);
              const balance = pledged - paid;
              const pct     = pledged > 0 ? Math.round((paid / pledged) * 100) : 0;

              return (
                <div key={row.pledge_id ?? idx} className="bg-white border border-neutral-200 rounded-xl p-4 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">{row.member_name ?? '—'}</p>
                    <p className="text-xs text-neutral-500">{row.campaign_name ?? '—'}{row.group_name ? ` · ${row.group_name}` : ''}</p>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
                    <span>Pledged: <strong className="text-neutral-900">{fmtMoney ? fmtMoney(pledged) : pledged.toLocaleString()}</strong></span>
                    <span>Paid: <strong className="text-emerald-700">{fmtMoney ? fmtMoney(paid) : paid.toLocaleString()}</strong></span>
                    <span>Balance: <strong className="text-neutral-700">{fmtMoney ? fmtMoney(balance) : balance.toLocaleString()}</strong></span>
                  </div>
                  <div className="space-y-1">
                    <Bar pct={pct} />
                    <p className="text-xs text-neutral-400">{pct}% fulfilled</p>
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