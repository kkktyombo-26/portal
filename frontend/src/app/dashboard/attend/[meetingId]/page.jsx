'use client';
/**
 * app/attend/[meetingId]/page.jsx
 * ────────────────────────────────
 * Member RSVP page — opened from the WhatsApp link.
 * Requires the member to be logged in (redirects to /get-account if not).
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../../hooks/useAuth';
import { meetingApi } from '../../../../lib/api';

// ── Icons ─────────────────────────────────────────────────────────────────────
const IconCalendar = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <rect x="2" y="4" width="16" height="14" rx="2"/>
    <path d="M2 8h16M6 2v4M14 2v4" strokeLinecap="round"/>
  </svg>
);
const IconClock = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <circle cx="10" cy="10" r="8"/>
    <path d="M10 6v4l2.5 2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconMapPin = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path d="M10 2a6 6 0 0 1 6 6c0 4-6 10-6 10S4 12 4 8a6 6 0 0 1 6-6z"/>
    <circle cx="10" cy="8" r="2"/>
  </svg>
);
const IconChurch = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path d="M10 2v4M8 4h4" strokeLinecap="round"/>
    <path d="M4 18V9l6-4 6 4v9"/>
    <rect x="8" y="13" width="4" height="5"/>
  </svg>
);
const IconCheck = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M4 10l4.5 4.5L16 6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconAlertCircle = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <circle cx="10" cy="10" r="8"/>
    <path d="M10 6v4M10 14h.01" strokeLinecap="round"/>
  </svg>
);

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('sw-TZ', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}
function formatTime(t) {
  if (!t) return null;
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
}

// ── RSVP options ──────────────────────────────────────────────────────────────
const RSVP_OPTIONS = [
  {
    value:   'rsvp_yes',
    emoji:   '✅',
    label:   'Nitahudhuria',
    sublabel:'Nitakuwepo katika kikao hiki',
    color:   'var(--success)',
    bg:      'rgba(34,197,94,0.08)',
    border:  'rgba(34,197,94,0.35)',
  },
  {
    value:   'rsvp_apology',
    emoji:   '⏰',
    label:   'Sitatoa Udhuru',
    sublabel:'Nitatoa taarifa lakini sitaweza kuhudhuria',
    color:   'var(--warning, #d97706)',
    bg:      'rgba(217,119,6,0.08)',
    border:  'rgba(217,119,6,0.35)',
  },
  {
    value:   'rsvp_no',
    emoji:   '❌',
    label:   'Sitahudhuria',
    sublabel:'Siwezi kuhudhuria kikao hiki',
    color:   'var(--danger)',
    bg:      'rgba(239,68,68,0.08)',
    border:  'rgba(239,68,68,0.35)',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function AttendPage() {
  const params    = useParams();
  const meetingId = params?.meetingId;
  const router    = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [data,       setData]       = useState(null);  // { meeting, invited, attendee }
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);
  const [selected,   setSelected]   = useState(null);  // rsvp value

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      // Store the intended URL so we can redirect back after login
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('redirect_after_login', window.location.pathname);
      }
      router.push('/get-account');
    }
  }, [authLoading, user, router]);

  const fetchData = useCallback(async () => {
    if (!meetingId || !user) return;
    setLoading(true); setError('');
    try {
      const res = await meetingApi.getMyRsvp(meetingId);
      setData(res.data.data);
      // Pre-select current response if already RSVP'd
      if (res.data.data?.attendee?.attendance_type?.startsWith('rsvp_')) {
        setSelected(res.data.data.attendee.attendance_type);
      }
    } catch (err) {
      setError(err.message || 'Imeshindwa kupakia taarifa za kikao.');
    } finally {
      setLoading(false);
    }
  }, [meetingId, user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleSubmit() {
    if (!selected || submitting) return;
    setSubmitting(true); setError('');
    try {
      await meetingApi.submitRsvp(meetingId, selected);
      setSubmitted(true);
      // Refresh to get latest state
      await fetchData();
    } catch (err) {
      setError(err.message || 'Imeshindwa kuhifadhi jibu lako.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading / auth guard ───────────────────────────────────────────────────
  if (authLoading || (!user && !error)) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--surface-page, #f8f7f4)' }}>
        <div style={{ width:40, height:40, borderRadius:'50%', border:'3px solid var(--border-default)', borderTopColor:'var(--gold)', animation:'spin 0.7s linear infinite' }}/>
      </div>
    );
  }

  if (loading) {
    return (
      <PageShell>
        <div style={{ display:'flex', flexDirection:'column', gap:'0.875rem' }}>
          <div className="skeleton" style={{ height:24, width:'60%', borderRadius:8 }}/>
          <div className="skeleton" style={{ height:16, width:'40%', borderRadius:8 }}/>
          <div style={{ height:'1.5rem' }}/>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height:80, borderRadius:12 }}/>)}
        </div>
      </PageShell>
    );
  }

  if (error && !data) {
    return (
      <PageShell>
        <div className="banner banner-danger" style={{ marginBottom:'1.5rem' }}>
          <IconAlertCircle className="w-4 h-4 flex-shrink-0"/>
          <span className="text-sm">{error}</span>
        </div>
        <button className="btn btn-secondary" onClick={() => router.push('/dashboard/meetings')}>
          Rudi kwenye Vikao
        </button>
      </PageShell>
    );
  }

  const { meeting, attendee, invited } = data || {};
  const isConfirmed = attendee?.confirmed_at;
  const currentType = attendee?.attendance_type;

  // Find current RSVP option for display
  const currentOption = RSVP_OPTIONS.find(o => o.value === currentType);

  // ── Already confirmed by manager ──────────────────────────────────────────
  if (isConfirmed) {
    const confirmedLabels = {
      present: { emoji:'✅', label:'Uhudhuria Wako Umethibitishwa', sub:'Kiongozi amethibitisha kuwa ulihudhuria kikao hiki.' },
      apology: { emoji:'⏰', label:'Udhuru Wako Umethibitishwa',    sub:'Kiongozi amethibitisha udhuru wako.' },
      absent:  { emoji:'❌', label:'Kutokuhudhuria Kumethibitishwa', sub:'Kiongozi amethibitisha kutokuhudhuria kwako.' },
    };
    const cfg = confirmedLabels[currentType] || confirmedLabels.present;
    return (
      <PageShell meeting={meeting}>
        <ConfirmedBanner emoji={cfg.emoji} label={cfg.label} sub={cfg.sub}/>
        <BackButton router={router}/>
      </PageShell>
    );
  }

  // ── Success screen (just submitted) ───────────────────────────────────────
  if (submitted && currentOption) {
    return (
      <PageShell meeting={meeting}>
        <SuccessBanner option={currentOption}/>
        <p style={{ textAlign:'center', fontSize:'0.875rem', color:'var(--text-secondary)', marginTop:'1rem' }}>
          Unaweza kubadilisha jibu lako wakati wowote kabla ya kikao kuanza.
        </p>
        <button
          className="btn btn-ghost btn-sm"
          style={{ display:'block', margin:'1rem auto 0' }}
          onClick={() => setSubmitted(false)}
        >
          Badilisha Jibu
        </button>
        <BackButton router={router}/>
      </PageShell>
    );
  }

  // ── Main RSVP form ────────────────────────────────────────────────────────
  return (
    <PageShell meeting={meeting}>

      {/* Already-responded banner */}
      {currentType && !submitted && (
        <div
          style={{
            display:'flex', alignItems:'center', gap:'0.625rem',
            padding:'0.75rem 1rem', borderRadius:10, marginBottom:'1.25rem',
            background: currentOption?.bg || 'var(--surface-sunken)',
            border: `1px solid ${currentOption?.border || 'var(--border-default)'}`,
          }}
        >
          <span style={{ fontSize:'1.1rem' }}>{currentOption?.emoji}</span>
          <div>
            <p className="text-sm font-medium" style={{ color: currentOption?.color }}>
              Jibu lako la sasa: {currentOption?.label}
            </p>
            <p className="text-xs" style={{ color:'var(--text-secondary)', marginTop:2 }}>
              Unaweza kubadilisha chini.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="banner banner-danger" style={{ marginBottom:'1rem' }}>
          <IconAlertCircle className="w-4 h-4 flex-shrink-0"/>
          <span className="text-sm">{error}</span>
        </div>
      )}

      <p className="text-sm" style={{ color:'var(--text-secondary)', marginBottom:'1rem', textAlign:'center' }}>
        Tafadhali thibitisha uhudhuria wako kwa kikao hiki:
      </p>

      {/* RSVP option cards */}
      <div style={{ display:'flex', flexDirection:'column', gap:'0.625rem', marginBottom:'1.5rem' }}>
        {RSVP_OPTIONS.map(opt => {
          const isSelected = selected === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => setSelected(opt.value)}
              style={{
                display:'flex', alignItems:'center', gap:'1rem',
                padding:'1rem 1.25rem', borderRadius:12, textAlign:'left',
                background: isSelected ? opt.bg : 'var(--surface-card, #fff)',
                border: `2px solid ${isSelected ? opt.border : 'var(--border-default)'}`,
                cursor:'pointer',
                transition:'all 0.15s ease',
                outline:'none',
              }}
            >
              <span style={{ fontSize:'1.5rem', flexShrink:0 }}>{opt.emoji}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <p
                  className="font-semibold"
                  style={{
                    fontSize:'0.9375rem',
                    color: isSelected ? opt.color : 'var(--text-primary)',
                    marginBottom:2,
                  }}
                >
                  {opt.label}
                </p>
                <p style={{ fontSize:'0.8125rem', color:'var(--text-secondary)' }}>
                  {opt.sublabel}
                </p>
              </div>
              {/* Selection indicator */}
              <div
                style={{
                  width:22, height:22, borderRadius:'50%', flexShrink:0,
                  border: `2px solid ${isSelected ? opt.color : 'var(--border-default)'}`,
                  background: isSelected ? opt.color : 'transparent',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  transition:'all 0.15s ease',
                }}
              >
                {isSelected && <IconCheck className="w-3 h-3" style={{ stroke:'#fff' }}/>}
              </div>
            </button>
          );
        })}
      </div>

      {/* Submit button */}
      <button
        className="btn btn-primary"
        style={{ width:'100%', justifyContent:'center', padding:'0.875rem' }}
        disabled={!selected || submitting}
        onClick={handleSubmit}
      >
        {submitting ? 'Inahifadhi…' : 'Tuma Jibu Langu'}
      </button>

      <BackButton router={router}/>
    </PageShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function PageShell({ children, meeting }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--surface-page, #f8f7f4)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '2rem 1rem',
      }}
    >
      <div style={{ width:'100%', maxWidth:480 }}>

        {/* Church branding */}
        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'1.5rem' }}>
          <div style={{ width:36, height:36, borderRadius:'50%', overflow:'hidden', flexShrink:0 }}>
            <img src="/luther.webp" alt="" width={36} height={36} style={{ objectFit:'contain', display:'block' }}/>
          </div>
          <div>
            <p style={{ fontWeight:700, fontSize:'0.9375rem', color:'var(--navy)', letterSpacing:'-0.02em', lineHeight:1.2 }}>
              KKKT DMP Yombo
            </p>
            <p style={{ fontSize:'0.6875rem', fontWeight:600, letterSpacing:'0.14em', textTransform:'uppercase', color:'var(--gold-dark)' }}>
              Mwaliko wa Kikao
            </p>
          </div>
        </div>

        {/* Meeting info card */}
        {meeting && (
          <div
            className="card"
            style={{ padding:'1.25rem', marginBottom:'1.5rem' }}
          >
            <div style={{ display:'flex', alignItems:'flex-start', gap:'0.75rem', marginBottom:'1rem' }}>
              <div
                style={{
                  width:40, height:40, borderRadius:10, flexShrink:0,
                  background:'rgba(196,154,42,0.12)', border:'1px solid rgba(196,154,42,0.3)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                }}
              >
                <IconChurch className="w-5 h-5" style={{ color:'var(--gold-dark)' }}/>
              </div>
              <div>
                <p style={{ fontSize:'0.6875rem', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-tertiary)', marginBottom:3 }}>
                  {meeting.type_name || 'Kikao'}
                  {!meeting.group_id && ' · Kanisa Lote'}
                  {meeting.group_name && ` · ${meeting.group_name}`}
                </p>
                <h1 style={{ fontSize:'1.0625rem', fontWeight:700, color:'var(--navy)', lineHeight:1.3 }}>
                  {meeting.title}
                </h1>
              </div>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
              <MetaRow icon={<IconCalendar className="w-3.5 h-3.5"/>} text={formatDate(meeting.meeting_date)}/>
              {meeting.start_time && (
                <MetaRow
                  icon={<IconClock className="w-3.5 h-3.5"/>}
                  text={`${formatTime(meeting.start_time)}${meeting.end_time ? ` – ${formatTime(meeting.end_time)}` : ''}`}
                />
              )}
              {meeting.venue && (
                <MetaRow icon={<IconMapPin className="w-3.5 h-3.5"/>} text={meeting.venue}/>
              )}
            </div>
          </div>
        )}

        {/* Page content */}
        {children}
      </div>
    </div>
  );
}

function MetaRow({ icon, text }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
      <span style={{ color:'var(--text-tertiary)', flexShrink:0 }}>{icon}</span>
      <span style={{ fontSize:'0.875rem', color:'var(--text-secondary)' }}>{text}</span>
    </div>
  );
}

function SuccessBanner({ option }) {
  return (
    <div
      style={{
        display:'flex', flexDirection:'column', alignItems:'center',
        padding:'2rem 1.5rem', borderRadius:14, textAlign:'center',
        background: option.bg,
        border: `2px solid ${option.border}`,
        marginBottom:'1rem',
      }}
    >
      <span style={{ fontSize:'3rem', marginBottom:'0.75rem' }}>{option.emoji}</span>
      <p style={{ fontSize:'1.125rem', fontWeight:700, color: option.color, marginBottom:6 }}>
        {option.label}
      </p>
      <p style={{ fontSize:'0.875rem', color:'var(--text-secondary)' }}>
        Jibu lako limehifadhiwa. Ahsante!
      </p>
    </div>
  );
}

function ConfirmedBanner({ emoji, label, sub }) {
  return (
    <div
      style={{
        display:'flex', flexDirection:'column', alignItems:'center',
        padding:'2rem 1.5rem', borderRadius:14, textAlign:'center',
        background:'var(--surface-sunken)',
        border:'2px solid var(--border-default)',
        marginBottom:'1rem',
      }}
    >
      <span style={{ fontSize:'3rem', marginBottom:'0.75rem' }}>{emoji}</span>
      <p style={{ fontSize:'1.0625rem', fontWeight:700, color:'var(--navy)', marginBottom:6 }}>
        {label}
      </p>
      <p style={{ fontSize:'0.875rem', color:'var(--text-secondary)' }}>{sub}</p>
    </div>
  );
}

function BackButton({ router }) {
  return (
    <button
      className="btn btn-ghost btn-sm"
      style={{ display:'block', margin:'1.25rem auto 0', color:'var(--text-tertiary)' }}
      onClick={() => router.push('/dashboard/meetings')}
    >
      ← Rudi kwenye Vikao
    </button>
  );
}