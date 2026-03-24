'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useTranslation } from '../../../lib/i18n';
import { groupApi } from '../../../lib/api';
import PageHeader from '../../../components/ui/PageHeader';
import Modal from '../../../components/ui/Modal';
import Toast from '../../../components/ui/Toast';

const GROUP_TYPES = ['choir','youth','elders','women','men','children','other'];
const GROUP_TYPE_LABELS = { en: { choir:'Choir', youth:'Youth', elders:'Elders', women:'Women', men:'Men', children:'Children', other:'Other' }, sw: { choir:'Kwaya', youth:'Vijana', elders:'Wazee', women:'Wanawake', men:'Wanaume', children:'Watoto', other:'Nyingine' } };

export default function GroupsPage() {
  const { user, lang } = useAuth();
  const { t } = useTranslation(lang);
  const [groups, setGroups]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm]         = useState({ name:'', name_sw:'', type:'choir', description:'' });

  const showToast = (msg, type='success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const fetchGroups = useCallback(async () => {
    try { setLoading(true); const res = await groupApi.getAll(); setGroups(res.data.data); }
    catch (_) {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await groupApi.create(form);
      showToast(lang === 'sw' ? 'Kikundi kimeundwa' : 'Group created');
      setModalOpen(false);
      setForm({ name:'', name_sw:'', type:'choir', description:'' });
      fetchGroups();
    } catch (err) { showToast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try {
      await groupApi.delete(id);
      showToast(lang === 'sw' ? 'Kikundi kimefutwa' : 'Group deleted');
      setDeleteId(null);
      fetchGroups();
    } catch (err) { showToast(err.message, 'error'); }
  };

  const set = (f) => (e) => setForm(v => ({ ...v, [f]: e.target.value }));

  return (
    <div>
      <PageHeader
        breadcrumb={lang === 'sw' ? 'Watu' : 'People'}
        title={t('groups')}
        subtitle={`${groups.length} ${lang === 'sw' ? 'vikundi' : 'groups'}`}
        action={user?.role === 'pastor' && (
          <button onClick={() => setModalOpen(true)} className="btn-primary">+ {t('new_group')}</button>
        )}
      />

      <div className="px-8 py-8 max-w-content">
        <div className="hairline mb-0" />

        {loading ? (
          <div className="py-16 flex justify-center">
            <span className="w-5 h-5 border-2 border-border border-t-ink-muted rounded-full animate-spin" />
          </div>
        ) : groups.length === 0 ? (
          <div className="py-16 text-center text-ink-muted text-sm">{t('no_data')}</div>
        ) : (
          groups.map((g, i) => (
            <div key={g.id} className={`animate-slide-up stagger-${Math.min(i+1,6)}`}>
              <div className="flex items-center justify-between gap-4 py-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="status-dot bg-ink-muted flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">
                      {lang === 'sw' ? g.name_sw : g.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-ink-faint uppercase tracking-wider font-semibold">
                        {GROUP_TYPE_LABELS[lang]?.[g.type] || g.type}
                      </span>
                      <span className="text-ink-faint text-xs">·</span>
                      <span className="text-xs text-ink-faint font-mono">{g.member_count} {t('members_count')}</span>
                      {g.leader_name && (
                        <>
                          <span className="text-ink-faint text-xs">·</span>
                          <span className="text-xs text-ink-faint">{g.leader_name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                {user?.role === 'pastor' && (
                  <button onClick={() => setDeleteId(g.id)} className="btn-ghost text-xs text-danger flex-shrink-0">{t('delete')}</button>
                )}
              </div>
              <div className="hairline" />
            </div>
          ))
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={t('new_group')}>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">{t('group_name_en')}</label>
              <input value={form.name} onChange={set('name')} className="field-input" required />
            </div>
            <div>
              <label className="field-label">{t('group_name_sw')}</label>
              <input value={form.name_sw} onChange={set('name_sw')} className="field-input" required />
            </div>
          </div>
          <div>
            <label className="field-label">{t('group_type')}</label>
            <select value={form.type} onChange={set('type')} className="field-input">
              {GROUP_TYPES.map(type => (
                <option key={type} value={type}>{GROUP_TYPE_LABELS.en[type]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Description</label>
            <textarea value={form.description} onChange={set('description')} rows={2} className="field-input resize-none" />
          </div>
          <div className="hairline" />
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">{t('cancel')}</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? t('loading') : t('save')}
            </button>
          </div>
        </form>
      </Modal>

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
