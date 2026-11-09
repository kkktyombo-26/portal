'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../lib/i18n';
import { userApi, announcementApi, groupApi, eventApi } from '../../lib/api';
import api from '../../lib/api';
import StatCard from '../../components/ui/StatCard';
import RoleBadge from '../../components/ui/RoleBadge';

// ─── Role greeting labels ─────────────────────────────────────────────────────
const ROLE_GREETINGS = {
  en: { pastor: 'Pastor', elder: 'Elder', group_leader: 'Leader', katibu: 'Secretary', mweka_hazina: 'Treasurer', member: 'Welcome' },
  sw: { pastor: 'Mchungaji', elder: 'Mzee', group_leader: 'Kiongozi', katibu: 'Katibu', mweka_hazina: 'Mweka Hazina', member: 'Karibu' },
};

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h);
  return `${hour % 12 || 12}:${m} ${hour < 12 ? 'AM' : 'PM'}`;
}

// ─── Events tab panel (mobile dashboard) ─────────────────────────────────────
const MONTHS_ABBR = {
  en: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
  sw: ['Jan','Feb','Mac','Apr','Mei','Jun','Jul','Ago','Sep','Okt','Nov','Des'],
};
function EventsTabPanel({ events, lang, loading }) {
  if (loading) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center' }}>
        <span style={{ fontSize: 12, color: '#AEADB3' }}>…</span>
      </div>
    );
  }
  if (!events || !events.length) {
    return (
      <div style={{ padding: '40px 16px', textAlign: 'center', fontSize: 12, color: '#AEADB3' }}>
        {lang === 'sw' ? 'Hakuna matukio yanayokuja' : 'No upcoming events'}
      </div>
    );
  }
  return (
    <div style={{ padding: '16px' }}>
      <div style={{ border: '1px solid #EBEBEC', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px 10px' }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A8A8E' }}>
            {lang === 'sw' ? 'Ratiba' : 'Schedule'}
          </span>
          <Link href="/dashboard/events" style={{ fontSize: 10, fontWeight: 600, color: '#C8A84B', textDecoration: 'none' }}>
            {lang === 'sw' ? 'Zote →' : 'See all →'}
          </Link>
        </div>
        <div style={{ height: 1, background: '#EBEBEC' }} />
        {events.slice(0, 5).map((ev, i) => {
          const dateStr = ev.event_date?.split('T')[0] || ev.event_date;
          const d       = new Date(dateStr + 'T00:00:00');
          const title   = lang === 'sw' ? ev.title_sw : ev.title_en;
          const isLast  = i === Math.min(events.length, 5) - 1;
          return (
            <div key={ev.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
                <div style={{
                  flexShrink: 0, width: 40, textAlign: 'center',
                  background: '#F0F4FB', borderRadius: 8, padding: '6px 4px',
                }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#0F1F3D', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                    {String(d.getDate()).padStart(2, '0')}
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6B6B70', marginTop: 2 }}>
                    {MONTHS_ABBR[lang][d.getMonth()]}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1E', lineHeight: 1.3, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {title}
                  </p>
                  {(ev.start_time || ev.location) && (
                    <p style={{ fontSize: 11, color: '#8A8A8E' }}>
                      {ev.start_time && formatTime(ev.start_time)}
                      {ev.start_time && ev.location && ' · '}
                      {ev.location}
                    </p>
                  )}
                </div>
              </div>
              {!isLast && <div style={{ height: 1, background: '#F0F0F2', marginLeft: 66 }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Permission helpers ───────────────────────────────────────────────────────
const isAdmin   = r => ['pastor', 'katibu'].includes(r);
const isFinance = r => ['pastor', 'katibu', 'mweka_hazina'].includes(r);
const isLeader  = r => ['pastor', 'katibu', 'elder', 'group_leader'].includes(r);
const isMember  = r => !isAdmin(r) && !isFinance(r) && !isLeader(r);

// ─── YouTube helpers ──────────────────────────────────────────────────────────
function parseDuration(iso) {
  if (!iso) return '';
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return '';
  const h = +(m[1] || 0), mn = +(m[2] || 0), s = +(m[3] || 0);
  return h
    ? `${h}:${String(mn).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${mn}:${String(s).padStart(2, '0')}`;
}
function fmtViews(n) {
  if (n == null) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

// ─── Social links config ──────────────────────────────────────────────────────
const SOCIAL = [
  {
    key: 'fb',
    href: 'https://web.facebook.com/profile.php?id=61579436296006',
    label: 'Facebook',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
  },
  {
    key: 'ig',
    href: 'https://www.instagram.com/kkktyombo',
    label: 'Instagram',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
      </svg>
    ),
  },
  {
    key: 'yt',
    href: 'https://www.youtube.com/@KKKTDMPYOMBO',
    label: 'YouTube',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13">
        <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z"/>
      </svg>
    ),
  },
];

const GROUP_ICONS = {
  choir: '♫', youth: '◎', elders: '◈',
  women: '♀', men: '♂', children: '◉', other: '◇',
};

// ─── Announcement banner (auto-rotating) ─────────────────────────────────────
function AnnouncementsBanner({ announcements, lang }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (announcements.length < 2) return;
    const t = setInterval(() => setActive(a => (a + 1) % announcements.length), 5500);
    return () => clearInterval(t);
  }, [announcements.length]);

  if (!announcements.length) {
    return (
      <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F0F0F2' }}>
        <span style={{ fontSize: 11, color: '#AEADB3', letterSpacing: '0.04em' }}>
          {lang === 'sw' ? 'Hakuna matangazo' : 'No announcements'}
        </span>
      </div>
    );
  }

  const ev    = announcements[active];
  const title = lang === 'sw' ? ev.title_sw : ev.title_en;
  const body  = lang === 'sw' ? ev.body_sw  : ev.body_en;

  return (
    <div style={{ position: 'relative', background: '#0F1F3D', overflow: 'hidden', userSelect: 'none', minHeight: 260 }}>

      {/* Full-bleed background image */}
      {ev.image_url && (
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url(${ev.image_url})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          transition: 'opacity 0.6s ease',
          opacity: 1,
        }} />
      )}

      {/* Deep gradient scrim — text always readable */}
      <div style={{
        position: 'absolute', inset: 0,
        background: ev.image_url
          ? 'linear-gradient(to top, rgba(8,16,34,0.96) 0%, rgba(8,16,34,0.55) 50%, rgba(8,16,34,0.20) 100%)'
          : 'linear-gradient(135deg, #0F1F3D 0%, #1B3660 100%)',
        pointerEvents: 'none',
      }} />

      {/* Gold top-edge accent line */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(to right, #C8A84B, transparent)' }} />

      {/* Content — pinned to bottom */}
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', minHeight: 260, padding: '0 28px 24px' }}>

        {/* Label pill */}
        <div style={{ marginBottom: 12 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: 'rgba(200,168,75,0.15)', border: '1px solid rgba(200,168,75,0.35)',
            borderRadius: 20, padding: '3px 10px',
            fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#C8A84B',
          }}>
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#C8A84B', display: 'inline-block' }} />
            {lang === 'sw' ? 'Tangazo' : 'Announcement'}
          </span>
        </div>

        {/* Title */}
        <p key={ev.id + 't'} style={{
          fontSize: 20, fontWeight: 700, color: '#fff',
          lineHeight: 1.25, letterSpacing: '-0.01em', marginBottom: 8,
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {title}
        </p>

        {/* Body */}
        <p key={ev.id + 'b'} style={{
          fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.65, marginBottom: 16,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {body}
        </p>

        {/* Meta row + dots */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontVariantNumeric: 'tabular-nums' }}>
              {new Date(ev.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            {ev.author_name && (
              <>
                <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{ev.author_name}</span>
              </>
            )}
          </div>

          {/* Dot indicators */}
          {announcements.length > 1 && (
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              {announcements.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  style={{
                    width: i === active ? 20 : 4, height: 4, borderRadius: 99,
                    border: 'none', cursor: 'pointer', padding: 0,
                    background: i === active ? '#C8A84B' : 'rgba(255,255,255,0.25)',
                    transition: 'width 0.3s ease, background 0.3s ease',
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── YouTube carousel ─────────────────────────────────────────────────────────
function YouTubeCarousel({ videos, lang }) {
  const [active, setActive]   = useState(0);
  const scrollRef = useRef(null);
  const autoRef   = useRef(null);
  const dragRef   = useRef(null);

  const scrollTo = useCallback((idx) => {
    const el = scrollRef.current;
    if (!el || !videos.length) return;
    el.scrollTo({ left: (el.scrollWidth / videos.length) * idx, behavior: 'smooth' });
  }, [videos.length]);

  const resetAuto = useCallback(() => {
    if (autoRef.current) clearInterval(autoRef.current);
    if (videos.length < 2) return;
    autoRef.current = setInterval(() => {
      setActive(a => {
        const next = (a + 1) % videos.length;
        const el = scrollRef.current;
        if (el) el.scrollTo({ left: (el.scrollWidth / videos.length) * next, behavior: 'smooth' });
        return next;
      });
    }, 4000);
  }, [videos.length]);

  useEffect(() => { resetAuto(); return () => { if (autoRef.current) clearInterval(autoRef.current); }; }, [resetAuto]);

  const goTo = (idx) => { setActive(idx); scrollTo(idx); resetAuto(); };

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el || !videos.length) return;
    setActive(Math.max(0, Math.min(Math.round(el.scrollLeft / (el.scrollWidth / videos.length)), videos.length - 1)));
  };

  if (!videos.length) return null;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: '#8A8A8E',
          }}>
            {lang === 'sw' ? 'Hivi Karibuni' : 'Latest Videos'}
          </span>
          {videos.length > 1 && (
            <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
              {videos.map((_, i) => (
                <button key={i} onClick={() => goTo(i)} style={{
                  width: i === active ? 14 : 4, height: 4, borderRadius: 99,
                  border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0,
                  background: i === active ? '#0F1F3D' : '#D5D5D8',
                  transition: 'width 0.25s ease, background 0.25s ease',
                }} />
              ))}
            </div>
          )}
        </div>
        <a
          href="https://www.youtube.com/@KKKTDMPYOMBO"
          target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 10, fontWeight: 600, color: '#C8A84B', textDecoration: 'none' }}
        >
          {lang === 'sw' ? 'Zote →' : 'See all →'}
        </a>
      </div>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        onMouseDown={e => { dragRef.current = e.clientX; }}
        onMouseUp={e => {
          if (dragRef.current === null) return;
          const dx = e.clientX - dragRef.current;
          dragRef.current = null;
          if (Math.abs(dx) < 40) return;
          goTo(dx < 0 ? Math.min(active + 1, videos.length - 1) : Math.max(active - 1, 0));
        }}
        style={{
          display: 'flex', overflowX: 'auto', overflowY: 'hidden',
          scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none', msOverflowStyle: 'none', cursor: 'grab',
        }}
      >
        {videos.map((v, idx) => (
          <a
            key={v.id}
            href={v.url}
            target="_blank" rel="noopener noreferrer"
            onClick={e => { if (dragRef.current !== null) e.preventDefault(); }}
            style={{
              flex: '0 0 82%', scrollSnapAlign: 'start', display: 'block',
              textDecoration: 'none',
              borderRight: idx < videos.length - 1 ? '1px solid #EBEBEC' : 'none',
            }}
          >
            <div style={{ position: 'relative', aspectRatio: '16/9', background: '#0F1F3D', overflow: 'hidden' }}>
              {v.thumbnail ? (
                <img src={v.thumbnail} alt={v.title} draggable={false}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="rgba(255,255,255,0.2)">
                    <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z"/>
                  </svg>
                </div>
              )}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%',
                background: 'linear-gradient(to top, rgba(10,18,34,0.95) 0%, transparent 100%)',
                pointerEvents: 'none',
              }} />
              {v.duration && (
                <span style={{
                  position: 'absolute', bottom: 34, right: 8,
                  background: 'rgba(0,0,0,0.78)', color: '#fff',
                  fontSize: 9, fontWeight: 700, borderRadius: 3,
                  padding: '2px 5px', letterSpacing: '0.03em', fontVariantNumeric: 'tabular-nums',
                }}>
                  {parseDuration(v.duration)}
                </span>
              )}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 10px 9px' }}>
                <p style={{
                  fontSize: 11, fontWeight: 600, color: '#fff', lineHeight: 1.35, margin: '0 0 4px',
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  {v.title}
                </p>
                {v.viewCount != null && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="#FF0000">
                      <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z"/>
                    </svg>
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtViews(v.viewCount)} {lang === 'sw' ? 'maoni' : 'views'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── Groups list ──────────────────────────────────────────────────────────────
function GroupsList({ groups, lang, compact = false }) {
  if (!groups.length) return (
    <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12, color: '#AEADB3' }}>
      {lang === 'sw' ? 'Hakuna vikundi' : 'No groups'}
    </div>
  );
  return (
    <div style={{ padding: '0 0 4px' }}>
      {!compact && (
        <div style={{ padding: '14px 20px 8px' }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A8A8E' }}>
            {lang === 'sw' ? 'Vikundi' : 'Groups'}
          </span>
        </div>
      )}
      {groups.slice(0, 5).map((g, i) => (
        <div key={g.id}>
          <Link
            href={`/dashboard/groups/${g.id}`}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', textDecoration: 'none', transition: 'background 0.1s' }}
            onMouseEnter={e => e.currentTarget.style.background = '#F5F5F6'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <span style={{
              width: 28, height: 28, borderRadius: 6, flexShrink: 0,
              background: '#F0F0F2', border: '1px solid #E5E5E8',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, color: '#8A8A8E',
            }}>
              {GROUP_ICONS[g.type] || '◇'}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: 13, fontWeight: 500, color: '#1A1A1E', lineHeight: 1, marginBottom: 2,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {lang === 'sw' ? (g.name_sw || g.name) : g.name}
              </p>
              <p style={{ fontSize: 11, color: '#AEADB3' }}>
                {g.member_count} {lang === 'sw' ? 'washarika' : 'members'}
              </p>
            </div>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#C5C5C8" strokeWidth="1.5" strokeLinecap="round">
              <path d="M4.5 2.5L8 6l-3.5 3.5"/>
            </svg>
          </Link>
          {i < Math.min(groups.length, 5) - 1 && (
            <div style={{ height: 1, background: '#F0F0F2', marginLeft: 60 }} />
          )}
        </div>
      ))}
      {groups.length > 5 && (
        <Link
          href="/dashboard/groups"
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', textDecoration: 'none', transition: 'background 0.1s' }}
          onMouseEnter={e => e.currentTarget.style.background = '#F5F5F6'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <span style={{
            width: 28, height: 28, borderRadius: 6, flexShrink: 0,
            background: '#F0F0F2', border: '1px dashed #D5D5D8',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, color: '#AEADB3',
          }}>
            ···
          </span>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#6B6B70' }}>
            {lang === 'sw' ? `Vikundi vyote (${groups.length})` : `All groups (${groups.length})`}
          </span>
        </Link>
      )}
    </div>
  );
}

// ─── Social row ───────────────────────────────────────────────────────────────
function SocialRow({ lang }) {
  return (
    <div style={{ padding: '12px 20px 20px' }}>
      <div style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A8A8E' }}>
          {lang === 'sw' ? 'Mitandao' : 'Follow us'}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {SOCIAL.map(({ key, href, label, icon }) => (
          <a
            key={key} href={href} target="_blank" rel="noopener noreferrer" title={label}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: 8,
              background: '#F0F0F2', border: '1px solid #E5E5E8',
              color: '#6B6B70', textDecoration: 'none',
              transition: 'background 0.12s, border-color 0.12s, color 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#1A1A1E'; e.currentTarget.style.borderColor = '#1A1A1E'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#F0F0F2'; e.currentTarget.style.borderColor = '#E5E5E8'; e.currentTarget.style.color = '#6B6B70'; }}
          >
            {icon}
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── Divider ──────────────────────────────────────────────────────────────────
const Divider = () => <div style={{ height: 1, background: '#EBEBEC' }} />;

// ─── Shared content blocks (used in both mobile tabs and desktop grid) ────────

function VideosBlock({ videos, lang }) {
  return (
    <div style={{ border: '1px solid #EBEBEC', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px' }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A8A8E' }}>
          {lang === 'sw' ? 'Hivi Karibuni' : 'Latest Videos'}
        </span>
        <a href="https://www.youtube.com/@KKKTDMPYOMBO" target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 10, fontWeight: 600, color: '#C8A84B', textDecoration: 'none' }}>
          {lang === 'sw' ? 'Zote →' : 'See all →'}
        </a>
      </div>
      <Divider />
      {/* mobile: 1 col | desktop: 2 col — controlled by .video-inner-grid */}
      <div className="video-inner-grid">
        {videos.slice(0, 6).map((v, idx) => (
          <VideoThumb key={v.id} v={v} lang={lang} idx={idx} total={Math.min(videos.length, 6)} />
        ))}
        {!videos.length && (
          <div style={{ gridColumn: '1/-1', padding: '32px 16px', textAlign: 'center', fontSize: 12, color: '#AEADB3' }}>
            {lang === 'sw' ? 'Hakuna video' : 'No videos yet'}
          </div>
        )}
      </div>
    </div>
  );
}

function GroupsSocialBlock({ groups, lang }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Groups */}
      <div style={{ border: '1px solid #EBEBEC', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px 10px' }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A8A8E' }}>
            {lang === 'sw' ? 'Vikundi' : 'Groups'}
          </span>
        </div>
        <Divider />
        <GroupsList groups={groups} lang={lang} compact />
      </div>
      {/* Social */}
      <div style={{ border: '1px solid #EBEBEC', borderRadius: 10, overflow: 'hidden', padding: '14px 16px 16px' }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A8A8E', display: 'block', marginBottom: 10 }}>
          {lang === 'sw' ? 'Mitandao' : 'Follow us'}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          {SOCIAL.map(({ key, href, label, icon }) => (
            <a key={key} href={href} target="_blank" rel="noopener noreferrer" title={label}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: '#F0F0F2', border: '1px solid #E5E5E8', color: '#6B6B70', textDecoration: 'none', transition: 'background 0.12s, border-color 0.12s, color 0.12s' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#1A1A1E'; e.currentTarget.style.borderColor = '#1A1A1E'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#F0F0F2'; e.currentTarget.style.borderColor = '#E5E5E8'; e.currentTarget.style.color = '#6B6B70'; }}>
              {icon}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Mobile tab bar ───────────────────────────────────────────────────────────
function MobileTabs({ tab, setTab, lang }) {
  const tabs = [
    { key: 'announcements', label: lang === 'sw' ? 'Matangazo' : 'Announcements' },
    { key: 'videos',        label: lang === 'sw' ? 'YouTube'   : 'YouTube'       },
    { key: 'groups',        label: lang === 'sw' ? 'Vikundi'   : 'Groups'        },
    { key: 'events',        label: lang === 'sw' ? 'Ratiba'    : 'Schedule'      },
  ];
  return (
    <div style={{
      display: 'flex', borderBottom: '1px solid #EBEBEC',
      overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none',
    }}>
      {tabs.map(({ key, label }) => {
        const active = tab === key;
        return (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              flex: '1 0 auto',
              padding: '12px 16px',
              fontSize: 12, fontWeight: active ? 700 : 500,
              color: active ? '#1A1A1E' : '#8A8A8E',
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: active ? '2px solid #C8A84B' : '2px solid transparent',
              marginBottom: -1,
              letterSpacing: active ? '-0.01em' : '0',
              transition: 'color 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Announcements tab content (mobile) — stacked cards, single column ────────
function AnnouncementsTabList({ announcements, lang, t }) {
  if (!announcements.length) {
    return (
      <div style={{ padding: '40px 16px', textAlign: 'center', fontSize: 12, color: '#AEADB3' }}>
        {lang === 'sw' ? 'Hakuna matangazo' : 'No announcements'}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '16px' }}>
      {announcements.map((a) => {
        const title    = lang === 'sw' ? a.title_sw : a.title_en;
        const body     = lang === 'sw' ? a.body_sw  : a.body_en;
        const isChurch = a.scope === 'church';
        return (
          <div key={a.id} style={{ position: 'relative', background: '#1B2F50', borderRadius: 10, overflow: 'hidden' }}>
            {a.image_url && (
              <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${a.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.25, pointerEvents: 'none' }} />
            )}
            <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 2, background: isChurch ? '#C8A84B' : '#5B8AD4' }} />
            <div style={{ padding: '14px 16px 14px 20px', position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: isChurch ? '#C8A84B' : '#5B8AD4' }}>
                  {isChurch ? (lang === 'sw' ? 'Kanisa Lote' : 'Church-wide') : (a.group_name || (lang === 'sw' ? 'Kikundi' : 'Group'))}
                </span>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontVariantNumeric: 'tabular-nums' }}>
                  {new Date(a.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                </span>
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#fff', lineHeight: 1.35, marginBottom: 4 }}>{title}</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, marginBottom: a.author_name ? 8 : 0, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{body}</p>
              {a.author_name && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>{t('posted_by')} {a.author_name}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Member dashboard — tabbed mobile + grid desktop ─────────────────────────
function MemberDashboard({ user, lang, t, announcements, videos, groups, upcomingEvents, loading }) {
  const firstName        = user.full_name?.split(' ')[0] ?? '';
  const [tab, setTab]    = useState('announcements');

  return (
    <div style={{ padding: '0 0 40px' }}>

      <style>{`
        /* ── Video inner grid: 1-col mobile, 2-col desktop ── */
        .video-inner-grid {
          display: grid;
          grid-template-columns: 1fr;
        }
        /* ── Tab bar: shown mobile only ── */
        .member-tabs  { display: block; }
        .member-tab-panel { display: block; }
        /* ── Desktop grid ── */
        .member-grid  { display: none; }
        .member-greeting { padding: 20px 16px 18px; }

        @media (min-width: 900px) {
          .video-inner-grid { grid-template-columns: 1fr 1fr; }
          .member-tabs      { display: none !important; }
          .member-tab-panel { display: none !important; }
          .member-grid {
            display: grid;
            grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
            gap: 24px;
            padding: 24px 32px 0;
            align-items: start;
          }
          .member-greeting { padding: 24px 32px 20px; }
        }

        /* VideoThumb — full-width on mobile means last item IS bottom */
        @media (max-width: 899px) {
          .video-inner-grid > a:last-child { border-bottom: none !important; }
          .video-inner-grid > a            { border-right: none !important; }
        }
      `}</style>

      {/* ── Greeting ──────────────────────────────────────────────────────────── */}
      <div className="member-greeting" style={{
        borderBottom: '1px solid #EBEBEC',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A8A8E', marginBottom: 4 }}>
            {lang === 'sw' ? 'Dashibodi' : 'Dashboard'}
          </p>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: '#1A1A1E', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            {lang === 'sw' ? `Karibu, ${firstName}` : `Welcome, ${firstName}`}
          </h1>
        </div>
        {user.group_name && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <RoleBadge role={user.role} lang={lang} />
            <span style={{ fontSize: 11, color: '#8A8A8E' }}>{user.group_name}</span>
          </div>
        )}
      </div>

      {/* ══════════════ MOBILE LAYOUT ══════════════ */}

      {/* Banner — always full-bleed on mobile, hidden on desktop (desktop shows it in grid context via AnnouncementsBanner in tab) */}
      <div className="member-tabs" style={{ /* wrapper so we can hide the whole mobile block */ }}>
        {/* Hero banner — shown above tabs always on mobile */}
        {loading ? (
          <div style={{ height: 240, background: '#F0F0F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid #DDDDE0', borderTopColor: '#8A8A8E', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : (
          <AnnouncementsBanner announcements={announcements} lang={lang} />
        )}

        {/* Tab bar */}
        <MobileTabs tab={tab} setTab={setTab} lang={lang} />

        {/* Tab panels */}
        <div className="member-tab-panel">
          {tab === 'announcements' && (
            loading
              ? <div style={{ padding: '32px 16px', textAlign: 'center' }}><span style={{ fontSize: 12, color: '#AEADB3' }}>…</span></div>
              : <AnnouncementsTabList announcements={announcements} lang={lang} t={t} />
          )}
          {tab === 'videos' && (
            <div style={{ padding: '16px' }}>
              <div style={{ border: '1px solid #EBEBEC', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px 10px' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A8A8E' }}>
                    {lang === 'sw' ? 'Hivi Karibuni' : 'Latest Videos'}
                  </span>
                  <a href="https://www.youtube.com/@KKKTDMPYOMBO" target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 10, fontWeight: 600, color: '#C8A84B', textDecoration: 'none' }}>
                    {lang === 'sw' ? 'Zote →' : 'See all →'}
                  </a>
                </div>
                <Divider />
                {/* Single-column video list on mobile */}
                <div>
                  {videos.slice(0, 6).map((v, idx) => (
                    <VideoThumb key={v.id} v={v} lang={lang} idx={idx} total={Math.min(videos.length, 6)} forceSingle />
                  ))}
                  {!videos.length && (
                    <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 12, color: '#AEADB3' }}>
                      {lang === 'sw' ? 'Hakuna video' : 'No videos yet'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          {tab === 'groups' && (
            <div style={{ padding: '16px' }}>
              <GroupsSocialBlock groups={groups} lang={lang} />
            </div>
          )}
          {tab === 'events' && (
            <EventsTabPanel events={upcomingEvents} lang={lang} loading={loading} />
          )}
        </div>
      </div>

      {/* ══════════════ DESKTOP LAYOUT ══════════════ */}

      {/* Full-bleed banner on desktop too */}
      <div className="member-grid" style={{ display: 'none' /* overridden by media query */ }}>
        {/* This div is a placeholder — actual desktop banner is below the grid wrapper */}
      </div>

      {/* Desktop banner — edge to edge, above the grid */}
      <div style={{ /* shown only on desktop via inner style tag trick */ }}>
        <style>{`
          .desktop-banner { display: none; }
          @media (min-width: 900px) { .desktop-banner { display: block; } }
        `}</style>
        <div className="desktop-banner">
          {loading ? (
            <div style={{ height: 260, background: '#F0F0F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid #DDDDE0', borderTopColor: '#8A8A8E', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : (
            <AnnouncementsBanner announcements={announcements} lang={lang} />
          )}
        </div>
      </div>

      {/* Desktop two-column grid */}
      <div className="member-grid">
        <VideosBlock videos={videos} lang={lang} />
        <GroupsSocialBlock groups={groups} lang={lang} />
      </div>

    </div>
  );
}

// ─── Video thumbnail — grid cell ──────────────────────────────────────────────
function VideoThumb({ v, lang, idx, total, forceSingle = false }) {
  const isBottom = forceSingle ? idx === total - 1 : idx >= total - 2;
  const isRight  = forceSingle ? true               : idx % 2 === 1;

  return (
    <a
      href={v.url}
      target="_blank" rel="noopener noreferrer"
      style={{
        display: 'block', textDecoration: 'none', position: 'relative',
        borderRight:  isRight  ? 'none' : '1px solid #EBEBEC',
        borderBottom: isBottom ? 'none' : '1px solid #EBEBEC',
      }}
      onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
      onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
    >
      {/* Thumbnail */}
      <div style={{ position: 'relative', aspectRatio: '16/9', background: '#0F1F3D', overflow: 'hidden' }}>
        {v.thumbnail ? (
          <img src={v.thumbnail} alt={v.title} draggable={false}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="rgba(255,255,255,0.2)">
              <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z"/>
            </svg>
          </div>
        )}
        {/* Gradient + overlay info */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '65%', background: 'linear-gradient(to top, rgba(10,18,34,0.95) 0%, transparent 100%)', pointerEvents: 'none' }} />
        {v.duration && (
          <span style={{ position: 'absolute', bottom: 28, right: 6, background: 'rgba(0,0,0,0.78)', color: '#fff', fontSize: 8, fontWeight: 700, borderRadius: 3, padding: '1px 4px', fontVariantNumeric: 'tabular-nums' }}>
            {parseDuration(v.duration)}
          </span>
        )}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 8px 7px' }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: '#fff', lineHeight: 1.3, margin: '0 0 2px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {v.title}
          </p>
          {v.viewCount != null && (
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', fontVariantNumeric: 'tabular-nums' }}>
              {fmtViews(v.viewCount)} {lang === 'sw' ? 'maoni' : 'views'}
            </span>
          )}
        </div>
      </div>
    </a>
  );
}

// ─── Elevated dashboard (admin / finance / leader) ────────────────────────────
// Unchanged stat sections — just no PageHeader.
function ElevatedDashboard({ user, lang, t, stats, announcements, projects, resolutions, loading }) {
  const greeting  = ROLE_GREETINGS[lang]?.[user.role] ?? (lang === 'sw' ? 'Karibu' : 'Welcome');
  const firstName = user.full_name?.split(' ')[0] ?? '';

  return (
    <div>
      {/* Compact greeting — no PageHeader component */}
      <div style={{
        padding: '24px 32px 20px',
        borderBottom: '1px solid var(--border)',
      }}>
        <p className="section-label" style={{ marginBottom: 4 }}>
          {lang === 'sw' ? 'Dashibodi' : 'Dashboard'}
        </p>
        <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', lineHeight: 1.2 }}>
          {greeting}, {firstName}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 4 }}>
          {lang === 'sw' ? 'Hii ndiyo muhtasari wako wa leo' : "Here's your overview for today"}
        </p>
      </div>

      <div className="px-8 py-8 max-w-content space-y-10">

        {/* Member breakdown */}
        {isAdmin(user.role) && stats && (
          <section>
            <p className="section-label mb-3">{lang === 'sw' ? 'Washarika' : 'Members'}</p>
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
              <StatCard label={lang === 'sw' ? 'Jumla'    : 'Total'}    value={stats.totalMembers ?? '—'} index={0} />
              <StatCard label={lang === 'sw' ? 'Watoto'   : 'Children'} value={stats.children    ?? '—'} index={1} />
              <StatCard label={lang === 'sw' ? 'Vijana'   : 'Youth'}    value={stats.youth       ?? '—'} index={2} />
              <StatCard label={lang === 'sw' ? 'Wanawake' : 'Women'}    value={stats.women       ?? '—'} index={3} />
              <StatCard label={lang === 'sw' ? 'Wanaume'  : 'Men'}      value={stats.men         ?? '—'} index={4} />
              <StatCard label={lang === 'sw' ? 'Wazee'    : 'Elders'}   value={stats.elders      ?? '—'} index={5} />
            </div>
          </section>
        )}

        {/* Operations */}
        {isAdmin(user.role) && stats && (
          <section>
            <p className="section-label mb-3">{lang === 'sw' ? 'Shughuli' : 'Operations'}</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label={lang === 'sw' ? 'Vikundi'   : 'Groups'}        value={stats.totalGroups         ?? '—'} index={0} />
              <StatCard label={lang === 'sw' ? 'Miradi'    : 'Projects'}      value={stats.activeProjects      ?? '—'} index={1} />
              <StatCard label={lang === 'sw' ? 'Mikataba'  : 'Contracts'}     value={stats.activeContracts     ?? '—'} index={2} />
              <StatCard label={lang === 'sw' ? 'Matangazo' : 'Announcements'} value={stats.recentAnnouncements ?? '—'} index={3} />
            </div>
          </section>
        )}

        {/* Finance & Assets */}
        {isFinance(user.role) && stats && (
          <section>
            <p className="section-label mb-3">{lang === 'sw' ? 'Fedha & Mali' : 'Finance & Assets'}</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label={lang === 'sw' ? 'Mapato (Mwezi)' : 'Income (Month)'} value={stats.monthlyIncome ?? '—'} index={0} />
              <StatCard label={lang === 'sw' ? 'Uwakili'        : 'Contributions'}  value={stats.totalUwakili ?? '—'} index={1} />
              <StatCard label={lang === 'sw' ? 'Mali'           : 'Assets'}         value={stats.totalAssets  ?? '—'} index={2} />
              <StatCard label={lang === 'sw' ? 'Vitega Uchumi'  : 'Investments'}    value={stats.investments  ?? '—'} index={3} />
            </div>
          </section>
        )}

        {/* Pending Resolutions */}
        {isLeader(user.role) && resolutions.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <p className="section-label">{lang === 'sw' ? 'Maazimio Yanayosubiri' : 'Pending Resolutions'}</p>
              <span className="text-xs font-mono text-ink-faint">{resolutions.length}</span>
            </div>
            <div className="rounded-lg overflow-hidden border border-border">
              {resolutions.map((r, i) => (
                <div key={r.id}>
                  <div className="py-3 px-4 flex items-start gap-3">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-amber-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink leading-snug">{r.title}</p>
                      <p className="text-xs text-ink-faint mt-0.5">
                        {new Date(r.meeting_date ?? r.created_at).toLocaleDateString()}
                        {r.responsible && <> · {r.responsible}</>}
                      </p>
                    </div>
                    {r.deadline && (
                      <span className="text-xs font-mono text-ink-faint flex-shrink-0">
                        {new Date(r.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                  {i < resolutions.length - 1 && <div className="hairline" />}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Active Projects */}
        {isLeader(user.role) && projects.length > 0 && (
          <section>
            <p className="section-label mb-4">{lang === 'sw' ? 'Miradi Inayoendelea' : 'Active Projects'}</p>
            <div className="rounded-lg overflow-hidden border border-border">
              {projects.map((p, i) => (
                <div key={p.id}>
                  <div className="py-3 px-4">
                    <div className="flex items-center justify-between gap-4 mb-1.5">
                      <p className="text-sm font-medium text-ink truncate">{p.name}</p>
                      <span className="text-xs font-mono text-ink-faint flex-shrink-0">{p.progress ?? 0}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-border overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${p.progress ?? 0}%`,
                          background:
                            (p.progress ?? 0) >= 75 ? '#22c55e' :
                            (p.progress ?? 0) >= 40 ? '#C8A84B' : '#1B2F50',
                        }}
                      />
                    </div>
                    {p.contractor && <p className="text-xs text-ink-faint mt-1">{p.contractor}</p>}
                  </div>
                  {i < projects.length - 1 && <div className="hairline" />}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Announcements */}
        <section>
          <p className="section-label mb-4">{t('announcements')}</p>
          {loading ? (
            <div className="py-12 flex justify-center">
              <span className="w-5 h-5 border-2 border-border border-t-ink-muted rounded-full animate-spin" />
            </div>
          ) : announcements.length === 0 ? (
            <div className="py-12 text-center text-ink-muted text-sm">{t('no_data')}</div>
          ) : (
            <div className="space-y-3">
              {announcements.map((a, i) => {
                const title    = lang === 'sw' ? a.title_sw : a.title_en;
                const body     = lang === 'sw' ? a.body_sw  : a.body_en;
                const isChurch = a.scope === 'church';
                return (
                  <div
                    key={a.id}
                    className={`animate-slide-up stagger-${Math.min(i + 1, 6)}`}
                    style={{ position: 'relative', background: '#1B2F50', borderRadius: 10, overflow: 'hidden' }}
                  >
                    {a.image_url && (
                      <div style={{
                        position: 'absolute', inset: 0,
                        backgroundImage: `url(${a.image_url})`,
                        backgroundSize: 'cover', backgroundPosition: 'center',
                        opacity: 0.25, pointerEvents: 'none',
                      }} />
                    )}
                    <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 2, background: isChurch ? '#C8A84B' : '#5B8AD4' }} />
                    <div style={{ padding: '14px 16px 14px 20px', position: 'relative' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: isChurch ? '#C8A84B' : '#5B8AD4' }}>
                          {isChurch ? (lang === 'sw' ? 'Kanisa Lote' : 'Church-wide') : (a.group_name || (lang === 'sw' ? 'Kikundi' : 'Group'))}
                        </span>
                        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontVariantNumeric: 'tabular-nums' }}>
                          {new Date(a.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                        </span>
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#fff', lineHeight: 1.35, marginBottom: 4 }}>{title}</p>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{body}</p>
                      {a.author_name && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>{t('posted_by')} {a.author_name}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, lang } = useAuth();
  const { t }          = useTranslation(lang);

  const [stats,         setStats]         = useState(null);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [videos,        setVideos]        = useState([]);
  const [groups,        setGroups]        = useState([]);
  const [projects,      setProjects]      = useState([]);
  const [resolutions,   setResolutions]   = useState([]);
  const [loading,       setLoading]       = useState(true);

  const memberView = isMember(user.role);

  useEffect(() => {
    const none = Promise.resolve(null);
    const load = async () => {
      const calls = [
        announcementApi.getAll(),                                                        // [0] always
        isFinance(user.role) ? userApi.getStats()                : none,                 // [1]
        isLeader(user.role)  ? api.get('/projects?status=active&limit=4')  : none,      // [2]
        isLeader(user.role)  ? api.get('/resolutions?status=pending&limit=5') : none,   // [3]
        memberView           ? api.get('/youtube/dashboard')     : none,                 // [4]
        memberView           ? groupApi.getAll()                 : none, 
        memberView ? eventApi.getAll() : none,                // [5]
      ];

      const all = await Promise.allSettled(calls);
      const get = i => all[i].status === 'fulfilled' && all[i].value != null ? all[i].value : null;

      const ann  = get(0); if (ann)  setAnnouncements((ann.data.data  || []).slice(0, memberView ? 5 : 6));
      const st   = get(1); if (st)   setStats(st.data.data);
      const proj = get(2); if (proj) setProjects(proj.data.data  || []);
      const res  = get(3); if (res)  setResolutions(res.data.data || []);
      const yt   = get(4); if (yt)   setVideos((yt.data?.data?.latestVideos ?? []).slice(0, 6));
      const grp  = get(5); if (grp)  setGroups(grp.data.data || []);

      setLoading(false);
    };
    load();
  }, [user, memberView]);

  if (memberView) {
    return (
      <MemberDashboard
        user={user}
        lang={lang}
        t={t}
        announcements={announcements}
        videos={videos}
        groups={groups}
        loading={loading}
      />
    );
  }

  return (
    <ElevatedDashboard
      user={user}
      lang={lang}
      t={t}
      stats={stats}
      announcements={announcements}
      projects={projects}
      resolutions={resolutions}
      loading={loading}
    />
  );
}