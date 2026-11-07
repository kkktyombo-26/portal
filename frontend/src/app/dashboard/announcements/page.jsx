'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useTranslation } from '../../../lib/i18n';
import { announcementApi } from '../../../lib/api';
import { canBroadcast } from '../../../lib/auth';
import R2UploadService from '../../../lib/r2UploadService';
import PageHeader from '../../../components/ui/PageHeader';
import Modal from '../../../components/ui/Modal';
import Toast from '../../../components/ui/Toast';

// ── Decorative SVG motifs ─────────────────────────────────────────

function CrossMark({ size = 20, opacity = 0.12, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={{ opacity }}>
      <rect x="8.5" y="2" width="3" height="16" rx="1.5" fill={color} />
      <rect x="2" y="7.5" width="16" height="3" rx="1.5" fill={color} />
    </svg>
  );
}

function ArcMotif({ opacity = 0.07 }) {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" style={{ opacity }}>
      <circle cx="60" cy="60" r="55" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="60" cy="60" r="40" stroke="currentColor" strokeWidth="1" />
      <circle cx="60" cy="60" r="22" stroke="currentColor" strokeWidth="0.75" />
    </svg>
  );
}

function DotGrid({ cols = 5, rows = 4, gap = 10, opacity = 0.1, color = 'currentColor' }) {
  return (
    <svg width={cols * gap} height={rows * gap} style={{ opacity }}>
      {Array.from({ length: rows }).map((_, r) =>
        Array.from({ length: cols }).map((_, c) => (
          <circle key={`${r}-${c}`} cx={c * gap + gap / 2} cy={r * gap + gap / 2} r="1" fill={color} />
        ))
      )}
    </svg>
  );
}

// ── Scope colour system ───────────────────────────────────────────

const SCOPE_THEMES = {
  church: {
    accent: '#1B3A6B',
    light:  '#EEF2F8',
    gold:   '#C8A84B',
    label:  { en: 'Church Wide', sw: 'Kanisa Lote' },
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L2 7v2h2v11h4v-6h4v6h4V9h2V7L12 2z"/>
      </svg>
    ),
  },
  group: {
    accent: '#1a7a4a',
    light:  '#EDFBF3',
    gold:   '#34d399',
    label:  { en: 'Group', sw: 'Kikundi' },
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
      </svg>
    ),
  },
};

// ── Nav arrow ────────────────────────────────────────────────────

function NavArrow({ dir, onClick, accent, gold }) {
  return (
    <button
      onClick={onClick}
      style={{
        position: 'absolute', top: '50%',
        [dir === 'prev' ? 'left' : 'right']: 14,
        transform: 'translateY(-50%)',
        zIndex: 10,
        width: 36, height: 36, borderRadius: '50%',
        background: 'rgba(255,255,255,0.15)',
        border: '1.5px solid rgba(255,255,255,0.25)',
        backdropFilter: 'blur(6px)',
        color: '#fff', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.15s, transform 0.15s',
        fontSize: 16, fontWeight: 700, lineHeight: 1,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = gold + 'cc';
        e.currentTarget.style.transform = 'translateY(-50%) scale(1.08)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
        e.currentTarget.style.transform = 'translateY(-50%)';
      }}
      aria-label={dir}
    >
      {dir === 'prev' ? '‹' : '›'}
    </button>
  );
}

// ── Swipeable thumbnail strip ─────────────────────────────────────

function ThumbStrip({ items, active, onSelect, lang }) {
  const stripRef = useRef(null);
  const dragRef  = useRef(null);

  const onPointerDown = e => {
    dragRef.current = { x: e.clientX, scroll: stripRef.current.scrollLeft };
    stripRef.current.setPointerCapture(e.pointerId);
  };
  const onPointerMove = e => {
    if (!dragRef.current) return;
    stripRef.current.scrollLeft = dragRef.current.scroll - (e.clientX - dragRef.current.x);
  };
  const onPointerUp = () => { dragRef.current = null; };

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const thumb = strip.children[active];
    if (!thumb) return;
    const { left, width } = thumb.getBoundingClientRect();
    const { left: sl, width: sw } = strip.getBoundingClientRect();
    if (left < sl) strip.scrollLeft -= sl - left + 10;
    else if (left + width > sl + sw) strip.scrollLeft += (left + width) - (sl + sw) + 10;
  }, [active]);

  return (
    <div
      ref={stripRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{
        display: 'flex', gap: 10,
        overflowX: 'auto', paddingBottom: 4,
        scrollbarWidth: 'none', msOverflowStyle: 'none',
        cursor: 'grab', userSelect: 'none',
        marginTop: 10,
      }}
    >
      <style>{`.thumb-strip::-webkit-scrollbar{display:none}`}</style>
      {items.map((it, i) => {
        const th       = SCOPE_THEMES[it.scope] || SCOPE_THEMES.church;
        const isActive = i === active;
        return (
          <button
            key={it.id}
            onClick={() => onSelect(i)}
            style={{
              flexShrink: 0,
              width: 170, textAlign: 'left',
              background: isActive ? th.accent : th.light,
              border: isActive ? `2px solid ${th.gold}` : `1.5px solid ${th.accent}22`,
              borderRadius: 12, padding: 0,
              cursor: 'pointer', position: 'relative', overflow: 'hidden',
              transition: 'all 0.2s',
              borderLeft: `3px solid ${isActive ? th.gold : th.accent}`,
              boxShadow: isActive ? `0 4px 16px ${th.accent}33` : 'none',
            }}
            onMouseEnter={e => { if (!isActive) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 4px 14px ${th.accent}22`; } }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; if (!isActive) e.currentTarget.style.boxShadow = 'none'; }}
          >
            {it.image_url ? (
              <div style={{ position: 'relative', width: '100%', height: 80, overflow: 'hidden' }}>
                <img src={it.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: isActive ? 0.75 : 0.88, transition: 'opacity 0.2s' }} />
                <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to bottom, transparent 20%, ${th.accent}cc 100%)` }} />
                <span style={{ position: 'absolute', top: 6, left: 8, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#fff', background: 'rgba(0,0,0,0.35)', borderRadius: 99, padding: '2px 7px', backdropFilter: 'blur(4px)' }}>
                  {th.label[lang] || th.label.en}
                </span>
                {isActive && (
                  <div style={{ position: 'absolute', bottom: 6, right: 7, width: 7, height: 7, borderRadius: '50%', background: th.gold, boxShadow: '0 0 0 2px rgba(255,255,255,0.4)' }} />
                )}
              </div>
            ) : (
              <div style={{ height: 36, background: th.accent, display: 'flex', alignItems: 'center', paddingLeft: 10, position: 'relative' }}>
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: isActive ? th.gold : 'rgba(255,255,255,0.7)' }}>
                  {th.label[lang] || th.label.en}
                </span>
                <div style={{ position: 'absolute', top: 4, right: 8, pointerEvents: 'none' }}>
                  <CrossMark size={13} opacity={0.18} color="#fff" />
                </div>
              </div>
            )}

            <div style={{ padding: '8px 11px 10px' }}>
              <p style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.35, color: isActive ? '#fff' : '#1a1a1a', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: 4 }}>
                {lang === 'sw' ? it.title_sw : it.title_en}
              </p>
              <p style={{ fontSize: 10, color: isActive ? 'rgba(255,255,255,0.45)' : '#9ca3af', fontFamily: 'monospace' }}>
                {new Date(it.created_at).toLocaleDateString()}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Parallax Carousel ─────────────────────────────────────────────

function AnnouncementCarousel({ items, lang, user, onDelete, onEdit }) {
  const [active, setActive]     = useState(0);
  const [dragStart, setDrag]    = useState(null);
  const [parallax, setParallax] = useState(0);
  const containerRef = useRef(null);
  const autoRef      = useRef(null);

  const resetAuto = () => {
    clearInterval(autoRef.current);
    autoRef.current = setInterval(() => setActive(a => (a + 1) % items.length), 5500);
  };

  const goTo = i => { setActive((i + items.length) % items.length); resetAuto(); };
  const prev = () => goTo(active - 1);
  const next = () => goTo(active + 1);

  useEffect(() => {
    if (items.length < 2) return;
    autoRef.current = setInterval(() => setActive(a => (a + 1) % items.length), 5500);
    return () => clearInterval(autoRef.current);
  }, [items.length]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onMove  = e => { const r = el.getBoundingClientRect(); setParallax((e.clientX - r.left) / r.width - 0.5); };
    const onLeave = () => setParallax(0);
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => { el.removeEventListener('mousemove', onMove); el.removeEventListener('mouseleave', onLeave); };
  }, []);

  const handlePointerDown = e => setDrag(e.clientX);
  const handlePointerUp   = e => {
    if (dragStart === null) return;
    const delta = e.clientX - dragStart;
    if (Math.abs(delta) > 40) { delta < 0 ? next() : prev(); }
    setDrag(null);
  };

  if (!items.length) return null;

  const item   = items[active];
  const theme  = SCOPE_THEMES[item.scope] || SCOPE_THEMES.church;
  const canAct = user?.role === 'pastor' || item.author_id === user?.id;
  const px     = parallax * 18;

  return (
    <div ref={containerRef} className="mb-8 select-none" style={{ touchAction: 'pan-y' }}>
      <div
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        style={{
          position: 'relative',
          background: item.image_url ? `url(${item.image_url}) center/cover no-repeat` : theme.accent,
          borderRadius: 20, overflow: 'hidden',
          cursor: items.length > 1 ? 'grab' : 'default',
          minHeight: 300, transition: 'box-shadow 0.3s',
          boxShadow: `0 12px 48px ${theme.accent}44`,
        }}
      >
        {item.image_url && (
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${theme.accent}ee 0%, ${theme.accent}99 50%, ${theme.accent}66 100%)`, zIndex: 0 }} />
        )}

        <div style={{ position: 'absolute', top: -50, right: -50, transform: `translateX(${px * 0.55}px)`, transition: 'transform 0.1s ease-out', pointerEvents: 'none', color: '#fff' }}>
          <ArcMotif opacity={0.1} />
        </div>
        <div style={{ position: 'absolute', bottom: -40, left: -30, transform: `translateX(${-px * 0.3}px)`, transition: 'transform 0.1s ease-out', pointerEvents: 'none', color: '#fff' }}>
          <ArcMotif opacity={0.06} />
        </div>
        <div style={{ position: 'absolute', bottom: 20, right: 24, transform: `translateX(${px * 0.4}px)`, transition: 'transform 0.1s ease-out', pointerEvents: 'none' }}>
          <DotGrid cols={7} rows={4} gap={13} opacity={0.22} color={theme.gold} />
        </div>
        <div style={{ position: 'absolute', top: '45%', right: 60, transform: `translate(${px * 0.8}px, -50%)`, transition: 'transform 0.1s ease-out', pointerEvents: 'none' }}>
          <CrossMark size={80} opacity={0.06} color="#fff" />
        </div>

        <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: `linear-gradient(to bottom, ${theme.gold}, ${theme.gold}55)`, borderRadius: '20px 0 0 20px' }} />

        {items.length > 1 && (
          <>
            <NavArrow dir="prev" onClick={e => { e.stopPropagation(); prev(); }} accent={theme.accent} gold={theme.gold} />
            <NavArrow dir="next" onClick={e => { e.stopPropagation(); next(); }} accent={theme.accent} gold={theme.gold} />
          </>
        )}

        <div style={{ position: 'relative', padding: '32px 70px 28px 40px', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.13)', color: '#fff', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '4px 11px', borderRadius: 99, backdropFilter: 'blur(6px)' }}>
              {theme.icon}
              {theme.label[lang] || theme.label.en}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>·</span>
            <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: 500 }}>
              {new Date(item.created_at).toLocaleDateString()}
            </span>
          </div>

          <p style={{ color: '#fff', fontWeight: 800, fontSize: 'clamp(1.25rem, 2.8vw, 1.65rem)', lineHeight: 1.25, marginBottom: 14, textShadow: '0 2px 8px rgba(0,0,0,0.25)', letterSpacing: '-0.01em' }}>
            {lang === 'sw' ? item.title_sw : item.title_en}
          </p>

          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, lineHeight: 1.7, marginBottom: 24, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden', maxWidth: 560 }}>
            {lang === 'sw' ? item.body_sw : item.body_en}
          </p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: 500 }}>
              {item.author_name}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Edit + Delete buttons — only for author or pastor */}
              {canAct && (
                <>
                  <button
                    onClick={e => { e.stopPropagation(); onEdit(item); }}
                    style={{ background: 'rgba(255,255,255,0.13)', border: '1px solid rgba(255,255,255,0.22)', color: 'rgba(255,255,255,0.85)', borderRadius: 7, padding: '5px 12px', fontSize: 11, cursor: 'pointer', fontWeight: 500, backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', gap: 5 }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    {lang === 'sw' ? 'Hariri' : 'Edit'}
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); onDelete(item.id); }}
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.55)', borderRadius: 7, padding: '5px 12px', fontSize: 11, cursor: 'pointer', fontWeight: 500, backdropFilter: 'blur(4px)' }}
                  >
                    {lang === 'sw' ? 'Futa' : 'Delete'}
                  </button>
                </>
              )}

              {/* Pill dots */}
              {items.length > 1 && (
                <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                  {items.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => goTo(i)}
                      style={{ width: i === active ? 20 : 6, height: 6, borderRadius: 99, padding: 0, background: i === active ? theme.gold : 'rgba(255,255,255,0.28)', border: 'none', cursor: 'pointer', transition: 'all 0.3s ease' }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {items.length > 1 && (
        <ThumbStrip items={items} active={active} onSelect={goTo} lang={lang} />
      )}
    </div>
  );
}

// ── List row ──────────────────────────────────────────────────────

function AnnouncementRow({ item, lang, user, onDelete, onEdit, index }) {
  const theme  = SCOPE_THEMES[item.scope] || SCOPE_THEMES.church;
  const canAct = user?.role === 'pastor' || item.author_id === user?.id;

  return (
    <div
      className={`animate-slide-up stagger-${Math.min(index + 1, 6)}`}
      style={{ position: 'relative', paddingLeft: 20, marginBottom: 0 }}
    >
      <div style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, borderRadius: 99, background: `linear-gradient(to bottom, ${theme.accent}, ${theme.accent}44)` }} />

      <div style={{ padding: '18px 0 18px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: theme.light, color: theme.accent, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 99 }}>
                {theme.icon}
                {theme.label[lang] || theme.label.en}
              </span>
              <span style={{ color: '#9ca3af', fontSize: 11, fontFamily: 'monospace' }}>
                {new Date(item.created_at).toLocaleDateString()}
              </span>
            </div>
            <p style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', lineHeight: 1.35, marginBottom: 6 }}>
              {lang === 'sw' ? item.title_sw : item.title_en}
            </p>
            <p style={{ fontSize: 13.5, color: '#4b5563', lineHeight: 1.65, marginBottom: 10 }}>
              {lang === 'sw' ? item.body_sw : item.body_en}
            </p>
            <p style={{ fontSize: 11, color: '#9ca3af' }}>{item.author_name}</p>
          </div>

          {/* Edit + Delete actions */}
          {canAct && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginTop: 2 }}>
              <button
                onClick={() => onEdit(item)}
                className="btn-ghost text-xs"
                style={{ color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                {lang === 'sw' ? 'Hariri' : 'Edit'}
              </button>
              <button
                onClick={() => onDelete(item.id)}
                className="btn-ghost text-xs"
                style={{ color: '#9ca3af' }}
              >
                {lang === 'sw' ? 'Futa' : 'Delete'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Image upload field ────────────────────────────────────────────

function ImageUploadField({ value, onChange, lang, onError }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress]  = useState(0);
  const inputRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      setProgress(0);
      const { secureUrl } = await R2UploadService.uploadFromFile({
        file,
        folder: 'church_portal/announcements',
        onProgress: pct => setProgress(pct),
      });
      onChange(secureUrl);
    } catch (err) {
      onError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  if (value) {
    return (
      <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', marginTop: 4 }}>
        <img src={value} alt="preview" style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }} />
        <button
          type="button"
          onClick={() => onChange('')}
          style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', borderRadius: 6, padding: '3px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
        >
          {lang === 'sw' ? 'Ondoa' : 'Remove'}
        </button>
      </div>
    );
  }

  return (
    <label
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4, padding: '18px 0', border: '1.5px dashed #d1d5db', borderRadius: 10, cursor: uploading ? 'default' : 'pointer', color: '#6b7280', fontSize: 13, background: uploading ? '#f9fafb' : 'transparent', transition: 'border-color 0.15s' }}
      onMouseEnter={e => { if (!uploading) e.currentTarget.style.borderColor = '#9ca3af'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#d1d5db'; }}
    >
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} disabled={uploading} onChange={handleFile} />
      {uploading ? (
        <>
          <span style={{ width: 14, height: 14, border: '2px solid #d1d5db', borderTopColor: '#374151', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
          {progress > 0 ? `${progress}%` : (lang === 'sw' ? 'Inapakia...' : 'Uploading...')}
        </>
      ) : (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          {lang === 'sw' ? 'Pakia picha' : 'Upload image'}
        </>
      )}
    </label>
  );
}

// ── Shared announcement form fields ──────────────────────────────
// Extracted so Create and Edit modals use the exact same markup.

function AnnouncementFormFields({ form, setForm, user, lang, t, showToast }) {
  const set = f => e => setForm(v => ({ ...v, [f]: e.target.value }));

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label">{t('title_english')}</label>
          <input value={form.title_en} onChange={set('title_en')} className="field-input" required />
        </div>
        <div>
          <label className="field-label">{t('title_swahili')}</label>
          <input value={form.title_sw} onChange={set('title_sw')} className="field-input" required />
        </div>
      </div>

      <div>
        <label className="field-label">{t('body_english')}</label>
        <textarea value={form.body_en} onChange={set('body_en')} rows={3} className="field-input resize-none" required />
      </div>

      <div>
        <label className="field-label">{t('body_swahili')}</label>
        <textarea value={form.body_sw} onChange={set('body_sw')} rows={3} className="field-input resize-none" required />
      </div>

      <div>
        <label className="field-label">
          {lang === 'sw' ? 'Picha (si lazima)' : 'Image (optional)'}
        </label>
        <ImageUploadField
          value={form.image_url}
          onChange={url => setForm(v => ({ ...v, image_url: url }))}
          lang={lang}
          onError={msg => showToast(msg, 'error')}
        />
      </div>

      {user?.role === 'pastor' && (
        <div>
          <label className="field-label">{t('broadcast_to')}</label>
          <select value={form.scope} onChange={set('scope')} className="field-input">
            <option value="church">{t('entire_church')}</option>
            <option value="group">{t('my_group')}</option>
          </select>
        </div>
      )}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────

const EMPTY_FORM = { title_en: '', title_sw: '', body_en: '', body_sw: '', scope: 'church', image_url: '' };

function itemToForm(item) {
  return {
    title_en:  item.title_en  || '',
    title_sw:  item.title_sw  || '',
    body_en:   item.body_en   || '',
    body_sw:   item.body_sw   || '',
    scope:     item.scope     || 'church',
    image_url: item.image_url || '',
  };
}

export default function AnnouncementsPage() {
  const { user, lang } = useAuth();
  const { t }          = useTranslation(lang);

  const [items,      setItems]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [toast,      setToast]      = useState(null);

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_FORM);
  const [creating,   setCreating]   = useState(false);

  // Edit modal
  const [editItem,   setEditItem]   = useState(null);   // the item being edited
  const [editForm,   setEditForm]   = useState(EMPTY_FORM);
  const [saving,     setSaving]     = useState(false);

  // Delete confirm
  const [deleteId,   setDeleteId]   = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const res = await announcementApi.getAll();
      setItems(res.data.data);
    } catch (_) {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // ── Create ──
  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      setCreating(true);
      await announcementApi.create(createForm);
      showToast(lang === 'sw' ? 'Tangazo limechapishwa' : 'Announcement published');
      setCreateOpen(false);
      setCreateForm(EMPTY_FORM);
      fetchItems();
    } catch (err) { showToast(err.message, 'error'); }
    finally { setCreating(false); }
  };

  // ── Open edit modal ──
  const openEdit = (item) => {
    setEditItem(item);
    setEditForm(itemToForm(item));
  };

  const closeEdit = () => {
    setEditItem(null);
    setEditForm(EMPTY_FORM);
  };

  // ── Save edit ──
  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await announcementApi.update(editItem.id, editForm);
      showToast(lang === 'sw' ? 'Tangazo limesasishwa' : 'Announcement updated');
      closeEdit();
      fetchItems();
    } catch (err) { showToast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  // ── Delete ──
  const handleDelete = async (id) => {
    try {
      await announcementApi.delete(id);
      showToast(lang === 'sw' ? 'Tangazo limefutwa' : 'Announcement deleted');
      setDeleteId(null);
      fetchItems();
    } catch (err) { showToast(err.message, 'error'); }
  };

  const canPost       = canBroadcast(user?.role);
  const carouselItems = items.slice(0, 8);
  const listItems     = items.slice(8);

  return (
    <div>
      <PageHeader
        breadcrumb={lang === 'sw' ? 'Mawasiliano' : 'Communication'}
        title={t('announcements')}
        subtitle={lang === 'sw' ? 'Matangazo yanayokuhusu' : 'Announcements relevant to you'}
        action={canPost && (
          <button onClick={() => setCreateOpen(true)} className="btn-primary">
            + {t('new_announcement')}
          </button>
        )}
      />

      <div className="px-6 py-6 max-w-content">
        {loading ? (
          <div className="py-16 flex justify-center">
            <span className="w-5 h-5 border-2 border-border border-t-ink-muted rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16, opacity: 0.2 }}>
              <CrossMark size={48} opacity={1} color="#1B3A6B" />
            </div>
            <p className="text-ink-muted text-sm">{t('no_data')}</p>
          </div>
        ) : (
          <>
            <AnnouncementCarousel
              items={carouselItems}
              lang={lang}
              user={user}
              onDelete={setDeleteId}
              onEdit={openEdit}
            />

            {listItems.length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', color: '#9ca3af' }}>
                    <CrossMark size={12} opacity={0.5} color="#9ca3af" />
                    <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      {lang === 'sw' ? 'Zaidi' : 'More'}
                    </span>
                    <CrossMark size={12} opacity={0.5} color="#9ca3af" />
                  </div>
                  <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
                </div>

                <div className="card p-0 overflow-hidden">
                  {listItems.map((a, i) => (
                    <div key={a.id}>
                      <AnnouncementRow
                        item={a}
                        lang={lang}
                        user={user}
                        onDelete={setDeleteId}
                        onEdit={openEdit}
                        index={i}
                      />
                      {i < listItems.length - 1 && <div className="hairline mx-5" />}
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ── Create modal ── */}
      <Modal
        isOpen={createOpen}
        onClose={() => { setCreateOpen(false); setCreateForm(EMPTY_FORM); }}
        title={t('new_announcement')}
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <AnnouncementFormFields
            form={createForm}
            setForm={setCreateForm}
            user={user}
            lang={lang}
            t={t}
            showToast={showToast}
          />
          <div className="hairline" />
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => { setCreateOpen(false); setCreateForm(EMPTY_FORM); }} className="btn-secondary">
              {t('cancel')}
            </button>
            <button type="submit" disabled={creating} className="btn-primary">
              {creating
                ? <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    {lang === 'sw' ? 'Inachapisha...' : 'Publishing...'}
                  </span>
                : t('publish')}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Edit modal ── */}
      <Modal
        isOpen={!!editItem}
        onClose={closeEdit}
        title={lang === 'sw' ? 'Hariri Tangazo' : 'Edit Announcement'}
      >
        <form onSubmit={handleUpdate} className="space-y-4">
          <AnnouncementFormFields
            form={editForm}
            setForm={setEditForm}
            user={user}
            lang={lang}
            t={t}
            showToast={showToast}
          />
          <div className="hairline" />
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={closeEdit} className="btn-secondary">
              {t('cancel')}
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving
                ? <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    {lang === 'sw' ? 'Inasasisha...' : 'Saving...'}
                  </span>
                : (lang === 'sw' ? 'Hifadhi' : 'Save changes')}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Delete confirm ── */}
      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title={lang === 'sw' ? 'Futa Tangazo?' : 'Delete Announcement?'}
      >
        <p className="text-sm text-ink-muted">{t('confirm_delete')}</p>
        <div className="hairline mt-5 mb-4" />
        <div className="flex gap-3 justify-end">
          <button onClick={() => setDeleteId(null)} className="btn-secondary">{t('cancel')}</button>
          <button onClick={() => handleDelete(deleteId)} className="btn-danger">{t('delete')}</button>
        </div>
      </Modal>

      <Toast toast={toast} />
    </div>
  );
}