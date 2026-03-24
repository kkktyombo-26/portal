'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useTranslation } from '../../../lib/i18n';
import { announcementApi } from '../../../lib/api';
import { canBroadcast } from '../../../lib/auth';
import PageHeader from '../../../components/ui/PageHeader';
import Modal from '../../../components/ui/Modal';
import Toast from '../../../components/ui/Toast';

export default function AnnouncementsPage() {
  const { user, lang } = useAuth();
  const { t } = useTranslation(lang);
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm]         = useState({ title_en:'', title_sw:'', body_en:'', body_sw:'', scope:'church' });

  const showToast = (msg, type='success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const fetchItems = useCallback(async () => {
    try { setLoading(true); const res = await announcementApi.getAll(); setItems(res.data.data); }
    catch (_) {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await announcementApi.create(form);
      showToast(lang === 'sw' ? 'Tangazo limechapishwa' : 'Announcement published');
      setModalOpen(false);
      setForm({ title_en:'', title_sw:'', body_en:'', body_sw:'', scope:'church' });
      fetchItems();
    } catch (err) { showToast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try {
      await announcementApi.delete(id);
      showToast(lang === 'sw' ? 'Tangazo limefutwa' : 'Announcement deleted');
      setDeleteId(null);
      fetchItems();
    } catch (err) { showToast(err.message, 'error'); }
  };

  const set = (f) => (e) => setForm(v => ({ ...v, [f]: e.target.value }));
  const canPost = canBroadcast(user?.role);

  return (
    <div>
      <PageHeader
        breadcrumb={lang === 'sw' ? 'Mawasiliano' : 'Communication'}
        title={t('announcements')}
        subtitle={lang === 'sw' ? 'Matangazo yanayokuhusu' : 'Announcements relevant to you'}
        action={canPost && (
          <button onClick={() => setModalOpen(true)} className="btn-primary">
            + {t('new_announcement')}
          </button>
        )}
      />

      <div className="px-8 py-8 max-w-content">
        {loading ? (
          <div className="py-16 flex justify-center">
            <span className="w-5 h-5 border-2 border-border border-t-ink-muted rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-ink-muted text-sm">{t('no_data')}</div>
        ) : (
          <div>
            {items.map((a, i) => (
              <div key={a.id} className={`animate-slide-up stagger-${Math.min(i+1,6)}`}>
                <div className="py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Scope dot */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`status-dot ${a.scope === 'church' ? 'bg-ink-muted' : 'bg-ink-faint'}`} />
                        <span className="text-xs text-ink-faint uppercase tracking-wider font-semibold">
                          {a.scope === 'church' ? (lang === 'sw' ? 'Kanisa Lote' : 'Church Wide') : (a.group_name || t('my_group'))}
                        </span>
                      </div>
                      <p className="font-display font-bold text-ink text-lg leading-snug">
                        {lang === 'sw' ? a.title_sw : a.title_en}
                      </p>
                      <p className="text-sm text-ink-muted mt-2 leading-relaxed">
                        {lang === 'sw' ? a.body_sw : a.body_en}
                      </p>
                      <div className="flex items-center gap-3 mt-3">
                        <span className="text-xs text-ink-faint">{t('posted_by')} <span className="font-medium text-ink-muted">{a.author_name}</span></span>
                        <span className="text-ink-faint text-xs">·</span>
                        <span className="text-xs text-ink-faint font-mono">{new Date(a.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    {/* Delete — only author or pastor */}
                    {(user?.role === 'pastor' || a.author_id === user?.id) && (
                      <button onClick={() => setDeleteId(a.id)} className="btn-ghost text-xs text-ink-faint hover:text-danger flex-shrink-0">
                        {t('delete')}
                      </button>
                    )}
                  </div>
                </div>
                {i < items.length - 1 && <div className="hairline" />}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={t('new_announcement')}>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">{t('title_english')}</label>
              <input value={form.title_en} onChange={set('title_en')} className="field-input" required />
            </div>
            <div>
              <label className="field-label">{t('title_swahili')}</label>
              <input value={form.title_sw} onChange={set('title_sw')} className="field-input" required />
            </div>
          </div>
          <div>
            <label className="field-label">{t('body_english')}</label>
            <textarea value={form.body_en} onChange={set('body_en')} rows={3} className="field-input resize-none" required />
          </div>
          <div>
            <label className="field-label">{t('body_swahili')}</label>
            <textarea value={form.body_sw} onChange={set('body_sw')} rows={3} className="field-input resize-none" required />
          </div>
          {user?.role === 'pastor' && (
            <div>
              <label className="field-label">{t('broadcast_to')}</label>
              <select value={form.scope} onChange={set('scope')} className="field-input">
                <option value="church">{t('entire_church')}</option>
                <option value="group">{t('my_group')}</option>
              </select>
            </div>
          )}
          <div className="hairline" />
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">{t('cancel')}</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <span className="flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />{lang === 'sw' ? 'Inachapisha...' : 'Publishing...'}</span> : t('publish')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title={lang === 'sw' ? 'Futa Tangazo?' : 'Delete Announcement?'}>
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
