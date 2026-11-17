'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../../hooks/useAuth';
import { meetingApi, userApi } from '../../../../lib/api';

// ─────────────────────────────────────────────────────────────
// ICONS
// ─────────────────────────────────────────────────────────────
const IconCalendar   = ({ className = '' }) => <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}><rect x="2" y="4" width="16" height="14" rx="2"/><path d="M2 8h16M6 2v4M14 2v4" strokeLinecap="round"/></svg>;
const IconClock      = ({ className = '' }) => <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}><circle cx="10" cy="10" r="8"/><path d="M10 6v4l2.5 2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const IconMapPin     = ({ className = '' }) => <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M10 2a6 6 0 0 1 6 6c0 4-6 10-6 10S4 12 4 8a6 6 0 0 1 6-6z"/><circle cx="10" cy="8" r="2"/></svg>;
const IconUsers      = ({ className = '' }) => <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}><circle cx="7" cy="6" r="3"/><path d="M1 17c0-3.314 2.686-6 6-6" strokeLinecap="round"/><circle cx="14" cy="6" r="3"/><path d="M19 17c0-3.314-2.686-6-6-6" strokeLinecap="round"/></svg>;
const IconCheckCircle= ({ className = '' }) => <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}><circle cx="10" cy="10" r="8"/><path d="M6.5 10l2.5 2.5 4.5-4.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const IconAlertCircle= ({ className = '' }) => <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}><circle cx="10" cy="10" r="8"/><path d="M10 6v4M10 14h.01" strokeLinecap="round"/></svg>;
const IconPlus       = ({ className = '' }) => <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}><path d="M10 4v12M4 10h12" strokeLinecap="round"/></svg>;
const IconX          = ({ className = '' }) => <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.75}><path d="M5 5l10 10M15 5L5 15" strokeLinecap="round"/></svg>;
const IconEdit       = ({ className = '' }) => <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M14.5 3.5a2.121 2.121 0 0 1 3 3L6 18H3v-3L14.5 3.5z" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const IconTrash      = ({ className = '' }) => <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M3 6h14M8 6V4h4v2M6 6l1 11h6l1-11" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const IconFileText   = ({ className = '' }) => <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M4 2h8l4 4v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1"/><path d="M12 2v4h4M7 9h6M7 12h6M7 15h4" strokeLinecap="round"/></svg>;
const IconUpload     = ({ className = '' }) => <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M10 13V4M6 7l4-4 4 4" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 14v2a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2" strokeLinecap="round"/></svg>;
const IconDownload   = ({ className = '' }) => <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M10 4v9M6 10l4 4 4-4" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 14v2a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2" strokeLinecap="round"/></svg>;
const IconChevronLeft= ({ className = '' }) => <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M12.5 4.5l-5 5.5 5 5.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const IconChurch     = ({ className = '' }) => <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M10 2v4M8 4h4" strokeLinecap="round"/><path d="M4 18V9l6-4 6 4v9"/><rect x="8" y="13" width="4" height="5"/></svg>;
const IconSearch     = ({ className = '' }) => <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}><circle cx="8.5" cy="8.5" r="5.5"/><path d="M14.5 14.5l3 3" strokeLinecap="round"/></svg>;
const IconSave       = ({ className = '' }) => <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M4 2h9l4 4v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"/><path d="M7 2v5h6V2M7 13h6" strokeLinecap="round"/></svg>;
const IconUserCheck  = ({ className = '' }) => <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}><circle cx="8" cy="6" r="3"/><path d="M2 17c0-3.314 2.686-6 6-6" strokeLinecap="round"/><path d="M12 15l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/></svg>;

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const MANAGERS = ['pastor', 'elder'];

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' });
}
function formatTime(t) {
  if (!t) return null;
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
}
function formatBytes(kb) {
  if (!kb) return '';
  if (kb < 1024) return `${kb} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function statusConfig(s) {
  switch (s) {
    case 'scheduled': return { label: 'Imepangwa',    cls: 'badge-gold'    };
    case 'held':      return { label: 'Ilifanyika',   cls: 'badge-success' };
    case 'cancelled': return { label: 'Ilifutwa',     cls: 'badge-danger'  };
    case 'postponed': return { label: 'Imeahirishwa', cls: 'badge-warning' };
    default:          return { label: s,              cls: 'badge-neutral' };
  }
}

function resStatusConfig(s) {
  switch (s) {
    case 'pending':     return { label: 'Inasubiri',   cls: 'badge-warning', dot: 'pending'  };
    case 'in_progress': return { label: 'Inaendelea',  cls: 'badge-gold',    dot: 'active'   };
    case 'completed':   return { label: 'Imekamilika', cls: 'badge-success', dot: 'active'   };
    case 'cancelled':   return { label: 'Imefutwa',    cls: 'badge-danger',  dot: 'danger'   };
    case 'deferred':    return { label: 'Imeahirishwa',cls: 'badge-neutral', dot: 'inactive' };
    default:            return { label: s,             cls: 'badge-neutral', dot: 'inactive' };
  }
}

function urgencyDot(deadline, status) {
  if (status === 'completed' || status === 'cancelled') return 'active';
  if (!deadline) return 'inactive';
  const d = new Date(deadline);
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = (d - today) / 86400000;
  if (diff < 0) return 'danger';
  if (diff <= 7) return 'pending';
  return 'active';
}

function attendanceConfig(t) {
  switch (t) {
    case 'present': return { label: 'Alihudhuia',      cls: 'badge-success' };
    case 'apology': return { label: 'Alitoa Udhuru',   cls: 'badge-warning' };
    case 'absent':  return { label: 'Hakuhudhuia',     cls: 'badge-danger'  };
    default:        return { label: t,                 cls: 'badge-neutral' };
  }
}

function docTypeConfig(t) {
  switch (t) {
    case 'minutes': return { label: 'Kumbukumbu', cls: 'badge-navy'    };
    case 'agenda':  return { label: 'Ajenda',     cls: 'badge-gold'    };
    case 'report':  return { label: 'Ripoti',     cls: 'badge-neutral' };
    case 'photo':   return { label: 'Picha',      cls: 'badge-success' };
    default:        return { label: 'Nyingine',   cls: 'badge-neutral' };
  }
}

// ─────────────────────────────────────────────────────────────
// EDIT MEETING MODAL (reuses same modal pattern from list page)
// ─────────────────────────────────────────────────────────────
function EditMeetingModal({ meeting, meetingTypes, onClose, onSave, currentUser }) {
  const [form, setForm] = useState({
    meeting_type_id:     meeting.meeting_type_id     ?? '',
    title:               meeting.title               ?? '',
    meeting_date:        meeting.meeting_date?.slice(0,10) ?? '',
    start_time:          meeting.start_time          ?? '',
    end_time:            meeting.end_time            ?? '',
    venue:               meeting.venue               ?? '',
    agenda:              meeting.agenda              ?? '',
    summary:             meeting.summary             ?? '',
    status:              meeting.status              ?? 'scheduled',
    cancellation_reason: meeting.cancellation_reason ?? '',
    convened_by_id:      meeting.convened_by_id      ?? '',
    secretary_id:        meeting.secretary_id        ?? '',
    quorum_met:          meeting.quorum_met          ?? '',
    total_attendees:     meeting.total_attendees     ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  function set(f, v) { setForm(p => ({ ...p, [f]: v })); }

  async function handleSubmit(e) {
    e.preventDefault(); setError('');
    setSaving(true);
    try {
      await meetingApi.update(meeting.id, {
        ...form,
        group_id:            meeting.group_id || null,
        start_time:          form.start_time  || null,
        end_time:            form.end_time    || null,
        venue:               form.venue       || null,
        agenda:              form.agenda      || null,
        summary:             form.summary     || null,
        convened_by_id:      form.convened_by_id || null,
        secretary_id:        form.secretary_id   || null,
        quorum_met:          form.quorum_met !== '' ? Number(form.quorum_met) : null,
        total_attendees:     form.total_attendees || null,
        cancellation_reason: form.cancellation_reason || null,
      });
      onSave();
    } catch (err) { setError(err.message || 'Imeshindwa kuhifadhi.'); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 600 }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Hariri Kikao</h2>
            <p className="card-subtitle mt-0.5">{meeting.title}</p>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><IconX className="w-4 h-4"/></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:'1rem', overflowY:'auto', maxHeight:'calc(100vh - 220px)' }}>
            {error && (
              <div className="banner banner-danger">
                <IconAlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5"/>
                <span className="text-sm">{error}</span>
              </div>
            )}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
              <div className="form-group">
                <label className="form-label">Aina ya Kikao *</label>
                <select className="select" value={form.meeting_type_id} onChange={e => set('meeting_type_id', e.target.value)} required>
                  <option value="">— Chagua —</option>
                  {meetingTypes.map(t => <option key={t.id} value={t.id}>{t.name_sw}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Hali</label>
                <select className="select" value={form.status} onChange={e => set('status', e.target.value)}>
                  <option value="scheduled">Imepangwa</option>
                  <option value="held">Ilifanyika</option>
                  <option value="cancelled">Imefutwa</option>
                  <option value="postponed">Imeahirishwa</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Kichwa cha Kikao *</label>
              <input className="input" value={form.title} onChange={e => set('title', e.target.value)} required/>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'1rem' }}>
              <div className="form-group">
                <label className="form-label">Tarehe *</label>
                <input type="date" className="input" value={form.meeting_date} onChange={e => set('meeting_date', e.target.value)} required/>
              </div>
              <div className="form-group">
                <label className="form-label">Kuanza</label>
                <input type="time" className="input" value={form.start_time} onChange={e => set('start_time', e.target.value)}/>
              </div>
              <div className="form-group">
                <label className="form-label">Kumaliza</label>
                <input type="time" className="input" value={form.end_time} onChange={e => set('end_time', e.target.value)}/>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
              <div className="form-group">
                <label className="form-label">Mahali</label>
                <input className="input" placeholder="Kanisa Kuu, Chumba cha Mikutano…" value={form.venue} onChange={e => set('venue', e.target.value)}/>
              </div>
              <div className="form-group">
                <label className="form-label">Quorum</label>
                <select className="select" value={String(form.quorum_met ?? '')} onChange={e => set('quorum_met', e.target.value)}>
                  <option value="">— Haijulikani —</option>
                  <option value="1">Ilifikiwa</option>
                  <option value="0">Haikufikiwa</option>
                </select>
              </div>
            </div>
            {(form.status === 'cancelled' || form.status === 'postponed') && (
              <div className="form-group">
                <label className="form-label">Sababu</label>
                <input className="input" placeholder="Sababu ya kufutwa / kuahirishwa" value={form.cancellation_reason} onChange={e => set('cancellation_reason', e.target.value)}/>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Agenda</label>
              <textarea className="textarea" rows={3} value={form.agenda} onChange={e => set('agenda', e.target.value)}/>
            </div>
            <div className="form-group">
              <label className="form-label">Muhtasari</label>
              <textarea className="textarea" rows={3} value={form.summary} onChange={e => set('summary', e.target.value)}/>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Ghairi</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Inahifadhi…' : 'Hifadhi Mabadiliko'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ADD RESOLUTION MODAL
// ─────────────────────────────────────────────────────────────
function ResolutionModal({ meetingId, resolution, members, onClose, onSave }) {
  const isEdit = !!resolution?.id;
  const [form, setForm] = useState({
    description:          resolution?.description          ?? '',
    responsible_member_id:resolution?.responsible_member_id?? '',
    responsible_note:     resolution?.responsible_note     ?? '',
    deadline:             resolution?.deadline?.slice(0,10) ?? '',
    implementation_status:resolution?.implementation_status?? 'pending',
    progress_notes:       resolution?.progress_notes       ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [memberSearch, setMemberSearch] = useState('');

  function set(f, v) { setForm(p => ({ ...p, [f]: v })); }

  const filteredMembers = members.filter(m =>
    m.full_name?.toLowerCase().includes(memberSearch.toLowerCase())
  ).slice(0, 50);

  async function handleSubmit(e) {
    e.preventDefault(); setError('');
    setSaving(true);
    try {
      const payload = {
        ...form,
        responsible_member_id: form.responsible_member_id || null,
        responsible_note:      form.responsible_note      || null,
        deadline:              form.deadline              || null,
        progress_notes:        form.progress_notes        || null,
      };
      if (isEdit) {
        await meetingApi.updateResolution(meetingId, resolution.id, payload);
      } else {
        await meetingApi.addResolution(meetingId, payload);
      }
      onSave();
    } catch (err) { setError(err.message || 'Imeshindwa kuhifadhi.'); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">{isEdit ? 'Hariri Uamuzi' : 'Uamuzi Mpya'}</h2>
            <p className="card-subtitle mt-0.5">Sajili azimio / uamuzi wa kikao</p>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><IconX className="w-4 h-4"/></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:'1rem', overflowY:'auto', maxHeight:'calc(100vh - 220px)' }}>
            {error && (
              <div className="banner banner-danger">
                <IconAlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5"/>
                <span className="text-sm">{error}</span>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Maelezo ya Uamuzi *</label>
              <textarea className="textarea" rows={3} placeholder="Eleza uamuzi uliofanywa…" value={form.description} onChange={e => set('description', e.target.value)} required/>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
              <div className="form-group">
                <label className="form-label">Anayehusika</label>
                <div style={{ position:'relative' }}>
                  <div className="search-bar" style={{ marginBottom: '0.25rem' }}>
                    <IconSearch className="w-3.5 h-3.5" style={{ color:'var(--text-tertiary)', flexShrink:0 }}/>
                    <input placeholder="Tafuta mwanachama…" value={memberSearch} onChange={e => setMemberSearch(e.target.value)}/>
                  </div>
                  <select className="select" value={form.responsible_member_id} onChange={e => set('responsible_member_id', e.target.value)}>
                    <option value="">— Chagua —</option>
                    {filteredMembers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Tarehe ya Mwisho</label>
                <input type="date" className="input" value={form.deadline} onChange={e => set('deadline', e.target.value)}/>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Jina la Mtu (kama sio mwanachama)</label>
              <input className="input" placeholder="mfano: Mhandisi wa Kanisa" value={form.responsible_note} onChange={e => set('responsible_note', e.target.value)}/>
            </div>
            {isEdit && (
              <>
                <div className="form-group">
                  <label className="form-label">Hali ya Utekelezaji</label>
                  <select className="select" value={form.implementation_status} onChange={e => set('implementation_status', e.target.value)}>
                    <option value="pending">Inasubiri</option>
                    <option value="in_progress">Inaendelea</option>
                    <option value="completed">Imekamilika</option>
                    <option value="cancelled">Imefutwa</option>
                    <option value="deferred">Imeahirishwa</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Maelezo ya Maendeleo</label>
                  <textarea className="textarea" rows={2} value={form.progress_notes} onChange={e => set('progress_notes', e.target.value)}/>
                </div>
              </>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Ghairi</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Inahifadhi…' : (isEdit ? 'Hifadhi Mabadiliko' : 'Ongeza Uamuzi')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ADD ATTENDEE MODAL
// ─────────────────────────────────────────────────────────────
function AttendeeModal({ meetingId, members, existingIds, onClose, onSave }) {
  const [form, setForm] = useState({
    member_id:       '',
    attendance_type: 'present',
    role_in_meeting: '',
    notes:           '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [search, setSearch] = useState('');

  function set(f, v) { setForm(p => ({ ...p, [f]: v })); }

  const available = members
    .filter(m => !existingIds.has(m.id))
    .filter(m => m.full_name?.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 60);

  async function handleSubmit(e) {
    e.preventDefault(); setError('');
    setSaving(true);
    try {
      await meetingApi.addAttendee(meetingId, {
        ...form,
        role_in_meeting: form.role_in_meeting || null,
        notes:           form.notes           || null,
      });
      onSave();
    } catch (err) { setError(err.message || 'Imeshindwa kuhifadhi.'); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Ongeza Mhudhuria</h2>
            <p className="card-subtitle mt-0.5">Sajili mwanachama aliyehudhuria</p>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><IconX className="w-4 h-4"/></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:'1rem', overflowY:'auto', maxHeight:'calc(100vh - 220px)' }}>
            {error && (
              <div className="banner banner-danger">
                <IconAlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5"/>
                <span className="text-sm">{error}</span>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Mwanachama *</label>
              <div className="search-bar" style={{ marginBottom:'0.375rem' }}>
                <IconSearch className="w-3.5 h-3.5" style={{ color:'var(--text-tertiary)', flexShrink:0 }}/>
                <input placeholder="Tafuta jina…" value={search} onChange={e => setSearch(e.target.value)}/>
              </div>
              <select className="select" value={form.member_id} onChange={e => set('member_id', e.target.value)} required>
                <option value="">— Chagua mwanachama —</option>
                {available.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
              <div className="form-group">
                <label className="form-label">Hali ya Uhudhuria</label>
                <select className="select" value={form.attendance_type} onChange={e => set('attendance_type', e.target.value)}>
                  <option value="present">Alihudhuia</option>
                  <option value="apology">Alitoa Udhuru</option>
                  <option value="absent">Hakuhudhuia</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Jukumu Katika Kikao</label>
                <input className="input" placeholder="Mwenyekiti, Katibu…" value={form.role_in_meeting} onChange={e => set('role_in_meeting', e.target.value)}/>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Ghairi</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Inahifadhi…' : 'Ongeza Mhudhuria'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// UPLOAD DOCUMENT MODAL
// ─────────────────────────────────────────────────────────────
function UploadDocModal({ meetingId, onClose, onSave }) {
  const [file, setFile]       = useState(null);
  const [form, setForm]       = useState({ document_type: 'minutes', title: '' });
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const fileRef               = useRef();

  function set(f, v) { setForm(p => ({ ...p, [f]: v })); }

  async function handleSubmit(e) {
    e.preventDefault(); setError('');
    if (!file) { setError('Tafadhali chagua faili.'); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('document_type', form.document_type);
      if (form.title) fd.append('title', form.title);
      await meetingApi.uploadDocument(meetingId, fd);
      onSave();
    } catch (err) { setError(err.message || 'Imeshindwa kupakia.'); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Pakia Nyaraka</h2>
            <p className="card-subtitle mt-0.5">Kumbukumbu, ajenda, ripoti au picha</p>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><IconX className="w-4 h-4"/></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:'1rem', overflowY:'auto', maxHeight:'calc(100vh - 220px)' }}>
            {error && (
              <div className="banner banner-danger">
                <IconAlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5"/>
                <span className="text-sm">{error}</span>
              </div>
            )}
            {/* Drop zone */}
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                border: '2px dashed var(--border-default)',
                borderRadius: 10,
                padding: '1.5rem',
                textAlign: 'center',
                cursor: 'pointer',
                background: file ? 'var(--surface-sunken)' : 'transparent',
                transition: 'background 0.15s',
              }}
            >
              <input ref={fileRef} type="file" style={{ display:'none' }} onChange={e => setFile(e.target.files[0])}/>
              <IconUpload className="w-7 h-7" style={{ color:'var(--text-tertiary)', margin:'0 auto 0.5rem' }}/>
              {file ? (
                <div>
                  <p className="text-sm font-medium text-navy-900">{file.name}</p>
                  <p className="text-xs text-navy-500 mt-1">{formatBytes(Math.ceil(file.size / 1024))}</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium text-navy-700">Bonyeza kupakia faili</p>
                  <p className="text-xs text-navy-400 mt-1">PDF, Word, Excel, Picha</p>
                </div>
              )}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
              <div className="form-group">
                <label className="form-label">Aina ya Nyaraka</label>
                <select className="select" value={form.document_type} onChange={e => set('document_type', e.target.value)}>
                  <option value="minutes">Kumbukumbu</option>
                  <option value="agenda">Ajenda</option>
                  <option value="report">Ripoti</option>
                  <option value="photo">Picha</option>
                  <option value="other">Nyingine</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Jina (hiari)</label>
                <input className="input" placeholder="Itakumbusha chini ya faili…" value={form.title} onChange={e => set('title', e.target.value)}/>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Ghairi</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Inapakia…' : 'Pakia Faili'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CONFIRM DELETE MODAL
// ─────────────────────────────────────────────────────────────
function ConfirmModal({ title, body, confirmLabel = 'Futa', onClose, onConfirm, danger = true }) {
  const [loading, setLoading] = useState(false);
  async function go() {
    setLoading(true);
    await onConfirm();
    setLoading(false);
  }
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><IconX className="w-4 h-4"/></button>
        </div>
        <div className="modal-body">
          <p className="text-sm text-navy-700">{body}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>Ghairi</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={go} disabled={loading}>
            {loading ? 'Inafuta…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// INLINE STATUS PICKER for resolutions
// ─────────────────────────────────────────────────────────────
function StatusPicker({ currentStatus, onSelect }) {
  const [open, setOpen] = useState(false);
  const opts = ['pending','in_progress','completed','cancelled','deferred'];
  const cfg  = resStatusConfig(currentStatus);
  return (
    <div style={{ position:'relative', display:'inline-block' }}>
      <button
        className={`badge ${cfg.cls}`}
        style={{ cursor:'pointer' }}
        onClick={() => setOpen(o => !o)}
      >
        {cfg.label} ▾
      </button>
      {open && (
        <div
          className="card"
          style={{ position:'absolute', top:'calc(100% + 4px)', left:0, zIndex:50, minWidth:160, padding:'0.375rem 0', boxShadow:'var(--shadow-lg)' }}
        >
          {opts.map(o => {
            const c = resStatusConfig(o);
            return (
              <button
                key={o}
                style={{ display:'block', width:'100%', textAlign:'left', padding:'0.4rem 0.75rem', background:'none', border:'none', cursor:'pointer', fontSize:'0.8125rem' }}
                className="hover-row"
                onClick={() => { onSelect(o); setOpen(false); }}
              >
                <span className={`badge ${c.cls}`}>{c.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────
export default function MeetingDetailPage() {
  const params   = useParams();
  const id       = params?.id;
  const router   = useRouter();
  const { user } = useAuth();

  const canManage = user && MANAGERS.includes(user.role);
  const canEdit   = user && ['pastor','elder','group_leader'].includes(user.role);

  // ── Data ─────────────────────────────────────────────────
  const [meeting,     setMeeting]     = useState(null);
  const [attendees,   setAttendees]   = useState([]);
  const [resolutions, setResolutions] = useState([]);
  const [documents,   setDocuments]   = useState([]);
  const [meetingTypes,setMeetingTypes]= useState([]);
  const [allMembers,  setAllMembers]  = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');

  // ── UI state ──────────────────────────────────────────────
  const [activeTab,      setActiveTab]      = useState('overview');
  const [showEdit,       setShowEdit]       = useState(false);
  const [showAddRes,     setShowAddRes]     = useState(false);
  const [showAddAtt,     setShowAddAtt]     = useState(false);
  const [showUploadDoc,  setShowUploadDoc]  = useState(false);
  const [editResolution, setEditResolution] = useState(null);
  const [confirmDelete,  setConfirmDelete]  = useState(null); // { type, id, label }
  const [attSearch,      setAttSearch]      = useState('');
  const [resSearch,      setResSearch]      = useState('');
  const [resFilter,      setResFilter]      = useState('');

  // ── Fetch ─────────────────────────────────────────────────
  const fetchMeeting = useCallback(async () => {
    if (!id) return;
    setLoading(true); setError('');
    try {
      const [mRes, aRes, rRes, dRes, tRes] = await Promise.all([
        meetingApi.getById(id),
        meetingApi.getAttendees(id),
        meetingApi.getResolutions(id),
        meetingApi.getDocuments(id),
        meetingApi.getTypes(),
      ]);
      setMeeting(mRes.data.data);
      setAttendees(aRes.data.data || []);
      setResolutions(rRes.data.data || []);
      setDocuments(dRes.data.data || []);
      setMeetingTypes(tRes.data.data || []);
    } catch (err) {
      setError(err.message || 'Imeshindwa kupakia kikao.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Fetch member list once (lazy — only when user opens attendees/resolutions tabs)
  const fetchMembers = useCallback(async () => {
    if (allMembers.length > 0) return;
    try {
      const res = await userApi.getMembers({ limit: 500 });
      setAllMembers(res.data.data || res.data || []);
    } catch {}
  }, [allMembers.length]);

  useEffect(() => { fetchMeeting(); }, [fetchMeeting]);
  useEffect(() => {
    if (activeTab === 'attendees' || activeTab === 'resolutions') fetchMembers();
  }, [activeTab, fetchMembers]);

  // ── Derived ───────────────────────────────────────────────
  const existingAttendeeIds = new Set(attendees.map(a => a.member_id));

  const filteredAttendees = attendees.filter(a =>
    !attSearch || a.full_name?.toLowerCase().includes(attSearch.toLowerCase())
  );

  const filteredResolutions = resolutions.filter(r => {
    if (resFilter && r.implementation_status !== resFilter) return false;
    if (resSearch && !r.description?.toLowerCase().includes(resSearch.toLowerCase())) return false;
    return true;
  });

  // ── Resolution inline status update ──────────────────────
  async function handleResStatusChange(resId, newStatus) {
    try {
      await meetingApi.updateResolution(id, resId, { implementation_status: newStatus });
      setResolutions(prev => prev.map(r => r.id === resId ? { ...r, implementation_status: newStatus } : r));
    } catch (err) {
      alert(err.message || 'Imeshindwa kubadilisha hali.');
    }
  }

  // ── Delete handlers ───────────────────────────────────────
  async function handleDeleteMeeting() {
    await meetingApi.delete(id);
    router.push('/dashboard/meetings');
  }
  async function handleDeleteResolution(resId) {
    await meetingApi.deleteResolution(id, resId);
    setResolutions(prev => prev.filter(r => r.id !== resId));
    setConfirmDelete(null);
  }
  async function handleDeleteDocument(docId) {
    await meetingApi.deleteDocument(id, docId);
    setDocuments(prev => prev.filter(d => d.id !== docId));
    setConfirmDelete(null);
  }
  async function handleRemoveAttendee(attId) {
    await meetingApi.removeAttendee(id, attId);
    setAttendees(prev => prev.filter(a => a.attendance_id !== attId));
    setConfirmDelete(null);
  }

  // ─────────────────────────────────────────────────────────
  // LOADING
  // ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div>
        <div className="page-header">
          <div className="skeleton" style={{ width:120, height:16, marginBottom:8 }}/>
          <div className="skeleton" style={{ width:320, height:28 }}/>
        </div>
        <div className="px-8 py-8 max-w-content">
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:'1rem', marginBottom:'2rem' }}>
            {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height:80, borderRadius:12 }}/>)}
          </div>
          <div className="skeleton" style={{ height:400, borderRadius:12 }}/>
        </div>
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div>
        <div className="page-header">
          <button className="btn btn-ghost btn-sm" onClick={() => router.push('/dashboard/meetings')} style={{ marginBottom:'0.5rem' }}>
            <IconChevronLeft className="w-4 h-4"/> Rudi kwenye Vikao
          </button>
          <h1 className="page-header-title">Kikao Hakipatikani</h1>
        </div>
        <div className="px-8 py-8 max-w-content">
          <div className="banner banner-danger">
            <IconAlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5"/>
            <span className="text-sm">{error || 'Kikao hakikupatikana au huna ruhusa ya kukiangalia.'}</span>
          </div>
        </div>
      </div>
    );
  }

  const { label: statusLabel, cls: statusCls } = statusConfig(meeting.status);

  // attendance summary
  const attSummary = {
    total:   attendees.length,
    present: attendees.filter(a => a.attendance_type === 'present').length,
    apology: attendees.filter(a => a.attendance_type === 'apology').length,
    absent:  attendees.filter(a => a.attendance_type === 'absent').length,
  };

  // resolution summary
  const resSummary = {
    total:    resolutions.length,
    open:     resolutions.filter(r => ['pending','in_progress'].includes(r.implementation_status)).length,
    done:     resolutions.filter(r => r.implementation_status === 'completed').length,
    overdue:  resolutions.filter(r => {
      if (!r.deadline || r.implementation_status === 'completed') return false;
      return new Date(r.deadline) < new Date();
    }).length,
  };

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── Page Header ───────────────────────────────────── */}
      <div className="page-header">
        <button className="btn btn-ghost btn-sm" style={{ marginBottom:'0.5rem', paddingLeft:0 }} onClick={() => router.push('/dashboard/meetings')}>
          <IconChevronLeft className="w-4 h-4"/> Vikao vyote
        </button>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'1rem' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', flexWrap:'wrap', marginBottom:'0.375rem' }}>
              <span className={`badge ${statusCls}`}>{statusLabel}</span>
              {!meeting.group_id && (
                <span className="badge badge-navy" style={{ display:'flex', alignItems:'center', gap:3 }}>
                  <IconChurch className="w-2.5 h-2.5"/> Kanisa Lote
                </span>
              )}
              {meeting.group_name && (
                <span className="badge badge-neutral">{meeting.group_name}</span>
              )}
              {meeting.meeting_type_name_sw && (
                <span className="badge badge-neutral">{meeting.meeting_type_name_sw}</span>
              )}
            </div>
            <h1 className="page-header-title" style={{ marginBottom:'0.25rem' }}>{meeting.title}</h1>
            <div style={{ display:'flex', alignItems:'center', gap:'1rem', flexWrap:'wrap' }} className="page-header-subtitle">
              <span style={{ display:'flex', alignItems:'center', gap:4 }}>
                <IconCalendar className="w-3.5 h-3.5"/>
                {formatDate(meeting.meeting_date)}
              </span>
              {meeting.start_time && (
                <span style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <IconClock className="w-3.5 h-3.5"/>
                  {formatTime(meeting.start_time)}
                  {meeting.end_time && ` – ${formatTime(meeting.end_time)}`}
                </span>
              )}
              {meeting.venue && (
                <span style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <IconMapPin className="w-3.5 h-3.5"/>
                  {meeting.venue}
                </span>
              )}
            </div>
          </div>
          {canEdit && (
            <div className="page-header-actions">
              <button className="btn btn-secondary" onClick={() => setShowEdit(true)}>
                <IconEdit className="w-4 h-4"/> Hariri
              </button>
              {canManage && (
                <button
                  className="btn btn-secondary"
                  style={{ color:'var(--danger)' }}
                  onClick={() => setConfirmDelete({ type:'meeting', id: meeting.id, label: meeting.title })}
                >
                  <IconTrash className="w-4 h-4"/> Futa
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="px-8 py-8 max-w-content">

        {/* ── Stat strip ──────────────────────────────────── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:'1rem', marginBottom:'2rem' }}>
          <div className="stat-card">
            <p className="stat-label">Waliohudhuria</p>
            <p className="stat-value">{attSummary.present}</p>
            {attSummary.total > 0 && (
              <p className="stat-delta neutral">{attSummary.total} wote walioandikwa</p>
            )}
          </div>
          <div className="stat-card">
            <p className="stat-label">Maamuzi</p>
            <p className="stat-value">{resSummary.total}</p>
            {resSummary.open > 0 && (
              <p className="stat-delta down">{resSummary.open} wazi</p>
            )}
          </div>
          <div className="stat-card">
            <p className="stat-label">Yamekamilika</p>
            <p className="stat-value">{resSummary.done}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Nyaraka</p>
            <p className="stat-value">{documents.length}</p>
          </div>
          {meeting.quorum_met != null && (
            <div className="stat-card">
              <p className="stat-label">Quorum</p>
              <p className="stat-value" style={{ fontSize:'1.1rem', color: meeting.quorum_met ? 'var(--success)' : 'var(--danger)' }}>
                {meeting.quorum_met ? 'Ilifikiwa' : 'Haikufikiwa'}
              </p>
            </div>
          )}
        </div>

        {/* ── Tabs ────────────────────────────────────────── */}
        <div className="tabs" style={{ marginBottom:'1.25rem' }}>
          {[
            { key:'overview',    label:'Muhtasari' },
            { key:'attendees',   label:`Wahudhuria (${attSummary.total})` },
            { key:'resolutions', label:`Maamuzi (${resSummary.total})` },
            { key:'documents',   label:`Nyaraka (${documents.length})` },
          ].map(t => (
            <button key={t.key} className={`tab ${activeTab === t.key ? 'active' : ''}`} onClick={() => setActiveTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ════════════════════════════════════════════════
            TAB: OVERVIEW
        ════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1.5fr) minmax(0,1fr)', gap:'1.5rem' }}>

            {/* Left col — agenda + summary */}
            <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
              {/* Agenda */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Agenda</h3>
                </div>
                <div className="card-body">
                  {meeting.agenda ? (
                    <p className="text-sm text-navy-700" style={{ whiteSpace:'pre-wrap', lineHeight:1.7 }}>{meeting.agenda}</p>
                  ) : (
                    <p className="text-sm text-navy-400 italic">Agenda haikuandikwa kwa kikao hiki.</p>
                  )}
                </div>
              </div>

              {/* Summary */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Muhtasari wa Kikao</h3>
                  {canEdit && (
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowEdit(true)}>
                      <IconEdit className="w-3.5 h-3.5"/> Hariri
                    </button>
                  )}
                </div>
                <div className="card-body">
                  {meeting.summary ? (
                    <p className="text-sm text-navy-700" style={{ whiteSpace:'pre-wrap', lineHeight:1.7 }}>{meeting.summary}</p>
                  ) : (
                    <p className="text-sm text-navy-400 italic">Muhtasari haujawekwa bado.</p>
                  )}
                </div>
              </div>

              {/* Cancellation reason */}
              {meeting.cancellation_reason && (
                <div className="banner banner-warning">
                  <IconAlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5"/>
                  <div>
                    <p className="text-sm font-medium">
                      {meeting.status === 'cancelled' ? 'Sababu ya Kufutwa' : 'Sababu ya Kuahirishwa'}
                    </p>
                    <p className="text-sm">{meeting.cancellation_reason}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Right col — meta + open resolutions preview */}
            <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
              {/* Meeting details */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Maelezo ya Kikao</h3>
                </div>
                <div className="card-body">
                  <dl style={{ display:'flex', flexDirection:'column', gap:'0.625rem' }}>
                    {[
                      { label:'Aina', value: meeting.meeting_type_name_sw },
                      { label:'Tarehe', value: formatDate(meeting.meeting_date) },
                      { label:'Saa ya Kuanza', value: formatTime(meeting.start_time) },
                      { label:'Saa ya Kumaliza', value: formatTime(meeting.end_time) },
                      { label:'Mahali', value: meeting.venue },
                      { label:'Mwenyekiti', value: meeting.convened_by_name },
                      { label:'Katibu', value: meeting.secretary_name },
                      { label:'Nguvu (Quorum)', value: meeting.quorum_met != null ? (meeting.quorum_met ? 'Ilifikiwa ✓' : 'Haikufikiwa') : null },
                      { label:'Jumla ya Wahudhuria', value: meeting.total_attendees },
                      { label:'Kikundi', value: meeting.group_name || 'Kanisa Lote' },
                    ].filter(r => r.value).map(({ label, value }) => (
                      <div key={label} style={{ display:'flex', justifyContent:'space-between', gap:'1rem', paddingBottom:'0.5rem', borderBottom:'1px solid var(--border-subtle)' }}>
                        <dt className="text-xs text-navy-500">{label}</dt>
                        <dd className="text-sm text-navy-900 text-right">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>

              {/* Open resolutions preview */}
              {resSummary.open > 0 && (
                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title">Maamuzi Wazi</h3>
                    <button className="btn btn-ghost btn-sm" onClick={() => setActiveTab('resolutions')}>Angalia yote</button>
                  </div>
                  <div className="card-body" style={{ padding:0 }}>
                    {resolutions
                      .filter(r => ['pending','in_progress'].includes(r.implementation_status))
                      .slice(0, 4)
                      .map(r => {
                        const cfg = resStatusConfig(r.implementation_status);
                        const dot = urgencyDot(r.deadline, r.implementation_status);
                        return (
                          <div key={r.id} style={{ display:'flex', gap:'0.625rem', padding:'0.75rem 1rem', borderBottom:'1px solid var(--border-subtle)' }}>
                            <span className={`status-dot mt-1.5 flex-shrink-0 ${dot}`}/>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-navy-900 leading-snug" style={{ display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{r.description}</p>
                              {r.responsible_name && (
                                <p className="text-xs text-navy-500 mt-0.5">{r.responsible_name}</p>
                              )}
                            </div>
                            <span className={`badge ${cfg.cls} flex-shrink-0 self-start`}>{cfg.label}</span>
                          </div>
                        );
                      })
                    }
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════
            TAB: ATTENDEES
        ════════════════════════════════════════════════ */}
        {activeTab === 'attendees' && (
          <div>
            {/* Attendance summary strip */}
            <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap', marginBottom:'1.25rem' }}>
              {[
                { label:'Waliohudhuria', count: attSummary.present, cls:'badge-success' },
                { label:'Waliotoa Udhuru', count: attSummary.apology, cls:'badge-warning' },
                { label:'Hawakuhudhuria', count: attSummary.absent,  cls:'badge-danger'  },
              ].map(s => (
                <div key={s.label} className="card" style={{ padding:'0.75rem 1rem', display:'flex', alignItems:'center', gap:'0.75rem' }}>
                  <span className={`badge ${s.cls}`} style={{ fontSize:'1rem', padding:'0.2rem 0.6rem', fontWeight:700 }}>{s.count}</span>
                  <span className="text-sm text-navy-700">{s.label}</span>
                </div>
              ))}
            </div>

            {/* Toolbar */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'0.75rem', flexWrap:'wrap', marginBottom:'0.875rem' }}>
              <div className="search-bar" style={{ minWidth:220 }}>
                <IconSearch className="w-4 h-4" style={{ color:'var(--text-tertiary)', flexShrink:0 }}/>
                <input placeholder="Tafuta mhudhuria…" value={attSearch} onChange={e => setAttSearch(e.target.value)}/>
                {attSearch && <button onClick={() => setAttSearch('')}><IconX className="w-3.5 h-3.5" style={{ color:'var(--text-tertiary)' }}/></button>}
              </div>
              {canEdit && (
                <button className="btn btn-primary btn-sm" onClick={() => setShowAddAtt(true)}>
                  <IconPlus className="w-3.5 h-3.5"/> Ongeza Mhudhuria
                </button>
              )}
            </div>

            {filteredAttendees.length === 0 ? (
              <div className="card">
                <div className="empty-state">
                  <IconUsers className="empty-state-icon"/>
                  <p className="empty-state-title">{attSearch ? 'Hakuna Matokeo' : 'Hakuna Wahudhuria'}</p>
                  <p className="empty-state-body">
                    {attSearch ? `Hakuna mhudhuria anayelingana na "${attSearch}".` : 'Bado hakuna wahudhuria waliosajiliwа kwa kikao hiki.'}
                  </p>
                  {canEdit && !attSearch && (
                    <div className="empty-state-actions">
                      <button className="btn btn-primary btn-sm" onClick={() => setShowAddAtt(true)}>
                        <IconPlus className="w-3.5 h-3.5"/> Ongeza Mhudhuria
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="card" style={{ overflow:'hidden' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Jina</th>
                      <th className="hidden sm:table-cell">Hali</th>
                      <th className="hidden md:table-cell">Jukumu</th>
                      {canEdit && <th style={{ width:48 }}></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAttendees.map(a => {
                      const cfg = attendanceConfig(a.attendance_type);
                      return (
                        <tr key={a.attendance_id}>
                          <td className="py-3 px-4">
                            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                              <div
                                className="avatar avatar-sm"
                                style={{ background:'var(--surface-sunken)', flexShrink:0 }}
                              >
                                {a.profile_photo_url || a.avatar ? (
                                  <img src={a.profile_photo_url || a.avatar} alt={a.full_name} style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'50%' }}/>
                                ) : (
                                  <span className="text-xs font-semibold text-navy-500">
                                    {a.full_name?.split(' ').map(n => n[0]).slice(0,2).join('')}
                                  </span>
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-navy-900">{a.full_name}</p>
                                {a.phone && <p className="text-xs text-navy-500">{a.phone}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 hidden sm:table-cell">
                            <span className={`badge ${cfg.cls}`}>{cfg.label}</span>
                          </td>
                          <td className="py-3 px-4 hidden md:table-cell">
                            <span className="text-sm text-navy-700">{a.role_in_meeting || <span className="text-navy-400">—</span>}</span>
                          </td>
                          {canEdit && (
                            <td className="py-3 px-4">
                              <button
                                className="btn btn-ghost btn-icon btn-sm"
                                style={{ color:'var(--danger)' }}
                                onClick={() => setConfirmDelete({ type:'attendee', id: a.attendance_id, label: a.full_name })}
                              >
                                <IconX className="w-3.5 h-3.5"/>
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="card-footer">
                  <span className="text-xs text-navy-500">
                    {filteredAttendees.length} waliosajiliwа
                    {filteredAttendees.length !== attendees.length && ` (kati ya ${attendees.length})`}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════
            TAB: RESOLUTIONS
        ════════════════════════════════════════════════ */}
        {activeTab === 'resolutions' && (
          <div>
            {/* Resolution summary badges */}
            {resSummary.overdue > 0 && (
              <div className="banner banner-danger" style={{ marginBottom:'1rem' }}>
                <IconAlertCircle className="w-4 h-4 flex-shrink-0"/>
                <span className="text-sm">{resSummary.overdue} uamuzi umepita tarehe ya mwisho bila kukamilika.</span>
              </div>
            )}

            {/* Toolbar */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'0.75rem', flexWrap:'wrap', marginBottom:'0.875rem' }}>
              <div style={{ display:'flex', gap:'0.625rem', flexWrap:'wrap', flex:1 }}>
                <div className="search-bar" style={{ minWidth:200 }}>
                  <IconSearch className="w-4 h-4" style={{ color:'var(--text-tertiary)', flexShrink:0 }}/>
                  <input placeholder="Tafuta uamuzi…" value={resSearch} onChange={e => setResSearch(e.target.value)}/>
                  {resSearch && <button onClick={() => setResSearch('')}><IconX className="w-3.5 h-3.5" style={{ color:'var(--text-tertiary)' }}/></button>}
                </div>
                <select className="select" style={{ maxWidth:180 }} value={resFilter} onChange={e => setResFilter(e.target.value)}>
                  <option value="">Hali zote</option>
                  <option value="pending">Inasubiri</option>
                  <option value="in_progress">Inaendelea</option>
                  <option value="completed">Imekamilika</option>
                  <option value="cancelled">Imefutwa</option>
                  <option value="deferred">Imeahirishwa</option>
                </select>
              </div>
              {canEdit && (
                <button className="btn btn-primary btn-sm" onClick={() => setShowAddRes(true)}>
                  <IconPlus className="w-3.5 h-3.5"/> Ongeza Uamuzi
                </button>
              )}
            </div>

            {filteredResolutions.length === 0 ? (
              <div className="card">
                <div className="empty-state">
                  <IconCheckCircle className="empty-state-icon"/>
                  <p className="empty-state-title">{resSearch || resFilter ? 'Hakuna Matokeo' : 'Hakuna Maamuzi'}</p>
                  <p className="empty-state-body">
                    {resSearch || resFilter ? 'Hakuna maamuzi yanayolingana na chujio ulilochagua.' : 'Bado hakuna maamuzi yaliyosajiliwа kwa kikao hiki.'}
                  </p>
                  {canEdit && !resSearch && !resFilter && (
                    <div className="empty-state-actions">
                      <button className="btn btn-primary btn-sm" onClick={() => setShowAddRes(true)}>
                        <IconPlus className="w-3.5 h-3.5"/> Ongeza Uamuzi
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
                {filteredResolutions.map((r, idx) => {
                  const dot = urgencyDot(r.deadline, r.implementation_status);
                  const sc  = resStatusConfig(r.implementation_status);
                  return (
                    <div key={r.id} className="card" style={{ padding:'1rem 1.25rem' }}>
                      <div style={{ display:'flex', gap:'0.875rem', alignItems:'flex-start' }}>
                        {/* Number */}
                        <div
                          style={{
                            flexShrink:0, width:28, height:28, borderRadius:'50%',
                            background:'var(--surface-sunken)', border:'1px solid var(--border-default)',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            fontSize:'0.75rem', fontWeight:700, color:'var(--text-secondary)',
                          }}
                        >
                          {r.resolution_number}
                        </div>

                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'0.5rem', flexWrap:'wrap', marginBottom:'0.375rem' }}>
                            <p className="text-sm font-medium text-navy-900" style={{ lineHeight:1.5 }}>{r.description}</p>
                            {/* Status picker — inline change for managers */}
                            {canEdit ? (
                              <StatusPicker
                                currentStatus={r.implementation_status}
                                onSelect={newStatus => handleResStatusChange(r.id, newStatus)}
                              />
                            ) : (
                              <span className={`badge ${sc.cls}`}>{sc.label}</span>
                            )}
                          </div>

                          <div style={{ display:'flex', gap:'1rem', flexWrap:'wrap', marginTop:'0.375rem' }}>
                            {r.responsible_name && (
                              <span className="text-xs text-navy-500" style={{ display:'flex', alignItems:'center', gap:4 }}>
                                <IconUsers className="w-3 h-3"/>
                                {r.responsible_name}
                              </span>
                            )}
                            {r.responsible_note && !r.responsible_name && (
                              <span className="text-xs text-navy-500">{r.responsible_note}</span>
                            )}
                            {r.deadline && (
                              <span className="text-xs" style={{ display:'flex', alignItems:'center', gap:4, color: dot === 'danger' ? 'var(--danger)' : dot === 'pending' ? 'var(--warning)' : 'var(--text-tertiary)' }}>
                                <IconClock className="w-3 h-3"/>
                                {formatDate(r.deadline)}
                              </span>
                            )}
                            {r.completion_date && (
                              <span className="text-xs text-success" style={{ display:'flex', alignItems:'center', gap:4 }}>
                                <IconCheckCircle className="w-3 h-3"/>
                                Ilikamilika {formatDate(r.completion_date)}
                              </span>
                            )}
                          </div>

                          {r.progress_notes && (
                            <p className="text-xs text-navy-500 mt-1.5 italic" style={{ lineHeight:1.5 }}>{r.progress_notes}</p>
                          )}
                        </div>

                        {/* Actions */}
                        {canEdit && (
                          <div style={{ display:'flex', gap:'0.25rem', flexShrink:0 }}>
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setEditResolution(r)}>
                              <IconEdit className="w-3.5 h-3.5"/>
                            </button>
                            {canManage && (
                              <button className="btn btn-ghost btn-icon btn-sm" style={{ color:'var(--danger)' }} onClick={() => setConfirmDelete({ type:'resolution', id: r.id, label: `Uamuzi #${r.resolution_number}` })}>
                                <IconTrash className="w-3.5 h-3.5"/>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer */}
            {filteredResolutions.length > 0 && (
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'0.875rem' }}>
                <span className="text-xs text-navy-500">
                  {filteredResolutions.length} uamuzi
                  {filteredResolutions.length !== resolutions.length && ` (kati ya ${resolutions.length})`}
                </span>
                {canEdit && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowAddRes(true)}>
                    <IconPlus className="w-3.5 h-3.5"/> Ongeza Uamuzi
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════
            TAB: DOCUMENTS
        ════════════════════════════════════════════════ */}
        {activeTab === 'documents' && (
          <div>
            {/* Upload toolbar */}
            {canEdit && (
              <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'0.875rem' }}>
                <button className="btn btn-primary btn-sm" onClick={() => setShowUploadDoc(true)}>
                  <IconUpload className="w-3.5 h-3.5"/> Pakia Nyaraka
                </button>
              </div>
            )}

            {documents.length === 0 ? (
              <div className="card">
                <div className="empty-state">
                  <IconFileText className="empty-state-icon"/>
                  <p className="empty-state-title">Hakuna Nyaraka</p>
                  <p className="empty-state-body">Bado hakuna nyaraka zilizopakiwa kwa kikao hiki.</p>
                  {canEdit && (
                    <div className="empty-state-actions">
                      <button className="btn btn-primary btn-sm" onClick={() => setShowUploadDoc(true)}>
                        <IconUpload className="w-3.5 h-3.5"/> Pakia Nyaraka
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:'0.875rem' }}>
                {documents.map(doc => {
                  const dtCfg = docTypeConfig(doc.document_type);
                  const isPdf = doc.mime_type?.includes('pdf');
                  const isImg = doc.mime_type?.includes('image');
                  return (
                    <div key={doc.id} className="card" style={{ padding:'1rem' }}>
                      <div style={{ display:'flex', gap:'0.75rem', alignItems:'flex-start' }}>
                        <div
                          style={{
                            width:40, height:40, borderRadius:8, flexShrink:0,
                            background:'var(--surface-sunken)', border:'1px solid var(--border-default)',
                            display:'flex', alignItems:'center', justifyContent:'center',
                          }}
                        >
                          <IconFileText className="w-5 h-5" style={{ color:'var(--gold-dark)' }}/>
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <p className="text-sm font-medium text-navy-900 truncate">{doc.title}</p>
                          <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginTop:'0.2rem', flexWrap:'wrap' }}>
                            <span className={`badge ${dtCfg.cls}`}>{dtCfg.label}</span>
                            {doc.file_size_kb && <span className="text-xs text-navy-400">{formatBytes(doc.file_size_kb)}</span>}
                          </div>
                          <p className="text-xs text-navy-400 mt-1">
                            {doc.uploaded_by_name} · {formatDate(doc.uploaded_at)}
                          </p>
                        </div>
                      </div>

                      <div style={{ display:'flex', gap:'0.5rem', marginTop:'0.875rem' }}>
                     <button
  className="btn btn-secondary btn-sm"
  style={{ flex: 1, justifyContent: 'center' }}
  onClick={() => {
    if (isPdf) {
      // Open in the internal reader
      router.push(`/dashboard/meetings/document/${id}/${doc.id}`);
    } else {
      // Non-PDF (images, Word, Excel etc.) — still open in new tab
      window.open(doc.file_url, '_blank', 'noopener,noreferrer');
    }
  }}
>
  <IconDownload className="w-3.5 h-3.5"/>
  {isPdf ? 'Angalia PDF' : isImg ? 'Angalia Picha' : 'Pakua'}
</button>
                        {canEdit && (
                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            style={{ color:'var(--danger)' }}
                            onClick={() => setConfirmDelete({ type:'document', id: doc.id, label: doc.title })}
                          >
                            <IconTrash className="w-3.5 h-3.5"/>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>{/* /page-body */}

      {/* ── Modals ───────────────────────────────────────── */}
      {showEdit && (
        <EditMeetingModal
          meeting={meeting}
          meetingTypes={meetingTypes}
          currentUser={user}
          onClose={() => setShowEdit(false)}
          onSave={() => { setShowEdit(false); fetchMeeting(); }}
        />
      )}

      {showAddRes && (
        <ResolutionModal
          meetingId={id}
          members={allMembers}
          onClose={() => setShowAddRes(false)}
          onSave={() => { setShowAddRes(false); fetchMeeting(); }}
        />
      )}

      {editResolution && (
        <ResolutionModal
          meetingId={id}
          resolution={editResolution}
          members={allMembers}
          onClose={() => setEditResolution(null)}
          onSave={() => { setEditResolution(null); fetchMeeting(); }}
        />
      )}

      {showAddAtt && (
        <AttendeeModal
          meetingId={id}
          members={allMembers}
          existingIds={existingAttendeeIds}
          onClose={() => setShowAddAtt(false)}
          onSave={() => { setShowAddAtt(false); fetchMeeting(); }}
        />
      )}

      {showUploadDoc && (
        <UploadDocModal
          meetingId={id}
          onClose={() => setShowUploadDoc(false)}
          onSave={() => { setShowUploadDoc(false); fetchMeeting(); }}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title={confirmDelete.type === 'meeting' ? 'Futa Kikao' : confirmDelete.type === 'resolution' ? 'Futa Uamuzi' : confirmDelete.type === 'attendee' ? 'Ondoa Mhudhuria' : 'Futa Nyaraka'}
          body={
            confirmDelete.type === 'meeting'
              ? `Je, una uhakika unataka kufuta kikao "${confirmDelete.label}"? Hatua hii haiwezi kutenduliwa. Wahudhuria, maamuzi na nyaraka zote zitafutwa.`
              : confirmDelete.type === 'attendee'
              ? `Ondoa ${confirmDelete.label} kutoka orodha ya wahudhuria wa kikao hiki?`
              : `Futa ${confirmDelete.label}? Hatua hii haiwezi kutenduliwa.`
          }
          confirmLabel={confirmDelete.type === 'attendee' ? 'Ondoa' : 'Futa'}
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => {
            if (confirmDelete.type === 'meeting')    return handleDeleteMeeting();
            if (confirmDelete.type === 'resolution') return handleDeleteResolution(confirmDelete.id);
            if (confirmDelete.type === 'document')   return handleDeleteDocument(confirmDelete.id);
            if (confirmDelete.type === 'attendee')   return handleRemoveAttendee(confirmDelete.id);
          }}
        />
      )}
    </div>
  );
}