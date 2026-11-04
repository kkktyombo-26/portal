'use client';

/**
 * /app/dashboard/pledges/page.jsx
 * ────────────────────────────────
 * Pledge Campaign module — main page
 * Ref: BSS-KKKT-2026-003
 *
 * Tabs
 *  1. Campaigns  — list, create, toggle active
 *  2. Pledges    — per-campaign member subscriptions
 *  3. Payments   — installment ledger for a selected pledge
 *  4. Report     — filterable summary with totals
 *
 * Role guards mirror pledgeController.js:
 *  pastor / elder     → full access incl. delete
 *  group_leader       → own group only, no church-wide create
 *  member             → read own pledges & payments
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { pledgeApi } from '../../../lib/pledgeApi';
import { fmtMoney, fmtDate, pctBar } from '../../../lib/pledgeUtils';
import CampaignsTab from '../../../components/pledges/CampaignsTab';
import PledgesTab   from '../../../components/pledges/PledgesTab';
import PaymentsTab  from '../../../components/pledges/PaymentsTab';
import ReportTab    from '../../../components/pledges/ReportTab';

// ── Icon helpers ──────────────────────────────────────────────────────────────
const HandIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8l-1.5-1.5a1.5 1.5 0 0 0-2 2.2l3.5 3.8A6 6 0 0 0 8 21h8a6 6 0 0 0 6-6v-4a2 2 0 0 0-4 0"/>
  </svg>
);
const UsersIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const WalletIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>
  </svg>
);
const ChartIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
  </svg>
);

const TABS = [
  { id: 'campaigns', label: 'Campaigns', icon: HandIcon,   roles: ['pastor','elder','group_leader'] },
  { id: 'pledges',   label: 'Pledges',   icon: UsersIcon,  roles: ['pastor','elder','group_leader','member'] },
  { id: 'payments',  label: 'Payments',  icon: WalletIcon, roles: ['pastor','elder','group_leader','member'] },
  { id: 'report',    label: 'Report',    icon: ChartIcon,  roles: ['pastor','elder','group_leader'] },
];

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }) {
  return (
    <div className="stat-card">
      <p className="stat-label">{label}</p>
      <p className="stat-value" style={accent ? { color: 'var(--text-accent)' } : {}}>{value}</p>
      {sub && <p className="text-xs text-neutral-500 mt-1">{sub}</p>}
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ toasts }) {
  return (
    <div className="toast-area">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          <span className="flex-1 text-sm">{t.message}</span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function PledgesPage() {
  const { user } = useAuth();
  const role = user?.role || 'member';

  const [activeTab,   setActiveTab]   = useState('campaigns');
  const [campaigns,   setCampaigns]   = useState([]);
  const [pledgeTypes, setPledgeTypes] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [toasts,      setToasts]      = useState([]);

  // Cross-tab context: which campaign / pledge is "selected" for drill-down
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [selectedPledge,   setSelectedPledge]   = useState(null);

  // Aggregate summary across all campaigns (for header stats)
  const [summary, setSummary] = useState({
    totalPledged: 0, totalPaid: 0, fulfilled: 0, members: 0, campaigns: 0,
  });

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [cRes, tRes] = await Promise.all([
        pledgeApi.getCampaigns(),
        pledgeApi.getTypes(),
      ]);
      const c = cRes.data.data || [];
      const t = tRes.data.data || [];
      setCampaigns(c);
      setPledgeTypes(t);

      // Derive header summary
      const totPledged = c.reduce((a, x) => a + Number(x.total_pledged    || 0), 0);
      const totPaid    = c.reduce((a, x) => a + Number(x.total_paid       || 0), 0);
      const members    = c.reduce((a, x) => a + Number(x.subscriber_count || 0), 0);
      setSummary({
        totalPledged: totPledged,
        totalPaid:    totPaid,
        fulfilled:    0, // comes from report endpoint when needed
        members,
        campaigns:    c.filter(x => x.is_active).length,
      });
    } catch (err) {
      addToast(err.message || 'Failed to load pledge data', 'danger');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Visible tabs based on role
  const visibleTabs = TABS.filter(t => t.roles.includes(role));

  // Navigate to pledges tab with a campaign pre-selected
  const drillToPledges = (campaign) => {
    setSelectedCampaign(campaign);
    setActiveTab('pledges');
  };

  // Navigate to payments tab with a pledge pre-selected
  const drillToPayments = (pledge) => {
    setSelectedPledge(pledge);
    setActiveTab('payments');
  };

  const pct = summary.totalPledged > 0
    ? Math.round((summary.totalPaid / summary.totalPledged) * 100)
    : 0;

  return (
    <div className="min-h-screen" style={{ background: 'var(--surface-page)' }}>

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="page-header">
        <p className="page-header-eyebrow">Uwakili wa Fedha</p>
        <h1 className="page-header-title">AHADI, JENGO, UWAKILI NA MICHANGO</h1>
        <p className="page-header-subtitle">
          Track ahadi commitments, installment payments, and campaign fulfilment across Yombo congregation.
        </p>

        {/* Stat strip — right inside the dark header */}
        {!loading && (
          <div className="flex flex-wrap gap-6 mt-5" style={{ position: 'relative' }}>
            {[
              { label: 'Active Campaigns', val: summary.campaigns },
              { label: 'Total Members',    val: summary.members.toLocaleString() },
              { label: 'Total Pledged',    val: `TShs ${fmtMoney(summary.totalPledged)}` },
              { label: 'Total Collected',  val: `TShs ${fmtMoney(summary.totalPaid)}` },
              { label: 'Collection Rate',  val: `${pct}%` },
            ].map(s => (
              <div key={s.label}>
                <p style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', marginBottom: '0.2rem' }}>
                  {s.label}
                </p>
                <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#FBBF24', fontFamily: 'Lora, serif', letterSpacing: '-0.02em' }}>
                  {s.val}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Tab bar ──────────────────────────────────────────────────────── */}
      <div style={{ background: 'var(--surface-card)', borderBottom: '1px solid var(--border-subtle)', position: 'sticky', top: 0, zIndex: 20 }}>
        <div className="page-body" style={{ padding: '0 2.5rem' }}>
          <div className="tabs">
            {visibleTabs.map(t => (
              <button
                key={t.id}
                className={`tab ${activeTab === t.id ? 'active' : ''}`}
                onClick={() => setActiveTab(t.id)}
              >
                <t.icon />
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tab content ──────────────────────────────────────────────────── */}
      <div className="page-body">
        {loading ? (
          <div className="flex flex-col gap-4 mt-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton" style={{ height: 72, borderRadius: 12 }} />
            ))}
          </div>
        ) : (
          <>
            {activeTab === 'campaigns' && (
              <CampaignsTab
                campaigns={campaigns}
                pledgeTypes={pledgeTypes}
                role={role}
                onRefresh={loadAll}
                onDrill={drillToPledges}
                addToast={addToast}
                fmtMoney={fmtMoney}
                fmtDate={fmtDate}
                pctBar={pctBar}
              />
            )}
            {activeTab === 'pledges' && (
            <PledgesTab
  campaigns={campaigns}
  pledgeTypes={pledgeTypes}
  role={role}
  initialCampaign={selectedCampaign}   // PledgesTab should use this to pre-filter
  onDrillPayments={drillToPayments}
  addToast={addToast}
  fmtMoney={fmtMoney}
  fmtDate={fmtDate}
  pctBar={pctBar}
/>
            )}
            {activeTab === 'payments' && (
              <PaymentsTab
                role={role}
                initialPledge={selectedPledge}
                addToast={addToast}
                fmtMoney={fmtMoney}
                fmtDate={fmtDate}
              />
            )}
            {activeTab === 'report' && (
              <ReportTab
                campaigns={campaigns}
                pledgeTypes={pledgeTypes}
                role={role}
                addToast={addToast}
                fmtMoney={fmtMoney}
                fmtDate={fmtDate}
                pctBar={pctBar}
              />
            )}
          </>
        )}
      </div>

      <Toast toasts={toasts} />
    </div>
  );
}