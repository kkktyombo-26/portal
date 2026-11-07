'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { announcementApi, groupApi } from '../../lib/api';
import api from '../../lib/api';

// ─── YouTube helpers (mirrored from landing page) ─────────────────────────────
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
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

// ─── Data hooks ───────────────────────────────────────────────────────────────
function useAnnouncements() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    announcementApi.getAll()
      .then(r => setItems((r.data.data || []).slice(0, 5)))
      .catch(() => {});
  }, []);
  return items;
}

function useGroups() {
  const [groups, setGroups] = useState([]);
  useEffect(() => {
    groupApi.getAll()
      .then(r => setGroups(r.data.data || []))
      .catch(() => {});
  }, []);
  return groups;
}

function useYouTubeVideos() {
  const [videos, setVideos] = useState([]);
  useEffect(() => {
    api.get('/youtube/dashboard')
      .then(res => setVideos((res?.data?.data?.latestVideos ?? []).slice(0, 6)))
      .catch(() => {});
  }, []);
  return videos;
}

// ─── Announcements ─────────────────────────────────────────────────────────────
// Full-bleed, no horizontal padding — renders edge-to-edge inside the panel.
function AnnouncementsBanner({ lang }) {
  const events = useAnnouncements();
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (events.length < 2) return;
    const t = setInterval(() => setActive(a => (a + 1) % events.length), 5000);
    return () => clearInterval(t);
  }, [events.length]);

  if (!events.length) {
    return (
      <div style={{
        height: 72,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#F7F7F8',
        borderBottom: '1px solid #EBEBEC',
      }}>
        <span style={{ fontSize: 11, color: '#AEADB3', letterSpacing: '0.04em' }}>
          {lang === 'sw' ? 'Hakuna matukio' : 'No announcements'}
        </span>
      </div>
    );
  }

  const ev = events[active];
  const title = lang === 'sw' ? ev.title_sw : ev.title_en;
  const body  = lang === 'sw' ? ev.body_sw  : ev.body_en;

  return (
    <div style={{
      position: 'relative',
      background: '#1B2F50',
      overflow: 'hidden',
      userSelect: 'none',
    }}>
      {/* Background image if present — very low opacity */}
      {ev.image_url && (
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url(${ev.image_url})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          opacity: 0.35,
          pointerEvents: 'none',
        }} />
      )}

      {/* Left accent line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, bottom: 0,
        width: 2, background: '#C8A84B',
      }} />

      <div style={{ padding: '16px 20px 16px 22px', position: 'relative' }}>
        {/* Row 1: label + dots */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: '#C8A84B',
          }}>
            {lang === 'sw' ? 'Matangazo' : 'Announcements'}
          </span>

          {events.length > 1 && (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {events.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  style={{
                    width: i === active ? 16 : 4,
                    height: 4, borderRadius: 99, border: 'none', cursor: 'pointer',
                    background: i === active ? '#C8A84B' : 'rgba(255,255,255,0.2)',
                    padding: 0,
                    transition: 'width 0.25s ease, background 0.25s ease',
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Row 2: title */}
        <p key={ev.id + 't'} style={{
          fontSize: 13, fontWeight: 600, color: '#FFFFFF',
          lineHeight: 1.35, marginBottom: 4,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {title}
        </p>

        {/* Row 3: body */}
        <p key={ev.id + 'b'} style={{
          fontSize: 11, color: 'rgba(255,255,255,0.45)',
          lineHeight: 1.6, marginBottom: 10,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {body}
        </p>

        {/* Row 4: meta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontVariantNumeric: 'tabular-nums' }}>
            {new Date(ev.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </span>
          {ev.author_name && (
            <>
              <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 10 }}>·</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>{ev.author_name}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── YouTube mini-carousel ────────────────────────────────────────────────────
// Thumbnails bleed edge-to-edge. Auto-advances every 4 s; dots + drag supported.
function YouTubeCarousel({ lang }) {
  const videos   = useYouTubeVideos();
  const [active, setActive] = useState(0);
  const scrollRef = useRef(null);
  const autoRef   = useRef(null);
  const dragRef   = useRef(null);

  // Scroll the strip to the given index
  const scrollTo = useCallback((idx) => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.scrollWidth / videos.length;
    el.scrollTo({ left: cardWidth * idx, behavior: 'smooth' });
  }, [videos.length]);

  const resetAuto = useCallback(() => {
    if (autoRef.current) clearInterval(autoRef.current);
    if (videos.length < 2) return;
    autoRef.current = setInterval(() => {
      setActive(a => {
        const next = (a + 1) % videos.length;
        // scrollTo is captured by closure; call directly
        const el = scrollRef.current;
        if (el) {
          const cardWidth = el.scrollWidth / videos.length;
          el.scrollTo({ left: cardWidth * next, behavior: 'smooth' });
        }
        return next;
      });
    }, 4000);
  }, [videos.length]);

  useEffect(() => {
    resetAuto();
    return () => { if (autoRef.current) clearInterval(autoRef.current); };
  }, [resetAuto]);

  const goTo = (idx) => {
    setActive(idx);
    scrollTo(idx);
    resetAuto();
  };

  // Sync dot indicator when user scrolls manually
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el || !videos.length) return;
    const cardWidth = el.scrollWidth / videos.length;
    const idx = Math.round(el.scrollLeft / cardWidth);
    setActive(Math.max(0, Math.min(idx, videos.length - 1)));
  };

  // Drag / swipe to advance (mouse)
  const onMouseDown = (e) => { dragRef.current = e.clientX; };
  const onMouseUp   = (e) => {
    if (dragRef.current === null) return;
    const dx = e.clientX - dragRef.current;
    dragRef.current = null;
    if (Math.abs(dx) < 40) return;
    const next = dx < 0
      ? Math.min(active + 1, videos.length - 1)
      : Math.max(active - 1, 0);
    goTo(next);
  };

  if (!videos.length) return null;

  return (
    <div style={{ marginBottom: 0 }}>
      {/* Section label row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px 10px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: '#8A8A8E',
          }}>
            {lang === 'sw' ? 'Hivi Karibuni' : 'Latest Videos'}
          </span>
          {/* Dot indicators */}
          {videos.length > 1 && (
            <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
              {videos.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  style={{
                    width: i === active ? 14 : 4, height: 4,
                    borderRadius: 99, border: 'none', cursor: 'pointer', padding: 0,
                    background: i === active ? '#0F1F3D' : '#D5D5D8',
                    transition: 'width 0.25s ease, background 0.25s ease',
                    flexShrink: 0,
                  }}
                />
              ))}
            </div>
          )}
        </div>
        <a
          href="https://www.youtube.com/@KKKTDMPYOMBO"
          target="_blank" rel="noopener noreferrer"
          style={{
            fontSize: 10, fontWeight: 600, color: '#C8A84B',
            textDecoration: 'none', letterSpacing: '0.03em',
          }}
        >
          {lang === 'sw' ? 'Zote →' : 'See all →'}
        </a>
      </div>

      {/* Scrollable strip */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        style={{
          display: 'flex',
          overflowX: 'auto', overflowY: 'hidden',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          cursor: 'grab',
        }}
      >
        {videos.map((v, idx) => (
          <a
            key={v.id}
            href={v.url}
            target="_blank" rel="noopener noreferrer"
            style={{
              flex: '0 0 88%',
              scrollSnapAlign: 'start',
              display: 'block',
              textDecoration: 'none',
              borderRight: idx < videos.length - 1 ? '1px solid #EBEBEC' : 'none',
            }}
            // prevent drag from firing link navigation
            onClick={e => { if (dragRef.current !== null) e.preventDefault(); }}
          >
            {/* Thumbnail — full bleed */}
            <div style={{ position: 'relative', aspectRatio: '16/9', background: '#0F1F3D', overflow: 'hidden' }}>
              {v.thumbnail ? (
                <img
                  src={v.thumbnail}
                  alt={v.title}
                  draggable={false}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }}
                />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="rgba(255,255,255,0.2)">
                    <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z"/>
                  </svg>
                </div>
              )}

              {/* Gradient scrim */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%',
                background: 'linear-gradient(to top, rgba(10,18,34,0.95) 0%, transparent 100%)',
                pointerEvents: 'none',
              }} />

              {/* Duration pill — sits above the title */}
              {v.duration && (
                <span style={{
                  position: 'absolute', bottom: 34, right: 8,
                  background: 'rgba(0,0,0,0.78)', color: '#fff',
                  fontSize: 9, fontWeight: 700, borderRadius: 3,
                  padding: '2px 5px', letterSpacing: '0.03em',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {parseDuration(v.duration)}
                </span>
              )}

              {/* Title + views — both inside the image */}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 10px 9px' }}>
                <p style={{
                  fontSize: 11, fontWeight: 600, color: '#fff',
                  lineHeight: 1.35, margin: '0 0 4px',
                  display: '-webkit-box', WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical', overflow: 'hidden',
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
const GROUP_ICONS = {
  choir: '♫', youth: '◎', elders: '◈',
  women: '♀', men: '♂', children: '◉', other: '◇',
};

function GroupsList({ lang }) {
  const groups = useGroups();
  if (!groups.length) return null;

  return (
    <div style={{ padding: '0 0 4px' }}>
      <div style={{ padding: '14px 20px 8px' }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: '#8A8A8E',
        }}>
          {lang === 'sw' ? 'Vikundi' : 'Groups'}
        </span>
      </div>

      {groups.slice(0, 5).map((g, i) => (
        <div key={g.id}>
          <Link
            href={`/dashboard/groups/${g.id}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 20px',
              textDecoration: 'none',
              transition: 'background 0.1s',
            }}
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
                fontSize: 13, fontWeight: 500, color: '#1A1A1E',
                lineHeight: 1, marginBottom: 2,
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
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 20px', textDecoration: 'none',
            transition: 'background 0.1s',
          }}
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

// ─── Social links ─────────────────────────────────────────────────────────────
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

function SocialRow({ lang }) {
  return (
    <div style={{ padding: '12px 20px 16px' }}>
      <div style={{ marginBottom: 10 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: '#8A8A8E',
        }}>
          {lang === 'sw' ? 'Mitandao' : 'Follow us'}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {SOCIAL.map(({ key, href, label, icon }) => (
          <a
            key={key}
            href={href}
            target="_blank" rel="noopener noreferrer"
            title={label}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: 8,
              background: '#F0F0F2', border: '1px solid #E5E5E8',
              color: '#6B6B70', textDecoration: 'none',
              transition: 'background 0.12s, border-color 0.12s, color 0.12s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#1A1A1E';
              e.currentTarget.style.borderColor = '#1A1A1E';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#F0F0F2';
              e.currentTarget.style.borderColor = '#E5E5E8';
              e.currentTarget.style.color = '#6B6B70';
            }}
          >
            {icon}
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── Panel content ────────────────────────────────────────────────────────────
function PanelContent({ lang }) {
  return (
    <div>

      {/* Announcements — full bleed, no padding wrapper */}
      <AnnouncementsBanner lang={lang} />

      <div style={{ height: 1, background: '#EBEBEC' }} />

      {/* YouTube carousel — full bleed thumbnails */}
      <YouTubeCarousel lang={lang} />

      <div style={{ height: 1, background: '#EBEBEC' }} />

      {/* Groups */}
      <GroupsList lang={lang} />

      <div style={{ height: 1, background: '#EBEBEC' }} />

      {/* Social links */}
      <SocialRow lang={lang} />

    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function RightPanel({ lang = 'en', mobileOpen, onMobileClose }) {
  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 xl:hidden"
          style={{ zIndex: 48, background: 'rgba(9,9,15,0.40)', backdropFilter: 'blur(3px)' }}
          onClick={onMobileClose}
        />
      )}

      <aside
        className={[
          'right-panel',
          'transition-transform duration-200 ease-out',
          mobileOpen ? 'translate-x-0' : 'translate-x-full',
          'xl:translate-x-0',
        ].join(' ')}
        style={{
          maxWidth: '320px',
          padding: 0,
          // Panel must be a flex column so the scrollable body fills remaining height
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden', // the aside itself does NOT scroll
        }}
      >
        {/* Mobile header — fixed height, never scrolls away */}
        <div
          className="xl:hidden"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 20px',
            height: 'calc(var(--topbar-h) - 1px)',
            borderBottom: '1px solid #EBEBEC',
            flexShrink: 0,
          }}
        >
          <p style={{
            fontSize: 13, fontWeight: 600, color: '#1A1A1E', letterSpacing: '-0.01em',
          }}>
            {lang === 'sw' ? 'Habari za Kanisa' : 'Church Info'}
          </p>
          <button
            onClick={onMobileClose}
            style={{
              width: 28, height: 28, borderRadius: 6,
              border: '1px solid #E5E5E8', background: '#F5F5F6',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            aria-label="Close panel"
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M1 1l10 10M11 1L1 11" stroke="#6B6B70" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Scrollable body — takes all remaining height */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          <PanelContent lang={lang} />
        </div>
      </aside>
    </>
  );
}