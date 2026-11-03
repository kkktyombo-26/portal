'use client';

/**
 * PledgeSummaryCards.jsx
 * ──────────────────────
 * Four KPI cards displayed at the top of the Pledges page.
 * Consumes the shape returned by GET /api/pledges/report (aggregated).
 *
 * Props
 * ─────
 * stats : {
 *   activeCampaigns : number,
 *   totalPledged    : number,   // sum of annual_amount across all member_pledges
 *   totalCollected  : number,   // sum of payments
 *   fulfilledCount  : number,   // pledges where is_fulfilled = 1
 * }
 * loading : boolean
 * currency : string  (default 'TZS')
 */

const fmt = (n, currency = 'TZS') =>
  new Intl.NumberFormat('sw-TZ', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(n ?? 0);

const pct = (num, den) =>
  den > 0 ? Math.round((num / den) * 100) : 0;

function Card({ label, value, sub, accent, loading }) {
  return (
    <div
      className={[
        'relative overflow-hidden rounded-xl border px-5 py-4 flex flex-col gap-1',
        accent
          ? 'bg-amber-500 border-amber-400 text-white'
          : 'bg-white border-stone-200 text-stone-800',
      ].join(' ')}
    >
      {loading ? (
        <div className="animate-pulse space-y-2">
          <div className={`h-3 w-20 rounded ${accent ? 'bg-amber-400' : 'bg-stone-200'}`} />
          <div className={`h-7 w-28 rounded ${accent ? 'bg-amber-400' : 'bg-stone-200'}`} />
        </div>
      ) : (
        <>
          <span
            className={`text-xs font-medium tracking-wide uppercase ${
              accent ? 'text-amber-100' : 'text-stone-500'
            }`}
          >
            {label}
          </span>
          <span className="text-2xl font-bold leading-tight">{value}</span>
          {sub && (
            <span
              className={`text-xs mt-0.5 ${
                accent ? 'text-amber-100' : 'text-stone-400'
              }`}
            >
              {sub}
            </span>
          )}
        </>
      )}
    </div>
  );
}

export default function PledgeSummaryCards({ stats = {}, loading = false, currency = 'TZS' }) {
  const {
    activeCampaigns = 0,
    totalPledged    = 0,
    totalCollected  = 0,
    fulfilledCount  = 0,
    totalPledges    = 0,
  } = stats;

  const collectionRate = pct(totalCollected, totalPledged);
  const fulfillRate    = pct(fulfilledCount, totalPledges);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Card
        label="Active campaigns"
        value={loading ? '—' : activeCampaigns}
        sub="across all scopes"
        loading={loading}
      />
      <Card
        label="Total pledged"
        value={loading ? '—' : fmt(totalPledged, currency)}
        sub={`${totalPledges} member pledge${totalPledges !== 1 ? 's' : ''}`}
        loading={loading}
      />
      <Card
        accent
        label="Collected"
        value={loading ? '—' : fmt(totalCollected, currency)}
        sub={`${collectionRate}% of pledged amount`}
        loading={loading}
      />
      <Card
        label="Fulfilled"
        value={loading ? '—' : `${fulfillRate}%`}
        sub={`${fulfilledCount} of ${totalPledges} pledges complete`}
        loading={loading}
      />
    </div>
  );
}