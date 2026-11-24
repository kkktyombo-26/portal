'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth }        from '../../hooks/useAuth';
import { useTranslation } from '../../lib/i18n';
import { userApi, announcementApi, groupApi, eventApi } from '../../lib/api';
import api                from '../../lib/api';
import { pledgeApi }      from '../../lib/pledgeApi';

/* ─── Styling policy ──────────────────────────────────────────────────────────
 * No local design tokens live in this file. Colour, type and component styling
 * come from globals.css — classes (.card, .badge, .tabs, .stat-value, …) and
 * CSS variables (var(--text-primary), var(--border-subtle), …). Inline styles
 * here are LAYOUT ONLY: grid, flex, spacing, aspect-ratio, positioning.
 *
 * If a colour is needed in JS (an SVG stroke, a conditional fill), reference
 * the variable — never a hex literal. A hex literal in this file is a bug: it
 * means the palette now has two sources of truth and they will drift.
 * ──────────────────────────────────────────────────────────────────────────── */

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

const CHEVRON = (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" style={{ color: 'var(--border-strong)', flexShrink: 0 }}>
    <path d="M4.5 2.5L8 6l-3.5 3.5"/>
  </svg>
);

// ─── Shared primitives ────────────────────────────────────────────────────────
// Thin wrappers over the design-system classes. They exist to keep markup
// terse, NOT to restyle anything — every visual decision stays in globals.css.

function Panel({ children, className = '', style }) {
  return <div className={`card prose-full ${className}`.trim()} style={style}>{children}</div>;
}

function PanelHead({ title, subtitle, action, onAction, actionHref }) {
  return (
    <div className="card-header">
      <div style={{ minWidth: 0 }}>
        <div className="card-title">{title}</div>
        {subtitle && <div className="card-subtitle">{subtitle}</div>}
      </div>
      {action && (
        actionHref
          ? <Link href={actionHref} className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }}>{action}</Link>
          : <button onClick={onAction} className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }}>{action}</button>
      )}
    </div>
  );
}

// Maps a semantic variant onto the .badge-* class it belongs to.
const BADGE_CLASS = {
  success: 'badge-success',
  warning: 'badge-warning',
  danger:  'badge-danger',
  gold:    'badge-gold',
  neutral: 'badge-neutral',
  navy:    'badge-navy',
  blue:    'badge-navy',   // no cool-blue in a two-colour system
};

function Badge({ children, variant = 'neutral' }) {
  return <span className={`badge ${BADGE_CLASS[variant] ?? 'badge-neutral'}`}>{children}</span>;
}

// .progress-fill is the accent fill; .navy and .success are its modifiers.
function ProgressBar({ pct, variant }) {
  const mod = variant ?? (pct >= 75 ? 'success' : pct >= 40 ? '' : 'navy');
  return (
    <div className="progress-bar">
      <div className={`progress-fill ${mod}`.trim()} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

function Spinner({ size = 18 }) {
  return (
    <span
      className="animate-spin"
      style={{
        display: 'inline-block', width: size, height: size, borderRadius: '50%',
        border: '2px solid var(--border-subtle)', borderTopColor: 'var(--text-tertiary)',
      }}
    />
  );
}

function Loading({ pad = 32 }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: `${pad}px 0` }}>
      <Spinner />
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="empty-state">
      <p className="empty-state-body">{text}</p>
    </div>
  );
}

// ─── KPI strip ────────────────────────────────────────────────────────────────
function KpiStrip({ cells }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${cells.length}, 1fr)`,
      background: 'var(--surface-card)',
      borderBottom: '1px solid var(--border-default)',
    }}>
      {cells.map((c, i) => (
        <div key={i} style={{
          padding: '1.25rem 1.5rem',
          borderRight: i < cells.length - 1 ? '1px solid var(--border-default)' : 'none',
          background: c.primary ? 'var(--navy-dark)' : 'var(--surface-card)',
          position: 'relative',
        }}>
          <div className="stat-label" style={c.primary ? { color: 'rgba(255,255,255,.5)' } : undefined}>
            {c.label}
          </div>
          <div className="stat-value font-display" style={{
            fontSize: 28, marginTop: 6, fontVariantNumeric: 'tabular-nums',
            ...(c.primary ? { color: 'var(--text-inverse)' } : null),
          }}>
            {c.value}
          </div>
          {c.sub && (
            <div className="stat-delta" style={{
              color: c.primary ? 'var(--gold-light)' : (c.subColor ?? 'var(--text-tertiary)'),
            }}>
              {c.sub}
            </div>
          )}
          {c.pct != null && (
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: 'var(--border-subtle)' }}>
              <div style={{ height: '100%', width: `${c.pct}%`, background: 'var(--gold)' }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Page header ──────────────────────────────────────────────────────────────
// .page-header supplies the plum ground, the grid texture (::before) and the
// gold rule (::after) — so none of that is rebuilt here.
function PageHeader({ eyebrow, title, subtitle, children }) {
  return (
    <div className="page-header">
      <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          {eyebrow  && <div className="page-header-eyebrow">{eyebrow}</div>}
          <h1 className="page-header-title">{title}</h1>
          {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
        </div>
        {children && <div className="page-header-actions" style={{ marginTop: 0, flexShrink: 0 }}>{children}</div>}
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
      <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--navy-dark)' }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,.3)' }}>{lang === 'sw' ? 'Hakuna matangazo' : 'No announcements'}</span>
      </div>
    );
  }

  const ev    = announcements[active];
  const title = lang === 'sw' ? ev.title_sw : ev.title_en;
  const body  = lang === 'sw' ? ev.body_sw  : ev.body_en;

  return (
    <div className="prose-full" style={{ position: 'relative', background: 'var(--navy-dark)', overflow: 'hidden', minHeight: 240, userSelect: 'none' }}>
      {ev.image_url && <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${ev.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />}
      <div style={{
        position: 'absolute', inset: 0,
        background: ev.image_url
          ? 'linear-gradient(to top, rgba(36,19,48,.97) 0%, rgba(36,19,48,.55) 50%, rgba(36,19,48,.18) 100%)'
          : 'linear-gradient(135deg, var(--navy-dark) 0%, var(--navy-mid) 100%)',
      }} />
      <div className="gold-bar-h" style={{ position: 'absolute', top: 0, left: 0, right: 0, borderRadius: 0 }} />
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', minHeight: 240, padding: '0 28px 24px' }}>
        <div>
          <span className="hero-tag">
            <span className="status-dot pending" style={{ width: 4, height: 4 }} />
            {lang === 'sw' ? 'Tangazo' : 'Announcement'}
          </span>
        </div>
        <p className="font-display" style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-inverse)', lineHeight: 1.25, letterSpacing: '-0.01em', marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{title}</p>
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
                <button key={i} onClick={() => setActive(i)} aria-label={`${i + 1}`} style={{
                  width: i === active ? 20 : 4, height: 4, borderRadius: 99, border: 'none', cursor: 'pointer', padding: 0,
                  background: i === active ? 'var(--gold)' : 'rgba(255,255,255,.25)',
                  transition: 'width .3s ease, background .3s ease',
                }} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Announcement card ────────────────────────────────────────────────────────
// .card-navy is the dark card variant; the scope rail is the only extra.
function AnnouncementCard({ a, lang, t }) {
  const title    = lang === 'sw' ? a.title_sw : a.title_en;
  const body     = lang === 'sw' ? a.body_sw  : a.body_en;
  const isChurch = a.scope === 'church';
  const rail     = isChurch ? 'var(--gold)' : 'var(--navy-light)';
  return (
    <div className="card card-navy prose-full" style={{ position: 'relative' }}>
      {a.image_url && <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${a.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.22, pointerEvents: 'none' }} />}
      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 2, background: rail }} />
      <div style={{ padding: '14px 16px 14px 20px', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: rail }}>
            {isChurch ? (lang === 'sw' ? 'Kanisa Lote' : 'Church-wide') : (a.group_name || (lang === 'sw' ? 'Kikundi' : 'Group'))}
          </span>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,.3)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
            {new Date(a.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
          </span>
        </div>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-inverse)', lineHeight: 1.35, marginBottom: 4 }}>{title}</p>
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
    <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{
            width: 34, height: 34, borderRadius: 8, flexShrink: 0,
            background: 'var(--navy-dark)', color: 'var(--gold)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 800,
          }}>
            {shortCode}
          </span>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
              {c.subscriber_count ?? c.member_count ?? '—'} {lang === 'sw' ? 'washrika' : 'members'}
              {c.end_date ? ` · ${lang === 'sw' ? 'Mwisho' : 'ends'} ${fmtDate(c.end_date)}` : ''}
            </p>
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div className="font-display" style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{pct}%</div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{fmtMoney(balance)} {lang === 'sw' ? 'iliyobaki' : 'remaining'}</div>
        </div>
      </div>
      <ProgressBar pct={pct} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          {lang === 'sw' ? 'Imethibitishwa' : 'Confirmed'}: <strong style={{ color: 'var(--text-primary)' }}>{fmtMoney(confirmed)}</strong>
        </span>
        {showPending && pending > 0 && (
          <span style={{ fontSize: 11, color: 'var(--warning)', fontWeight: 600 }}>
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.875rem 1.25rem', borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)' }}>
      <div style={{
        width: 48, height: 48, borderRadius: 10, flexShrink: 0,
        background: 'var(--warning-bg)', border: '1px solid var(--border-default)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--warning)', lineHeight: 1 }}>TShs</span>
        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--warning)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.3 }}>
          {Number(p.amount) >= 1000 ? (Number(p.amount) / 1000).toFixed(0) + 'K' : Number(p.amount).toLocaleString()}
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: 2 }}>{p.member_name ?? '—'}</p>
        <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          {p.campaign_name ?? '—'}
          {p.payment_method ? ` · ${p.payment_method}` : ''}
          {p.reference_number ? ` · ${p.reference_number}` : ''}
        </p>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{fmtDate(p.payment_date)}</span>
        {p.receipt_url && (
          <a href={p.receipt_url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', fontSize: 10, fontWeight: 600, marginTop: 2 }}>
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
    <div style={{ padding: '1rem 1.25rem', borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: 3 }}>{p.campaign_name ?? '—'}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Badge variant={statusVariant}>{statusLabel}</Badge>
            {pending > 0 && <Badge variant="warning">{fmtMoney(pending)} {lang === 'sw' ? 'inasubiri' : 'awaiting'}</Badge>}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{lang === 'sw' ? 'Ahadi' : 'Pledged'}</p>
          <p className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(pledged)}</p>
        </div>
      </div>
      <ProgressBar pct={pct} />
      <div style={{ display: 'flex', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          {lang === 'sw' ? 'Lililolipwa' : 'Paid'}: <strong style={{ color: 'var(--success)' }}>{fmtMoney(confirmed)}</strong>
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          {lang === 'sw' ? 'Iliyobaki' : 'Balance'}: <strong style={{ color: balance > 0 ? 'var(--danger)' : 'var(--success)' }}>{fmtMoney(balance)}</strong>
        </span>
        {p.next_installment_date && (
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            {lang === 'sw' ? 'Awamu ifuatayo' : 'Next'}: <strong style={{ color: 'var(--text-primary)' }}>{fmtDate(p.next_installment_date)}</strong>
          </span>
        )}
      </div>
    </div>
  );
}

// ─── YouTube video thumbnail ──────────────────────────────────────────────────
function VideoThumb({ v, lang, style }) {
  return (
    <a href={v.url} target="_blank" rel="noopener noreferrer" className="video-thumb" style={{ display: 'block', textDecoration: 'none', ...style }}>
      <div style={{ position: 'relative', aspectRatio: '16/9', background: 'var(--navy-dark)', overflow: 'hidden' }}>
        {v.thumbnail
          ? <img src={v.thumbnail} alt={v.title} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="rgba(255,255,255,0.2)"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z"/></svg>
            </div>
        }
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '65%', background: 'linear-gradient(to top, rgba(36,19,48,.95) 0%, transparent 100%)', pointerEvents: 'none' }} />
        {v.duration && <span className="font-mono" style={{ position: 'absolute', bottom: 28, right: 6, background: 'rgba(28,25,23,.78)', color: 'var(--text-inverse)', fontSize: 8, fontWeight: 700, borderRadius: 3, padding: '1px 4px', fontVariantNumeric: 'tabular-nums' }}>{parseDuration(v.duration)}</span>}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 8px 7px' }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-inverse)', lineHeight: 1.3, margin: '0 0 2px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{v.title}</p>
          {v.viewCount != null && <span style={{ fontSize: 8, color: 'rgba(255,255,255,.5)', fontVariantNumeric: 'tabular-nums' }}>{fmtViews(v.viewCount)} {lang === 'sw' ? 'maoni' : 'views'}</span>}
        </div>
      </div>
    </a>
  );
}

// ─── Events list ──────────────────────────────────────────────────────────────
function EventsList({ events, lang, loading }) {
  if (loading) return <Loading />;
  if (!events?.length) return <EmptyState text={lang === 'sw' ? 'Hakuna matukio yanayokuja' : 'No upcoming events'} />;
  return (
    <div>
      {events.slice(0, 5).map((ev, i) => {
        const dateStr = ev.event_date?.split('T')[0] || ev.event_date;
        const d       = new Date(dateStr + 'T00:00:00');
        const title   = lang === 'sw' ? ev.title_sw : ev.title_en;
        return (
          <div key={ev.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px' }}>
              <div style={{ flexShrink: 0, width: 42, textAlign: 'center', background: 'var(--surface-page)', borderRadius: 8, padding: '6px 4px' }}>
                <div className="font-display" style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                  {String(d.getDate()).padStart(2, '0')}
                </div>
                <div className="stat-label" style={{ fontSize: 9, marginTop: 2 }}>
                  {MONTHS_ABBR[lang][d.getMonth()]}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</p>
                {(ev.start_time || ev.location) && (
                  <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {ev.start_time && fmtTime(ev.start_time)}
                    {ev.start_time && ev.location && ' · '}
                    {ev.location}
                  </p>
                )}
              </div>
            </div>
            {i < Math.min(events.length, 5) - 1 && <hr className="divider" style={{ marginLeft: 74 }} />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Groups list ──────────────────────────────────────────────────────────────
// .menu-item carries its own hover — no JS mouse handlers needed.
function GroupsList({ groups, lang }) {
  if (!groups.length) return <EmptyState text={lang === 'sw' ? 'Hakuna vikundi' : 'No groups'} />;
  return (
    <div style={{ padding: '0.375rem' }}>
      {groups.slice(0, 5).map(g => (
        <Link key={g.id} href={`/dashboard/groups/${g.id}`} className="menu-item" style={{ gap: 12, padding: '10px 16px' }}>
          <span style={{
            width: 30, height: 30, borderRadius: 7, flexShrink: 0,
            background: 'var(--surface-page)', border: '1px solid var(--border-default)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, color: 'var(--text-tertiary)',
          }}>
            {GROUP_ICONS[g.type] || '◇'}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {lang === 'sw' ? (g.name_sw || g.name) : g.name}
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              {g.member_count} {lang === 'sw' ? 'washarika' : 'members'}
            </p>
          </div>
          {CHEVRON}
        </Link>
      ))}
      {groups.length > 5 && (
        <Link href="/dashboard/groups" className="menu-item" style={{ gap: 12, padding: '10px 16px' }}>
          <span style={{
            width: 30, height: 30, borderRadius: 7, flexShrink: 0,
            background: 'var(--surface-page)', border: '1px dashed var(--border-default)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, color: 'var(--text-tertiary)',
          }}>···</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
            {lang === 'sw' ? `Vikundi vyote (${groups.length})` : `All groups (${groups.length})`}
          </span>
        </Link>
      )}
    </div>
  );
}

// ─── Social links ─────────────────────────────────────────────────────────────
// .btn-secondary already defines the resting and hover states.
function SocialLinks({ lang }) {
  return (
    <div style={{ padding: '14px 20px 20px' }}>
      <p className="stat-label" style={{ marginBottom: 10 }}>
        {lang === 'sw' ? 'Mitandao' : 'Follow us'}
      </p>
      <div style={{ display: 'flex', gap: 6 }}>
        {SOCIAL.map(({ key, href, label, icon }) => (
          <a key={key} href={href} target="_blank" rel="noopener noreferrer" title={label}
            className="btn btn-secondary btn-icon btn-sm">
            {icon}
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── Mobile tab bar ───────────────────────────────────────────────────────────
function MobileTabs({ tab, setTab, tabs }) {
  return (
    <div className="tabs" style={{ overflowX: 'auto', scrollbarWidth: 'none' }}>
      {tabs.map(({ key, label }) => (
        <button key={key} onClick={() => setTab(key)}
          className={`tab ${tab === key ? 'active' : ''}`.trim()}
          style={{ flex: '1 0 auto', justifyContent: 'center' }}>
          {label}
        </button>
      ))}
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
  const videoCount    = Math.min(videos.length, 6);

  return (
    <div style={{ background: 'var(--surface-page)', minHeight: '100%' }}>
      {/* Layout-only rules. No colours, no type — those live in globals.css. */}
      <style>{`
        .member-mobile  { display: block; }
        .member-desktop { display: none; }
        .vid-grid       { display: grid; grid-template-columns: 1fr; }
        .desktop-banner { display: none; }
        .video-thumb:hover { opacity: .85; }
        @media (min-width: 900px) {
          .member-mobile  { display: none !important; }
          .member-desktop { display: grid !important; grid-template-columns: minmax(0,1.65fr) minmax(0,1fr); gap: 24px; padding: 24px 2.5rem 2.5rem; }
          .vid-grid       { grid-template-columns: 1fr 1fr; }
          .desktop-banner { display: block; }
        }
      `}</style>

      {/* Greeting bar */}
      <div style={{ background: 'var(--surface-card)', borderBottom: '1px solid var(--border-default)', padding: '20px 2.5rem 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <p className="stat-label" style={{ marginBottom: 4 }}>
            {lang === 'sw' ? 'Dashibodi' : 'Dashboard'}
          </p>
          <h2 className="font-display" style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2, color: 'var(--text-primary)' }}>
            {lang === 'sw' ? `Karibu, ${firstName}` : `Welcome, ${firstName}`}
          </h2>
        </div>
        {user.group_name && <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>{user.group_name}</span>}
      </div>

      {/* ── MOBILE layout ── */}
      <div className="member-mobile">
        {loading
          ? <div style={{ height: 240, background: 'var(--navy-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner /></div>
          : <AnnouncementsBanner announcements={announcements} lang={lang} />
        }
        <MobileTabs tab={tab} setTab={setTab} tabs={mobileTabs} />
        <div style={{ padding: '16px' }}>

          {tab === 'announcements' && (
            loading
              ? <Loading pad={40} />
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
                ? <Loading />
                : !activePledges.length
                  ? <EmptyState text={lang === 'sw' ? 'Huna ahadi zilizosajiliwa' : 'You have no registered pledges'} />
                  : activePledges.map((p, i) => <MemberPledgeRow key={p.id ?? i} p={p} lang={lang} isLast={i === activePledges.length - 1} />)
              }
            </Panel>
          )}

          {tab === 'videos' && (
            <Panel>
              <PanelHead title={lang === 'sw' ? 'Hivi Karibuni' : 'Latest Videos'} />
              {videos.slice(0, 6).map((v, i) => (
                <VideoThumb key={v.id} v={v} lang={lang}
                  style={{ borderBottom: i === videoCount - 1 ? 'none' : '1px solid var(--border-subtle)' }} />
              ))}
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
          ? <div style={{ height: 260, background: 'var(--navy-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner /></div>
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
              {videos.slice(0, 6).map((v, i) => (
                <VideoThumb key={v.id} v={v} lang={lang} style={{
                  borderRight:  i % 2 === 1            ? 'none' : '1px solid var(--border-subtle)',
                  borderBottom: i >= videoCount - 2    ? 'none' : '1px solid var(--border-subtle)',
                }} />
              ))}
              {!videos.length && (
                <div style={{ gridColumn: '1/-1' }}>
                  <EmptyState text={lang === 'sw' ? 'Hakuna video' : 'No videos yet'} />
                </div>
              )}
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
              ? <Loading />
              : !activePledges.length
                ? <EmptyState text={lang === 'sw' ? 'Huna ahadi zilizosajiliwa' : 'No pledges registered yet'} />
                : activePledges.map((p, i) => <MemberPledgeRow key={p.id ?? i} p={p} lang={lang} isLast={i === activePledges.length - 1} />)
            }
          </Panel>

          <Panel>
            <PanelHead title={lang === 'sw' ? 'Matangazo' : 'Announcements'} />
            {loading
              ? <Loading />
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
      { label: lang === 'sw' ? 'Imethibitishwa' : 'Confirmed Paid',        value: fmtMoney(pledgeTotals.confirmedPaid), sub: pledgeTotals.totalPledged ? `${Math.round((pledgeTotals.confirmedPaid / pledgeTotals.totalPledged) * 100)}% ${lang === 'sw' ? 'ya lengo' : 'of target'}` : undefined, subColor: 'var(--success)' },
      { label: lang === 'sw' ? 'Iliyobaki' : 'Balance Due',                value: fmtMoney(pledgeTotals.balanceDue),    subColor: 'var(--danger)' },
      { label: lang === 'sw' ? 'Zinazosubiri Idhini' : 'Pending Approval', value: pledgeTotals.pendingCount, sub: pledgeTotals.pendingAmount ? fmtMoney(pledgeTotals.pendingAmount) : undefined, subColor: 'var(--warning)' },
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
    <div style={{ background: 'var(--surface-page)', minHeight: '100%' }}>
      {/* Layout-only rules. */}
      <style>{`
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
        <div className="kpi-responsive" style={{ background: 'var(--surface-card)', borderBottom: '1px solid var(--border-default)', display: 'grid', gridTemplateColumns: 'repeat(6,1fr)' }}>
          {[
            { label: lang === 'sw' ? 'Wanaume'  : 'Men',       value: stats.men      ?? '—' },
            { label: lang === 'sw' ? 'Wanawake' : 'Women',     value: stats.women    ?? '—' },
            { label: lang === 'sw' ? 'Vijana'   : 'Youth',     value: stats.youth    ?? '—' },
            { label: lang === 'sw' ? 'Watoto'   : 'Children',  value: stats.children ?? '—' },
            { label: lang === 'sw' ? 'Wazee'    : 'Elders',    value: stats.elders   ?? '—' },
            { label: lang === 'sw' ? 'Mikataba' : 'Contracts', value: stats.activeContracts ?? '—' },
          ].map((c, i) => (
            <div key={i} style={{ padding: '0.875rem 1.25rem', borderRight: i < 5 ? '1px solid var(--border-default)' : 'none' }}>
              <div className="stat-label" style={{ marginBottom: 4 }}>{c.label}</div>
              <div className="stat-value font-display" style={{ fontSize: 22, marginTop: 0, fontVariantNumeric: 'tabular-nums' }}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ padding: '1.5rem 2.5rem' }}>

        {/* Pending payments alert — .banner is the system's inline alert */}
        {pledgeTotals.pendingCount > 0 && (
          <div className="banner banner-warning" style={{ marginBottom: '1.25rem', alignItems: 'center' }}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" style={{ flexShrink: 0 }}>
              <circle cx="7.5" cy="7.5" r="6"/><path d="M7.5 4.5v3.5"/><circle cx="7.5" cy="10.5" r="0.5" fill="currentColor" stroke="none"/>
            </svg>
            <span style={{ flex: 1 }}>
              <strong>{pledgeTotals.pendingCount} {lang === 'sw' ? 'malipo ya ahadi' : 'pledge payments'}</strong>{' '}
              {lang === 'sw' ? 'yanasubiri uthibitisho —' : 'awaiting confirmation —'} {fmtMoney(pledgeTotals.pendingAmount)} {lang === 'sw' ? 'jumla' : 'total'}
            </span>
            <button onClick={() => setActiveTab('pledges')} className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }}>
              {lang === 'sw' ? 'Kagua →' : 'Review →'}
            </button>
          </div>
        )}

        <div className="elevated-grid">

          {/* ── Left: tabbed panel ── */}
          <Panel>
            {/* Tab bar — .tabs / .tab / .tab.active */}
            <div className="tabs" style={{ padding: '0.75rem 1.25rem 0', overflowX: 'auto' }}>
              {tabs.map(({ key, label, badge }) => (
                <button key={key} onClick={() => setActiveTab(key)}
                  className={`tab ${activeTab === key ? 'active' : ''}`.trim()}
                  style={{ position: 'relative' }}>
                  {label}
                  {badge > 0 && (
                    <span style={{
                      position: 'absolute', top: 4, right: 2, minWidth: 16, height: 16,
                      background: 'var(--warning)', color: 'var(--text-inverse)', borderRadius: 99,
                      fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
                    }}>
                      {badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab: Projects */}
            {activeTab === 'projects' && (
              loading
                ? <Loading pad={48} />
                : !projects.length
                  ? <EmptyState text={lang === 'sw' ? 'Hakuna miradi inayoendelea' : 'No active projects'} />
                  : projects.map((p, i) => {
                      const pct = p.progress ?? 0;
                      return (
                        <div key={p.id} style={{ padding: '1rem 1.25rem', borderBottom: i < projects.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 6 }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{pct}%</span>
                          </div>
                          <ProgressBar pct={pct} />
                          {p.contractor && <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 5 }}>{p.contractor}</p>}
                        </div>
                      );
                    })
            )}

            {/* Tab: Resolutions */}
            {activeTab === 'resolutions' && (
              loading
                ? <Loading pad={48} />
                : !resolutions.length
                  ? <EmptyState text={lang === 'sw' ? 'Hakuna maamuzi yanayosubiri' : 'No pending resolutions'} />
                  : resolutions.map((r, i) => {
                      const dl        = r.deadline ? new Date(r.deadline) : null;
                      const daysLeft  = dl ? Math.round((dl - now) / 86400000) : null;
                      const isOverdue = r.status === 'overdue';
                      return (
                        <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '0.875rem 1.25rem', borderBottom: i < resolutions.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                          <span className={`status-dot ${isOverdue ? 'danger' : 'pending'}`} style={{ marginTop: 5 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>{r.title}</p>
                            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                              {new Date(r.meeting_date ?? r.created_at).toLocaleDateString()}
                              {r.responsible && <> · {r.responsible}</>}
                            </p>
                          </div>
                          {r.deadline && (
                            <Badge variant={isOverdue ? 'danger' : (daysLeft < 30 ? 'warning' : 'success')}>
                              {new Date(r.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                            </Badge>
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
                  <div style={{ borderBottom: '1px solid var(--border-default)' }}>
                    <div style={{ padding: '10px 1.25rem 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span className="stat-label">{lang === 'sw' ? 'Kampeni za Ahadi' : 'Pledge Campaigns'}</span>
                      <Link href="/dashboard/pledges" className="btn btn-ghost btn-sm">
                        {lang === 'sw' ? 'Zote →' : 'All →'}
                      </Link>
                    </div>
                    {campaigns.filter(c => c.is_active || c.status === 'active').slice(0, 3).map((c, i) => (
                      <CampaignRow key={c.id ?? i} c={c} lang={lang} showPending />
                    ))}
                  </div>
                )}

                {/* Pending payments queue */}
                <div style={{ padding: '10px 1.25rem 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span className="stat-label">{lang === 'sw' ? 'Malipo Yanayosubiri Idhini' : 'Payments Awaiting Confirmation'}</span>
                  {pledgeTotals.pendingCount > 0 && <Badge variant="warning">{pledgeTotals.pendingCount}</Badge>}
                </div>
                {loading
                  ? <Loading />
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
                  ? <Loading />
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
                  ? <Loading />
                  : !campaigns.length
                    ? <EmptyState text={lang === 'sw' ? 'Hakuna kampeni' : 'No campaigns'} />
                    : campaigns.filter(c => c.is_active || c.status === 'active').map((c, i) => (
                        <CampaignRow key={c.id ?? i} c={c} lang={lang} showPending />
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
                  <div key={i} style={{
                    padding: '1rem 1.25rem',
                    borderRight:  i % 2 === 0 ? '1px solid var(--border-subtle)' : 'none',
                    borderBottom: i < 2       ? '1px solid var(--border-subtle)' : 'none',
                  }}>
                    <div className="stat-label" style={{ marginBottom: 4 }}>{c.label}</div>
                    <div className="stat-value font-display" style={{ fontSize: 24, marginTop: 0, fontVariantNumeric: 'tabular-nums' }}>{c.value}</div>
                  </div>
                ))}
              </div>
            </Panel>

            {/* Quick links — .menu-item brings its own hover */}
            <Panel>
              <PanelHead title={lang === 'sw' ? 'Viungo vya Haraka' : 'Quick Links'} />
              <div style={{ padding: '0.375rem' }}>
                {[
                  { href: '/dashboard/members',       label: lang === 'sw' ? 'Washarika' : 'Members' },
                  { href: '/dashboard/pledges',       label: lang === 'sw' ? 'Ahadi'     : 'Pledges' },
                  { href: '/dashboard/groups',        label: lang === 'sw' ? 'Makundi'   : 'Groups' },
                  { href: '/dashboard/events',        label: lang === 'sw' ? 'Matukio'   : 'Events' },
                  { href: '/dashboard/announcements', label: lang === 'sw' ? 'Matangazo' : 'Announcements' },
                ].map(({ href, label }) => (
                  <Link key={href} href={href} className="menu-item" style={{ justifyContent: 'space-between', padding: '11px 16px', fontWeight: 500 }}>
                    {label}
                    {CHEVRON}
                  </Link>
                ))}
              </div>
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
        /* 2 */ isLeader(user.role)       ? api.get('/projects?limit=4')        : none,
        /* 3 */ isLeader(user.role)       ? api.get('/meetings/dashboard/open-resolutions')    : none,
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
      const proj = get(2); if (proj) setProjects(proj.data?.projects  || []);
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