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

const EMPTY_FORM = { title_en:'', title_sw:'', description_en:'', description_sw:'', event_date:'', start_time:'', end_time:'', location:'' };

export default function EventsPage() {
  const { user, lang } = useAuth();
  const [events, setEvents]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editEvent, setEditEvent] = useState(null);
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [tab, setTab]           = useState('upcoming'); // upcoming | past

  const showToast = (msg, type='success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

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
      start_time: e.start_time?.slice(0,5) || '',
      end_time:   e.end_time?.slice(0,5) || '',
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
  const displayed = tab === 'upcoming' ? upcoming : past;

  return (
    <div>
      <PageHeader
        breadcrumb={lang === 'sw' ? 'Kanisa' : 'Church'}
        title={lang === 'sw' ? 'Ratiba ya Matukio' : 'Event Schedule'}
        subtitle={lang === 'sw' ? `Matukio ${upcoming.length} yanayokuja` : `${upcoming.length} upcoming event${upcoming.length !== 1 ? 's' : ''}`}
        action={canManage && (
          <button onClick={openCreate} className="btn-primary">
            + {lang === 'sw' ? 'Tukio Jipya' : 'New Event'}
          </button>
        )}
      />

      <div className="px-8 py-8 max-w-content">

        {/* Tab switcher — Rule 3: control */}
        <div className="flex items-center gap-1 bg-canvas border border-hairline rounded-lg p-1 w-fit mb-6">
          {[
            { id: 'upcoming', en: 'Upcoming', sw: 'Yanayokuja' },
            { id: 'past',     en: 'Past',     sw: 'Yaliyopita' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors duration-100
                ${tab === t.id ? 'bg-ink text-white' : 'text-ink-muted hover:text-ink'}`}>
              {lang === 'sw' ? t.sw : t.en}
            </button>
          ))}
        </div>

        <div className="hairline mb-0" />

        {loading ? (
          <div className="py-16 flex justify-center">
            <span className="w-5 h-5 border-2 border-border border-t-ink-muted rounded-full animate-spin" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="py-16 text-center text-ink-muted text-sm">
            {lang === 'sw' ? 'Hakuna matukio hapa' : 'No events here'}
          </div>
        ) : (
          displayed.map((e, i) => {
            const dateStr = e.event_date?.split('T')[0] || e.event_date;
            return (
              <div key={e.id} className={`animate-slide-up stagger-${Math.min(i+1,6)}`}>
                <div className="py-5 flex items-start gap-5">

                  {/* Date block — monospace, no box (Rule 1) */}
                  <div className="flex-shrink-0 w-14 text-center">
                    <div className="font-mono text-2xl font-bold text-ink leading-none">
                      {new Date(dateStr + 'T00:00:00').getDate()}
                    </div>
                    <div className="text-2xs text-ink-faint uppercase tracking-wider mt-0.5">
                      {MONTHS[lang][new Date(dateStr + 'T00:00:00').getMonth()]?.slice(0,3)}
                    </div>
                  </div>

                  {/* Hairline vertical separator */}
                  <div className="w-px bg-hairline self-stretch flex-shrink-0" />

                  {/* Event details */}
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-bold text-ink text-lg leading-snug">
                      {lang === 'sw' ? e.title_sw : e.title_en}
                    </p>

                    {/* Time + location — Rule 5: plain text */}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className="text-xs text-ink-muted font-mono">
                        {formatTime(e.start_time)}
                        {e.end_time ? ` – ${formatTime(e.end_time)}` : ''}
                      </span>
                      {e.location && (
                        <>
                          <span className="text-ink-faint text-xs">·</span>
                          <span className="text-xs text-ink-muted">{e.location}</span>
                        </>
                      )}
                      <span className="text-ink-faint text-xs">·</span>
                      <span className="text-xs text-ink-faint">{formatDate(dateStr, lang)}</span>
                    </div>

                    {/* Description */}
                    {(lang === 'sw' ? e.description_sw : e.description_en) && (
                      <p className="text-sm text-ink-muted mt-2 leading-relaxed line-clamp-2">
                        {lang === 'sw' ? e.description_sw : e.description_en}
                      </p>
                    )}

                    {/* Created by */}
                    <p className="text-xs text-ink-faint mt-2">
                      {lang === 'sw' ? 'Iliundwa na' : 'Created by'} {e.created_by_name}
                    </p>
                  </div>

                  {/* Actions */}
                  {canManage && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => openEdit(e)} className="btn-ghost text-xs">{lang === 'sw' ? 'Hariri' : 'Edit'}</button>
                      <button onClick={() => setDeleteId(e.id)} className="btn-ghost text-xs text-danger">{lang === 'sw' ? 'Futa' : 'Delete'}</button>
                    </div>
                  )}
                </div>
                <div className="hairline" />
              </div>
            );
          })
        )}
      </div>

      {/* Create / Edit Modal */}
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
                ? <span className="flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />{lang === 'sw' ? 'Inahifadhi...' : 'Saving...'}</span>
                : (lang === 'sw' ? 'Hifadhi' : 'Save')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm */}
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
