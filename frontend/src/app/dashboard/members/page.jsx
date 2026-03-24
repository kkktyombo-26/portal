'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useTranslation } from '../../../lib/i18n';
import { userApi } from '../../../lib/api';
import PageHeader from '../../../components/ui/PageHeader';
import Modal from '../../../components/ui/Modal';
import Toast from '../../../components/ui/Toast';
import RoleBadge from '../../../components/ui/RoleBadge';

export default function MembersPage() {
  const { user, lang } = useAuth();
  const { t } = useTranslation(lang);
  const [members, setMembers]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [toast, setToast]       = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [saving, setSaving]     = useState(false);

  const showToast = (msg, type='success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const fetchMembers = useCallback(async () => {
    try { setLoading(true); const res = await userApi.getAll(); setMembers(res.data.data); }
    catch (_) {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const handleToggleActive = async (m) => {
    try {
      await userApi.update(m.id, { is_active: m.is_active ? 0 : 1 });
      showToast(lang === 'sw' ? 'Hali imesasishwa' : 'Status updated');
      fetchMembers();
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleDelete = async (id) => {
    try {
      await userApi.delete(id);
      showToast(lang === 'sw' ? 'Mwanachama ameondolewa' : 'Member removed');
      setDeleteId(null);
      fetchMembers();
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await userApi.update(editUser.id, { full_name: editUser.full_name, phone: editUser.phone, role: editUser.role });
      showToast(lang === 'sw' ? 'Mwanachama amesasishwa' : 'Member updated');
      setEditUser(null);
      fetchMembers();
    } catch (err) { showToast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  const displayed = members.filter(m =>
    m.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    m.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader
        breadcrumb={lang === 'sw' ? 'Watu' : 'People'}
        title={t('members')}
        subtitle={`${members.length} ${lang === 'sw' ? 'wanachama wote' : 'total members'}`}
      />

      <div className="px-8 py-8 max-w-content">
        {/* Search */}
        <div className="relative mb-6">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint text-xs pointer-events-none">⊙</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('search')} className="field-input pl-8 max-w-form" />
        </div>

        <div className="hairline mb-0" />

        {loading ? (
          <div className="py-16 flex justify-center">
            <span className="w-5 h-5 border-2 border-border border-t-ink-muted rounded-full animate-spin" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="py-16 text-center text-ink-muted text-sm">{t('no_data')}</div>
        ) : (
          displayed.map((m, i) => (
            <div key={m.id} className={`animate-slide-up stagger-${Math.min(i+1,6)}`}>
              <div className="flat-row justify-between gap-4 py-4 px-0">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Avatar initial */}
                  <div className="w-8 h-8 rounded-full bg-parchment border border-hairline flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-ink-muted">{m.full_name?.[0]?.toUpperCase()}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">{m.full_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <RoleBadge role={m.role} lang={lang} />
                      {m.group_name && (
                        <>
                          <span className="text-ink-faint text-xs">·</span>
                          <span className="text-xs text-ink-faint">{m.group_name}</span>
                        </>
                      )}
                      {!m.is_active && (
                        <span className="text-xs text-danger font-semibold uppercase tracking-wider">
                          {t('inactive')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {/* Actions — pastor only */}
                {user?.role === 'pastor' && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => setEditUser({ ...m })} className="btn-ghost text-xs">{t('edit')}</button>
                    <button onClick={() => handleToggleActive(m)} className="btn-ghost text-xs">
                      {m.is_active ? t('deactivate') : t('activate')}
                    </button>
                    <button onClick={() => setDeleteId(m.id)} className="btn-ghost text-xs text-danger">
                      {t('delete')}
                    </button>
                  </div>
                )}
              </div>
              <div className="hairline" />
            </div>
          ))
        )}
      </div>

      {/* Edit modal */}
      {editUser && (
        <Modal isOpen={!!editUser} onClose={() => setEditUser(null)} title={t('edit')}>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <label className="field-label">{t('full_name')}</label>
              <input value={editUser.full_name} onChange={e => setEditUser(u => ({ ...u, full_name: e.target.value }))} className="field-input" required />
            </div>
            <div>
              <label className="field-label">{t('phone')}</label>
              <input value={editUser.phone || ''} onChange={e => setEditUser(u => ({ ...u, phone: e.target.value }))} className="field-input" />
            </div>
            {user?.role === 'pastor' && (
              <div>
                <label className="field-label">Role</label>
                <select value={editUser.role} onChange={e => setEditUser(u => ({ ...u, role: e.target.value }))} className="field-input">
                  <option value="member">{t('member')}</option>
                  <option value="group_leader">{t('group_leader')}</option>
                  <option value="elder">{t('elder')}</option>
                  <option value="pastor">{t('pastor')}</option>
                </select>
              </div>
            )}
            <div className="hairline" />
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setEditUser(null)} className="btn-secondary">{t('cancel')}</button>
              <button type="submit" disabled={saving} className="btn-primary">{saving ? t('loading') : t('save')}</button>
            </div>
          </form>
        </Modal>
      )}

      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title={t('delete_member')}>
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
