'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../hooks/useAuth';
import { useTranslation } from '../../../lib/i18n';
import { groupApi } from '../../../lib/api';
import PageHeader from '../../../components/ui/PageHeader';
import Modal from '../../../components/ui/Modal';
import Toast from '../../../components/ui/Toast';

// ─── Types ────────────────────────────────────────────────────────────────────
const GROUP_TYPES = ['jumuiya', 'huduma', 'kwaya', 'idara', 'kamati', 'vingine'];

const GROUP_TYPE_LABELS = {
  en: { jumuiya: 'Jumuiya', huduma: 'Huduma', kwaya: 'Kwaya', idara: 'Idara', kamati: 'Kamati', vingine: 'Vingine' },
  sw: { jumuiya: 'Jumuiya', huduma: 'Huduma', kwaya: 'Kwaya', idara: 'Idara', kamati: 'Kamati', vingine: 'Vingine' },
};

const GROUP_TYPE_ICONS = {
  jumuiya: '◉', huduma: '✦', kwaya: '♪', idara: '◈', kamati: '◆', vingine: '◇',
};

// Type → accent colour pair [bg, text, border]
const TYPE_COLORS = {
  jumuiya: ['#EBF2FF', '#1B3A6B', '#C5D8F5'],
  huduma:  ['#F0FAF4', '#1A5C38', '#B8E8C8'],
  kwaya:   ['#FDF6E8', '#7A5A00', '#E8D090'],
  idara:   ['#F5F0FF', '#4A1A7A', '#D5B8F0'],
  kamati:  ['#FFF0F0', '#7A1A1A', '#F0B8B8'],
  vingine: ['#F5F5F7', '#5A5A60', '#DCDCE0'],
};

const CURRENT_YEAR = new Date().getFullYear();

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getInitials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

const AVATAR_PALETTES = [
  ['#1B3A6B', '#C8A84B'], ['#1A5C38', '#7ED5A0'],
  ['#5C1A1A', '#E8A0A0'], ['#1A395C', '#7EB5E8'],
  ['#3D1A5C', '#C0A0E8'], ['#5C3D1A', '#E8C07E'],
];
function avatarPalette(name) {
  let n = 0;
  for (let i = 0; i < (name || '').length; i++) n += name.charCodeAt(i);
  return AVATAR_PALETTES[n % AVATAR_PALETTES.length];
}

// ─── Mini avatar stack ────────────────────────────────────────────────────────
// Shows up to 4 member initials circles stacked, then "+N more"
function AvatarStack({ members = [], max = 4 }) {
  const shown = members.slice(0, max);
  const extra = members.length - shown.length;

  if (!shown.length) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {shown.map((m, i) => {
        const url = m.profile_photo_url || m.avatar;
        const [bg, fg] = avatarPalette(m.full_name);
        return (
          <div
            key={m.id || i}
            style={{
              width: 26, height: 26, borderRadius: '50%',
              border: '2px solid #fff',
              marginLeft: i === 0 ? 0 : -8,
              zIndex: shown.length - i,
              flexShrink: 0,
              overflow: 'hidden',
              background: bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, fontWeight: 700, color: fg,
              boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
            }}
          >
            {url
              ? <img src={url} alt={m.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none'; }} />
              : getInitials(m.full_name)
            }
          </div>
        );
      })}
      {extra > 0 && (
        <div style={{
          width: 26, height: 26, borderRadius: '50%',
          border: '2px solid #fff',
          marginLeft: -8,
          background: '#F0F0F2',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 8, fontWeight: 700, color: '#8A8A8E',
          boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
        }}>
          +{extra}
        </div>
      )}
    </div>
  );
}

// ─── Group Card ───────────────────────────────────────────────────────────────
function GroupCard({ g, lang, isManager, onArchive, onDelete }) {
  const typeLabel = GROUP_TYPE_LABELS[lang]?.[g.type] || g.type;
  const typeIcon  = GROUP_TYPE_ICONS[g.type] || '◇';
  const [tBg, tText, tBorder] = TYPE_COLORS[g.type] || TYPE_COLORS.vingine;

  const activeCount = g.active_member_count ?? g.member_count ?? 0;
  const totalCount  = g.total_member_count  ?? activeCount;

  return (
    <Link
      href={`/dashboard/groups/${g.id}`}
      style={{ textDecoration: 'none', display: 'block' }}
    >
      <div
        style={{
          background: '#fff',
          border: '1px solid #EBEBEC',
          borderRadius: 12,
          padding: '18px 20px',
          transition: 'box-shadow 0.15s, border-color 0.15s',
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(27,58,107,0.10)';
          e.currentTarget.style.borderColor = '#C5D8F5';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.boxShadow = 'none';
          e.currentTarget.style.borderColor = '#EBEBEC';
        }}
      >
        {/* Archived banner */}
        {g.is_archived && (
          <div style={{
            position: 'absolute', top: 0, right: 0,
            background: '#F5F5F7', borderLeft: '1px solid #EBEBEC', borderBottom: '1px solid #EBEBEC',
            borderRadius: '0 12px 0 8px',
            padding: '3px 10px',
            fontSize: 9, fontWeight: 700, color: '#AEADB3', letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>
            {lang === 'sw' ? 'Imehifadhiwa' : 'Archived'}
          </div>
        )}

        {/* Top row: icon + type badge + actions */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 9,
              background: tBg, border: `1px solid ${tBorder}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, color: tText, flexShrink: 0,
            }}>
              {typeIcon}
            </div>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
              background: tBg, color: tText, border: `1px solid ${tBorder}`,
              borderRadius: 5, padding: '2px 8px',
            }}>
              {typeLabel}
            </span>
          </div>

          {/* Manager actions — stop propagation so clicks don't navigate */}
          {isManager && (
            <div
              style={{ display: 'flex', gap: 4 }}
              onClick={e => e.preventDefault()}
            >
              {!g.is_archived && (
                <button
                  onClick={e => { e.preventDefault(); onArchive(g.id); }}
                  style={{
                    fontSize: 11, color: '#8A8A8E', fontWeight: 500,
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '3px 6px', borderRadius: 5,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F5F5F7'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  {lang === 'sw' ? 'Hifadhi' : 'Archive'}
                </button>
              )}
              <button
                onClick={e => { e.preventDefault(); onDelete(g.id); }}
                style={{
                  fontSize: 11, color: '#DC2626', fontWeight: 500,
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '3px 6px', borderRadius: 5,
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#FEF2F2'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                {lang === 'sw' ? 'Futa' : 'Delete'}
              </button>
            </div>
          )}
        </div>

        {/* Name */}
        <p style={{
          fontSize: 15, fontWeight: 700, color: '#1A1A1E',
          marginBottom: 3, lineHeight: 1.3,
        }}>
          {lang === 'sw' ? (g.name_sw || g.name) : g.name}
        </p>

        {/* Leader + year meta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {g.leader_name && (
            <span style={{ fontSize: 11, color: '#8A8A8E', fontWeight: 500 }}>{g.leader_name}</span>
          )}
          {g.leader_name && g.year && (
            <span style={{ color: '#D5D5D8', fontSize: 10 }}>·</span>
          )}
          {g.year && (
            <span style={{ fontSize: 11, color: '#AEADB3', fontVariantNumeric: 'tabular-nums' }}>{g.year}</span>
          )}
          {g.description && (
            <>
              {(g.leader_name || g.year) && <span style={{ color: '#D5D5D8', fontSize: 10 }}>·</span>}
              <span style={{
                fontSize: 11, color: '#AEADB3',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: 160,
              }}>
                {g.description}
              </span>
            </>
          )}
        </div>

        {/* Bottom row: avatar stack + member count */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <AvatarStack members={g.recent_members || []} max={4} />

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#1A1A1E', lineHeight: 1 }}>
              {activeCount}
            </span>
            <span style={{ fontSize: 11, color: '#AEADB3', fontWeight: 500 }}>
              {lang === 'sw' ? 'washarika' : 'members'}
              {totalCount > activeCount && (
                <span style={{ color: '#D5D5D8', marginLeft: 3 }}>/ {totalCount} {lang === 'sw' ? 'jumla' : 'total'}</span>
              )}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Summary stats ─────────────────────────────────────────────────────────────
function SummaryBar({ groups, lang }) {
  const total   = groups.length;
  const active  = groups.filter(g => !g.is_archived).length;
  const members = groups.reduce((s, g) => s + (g.active_member_count ?? g.member_count ?? 0), 0);

  // Most populated type
  const typeTotals = {};
  groups.forEach(g => {
    typeTotals[g.type] = (typeTotals[g.type] || 0) + (g.active_member_count ?? g.member_count ?? 0);
  });
  const topType = Object.entries(typeTotals).sort((a, b) => b[1] - a[1])[0]?.[0];

  const stats = [
    { value: total,   label: lang === 'sw' ? 'Vikundi vyote' : 'Total groups' },
    { value: active,  label: lang === 'sw' ? 'Vya sasa'      : 'Active' },
    { value: members, label: lang === 'sw' ? 'Washarika'     : 'Total members' },
    {
      value: topType ? GROUP_TYPE_ICONS[topType] + ' ' + (GROUP_TYPE_LABELS[lang]?.[topType] || topType) : '—',
      label: lang === 'sw' ? 'Kubwa zaidi' : 'Largest type',
      text: true,
    },
  ];

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
      background: '#F7F7F9', borderRadius: 10, border: '1px solid #EBEBEC',
      overflow: 'hidden', marginBottom: 24,
    }}>
      {stats.map((s, i) => (
        <div key={s.label} style={{
          padding: '14px 10px', textAlign: 'center',
          borderRight: i < stats.length - 1 ? '1px solid #EBEBEC' : 'none',
        }}>
          <p style={{
            fontSize: s.text ? 13 : 22, fontWeight: 700,
            color: '#1A1A1E', lineHeight: 1, marginBottom: 4,
          }}>
            {s.value}
          </p>
          <p style={{ fontSize: 10, color: '#8A8A8E', fontWeight: 500 }}>{s.label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function GroupsPage() {
  const { user, lang } = useAuth();
  const { t } = useTranslation(lang);

  const [groups,  setGroups]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast,   setToast]   = useState(null);
  const [search,  setSearch]  = useState('');

  const [filterType,     setFilterType]     = useState('');
  const [filterArchived, setFilterArchived] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [form, setForm] = useState({
    name: '', name_sw: '', type: 'jumuiya',
    description: '', year: CURRENT_YEAR,
    start_date: '', end_date: '',
  });

  const [archiveId, setArchiveId] = useState(null);
  const [deleteId,  setDeleteId]  = useState(null);

  const isManager = ['pastor', 'elder'].includes(user?.role);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchGroups = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterType)     params.type        = filterType;
      if (filterArchived) params.is_archived = 1;
      const res = await groupApi.getAll(params);
      setGroups(res.data.data);
    } catch (_) {
      showToast(lang === 'sw' ? 'Imeshindwa kupakia vikundi' : 'Failed to load groups', 'error');
    } finally {
      setLoading(false);
    }
  }, [filterType, filterArchived, lang]);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await groupApi.create({
        ...form,
        year:       form.year       || null,
        start_date: form.start_date || null,
        end_date:   form.end_date   || null,
      });
      showToast(lang === 'sw' ? 'Kikundi kimeundwa' : 'Group created');
      setCreateOpen(false);
      setForm({ name: '', name_sw: '', type: 'jumuiya', description: '', year: CURRENT_YEAR, start_date: '', end_date: '' });
      fetchGroups();
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (id) => {
    try {
      await groupApi.archive(id);
      showToast(lang === 'sw' ? 'Kikundi kimehifadhiwa' : 'Group archived');
      setArchiveId(null);
      fetchGroups();
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleDelete = async (id) => {
    try {
      await groupApi.delete(id);
      showToast(lang === 'sw' ? 'Kikundi kimefutwa' : 'Group deleted');
      setDeleteId(null);
      fetchGroups();
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const set = (f) => (e) => setForm(v => ({ ...v, [f]: e.target.value }));

  // Type counts for filter pills
  const typeCount = {};
  groups.forEach(g => { typeCount[g.type] = (typeCount[g.type] || 0) + 1; });

  // Client-side search
  const filtered = groups.filter(g =>
    !search ||
    (g.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (g.name_sw || '').toLowerCase().includes(search.toLowerCase()) ||
    (g.leader_name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader
        breadcrumb={lang === 'sw' ? 'Watu' : 'People'}
        title={lang === 'sw' ? 'Vikundi' : 'Groups'}
        subtitle={`${groups.length} ${lang === 'sw' ? 'vikundi' : 'groups'}`}
        action={isManager && (
          <button onClick={() => setCreateOpen(true)} className="btn-primary">
            + {lang === 'sw' ? 'Kikundi Kipya' : 'New Group'}
          </button>
        )}
      />

      <div className="px-8 py-8 max-w-content">

        {/* Summary bar */}
        {!loading && groups.length > 0 && (
          <SummaryBar groups={groups} lang={lang} />
        )}

        {/* Search + filter row */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: '0 0 220px' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#AEADB3" strokeWidth="2.5" strokeLinecap="round"
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={lang === 'sw' ? 'Tafuta kikundi…' : 'Search groups…'}
              style={{
                width: '100%', paddingLeft: 30, paddingRight: 10,
                height: 34, borderRadius: 7, border: '1px solid #E5E5E8',
                background: '#fff', fontSize: 13, color: '#1A1A1E', outline: 'none',
              }}
              onFocus={e => e.target.style.borderColor = '#1B3A6B'}
              onBlur={e => e.target.style.borderColor = '#E5E5E8'}
            />
          </div>

          {/* Type filters */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
            <button
              onClick={() => setFilterType('')}
              style={{
                fontSize: 11, fontWeight: 600, padding: '4px 12px',
                borderRadius: 99, border: `1px solid ${!filterType ? '#1B3A6B' : '#E5E5E8'}`,
                background: !filterType ? '#1B3A6B' : '#fff',
                color: !filterType ? '#fff' : '#5A5A60',
                cursor: 'pointer', transition: 'all 0.12s',
              }}
            >
              {lang === 'sw' ? 'Yote' : 'All'}
            </button>
            {GROUP_TYPES.map(type => {
              const active = filterType === type;
              const [tBg, tText, tBorder] = TYPE_COLORS[type];
              return (
                <button
                  key={type}
                  onClick={() => setFilterType(t => t === type ? '' : type)}
                  style={{
                    fontSize: 11, fontWeight: 600, padding: '4px 12px',
                    borderRadius: 99,
                    border: `1px solid ${active ? tBorder : '#E5E5E8'}`,
                    background: active ? tBg : '#fff',
                    color: active ? tText : '#5A5A60',
                    cursor: 'pointer', transition: 'all 0.12s',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <span>{GROUP_TYPE_ICONS[type]}</span>
                  {GROUP_TYPE_LABELS[lang]?.[type]}
                  {typeCount[type] ? (
                    <span style={{ opacity: 0.6, fontSize: 10 }}>({typeCount[type]})</span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {/* Archived toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none', marginLeft: 'auto' }}>
            <span style={{ fontSize: 11, color: '#8A8A8E', fontWeight: 500 }}>
              {lang === 'sw' ? 'Zilizohifadhiwa' : 'Show archived'}
            </span>
            <input
              type="checkbox"
              checked={filterArchived}
              onChange={e => setFilterArchived(e.target.checked)}
              style={{ accentColor: '#1B3A6B', width: 14, height: 14 }}
            />
          </label>
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ padding: '64px 0', display: 'flex', justifyContent: 'center' }}>
            <span className="w-5 h-5 border-2 border-border border-t-ink-muted rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            padding: '48px 20px', textAlign: 'center',
            background: '#F7F7F9', borderRadius: 10, border: '1px solid #EBEBEC',
          }}>
            <p style={{ fontSize: 13, color: '#8A8A8E' }}>
              {search
                ? (lang === 'sw' ? 'Hakuna matokeo' : 'No results found')
                : (lang === 'sw' ? 'Hakuna vikundi' : 'No groups found')}
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 14,
          }}>
            {filtered.map(g => (
              <GroupCard
                key={g.id}
                g={g}
                lang={lang}
                isManager={isManager}
                onArchive={setArchiveId}
                onDelete={setDeleteId}
              />
            ))}
          </div>
        )}

        {filtered.length > 0 && (
          <p style={{ fontSize: 11, color: '#AEADB3', marginTop: 14, textAlign: 'right' }}>
            {filtered.length} {lang === 'sw' ? 'vikundi vinavyoonyeshwa' : 'groups shown'}
          </p>
        )}
      </div>

      {/* ── Create Modal ──────────────────────────────────────────────────── */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title={lang === 'sw' ? 'Kikundi Kipya' : 'New Group'}>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">{lang === 'sw' ? 'Jina (Kiingereza)' : 'Name (English)'}</label>
              <input value={form.name} onChange={set('name')} className="field-input" required />
            </div>
            <div>
              <label className="field-label">{lang === 'sw' ? 'Jina (Kiswahili)' : 'Name (Swahili)'}</label>
              <input value={form.name_sw} onChange={set('name_sw')} className="field-input" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">{lang === 'sw' ? 'Aina' : 'Type'}</label>
              <select value={form.type} onChange={set('type')} className="field-input">
                {GROUP_TYPES.map(type => (
                  <option key={type} value={type}>{GROUP_TYPE_ICONS[type]} {GROUP_TYPE_LABELS.en[type]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">{lang === 'sw' ? 'Mwaka' : 'Year'}</label>
              <input type="number" value={form.year} onChange={set('year')} min="1900" max={CURRENT_YEAR + 5} className="field-input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">{lang === 'sw' ? 'Tarehe ya Kuanza' : 'Start Date'}</label>
              <input type="date" value={form.start_date} onChange={set('start_date')} className="field-input" />
            </div>
            <div>
              <label className="field-label">{lang === 'sw' ? 'Tarehe ya Kumaliza' : 'End Date'}</label>
              <input type="date" value={form.end_date} onChange={set('end_date')} className="field-input" />
            </div>
          </div>
          <div>
            <label className="field-label">{lang === 'sw' ? 'Maelezo' : 'Description'}</label>
            <textarea value={form.description} onChange={set('description')} rows={2} className="field-input resize-none" />
          </div>
          <div className="hairline" />
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setCreateOpen(false)} className="btn-secondary">{t('cancel')}</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? t('loading') : t('save')}</button>
          </div>
        </form>
      </Modal>

      {/* ── Archive Confirm ───────────────────────────────────────────────── */}
      <Modal isOpen={!!archiveId} onClose={() => setArchiveId(null)} title={lang === 'sw' ? 'Hifadhi Kikundi?' : 'Archive Group?'}>
        <p className="text-sm text-ink-muted">
          {lang === 'sw'
            ? 'Kikundi kitahifadhiwa. Washarika na historia vitabaki salama.'
            : 'The group will be archived. Members and history will be preserved.'}
        </p>
        <div className="hairline mt-5 mb-4" />
        <div className="flex gap-3 justify-end">
          <button onClick={() => setArchiveId(null)} className="btn-secondary">{t('cancel')}</button>
          <button onClick={() => handleArchive(archiveId)} className="btn-primary">{lang === 'sw' ? 'Hifadhi' : 'Archive'}</button>
        </div>
      </Modal>

      {/* ── Delete Confirm ────────────────────────────────────────────────── */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title={lang === 'sw' ? 'Futa Kikundi?' : 'Delete Group?'}>
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