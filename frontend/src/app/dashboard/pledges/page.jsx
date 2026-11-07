'use client';

/**
 * /app/dashboard/pledges/page.jsx
 * Pledge Campaign module — main page
 * Ref: BSS-KKKT-2026-003
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { pledgeApi } from '../../../lib/pledgeApi';
import { fmtMoney, fmtDate, pctBar } from '../../../lib/pledgeUtils';
import CampaignsTab from '../../../components/pledges/CampaignsTab';
import PledgesTab   from '../../../components/pledges/PledgesTab';
import PaymentsTab  from '../../../components/pledges/PaymentsTab';
import ReportTab    from '../../../components/pledges/ReportTab';
import { useTranslation } from '../../../lib/i18n';

// ─── Icons ────────────────────────────────────────────────────────────────────
const HandIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8l-1.5-1.5a1.5 1.5 0 0 0-2 2.2l3.5 3.8A6 6 0 0 0 8 21h8a6 6 0 0 0 6-6v-4a2 2 0 0 0-4 0"/>
  </svg>
);
const UsersIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const WalletIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>
  </svg>
);
const ChartIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
  </svg>
);

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24,
      display: 'flex', flexDirection: 'column', gap: 8,
      zIndex: 100,
    }}>
      {toasts.map(toast => (
        <div key={toast.id} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '11px 16px', borderRadius: 9,
          background: toast.type === 'danger' ? '#FEF2F2' : '#F0FDF4',
          border: `1px solid ${toast.type === 'danger' ? '#FECACA' : '#BBF7D0'}`,
          color: toast.type === 'danger' ? '#991B1B' : '#166534',
          fontSize: 13, fontWeight: 500,
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          minWidth: 240, maxWidth: 360,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
            background: toast.type === 'danger' ? '#DC2626' : '#16A34A',
          }} />
          {toast.message}
        </div>
      ))}
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ pct }) {
  return (
    <div style={{
      height: 4, borderRadius: 99,
      background: 'rgba(255,255,255,0.12)',
      overflow: 'hidden',
      width: '100%',
      marginTop: 6,
    }}>
      <div style={{
        height: '100%',
        width: `${Math.min(pct, 100)}%`,
        background: pct >= 100 ? '#4ADE80' : '#C8A84B',
        borderRadius: 99,
        transition: 'width 0.6s ease',
      }} />
    </div>
  );
}

// ─── Stat card (inside header) ────────────────────────────────────────────────
function StatCard({ label, value, sub, highlight }) {
  return (
    <div style={{
      flex: '1 1 140px',
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 10,
      padding: '14px 16px',
    }}>
      <p style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.45)',
        marginBottom: 6,
      }}>
        {label}
      </p>
      <p style={{
        fontSize: 20, fontWeight: 800, lineHeight: 1,
        color: highlight ? '#C8A84B' : '#fff',
        letterSpacing: '-0.02em',
        marginBottom: sub ? 4 : 0,
      }}>
        {value}
      </p>
      {sub && (
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{sub}</p>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function PledgesPage() {
  const { user, lang } = useAuth();
  const role = user?.role || 'member';
  const { t } = useTranslation(lang);

  const [activeTab,        setActiveTab]        = useState('campaigns');
  const [campaigns,        setCampaigns]        = useState([]);
  const [pledgeTypes,      setPledgeTypes]      = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [toasts,           setToasts]           = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [selectedMember,   setSelectedMember]   = useState(
    role === 'member' ? { id: user?.id, name: user?.full_name ?? user?.name } : null
  );
  const [selectedPledge,   setSelectedPledge]   = useState(null);
  const [summary, setSummary] = useState({
    totalPledged: 0, totalPaid: 0, members: 0, campaigns: 0,
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
      const c     = cRes.data.data || [];
      const types = tRes.data.data || [];
      setCampaigns(c);
      setPledgeTypes(types);

      const totPledged = c.reduce((a, x) => a + Number(x.total_pledged    || 0), 0);
      const totPaid    = c.reduce((a, x) => a + Number(x.total_paid       || 0), 0);
      const members    = c.reduce((a, x) => a + Number(x.subscriber_count || 0), 0);
      setSummary({
        totalPledged: totPledged,
        totalPaid:    totPaid,
        members,
        campaigns:    c.filter(x => x.is_active).length,
      });
    } catch (err) {
      addToast(err.message || 'Failed to load', 'danger');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (role === 'member' && user?.id && !selectedMember?.id) {
      setSelectedMember({ id: user.id, name: user.full_name ?? user.name });
    }
  }, [role, user?.id]);

  const TABS = [
    { id: 'campaigns', label: t('pg_tab_campaigns'), Icon: HandIcon,   roles: ['pastor','elder','group_leader'] },
    { id: 'pledges',   label: t('pg_tab_pledges'),   Icon: UsersIcon,  roles: ['pastor','elder','group_leader','member'] },
    { id: 'payments',  label: t('pg_tab_payments'),  Icon: WalletIcon, roles: ['pastor','elder','group_leader','member'] },
    { id: 'report',    label: t('pg_tab_report'),    Icon: ChartIcon,  roles: ['pastor','elder','group_leader'] },
  ];

  const visibleTabs = TABS.filter(tab => tab.roles.includes(role));

  const drillToPledges = (campaign) => {
    setSelectedCampaign(campaign);
    if (role !== 'member') setSelectedMember(null);
    setActiveTab('pledges');
  };

  const drillToPayments = (pledge) => {
    setSelectedPledge(pledge);
    setActiveTab('payments');
  };

  const pct = summary.totalPledged > 0
    ? Math.round((summary.totalPaid / summary.totalPledged) * 100)
    : 0;

  return (
    <div style={{ minHeight: '100vh', background: '#F7F7F9' }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{
        background: '#0F1F3D',
        padding: '28px 32px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 2, height: 16, background: '#C8A84B', borderRadius: 99 }} />
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: '#C8A84B',
              }}>
                {lang === 'sw' ? 'Fedha za Kanisa' : 'Church Finance'}
              </span>
            </div>
            <h1 style={{
              fontSize: 22, fontWeight: 800, color: '#fff',
              letterSpacing: '-0.02em', lineHeight: 1.2,
            }}>
              {t('pg_title')}
            </h1>
          </div>
        </div>

        {/* Stat cards */}
        {!loading && (
          <>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <StatCard
                label={t('pg_stat_campaigns')}
                value={summary.campaigns}
                sub={lang === 'sw' ? 'zinazoendelea' : 'active'}
              />
              <StatCard
                label={t('pg_stat_members')}
                value={summary.members.toLocaleString()}
                sub={lang === 'sw' ? 'walioweka ahadi' : 'pledgers'}
              />
              <StatCard
                label={t('pg_stat_pledged')}
                value={`TShs ${fmtMoney(summary.totalPledged)}`}
                highlight
              />
              <StatCard
                label={t('pg_stat_collected')}
                value={`TShs ${fmtMoney(summary.totalPaid)}`}
                sub={`${pct}% ${lang === 'sw' ? 'imekusanywa' : 'collected'}`}
                highlight
              />
            </div>

            {/* Collection progress bar */}
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  {lang === 'sw' ? 'Mkusanyo wa jumla' : 'Overall collection'}
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, color: pct >= 100 ? '#4ADE80' : '#C8A84B' }}>
                  {pct}%
                </span>
              </div>
              <ProgressBar pct={pct} />
            </div>
          </>
        )}

        {/* Loading shimmer */}
        {loading && (
          <div style={{ display: 'flex', gap: 10 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{
                flex: '1 1 140px', height: 72, borderRadius: 10,
                background: 'rgba(255,255,255,0.07)',
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
            ))}
          </div>
        )}
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div style={{
        background: '#fff',
        borderBottom: '1px solid #EBEBEC',
        position: 'sticky', top: 0, zIndex: 20,
        padding: '0 32px',
      }}>
        <div style={{ display: 'flex', gap: 0 }}>
          {visibleTabs.map(({ id, label, Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '12px 18px',
                  fontSize: 13, fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#1B3A6B' : '#8A8A8E',
                  background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: `2px solid ${isActive ? '#1B3A6B' : 'transparent'}`,
                  marginBottom: -1,
                  transition: 'color 0.12s, border-color 0.12s',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = '#1A1A1E'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = '#8A8A8E'; }}
              >
                <span style={{ color: isActive ? '#1B3A6B' : '#AEADB3' }}>
                  <Icon />
                </span>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────── */}
      <div style={{ padding: '24px 32px', maxWidth: 1200 }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                height: 72, borderRadius: 10,
                background: '#fff', border: '1px solid #EBEBEC',
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
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
                lang={lang}
              />
            )}
            {activeTab === 'pledges' && (
              <PledgesTab
                campaigns={campaigns}
                pledgeTypes={pledgeTypes}
                role={role}
                initialCampaign={selectedCampaign}
                selectedMember={selectedMember}
                onSelectMember={setSelectedMember}
                onDrillPayments={drillToPayments}
                addToast={addToast}
                fmtMoney={fmtMoney}
                fmtDate={fmtDate}
                pctBar={pctBar}
                lang={lang}
              />
            )}
            {activeTab === 'payments' && (
              <PaymentsTab
                role={role}
                initialPledge={selectedPledge}
                addToast={addToast}
                fmtMoney={fmtMoney}
                fmtDate={fmtDate}
                lang={lang}
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
                lang={lang}
              />
            )}
          </>
        )}
      </div>

      <Toast toasts={toasts} />
    </div>
  );
}