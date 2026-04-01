'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../../hooks/useAuth';
import { useTranslation } from '../../../../lib/i18n';
import { groupApi, userApi } from '../../../../lib/api';
import PageHeader from '../../../../components/ui/PageHeader';
import Modal from '../../../../components/ui/Modal';
import Toast from '../../../../components/ui/Toast';

const GROUP_TYPE_LABELS = {
  en: { choir:'Choir', youth:'Youth', elders:'Elders', women:'Women', men:'Men', children:'Children', other:'Other' },
  sw: { choir:'Kwaya', youth:'Vijana', elders:'Wazee', women:'Wanawake', men:'Wanaume', children:'Watoto', other:'Nyingine' },
};

const GROUP_ICONS = {
  choir:'♫', youth:'◎', elders:'◈', women:'♀', men:'♂', children:'◉', other:'◇',
};

const ROLE_LABELS = {
  en: { pastor:'Pastor', elder:'Elder', group_leader:'Leader', member:'Member' },
  sw: { pastor:'Mchungaji', elder:'Mzee', group_leader:'Kiongozi', member:'Mwanachama' },
};

export default function GroupDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user, lang } = useAuth();
  const { t } = useTranslation(lang);

  const [group, setGroup]           = useState(null);
  const [members, setMembers]       = useState([]);
  const [allUsers, setAllUsers]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [toast, setToast]           = useState(null);

  // Edit group modal
  const [editOpen, setEditOpen]     = useState(false);
  const [editForm, setEditForm]     = useState({});
  const [saving, setSaving]         = useState(false);

  // Add member modal
  const [addOpen, setAddOpen]       = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [addingMember, setAddingMember] = useState(false);

  // Remove member confirm
  const [removeId, setRemoveId]     = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchGroup = useCallback(async () => {
    try {
      setLoading(true);
      const res = await groupApi.getById(id);
      setGroup(res.data.data);
      setEditForm({
        name: res.data.data.name,
        name_sw: res.data.data.name_sw,
        type: res.data.data.type,
        description: res.data.data.description || '',
      });
    } catch (_) {
      showToast(lang === 'sw' ? 'Kikundi hakipatikani' : 'Group not found', 'error');
    } finally {
      setLoading(false);
    }
  }, [id, lang]);

  const fetchMembers = useCallback(async () => {
    try {
      const res = await groupApi.getMembers(id);
      setMembers(res.data.data || []);
    } catch (_) {}
  }, [id]);

  const fetchAllUsers = useCallback(async () => {
    try {
      const res = await userApi.getAll();
      setAllUsers(res.data.data || []);
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchGroup();
    fetchMembers();
  }, [fetchGroup, fetchMembers]);

  useEffect(() => {
    if (addOpen) fetchAllUsers();
  }, [addOpen, fetchAllUsers]);

  const handleEdit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await groupApi.update(id, editForm);
      showToast(lang === 'sw' ? 'Kikundi kimesasishwa' : 'Group updated');
      setEditOpen(false);
      fetchGroup();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddMember = async () => {
    if (!selectedUserId) return;
    try {
      setAddingMember(true);
      await groupApi.addMember(id, selectedUserId);
      showToast(lang === 'sw' ? 'Mwanachama ameongezwa' : 'Member added');
      setAddOpen(false);
      setSelectedUserId('');
      fetchMembers();
      fetchGroup();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    try {
      await groupApi.removeMember(id, userId);
      showToast(lang === 'sw' ? 'Mwanachama ameondolewa' : 'Member removed');
      setRemoveId(null);
      fetchMembers();
      fetchGroup();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const setF = (f) => (e) => setEditForm(v => ({ ...v, [f]: e.target.value }));

  // Users not already in this group
  const availableUsers = allUsers.filter(u => !members.find(m => m.id === u.id));

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

  const isPastor = user?.role === 'pastor';

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
          <span className="flex items-center gap-2">
            <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
              {GROUP_TYPE_LABELS[lang]?.[group.type] || group.type}
            </span>
            <span className="text-ink-faint">·</span>
            <span className="font-mono text-xs text-ink-faint">
              {members.length} {lang === 'sw' ? 'wanachama' : 'members'}
            </span>
          </span>
        }
        action={isPastor && (
          <div className="flex items-center gap-2">
            <button onClick={() => setAddOpen(true)} className="btn-secondary text-sm">
              + {lang === 'sw' ? 'Ongeza Mwanachama' : 'Add Member'}
            </button>
            <button onClick={() => setEditOpen(true)} className="btn-primary text-sm">
              {lang === 'sw' ? 'Hariri' : 'Edit Group'}
            </button>
          </div>
        )}
      />

      <div className="px-8 py-8 max-w-content space-y-8">

        {/* Group Info Card */}
        <div className="card">
          <div className="flex items-start gap-4">
            <span className="w-10 h-10 rounded-lg bg-navy-muted border border-hairline flex items-center justify-center text-lg text-navy flex-shrink-0">
              {GROUP_ICONS[group.type] || '◇'}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold text-ink">
                  {lang === 'sw' ? (group.name_sw || group.name) : group.name}
                </h2>
                <span className="badge-navy">{GROUP_TYPE_LABELS[lang]?.[group.type] || group.type}</span>
              </div>
              {group.description && (
                <p className="text-sm text-ink-muted mt-1 leading-relaxed">{group.description}</p>
              )}
              {group.leader_name && (
                <p className="text-xs text-ink-faint mt-2 font-mono">
                  {lang === 'sw' ? 'Kiongozi:' : 'Leader:'} {group.leader_name}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Members List */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="section-label">
              {lang === 'sw' ? 'Wanachama' : 'Members'}
              <span className="ml-2 badge-navy normal-case tracking-normal font-mono">{members.length}</span>
            </p>
          </div>

          <div className="hairline mb-0" />

          {members.length === 0 ? (
            <div className="py-12 text-center text-sm text-ink-muted">
              {lang === 'sw' ? 'Hakuna wanachama bado' : 'No members yet'}
            </div>
          ) : (
            members.map((m, i) => (
              <div key={m.id} className={`animate-slide-up stagger-${Math.min(i + 1, 6)}`}>
                <div className="flex items-center justify-between gap-4 py-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Avatar */}
                    <span className="w-8 h-8 rounded-full bg-parchment border border-hairline flex items-center justify-center text-xs font-semibold text-ink-muted flex-shrink-0 uppercase">
                      {(m.full_name || '?').charAt(0)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{m.full_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {m.role && (
                          <span className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">
                            {ROLE_LABELS[lang]?.[m.role] || m.role}
                          </span>
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
                  {isPastor && (
                    <button
                      onClick={() => setRemoveId(m.id)}
                      className="btn-ghost text-xs text-danger flex-shrink-0"
                    >
                      {lang === 'sw' ? 'Ondoa' : 'Remove'}
                    </button>
                  )}
                </div>
                <div className="hairline" />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Edit Group Modal */}
      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title={lang === 'sw' ? 'Hariri Kikundi' : 'Edit Group'}>
        <form onSubmit={handleEdit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">{t('group_name_en')}</label>
              <input value={editForm.name || ''} onChange={setF('name')} className="field-input" required />
            </div>
            <div>
              <label className="field-label">{t('group_name_sw')}</label>
              <input value={editForm.name_sw || ''} onChange={setF('name_sw')} className="field-input" required />
            </div>
          </div>
          <div>
            <label className="field-label">{t('group_type')}</label>
            <select value={editForm.type || 'choir'} onChange={setF('type')} className="field-input">
              {['choir','youth','elders','women','men','children','other'].map(type => (
                <option key={type} value={type}>{GROUP_TYPE_LABELS.en[type]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Description</label>
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

      {/* Add Member Modal */}
      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title={lang === 'sw' ? 'Ongeza Mwanachama' : 'Add Member'}>
        <div className="space-y-4">
          <div>
            <label className="field-label">{lang === 'sw' ? 'Chagua Mtu' : 'Select Person'}</label>
            <select
              value={selectedUserId}
              onChange={e => setSelectedUserId(e.target.value)}
              className="field-input"
            >
              <option value="">{lang === 'sw' ? '— Chagua —' : '— Select —'}</option>
              {availableUsers.map(u => (
                <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
              ))}
            </select>
            {availableUsers.length === 0 && (
              <p className="text-xs text-ink-faint mt-1.5">
                {lang === 'sw' ? 'Watu wote wako kwenye kikundi hiki' : 'All users are already in this group'}
              </p>
            )}
          </div>
          <div className="hairline" />
          <div className="flex gap-3 justify-end">
            <button onClick={() => { setAddOpen(false); setSelectedUserId(''); }} className="btn-secondary">{t('cancel')}</button>
            <button onClick={handleAddMember} disabled={!selectedUserId || addingMember} className="btn-primary">
              {addingMember ? t('loading') : (lang === 'sw' ? 'Ongeza' : 'Add')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Remove Member Confirm */}
      <Modal isOpen={!!removeId} onClose={() => setRemoveId(null)} title={lang === 'sw' ? 'Ondoa Mwanachama?' : 'Remove Member?'}>
        <p className="text-sm text-ink-muted">{t('confirm_delete')}</p>
        <div className="hairline mt-5 mb-4" />
        <div className="flex gap-3 justify-end">
          <button onClick={() => setRemoveId(null)} className="btn-secondary">{t('cancel')}</button>
          <button onClick={() => handleRemoveMember(removeId)} className="btn-danger">
            {lang === 'sw' ? 'Ondoa' : 'Remove'}
          </button>
        </div>
      </Modal>

      <Toast toast={toast} />
    </div>
  );
}