'use client';
/**
 * app/dashboard/meetings/resolutions/page.jsx
 * ─────────────────────────────────────────────
 * Cross-meeting open resolutions accountability view.
 * Visible to pastor + elder (all groups), group_leader (their group only).
 *
 * Features:
 *   • Stat strip — total / overdue / due soon / on track / no deadline
 *   • Filter bar — urgency, group, implementation_status, search
 *   • Grouped view (by group/meeting) or flat list toggle
 *   • Inline status update (StatusPicker)
 *   • Click row → navigate to meeting detail page
 *   • Responsive table with mobile card fallback
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../hooks/useAuth';
import { meetingApi, groupApi } from '../../../../lib/api';

// ── Icons ─────────────────────────────────────────────────────────────────────
const IconCheckSquare  = ({ className = '' }) => <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}><rect x="3" y="3" width="14" height="14" rx="2"/><path d="M7 10l2.5 2.5L14 7" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const IconAlertCircle  = ({ className = '' }) => <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}><circle cx="10" cy="10" r="8"/><path d="M10 6v4M10 14h.01" strokeLinecap="round"/></svg>;
const IconClock        = ({ className = '' }) => <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}><circle cx="10" cy="10" r="8"/><path d="M10 6v4l2.5 2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const IconUsers        = ({ className = '' }) => <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}><circle cx="7" cy="6" r="3"/><path d="M1 17c0-3.314 2.686-6 6-6" strokeLinecap="round"/><circle cx="14" cy="6" r="3"/><path d="M19 17c0-3.314-2.686-6-6-6" strokeLinecap="round"/></svg>;
const IconSearch       = ({ className = '' }) => <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}><circle cx="8.5" cy="8.5" r="5.5"/><path d="M14.5 14.5l3 3" strokeLinecap="round"/></svg>;
const IconX            = ({ className = '' }) => <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.75}><path d="M5 5l10 10M15 5L5 15" strokeLinecap="round"/></svg>;
const IconChevronRight = ({ className = '' }) => <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M7.5 4.5l5 5.5-5 5.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const IconChurch       = ({ className = '' }) => <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M10 2v4M8 4h4" strokeLinecap="round"/><path d="M4 18V9l6-4 6 4v9"/><rect x="8" y="13" width="4" height="5"/></svg>;
const IconFilter       = ({ className = '' }) => <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M3 5h14M6 10h8M9 15h2" strokeLinecap="round"/></svg>;
const IconLayout       = ({ className = '' }) => <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}><rect x="2" y="2" width="7" height="7" rx="1"/><rect x="11" y="2" width="7" height="7" rx="1"/><rect x="2" y="11" width="16" height="7" rx="1"/></svg>;
const IconList         = ({ className = '' }) => <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M4 6h12M4 10h12M4 14h12" strokeLinecap="round"/></svg>;
const IconRefresh      = ({ className = '' }) => <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M4 4v5h5" strokeLinecap="round" strokeLinejoin="round"/><path d="M4.07 9A7 7 0 1 0 5.5 5.3" strokeLinecap="round"/></svg>;

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysUntil(deadline) {
  if (!deadline) return null;
  const d     = new Date(deadline);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}

function urgencyFromDeadline(deadline, status) {
  if (status === 'completed' || status === 'cancelled') return 'done';
  if (!deadline) return 'no_deadline';
  const diff = daysUntil(deadline);
  if (diff < 0)  return 'overdue';
  if (diff <= 7) return 'due_soon';
  return 'on_track';
}

const URGENCY_CONFIG = {
  overdue:     { label: 'Imepita Tarehe',  cls: 'badge-danger',   dot: 'danger',   order: 1 },
  due_soon:    { label: 'Inakaribia',       cls: 'badge-warning',  dot: 'pending',  order: 2 },
  on_track:    { label: 'Iko Sawa',         cls: 'badge-success',  dot: 'active',   order: 3 },
  no_deadline: { label: 'Bila Tarehe',      cls: 'badge-neutral',  dot: 'inactive', order: 4 },
  done:        { label: 'Imekamilika',      cls: 'badge-success',  dot: 'active',   order: 5 },
};

const STATUS_CONFIG = {
  pending:     { label: 'Inasubiri',    cls: 'badge-warning' },
  in_progress: { label: 'Inaendelea',   cls: 'badge-gold'    },
  completed:   { label: 'Imekamilika',  cls: 'badge-success' },
  cancelled:   { label: 'Imefutwa',     cls: 'badge-danger'  },
  deferred:    { label: 'Imeahirishwa', cls: 'badge-neutral' },
};

const STATUS_OPTIONS = ['pending', 'in_progress', 'completed', 'cancelled', 'deferred'];

// ── Inline status picker ──────────────────────────────────────────────────────
function StatusPicker({ resolutionId, meetingId, currentStatus, onUpdate }) {
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const cfg = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.pending;

  async function pick(newStatus) {
    if (newStatus === currentStatus) { setOpen(false); return; }
    setLoading(true); setOpen(false);
    try {
      await meetingApi.updateResolution(meetingId, resolutionId, {
        implementation_status: newStatus,
      });
      onUpdate(resolutionId, newStatus);
    } catch (err) {
      alert(err.message || 'Imeshindwa kubadilisha hali.');
    } finally { setLoading(false); }
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        className={`badge ${cfg.cls}`}
        style={{ cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.6 : 1 }}
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        disabled={loading}
      >
        {cfg.label} {loading ? '…' : '▾'}
      </button>
      {open && (
        <>
          {/* backdrop */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 40 }}
            onClick={() => setOpen(false)}
          />
          <div
            className="card"
            style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 50,
              minWidth: 170, padding: '0.3rem 0',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            {STATUS_OPTIONS.map(s => {
              const c = STATUS_CONFIG[s];
              return (
                <button
                  key={s}
                  onClick={e => { e.stopPropagation(); pick(s); }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '0.4rem 0.75rem', background: 'none',
                    border: 'none', cursor: 'pointer',
                  }}
                  className="hover-row"
                >
                  <span className={`badge ${c.cls}`}>{c.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── Resolution row ────────────────────────────────────────────────────────────
function ResolutionRow({ r, canEdit, onUpdate, onNavigate, showGroup }) {
  const urgency = urgencyFromDeadline(r.deadline, r.implementation_status);
  const uCfg    = URGENCY_CONFIG[urgency] || URGENCY_CONFIG.no_deadline;
  const diff    = daysUntil(r.deadline);

  return (
    <tr
      style={{ cursor: 'pointer' }}
      onClick={() => onNavigate(r.meeting_id)}
      className="hover-row"
    >
      {/* # */}
      <td className="py-3 px-4" style={{ width: 44 }}>
        <div style={{
          width: 26, height: 26, borderRadius: '50%',
          background: 'var(--surface-sunken)',
          border: '1px solid var(--border-default)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-secondary)',
          flexShrink: 0,
        }}>
          {r.resolution_number}
        </div>
      </td>

      {/* Description + meeting info */}
      <td className="py-3 px-4" style={{ maxWidth: 360 }}>
        <p
          className="text-sm font-medium text-navy-900"
          style={{
            display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.45,
          }}
        >
          {r.description}
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem', alignItems: 'center' }}>
          <span className="text-xs text-navy-500">{r.meeting_title}</span>
          {showGroup && (
            <>
              <span className="text-navy-300">·</span>
              <span className="text-xs text-navy-400" style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                {r.group_id ? r.group_name : (
                  <><IconChurch className="w-2.5 h-2.5" style={{ flexShrink: 0 }}/> Kanisa Lote</>
                )}
              </span>
            </>
          )}
        </div>
      </td>

      {/* Responsible */}
      <td className="py-3 px-4 hidden md:table-cell" style={{ width: 160 }}>
        {r.responsible_name ? (
          <span className="text-sm text-navy-700">{r.responsible_name}</span>
        ) : r.responsible_note ? (
          <span className="text-xs text-navy-400 italic">{r.responsible_note}</span>
        ) : (
          <span className="text-navy-300">—</span>
        )}
      </td>

      {/* Deadline + urgency */}
      <td className="py-3 px-4 hidden sm:table-cell" style={{ width: 150 }}>
        {r.deadline ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span
              className="text-xs font-medium"
              style={{
                color: urgency === 'overdue' ? 'var(--danger)'
                     : urgency === 'due_soon' ? 'var(--warning, #d97706)'
                     : 'var(--text-secondary)',
              }}
            >
              {formatDate(r.deadline)}
            </span>
            {diff !== null && (
              <span className={`badge ${uCfg.cls}`} style={{ width: 'fit-content' }}>
                {urgency === 'overdue'
                  ? `${Math.abs(diff)} siku iliyopita`
                  : urgency === 'due_soon'
                  ? `Siku ${diff} zimebaki`
                  : urgency === 'on_track'
                  ? `Siku ${diff}`
                  : '—'}
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-navy-400">Bila tarehe</span>
        )}
      </td>

      {/* Status */}
      <td className="py-3 px-4" style={{ width: 150 }} onClick={e => e.stopPropagation()}>
        {canEdit ? (
          <StatusPicker
            resolutionId={r.id}
            meetingId={r.meeting_id}
            currentStatus={r.implementation_status}
            onUpdate={onUpdate}
          />
        ) : (
          <span className={`badge ${STATUS_CONFIG[r.implementation_status]?.cls || 'badge-neutral'}`}>
            {STATUS_CONFIG[r.implementation_status]?.label || r.implementation_status}
          </span>
        )}
      </td>

      {/* Arrow */}
      <td className="py-3 px-4" style={{ width: 36 }}>
        <IconChevronRight className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }}/>
      </td>
    </tr>
  );
}

// ── Group section header ──────────────────────────────────────────────────────
function GroupHeader({ label, count, openCount, isChurch }) {
  return (
    <tr style={{ background: 'var(--surface-sunken)' }}>
      <td colSpan={6} style={{ padding: '0.5rem 1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          {isChurch
            ? <IconChurch className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }}/>
            : <IconUsers className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }}/>
          }
          <span className="text-xs font-semibold text-navy-700">{label}</span>
          <span className="badge badge-neutral" style={{ fontSize: '0.6875rem' }}>{count} uamuzi</span>
          {openCount > 0 && (
            <span className="badge badge-warning" style={{ fontSize: '0.6875rem' }}>{openCount} wazi</span>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function ResolutionsPage() {
  const router    = useRouter();
  const { user }  = useAuth();

  const canEdit = user && ['pastor', 'elder', 'group_leader'].includes(user.role);

  // ── Data ─────────────────────────────────────────────────────────────────
  const [resolutions, setResolutions] = useState([]);
  const [groups,      setGroups]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [summary,     setSummary]     = useState(null);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [search,      setSearch]      = useState('');
  const [urgFilter,   setUrgFilter]   = useState('');   // overdue|due_soon|on_track|no_deadline
  const [statusFilter,setStatusFilter]= useState('');   // pending|in_progress|...
  const [groupFilter, setGroupFilter] = useState('');   // group_id or '' for all
  const [viewMode,    setViewMode]    = useState('grouped'); // grouped | flat

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = {};
      if (groupFilter) params.group_id = groupFilter;

      const [rRes, gRes] = await Promise.all([
        meetingApi.getOpenResolutions(params),
        groupApi.getAll({ is_archived: 0 }),
      ]);

      const rows = rRes.data.data || [];
      setResolutions(rows);
      setSummary(rRes.data.summary);
      setGroups(gRes.data.data || []);
    } catch (err) {
      setError(err.message || 'Imeshindwa kupakia maamuzi.');
    } finally {
      setLoading(false);
    }
  }, [groupFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Inline status update ──────────────────────────────────────────────────
  function handleStatusUpdate(resId, newStatus) {
    setResolutions(prev =>
      prev.map(r => r.id === resId ? { ...r, implementation_status: newStatus } : r)
    );
    // Refresh summary counts
    setSummary(prev => {
      if (!prev) return prev;
      // Recalculate from updated list (simple approach)
      return prev;
    });
  }

  // ── Derived / filtered list ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...resolutions];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.description?.toLowerCase().includes(q) ||
        r.meeting_title?.toLowerCase().includes(q) ||
        r.group_name?.toLowerCase().includes(q) ||
        r.responsible_name?.toLowerCase().includes(q)
      );
    }

    if (statusFilter) {
      list = list.filter(r => r.implementation_status === statusFilter);
    }

    if (urgFilter) {
      list = list.filter(r => {
        const u = urgencyFromDeadline(r.deadline, r.implementation_status);
        return u === urgFilter;
      });
    }

    return list;
  }, [resolutions, search, statusFilter, urgFilter]);

  // ── Grouped view data ─────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const map = new Map(); // key → { label, isChurch, rows }

    for (const r of filtered) {
      const key   = r.group_id ? String(r.group_id) : '__church__';
      const label = r.group_id ? (r.group_name || `Kikundi #${r.group_id}`) : 'Kanisa Lote';
      if (!map.has(key)) {
        map.set(key, { key, label, isChurch: !r.group_id, rows: [] });
      }
      map.get(key).rows.push(r);
    }

    // Sort: church first, then alphabetical
    return [...map.values()].sort((a, b) => {
      if (a.isChurch) return -1;
      if (b.isChurch) return 1;
      return a.label.localeCompare(b.label);
    });
  }, [filtered]);

  // ── Recalculated summary from filtered list ───────────────────────────────
  const filteredSummary = useMemo(() => ({
    total:       filtered.length,
    overdue:     filtered.filter(r => urgencyFromDeadline(r.deadline, r.implementation_status) === 'overdue').length,
    due_soon:    filtered.filter(r => urgencyFromDeadline(r.deadline, r.implementation_status) === 'due_soon').length,
    on_track:    filtered.filter(r => urgencyFromDeadline(r.deadline, r.implementation_status) === 'on_track').length,
    no_deadline: filtered.filter(r => !r.deadline).length,
  }), [filtered]);

  const hasFilters = search || urgFilter || statusFilter || groupFilter;
  const showGroup  = !groupFilter; // hide group column when filtered to one group

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="page-header-title">Maamuzi Wazi</h1>
            <p className="page-header-subtitle">
              Maamuzi yote yanayosubiri utekelezaji — vikao vyote unavyoweza kufikia
            </p>
          </div>
          <div className="page-header-actions">
            <button
              className="btn btn-secondary btn-sm"
              onClick={fetchData}
              disabled={loading}
            >
              <IconRefresh className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}/>
              Onyesha upya
            </button>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 max-w-content">

        {/* ── Error ─────────────────────────────────────────────────────── */}
        {error && (
          <div className="banner banner-danger" style={{ marginBottom: '1.25rem' }}>
            <IconAlertCircle className="w-4 h-4 flex-shrink-0"/>
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* ── Stat strip ─────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: '0.875rem', marginBottom: '1.5rem' }}>
          {[
            {
              label: 'Maamuzi Wazi',
              value: loading ? '…' : filteredSummary.total,
              sub:   summary?.total !== filteredSummary.total && !loading
                     ? `${summary?.total ?? 0} zote` : null,
              accent: false,
            },
            {
              label:  'Imepita Tarehe',
              value:  loading ? '…' : filteredSummary.overdue,
              sub:    null,
              accent: filteredSummary.overdue > 0,
              color:  'var(--danger)',
              active: urgFilter === 'overdue',
              filter: 'overdue',
            },
            {
              label:  'Inakaribia (wiki)',
              value:  loading ? '…' : filteredSummary.due_soon,
              sub:    null,
              accent: false,
              color:  'var(--warning, #d97706)',
              active: urgFilter === 'due_soon',
              filter: 'due_soon',
            },
            {
              label:  'Iko Sawa',
              value:  loading ? '…' : filteredSummary.on_track,
              sub:    null,
              accent: false,
              active: urgFilter === 'on_track',
              filter: 'on_track',
            },
            {
              label:  'Bila Tarehe',
              value:  loading ? '…' : filteredSummary.no_deadline,
              sub:    null,
              accent: false,
              active: urgFilter === 'no_deadline',
              filter: 'no_deadline',
            },
          ].map(s => (
            <button
              key={s.label}
              className="stat-card"
              style={{
                textAlign: 'left', cursor: s.filter ? 'pointer' : 'default',
                outline: 'none', border: 'none',
                boxShadow: s.active ? `0 0 0 2px ${s.color || 'var(--gold)'}` : undefined,
                transition: 'box-shadow 0.12s',
              }}
              onClick={() => s.filter && setUrgFilter(u => u === s.filter ? '' : s.filter)}
            >
              <p className="stat-label">{s.label}</p>
              <p
                className="stat-value"
                style={{ color: s.accent ? s.color : undefined }}
              >
                {s.value}
              </p>
              {s.sub && <p className="stat-delta neutral">{s.sub}</p>}
            </button>
          ))}
        </div>

        {/* ── Filter bar ────────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex', gap: '0.625rem', flexWrap: 'wrap',
            alignItems: 'center', marginBottom: '1rem',
          }}
        >
          {/* Search */}
          <div className="search-bar" style={{ flex: '1 1 220px', minWidth: 200 }}>
            <IconSearch className="w-4 h-4" style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}/>
            <input
              placeholder="Tafuta uamuzi, kikao, kikundi…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')}>
                <IconX className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }}/>
              </button>
            )}
          </div>

          {/* Status filter */}
          <select
            className="select"
            style={{ maxWidth: 180 }}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">Hali zote</option>
            <option value="pending">Inasubiri</option>
            <option value="in_progress">Inaendelea</option>
            <option value="completed">Imekamilika</option>
            <option value="deferred">Imeahirishwa</option>
            <option value="cancelled">Imefutwa</option>
          </select>

          {/* Group filter */}
          <select
            className="select"
            style={{ maxWidth: 200 }}
            value={groupFilter}
            onChange={e => setGroupFilter(e.target.value)}
          >
            <option value="">Vikundi vyote</option>
            <option value="church">Kanisa Lote tu</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>

          {/* Clear filters */}
          {hasFilters && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => { setSearch(''); setUrgFilter(''); setStatusFilter(''); setGroupFilter(''); }}
            >
              <IconX className="w-3.5 h-3.5"/> Ondoa Vichujio
            </button>
          )}

          {/* View mode toggle */}
          <div
            style={{
              display: 'flex', borderRadius: 8, overflow: 'hidden',
              border: '1px solid var(--border-default)',
              marginLeft: 'auto', flexShrink: 0,
            }}
          >
            {[
              { mode: 'grouped', Icon: IconLayout, title: 'Grouped' },
              { mode: 'flat',    Icon: IconList,   title: 'Flat'    },
            ].map(({ mode, Icon, title }) => (
              <button
                key={mode}
                title={title}
                onClick={() => setViewMode(mode)}
                style={{
                  padding: '0.375rem 0.625rem',
                  background: viewMode === mode ? 'var(--gold)' : 'transparent',
                  border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center',
                  transition: 'background 0.12s',
                }}
              >
                <Icon
                  className="w-3.5 h-3.5"
                  style={{ color: viewMode === mode ? 'var(--navy-dark)' : 'var(--text-secondary)' }}
                />
              </button>
            ))}
          </div>
        </div>

        {/* ── Active filter chips ───────────────────────────────────────── */}
        {urgFilter && (
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                padding: '0.25rem 0.625rem', borderRadius: 20,
                background: 'rgba(196,154,42,0.12)', border: '1px solid rgba(196,154,42,0.3)',
                fontSize: '0.75rem', color: 'var(--navy)',
              }}
            >
              <IconFilter className="w-3 h-3"/>
              {URGENCY_CONFIG[urgFilter]?.label}
              <button
                onClick={() => setUrgFilter('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}
              >
                <IconX className="w-3 h-3"/>
              </button>
            </div>
          </div>
        )}

        {/* ── Loading skeleton ──────────────────────────────────────────── */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="skeleton" style={{ height: 64, borderRadius: 10 }}/>
            ))}
          </div>
        )}

        {/* ── Empty state ───────────────────────────────────────────────── */}
        {!loading && filtered.length === 0 && (
          <div className="card">
            <div className="empty-state">
              <IconCheckSquare className="empty-state-icon" style={{ color: 'var(--success)' }}/>
              <p className="empty-state-title">
                {hasFilters ? 'Hakuna Matokeo' : 'Maamuzi Yote Yamekamilika! '}
              </p>
              <p className="empty-state-body">
                {hasFilters
                  ? 'Hakuna maamuzi yanayolingana na vichujio ulivyochagua.'
                  : 'Hakuna maamuzi yanayosubiri utekelezaji kwa vikao unavyoweza kuona.'}
              </p>
              {hasFilters && (
                <div className="empty-state-actions">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => { setSearch(''); setUrgFilter(''); setStatusFilter(''); setGroupFilter(''); }}
                  >
                    Ondoa Vichujio
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Table ─────────────────────────────────────────────────────── */}
        {!loading && filtered.length > 0 && (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 44 }}>#</th>
                  <th>Uamuzi</th>
                  <th className="hidden md:table-cell">Anayehusika</th>
                  <th className="hidden sm:table-cell">Tarehe ya Mwisho</th>
                  <th>Hali</th>
                  <th style={{ width: 36 }}></th>
                </tr>
              </thead>
              <tbody>
                {viewMode === 'grouped'
                  ? grouped.map(section => {
                      const openCount = section.rows.filter(r =>
                        ['pending', 'in_progress'].includes(r.implementation_status)
                      ).length;
                      return (
                        <>
                          <GroupHeader
                            key={`hdr-${section.key}`}
                            label={section.label}
                            count={section.rows.length}
                            openCount={openCount}
                            isChurch={section.isChurch}
                          />
                          {section.rows.map(r => (
                            <ResolutionRow
                              key={r.id}
                              r={r}
                              canEdit={canEdit}
                              onUpdate={handleStatusUpdate}
                              onNavigate={id => router.push(`/dashboard/meetings/${id}`)}
                              showGroup={false}
                            />
                          ))}
                        </>
                      );
                    })
                  : filtered.map(r => (
                      <ResolutionRow
                        key={r.id}
                        r={r}
                        canEdit={canEdit}
                        onUpdate={handleStatusUpdate}
                        onNavigate={id => router.push(`/dashboard/meetings/${id}`)}
                        showGroup={showGroup}
                      />
                    ))
                }
              </tbody>
            </table>

            {/* Footer */}
            <div className="card-footer">
              <span className="text-xs text-navy-500">
                {filtered.length} uamuzi
                {filtered.length !== resolutions.length && ` (kati ya ${resolutions.length} wote wazi)`}
              </span>
              {filteredSummary.overdue > 0 && (
                <span className="text-xs" style={{ color: 'var(--danger)', fontWeight: 600 }}>
                  ⚠ {filteredSummary.overdue} imepita tarehe ya mwisho
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}