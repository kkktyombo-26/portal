'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import { useTranslation } from '../../../lib/i18n';
import { meetingApi, groupApi } from '../../../lib/api';

// ─────────────────────────────────────────────────────────────
// ICONS (inline SVG — no dep)
// ─────────────────────────────────────────────────────────────
const IconCalendar = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <rect x="2" y="4" width="16" height="14" rx="2" />
    <path d="M2 8h16M6 2v4M14 2v4" strokeLinecap="round" />
  </svg>
);
const IconClock = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <circle cx="10" cy="10" r="8" />
    <path d="M10 6v4l2.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconMapPin = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path d="M10 2a6 6 0 0 1 6 6c0 4-6 10-6 10S4 12 4 8a6 6 0 0 1 6-6z" />
    <circle cx="10" cy="8" r="2" />
  </svg>
);
const IconUsers = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <circle cx="7" cy="6" r="3" />
    <path d="M1 17c0-3.314 2.686-6 6-6" strokeLinecap="round" />
    <circle cx="14" cy="6" r="3" />
    <path d="M19 17c0-3.314-2.686-6-6-6" strokeLinecap="round" />
  </svg>
);
const IconCheckCircle = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <circle cx="10" cy="10" r="8" />
    <path d="M6.5 10l2.5 2.5 4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconAlertCircle = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <circle cx="10" cy="10" r="8" />
    <path d="M10 6v4M10 14h.01" strokeLinecap="round" />
  </svg>
);
const IconPlus = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M10 4v12M4 10h12" strokeLinecap="round" />
  </svg>
);
const IconChevronRight = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path d="M7.5 4.5l5 5.5-5 5.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconFilter = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path d="M3 5h14M6 10h8M9 15h2" strokeLinecap="round" />
  </svg>
);
const IconX = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
  </svg>
);
const IconFileText = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path d="M4 2h8l4 4v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1" />
    <path d="M12 2v4h4M7 9h6M7 12h6M7 15h4" strokeLinecap="round" />
  </svg>
);
const IconChurch = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path d="M10 2v4M8 4h4" strokeLinecap="round" />
    <path d="M4 18V9l6-4 6 4v9" />
    <rect x="8" y="13" width="4" height="5" />
  </svg>
);
const IconSearch = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <circle cx="8.5" cy="8.5" r="5.5" />
    <path d="M14.5 14.5l3 3" strokeLinecap="round" />
  </svg>
);

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const MANAGERS = ['pastor', 'elder'];

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatTime(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const display = hour % 12 || 12;
  return `${display}:${m} ${ampm}`;
}

function statusConfig(status) {
  switch (status) {
    case 'scheduled': return { label: 'Imepangwa',    cls: 'badge-gold'    };
    case 'held':      return { label: 'Ilifanyika',   cls: 'badge-success' };
    case 'cancelled': return { label: 'Ilifutwa',     cls: 'badge-danger'  };
    case 'postponed': return { label: 'Imeahirishwa', cls: 'badge-warning' };
    default:          return { label: status,         cls: 'badge-neutral' };
  }
}

function urgencyConfig(urgency) {
  switch (urgency) {
    case 'overdue':     return { label: 'Imechelewa',   cls: 'badge-danger',  dot: 'danger'  };
    case 'due_soon':    return { label: 'Inakaribia',   cls: 'badge-warning', dot: 'pending' };
    case 'on_track':    return { label: 'Inaendelea',   cls: 'badge-success', dot: 'active'  };
    case 'no_deadline': return { label: 'Bila Tarehe',  cls: 'badge-neutral', dot: 'inactive'};
    default:            return { label: urgency,        cls: 'badge-neutral', dot: 'inactive'};
  }
}

function resolutionStatusConfig(status) {
  switch (status) {
    case 'pending':     return { label: 'Inasubiri',    cls: 'badge-warning' };
    case 'in_progress': return { label: 'Inaendelea',   cls: 'badge-gold'    };
    case 'completed':   return { label: 'Imekamilika',  cls: 'badge-success' };
    case 'cancelled':   return { label: 'Imefutwa',     cls: 'badge-danger'  };
    case 'deferred':    return { label: 'Imeahirishwa', cls: 'badge-neutral' };
    default:            return { label: status,         cls: 'badge-neutral' };
  }
}

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────

// ── Upcoming meeting card (dashboard strip) ───────────────────
function UpcomingCard({ meeting, onClick }) {
  const cfg = statusConfig(meeting.status);
  return (
    <button
      onClick={onClick}
      className="card text-left w-full transition-shadow hover:shadow-md group"
    >
      <div className="card-body flex gap-4 items-start">
        {/* Date block */}
        <div
          className="flex-shrink-0 flex flex-col items-center justify-center rounded-lg bg-gold-50 border border-gold-200 w-14 h-14 select-none"
          style={{ minWidth: 56 }}
        >
          <span className="text-2xs font-semibold uppercase tracking-widest text-gold-600 leading-none">
            {new Date(meeting.meeting_date).toLocaleDateString('sw-TZ', { month: 'short' })}
          </span>
          <span className="font-display text-xl font-bold text-navy-900 leading-tight">
            {new Date(meeting.meeting_date).getDate()}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`badge ${cfg.cls}`}>{cfg.label}</span>
            {!meeting.group_id && (
              <span className="badge badge-navy">
                <IconChurch className="w-2.5 h-2.5" />
                Kanisa Lote
              </span>
            )}
            {meeting.group_name && (
              <span className="badge badge-neutral">{meeting.group_name}</span>
            )}
          </div>
          <p className="font-semibold text-sm text-navy-900 truncate leading-snug">
            {meeting.title}
          </p>
          <div className="flex items-center gap-3 mt-1 text-xs text-navy-500 flex-wrap">
            {meeting.start_time && (
              <span className="flex items-center gap-1">
                <IconClock className="w-3 h-3" />
                {formatTime(meeting.start_time)}
              </span>
            )}
            {meeting.venue && (
              <span className="flex items-center gap-1 truncate">
                <IconMapPin className="w-3 h-3" />
                {meeting.venue}
              </span>
            )}
          </div>
        </div>

        <IconChevronRight className="w-4 h-4 text-navy-400 group-hover:text-navy-700 transition-colors flex-shrink-0 mt-1" />
      </div>
    </button>
  );
}

// ── Open resolution row ───────────────────────────────────────
function ResolutionRow({ res, onClick }) {
  const urg = urgencyConfig(res.urgency);
  const st  = resolutionStatusConfig(res.implementation_status);
  return (
    <div
      className="data-table"
      style={{ display: 'contents' }}
    >
      <tr
        className="cursor-pointer"
        onClick={onClick}
      >
        <td className="py-3 px-4">
          <div className="flex items-start gap-2">
            <span className={`status-dot mt-1.5 flex-shrink-0 ${urg.dot}`} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-navy-900 leading-snug line-clamp-2">
                {res.description}
              </p>
              <p className="text-xs text-navy-500 mt-0.5 truncate">
                {res.meeting_title} · {formatDate(res.meeting_date)}
              </p>
            </div>
          </div>
        </td>
        <td className="py-3 px-4 hidden md:table-cell">
          <span className="text-sm text-navy-700">
            {res.responsible_name || <span className="text-navy-400">—</span>}
          </span>
        </td>
        <td className="py-3 px-4 hidden lg:table-cell">
          <span className="text-sm text-navy-700">
            {res.deadline ? formatDate(res.deadline) : <span className="text-navy-400">—</span>}
          </span>
        </td>
        <td className="py-3 px-4">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`badge ${urg.cls}`}>{urg.label}</span>
            <span className={`badge ${st.cls} hidden sm:inline-flex`}>{st.label}</span>
          </div>
        </td>
        <td className="py-3 px-4 hidden sm:table-cell">
          {res.group_name ? (
            <span className="badge badge-neutral">{res.group_name}</span>
          ) : (
            <span className="badge badge-navy flex items-center gap-1">
              <IconChurch className="w-2.5 h-2.5" />
              Kanisa
            </span>
          )}
        </td>
      </tr>
    </div>
  );
}

// ── Meeting list row ──────────────────────────────────────────
function MeetingRow({ meeting, onClick }) {
  const cfg = statusConfig(meeting.status);
  return (
    <tr className="cursor-pointer" onClick={onClick}>
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          {/* scope indicator */}
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: meeting.group_id ? 'var(--surface-page)' : 'var(--gold-subtle)',
              border: '1px solid var(--border-default)',
            }}
          >
            <IconChurch
              className="w-4 h-4"
              style={{ color: meeting.group_id ? 'var(--text-tertiary)' : 'var(--gold-dark)' }}
            />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-navy-900 truncate">{meeting.title}</p>
            <p className="text-xs text-navy-500 mt-0.5">
              {meeting.meeting_type_name_sw || '—'}
            </p>
          </div>
        </div>
      </td>
      <td className="py-3 px-4 hidden sm:table-cell">
        <div className="text-sm text-navy-700">{formatDate(meeting.meeting_date)}</div>
        {meeting.start_time && (
          <div className="text-xs text-navy-400 mt-0.5">{formatTime(meeting.start_time)}</div>
        )}
      </td>
      <td className="py-3 px-4 hidden md:table-cell">
        {meeting.group_name ? (
          <span className="badge badge-neutral">{meeting.group_name}</span>
        ) : (
          <span className="badge badge-navy flex items-center gap-1">
            <IconChurch className="w-2.5 h-2.5" />
            Kanisa Lote
          </span>
        )}
      </td>
      <td className="py-3 px-4 hidden lg:table-cell">
        <div className="flex items-center gap-3 text-xs text-navy-500">
          {meeting.attendee_count > 0 && (
            <span className="flex items-center gap-1">
              <IconUsers className="w-3.5 h-3.5" />
              {meeting.attendee_count}
            </span>
          )}
          {meeting.open_resolution_count > 0 && (
            <span className="flex items-center gap-1 text-warning">
              <IconAlertCircle className="w-3.5 h-3.5" />
              {meeting.open_resolution_count} wazi
            </span>
          )}
          {meeting.open_resolution_count === 0 && meeting.resolution_count > 0 && (
            <span className="flex items-center gap-1 text-success">
              <IconCheckCircle className="w-3.5 h-3.5" />
              Yote yamekamilika
            </span>
          )}
        </div>
      </td>
      <td className="py-3 px-4">
        <span className={`badge ${cfg.cls}`}>{cfg.label}</span>
      </td>
    </tr>
  );
}

// ── Create / Edit Meeting Modal ───────────────────────────────
function MeetingModal({ meeting, meetingTypes, onClose, onSave, currentUser }) {
  const isEdit = !!meeting?.id;

  const [form, setForm] = useState({
    group_id:            meeting?.group_id            ?? '',
    meeting_type_id:     meeting?.meeting_type_id     ?? '',
    title:               meeting?.title               ?? '',
    meeting_date:        meeting?.meeting_date?.slice(0, 10) ?? '',
    start_time:          meeting?.start_time          ?? '',
    end_time:            meeting?.end_time            ?? '',
    venue:               meeting?.venue               ?? '',
    agenda:              meeting?.agenda              ?? '',
    summary:             meeting?.summary             ?? '',
    status:              meeting?.status              ?? 'scheduled',
    cancellation_reason: meeting?.cancellation_reason ?? '',
  });

  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState('');
  const [groups,       setGroups]       = useState([]);
  const [groupsLoading,setGroupsLoading]= useState(false);

  const isManager     = MANAGERS.includes(currentUser?.role);
  // group_leader gets a scoped list; pastor/elder get everything
  const isGroupLeader = currentUser?.role === 'group_leader';

  // Fetch available groups when the modal opens
  useEffect(() => {
    if (!isManager && !isGroupLeader) return; // member — no group select shown

    setGroupsLoading(true);
    groupApi.getAll({ is_archived: 0 })
      .then(res => {
        const all = res.data.data || [];
        // group_leader: only their own group (matched by groupId from JWT)
        const filtered = isGroupLeader
          ? all.filter(g => g.id === currentUser?.groupId)
          : all;
        setGroups(filtered);
      })
      .catch(() => setGroups([]))
      .finally(() => setGroupsLoading(false));
  }, []);

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        ...form,
        group_id:        form.group_id        || null,
        start_time:      form.start_time      || null,
        end_time:        form.end_time        || null,
        venue:           form.venue           || null,
        agenda:          form.agenda          || null,
        summary:         form.summary         || null,
        cancellation_reason: form.cancellation_reason || null,
      };
      if (isEdit) {
        await meetingApi.update(meeting.id, payload);
      } else {
        await meetingApi.create(payload);
      }
      onSave();
    } catch (err) {
      setError(err.message || 'Imeshindwa kuhifadhi. Jaribu tena.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 600 }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">{isEdit ? 'Hariri Kikao' : 'Kikao Kipya'}</h2>
            <p className="card-subtitle mt-0.5">
              {isEdit ? meeting.title : 'Sajili kikao kipya cha kanisa au kikundi'}
            </p>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Funga">
            <IconX className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', maxHeight: 'calc(100vh - 220px)' }}>

            {error && (
              <div className="banner banner-danger">
                <IconAlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Scope + Type */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Aina ya Kikao *</label>
                <select
                  className="select"
                  value={form.meeting_type_id}
                  onChange={e => set('meeting_type_id', e.target.value)}
                  required
                >
                  <option value="">— Chagua —</option>
                  {meetingTypes.map(t => (
                    <option key={t.id} value={t.id}>{t.name_sw}</option>
                  ))}
                </select>
              </div>

              {(isManager || isGroupLeader) && (
                <div className="form-group">
                  <label className="form-label">Kikundi / Ngazi</label>
                  <select
                    className="select"
                    value={form.group_id}
                    onChange={e => set('group_id', e.target.value)}
                    disabled={groupsLoading}
                  >
                    {/* pastor/elder can create church-level meetings; group_leader cannot */}
                    {isManager && (
                      <option value="">Kanisa Lote</option>
                    )}
                    {groupsLoading ? (
                      <option disabled>Inapakia vikundi…</option>
                    ) : (
                      groups.map(g => (
                        <option key={g.id} value={g.id}>
                          {g.name_sw || g.name}
                        </option>
                      ))
                    )}
                  </select>
                  {isManager && (
                    <span className="form-hint">Acha wazi kwa kikao cha kanisa lote</span>
                  )}
                </div>
              )}
            </div>

            {/* Title */}
            <div className="form-group">
              <label className="form-label">Kichwa cha Kikao *</label>
              <input
                className="input"
                placeholder="mfano: Mkutano wa Kamati ya Fedha – Machi 2026"
                value={form.title}
                onChange={e => set('title', e.target.value)}
                required
              />
            </div>

            {/* Date + Times */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Tarehe *</label>
                <input
                  type="date"
                  className="input"
                  value={form.meeting_date}
                  onChange={e => set('meeting_date', e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Saa ya Kuanza</label>
                <input
                  type="time"
                  className="input"
                  value={form.start_time}
                  onChange={e => set('start_time', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Saa ya Kumaliza</label>
                <input
                  type="time"
                  className="input"
                  value={form.end_time}
                  onChange={e => set('end_time', e.target.value)}
                />
              </div>
            </div>

            {/* Venue */}
            <div className="form-group">
              <label className="form-label">Mahali</label>
              <input
                className="input"
                placeholder="mfano: Kanisa Kuu, Chumba cha Mikutano"
                value={form.venue}
                onChange={e => set('venue', e.target.value)}
              />
            </div>

            {/* Agenda */}
            <div className="form-group">
              <label className="form-label">Agenda</label>
              <textarea
                className="textarea"
                placeholder="Orodha ya mambo yatakayojadiliwa…"
                rows={3}
                value={form.agenda}
                onChange={e => set('agenda', e.target.value)}
              />
            </div>

            {/* Summary (edit mode) */}
            {isEdit && (
              <div className="form-group">
                <label className="form-label">Muhtasari</label>
                <textarea
                  className="textarea"
                  placeholder="Muhtasari wa mambo yaliyojadiliwa…"
                  rows={3}
                  value={form.summary}
                  onChange={e => set('summary', e.target.value)}
                />
              </div>
            )}

            {/* Status */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Hali</label>
                <select
                  className="select"
                  value={form.status}
                  onChange={e => set('status', e.target.value)}
                >
                  <option value="scheduled">Imepangwa</option>
                  <option value="held">Ilifanyika</option>
                  <option value="cancelled">Imefutwa</option>
                  <option value="postponed">Imeahirishwa</option>
                </select>
              </div>
              {(form.status === 'cancelled' || form.status === 'postponed') && (
                <div className="form-group">
                  <label className="form-label">Sababu</label>
                  <input
                    className="input"
                    placeholder="Sababu ya kufutwa / kuahirishwa"
                    value={form.cancellation_reason}
                    onChange={e => set('cancellation_reason', e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={saving}
            >
              Ghairi
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? 'Inahifadhi…' : (isEdit ? 'Hifadhi Mabadiliko' : 'Unda Kikao')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────
export default function MeetingsPage() {
  const router       = useRouter();
  const { user, lang } = useAuth();
  const { t }        = useTranslation(lang);

  const canManage    = user && MANAGERS.includes(user.role);
  const canCreate    = user && ['pastor', 'elder', 'group_leader'].includes(user.role);

  // ── Data ─────────────────────────────────────────────────
  const [meetings,     setMeetings]     = useState([]);
  const [upcoming,     setUpcoming]     = useState([]);
  const [openRes,      setOpenRes]      = useState([]);
  const [meetingTypes, setMeetingTypes] = useState([]);
  const [resSummary,   setResSummary]   = useState({ total: 0, overdue: 0, due_soon: 0 });
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');

  // ── Filters ───────────────────────────────────────────────
  const [activeTab,   setActiveTab]   = useState('all');   // all | church | group | upcoming
  const [statusFilter,setStatusFilter]= useState('');
  const [search,      setSearch]      = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // ── UI state ──────────────────────────────────────────────
  const [showCreate, setShowCreate]  = useState(false);
  const [editTarget, setEditTarget]  = useState(null);
  const [resTab,     setResTab]      = useState('all');    // all | overdue | due_soon

  // ── Fetch ─────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [meetRes, upRes, resRes, typesRes] = await Promise.all([
        meetingApi.getAll({ status: statusFilter || undefined }),
        meetingApi.getUpcomingMeetings({ limit: 5 }),
        meetingApi.getOpenResolutions(),
        meetingApi.getTypes(),
      ]);
      setMeetings(meetRes.data.data   || []);
      setUpcoming(upRes.data.data     || []);
      setOpenRes(resRes.data.data     || []);
      setResSummary(resRes.data.summary || { total: 0, overdue: 0, due_soon: 0 });
      setMeetingTypes(typesRes.data.data || []);
    } catch (err) {
      setError(err.message || 'Imeshindwa kupakia vikao.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Derived / filtered lists ──────────────────────────────
  const filteredMeetings = meetings.filter(m => {
    if (activeTab === 'church' && m.group_id)       return false;
    if (activeTab === 'group'  && !m.group_id)      return false;
    if (activeTab === 'upcoming' && m.status !== 'scheduled') return false;
    if (search) {
      const q = search.toLowerCase();
      if (!m.title?.toLowerCase().includes(q) &&
          !m.venue?.toLowerCase().includes(q) &&
          !m.group_name?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const filteredRes = openRes.filter(r => {
    if (resTab === 'overdue')  return r.urgency === 'overdue';
    if (resTab === 'due_soon') return r.urgency === 'due_soon';
    return true;
  });

  // ── Stats ─────────────────────────────────────────────────
  const totalMeetings = meetings.length;
  const heldCount     = meetings.filter(m => m.status === 'held').length;
  const scheduledCount= meetings.filter(m => m.status === 'scheduled').length;

  // ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div >
        <div className="page-header">
          <p className="page-header-eyebrow">Vikao na Maazimio</p>
          <div className="skeleton" style={{ width: 280, height: 32, marginTop: 8 }} />
        </div>
        <div className="page-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: '1rem', marginBottom: '2rem' }}>
            {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 96, borderRadius: 12 }} />)}
          </div>
          <div className="skeleton" style={{ height: 320, borderRadius: 12 }} />
        </div>
      </div>
    );
  }

  return (
    <div >
      {/* ── Page Header ───────────────────────────────────── */}
      <div className="page-header">
        <p className="page-header-eyebrow">Kanisa la KKKT Yombo</p>
        <h1 className="page-header-title">Vikao na Maazimio</h1>
        <p className="page-header-subtitle">
          Vikao vya kanisa na vikundi, maamuzi, na utekelezaji wao
        </p>
        {canCreate && (
          <div className="page-header-actions">
            <button
              className="btn btn-primary"
              onClick={() => setShowCreate(true)}
            >
              <IconPlus className="w-4 h-4" />
              Kikao Kipya
            </button>
          </div>
        )}
      </div>

      <div className="page-body">

        {error && (
          <div className="banner banner-danger" style={{ marginBottom: '1.5rem' }}>
            <IconAlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* ── Stat Cards ──────────────────────────────────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem',
          }}
        >
          <div className="stat-card">
            <p className="stat-label">Vikao Vyote</p>
            <p className="stat-value">{totalMeetings}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Vilivyofanyika</p>
            <p className="stat-value">{heldCount}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Vilivyopangwa</p>
            <p className="stat-value">{scheduledCount}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Maazimio</p>
            <p className="stat-value" style={{ color: resSummary.overdue > 0 ? 'var(--danger)' : 'inherit' }}>
              {resSummary.total}
            </p>
            {resSummary.overdue > 0 && (
              <p className="stat-delta down">
                <IconAlertCircle className="w-3 h-3" />
                {resSummary.overdue} yamechelewa
              </p>
            )}
          </div>
        </div>

        {/* ── Two-column layout: upcoming + open resolutions ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.5fr)',
            gap: '1.5rem',
            marginBottom: '2rem',
          }}
          className="lg-grid-two-col"
        >

          {/* ── Upcoming meetings ─────────────────────────── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <h2 className="card-title" style={{ fontSize: '1rem' }}>
                Vikao Vinavyokuja
              </h2>
              {upcoming.length > 0 && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setActiveTab('upcoming')}
                  style={{ fontSize: '0.75rem' }}
                >
                  Angalia yote
                </button>
              )}
            </div>

            {upcoming.length === 0 ? (
              <div className="card">
                <div className="empty-state">
                  <IconCalendar className="empty-state-icon" />
                  <p className="empty-state-title">Hakuna Vikao</p>
                  <p className="empty-state-body">Hakuna vikao vilivyopangwa kwa sasa.</p>
                  {canCreate && (
                    <div className="empty-state-actions">
                      <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
                        <IconPlus className="w-3.5 h-3.5" />
                        Panga Kikao
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {upcoming.map(m => (
                  <UpcomingCard
                    key={m.id}
                    meeting={m}
                    onClick={() => router.push(`/dashboard/meetings/${m.id}`)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Open resolutions ──────────────────────────── */}
          {canManage && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <h2 className="card-title" style={{ fontSize: '1rem' }}>
                  Maazimio
                </h2>
                <div className="tabs-pill">
                  {['all', 'overdue', 'due_soon'].map(tab => (
                    <button
                      key={tab}
                      className={`tab-pill ${resTab === tab ? 'active' : ''}`}
                      onClick={() => setResTab(tab)}
                    >
                      {tab === 'all'      ? `Yote (${resSummary.total})`       :
                       tab === 'overdue'  ? `Yamechelewa (${resSummary.overdue})` :
                                           `Yanakaribia (${resSummary.due_soon})`}
                    </button>
                  ))}
                </div>
              </div>

              {filteredRes.length === 0 ? (
                <div className="card">
                  <div className="empty-state">
                    <IconCheckCircle className="empty-state-icon" style={{ color: 'var(--success)' }} />
                    <p className="empty-state-title">Yote Yamekamilika</p>
                    <p className="empty-state-body">Hakuna maazimio kwa hali uliyochagua.</p>
                  </div>
                </div>
              ) : (
                <div className="card" style={{ overflow: 'hidden' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Uamuzi</th>
                        <th className="hidden md:table-cell">Anayehusika</th>
                        <th className="hidden lg:table-cell">Tarehe ya Mwisho</th>
                        <th>Hali</th>
                        <th className="hidden sm:table-cell">Chanzo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRes.map(res => (
                        <ResolutionRow
                          key={res.id}
                          res={res}
                          onClick={() => router.push(`/dashboard/meetings/${res.meeting_id}`)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Full meetings list ───────────────────────────── */}
        <div>
          {/* Toolbar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              marginBottom: '0.875rem',
              flexWrap: 'wrap',
            }}
          >
            <h2 className="card-title" style={{ fontSize: '1rem' }}>Orodha ya Vikao</h2>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
              {/* Search */}
              <div className="search-bar" style={{ minWidth: 220 }}>
                <IconSearch className="w-4 h-4" style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                <input
                  placeholder="Tafuta kikao…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                {search && (
                  <button onClick={() => setSearch('')} style={{ color: 'var(--text-tertiary)', lineHeight: 0 }}>
                    <IconX className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filter toggle */}
              <button
                className={`btn btn-secondary btn-sm ${showFilters ? 'border-gold-500' : ''}`}
                onClick={() => setShowFilters(f => !f)}
              >
                <IconFilter className="w-3.5 h-3.5" />
                Chuja
                {statusFilter && (
                  <span
                    className="badge badge-gold"
                    style={{ padding: '0 0.4rem', marginLeft: 2, fontSize: '0.6rem' }}
                  >
                    1
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Filter panel */}
          {showFilters && (
            <div
              className="card"
              style={{
                padding: '1rem 1.25rem',
                marginBottom: '1rem',
                display: 'flex',
                gap: '1rem',
                flexWrap: 'wrap',
                alignItems: 'flex-end',
              }}
            >
              <div className="form-group" style={{ minWidth: 160 }}>
                <label className="form-label">Hali</label>
                <select
                  className="select"
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                >
                  <option value="">Zote</option>
                  <option value="scheduled">Zilizopangwa</option>
                  <option value="held">Zilizofanyika</option>
                  <option value="cancelled">Zilizofutwa</option>
                  <option value="postponed">Zilizoahirishwa</option>
                </select>
              </div>
              {statusFilter && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setStatusFilter('')}
                  style={{ marginBottom: 2 }}
                >
                  <IconX className="w-3.5 h-3.5" />
                  Futa Chujio
                </button>
              )}
            </div>
          )}

          {/* Scope tabs */}
          <div className="tabs" style={{ marginBottom: '1rem' }}>
            {[
              { key: 'all',      label: `Zote (${meetings.length})` },
              { key: 'church',   label: 'Kanisa Lote' },
              { key: 'group',    label: 'Vikundi' },
              { key: 'upcoming', label: 'Zinazokuja' },
            ].map(tab => (
              <button
                key={tab.key}
                className={`tab ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.key === 'church' && <IconChurch className="w-3.5 h-3.5" />}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Table */}
          {filteredMeetings.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <IconCalendar className="empty-state-icon" />
                <p className="empty-state-title">Hakuna Vikao</p>
                <p className="empty-state-body">
                  {search
                    ? `Hakuna vikao vinavyolingana na "${search}".`
                    : 'Hakuna vikao kwa hali uliyochagua.'}
                </p>
                {canCreate && !search && (
                  <div className="empty-state-actions">
                    <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
                      <IconPlus className="w-3.5 h-3.5" />
                      Panga Kikao
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card" style={{ overflow: 'hidden' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Kikao</th>
                    <th className="hidden sm:table-cell">Tarehe</th>
                    <th className="hidden md:table-cell">Chanzo</th>
                    <th className="hidden lg:table-cell">Takwimu</th>
                    <th>Hali</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMeetings.map(m => (
                    <MeetingRow
                      key={m.id}
                      meeting={m}
                      onClick={() => router.push(`/dashboard/meetings/${m.id}`)}
                    />
                  ))}
                </tbody>
              </table>

              {/* Footer count */}
              <div
                className="card-footer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <span className="text-xs text-navy-500">
                  Vikao {filteredMeetings.length}
                  {filteredMeetings.length !== meetings.length && ` (kati ya ${meetings.length})`}
                </span>
                {canCreate && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(true)}>
                    <IconPlus className="w-3.5 h-3.5" />
                    Ongeza Kikao
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Create / Edit modal ──────────────────────────── */}
      {(showCreate || editTarget) && (
        <MeetingModal
          meeting={editTarget}
          meetingTypes={meetingTypes}
          currentUser={user}
          onClose={() => { setShowCreate(false); setEditTarget(null); }}
          onSave={() => {
            setShowCreate(false);
            setEditTarget(null);
            fetchAll();
          }}
        />
      )}
    </div>
  );
}