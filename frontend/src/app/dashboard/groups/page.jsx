'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useTranslation } from '../../../lib/i18n';
import { groupApi } from '../../../lib/api';
import PageHeader from '../../../components/ui/PageHeader';
import Modal from '../../../components/ui/Modal';
import Toast from '../../../components/ui/Toast';

// ─── V2 types (matches groupController v2 ENUM) ───────────────────────────────
const GROUP_TYPES = ['jumuiya', 'huduma', 'kwaya', 'idara', 'kamati', 'vingine'];
const GROUP_TYPE_LABELS = {
  en: {
    jumuiya: 'Jumuiya',
    huduma:  'Huduma',
    kwaya:   'Kwaya',
    idara:   'Idara',
    kamati:  'Kamati',
    vingine: 'Vingine',
  },
  sw: {
    jumuiya: 'Jumuiya',
    huduma:  'Huduma',
    kwaya:   'Kwaya',
    idara:   'Idara',
    kamati:  'Kamati',
    vingine: 'Vingine',
  },
};
const GROUP_TYPE_ICONS = {
  jumuiya: '◉',
  huduma:  '✦',
  kwaya:   '♪',
  idara:   '◈',
  kamati:  '◆',
  vingine: '◇',
};

const CURRENT_YEAR = new Date().getFullYear();

export default function GroupsPage() {
  const { user, lang } = useAuth();
  const { t } = useTranslation(lang);

  const [groups,    setGroups]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [toast,     setToast]     = useState(null);

  // Filters
  const [filterType,     setFilterType]     = useState('');
  const [filterArchived, setFilterArchived] = useState(false);

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [form,       setForm]       = useState({
    name: '', name_sw: '', type: 'jumuiya',
    description: '', year: CURRENT_YEAR,
    start_date: '', end_date: '',
  });

  // Archive / delete confirm
  const [archiveId, setArchiveId] = useState(null);
  const [deleteId,  setDeleteId]  = useState(null);

  const isManager = ['pastor', 'elder'].includes(user?.role);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Fetch ──────────────────────────────────────────────────────────────────
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

  // ── Create ─────────────────────────────────────────────────────────────────
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

  // ── Archive ────────────────────────────────────────────────────────────────
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

  // ── Delete ─────────────────────────────────────────────────────────────────
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

  // ── Derived ────────────────────────────────────────────────────────────────
  const typeCount = {};
  groups.forEach(g => { typeCount[g.type] = (typeCount[g.type] || 0) + 1; });

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

        {/* ── Filter bar ────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <button
            onClick={() => setFilterType('')}
            className={`btn-ghost text-xs px-3 py-1.5 rounded-full border transition-colors ${
              !filterType
                ? 'border-navy bg-navy text-white'
                : 'border-hairline text-ink-muted hover:border-navy hover:text-navy'
            }`}
          >
            {lang === 'sw' ? 'Yote' : 'All'}
          </button>
          {GROUP_TYPES.map(type => (
            <button
              key={type}
              onClick={() => setFilterType(t => t === type ? '' : type)}
              className={`btn-ghost text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filterType === type
                  ? 'border-navy bg-navy text-white'
                  : 'border-hairline text-ink-muted hover:border-navy hover:text-navy'
              }`}
            >
              {GROUP_TYPE_ICONS[type]} {GROUP_TYPE_LABELS[lang]?.[type]}
              {typeCount[type] ? <span className="ml-1 opacity-60">({typeCount[type]})</span> : null}
            </button>
          ))}

          {/* Archived toggle */}
          <label className="ml-auto flex items-center gap-2 cursor-pointer select-none">
            <span className="text-xs text-ink-faint">
              {lang === 'sw' ? 'Onyesha zilizohifadhiwa' : 'Show archived'}
            </span>
            <input
              type="checkbox"
              checked={filterArchived}
              onChange={e => setFilterArchived(e.target.checked)}
              className="accent-navy w-3.5 h-3.5"
            />
          </label>
        </div>

        <div className="hairline mb-0" />

        {/* ── List ──────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="py-16 flex justify-center">
            <span className="w-5 h-5 border-2 border-border border-t-ink-muted rounded-full animate-spin" />
          </div>
        ) : groups.length === 0 ? (
          <div className="py-16 text-center text-ink-muted text-sm">
            {lang === 'sw' ? 'Hakuna vikundi' : 'No groups found'}
          </div>
        ) : (
          groups.map((g, i) => (
            <div key={g.id} className={`animate-slide-up stagger-${Math.min(i + 1, 6)}`}>
              <div className="flex items-center justify-between gap-4 py-4">

                {/* Left: icon + info */}
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="w-8 h-8 rounded-lg border border-hairline flex items-center justify-center text-sm flex-shrink-0"
                    style={{ background: 'var(--navy-muted)', color: 'var(--navy)' }}
                  >
                    {GROUP_TYPE_ICONS[g.type] || '◇'}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <a
                        href={`/dashboard/groups/${g.id}`}
                        className="text-sm font-semibold text-ink hover:text-navy transition-colors"
                      >
                        {lang === 'sw' ? (g.name_sw || g.name) : g.name}
                      </a>
                      {g.is_archived ? (
                        <span className="text-2xs font-semibold uppercase tracking-wider text-ink-faint border border-hairline rounded px-1.5 py-0.5">
                          {lang === 'sw' ? 'Imehifadhiwa' : 'Archived'}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-ink-faint font-semibold uppercase tracking-wider">
                        {GROUP_TYPE_LABELS[lang]?.[g.type] || g.type}
                      </span>
                      {g.year && (
                        <>
                          <span className="text-ink-faint text-xs">·</span>
                          <span className="text-xs text-ink-faint font-mono">{g.year}</span>
                        </>
                      )}
                      <span className="text-ink-faint text-xs">·</span>
                      <span className="text-xs text-ink-faint font-mono">
                        {g.active_member_count ?? g.member_count ?? 0} {lang === 'sw' ? 'wanachama' : 'members'}
                      </span>
                      {g.leader_name && (
                        <>
                          <span className="text-ink-faint text-xs">·</span>
                          <span className="text-xs text-ink-faint">{g.leader_name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: actions */}
                {isManager && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!g.is_archived && (
                      <button
                        onClick={() => setArchiveId(g.id)}
                        className="btn-ghost text-xs text-ink-faint px-2"
                        title={lang === 'sw' ? 'Hifadhi' : 'Archive'}
                      >
                        {lang === 'sw' ? 'Hifadhi' : 'Archive'}
                      </button>
                    )}
                    <button
                      onClick={() => setDeleteId(g.id)}
                      className="btn-ghost text-xs text-danger px-2"
                    >
                      {lang === 'sw' ? 'Futa' : 'Delete'}
                    </button>
                  </div>
                )}
              </div>
              <div className="hairline" />
            </div>
          ))
        )}
      </div>

      {/* ── Create Modal ──────────────────────────────────────────────────── */}
      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title={lang === 'sw' ? 'Kikundi Kipya' : 'New Group'}
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {/* Names */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">
                {lang === 'sw' ? 'Jina (Kiingereza)' : 'Name (English)'}
              </label>
              <input value={form.name} onChange={set('name')} className="field-input" required />
            </div>
            <div>
              <label className="field-label">
                {lang === 'sw' ? 'Jina (Kiswahili)' : 'Name (Swahili)'}
              </label>
              <input value={form.name_sw} onChange={set('name_sw')} className="field-input" required />
            </div>
          </div>

          {/* Type + Year */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">{lang === 'sw' ? 'Aina' : 'Type'}</label>
              <select value={form.type} onChange={set('type')} className="field-input">
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
                value={form.year}
                onChange={set('year')}
                min="1900"
                max={CURRENT_YEAR + 5}
                className="field-input"
              />
            </div>
          </div>

          {/* Dates */}
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

          {/* Description */}
          <div>
            <label className="field-label">{lang === 'sw' ? 'Maelezo' : 'Description'}</label>
            <textarea
              value={form.description}
              onChange={set('description')}
              rows={2}
              className="field-input resize-none"
            />
          </div>

          <div className="hairline" />
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setCreateOpen(false)} className="btn-secondary">
              {t('cancel')}
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? t('loading') : t('save')}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Archive Confirm ───────────────────────────────────────────────── */}
      <Modal
        isOpen={!!archiveId}
        onClose={() => setArchiveId(null)}
        title={lang === 'sw' ? 'Hifadhi Kikundi?' : 'Archive Group?'}
      >
        <p className="text-sm text-ink-muted">
          {lang === 'sw'
            ? 'Kikundi kitahifadhiwa. Wanachama na historia vitabaki salama.'
            : 'The group will be archived. Members and history will be preserved.'}
        </p>
        <div className="hairline mt-5 mb-4" />
        <div className="flex gap-3 justify-end">
          <button onClick={() => setArchiveId(null)} className="btn-secondary">{t('cancel')}</button>
          <button onClick={() => handleArchive(archiveId)} className="btn-primary">
            {lang === 'sw' ? 'Hifadhi' : 'Archive'}
          </button>
        </div>
      </Modal>

      {/* ── Delete Confirm ────────────────────────────────────────────────── */}
      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title={lang === 'sw' ? 'Futa Kikundi?' : 'Delete Group?'}
      >
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