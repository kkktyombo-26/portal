'use client';

/**
 * ReportTab.jsx
 * ─────────────
 * Filterable summary report that reads from GET /api/pledges/report
 * (backed by v_pledge_summary view).
 *
 * Filters available (mirrors backend query params):
 *   year        → integer
 *   campaign_id → integer
 *   group_id    → integer  (pastor/elder only)
 *   is_fulfilled → 0 | 1
 *   scope       → church | group | member
 *
 * Aggregates displayed per-row:
 *   annual_amount, total_paid, balance, fulfilment %, is_fulfilled
 *
 * Group leaders see only their group's data (backend enforces this too).
 */

import { useState, useEffect, useCallback } from 'react';
import { pledgeApi } from '../../lib/pledgeApi';
import { useAuth } from '../../hooks/useAuth';

/* ── helpers ─────────────────────────────────────────────── */
const fmt = (n) =>
  n == null ? '—' : new Intl.NumberFormat('sw-TZ').format(Number(n));

const pct = (paid, pledged) => {
  const p = Number(pledged);
  return p > 0 ? Math.round((Number(paid) / p) * 100) : 0;
};

const SCOPE_LABELS = { church: 'Kanisa', group: 'Kikundi', member: 'Mwanachama' };
const currentYear  = new Date().getFullYear();
const YEARS        = Array.from({ length: 5 }, (_, i) => currentYear - i);

/* ── mini bar chip ───────────────────────────────────────── */
function MiniBar({ paid, pledged }) {
  const p = pct(paid, pledged);
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-stone-100 rounded-full overflow-hidden flex-shrink-0">
        <div className="h-full bg-amber-500 rounded-full" style={{ width: `${p}%` }} />
      </div>
      <span className="text-xs tabular-nums text-stone-500">{p}%</span>
    </div>
  );
}

/* ── totals footer row ───────────────────────────────────── */
function TotalsRow({ rows }) {
  const totalPledged   = rows.reduce((s, r) => s + Number(r.annual_amount ?? 0), 0);
  const totalPaid      = rows.reduce((s, r) => s + Number(r.total_paid    ?? 0), 0);
  const totalBalance   = rows.reduce((s, r) => s + Math.max(0, Number(r.annual_amount ?? 0) - Number(r.total_paid ?? 0)), 0);
  const fulfilledCount = rows.filter(r => r.is_fulfilled).length;

  return (
    <tr className="bg-stone-50 border-t-2 border-stone-300 font-semibold text-xs text-stone-700">
      <td className="px-4 py-3" colSpan={2}>
        Jumla ({rows.length} ahadi · {fulfilledCount} zimetimizwa)
      </td>
      <td className="px-4 py-3 text-right tabular-nums">{fmt(totalPledged)}</td>
      <td className="px-4 py-3 text-right tabular-nums text-amber-600">{fmt(totalPaid)}</td>
      <td className="px-4 py-3 text-right tabular-nums">{fmt(totalBalance)}</td>
      <td className="px-4 py-3">
        <MiniBar paid={totalPaid} pledged={totalPledged} />
      </td>
      <td />
    </tr>
  );
}

/* ── filter bar ──────────────────────────────────────────── */
function FilterBar({ filters, setFilters, campaigns, groups, isAdmin }) {
  const set = (k, v) => setFilters(f => ({ ...f, [k]: v }));

  return (
    <div className="flex flex-wrap gap-2">
      {/* Year */}
      <select
        value={filters.year}
        onChange={e => set('year', e.target.value)}
        className="border border-stone-200 rounded-lg px-3 py-1.5 text-xs bg-white text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
      >
        <option value="">Mwaka wote</option>
        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
      </select>

      {/* Campaign */}
      <select
        value={filters.campaign_id}
        onChange={e => set('campaign_id', e.target.value)}
        className="border border-stone-200 rounded-lg px-3 py-1.5 text-xs bg-white text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
      >
        <option value="">Kampeni zote</option>
        {campaigns.map(c => (
          <option key={c.id} value={c.id}>{c.name} ({c.year})</option>
        ))}
      </select>

      {/* Group (admin only) */}
      {isAdmin && groups.length > 0 && (
        <select
          value={filters.group_id}
          onChange={e => set('group_id', e.target.value)}
          className="border border-stone-200 rounded-lg px-3 py-1.5 text-xs bg-white text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          <option value="">Vikundi vyote</option>
          {groups.map(g => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      )}

      {/* Scope */}
      <select
        value={filters.scope}
        onChange={e => set('scope', e.target.value)}
        className="border border-stone-200 rounded-lg px-3 py-1.5 text-xs bg-white text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
      >
        <option value="">Aina zote</option>
        {Object.entries(SCOPE_LABELS).map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>

      {/* Fulfillment */}
      <select
        value={filters.is_fulfilled}
        onChange={e => set('is_fulfilled', e.target.value)}
        className="border border-stone-200 rounded-lg px-3 py-1.5 text-xs bg-white text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
      >
        <option value="">Hali zote</option>
        <option value="1">Zimetimizwa</option>
        <option value="0">Zinaendelea</option>
      </select>
    </div>
  );
}

/* ── mobile card (< md) ──────────────────────────────────── */
function MobileCard({ row }) {
  const paid    = Number(row.total_paid    ?? 0);
  const pledged = Number(row.annual_amount ?? 0);
  const balance = Math.max(0, pledged - paid);

  return (
    <div className="border border-stone-200 rounded-xl bg-white px-4 py-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-stone-800 leading-snug">{row.member_name ?? '—'}</p>
          <p className="text-xs text-stone-400">{row.campaign_name} · {SCOPE_LABELS[row.scope] ?? row.scope}</p>
        </div>
        {row.is_fulfilled ? (
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex-shrink-0">✓</span>
        ) : (
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex-shrink-0">Inaendelea</span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs text-stone-600">
        <div><p className="text-stone-400">Ahadi</p><p className="font-medium tabular-nums">{fmt(pledged)}</p></div>
        <div><p className="text-stone-400">Imelipwa</p><p className="font-medium tabular-nums text-amber-600">{fmt(paid)}</p></div>
        <div><p className="text-stone-400">Baki</p><p className="font-medium tabular-nums">{fmt(balance)}</p></div>
      </div>
      <MiniBar paid={paid} pledged={pledged} />
    </div>
  );
}

/* ── Main export ─────────────────────────────────────────── */
export default function ReportTab() {
  const { user } = useAuth();
  const isAdmin  = ['pastor', 'elder'].includes(user?.role);

  const [rows,      setRows]      = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [groups,    setGroups]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');

  const [filters, setFilters] = useState({
    year:         String(currentYear),
    campaign_id:  '',
    group_id:     '',
    scope:        '',
    is_fulfilled: '',
  });

  /* load filter options once */
  useEffect(() => {
    // FIX: was pledgeApi.campaigns.list() — pledgeApi is a flat object
    pledgeApi.getCampaigns()
      .then(r => {
        const raw = r.data?.campaigns ?? r.data?.data ?? r.data ?? [];
        setCampaigns(Array.isArray(raw) ? raw : []);
      })
      .catch(() => {});

    // NOTE: no getGroups method exists in pledgeApi yet.
    // Add pledgeApi.getGroups = () => api.get('/groups') when the endpoint
    // is ready, then uncomment the block below.
    //
    // if (isAdmin) {
    //   pledgeApi.getGroups()
    //     .then(r => setGroups(r.data.groups ?? r.data ?? []))
    //     .catch(() => {});
    // }
  }, [isAdmin]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const params = Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v !== '')
    );
    try {
      // FIX: was pledgeApi.reports.summary(params)
      const r = await pledgeApi.getReport(params);
      const raw = r.data?.pledges ?? r.data?.data ?? r.data ?? [];
      setRows(Array.isArray(raw) ? raw : []);
    } catch {
      setError('Imeshindwa kupakia ripoti. Jaribu tena.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  /* ── CSV export ── */
  const exportCsv = () => {
    const header = ['Jina', 'Kampeni', 'Mwaka', 'Aina', 'Ahadi (TZS)', 'Imelipwa (TZS)', 'Baki (TZS)', 'Asilimia', 'Hali'];
    const csvRows = rows.map(r => {
      const pledged = Number(r.annual_amount ?? 0);
      const paid    = Number(r.total_paid    ?? 0);
      return [
        r.member_name ?? '',
        r.campaign_name ?? '',
        r.campaign_year ?? '',
        SCOPE_LABELS[r.scope] ?? r.scope ?? '',
        pledged,
        paid,
        Math.max(0, pledged - paid),
        pct(paid, pledged),
        r.is_fulfilled ? 'Imetimizwa' : 'Inaendelea',
      ];
    });
    const csv = [header, ...csvRows].map(row => row.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `ahadi-ripoti-${filters.year || 'zote'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-stone-800">Ripoti ya Ahadi</h2>
          <p className="text-xs text-stone-500 mt-0.5">
            {loading ? '…' : `Matokeo ${rows.length}`}
          </p>
        </div>
        <button
          onClick={exportCsv}
          disabled={rows.length === 0 || loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-stone-200 hover:border-stone-300 text-stone-700 rounded-lg transition-colors disabled:opacity-40"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M6 1v7M3.5 5.5L6 8l2.5-2.5M2 10h8"/>
          </svg>
          Hamisha CSV
        </button>
      </div>

      {/* filters */}
      <FilterBar
        filters={filters}
        setFilters={setFilters}
        campaigns={campaigns}
        groups={groups}
        isAdmin={isAdmin}
      />

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* ── desktop table ── */}
      {loading ? (
        <div className="hidden md:block border border-stone-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                {['Jina', 'Kampeni', 'Ahadi (TZS)', 'Imelipwa (TZS)', 'Baki (TZS)', 'Maendeleo', 'Hali'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-stone-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {[1, 2, 3, 4].map(i => (
                <tr key={i} className="animate-pulse">
                  <td className="px-4 py-3"><div className="h-3 w-32 bg-stone-200 rounded" /></td>
                  <td className="px-4 py-3"><div className="h-3 w-28 bg-stone-100 rounded" /></td>
                  <td className="px-4 py-3"><div className="h-3 w-20 bg-stone-100 rounded" /></td>
                  <td className="px-4 py-3"><div className="h-3 w-20 bg-stone-100 rounded" /></td>
                  <td className="px-4 py-3"><div className="h-3 w-20 bg-stone-100 rounded" /></td>
                  <td className="px-4 py-3"><div className="h-2 w-16 bg-stone-100 rounded-full" /></td>
                  <td className="px-4 py-3"><div className="h-5 w-16 bg-stone-100 rounded-full" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-2">
          <p className="text-sm font-medium text-stone-700">Hakuna matokeo</p>
          <p className="text-xs text-stone-400">Badilisha vichungi ili kuona data nyingine.</p>
        </div>
      ) : (
        <>
          {/* desktop table */}
          <div className="hidden md:block border border-stone-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  {['Jina', 'Kampeni', 'Ahadi (TZS)', 'Imelipwa (TZS)', 'Baki (TZS)', 'Maendeleo', 'Hali'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-stone-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 bg-white">
                {rows.map((r, idx) => {
                  const paid    = Number(r.total_paid    ?? 0);
                  const pledged = Number(r.annual_amount ?? 0);
                  const balance = Math.max(0, pledged - paid);
                  return (
                    <tr key={r.id ?? idx} className="hover:bg-stone-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-stone-800 leading-tight">{r.member_name ?? '—'}</p>
                        <p className="text-xs text-stone-400">{SCOPE_LABELS[r.scope] ?? r.scope}</p>
                      </td>
                      <td className="px-4 py-3 text-stone-600">
                        <p className="text-xs">{r.campaign_name ?? '—'}</p>
                        <p className="text-xs text-stone-400">{r.campaign_year}</p>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-stone-700">{fmt(pledged)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-amber-600 font-medium">{fmt(paid)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-stone-600">{fmt(balance)}</td>
                      <td className="px-4 py-3">
                        <MiniBar paid={paid} pledged={pledged} />
                      </td>
                      <td className="px-4 py-3">
                        {r.is_fulfilled ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">✓ Imetimizwa</span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Inaendelea</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <TotalsRow rows={rows} />
              </tfoot>
            </table>
          </div>

          {/* mobile cards */}
          <div className="md:hidden space-y-3">
            {rows.map((r, idx) => <MobileCard key={r.id ?? idx} row={r} />)}

            {/* mobile totals */}
            <div className="border border-stone-300 rounded-xl bg-stone-50 px-4 py-3">
              <p className="text-xs font-semibold text-stone-700 mb-2">
                Jumla — {rows.length} ahadi
              </p>
              <div className="grid grid-cols-3 gap-2 text-xs text-stone-600">
                <div>
                  <p className="text-stone-400">Ahadi</p>
                  <p className="font-medium tabular-nums">
                    {fmt(rows.reduce((s, r) => s + Number(r.annual_amount ?? 0), 0))}
                  </p>
                </div>
                <div>
                  <p className="text-stone-400">Imelipwa</p>
                  <p className="font-medium tabular-nums text-amber-600">
                    {fmt(rows.reduce((s, r) => s + Number(r.total_paid ?? 0), 0))}
                  </p>
                </div>
                <div>
                  <p className="text-stone-400">Imetimizwa</p>
                  <p className="font-medium tabular-nums">{rows.filter(r => r.is_fulfilled).length}</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}