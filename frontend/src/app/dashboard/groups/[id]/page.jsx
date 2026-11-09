'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../../hooks/useAuth';
import { useTranslation } from '../../../../lib/i18n';
import { groupApi, userApi } from '../../../../lib/api';
import PageHeader from '../../../../components/ui/PageHeader';
import Modal from '../../../../components/ui/Modal';
import Toast from '../../../../components/ui/Toast';

// ─── Constants ────────────────────────────────────────────────────────────────
const GROUP_TYPES = ['jumuiya', 'ministry', 'administrative', 'other'];
const GROUP_TYPE_LABELS = {
  en: { jumuiya: 'Jumuiya', ministry: 'Ministry', administrative: 'Administrative', other: 'Other' },
  sw: { jumuiya: 'Jumuiya', ministry: 'Huduma',   administrative: 'Utawala',        other: 'Nyingine' },
};
const GROUP_TYPE_ICONS = {
  jumuiya: '◉', ministry: '✦', administrative: '◈', other: '◇',
};

const MEMBER_ROLE_LABELS = {
  en: { pastor: 'Pastor', elder: 'Elder', group_leader: 'Leader', member: 'Member' },
  sw: { pastor: 'Mchungaji', elder: 'Mzee', group_leader: 'Kiongozi', member: 'Mshirika' },
};

const ROLE_IN_GROUP_OPTIONS = [
  { value: 'member',    en: 'Member',    sw: 'Msharika' },
  { value: 'leader',    en: 'Leader',    sw: 'Kiongozi'   },
  { value: 'secretary', en: 'Secretary', sw: 'Katibu'     },
  { value: 'treasurer', en: 'Treasurer', sw: 'Mweka Hazina' },
  { value: 'other',     en: 'Other',     sw: 'Nyingine'   },
];

// Role → visual weight for sorting/display
const ROLE_RANK = { leader: 0, secretary: 1, treasurer: 2, member: 3, other: 4 };

const CURRENT_YEAR = new Date().getFullYear();

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtShort(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getInitials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

// Deterministic avatar background from name
const AVATAR_PALETTES = [
  ['#1B3A6B', '#C8A84B'],
  ['#1A5C38', '#7ED5A0'],
  ['#5C1A1A', '#E8A0A0'],
  ['#1A395C', '#7EB5E8'],
  ['#3D1A5C', '#C0A0E8'],
  ['#5C3D1A', '#E8C07E'],
];
function avatarPalette(name) {
  let n = 0;
  for (let i = 0; i < (name || '').length; i++) n += name.charCodeAt(i);
  return AVATAR_PALETTES[n % AVATAR_PALETTES.length];
}

// ─── Member Avatar ─────────────────────────────────────────────────────────────
function MemberAvatar({ member, size = 56 }) {
  const [imgErr, setImgErr] = useState(false);
  const url = member.profile_photo_url || member.avatar;
  const [bg, fg] = avatarPalette(member.full_name);

  if (url && !imgErr) {
    return (
      <img
        src={url}
        alt={member.full_name}
        onError={() => setImgErr(true)}
        style={{
          width: size, height: size, borderRadius: '50%',
          objectFit: 'cover', objectPosition: 'center top',
          display: 'block', flexShrink: 0,
          border: '2px solid #fff',
          boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
        }}
      />
    );
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: bg, color: fg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.33, fontWeight: 700, letterSpacing: '-0.02em',
      flexShrink: 0,
      border: '2px solid #fff',
      boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
    }}>
      {getInitials(member.full_name)}
    </div>
  );
}

// ─── Role pill ────────────────────────────────────────────────────────────────
function RolePill({ role, lang }) {
  const opt = ROLE_IN_GROUP_OPTIONS.find(r => r.value === role);
  if (!opt || role === 'member') return null;

  const colors = {
    leader:    { bg: '#EBF2FF', color: '#1B3A6B', border: '#C5D8F5' },
    secretary: { bg: '#F0FAF4', color: '#1A5C38', border: '#B8E8C8' },
    treasurer: { bg: '#FDF6E8', color: '#7A5A00', border: '#E8D090' },
    other:     { bg: '#F5F5F7', color: '#5A5A60', border: '#DCDCE0' },
  };
  const c = colors[role] || colors.other;

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontSize: 10, fontWeight: 700,
      padding: '2px 7px', borderRadius: 4,
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
      letterSpacing: '0.03em',
    }}>
      {lang === 'sw' ? opt.sw : opt.en}
    </span>
  );
}

// ─── Status indicator ─────────────────────────────────────────────────────────
function StatusDot({ status }) {
  const map = {
    active:   { color: '#22C55E', label: 'Active' },
    inactive: { color: '#F59E0B', label: 'Inactive' },
    former:   { color: '#94A3B8', label: 'Former' },
  };
  const s = map[status] || map.active;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 10, fontWeight: 600, color: s.color,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
      {s.label}
    </span>
  );
}

// ─── Member Card ─────────────────────────────────────────────────────────────
function MemberCard({ m, lang, isManager, onRemove }) {
  const roleLabel     = MEMBER_ROLE_LABELS[lang]?.[m.system_role] || m.system_role;
  const genderLabel   = m.gender === 'Male'
    ? (lang === 'sw' ? 'Mwanaume' : 'Male')
    : m.gender === 'Female'
    ? (lang === 'sw' ? 'Mwanamke' : 'Female')
    : null;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '56px 1fr auto',
      gap: '0 14px',
      alignItems: 'start',
      padding: '14px 20px',
      background: '#fff',
      transition: 'background 0.1s',
    }}
      onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'}
      onMouseLeave={e => e.currentTarget.style.background = '#fff'}
    >
      {/* Avatar */}
      <div style={{ paddingTop: 2 }}>
        <MemberAvatar member={m} size={48} />
      </div>

      {/* Main info */}
      <div style={{ minWidth: 0 }}>
        {/* Name + role pill row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1E', lineHeight: 1.2 }}>
            {m.full_name}
          </span>
          <RolePill role={m.role_in_group} lang={lang} />
        </div>

        {/* System role + gender */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: '#8A8A8E', fontWeight: 500 }}>{roleLabel}</span>
          {genderLabel && (
            <>
              <span style={{ color: '#D5D5D8', fontSize: 10 }}>·</span>
              <span style={{ fontSize: 11, color: '#8A8A8E' }}>{genderLabel}</span>
            </>
          )}
          {m.year && (
            <>
              <span style={{ color: '#D5D5D8', fontSize: 10 }}>·</span>
              <span style={{ fontSize: 11, color: '#8A8A8E', fontVariantNumeric: 'tabular-nums' }}>{m.year}</span>
            </>
          )}
        </div>

        {/* Detail chips row */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {m.phone && (
            <a
              href={`tel:${m.phone}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 11, color: '#1B3A6B', fontWeight: 500,
                textDecoration: 'none', background: '#EBF2FF',
                padding: '3px 8px', borderRadius: 5,
                border: '1px solid #C5D8F5',
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.44 2 2 0 0 1 3.59 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.56a16 16 0 0 0 5.73 5.73l.94-.94a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
              {m.phone}
            </a>
          )}
          {m.joined_date && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 11, color: '#5A5A60',
              background: '#F5F5F7', padding: '3px 8px', borderRadius: 5,
              border: '1px solid #E5E5E8',
            }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
              </svg>
              {lang === 'sw' ? 'Alijiunga' : 'Joined'} {fmtShort(m.joined_date)}
            </span>
          )}
          {m.member_status && m.member_status !== 'hai' && (
            <span style={{
              fontSize: 10, fontWeight: 600,
              background: '#FEF3C7', color: '#92400E',
              padding: '2px 7px', borderRadius: 4, border: '1px solid #FDE68A',
            }}>
              {m.member_status}
            </span>
          )}
        </div>
      </div>

      {/* Right: status + actions */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, paddingTop: 2 }}>
        <StatusDot status={m.status} />
        {isManager && m.status === 'active' && (
          <button
            onClick={() => onRemove({ membershipId: m.membership_id || m.id, name: m.full_name })}
            style={{
              fontSize: 11, color: '#DC2626', fontWeight: 500,
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '2px 0',
            }}
            onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
            onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
          >
            {lang === 'sw' ? 'Ondoa' : 'Remove'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Members stats bar ─────────────────────────────────────────────────────────
function MembersStats({ members, lang }) {
  const active  = members.filter(m => m.status === 'active');
  const male    = active.filter(m => m.gender === 'Male').length;
  const female  = active.filter(m => m.gender === 'Female').length;
  const leaders = active.filter(m => m.role_in_group && m.role_in_group !== 'member').length;
  const total   = active.length;
  const withPhone = active.filter(m => m.phone).length;

  const stats = [
    { value: total,     label: lang === 'sw' ? 'Waharika'  : 'Members' },
    { value: male,      label: lang === 'sw' ? 'Wanaume'    : 'Male'    },
    { value: female,    label: lang === 'sw' ? 'Wanawake'   : 'Female'  },
    { value: leaders,   label: lang === 'sw' ? 'Viongozi'   : 'Leaders' },
    { value: withPhone, label: lang === 'sw' ? 'Na Simu'    : 'With phone' },
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
      background: '#F7F7F9',
      borderRadius: 10,
      border: '1px solid #EBEBEC',
      overflow: 'hidden',
      marginBottom: 20,
    }}>
      {stats.map((s, i) => (
        <div
          key={s.label}
          style={{
            padding: '12px 8px',
            textAlign: 'center',
            borderRight: i < stats.length - 1 ? '1px solid #EBEBEC' : 'none',
          }}
        >
          <p style={{ fontSize: 20, fontWeight: 700, color: '#1A1A1E', lineHeight: 1, marginBottom: 3 }}>
            {s.value}
          </p>
          <p style={{ fontSize: 10, color: '#8A8A8E', fontWeight: 500, lineHeight: 1.2 }}>
            {s.label}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Search bar ───────────────────────────────────────────────────────────────
function SearchBar({ value, onChange, lang }) {
  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
      <svg
        width="13" height="13" viewBox="0 0 24 24" fill="none"
        stroke="#AEADB3" strokeWidth="2.5" strokeLinecap="round"
        style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
      >
        <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
      </svg>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={lang === 'sw' ? 'Tafuta Msharika…' : 'Search members…'}
        style={{
          width: '100%', paddingLeft: 30, paddingRight: 10,
          height: 34, borderRadius: 7, border: '1px solid #E5E5E8',
          background: '#fff', fontSize: 13, color: '#1A1A1E',
          outline: 'none',
        }}
        onFocus={e => e.target.style.borderColor = '#1B3A6B'}
        onBlur={e => e.target.style.borderColor = '#E5E5E8'}
      />
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
function statusColor(status) {
  if (status === 'former')   return { dot: 'var(--ink-faint)', label: 'bg-parchment text-ink-faint' };
  if (status === 'inactive') return { dot: 'var(--warning)',   label: 'bg-warning-bg text-warning'   };
  return                            { dot: 'var(--success)',   label: 'bg-success-bg text-success'   };
}

export default function GroupDetailPage() {
  const { id } = useParams();
  const { user, lang } = useAuth();
  const { t } = useTranslation(lang);

  const [group,      setGroup]      = useState(null);
  const [members,    setMembers]    = useState([]);
  const [allUsers,   setAllUsers]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [toast,      setToast]      = useState(null);
  const [activeTab,  setActiveTab]  = useState('members');
  const [search,     setSearch]     = useState('');

  // Member year filter
  const [memberYear,   setMemberYear]   = useState('');
  const [memberStatus, setMemberStatus] = useState('active');

  // Edit group modal
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving,   setSaving]   = useState(false);

  // Add member modal
  const [addOpen,      setAddOpen]      = useState(false);
  const [addForm,      setAddForm]      = useState({ user_id: '', year: CURRENT_YEAR, role_in_group: 'member', joined_date: '' });
  const [addingMember, setAddingMember] = useState(false);

  // Remove member confirm
  const [removeTarget, setRemoveTarget] = useState(null);

  const isManager = ['pastor', 'elder'].includes(user?.role);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchGroup = useCallback(async () => {
    try {
      setLoading(true);
      const res = await groupApi.getById(id);
      const g = res.data.data;
      setGroup(g);
      setEditForm({
        name:        g.name,
        name_sw:     g.name_sw,
        type:        g.type,
        year:        g.year        || CURRENT_YEAR,
        start_date:  g.start_date  || '',
        end_date:    g.end_date    || '',
        description: g.description || '',
      });
    } catch (_) {
      showToast(lang === 'sw' ? 'Kikundi hakipatikani' : 'Group not found', 'error');
    } finally {
      setLoading(false);
    }
  }, [id, lang]);

  const fetchMembers = useCallback(async () => {
    try {
      const params = {};
      if (memberYear)   params.year   = memberYear;
      if (memberStatus) params.status = memberStatus;
      const res = await groupApi.getMembers(id, params);
      setMembers(res.data.data || []);
    } catch (_) {}
  }, [id, memberYear, memberStatus]);

  const fetchAllUsers = useCallback(async () => {
    try {
      const res = await userApi.getAll();
      setAllUsers(res.data.data || []);
    } catch (_) {}
  }, []);

  useEffect(() => { fetchGroup(); }, [fetchGroup]);
  useEffect(() => { fetchMembers(); }, [fetchMembers]);
  useEffect(() => { if (addOpen) fetchAllUsers(); }, [addOpen, fetchAllUsers]);

  const handleEdit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await groupApi.update(id, {
        ...editForm,
        year:       editForm.year       || null,
        start_date: editForm.start_date || null,
        end_date:   editForm.end_date   || null,
      });
      showToast(lang === 'sw' ? 'Kikundi kimesasishwa' : 'Group updated');
      setEditOpen(false);
      fetchGroup();
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddMember = async () => {
    if (!addForm.user_id) return;
    try {
      setAddingMember(true);
      await groupApi.addMember(id, {
        user_id:       addForm.user_id,
        year:          addForm.year         || CURRENT_YEAR,
        role_in_group: addForm.role_in_group || 'member',
        joined_date:   addForm.joined_date  || null,
      });
      showToast(lang === 'sw' ? 'Msharika ameongezwa' : 'Member added');
      setAddOpen(false);
      setAddForm({ user_id: '', year: CURRENT_YEAR, role_in_group: 'member', joined_date: '' });
      fetchMembers();
      fetchGroup();
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!removeTarget) return;
    try {
      await groupApi.removeMember(id, removeTarget.membershipId);
      showToast(lang === 'sw' ? 'Msharika ameondolewa' : 'Member removed');
      setRemoveTarget(null);
      fetchMembers();
      fetchGroup();
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleArchive = async () => {
    try {
      await groupApi.archive(id);
      showToast(lang === 'sw' ? 'Kikundi kimehifadhiwa' : 'Group archived');
      fetchGroup();
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const setF  = (f) => (e) => setEditForm(v => ({ ...v, [f]: e.target.value }));
  const setAF = (f) => (e) => setAddForm(v => ({ ...v, [f]: e.target.value }));

  const activeMemberIds = new Set(members.filter(m => m.status === 'active').map(m => m.user_id || m.id));
  const availableUsers  = allUsers.filter(u => !activeMemberIds.has(u.id));

  // Filtered + sorted members for the active tab
  const filteredMembers = members
    .filter(m => !search || m.full_name?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const ra = ROLE_RANK[a.role_in_group] ?? 3;
      const rb = ROLE_RANK[b.role_in_group] ?? 3;
      if (ra !== rb) return ra - rb;
      return (a.full_name || '').localeCompare(b.full_name || '');
    });

  if (loading) {
    return (
      <div className="py-24 flex justify-center">
        <span className="w-5 h-5 border-2 border-border border-t-ink-muted rounded-full animate-spin" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="px-8 py-16 text-center">
        <p className="text-sm text-ink-muted mb-4">
          {lang === 'sw' ? 'Kikundi hakipatikani' : 'Group not found'}
        </p>
        <Link href="/dashboard/groups" className="btn-secondary text-sm">
          ← {lang === 'sw' ? 'Rudi' : 'Go back'}
        </Link>
      </div>
    );
  }

  const activeMemberCount = members.filter(m => m.status === 'active').length;

  return (
    <div>
      <PageHeader
        breadcrumb={
          <Link href="/dashboard/groups" className="hover:text-ink transition-colors">
            {lang === 'sw' ? 'Vikundi' : 'Groups'}
          </Link>
        }
        title={lang === 'sw' ? (group.name_sw || group.name) : group.name}
        subtitle={
          <span className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
              {GROUP_TYPE_LABELS[lang]?.[group.type] || group.type}
            </span>
            {group.year && (
              <>
                <span className="text-ink-faint">·</span>
                <span className="font-mono text-xs text-ink-faint">{group.year}</span>
              </>
            )}
            <span className="text-ink-faint">·</span>
            <span className="font-mono text-xs text-ink-faint">
              {activeMemberCount} {lang === 'sw' ? 'washarika' : 'active members'}
            </span>
            {group.is_archived && (
              <>
                <span className="text-ink-faint">·</span>
                <span className="text-2xs font-semibold uppercase tracking-wider text-ink-faint border border-hairline rounded px-1.5 py-0.5">
                  {lang === 'sw' ? 'Imehifadhiwa' : 'Archived'}
                </span>
              </>
            )}
          </span>
        }
        action={isManager && (
          <div className="flex items-center gap-2">
            {!group.is_archived && (
              <button onClick={() => setAddOpen(true)} className="btn-secondary text-sm">
                + {lang === 'sw' ? 'Ongeza Msharika' : 'Add Member'}
              </button>
            )}
            <button onClick={() => setEditOpen(true)} className="btn-primary text-sm">
              {lang === 'sw' ? 'Hariri' : 'Edit'}
            </button>
          </div>
        )}
      />

      <div className="px-8 py-6 max-w-content">

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <div className="flex gap-0 border-b border-hairline mb-6">
          {[
            { id: 'members', en: 'Members',   sw: 'Washarika' },
            { id: 'history', en: 'History',   sw: 'Historia'  },
            { id: 'info',    en: 'Info',       sw: 'Maelezo'   },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === tab.id
                  ? 'border-navy text-navy'
                  : 'border-transparent text-ink-faint hover:text-ink-muted'
              }`}
            >
              {lang === 'sw' ? tab.sw : tab.en}
              {tab.id === 'members' && (
                <span style={{
                  marginLeft: 6, fontSize: 10, fontWeight: 700,
                  background: activeTab === 'members' ? '#1B3A6B' : '#EBEBEC',
                  color: activeTab === 'members' ? '#fff' : '#8A8A8E',
                  borderRadius: 10, padding: '1px 6px',
                }}>
                  {activeMemberCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            TAB: MEMBERS
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'members' && (
          <div>
            {/* Stats bar */}
            {members.length > 0 && (
              <MembersStats members={members} lang={lang} />
            )}

            {/* Filter + search row */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <SearchBar value={search} onChange={setSearch} lang={lang} />

              <input
                type="number"
                placeholder={lang === 'sw' ? 'Mwaka' : 'Year'}
                value={memberYear}
                onChange={e => setMemberYear(e.target.value)}
                style={{
                  width: 90, height: 34, borderRadius: 7, border: '1px solid #E5E5E8',
                  background: '#fff', fontSize: 13, padding: '0 10px', outline: 'none',
                }}
                min="1900" max={CURRENT_YEAR + 5}
              />

              <select
                value={memberStatus}
                onChange={e => setMemberStatus(e.target.value)}
                style={{
                  height: 34, borderRadius: 7, border: '1px solid #E5E5E8',
                  background: '#fff', fontSize: 13, padding: '0 10px', outline: 'none',
                  color: '#1A1A1E',
                }}
              >
                <option value="active">{lang === 'sw' ? 'Wanaofanya kazi' : 'Active'}</option>
                <option value="former">{lang === 'sw' ? 'Wa zamani'       : 'Former'}</option>
                <option value="">     {lang === 'sw' ? 'Wote'             : 'All'   }</option>
              </select>
            </div>

            {/* Member list */}
            {filteredMembers.length === 0 ? (
              <div style={{
                padding: '48px 20px', textAlign: 'center',
                background: '#F7F7F9', borderRadius: 10, border: '1px solid #EBEBEC',
              }}>
                <p style={{ fontSize: 13, color: '#8A8A8E' }}>
                  {search
                    ? (lang === 'sw' ? 'Hakuna matokeo' : 'No results found')
                    : (lang === 'sw' ? 'Hakuna washarika' : 'No members found')}
                </p>
              </div>
            ) : (
              <div style={{
                borderRadius: 10, border: '1px solid #EBEBEC',
                overflow: 'hidden',
                background: '#fff',
              }}>
                {filteredMembers.map((m, i) => (
                  <div key={m.membership_id || m.id}>
                    <MemberCard
                      m={m}
                      lang={lang}
                      isManager={isManager}
                      onRemove={setRemoveTarget}
                    />
                    {i < filteredMembers.length - 1 && (
                      <div style={{ height: 1, background: '#F0F0F2', marginLeft: 90 }} />
                    )}
                  </div>
                ))}
              </div>
            )}

            {filteredMembers.length > 0 && (
              <p style={{ fontSize: 11, color: '#AEADB3', marginTop: 10, textAlign: 'right' }}>
                {filteredMembers.length} {lang === 'sw' ? 'washarika wanaonyeshwa' : 'members shown'}
              </p>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB: HISTORY
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'history' && (
          <HistoryTab id={id} lang={lang} isManager={isManager} groupApi={groupApi} />
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB: INFO
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'info' && (
          <div className="space-y-4">
            <div className="card">
              <div className="flex items-start gap-4">
                <span
                  className="w-10 h-10 rounded-lg border border-hairline flex items-center justify-center text-lg flex-shrink-0"
                  style={{ background: 'var(--navy-muted)', color: 'var(--navy)' }}
                >
                  {GROUP_TYPE_ICONS[group.type] || '◇'}
                </span>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-semibold text-ink">
                      {lang === 'sw' ? (group.name_sw || group.name) : group.name}
                    </h2>
                    <span className="badge-navy">
                      {GROUP_TYPE_LABELS[lang]?.[group.type] || group.type}
                    </span>
                    {group.is_archived && (
                      <span className="text-2xs font-semibold uppercase tracking-wider text-ink-faint border border-hairline rounded px-1.5 py-0.5">
                        {lang === 'sw' ? 'Imehifadhiwa' : 'Archived'}
                      </span>
                    )}
                  </div>
                  {group.description && (
                    <p className="text-sm text-ink-muted leading-relaxed">{group.description}</p>
                  )}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mt-3 text-xs">
                    {[
                      { label: lang === 'sw' ? 'Kiongozi'         : 'Leader',          value: group.leader_name },
                      { label: lang === 'sw' ? 'Mwaka'            : 'Year',             value: group.year },
                      { label: lang === 'sw' ? 'Tarehe ya Kuanza' : 'Start date',       value: fmt(group.start_date) },
                      { label: lang === 'sw' ? 'Tarehe ya Mwisho' : 'End date',         value: fmt(group.end_date) },
                      { label: lang === 'sw' ? 'Wanachama'        : 'Active members',   value: group.active_member_count ?? '—' },
                      { label: lang === 'sw' ? 'Jumla'            : 'Total ever',       value: group.total_member_count ?? '—' },
                    ].map(({ label, value }) => value ? (
                      <div key={label}>
                        <span className="text-ink-faint uppercase tracking-wider font-semibold">{label}</span>
                        <p className="text-ink mt-0.5 font-mono">{value}</p>
                      </div>
                    ) : null)}
                  </div>
                </div>
              </div>
            </div>
            {isManager && !group.is_archived && (
              <div className="flex justify-end">
                <button onClick={handleArchive} className="btn-ghost text-xs text-ink-faint">
                  {lang === 'sw' ? 'Hifadhi kikundi hiki' : 'Archive this group'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Edit Group Modal ──────────────────────────────────────────────── */}
      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title={lang === 'sw' ? 'Hariri Kikundi' : 'Edit Group'}>
        <form onSubmit={handleEdit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">{lang === 'sw' ? 'Jina (Kiingereza)' : 'Name (English)'}</label>
              <input value={editForm.name || ''} onChange={setF('name')} className="field-input" required />
            </div>
            <div>
              <label className="field-label">{lang === 'sw' ? 'Jina (Kiswahili)' : 'Name (Swahili)'}</label>
              <input value={editForm.name_sw || ''} onChange={setF('name_sw')} className="field-input" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">{lang === 'sw' ? 'Aina' : 'Type'}</label>
              <select value={editForm.type || 'jumuiya'} onChange={setF('type')} className="field-input">
                {GROUP_TYPES.map(type => (
                  <option key={type} value={type}>{GROUP_TYPE_ICONS[type]} {GROUP_TYPE_LABELS.en[type]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">{lang === 'sw' ? 'Mwaka' : 'Year'}</label>
              <input type="number" value={editForm.year || ''} onChange={setF('year')} min="1900" max={CURRENT_YEAR + 5} className="field-input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">{lang === 'sw' ? 'Tarehe ya Kuanza' : 'Start Date'}</label>
              <input type="date" value={editForm.start_date || ''} onChange={setF('start_date')} className="field-input" />
            </div>
            <div>
              <label className="field-label">{lang === 'sw' ? 'Tarehe ya Mwisho' : 'End Date'}</label>
              <input type="date" value={editForm.end_date || ''} onChange={setF('end_date')} className="field-input" />
            </div>
          </div>
          <div>
            <label className="field-label">{lang === 'sw' ? 'Maelezo' : 'Description'}</label>
            <textarea value={editForm.description || ''} onChange={setF('description')} rows={2} className="field-input resize-none" />
          </div>
          <div className="hairline" />
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setEditOpen(false)} className="btn-secondary">{t('cancel')}</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? t('loading') : t('save')}</button>
          </div>
        </form>
      </Modal>

      {/* ── Add Member Modal ──────────────────────────────────────────────── */}
      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title={lang === 'sw' ? 'Ongeza Msharika' : 'Add Member'}>
        <div className="space-y-4">
          <div>
            <label className="field-label">{lang === 'sw' ? 'Chagua Mtu' : 'Select Person'}</label>
            <select value={addForm.user_id} onChange={setAF('user_id')} className="field-input">
              <option value="">{lang === 'sw' ? '— Chagua —' : '— Select —'}</option>
              {availableUsers.map(u => (
                <option key={u.id} value={u.id}>{u.full_name} ({MEMBER_ROLE_LABELS.en?.[u.role] || u.role})</option>
              ))}
            </select>
            {availableUsers.length === 0 && (
              <p className="text-xs text-ink-faint mt-1.5">
                {lang === 'sw' ? 'Watu wote wako kwenye kikundi hiki' : 'All members are already in this group'}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">{lang === 'sw' ? 'Nafasi Kikundini' : 'Role in Group'}</label>
              <select value={addForm.role_in_group} onChange={setAF('role_in_group')} className="field-input">
                {ROLE_IN_GROUP_OPTIONS.map(r => (
                  <option key={r.value} value={r.value}>{lang === 'sw' ? r.sw : r.en}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">{lang === 'sw' ? 'Mwaka' : 'Year'}</label>
              <input type="number" value={addForm.year} onChange={setAF('year')} min="1900" max={CURRENT_YEAR + 5} className="field-input" />
            </div>
          </div>
          <div>
            <label className="field-label">{lang === 'sw' ? 'Tarehe ya Kujiunga' : 'Date Joined'}</label>
            <input type="date" value={addForm.joined_date} onChange={setAF('joined_date')} className="field-input" />
          </div>
          <div className="hairline" />
          <div className="flex gap-3 justify-end">
            <button onClick={() => { setAddOpen(false); setAddForm({ user_id: '', year: CURRENT_YEAR, role_in_group: 'member', joined_date: '' }); }} className="btn-secondary">{t('cancel')}</button>
            <button onClick={handleAddMember} disabled={!addForm.user_id || addingMember} className="btn-primary">
              {addingMember ? t('loading') : (lang === 'sw' ? 'Ongeza' : 'Add')}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Remove Member Confirm ─────────────────────────────────────────── */}
      <Modal isOpen={!!removeTarget} onClose={() => setRemoveTarget(null)} title={lang === 'sw' ? 'Ondoa Msharika?' : 'Remove Member?'}>
        <p className="text-sm text-ink-muted">
          {lang === 'sw'
            ? `${removeTarget?.name} ataondolewa kwenye kikundi hiki. Historia yake itabaki.`
            : `${removeTarget?.name} will be removed from this group. Their history will be preserved.`}
        </p>
        <div className="hairline mt-5 mb-4" />
        <div className="flex gap-3 justify-end">
          <button onClick={() => setRemoveTarget(null)} className="btn-secondary">{t('cancel')}</button>
          <button onClick={handleRemoveMember} className="btn-danger">{lang === 'sw' ? 'Ondoa' : 'Remove'}</button>
        </div>
      </Modal>

      <Toast toast={toast} />
    </div>
  );
}

// ─── History tab ──────────────────────────────────────────────────────────────
function HistoryTab({ id, lang, isManager, groupApi }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    groupApi.getMembers(id, { status: '' })
      .then(res => setHistory(res.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, groupApi]);

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <span className="w-5 h-5 border-2 border-border border-t-ink-muted rounded-full animate-spin" />
      </div>
    );
  }

  if (!history.length) {
    return (
      <div className="py-12 text-center text-sm text-ink-muted">
        {lang === 'sw' ? 'Hakuna historia' : 'No history yet'}
      </div>
    );
  }

  const byYear = {};
  history.forEach(m => {
    const y = m.year || '—';
    if (!byYear[y]) byYear[y] = [];
    byYear[y].push(m);
  });
  const years = Object.keys(byYear).sort((a, b) => (b === '—' ? -1 : Number(b) - Number(a)));

  const sc = (status) => statusColor(status);

  return (
    <div className="space-y-6">
      {years.map(year => (
        <div key={year}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#5A5A60', letterSpacing: '0.04em' }}>{year}</span>
            <div style={{ flex: 1, height: 1, background: '#EBEBEC' }} />
            <span style={{ fontSize: 10, color: '#AEADB3' }}>{byYear[year].length} {lang === 'sw' ? 'rekodi' : 'records'}</span>
          </div>
          <div style={{ borderRadius: 10, border: '1px solid #EBEBEC', overflow: 'hidden', background: '#fff' }}>
            {byYear[year].map((m, i) => {
              const s = sc(m.status);
              return (
                <div key={m.membership_id || m.id}>
                  <div style={{
                    display: 'grid', gridTemplateColumns: '44px 1fr auto',
                    gap: '0 12px', alignItems: 'center', padding: '12px 16px',
                  }}>
                    <MemberAvatar member={m} size={36} />
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1E', marginBottom: 2 }}>{m.full_name}</p>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        {m.joined_date && (
                          <span style={{ fontSize: 10, color: '#8A8A8E' }}>
                            {lang === 'sw' ? 'Alijiunga' : 'Joined'} {fmtShort(m.joined_date)}
                          </span>
                        )}
                        {m.left_date && (
                          <>
                            <span style={{ color: '#D5D5D8', fontSize: 10 }}>·</span>
                            <span style={{ fontSize: 10, color: '#8A8A8E' }}>
                              {lang === 'sw' ? 'Aliondoka' : 'Left'} {fmtShort(m.left_date)}
                            </span>
                          </>
                        )}
                        {m.role_in_group && m.role_in_group !== 'member' && (
                          <RolePill role={m.role_in_group} lang={lang} />
                        )}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 600,
                      color: m.status === 'active' ? '#16A34A' : '#94A3B8',
                      background: m.status === 'active' ? '#F0FDF4' : '#F8FAFC',
                      border: `1px solid ${m.status === 'active' ? '#BBF7D0' : '#E2E8F0'}`,
                      borderRadius: 4, padding: '2px 7px',
                      textTransform: 'capitalize',
                    }}>
                      {m.status}
                    </span>
                  </div>
                  {i < byYear[year].length - 1 && (
                    <div style={{ height: 1, background: '#F0F0F2', marginLeft: 72 }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}