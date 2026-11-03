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
  { value: 'member',    en: 'Member',    sw: 'Mwanachama' },
  { value: 'leader',    en: 'Leader',    sw: 'Kiongozi'   },
  { value: 'secretary', en: 'Secretary', sw: 'Katibu'     },
  { value: 'treasurer', en: 'Treasurer', sw: 'Mweka Hazina' },
  { value: 'other',     en: 'Other',     sw: 'Nyingine'   },
];

const CURRENT_YEAR = new Date().getFullYear();

// ─── Small helpers ────────────────────────────────────────────────────────────
function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

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
  const [activeTab,  setActiveTab]  = useState('members'); // 'members' | 'history' | 'info'

  // Member year filter
  const [memberYear,   setMemberYear]   = useState('');
  const [memberStatus, setMemberStatus] = useState('active');

  // Edit group modal
  const [editOpen,  setEditOpen]  = useState(false);
  const [editForm,  setEditForm]  = useState({});
  const [saving,    setSaving]    = useState(false);

  // Add member modal
  const [addOpen,        setAddOpen]        = useState(false);
  const [addForm,        setAddForm]        = useState({ user_id: '', year: CURRENT_YEAR, role_in_group: 'member', joined_date: '' });
  const [addingMember,   setAddingMember]   = useState(false);

  // Remove member confirm
  const [removeTarget, setRemoveTarget] = useState(null); // { membershipId, name }

  const isManager = ['pastor', 'elder'].includes(user?.role);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Fetch group ────────────────────────────────────────────────────────────
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

  // ── Fetch members (with optional year + status filters) ───────────────────
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

  // ── Edit group ─────────────────────────────────────────────────────────────
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

  // ── Add member ─────────────────────────────────────────────────────────────
  const handleAddMember = async () => {
    if (!addForm.user_id) return;
    try {
      setAddingMember(true);
      await groupApi.addMember(id, {
        user_id:      addForm.user_id,
        year:         addForm.year         || CURRENT_YEAR,
        role_in_group: addForm.role_in_group || 'member',
        joined_date:  addForm.joined_date  || null,
      });
      showToast(lang === 'sw' ? 'Mwanachama ameongezwa' : 'Member added');
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

  // ── Remove member (soft — sets left_date + status=former) ─────────────────
  const handleRemoveMember = async () => {
    if (!removeTarget) return;
    try {
      await groupApi.removeMember(id, removeTarget.membershipId);
      showToast(lang === 'sw' ? 'Mwanachama ameondolewa' : 'Member removed');
      setRemoveTarget(null);
      fetchMembers();
      fetchGroup();
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  // ── Archive group ──────────────────────────────────────────────────────────
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

  // Members not already active in this group (for the add dropdown)
  const activeMemberIds = new Set(members.filter(m => m.status === 'active').map(m => m.user_id || m.id));
  const availableUsers  = allUsers.filter(u => !activeMemberIds.has(u.id));

  // ── Loading / not found ────────────────────────────────────────────────────
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
              {activeMemberCount} {lang === 'sw' ? 'wanachama' : 'active members'}
            </span>
            {group.is_archived ? (
              <>
                <span className="text-ink-faint">·</span>
                <span className="text-2xs font-semibold uppercase tracking-wider text-ink-faint border border-hairline rounded px-1.5 py-0.5">
                  {lang === 'sw' ? 'Imehifadhiwa' : 'Archived'}
                </span>
              </>
            ) : null}
          </span>
        }
        action={isManager && (
          <div className="flex items-center gap-2">
            {!group.is_archived && (
              <button onClick={() => setAddOpen(true)} className="btn-secondary text-sm">
                + {lang === 'sw' ? 'Ongeza Mwanachama' : 'Add Member'}
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
            { id: 'members', en: 'Members',   sw: 'Wanachama' },
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
            </button>
          ))}
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            TAB: MEMBERS (active)
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'members' && (
          <div>
            {/* Filter bar */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <div>
                <label className="field-label sr-only">{lang === 'sw' ? 'Mwaka' : 'Year'}</label>
                <input
                  type="number"
                  placeholder={lang === 'sw' ? 'Mwaka (yote)' : 'Year (all)'}
                  value={memberYear}
                  onChange={e => setMemberYear(e.target.value)}
                  className="field-input w-32 text-xs py-1.5"
                  min="1900"
                  max={CURRENT_YEAR + 5}
                />
              </div>
              <div>
                <select
                  value={memberStatus}
                  onChange={e => setMemberStatus(e.target.value)}
                  className="field-input text-xs py-1.5"
                >
                  <option value="active">{lang === 'sw' ? 'Wanaofanya kazi' : 'Active'}</option>
                  <option value="former">{lang === 'sw' ? 'Wa zamani'       : 'Former'}</option>
                  <option value="">     {lang === 'sw' ? 'Wote'             : 'All'   }</option>
                </select>
              </div>
            </div>

            <div className="hairline mb-0" />

            {members.length === 0 ? (
              <div className="py-12 text-center text-sm text-ink-muted">
                {lang === 'sw' ? 'Hakuna wanachama' : 'No members found'}
              </div>
            ) : (
              members.map((m, i) => {
                const sc = statusColor(m.status);
                const roleLabel = MEMBER_ROLE_LABELS[lang]?.[m.role] || m.role;
                const roleInGroup = ROLE_IN_GROUP_OPTIONS.find(r => r.value === m.role_in_group);
                return (
                  <div key={m.membership_id || m.id} className={`animate-slide-up stagger-${Math.min(i + 1, 6)}`}>
                    <div className="flex items-center justify-between gap-4 py-3.5">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Avatar */}
                        <span
                          className="w-8 h-8 rounded-full border border-hairline flex items-center justify-center text-xs font-bold text-ink-muted flex-shrink-0 uppercase"
                          style={{ background: 'var(--parchment)' }}
                        >
                          {(m.full_name || '?').charAt(0)}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-ink">{m.full_name}</p>
                            {roleInGroup && (
                              <span className="text-2xs font-semibold uppercase tracking-wider text-ink-faint border border-hairline rounded px-1.5 py-0.5">
                                {lang === 'sw' ? roleInGroup.sw : roleInGroup.en}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-2xs text-ink-faint uppercase tracking-wider font-semibold">
                              {roleLabel}
                            </span>
                            {m.year && (
                              <>
                                <span className="text-ink-faint text-2xs">·</span>
                                <span className="text-2xs text-ink-faint font-mono">{m.year}</span>
                              </>
                            )}
                            {m.joined_date && (
                              <>
                                <span className="text-ink-faint text-2xs">·</span>
                                <span className="text-2xs text-ink-faint font-mono">
                                  {lang === 'sw' ? 'Alijiunga' : 'Joined'} {fmt(m.joined_date)}
                                </span>
                              </>
                            )}
                            {m.phone && (
                              <>
                                <span className="text-ink-faint text-2xs">·</span>
                                <span className="text-2xs text-ink-faint font-mono">{m.phone}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Status dot */}
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: sc.dot }}
                          title={m.status}
                        />
                        {isManager && m.status === 'active' && (
                          <button
                            onClick={() => setRemoveTarget({ membershipId: m.membership_id || m.id, name: m.full_name })}
                            className="btn-ghost text-xs text-danger px-2"
                          >
                            {lang === 'sw' ? 'Ondoa' : 'Remove'}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="hairline" />
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB: HISTORY (all statuses, all years)
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

                  {/* Meta grid */}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mt-3 text-xs">
                    {[
                      { label: lang === 'sw' ? 'Kiongozi'         : 'Leader',     value: group.leader_name },
                      { label: lang === 'sw' ? 'Mwaka'            : 'Year',       value: group.year },
                      { label: lang === 'sw' ? 'Tarehe ya Kuanza' : 'Start date', value: fmt(group.start_date) },
                      { label: lang === 'sw' ? 'Tarehe ya Mwisho' : 'End date',   value: fmt(group.end_date) },
                      { label: lang === 'sw' ? 'Wanachama'        : 'Active members', value: group.active_member_count ?? '—' },
                      { label: lang === 'sw' ? 'Jumla'            : 'Total ever',     value: group.total_member_count ?? '—' },
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

            {/* Archive action (info tab) */}
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
      <Modal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title={lang === 'sw' ? 'Hariri Kikundi' : 'Edit Group'}
      >
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
                  <option key={type} value={type}>
                    {GROUP_TYPE_ICONS[type]} {GROUP_TYPE_LABELS.en[type]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">{lang === 'sw' ? 'Mwaka' : 'Year'}</label>
              <input
                type="number"
                value={editForm.year || ''}
                onChange={setF('year')}
                min="1900"
                max={CURRENT_YEAR + 5}
                className="field-input"
              />
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
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? t('loading') : t('save')}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Add Member Modal ──────────────────────────────────────────────── */}
      <Modal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        title={lang === 'sw' ? 'Ongeza Mwanachama' : 'Add Member'}
      >
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
            {/* Role in group */}
            <div>
              <label className="field-label">{lang === 'sw' ? 'Nafasi Kikundini' : 'Role in Group'}</label>
              <select value={addForm.role_in_group} onChange={setAF('role_in_group')} className="field-input">
                {ROLE_IN_GROUP_OPTIONS.map(r => (
                  <option key={r.value} value={r.value}>{lang === 'sw' ? r.sw : r.en}</option>
                ))}
              </select>
            </div>
            {/* Year */}
            <div>
              <label className="field-label">{lang === 'sw' ? 'Mwaka' : 'Year'}</label>
              <input
                type="number"
                value={addForm.year}
                onChange={setAF('year')}
                min="1900"
                max={CURRENT_YEAR + 5}
                className="field-input"
              />
            </div>
          </div>

          {/* Joined date */}
          <div>
            <label className="field-label">{lang === 'sw' ? 'Tarehe ya Kujiunga' : 'Date Joined'}</label>
            <input type="date" value={addForm.joined_date} onChange={setAF('joined_date')} className="field-input" />
          </div>

          <div className="hairline" />
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => { setAddOpen(false); setAddForm({ user_id: '', year: CURRENT_YEAR, role_in_group: 'member', joined_date: '' }); }}
              className="btn-secondary"
            >
              {t('cancel')}
            </button>
            <button onClick={handleAddMember} disabled={!addForm.user_id || addingMember} className="btn-primary">
              {addingMember ? t('loading') : (lang === 'sw' ? 'Ongeza' : 'Add')}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Remove Member Confirm ─────────────────────────────────────────── */}
      <Modal
        isOpen={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title={lang === 'sw' ? 'Ondoa Mwanachama?' : 'Remove Member?'}
      >
        <p className="text-sm text-ink-muted">
          {lang === 'sw'
            ? `${removeTarget?.name} ataondolewa kwenye kikundi hiki. Historia yake itabaki.`
            : `${removeTarget?.name} will be removed from this group. Their history will be preserved.`}
        </p>
        <div className="hairline mt-5 mb-4" />
        <div className="flex gap-3 justify-end">
          <button onClick={() => setRemoveTarget(null)} className="btn-secondary">{t('cancel')}</button>
          <button onClick={handleRemoveMember} className="btn-danger">
            {lang === 'sw' ? 'Ondoa' : 'Remove'}
          </button>
        </div>
      </Modal>

      <Toast toast={toast} />
    </div>
  );
}

// ─── History tab (all-time membership log) ────────────────────────────────────
function HistoryTab({ id, lang, isManager, groupApi }) {
  const [history, setHistory]   = useState([]);
  const [loading, setLoading]   = useState(true);

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

  // Group by year descending
  const byYear = {};
  history.forEach(m => {
    const y = m.year || '—';
    if (!byYear[y]) byYear[y] = [];
    byYear[y].push(m);
  });
  const years = Object.keys(byYear).sort((a, b) => (b === '—' ? -1 : Number(b) - Number(a)));

  return (
    <div className="space-y-6">
      {years.map(year => (
        <div key={year}>
          <p className="section-label mb-3">{year}</p>
          <div className="hairline mb-0" />
          {byYear[year].map((m, i) => {
            const sc = statusColor(m.status);
            return (
              <div key={m.membership_id || m.id}>
                <div className="flex items-center justify-between gap-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: sc.dot }}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">{m.full_name}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-2xs text-ink-faint flex-wrap font-mono">
                        {m.joined_date && <span>{lang === 'sw' ? 'Alijiunga' : 'Joined'} {fmt(m.joined_date)}</span>}
                        {m.left_date   && <><span>·</span><span>{lang === 'sw' ? 'Aliondoka' : 'Left'} {fmt(m.left_date)}</span></>}
                        {m.role_in_group && m.role_in_group !== 'member' && (
                          <><span>·</span><span className="uppercase tracking-wider">{m.role_in_group}</span></>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className={`text-2xs font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${sc.label}`}>
                    {m.status}
                  </span>
                </div>
                <div className="hairline" />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}