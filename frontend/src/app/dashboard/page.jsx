'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useAuth }        from '../../hooks/useAuth';
import { useTranslation } from '../../lib/i18n';
import { userApi, announcementApi, groupApi, eventApi } from '../../lib/api';
import api                from '../../lib/api';
import { pledgeApi }      from '../../lib/pledgeApi';

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  navy:        '#1C1917',
  navyMid:     '#3D3835',
  navyLight:   '#57534E',
  gold:        '#F59E0B',
  goldDark:    '#B45309',
  goldLight:   '#FCD34D',
  goldSubtle:  '#FFFBEB',
  page:        '#F5F4F0',
  card:        '#FFFFFF',
  ink:         '#1C1917',
  inkSub:      '#57534E',
  inkMuted:    '#A8A29E',
  inkFaint:    '#D6D3D1',
  border:      '#E7E5E4',
  borderLight: '#F5F5F4',
  success:     '#15803D',
  successBg:   '#F0FDF4',
  warning:     '#D97706',
  warningBg:   '#FFFBEB',
  danger:      '#DC2626',
  dangerBg:    '#FEF2F2',
  info:        '#0369A1',
  infoBg:      '#F0F9FF',
};

// ─── Role helpers ─────────────────────────────────────────────────────────────
const isAdmin   = r => ['pastor', 'katibu'].includes(r);
const isFinance = r => ['pastor', 'katibu', 'mweka_hazina'].includes(r);
const isLeader  = r => ['pastor', 'katibu', 'elder', 'group_leader'].includes(r);
const isMember  = r => !isAdmin(r) && !isFinance(r) && !isLeader(r);
// Sees pledge data: all elevated roles (finance + leader)
const canSeePledges = r => isFinance(r) || isLeader(r);

// ─── Pledge data aggregator ───────────────────────────────────────────────────
/**
 * Accepts the array returned by pledgeApi.getCampaigns() (v_pledge_summary rows)
 * and returns the four headline figures for the KPI strip.
 */
function aggregatePledges(campaigns = []) {
  return campaigns.reduce(
    (acc, c) => {
      const pledged   = Number(c.total_pledged    ?? 0);
      const paid      = Number(c.total_paid       ?? 0);
      acc.totalPledged  += pledged;
      acc.confirmedPaid += paid;
      acc.balanceDue    += Math.max(0, pledged - paid);
      // pending_amount and pendingCount aren't available from getCampaigns;
      // they'd require a separate getPendingPayments call
      acc.pendingAmount += 0;
      acc.pendingCount  += 0;
      return acc;
    },
    { totalPledged: 0, confirmedPaid: 0, pendingAmount: 0, balanceDue: 0, pendingCount: 0 },
  );
}

// ─── Format helpers ───────────────────────────────────────────────────────────
function fmtMoney(n) {
  if (!n && n !== 0) return '—';
  const v = Number(n);
  if (v >= 1e9) return 'TShs ' + (v / 1e9).toFixed(1) + 'B';
  if (v >= 1e6) return 'TShs ' + (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return 'TShs ' + (v / 1e3).toFixed(0) + 'K';
  return 'TShs ' + v.toLocaleString();
}

function fmtDate(d) {
  if (!d) return '—';
  try {
    const s = typeof d === 'string' && !d.includes('T') ? d + 'T00:00:00' : d;
    return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return String(d); }
}

function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h);
  return `${hour % 12 || 12}:${m} ${hour < 12 ? 'AM' : 'PM'}`;
}

function parseDuration(iso) {
  if (!iso) return '';
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return '';
  const h = +(m[1] || 0), mn = +(m[2] || 0), s = +(m[3] || 0);
  return h ? `${h}:${String(mn).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${mn}:${String(s).padStart(2,'0')}`;
}

function fmtViews(n) {
  if (n == null) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

const MONTHS_ABBR = {
  en: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
  sw: ['Jan','Feb','Mac','Apr','Mei','Jun','Jul','Ago','Sep','Okt','Nov','Des'],
};

const GROUP_ICONS = {
  choir: '♫', youth: '◎', elders: '◈', women: '♀', men: '♂',
  children: '◉', other: '◇', kwaya: '♫', idara: '◉', huduma: '◈', kamati: '◇',
};

const SOCIAL = [
  { key: 'fb', href: 'https://web.facebook.com/profile.php?id=61579436296006', label: 'Facebook',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg> },
  { key: 'ig', href: 'https://www.instagram.com/kkktyombo', label: 'Instagram',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg> },
  { key: 'yt', href: 'https://www.youtube.com/@KKKTDMPYOMBO', label: 'YouTube',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z"/></svg> },
];

// ─── Shared primitives ────────────────────────────────────────────────────────

function Panel({ children, style }) {
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.borderLight}`,
      borderRadius: 12, overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(68,64,60,.06)',
      ...style,
    }}>
      {children}
    </div>
  );
}

function PanelHead({ title, action, onAction, actionHref }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '1rem 1.25rem 0.875rem',
      borderBottom: `1px solid ${T.borderLight}`,
    }}>
      <span style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 15, fontWeight: 600, letterSpacing: '-0.015em', color: T.ink }}>
        {title}
      </span>
      {action && (
        actionHref
          ? <Link href={actionHref} style={{ fontSize: 12, fontWeight: 600, color: T.goldDark, textDecoration: 'none', padding: '2px 6px', borderRadius: 4 }}>{action}</Link>
          : <button onClick={onAction} style={{ fontSize: 12, fontWeight: 600, color: T.goldDark, border: 'none', background: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 4 }}>{action}</button>
      )}
    </div>
  );
}

function Badge({ children, variant = 'neutral' }) {
  const styles = {
    success: { background: T.successBg, color: T.success, border: `1px solid rgba(21,128,61,.2)` },
    warning: { background: T.warningBg, color: T.warning, border: `1px solid rgba(217,119,6,.2)` },
    danger:  { background: T.dangerBg,  color: T.danger,  border: `1px solid rgba(220,38,38,.2)` },
    gold:    { background: T.goldSubtle, color: T.goldDark, border: `1px solid #FEF3C7` },
    neutral: { background: '#F5F5F4', color: T.inkSub, border: `1px solid ${T.border}` },
    navy:    { background: T.navy,    color: '#fff', border: 'none' },
    blue:    { background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' },
  };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontSize: 11, fontWeight: 600, letterSpacing: '0.03em',
      borderRadius: 4, padding: '2px 7px',
      ...styles[variant],
    }}>
      {children}
    </span>
  );
}

function ProgressBar({ pct, color, height = 5 }) {
  const fill = color || (pct >= 75 ? T.success : pct >= 40 ? T.gold : T.navy);
  return (
    <div style={{ height, background: T.borderLight, borderRadius: 999, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: fill, borderRadius: 999, transition: 'width .4s ease-out' }} />
    </div>
  );
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: 18, height: 18, borderRadius: '50%',
      border: `2px solid ${T.borderLight}`, borderTopColor: T.inkMuted,
      animation: 'kkkt-spin 0.8s linear infinite',
    }} />
  );
}

function EmptyState({ text }) {
  return (
    <div style={{ padding: '40px 20px', textAlign: 'center', fontSize: 13, color: T.inkMuted }}>
      {text}
    </div>
  );
}

// ─── KPI strip ────────────────────────────────────────────────────────────────
function KpiStrip({ cells }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${cells.length}, 1fr)`,
      background: T.card,
      borderBottom: `1px solid ${T.border}`,
    }}>
      {cells.map((c, i) => (
        <div key={i} style={{
          padding: '1.25rem 1.5rem',
          borderRight: i < cells.length - 1 ? `1px solid ${T.border}` : 'none',
          background: c.primary ? T.navy : T.card,
          position: 'relative',
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6, color: c.primary ? 'rgba(255,255,255,.5)' : T.inkMuted }}>
            {c.label}
          </div>
          <div style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 28, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1, color: c.primary ? '#fff' : T.ink, fontVariantNumeric: 'tabular-nums' }}>
            {c.value}
          </div>
          {c.sub && (
            <div style={{ fontSize: 11, fontWeight: 500, marginTop: 6, color: c.primary ? '#FBBF24' : (c.subColor || T.inkMuted) }}>
              {c.sub}
            </div>
          )}
          {c.pct != null && (
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: T.borderLight }}>
              <div style={{ height: '100%', width: `${c.pct}%`, background: T.gold }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Page header ──────────────────────────────────────────────────────────────
function PageHeader({ eyebrow, title, subtitle, children }) {
  return (
    <div style={{ background: T.navy, padding: '2rem 2.5rem 1.75rem', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v1H0zM0 0h1v40H0z' fill='%23ffffff' fill-opacity='.04'/%3E%3C/svg%3E\")" }} />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${T.goldDark} 0%, ${T.goldLight} 50%, ${T.goldDark} 100%)` }} />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          {eyebrow && <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#FBBF24', marginBottom: 8 }}>{eyebrow}</div>}
          <div style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1, color: '#fff' }}>{title}</div>
          {subtitle && <div style={{ marginTop: 6, fontSize: 15, color: 'rgba(255,255,255,.65)' }}>{subtitle}</div>}
        </div>
        {children && <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>{children}</div>}
      </div>
    </div>
  );
}

// ─── Announcement banner ──────────────────────────────────────────────────────
function AnnouncementsBanner({ announcements, lang }) {
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (announcements.length < 2) return;
    const id = setInterval(() => setActive(a => (a + 1) % announcements.length), 5500);
    return () => clearInterval(id);
  }, [announcements.length]);

  if (!announcements.length) {
    return (
      <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.navy }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,.3)' }}>{lang === 'sw' ? 'Hakuna matangazo' : 'No announcements'}</span>
      </div>
    );
  }

  const ev    = announcements[active];
  const title = lang === 'sw' ? ev.title_sw : ev.title_en;
  const body  = lang === 'sw' ? ev.body_sw  : ev.body_en;

  return (
    <div style={{ position: 'relative', background: T.navy, overflow: 'hidden', minHeight: 240, userSelect: 'none' }}>
      {ev.image_url && <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${ev.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />}
      <div style={{ position: 'absolute', inset: 0, background: ev.image_url ? 'linear-gradient(to top, rgba(28,25,23,.97) 0%, rgba(28,25,23,.55) 50%, rgba(28,25,23,.18) 100%)' : `linear-gradient(135deg, ${T.navy} 0%, #3D3835 100%)` }} />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(to right, ${T.gold}, transparent)` }} />
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', minHeight: 240, padding: '0 28px 24px' }}>
        <div style={{ marginBottom: 12 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(245,158,11,.15)', border: '1px solid rgba(245,158,11,.35)', borderRadius: 20, padding: '3px 10px', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.gold }}>
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: T.gold, display: 'inline-block' }} />
            {lang === 'sw' ? 'Tangazo' : 'Announcement'}
          </span>
        </div>
        <p style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 22, fontWeight: 700, color: '#fff', lineHeight: 1.25, letterSpacing: '-0.01em', marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{title}</p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', lineHeight: 1.65, marginBottom: 16, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{body}</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', fontVariantNumeric: 'tabular-nums' }}>
              {new Date(ev.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            {ev.author_name && <><span style={{ color: 'rgba(255,255,255,.15)' }}>·</span><span style={{ fontSize: 10, color: 'rgba(255,255,255,.3)' }}>{ev.author_name}</span></>}
          </div>
          {announcements.length > 1 && (
            <div style={{ display: 'flex', gap: 5 }}>
              {announcements.map((_, i) => (
                <button key={i} onClick={() => setActive(i)} style={{ width: i === active ? 20 : 4, height: 4, borderRadius: 99, border: 'none', cursor: 'pointer', padding: 0, background: i === active ? T.gold : 'rgba(255,255,255,.25)', transition: 'width .3s ease, background .3s ease' }} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Announcement card ────────────────────────────────────────────────────────
function AnnouncementCard({ a, lang, t }) {
  const title    = lang === 'sw' ? a.title_sw : a.title_en;
  const body     = lang === 'sw' ? a.body_sw  : a.body_en;
  const isChurch = a.scope === 'church';
  return (
    <div style={{ position: 'relative', background: '#1B2F50', borderRadius: 10, overflow: 'hidden' }}>
      {a.image_url && <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${a.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.22, pointerEvents: 'none' }} />}
      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 2, background: isChurch ? T.gold : '#5B8AD4' }} />
      <div style={{ padding: '14px 16px 14px 20px', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: isChurch ? T.gold : '#5B8AD4' }}>
            {isChurch ? (lang === 'sw' ? 'Kanisa Lote' : 'Church-wide') : (a.group_name || (lang === 'sw' ? 'Kikundi' : 'Group'))}
          </span>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,.3)', fontVariantNumeric: 'tabular-nums' }}>
            {new Date(a.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
          </span>
        </div>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#fff', lineHeight: 1.35, marginBottom: 4 }}>{title}</p>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', lineHeight: 1.6, marginBottom: a.author_name ? 8 : 0, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{body}</p>
        {a.author_name && <span style={{ fontSize: 10, color: 'rgba(255,255,255,.25)' }}>{t('posted_by')} {a.author_name}</span>}
      </div>
    </div>
  );
}

// ─── Campaign progress row ────────────────────────────────────────────────────
function CampaignRow({ c, lang, showPending = false }) {
  const pledged   = Number(c.total_pledged    ?? c.target_amount    ?? 0);
  const confirmed = Number(c.total_paid ?? c.confirmed_amount ?? c.collected_amount ?? 0);
  const pending   = Number(c.pending_amount   ?? 0);
  const balance   = Number(c.balance_due      ?? Math.max(0, pledged - confirmed));
  const pct       = pledged ? Math.round((confirmed / pledged) * 100) : 0;
  const isActive  = c.is_active || c.status === 'active';
  const shortCode = (c.name || 'AHD').slice(0, 3).toUpperCase();

  return (
    <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${T.borderLight}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{ width: 34, height: 34, borderRadius: 8, background: T.navy, color: T.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
            {shortCode}
          </span>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: T.ink, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
            <p style={{ fontSize: 11, color: T.inkMuted, marginTop: 1 }}>
             {c.subscriber_count ?? c.member_count ?? '—'} {lang === 'sw' ? 'washrika' : 'members'}
              {c.end_date ? ` · ${lang === 'sw' ? 'Mwisho' : 'ends'} ${fmtDate(c.end_date)}` : ''}
            </p>
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 20, fontWeight: 700, color: T.ink, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{pct}%</div>
          <div style={{ fontSize: 10, color: T.inkMuted, marginTop: 2 }}>{fmtMoney(balance)} {lang === 'sw' ? 'iliyobaki' : 'remaining'}</div>
        </div>
      </div>
      <ProgressBar pct={pct} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: T.inkMuted }}>{lang === 'sw' ? 'Imethibitishwa' : 'Confirmed'}: <strong style={{ color: T.ink }}>{fmtMoney(confirmed)}</strong></span>
        {showPending && pending > 0 && (
          <span style={{ fontSize: 11, color: T.warning, fontWeight: 600 }}>
            + {fmtMoney(pending)} {lang === 'sw' ? 'inasubiri' : 'pending'}
          </span>
        )}
        <Badge variant={isActive ? 'success' : 'neutral'}>
          {isActive ? (lang === 'sw' ? 'Hai' : 'Active') : (lang === 'sw' ? 'Imefungwa' : 'Closed')}
        </Badge>
      </div>
    </div>
  );
}

// ─── Pending payment row (elevated → Pledges tab) ─────────────────────────────
function PendingPaymentRow({ p, lang, isLast }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.875rem 1.25rem', borderBottom: isLast ? 'none' : `1px solid ${T.borderLight}` }}>
      <div style={{ width: 48, height: 48, borderRadius: 10, background: T.warningBg, border: `1px solid rgba(217,119,6,.2)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.warning, lineHeight: 1 }}>TShs</span>
        <span style={{ fontSize: 11, fontWeight: 800, color: T.warning, fontVariantNumeric: 'tabular-nums', lineHeight: 1.3 }}>
          {Number(p.amount) >= 1000 ? (Number(p.amount) / 1000).toFixed(0) + 'K' : Number(p.amount).toLocaleString()}
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: T.ink, lineHeight: 1.3, marginBottom: 2 }}>{p.member_name ?? '—'}</p>
        <p style={{ fontSize: 11, color: T.inkMuted }}>
          {p.campaign_name ?? '—'}
          {p.payment_method ? ` · ${p.payment_method}` : ''}
          {p.reference_number ? ` · ${p.reference_number}` : ''}
        </p>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: T.inkMuted }}>{fmtDate(p.payment_date)}</span>
        {p.receipt_url && (
          <a href={p.receipt_url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', fontSize: 10, fontWeight: 600, color: T.goldDark, marginTop: 2, textDecoration: 'none' }}>
            {lang === 'sw' ? 'Risiti →' : 'Receipt →'}
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Member's own pledge row ──────────────────────────────────────────────────
function MemberPledgeRow({ p, lang, isLast }) {
  const pledged   = Number(p.pledge_amount    ?? 0);
  const confirmed = Number(p.confirmed_amount ?? 0);
  const pending   = Number(p.pending_amount   ?? 0);
  const balance   = Number(p.balance_due      ?? Math.max(0, pledged - confirmed));
  const pct       = pledged ? Math.round((confirmed / pledged) * 100) : 0;

  const statusVariant = { active: 'success', pending: 'warning', rejected: 'danger' }[p.pledge_status] ?? 'neutral';
  const statusLabel   = {
    active:   lang === 'sw' ? 'Hai'         : 'Active',
    pending:  lang === 'sw' ? 'Inasubiri'   : 'Pending',
    rejected: lang === 'sw' ? 'Ilikataliwa' : 'Rejected',
  }[p.pledge_status] ?? p.pledge_status ?? '—';

  return (
    <div style={{ padding: '1rem 1.25rem', borderBottom: isLast ? 'none' : `1px solid ${T.borderLight}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: T.ink, lineHeight: 1.3, marginBottom: 3 }}>{p.campaign_name ?? '—'}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Badge variant={statusVariant}>{statusLabel}</Badge>
            {pending > 0 && <Badge variant="warning">{fmtMoney(pending)} {lang === 'sw' ? 'inasubiri' : 'awaiting'}</Badge>}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ fontSize: 11, color: T.inkMuted }}>{lang === 'sw' ? 'Ahadi' : 'Pledged'}</p>
          <p style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 16, fontWeight: 700, color: T.ink, fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(pledged)}</p>
        </div>
      </div>
      <ProgressBar pct={pct} />
      <div style={{ display: 'flex', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: T.inkMuted }}>{lang === 'sw' ? 'Lililolipwa' : 'Paid'}: <strong style={{ color: T.success }}>{fmtMoney(confirmed)}</strong></span>
        <span style={{ fontSize: 11, color: T.inkMuted }}>{lang === 'sw' ? 'Iliyobaki' : 'Balance'}: <strong style={{ color: balance > 0 ? T.danger : T.success }}>{fmtMoney(balance)}</strong></span>
        {p.next_installment_date && (
          <span style={{ fontSize: 11, color: T.inkMuted }}>{lang === 'sw' ? 'Awamu ifuatayo' : 'Next'}: <strong style={{ color: T.ink }}>{fmtDate(p.next_installment_date)}</strong></span>
        )}
      </div>
    </div>
  );
}

// ─── YouTube video thumbnail ──────────────────────────────────────────────────
function VideoThumb({ v, lang, isLast }) {
  return (
    <a href={v.url} target="_blank" rel="noopener noreferrer"
      style={{ display: 'block', textDecoration: 'none', borderBottom: isLast ? 'none' : `1px solid ${T.borderLight}` }}
      onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
    >
      <div style={{ position: 'relative', aspectRatio: '16/9', background: T.navy, overflow: 'hidden' }}>
        {v.thumbnail
          ? <img src={v.thumbnail} alt={v.title} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="rgba(255,255,255,0.2)"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z"/></svg>
            </div>
        }
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '65%', background: 'linear-gradient(to top, rgba(10,18,34,.95) 0%, transparent 100%)', pointerEvents: 'none' }} />
        {v.duration && <span style={{ position: 'absolute', bottom: 28, right: 6, background: 'rgba(0,0,0,.78)', color: '#fff', fontSize: 8, fontWeight: 700, borderRadius: 3, padding: '1px 4px', fontVariantNumeric: 'tabular-nums' }}>{parseDuration(v.duration)}</span>}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 8px 7px' }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: '#fff', lineHeight: 1.3, margin: '0 0 2px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{v.title}</p>
          {v.viewCount != null && <span style={{ fontSize: 8, color: 'rgba(255,255,255,.5)', fontVariantNumeric: 'tabular-nums' }}>{fmtViews(v.viewCount)} {lang === 'sw' ? 'maoni' : 'views'}</span>}
        </div>
      </div>
    </a>
  );
}

// ─── Events list ──────────────────────────────────────────────────────────────
function EventsList({ events, lang, loading }) {
  if (loading) return <div style={{ padding: '32px 16px', display: 'flex', justifyContent: 'center' }}><Spinner /></div>;
  if (!events?.length) return (
    <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 12, color: T.inkMuted }}>
      {lang === 'sw' ? 'Hakuna matukio yanayokuja' : 'No upcoming events'}
    </div>
  );
  return (
    <div>
      {events.slice(0, 5).map((ev, i) => {
        const dateStr = ev.event_date?.split('T')[0] || ev.event_date;
        const d       = new Date(dateStr + 'T00:00:00');
        const title   = lang === 'sw' ? ev.title_sw : ev.title_en;
        return (
          <div key={ev.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px' }}>
              <div style={{ flexShrink: 0, width: 42, textAlign: 'center', background: T.page, borderRadius: 8, padding: '6px 4px' }}>
                <div style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 20, fontWeight: 700, color: T.ink, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                  {String(d.getDate()).padStart(2, '0')}
                </div>
                <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: T.inkMuted, marginTop: 2 }}>
                  {MONTHS_ABBR[lang][d.getMonth()]}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: T.ink, lineHeight: 1.3, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</p>
                {(ev.start_time || ev.location) && (
                  <p style={{ fontSize: 11, color: T.inkMuted }}>
                    {ev.start_time && fmtTime(ev.start_time)}
                    {ev.start_time && ev.location && ' · '}
                    {ev.location}
                  </p>
                )}
              </div>
            </div>
            {i < Math.min(events.length, 5) - 1 && <div style={{ height: 1, background: T.borderLight, marginLeft: 74 }} />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Groups list ──────────────────────────────────────────────────────────────
function GroupsList({ groups, lang }) {
  if (!groups.length) return (
    <div style={{ padding: '24px 20px', textAlign: 'center', fontSize: 12, color: T.inkMuted }}>
      {lang === 'sw' ? 'Hakuna vikundi' : 'No groups'}
    </div>
  );
  return (
    <div>
      {groups.slice(0, 5).map((g, i) => (
        <div key={g.id}>
          <Link href={`/dashboard/groups/${g.id}`}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', textDecoration: 'none' }}
            onMouseEnter={e => e.currentTarget.style.background = T.page}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <span style={{ width: 30, height: 30, borderRadius: 7, flexShrink: 0, background: T.page, border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: T.inkMuted }}>
              {GROUP_ICONS[g.type] || '◇'}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: T.ink, lineHeight: 1, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {lang === 'sw' ? (g.name_sw || g.name) : g.name}
              </p>
              <p style={{ fontSize: 11, color: T.inkMuted }}>
                {g.member_count} {lang === 'sw' ? 'washarika' : 'members'}
              </p>
            </div>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke={T.border} strokeWidth="1.5" strokeLinecap="round"><path d="M4.5 2.5L8 6l-3.5 3.5"/></svg>
          </Link>
          {i < Math.min(groups.length, 5) - 1 && <div style={{ height: 1, background: T.borderLight, marginLeft: 62 }} />}
        </div>
      ))}
      {groups.length > 5 && (
        <Link href="/dashboard/groups"
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', textDecoration: 'none' }}
          onMouseEnter={e => e.currentTarget.style.background = T.page}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <span style={{ width: 30, height: 30, borderRadius: 7, flexShrink: 0, background: T.page, border: `1px dashed ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: T.inkMuted }}>···</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: T.inkSub }}>{lang === 'sw' ? `Vikundi vyote (${groups.length})` : `All groups (${groups.length})`}</span>
        </Link>
      )}
    </div>
  );
}

// ─── Social links ─────────────────────────────────────────────────────────────
function SocialLinks({ lang }) {
  return (
    <div style={{ padding: '14px 20px 20px' }}>
      <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.inkMuted, marginBottom: 10 }}>
        {lang === 'sw' ? 'Mitandao' : 'Follow us'}
      </p>
      <div style={{ display: 'flex', gap: 6 }}>
        {SOCIAL.map(({ key, href, label, icon }) => (
          <a key={key} href={href} target="_blank" rel="noopener noreferrer" title={label}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: T.page, border: `1px solid ${T.border}`, color: T.inkSub, textDecoration: 'none', transition: 'background .12s, color .12s' }}
            onMouseEnter={e => { e.currentTarget.style.background = T.navy; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = T.navy; }}
            onMouseLeave={e => { e.currentTarget.style.background = T.page; e.currentTarget.style.color = T.inkSub; e.currentTarget.style.borderColor = T.border; }}
          >
            {icon}
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── Mobile tab bar ───────────────────────────────────────────────────────────
function MobileTabs({ tab, setTab, lang, tabs }) {
  return (
    <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, overflowX: 'auto', scrollbarWidth: 'none' }}>
      {tabs.map(({ key, label }) => {
        const active = tab === key;
        return (
          <button key={key} onClick={() => setTab(key)} style={{
            flex: '1 0 auto', padding: '12px 16px',
            fontSize: 12, fontWeight: active ? 700 : 500,
            color: active ? T.ink : T.inkMuted,
            background: 'none', border: 'none', cursor: 'pointer',
            borderBottom: active ? `2px solid ${T.gold}` : '2px solid transparent',
            marginBottom: -1, whiteSpace: 'nowrap', transition: 'color .15s',
          }}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MEMBER DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
function MemberDashboard({ user, lang, t, announcements, videos, groups, upcomingEvents, memberPledges, loading }) {
  const firstName     = user.full_name?.split(' ')[0] ?? '';
  const [tab, setTab] = useState('announcements');

  const mobileTabs = [
    { key: 'announcements', label: lang === 'sw' ? 'Matangazo' : 'Announcements' },
    { key: 'pledges',       label: lang === 'sw' ? 'Ahadi' : 'Pledges' },
    { key: 'videos',        label: 'YouTube' },
    { key: 'groups',        label: lang === 'sw' ? 'Vikundi' : 'Groups' },
    { key: 'events',        label: lang === 'sw' ? 'Ratiba' : 'Schedule' },
  ];

  const activePledges = memberPledges.filter(p => p.pledge_status !== 'rejected');

  return (
    <div style={{ background: T.page, minHeight: '100%' }}>
      <style>{`
        @keyframes kkkt-spin { to { transform: rotate(360deg); } }
        .member-mobile  { display: block; }
        .member-desktop { display: none; }
        .vid-grid       { display: grid; grid-template-columns: 1fr; }
        .desktop-banner { display: none; }
        @media (min-width: 900px) {
          .member-mobile  { display: none !important; }
          .member-desktop { display: grid !important; grid-template-columns: minmax(0,1.65fr) minmax(0,1fr); gap: 24px; padding: 24px 2.5rem 2.5rem; }
          .vid-grid       { grid-template-columns: 1fr 1fr; }
          .desktop-banner { display: block; }
        }
      `}</style>

      {/* Greeting bar */}
      <div style={{ background: T.card, borderBottom: `1px solid ${T.border}`, padding: '20px 2.5rem 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.inkMuted, marginBottom: 4 }}>
            {lang === 'sw' ? 'Dashibodi' : 'Dashboard'}
          </p>
          <h1 style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2, color: T.ink }}>
            {lang === 'sw' ? `Karibu, ${firstName}` : `Welcome, ${firstName}`}
          </h1>
        </div>
        {user.group_name && <span style={{ fontSize: 11, color: T.inkMuted, flexShrink: 0 }}>{user.group_name}</span>}
      </div>

      {/* ── MOBILE layout ── */}
      <div className="member-mobile">
        {loading
          ? <div style={{ height: 240, background: T.navy, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner /></div>
          : <AnnouncementsBanner announcements={announcements} lang={lang} />
        }
        <MobileTabs tab={tab} setTab={setTab} lang={lang} tabs={mobileTabs} />
        <div style={{ padding: '16px' }}>

          {tab === 'announcements' && (
            loading
              ? <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><Spinner /></div>
              : !announcements.length
                ? <EmptyState text={lang === 'sw' ? 'Hakuna matangazo' : 'No announcements'} />
                : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {announcements.map(a => <AnnouncementCard key={a.id} a={a} lang={lang} t={t} />)}
                  </div>
          )}

          {tab === 'pledges' && (
            <Panel>
              <PanelHead title={lang === 'sw' ? 'Ahadi Zangu' : 'My Pledges'} actionHref="/dashboard/pledges" action={lang === 'sw' ? 'Zote →' : 'All →'} />
              {loading
                ? <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}><Spinner /></div>
                : !activePledges.length
                  ? <EmptyState text={lang === 'sw' ? 'Huna ahadi zilizosajiliwa' : 'You have no registered pledges'} />
                  : activePledges.map((p, i) => <MemberPledgeRow key={p.id ?? i} p={p} lang={lang} isLast={i === activePledges.length - 1} />)
              }
            </Panel>
          )}

          {tab === 'videos' && (
            <Panel>
              <PanelHead title={lang === 'sw' ? 'Hivi Karibuni' : 'Latest Videos'} />
              {videos.slice(0, 6).map((v, i) => <VideoThumb key={v.id} v={v} lang={lang} isLast={i === Math.min(videos.length, 6) - 1} />)}
              {!videos.length && <EmptyState text={lang === 'sw' ? 'Hakuna video' : 'No videos yet'} />}
            </Panel>
          )}

          {tab === 'groups' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Panel><PanelHead title={lang === 'sw' ? 'Vikundi' : 'Groups'} /><GroupsList groups={groups} lang={lang} /></Panel>
              <Panel><SocialLinks lang={lang} /></Panel>
            </div>
          )}

          {tab === 'events' && (
            <Panel>
              <PanelHead title={lang === 'sw' ? 'Ratiba' : 'Schedule'} action={lang === 'sw' ? 'Zote →' : 'See all →'} actionHref="/dashboard/events" />
              <EventsList events={upcomingEvents} lang={lang} loading={loading} />
            </Panel>
          )}
        </div>
      </div>

      {/* ── DESKTOP banner (above grid) ── */}
      <div className="desktop-banner">
        {loading
          ? <div style={{ height: 260, background: T.navy, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner /></div>
          : <AnnouncementsBanner announcements={announcements} lang={lang} />
        }
      </div>

      {/* ── DESKTOP two-column grid ── */}
      <div className="member-desktop" style={{ display: 'none' }}>

        {/* Left: videos + events */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Panel>
            <PanelHead title={lang === 'sw' ? 'Hivi Karibuni' : 'Latest Videos'} action={lang === 'sw' ? 'Zote →' : 'See all →'} />
            <div className="vid-grid">
              {videos.slice(0, 6).map((v, i) => {
                const total    = Math.min(videos.length, 6);
                const isBottom = i >= total - 2;
                const isRight  = i % 2 === 1;
                return (
                  <a key={v.id} href={v.url} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'block', textDecoration: 'none', borderRight: isRight ? 'none' : `1px solid ${T.borderLight}`, borderBottom: isBottom ? 'none' : `1px solid ${T.borderLight}` }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                  >
                    <div style={{ position: 'relative', aspectRatio: '16/9', background: T.navy, overflow: 'hidden' }}>
                      {v.thumbnail
                        ? <img src={v.thumbnail} alt={v.title} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="24" height="24" viewBox="0 0 24 24" fill="rgba(255,255,255,0.2)"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z"/></svg></div>
                      }
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '65%', background: 'linear-gradient(to top, rgba(10,18,34,.95) 0%, transparent 100%)', pointerEvents: 'none' }} />
                      {v.duration && <span style={{ position: 'absolute', bottom: 28, right: 6, background: 'rgba(0,0,0,.78)', color: '#fff', fontSize: 8, fontWeight: 700, borderRadius: 3, padding: '1px 4px', fontVariantNumeric: 'tabular-nums' }}>{parseDuration(v.duration)}</span>}
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 8px 7px' }}>
                        <p style={{ fontSize: 10, fontWeight: 600, color: '#fff', lineHeight: 1.3, margin: '0 0 2px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{v.title}</p>
                        {v.viewCount != null && <span style={{ fontSize: 8, color: 'rgba(255,255,255,.5)', fontVariantNumeric: 'tabular-nums' }}>{fmtViews(v.viewCount)} {lang === 'sw' ? 'maoni' : 'views'}</span>}
                      </div>
                    </div>
                  </a>
                );
              })}
              {!videos.length && <div style={{ gridColumn: '1/-1', padding: '32px 16px', textAlign: 'center', fontSize: 12, color: T.inkMuted }}>{lang === 'sw' ? 'Hakuna video' : 'No videos yet'}</div>}
            </div>
          </Panel>

          <Panel>
            <PanelHead title={lang === 'sw' ? 'Ratiba' : 'Upcoming Events'} action={lang === 'sw' ? 'Zote →' : 'See all →'} actionHref="/dashboard/events" />
            <EventsList events={upcomingEvents} lang={lang} loading={loading} />
          </Panel>
        </div>

        {/* Right: pledges + announcements + groups + social */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          <Panel>
            <PanelHead title={lang === 'sw' ? 'Ahadi Zangu' : 'My Pledges'} action={lang === 'sw' ? 'Zote →' : 'All →'} actionHref="/dashboard/pledges" />
            {loading
              ? <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}><Spinner /></div>
              : !activePledges.length
                ? <EmptyState text={lang === 'sw' ? 'Huna ahadi zilizosajiliwa' : 'No pledges registered yet'} />
                : activePledges.map((p, i) => <MemberPledgeRow key={p.id ?? i} p={p} lang={lang} isLast={i === activePledges.length - 1} />)
            }
          </Panel>

          <Panel>
            <PanelHead title={lang === 'sw' ? 'Matangazo' : 'Announcements'} />
            {loading
              ? <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}><Spinner /></div>
              : !announcements.length
                ? <EmptyState text={lang === 'sw' ? 'Hakuna matangazo' : 'No announcements'} />
                : <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 16px' }}>
                    {announcements.map(a => <AnnouncementCard key={a.id} a={a} lang={lang} t={t} />)}
                  </div>
            }
          </Panel>

          <Panel>
            <PanelHead title={lang === 'sw' ? 'Vikundi' : 'Groups'} action={lang === 'sw' ? 'Zote →' : 'All →'} actionHref="/dashboard/groups" />
            <GroupsList groups={groups} lang={lang} />
          </Panel>

          <Panel><SocialLinks lang={lang} /></Panel>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ELEVATED DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
const ROLE_GREETINGS = {
  en: { pastor: 'Pastor', elder: 'Elder', group_leader: 'Leader', katibu: 'Secretary', mweka_hazina: 'Treasurer', member: 'Welcome' },
  sw: { pastor: 'Mchungaji', elder: 'Mzee', group_leader: 'Kiongozi', katibu: 'Katibu', mweka_hazina: 'Mweka Hazina', member: 'Karibu' },
};

function ElevatedDashboard({ user, lang, t, stats, announcements, projects, resolutions, campaigns, pendingPayments, loading }) {
  const greeting  = ROLE_GREETINGS[lang]?.[user.role] ?? (lang === 'sw' ? 'Karibu' : 'Welcome');
  const firstName = user.full_name?.split(' ')[0] ?? '';
  const [activeTab, setActiveTab] = useState('projects');
  const now = new Date();

  const pledgeTotals = aggregatePledges(campaigns);

  // KPI cells — admin sees member counts, finance sees pledge figures
  const kpiCells = [
    ...(isAdmin(user.role) && stats ? [
      { label: lang === 'sw' ? 'Jumla ya Washrika' : 'Total Members', value: stats.totalMembers ?? '—', sub: `${stats.youth ?? 0} ${lang === 'sw' ? 'vijana' : 'youth'}`, primary: true, pct: Math.min(100, (stats.totalMembers ?? 0) / 10) },
      { label: lang === 'sw' ? 'Makundi' : 'Groups', value: stats.totalGroups ?? '—' },
    ] : []),
    ...(isFinance(user.role) ? [
      { label: lang === 'sw' ? 'Jumla Iliyoahidiwa' : 'Total Pledged',     value: fmtMoney(pledgeTotals.totalPledged),  primary: !isAdmin(user.role) },
      { label: lang === 'sw' ? 'Imethibitishwa' : 'Confirmed Paid',        value: fmtMoney(pledgeTotals.confirmedPaid), sub: pledgeTotals.totalPledged ? `${Math.round((pledgeTotals.confirmedPaid / pledgeTotals.totalPledged) * 100)}% ${lang === 'sw' ? 'ya lengo' : 'of target'}` : undefined, subColor: T.success },
      { label: lang === 'sw' ? 'Iliyobaki' : 'Balance Due',                value: fmtMoney(pledgeTotals.balanceDue),    subColor: T.danger },
      { label: lang === 'sw' ? 'Zinazosubiri Idhini' : 'Pending Approval', value: pledgeTotals.pendingCount, sub: pledgeTotals.pendingAmount ? fmtMoney(pledgeTotals.pendingAmount) : undefined, subColor: T.warning },
    ] : []),
    ...(isAdmin(user.role) && stats ? [
      { label: lang === 'sw' ? 'Miradi' : 'Projects',             value: stats.activeProjects ?? '—' },
      { label: lang === 'sw' ? 'Maamuzi Wazi' : 'Open Resolutions', value: resolutions.length },
    ] : []),
  ].filter(Boolean);

  const tabs = [
    { key: 'projects',      label: lang === 'sw' ? 'Miradi' : 'Projects' },
    { key: 'resolutions',   label: lang === 'sw' ? 'Maamuzi' : 'Resolutions' },
    { key: 'pledges',       label: lang === 'sw' ? 'Ahadi' : 'Pledges', badge: pledgeTotals.pendingCount || null },
    { key: 'announcements', label: lang === 'sw' ? 'Matangazo' : 'Announcements' },
  ];

  return (
    <div style={{ background: T.page, minHeight: '100%' }}>
      <style>{`
        @keyframes kkkt-spin { to { transform: rotate(360deg); } }
        .elevated-grid { display: flex; flex-direction: column; gap: 24px; }
        @media (min-width: 1024px) {
          .elevated-grid { display: grid; grid-template-columns: minmax(0,1.6fr) 320px; gap: 24px; }
        }
        @media (max-width: 900px) {
          .kpi-responsive { grid-template-columns: repeat(2,1fr) !important; }
        }
      `}</style>

      <PageHeader
        eyebrow={lang === 'sw' ? 'Dashibodi' : 'Dashboard'}
        title={`${greeting}, ${firstName}`}
        subtitle={now.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + ' · ' + (lang === 'sw' ? 'Muhtasari wa mwaka hadi sasa' : 'Year-to-date overview')}
      />

      {kpiCells.length > 0 && <KpiStrip cells={kpiCells} />}

      {/* Member breakdown sub-strip (admin only) */}
      {isAdmin(user.role) && stats && (
        <div style={{ background: T.card, borderBottom: `1px solid ${T.border}`, display: 'grid', gridTemplateColumns: 'repeat(6,1fr)' }} className="kpi-responsive">
          {[
            { label: lang === 'sw' ? 'Wanaume'  : 'Men',       value: stats.men      ?? '—' },
            { label: lang === 'sw' ? 'Wanawake' : 'Women',     value: stats.women    ?? '—' },
            { label: lang === 'sw' ? 'Vijana'   : 'Youth',     value: stats.youth    ?? '—' },
            { label: lang === 'sw' ? 'Watoto'   : 'Children',  value: stats.children ?? '—' },
            { label: lang === 'sw' ? 'Wazee'    : 'Elders',    value: stats.elders   ?? '—' },
            { label: lang === 'sw' ? 'Mikataba' : 'Contracts', value: stats.activeContracts ?? '—' },
          ].map((c, i) => (
            <div key={i} style={{ padding: '0.875rem 1.25rem', borderRight: i < 5 ? `1px solid ${T.border}` : 'none' }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.inkMuted, marginBottom: 4 }}>{c.label}</div>
              <div style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', color: T.ink, fontVariantNumeric: 'tabular-nums' }}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Pending payments alert bar */}
      {pledgeTotals.pendingCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.75rem 2.5rem', background: T.warningBg, borderBottom: '1px solid #FDE68A' }}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke={T.warning} strokeWidth="1.6" strokeLinecap="round"><circle cx="7.5" cy="7.5" r="6"/><path d="M7.5 4.5v3.5"/><circle cx="7.5" cy="10.5" r="0.5" fill={T.warning} stroke="none"/></svg>
          <span style={{ fontSize: 13, color: '#78350F', flex: 1 }}>
            <strong>{pledgeTotals.pendingCount} {lang === 'sw' ? 'malipo ya ahadi' : 'pledge payments'}</strong> {lang === 'sw' ? 'yanasubiri uthibitisho —' : 'awaiting confirmation —'} {fmtMoney(pledgeTotals.pendingAmount)} {lang === 'sw' ? 'jumla' : 'total'}
          </span>
          <button onClick={() => setActiveTab('pledges')} style={{ fontSize: 12, fontWeight: 700, color: '#92400E', background: 'rgba(245,158,11,.18)', border: 'none', padding: '4px 10px', borderRadius: 5, cursor: 'pointer' }}>
            {lang === 'sw' ? 'Kagua →' : 'Review →'}
          </button>
        </div>
      )}

      <div style={{ padding: '1.5rem 2.5rem' }}>
        <div className="elevated-grid">

          {/* ── Left: tabbed panel ── */}
          <Panel>
            {/* Tab bar */}
            <div style={{ display: 'flex', gap: 2, padding: '0.75rem 1.25rem 0', borderBottom: `1px solid ${T.border}` }}>
              {tabs.map(({ key, label, badge }) => {
                const active = activeTab === key;
                return (
                  <button key={key} onClick={() => setActiveTab(key)} style={{
                    position: 'relative', padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: active ? 600 : 500,
                    color: active ? T.goldDark : T.inkMuted,
                    borderBottom: active ? `2px solid ${T.gold}` : '2px solid transparent',
                    marginBottom: -1, borderRadius: '4px 4px 0 0', transition: 'color .12s',
                  }}>
                    {label}
                    {badge > 0 && (
                      <span style={{ position: 'absolute', top: 4, right: 2, minWidth: 16, height: 16, background: T.warning, color: '#fff', borderRadius: 99, fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tab: Projects */}
            {activeTab === 'projects' && (
              loading
                ? <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}><Spinner /></div>
                : !projects.length
                  ? <EmptyState text={lang === 'sw' ? 'Hakuna miradi inayoendelea' : 'No active projects'} />
                  : projects.map((p, i) => {
                      const pct = p.progress ?? 0;
                      return (
                        <div key={p.id} style={{ padding: '1rem 1.25rem', borderBottom: i < projects.length - 1 ? `1px solid ${T.borderLight}` : 'none' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 6 }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{p.name}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: T.inkSub, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{pct}%</span>
                          </div>
                          <ProgressBar pct={pct} />
                          {p.contractor && <p style={{ fontSize: 11, color: T.inkMuted, marginTop: 5 }}>{p.contractor}</p>}
                        </div>
                      );
                    })
            )}

            {/* Tab: Resolutions */}
            {activeTab === 'resolutions' && (
              loading
                ? <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}><Spinner /></div>
                : !resolutions.length
                  ? <EmptyState text={lang === 'sw' ? 'Hakuna maamuzi yanayosubiri' : 'No pending resolutions'} />
                  : resolutions.map((r, i) => {
                      const dl       = r.deadline ? new Date(r.deadline) : null;
                      const daysLeft = dl ? Math.round((dl - now) / 86400000) : null;
                      return (
                        <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '0.875rem 1.25rem', borderBottom: i < resolutions.length - 1 ? `1px solid ${T.borderLight}` : 'none' }}>
                          <span style={{ marginTop: 5, width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: r.status === 'overdue' ? T.danger : T.gold }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: T.ink, lineHeight: 1.4 }}>{r.title}</p>
                            <p style={{ fontSize: 11, color: T.inkMuted, marginTop: 2 }}>
                              {new Date(r.meeting_date ?? r.created_at).toLocaleDateString()}
                              {r.responsible && <> · {r.responsible}</>}
                            </p>
                          </div>
                          {r.deadline && (
                            <span style={{
                              fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 4, flexShrink: 0,
                              background: r.status === 'overdue' ? T.dangerBg : (daysLeft < 30 ? T.warningBg : T.successBg),
                              color: r.status === 'overdue' ? T.danger : (daysLeft < 30 ? T.warning : T.success),
                            }}>
                              {new Date(r.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                        </div>
                      );
                    })
            )}

            {/* Tab: Pledges */}
            {activeTab === 'pledges' && (
              <div>
                {/* Active campaign progress */}
                {campaigns.length > 0 && (
                  <div style={{ borderBottom: `1px solid ${T.border}` }}>
                    <div style={{ padding: '10px 1.25rem 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.inkMuted }}>
                        {lang === 'sw' ? 'Kampeni za Ahadi' : 'Pledge Campaigns'}
                      </span>
                      <Link href="/dashboard/pledges" style={{ fontSize: 11, fontWeight: 600, color: T.goldDark, textDecoration: 'none' }}>
                        {lang === 'sw' ? 'Zote →' : 'All →'}
                      </Link>
                    </div>
                    {campaigns.filter(c => c.is_active || c.status === 'active').slice(0, 3).map((c, i, arr) => (
                      <div key={c.id ?? i} style={{ borderBottom: i < arr.length - 1 ? `1px solid ${T.borderLight}` : 'none' }}>
                        <CampaignRow c={c} lang={lang} showPending />
                      </div>
                    ))}
                  </div>
                )}

                {/* Pending payments queue */}
                <div style={{ padding: '10px 1.25rem 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.inkMuted }}>
                    {lang === 'sw' ? 'Malipo Yanayosubiri Idhini' : 'Payments Awaiting Confirmation'}
                  </span>
                  {pledgeTotals.pendingCount > 0 && <Badge variant="warning">{pledgeTotals.pendingCount}</Badge>}
                </div>
                {loading
                  ? <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}><Spinner /></div>
                  : !pendingPayments.length
                    ? <EmptyState text={lang === 'sw' ? 'Hakuna malipo yanayosubiri idhini' : 'No payments awaiting confirmation'} />
                    : pendingPayments.map((p, i) => <PendingPaymentRow key={p.id ?? i} p={p} lang={lang} isLast={i === pendingPayments.length - 1} />)
                }
              </div>
            )}

            {/* Tab: Announcements */}
            {activeTab === 'announcements' && (
              <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {loading
                  ? <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}><Spinner /></div>
                  : !announcements.length
                    ? <EmptyState text={lang === 'sw' ? 'Hakuna matangazo' : 'No announcements'} />
                    : announcements.map(a => <AnnouncementCard key={a.id} a={a} lang={lang} t={t} />)
                }
              </div>
            )}
          </Panel>

          {/* ── Right: pledge campaigns + glance + quick links ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Active campaigns sidebar (finance roles) */}
            {isFinance(user.role) && (
              <Panel>
                <PanelHead title={lang === 'sw' ? 'Hali ya Ahadi' : 'Pledge Status'} action={lang === 'sw' ? 'Zote →' : 'All →'} actionHref="/dashboard/pledges" />
                {loading
                  ? <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}><Spinner /></div>
                  : !campaigns.length
                    ? <EmptyState text={lang === 'sw' ? 'Hakuna kampeni' : 'No campaigns'} />
                    : campaigns.filter(c => c.is_active || c.status === 'active').map((c, i, arr) => (
                        <div key={c.id ?? i} style={{ borderBottom: i < arr.length - 1 ? `1px solid ${T.borderLight}` : 'none' }}>
                          <CampaignRow c={c} lang={lang} showPending />
                        </div>
                      ))
                }
              </Panel>
            )}

            {/* At a glance */}
            <Panel>
              <PanelHead title={lang === 'sw' ? 'Hali ya Jumla' : 'At a Glance'} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                {[
                  { label: lang === 'sw' ? 'Matangazo' : 'Announcements', value: announcements.length },
                  { label: lang === 'sw' ? 'Miradi'    : 'Projects',      value: projects.length },
                  { label: lang === 'sw' ? 'Maamuzi'   : 'Resolutions',   value: resolutions.length },
                  { label: lang === 'sw' ? 'Kampeni'   : 'Campaigns',     value: campaigns.length },
                ].map((c, i) => (
                  <div key={i} style={{ padding: '1rem 1.25rem', borderRight: i % 2 === 0 ? `1px solid ${T.borderLight}` : 'none', borderBottom: i < 2 ? `1px solid ${T.borderLight}` : 'none' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.inkMuted, marginBottom: 4 }}>{c.label}</div>
                    <div style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em', color: T.ink, fontVariantNumeric: 'tabular-nums' }}>{c.value}</div>
                  </div>
                ))}
              </div>
            </Panel>

            {/* Quick links */}
            <Panel>
              <PanelHead title={lang === 'sw' ? 'Viungo vya Haraka' : 'Quick Links'} />
              {[
                { href: '/dashboard/members',      label: lang === 'sw' ? 'Washarika'  : 'Members' },
                { href: '/dashboard/pledges',       label: lang === 'sw' ? 'Ahadi'      : 'Pledges' },
                { href: '/dashboard/groups',        label: lang === 'sw' ? 'Makundi'    : 'Groups' },
                { href: '/dashboard/events',        label: lang === 'sw' ? 'Matukio'    : 'Events' },
                { href: '/dashboard/announcements', label: lang === 'sw' ? 'Matangazo'  : 'Announcements' },
              ].map(({ href, label }, i, arr) => (
                <div key={href}>
                  <Link href={href}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 20px', textDecoration: 'none', color: T.ink, fontSize: 13, fontWeight: 500 }}
                    onMouseEnter={e => e.currentTarget.style.background = T.page}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {label}
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke={T.border} strokeWidth="1.5" strokeLinecap="round"><path d="M4.5 2.5L8 6l-3.5 3.5"/></svg>
                  </Link>
                  {i < arr.length - 1 && <div style={{ height: 1, background: T.borderLight }} />}
                </div>
              ))}
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function DashboardPage() {
  const { user, lang } = useAuth();
  const { t }          = useTranslation(lang);

  const [stats,           setStats]           = useState(null);
  const [announcements,   setAnnouncements]   = useState([]);
  const [videos,          setVideos]          = useState([]);
  const [groups,          setGroups]          = useState([]);
  const [upcomingEvents,  setUpcomingEvents]  = useState([]);
  const [projects,        setProjects]        = useState([]);
  const [resolutions,     setResolutions]     = useState([]);
  // Pledge state
  const [campaigns,       setCampaigns]       = useState([]);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [memberPledges,   setMemberPledges]   = useState([]);
  const [loading,         setLoading]         = useState(true);

  const memberView = isMember(user.role);

  useEffect(() => {
    const none = Promise.resolve(null);

    const load = async () => {
      const calls = [
        /* 0 */ announcementApi.getAll(),
        /* 1 */ isFinance(user.role)      ? userApi.getStats()                                : none,
        /* 2 */ isLeader(user.role)       ? api.get('/projects?status=active&limit=4')        : none,
        /* 3 */ isLeader(user.role)       ? api.get('/resolutions?status=pending&limit=5')    : none,
        /* 4 */ memberView                ? api.get('/youtube/dashboard')                     : none,
        /* 5 */ memberView                ? groupApi.getAll()                                 : none,
        /* 6 */ memberView                ? eventApi.getAll()                                 : none,
        /* 7 */ canSeePledges(user.role)  ? pledgeApi.getCampaigns()                          : none,
        /* 8 */ canSeePledges(user.role)  ? pledgeApi.getPendingPayments({ limit: 50 })       : none,
        /* 9 */ memberView                ? pledgeApi.getMemberPledges(user.id)               : none,
      ];

      const all = await Promise.allSettled(calls);
      const get = i => all[i]?.status === 'fulfilled' && all[i].value != null ? all[i].value : null;

      const ann  = get(0); if (ann)  setAnnouncements((ann.data?.data   || []).slice(0, memberView ? 5 : 6));
      const st   = get(1); if (st)   setStats(st.data?.data);
      const proj = get(2); if (proj) setProjects(proj.data?.data  || []);
      const res  = get(3); if (res)  setResolutions(res.data?.data || []);
      const yt   = get(4); if (yt)   setVideos((yt.data?.data?.latestVideos ?? []).slice(0, 6));
      const grp  = get(5); if (grp)  setGroups(grp.data?.data || []);
      const evts = get(6); if (evts) setUpcomingEvents(evts.data?.data || []);

      const camp = get(7);
      if (camp) {
        const rows = camp.data?.data ?? camp.data ?? [];
        setCampaigns(Array.isArray(rows) ? rows : []);
      }

      const ppay = get(8);
      if (ppay) {
        const rows = ppay.data?.data ?? ppay.data ?? [];
        setPendingPayments(Array.isArray(rows) ? rows : []);
      }

      const mpl = get(9);
      if (mpl) {
        const rows = mpl.data?.data ?? mpl.data ?? [];
        setMemberPledges(Array.isArray(rows) ? rows : []);
      }

      setLoading(false);
    };

    load();
  }, [user.id, user.role, memberView]);

  if (memberView) {
    return (
      <MemberDashboard
        user={user} lang={lang} t={t}
        announcements={announcements}
        videos={videos}
        groups={groups}
        upcomingEvents={upcomingEvents}
        memberPledges={memberPledges}
        loading={loading}
      />
    );
  }

  return (
    <ElevatedDashboard
      user={user} lang={lang} t={t}
      stats={stats}
      announcements={announcements}
      projects={projects}
      resolutions={resolutions}
      campaigns={campaigns}
      pendingPayments={pendingPayments}
      loading={loading}
    />
  );
}