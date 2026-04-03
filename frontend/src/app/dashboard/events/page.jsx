'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { eventApi } from '../../../lib/api';
import PageHeader from '../../../components/ui/PageHeader';
import Modal from '../../../components/ui/Modal';
import Toast from '../../../components/ui/Toast';

const DAYS = { en: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], sw: ['Jum','Jzt','Jnn','Jtn','Alh','Ijm','Jmm'] };
const MONTHS = {
  en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
  sw: ['Januari','Februari','Machi','Aprili','Mei','Juni','Julai','Agosti','Septemba','Oktoba','Novemba','Desemba'],
};

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h);
  return `${hour % 12 || 12}:${m} ${hour < 12 ? 'AM' : 'PM'}`;
}

function formatDate(dateStr, lang) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${DAYS[lang][d.getDay()]}, ${d.getDate()} ${MONTHS[lang][d.getMonth()]} ${d.getFullYear()}`;
}

function isUpcoming(dateStr) {
  const today = new Date(); today.setHours(0,0,0,0);
  return new Date(dateStr + 'T00:00:00') >= today;
}

// ── Decorative SVG motifs (same system as announcements page) ──────
function ArcMotif({ opacity = 0.07 }) {
  return (
    <svg width="160" height="160" viewBox="0 0 160 160" fill="none" style={{ opacity, pointerEvents: 'none' }}>
      <circle cx="80" cy="80" r="74" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="80" cy="80" r="54" stroke="currentColor" strokeWidth="1" />
      <circle cx="80" cy="80" r="30" stroke="currentColor" strokeWidth="0.75" />
    </svg>
  );
}

function DotGrid({ cols = 6, rows = 3, gap = 13, opacity = 0.22, color = '#C8A84B' }) {
  return (
    <svg width={cols * gap} height={rows * gap} style={{ opacity, pointerEvents: 'none' }}>
      {Array.from({ length: rows }).map((_, r) =>
        Array.from({ length: cols }).map((_, c) => (
          <circle key={`${r}-${c}`} cx={c * gap + gap / 2} cy={r * gap + gap / 2} r="1.5" fill={color} />
        ))
      )}
    </svg>
  );
}

// ── Hero card — shown for the first upcoming event only ───────────
function HeroEventCard({ event, lang, canManage, onEdit, onDelete }) {
  const dateStr = event.event_date?.split('T')[0] || event.event_date;
  const d       = new Date(dateStr + 'T00:00:00');
  const title   = lang === 'sw' ? event.title_sw : event.title_en;
  const desc    = lang === 'sw' ? event.description_sw : event.description_en;

  return (
    <div
      style={{
        position: 'relative',
        background: '#1B3A6B',
        borderRadius: 20,
        overflow: 'hidden',
        padding: '28px 28px 24px 36px',
        marginBottom: 20,
        boxShadow: '0 8px 32px rgba(27,58,107,0.22)',
      }}
    >
      {/* Gold left accent bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0,
        width: 4, height: '100%',
        background: 'linear-gradient(to bottom, #C8A84B, rgba(200,168,75,0.3))',
        borderRadius: '20px 0 0 20px',
      }} />

      {/* Decorative arc — top right */}
      <div style={{ position: 'absolute', top: -50, right: -50, color: '#fff' }}>
        <ArcMotif opacity={0.08} />
      </div>

      {/* Dot grid — bottom right */}
      <div style={{ position: 'absolute', bottom: 20, right: 24 }}>
        <DotGrid cols={7} rows={3} gap={13} opacity={0.25} color="#C8A84B" />
      </div>

      {/* Admin actions */}
      {canManage && (
        <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 6, zIndex: 1 }}>
          <button
            onClick={() => onEdit(event)}
            style={{
              padding: '5px 12px', borderRadius: 8,
              background: 'rgba(255,255,255,0.1)', border: '0.5px solid rgba(255,255,255,0.2)',
              color: 'rgba(255,255,255,0.7)', fontSize: 11, cursor: 'pointer', fontWeight: 500,
            }}
          >
            {lang === 'sw' ? 'Hariri' : 'Edit'}
          </button>
          <button
            onClick={() => onDelete(event.id)}
            style={{
              padding: '5px 12px', borderRadius: 8,
              background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,120,120,0.3)',
              color: 'rgba(255,120,120,0.8)', fontSize: 11, cursor: 'pointer', fontWeight: 500,
            }}
          >
            {lang === 'sw' ? 'Futa' : 'Delete'}
          </button>
        </div>
      )}

      {/* "Next up" pill */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        background: 'rgba(200,168,75,0.18)', color: '#C8A84B',
        fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', padding: '3px 10px',
        borderRadius: 99, marginBottom: 14,
      }}>
        {lang === 'sw' ? 'Kinachokuja' : 'Next up'}
      </div>

      {/* Giant day number + month/year */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
        <span style={{
          fontSize: 56, fontWeight: 700, color: '#fff', lineHeight: 1,
          fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
        }}>
          {String(d.getDate()).padStart(2, '0')}
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {MONTHS[lang][d.getMonth()]}
          </span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
            {d.getFullYear()} · {DAYS[lang][d.getDay()]}
          </span>
        </div>
      </div>

      {/* Title */}
      <p style={{
        color: '#fff', fontWeight: 700,
        fontSize: 'clamp(1.15rem, 2.5vw, 1.5rem)',
        lineHeight: 1.25, marginBottom: 10,
        letterSpacing: '-0.01em',
      }}>
        {title}
      </p>

      {/* Description */}
      {desc && (
        <p style={{
          color: 'rgba(255,255,255,0.65)', fontSize: 13.5,
          lineHeight: 1.65, marginBottom: 18,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden', maxWidth: 520,
        }}>
          {desc}
        </p>
      )}

      {/* Meta row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        {(event.start_time) && (
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: 'monospace' }}>
            {formatTime(event.start_time)}{event.end_time ? ` – ${formatTime(event.end_time)}` : ''}
          </span>
        )}
        {event.location && (
          <>
            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10 }}>·</span>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{event.location}</span>
          </>
        )}
        {event.created_by_name && (
          <>
            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10 }}>·</span>
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>
              {lang === 'sw' ? 'Iliundwa na' : 'Created by'} {event.created_by_name}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ── Month section label ───────────────────────────────────────────
function MonthLabel({ label }) {
  return (
    <p style={{
      fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
      letterSpacing: '0.1em', color: 'var(--tw-color-ink-faint, #9ca3af)',
      marginBottom: 12, paddingLeft: 2,
    }}
      className="text-ink-faint"
    >
      {label}
    </p>
  );
}

// ── Regular event row ─────────────────────────────────────────────
function EventRow({ event, lang, canManage, onEdit, onDelete, isPast, animIndex }) {
  const dateStr = event.event_date?.split('T')[0] || event.event_date;
  const d       = new Date(dateStr + 'T00:00:00');
  const title   = lang === 'sw' ? event.title_sw : event.title_en;
  const desc    = lang === 'sw' ? event.description_sw : event.description_en;

  return (
    <div className={`animate-slide-up stagger-${Math.min(animIndex + 1, 6)}`}>
      <div className="py-4 flex items-start gap-0">

        {/* Date column */}
        <div style={{ flexShrink: 0, width: 52, textAlign: 'center', paddingTop: 2 }}>
          <div
            className={isPast ? 'text-ink-faint' : 'text-ink'}
            style={{ fontSize: 22, fontWeight: 600, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}
          >
            {String(d.getDate()).padStart(2, '0')}
          </div>
          <div className="text-ink-faint" style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.09em', marginTop: 2 }}>
            {MONTHS[lang][d.getMonth()]?.slice(0, 3)}
          </div>
        </div>

        {/* Vertical hairline */}
        <div className="bg-hairline self-stretch flex-shrink-0" style={{ width: '0.5px', margin: '2px 16px 2px 0' }} />

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <p
              className={isPast ? 'text-ink-muted' : 'text-ink'}
              style={{ fontSize: 14, fontWeight: isPast ? 400 : 600, lineHeight: 1.35, marginBottom: 4 }}
            >
              {title}
            </p>
            {isPast && (
              <span style={{
                fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em',
                background: 'var(--tw-color-surface, #f8f7f4)',
                borderRadius: 99, padding: '2px 8px', flexShrink: 0,
              }}
                className="bg-surface text-ink-faint"
              >
                {lang === 'sw' ? 'Imepita' : 'Past'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: desc ? 5 : 0 }}>
            {event.start_time && (
              <span className="text-ink-muted font-mono" style={{ fontSize: 11 }}>
                {formatTime(event.start_time)}{event.end_time ? ` – ${formatTime(event.end_time)}` : ''}
              </span>
            )}
            {event.location && (
              <>
                <span className="text-ink-faint" style={{ fontSize: 10 }}>·</span>
                <span className="text-ink-muted" style={{ fontSize: 11 }}>{event.location}</span>
              </>
            )}
          </div>

          {desc && (
            <p className="text-ink-faint" style={{ fontSize: 12, lineHeight: 1.55, marginBottom: 4, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {desc}
            </p>
          )}

          {event.created_by_name && (
            <p className="text-ink-faint" style={{ fontSize: 10, marginTop: 3 }}>
              {lang === 'sw' ? 'Iliundwa na' : 'Created by'} {event.created_by_name}
            </p>
          )}
        </div>

        {/* Actions */}
        {canManage && (
          <div style={{ flexShrink: 0, display: 'flex', gap: 4, paddingLeft: 8, alignItems: 'center' }}>
            {!isPast && (
              <button onClick={() => onEdit(event)} className="btn-ghost text-xs">
                {lang === 'sw' ? 'Hariri' : 'Edit'}
              </button>
            )}
            <button onClick={() => onDelete(event.id)} className="btn-ghost text-xs text-danger">
              {lang === 'sw' ? 'Futa' : 'Delete'}
            </button>
          </div>
        )}
      </div>
      <div className="hairline" />
    </div>
  );
}

// ── Group events by month ─────────────────────────────────────────
function groupByMonth(events, lang) {
  const groups = [];
  events.forEach(e => {
    const dateStr = e.event_date?.split('T')[0] || e.event_date;
    const d       = new Date(dateStr + 'T00:00:00');
    const key     = `${d.getFullYear()}-${d.getMonth()}`;
    const label   = `${MONTHS[lang][d.getMonth()]} ${d.getFullYear()}`;
    const last    = groups[groups.length - 1];
    if (last && last.key === key) {
      last.events.push(e);
    } else {
      groups.push({ key, label, events: [e] });
    }
  });
  return groups;
}

const EMPTY_FORM = { title_en:'', title_sw:'', description_en:'', description_sw:'', event_date:'', start_time:'', end_time:'', location:'' };

export default function EventsPage() {
  const { user, lang } = useAuth();
  const [events, setEvents]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editEvent, setEditEvent] = useState(null);
  const [saving, setSaving]       = useState(false);
  const [toast, setToast]         = useState(null);
  const [deleteId, setDeleteId]   = useState(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [tab, setTab]             = useState('upcoming');

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const fetchEvents = useCallback(async () => {
    try { setLoading(true); const res = await eventApi.getAll(); setEvents(res.data.data); }
    catch (_) {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const canManage = ['pastor', 'elder'].includes(user?.role);

  const openCreate = () => { setForm(EMPTY_FORM); setEditEvent(null); setModalOpen(true); };
  const openEdit   = (e) => {
    setForm({
      title_en: e.title_en, title_sw: e.title_sw,
      description_en: e.description_en || '', description_sw: e.description_sw || '',
      event_date: e.event_date?.split('T')[0] || '',
      start_time: e.start_time?.slice(0, 5) || '',
      end_time:   e.end_time?.slice(0, 5) || '',
      location:   e.location || '',
    });
    setEditEvent(e);
    setModalOpen(true);
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    try {
      setSaving(true);
      if (editEvent) {
        await eventApi.update(editEvent.id, form);
        showToast(lang === 'sw' ? 'Tukio limesasishwa' : 'Event updated');
      } else {
        await eventApi.create(form);
        showToast(lang === 'sw' ? 'Tukio limeongezwa' : 'Event created');
      }
      setModalOpen(false);
      fetchEvents();
    } catch (err) { showToast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try {
      await eventApi.delete(id);
      showToast(lang === 'sw' ? 'Tukio limefutwa' : 'Event deleted');
      setDeleteId(null);
      fetchEvents();
    } catch (err) { showToast(err.message, 'error'); }
  };

  const set = (f) => (e) => setForm(v => ({ ...v, [f]: e.target.value }));

  const upcoming = events.filter(e => isUpcoming(e.event_date?.split('T')[0] || e.event_date));
  const past     = events.filter(e => !isUpcoming(e.event_date?.split('T')[0] || e.event_date));

  // Hero = first upcoming event; rest go into timeline rows
  const heroEvent      = tab === 'upcoming' ? upcoming[0] : null;
  const timelineEvents = tab === 'upcoming' ? upcoming.slice(1) : past;
  const monthGroups    = groupByMonth(timelineEvents, lang);

  // Running index for stagger animations across all rows
  let animCounter = 0;

  return (
    <div>
      <PageHeader
        breadcrumb={lang === 'sw' ? 'Kanisa' : 'Church'}
        title={lang === 'sw' ? 'Ratiba ya Matukio' : 'Event Schedule'}
        subtitle={lang === 'sw'
          ? `Matukio ${upcoming.length} yanayokuja`
          : `${upcoming.length} upcoming event${upcoming.length !== 1 ? 's' : ''}`}
        action={canManage && (
          <button onClick={openCreate} className="btn-primary">
            + {lang === 'sw' ? 'Tukio Jipya' : 'New Event'}
          </button>
        )}
      />

      <div className="px-8 py-8 max-w-content">

        {/* ── Underline tab bar ── */}
        <div style={{ display: 'flex', borderBottom: '0.5px solid var(--tw-color-hairline)', marginBottom: 24 }}
          className="border-hairline"
        >
          {[
            { id: 'upcoming', en: 'Upcoming', sw: 'Yanayokuja' },
            { id: 'past',     en: 'Past',     sw: 'Yaliyopita' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '10px 20px',
                fontSize: 13, fontWeight: 500,
                background: 'none', border: 'none',
                borderBottom: tab === t.id ? '2px solid #1B3A6B' : '2px solid transparent',
                color: tab === t.id ? '#1B3A6B' : undefined,
                cursor: 'pointer',
                marginBottom: '-0.5px',
                transition: 'color 0.12s, border-color 0.12s',
              }}
              className={tab === t.id ? '' : 'text-ink-muted hover:text-ink'}
            >
              {lang === 'sw' ? t.sw : t.en}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="py-16 flex justify-center">
            <span className="w-5 h-5 border-2 border-border border-t-ink-muted rounded-full animate-spin" />
          </div>
        ) : (tab === 'upcoming' ? upcoming : past).length === 0 ? (
          <div className="py-16 text-center text-ink-muted text-sm">
            {lang === 'sw' ? 'Hakuna matukio hapa' : 'No events here'}
          </div>
        ) : (
          <>
            {/* Hero card — first upcoming event only */}
            {heroEvent && (
              <HeroEventCard
                event={heroEvent}
                lang={lang}
                canManage={canManage}
                onEdit={openEdit}
                onDelete={setDeleteId}
              />
            )}

            {/* Month-grouped timeline rows */}
            {monthGroups.map(group => (
              <div key={group.key} style={{ marginBottom: 24 }}>
                <MonthLabel label={group.label} />
                {group.events.map(e => {
                  const idx = animCounter++;
                  return (
                    <EventRow
                      key={e.id}
                      event={e}
                      lang={lang}
                      canManage={canManage}
                      onEdit={openEdit}
                      onDelete={setDeleteId}
                      isPast={tab === 'past'}
                      animIndex={idx}
                    />
                  );
                })}
              </div>
            ))}
          </>
        )}
      </div>

      {/* ── Create / Edit Modal ── */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editEvent
          ? (lang === 'sw' ? 'Hariri Tukio' : 'Edit Event')
          : (lang === 'sw' ? 'Tukio Jipya' : 'New Event')}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">{lang === 'sw' ? 'Kichwa (Kiingereza)' : 'Title (English)'}</label>
              <input value={form.title_en} onChange={set('title_en')} className="field-input" required />
            </div>
            <div>
              <label className="field-label">{lang === 'sw' ? 'Kichwa (Kiswahili)' : 'Title (Swahili)'}</label>
              <input value={form.title_sw} onChange={set('title_sw')} className="field-input" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">{lang === 'sw' ? 'Tarehe' : 'Date'}</label>
              <input type="date" value={form.event_date} onChange={set('event_date')} className="field-input" required />
            </div>
            <div>
              <label className="field-label">{lang === 'sw' ? 'Mahali' : 'Location'}</label>
              <input value={form.location} onChange={set('location')} placeholder={lang === 'sw' ? 'e.g. Kanisa Kuu' : 'e.g. Main Sanctuary'} className="field-input" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">{lang === 'sw' ? 'Saa ya Kuanza' : 'Start Time'}</label>
              <input type="time" value={form.start_time} onChange={set('start_time')} className="field-input" required />
            </div>
            <div>
              <label className="field-label">{lang === 'sw' ? 'Saa ya Kumaliza' : 'End Time'}</label>
              <input type="time" value={form.end_time} onChange={set('end_time')} className="field-input" />
            </div>
          </div>

          <div>
            <label className="field-label">{lang === 'sw' ? 'Maelezo (Kiingereza)' : 'Description (English)'}</label>
            <textarea value={form.description_en} onChange={set('description_en')} rows={2} className="field-input resize-none" />
          </div>
          <div>
            <label className="field-label">{lang === 'sw' ? 'Maelezo (Kiswahili)' : 'Description (Swahili)'}</label>
            <textarea value={form.description_sw} onChange={set('description_sw')} rows={2} className="field-input resize-none" />
          </div>

          <div className="hairline" />
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">
              {lang === 'sw' ? 'Ghairi' : 'Cancel'}
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving
                ? <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    {lang === 'sw' ? 'Inahifadhi...' : 'Saving...'}
                  </span>
                : (lang === 'sw' ? 'Hifadhi' : 'Save')}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Delete confirm ── */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title={lang === 'sw' ? 'Futa Tukio?' : 'Delete Event?'}>
        <p className="text-sm text-ink-muted">
          {lang === 'sw' ? 'Una uhakika unataka kufuta tukio hili?' : 'Are you sure you want to delete this event?'}
        </p>
        <div className="hairline mt-5 mb-4" />
        <div className="flex gap-3 justify-end">
          <button onClick={() => setDeleteId(null)} className="btn-secondary">{lang === 'sw' ? 'Ghairi' : 'Cancel'}</button>
          <button onClick={() => handleDelete(deleteId)} className="btn-danger">{lang === 'sw' ? 'Futa' : 'Delete'}</button>
        </div>
      </Modal>

      <Toast toast={toast} />
    </div>
  );
}