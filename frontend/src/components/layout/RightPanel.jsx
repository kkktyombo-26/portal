'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { announcementApi, groupApi } from '../../lib/api';

// ─── Hot Events Banner ────────────────────────────────────────────────────────
function EventsBanner({ lang }) {
  const [events, setEvents] = useState([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    announcementApi.getAll()
      .then(r => setEvents((r.data.data || []).slice(0, 3)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (events.length < 2) return;
    const t = setInterval(() => setActive(a => (a + 1) % events.length), 4500);
    return () => clearInterval(t);
  }, [events.length]);

  if (!events.length) {
    return (
      <div className="rounded-xl bg-navy text-white p-4 mb-5 min-h-[96px] flex items-center justify-center">
        <span className="text-xs text-white/40 uppercase tracking-widest">
          {lang === 'sw' ? 'Hakuna matukio' : 'No upcoming events'}
        </span>
      </div>
    );
  }

  const ev = events[active];

  return (
    <div className="rounded-xl overflow-hidden mb-5 relative select-none"
      style={{ background: '#1B3A6B' }}>
      {/* Gold accent bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0,
        width: 3, height: '100%',
        background: 'linear-gradient(to bottom, #C8A84B, rgba(200,168,75,0.2))',
        borderRadius: '12px 0 0 12px',
      }} />

      {/* Decorative rings */}
      <div style={{
        position: 'absolute', top: -30, right: -30,
        width: 120, height: 120, borderRadius: '50%',
        border: '1px solid rgba(255,255,255,0.07)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: -10, right: -10,
        width: 70, height: 70, borderRadius: '50%',
        border: '1px solid rgba(255,255,255,0.05)',
        pointerEvents: 'none',
      }} />

      {ev.image_url && (
        <div className="w-full h-20 overflow-hidden">
          <img src={ev.image_url} alt="" className="w-full h-full object-cover opacity-50" />
        </div>
      )}

      <div className="relative p-4 pl-5">
        <div className="flex items-center justify-between mb-2.5">
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#C8A84B' }}>
            {lang === 'sw' ? '🔥 Matukio Moto' : '🔥 Hot Events'}
          </span>
          {events.length > 1 && (
            <div className="flex gap-1">
              {events.map((_, i) => (
                <button key={i} onClick={() => setActive(i)}
                  style={{
                    height: 5, borderRadius: 99,
                    width: i === active ? 14 : 5,
                    background: i === active ? '#C8A84B' : 'rgba(255,255,255,0.25)',
                    border: 'none', cursor: 'pointer',
                    transition: 'all 0.3s ease',
                  }} />
              ))}
            </div>
          )}
        </div>
        <p key={ev.id + 't'} className="font-semibold text-sm leading-snug mb-1 text-white animate-fade-in">
          {lang === 'sw' ? ev.title_sw : ev.title_en}
        </p>
        <p key={ev.id + 'b'} className="text-xs leading-relaxed animate-fade-in line-clamp-2"
          style={{ color: 'rgba(255,255,255,0.55)' }}>
          {lang === 'sw' ? ev.body_sw : ev.body_en}
        </p>
        <div className="mt-3 flex items-center gap-2">
          <span className="font-mono" style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
            {new Date(ev.created_at).toLocaleDateString()}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 10 }}>·</span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{ev.author_name}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Groups ───────────────────────────────────────────────────────────────────
const GROUP_ICONS = {
  choir: '♫', youth: '◎', elders: '◈',
  women: '♀', men: '♂', children: '◉', other: '◇',
};

function GroupsList({ lang }) {
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    groupApi.getAll()
      .then(r => setGroups(r.data.data || []))
      .catch(() => {});
  }, []);

  if (!groups.length) return null;

  return (
    <div className="mb-5">
      <p className="section-label mb-3">
        {lang === 'sw' ? 'Vikundi & Kwaya' : 'Choirs & Groups'}
      </p>
      <div className="space-y-0">
        {groups.slice(0, 5).map((g, i) => (
          <div key={g.id}>
            <Link href={`/dashboard/groups/${g.id}`}
              className="flex items-center gap-3 py-2.5 px-1 rounded-md hover:bg-surface transition-colors duration-100 group">
              <span className="w-7 h-7 rounded-md bg-parchment border border-hairline flex items-center justify-center text-xs text-ink-muted flex-shrink-0 group-hover:border-border transition-colors">
                {GROUP_ICONS[g.type] || '◇'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink leading-none truncate">
                  {lang === 'sw' ? (g.name_sw || g.name) : g.name}
                </p>
                <p className="text-2xs text-ink-faint mt-0.5 font-mono">
                  {g.member_count} {lang === 'sw' ? 'wanachama' : 'members'}
                </p>
              </div>
              <span className="text-ink-faint text-xs opacity-0 group-hover:opacity-100 transition-opacity">→</span>
            </Link>
            {i < Math.min(groups.length, 5) - 1 && <div className="hairline ml-10" />}
          </div>
        ))}
        {groups.length > 5 && (
          <Link href="/dashboard/groups"
            className="flex items-center gap-3 py-2.5 px-1 rounded-md hover:bg-surface transition-colors duration-100 group mt-1">
            <span className="w-7 h-7 rounded-md bg-surface border border-dashed border-border flex items-center justify-center text-xs text-ink-faint flex-shrink-0">···</span>
            <span className="text-sm font-medium text-ink-muted group-hover:text-ink transition-colors">
              {lang === 'sw' ? `Vikundi vyote (${groups.length})` : `All groups (${groups.length})`}
            </span>
            <span className="text-ink-faint text-xs opacity-0 group-hover:opacity-100 transition-opacity ml-auto">→</span>
          </Link>
        )}
      </div>
    </div>
  );
}

// ─── Social links config ──────────────────────────────────────────────────────
const WA_PHONE   = '255715855159';
const WA_MESSAGE = 'Bwana Yesu asifiwe , Naomba uniunge kwenye group la whatsapp la usharika';
const WA_HREF    = `https://wa.me/${WA_PHONE}?text=${encodeURIComponent(WA_MESSAGE)}`;

const YT_ICON = (
  <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

const WA_ICON = (
  <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
  </svg>
);

const FB_ICON = (
  <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const IG_ICON = (
  <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
  </svg>
);

// External arrow icon
const ExtArrow = () => (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"
    style={{ flexShrink: 0, opacity: 0 }} className="group-hover:opacity-100 transition-opacity text-ink-faint">
    <path d="M2.5 9.5L9.5 2.5M9.5 2.5H4.5M9.5 2.5V7.5"/>
  </svg>
);

// Shared row base styles
const ROW = 'flex items-center gap-3 py-2.5 px-1 rounded-md hover:bg-surface transition-colors duration-100 group';
const ICON_WRAP = 'w-7 h-7 rounded-md bg-parchment border border-hairline flex items-center justify-center text-ink-muted flex-shrink-0 group-hover:border-border transition-colors';

// ─── WhatsApp CTA card ────────────────────────────────────────────────────────
function WhatsAppCard({ lang }) {
  return (
    <a
      href={WA_HREF}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'block',
        background: 'linear-gradient(135deg, #075e54 0%, #128c7e 100%)',
        borderRadius: 14,
        padding: '14px 16px',
        marginBottom: 16,
        textDecoration: 'none',
        position: 'relative',
        overflow: 'hidden',
      }}
      className="group"
    >
      {/* Decorative circle */}
      <div style={{
        position: 'absolute', top: -20, right: -20,
        width: 80, height: 80, borderRadius: '50%',
        border: '1px solid rgba(255,255,255,0.1)',
        pointerEvents: 'none',
      }} />

      {/* Top row: icon + question */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10, flexShrink: 0,
          background: 'rgba(255,255,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff',
        }}>
          {WA_ICON}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>
            WhatsApp
          </p>
          <p style={{ fontSize: 12.5, fontWeight: 600, color: '#fff', lineHeight: 1.4 }}>
            {lang === 'sw'
              ? 'Je, umejiunga na WhatsApp yetu?'
              : 'Have you joined our WhatsApp?'}
          </p>
        </div>
      </div>

      {/* CTA row */}
      <div style={{
        marginTop: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.4, maxWidth: 160 }}>
          {lang === 'sw'
            ? 'Bonyeza hapa kujiunga na group la usharika'
            : 'Tap to request to join the church group'}
        </p>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'rgba(255,255,255,0.15)',
          borderRadius: 99, padding: '5px 12px',
          color: '#fff', fontSize: 11, fontWeight: 600,
          flexShrink: 0,
          transition: 'background 0.15s',
        }}
          className="group-hover:bg-white/25"
        >
          {lang === 'sw' ? 'Jiunge' : 'Join'} →
        </div>
      </div>
    </a>
  );
}

// ─── Panel Content ─────────────────────────────────────────────────────────────
function PanelContent({ lang }) {
  return (
    <div className="px-5 py-5 space-y-0">
      <EventsBanner lang={lang} />
      <GroupsList lang={lang} />
      <div className="hairline mb-5" />

      <div>
        <p className="section-label mb-3">
          {lang === 'sw' ? 'Mitandao ya Kijamii' : 'Follow Us'}
        </p>

        {/* WhatsApp CTA card */}
        <WhatsAppCard lang={lang} />

        {/* YouTube — internal */}
        <div>
          <Link href="/dashboard/youtube" className={ROW}>
            <span className={ICON_WRAP}>{YT_ICON}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink leading-none">YouTube</p>
              <p className="text-2xs text-ink-faint mt-0.5">
                {lang === 'sw' ? 'Tazama video za kanisa' : 'Watch church videos'}
              </p>
            </div>
            <span className="text-ink-faint text-xs opacity-0 group-hover:opacity-100 transition-opacity">→</span>
          </Link>
          <div className="hairline ml-10" />
        </div>

        {/* Facebook */}
        <div>
          <a href="https://web.facebook.com/profile.php?id=61579436296006"
            target="_blank" rel="noopener noreferrer" className={ROW}>
            <span className={ICON_WRAP}>{FB_ICON}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink leading-none">Facebook</p>
              <p className="text-2xs text-ink-faint mt-0.5">@ChurchPortal</p>
            </div>
            <ExtArrow />
          </a>
          <div className="hairline ml-10" />
        </div>

        {/* Instagram */}
        <div>
          <a href="https://www.instagram.com/kkktyombo" target="_blank" rel="noopener noreferrer" className={ROW}>
            <span className={ICON_WRAP}>{IG_ICON}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink leading-none">Instagram</p>
              <p className="text-2xs text-ink-faint mt-0.5">@church.portal</p>
            </div>
            <ExtArrow />
          </a>
        </div>

        <p className="text-2xs text-ink-faint text-center mt-5 leading-relaxed px-2">
          {lang === 'sw' ? 'Karibu katika jamii yetu ya kidijitali' : 'Join our digital community'}
        </p>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function RightPanel({ lang = 'en', mobileOpen, onMobileClose }) {
  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-30 xl:hidden animate-fade-in"
          onClick={onMobileClose} />
      )}

      <aside className={`
        fixed top-0 right-0 h-full w-[260px] bg-canvas border-l border-hairline z-40
        flex flex-col overflow-y-auto
        transition-transform duration-200
        xl:translate-x-0 xl:static xl:h-screen
        ${mobileOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <div className="xl:hidden h-14 flex items-center justify-between px-5 border-b border-hairline flex-shrink-0">
          <p className="text-sm font-semibold text-ink">
            {lang === 'sw' ? 'Habari za Kanisa' : 'Church Info'}
          </p>
          <button onClick={onMobileClose} className="btn-ghost w-8 h-8 text-lg leading-none">×</button>
        </div>

        <PanelContent lang={lang} />
      </aside>
    </>
  );
}