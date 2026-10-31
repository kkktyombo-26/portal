'use client';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useTranslation } from '../../../lib/i18n';
import { siteContentApi } from '../../../lib/api';
import PageHeader from '../../../components/ui/PageHeader';

// ─── Types (mirroring backend) ────────────────────────────────────────────────
type SectionKey = 'hero' | 'mission' | 'events_preview' | 'join_cta';

interface SectionContent {
  [key: string]: string;
}

interface Story {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  coverImage?: string;
  published: boolean;
  authorId: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// ─── Section field configs ────────────────────────────────────────────────────
const SECTION_FIELDS: Record<SectionKey, Array<{ key: string; label: string; type: 'text' | 'textarea' | 'url' }>> = {
  hero: [
    { key: 'headline',    label: 'Headline',             type: 'text' },
    { key: 'subheadline', label: 'Sub-headline',         type: 'text' },
    { key: 'ctaLabel',    label: 'CTA label',            type: 'text' },
    { key: 'ctaHref',     label: 'CTA link',             type: 'url'  },
    { key: 'imageUrl',    label: 'Background image URL', type: 'url'  },
  ],
  mission: [
    { key: 'title',    label: 'Section title', type: 'text'     },
    { key: 'body',     label: 'Body text',     type: 'textarea' },
    { key: 'quote',    label: 'Pull quote',    type: 'textarea' },
    { key: 'imageUrl', label: 'Image URL',     type: 'url'      },
  ],
  events_preview: [
    { key: 'title',    label: 'Section title',   type: 'text' },
    { key: 'ctaLabel', label: 'View all label',  type: 'text' },
    { key: 'ctaHref',  label: 'View all link',   type: 'url'  },
  ],
  join_cta: [
    { key: 'headline', label: 'Headline',  type: 'text'     },
    { key: 'body',     label: 'Body text', type: 'textarea' },
    { key: 'ctaLabel', label: 'CTA label', type: 'text'     },
    { key: 'ctaHref',  label: 'CTA link',  type: 'url'      },
  ],
};

const SECTION_LABELS: Record<SectionKey, { en: string; sw: string }> = {
  hero:           { en: 'Hero banner',    sw: 'Bango Kuu' },
  mission:        { en: 'Mission',        sw: 'Dhamira'   },
  events_preview: { en: 'Events preview', sw: 'Matukio'   },
  join_cta:       { en: 'Join CTA',       sw: 'Jiunge'    },
};

// ─── Shared input class ───────────────────────────────────────────────────────
// Matches the .input component from the design system — white fill, gold focus ring.
const INPUT =
  'w-full bg-white border border-[var(--border-default)] rounded text-sm ' +
  'text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] ' +
  'px-3 py-2.5 outline-none transition-all ' +
  'hover:border-[var(--border-strong)] ' +
  'focus:border-[var(--gold)] focus:shadow-[0_0_0_3px_rgba(196,154,42,0.20)]';

// ─── Toast ────────────────────────────────────────────────────────────────────
// Uses the design-system .toast pattern: navy bg, gold/success/danger left border.
function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div
      className={[
        'fixed bottom-6 right-6 z-[60] flex items-center gap-3',
        'bg-[var(--navy)] text-white text-sm font-medium',
        'rounded-md px-4 py-3 shadow-xl min-w-[260px]',
        'border-l-[3px]',
        type === 'success' ? 'border-[var(--success)]' : 'border-[var(--danger)]',
      ].join(' ')}
    >
      {type === 'success' ? (
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="flex-shrink-0">
          <path d="M2 7.5l3.5 3.5 7.5-7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="flex-shrink-0">
          <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.5" />
          <path d="M7.5 4v4M7.5 10.5v.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      )}
      {message}
    </div>
  );
}

// ─── Field input ──────────────────────────────────────────────────────────────
function Field({
  field, value, onChange,
}: {
  field: { key: string; label: string; type: 'text' | 'textarea' | 'url' };
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-[var(--text-secondary)]">{field.label}</label>
      {field.type === 'textarea' ? (
        <textarea
          className={`${INPUT} min-h-[100px] resize-y`}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={`Enter ${field.label.toLowerCase()}…`}
        />
      ) : (
        <input
          type={field.type === 'url' ? 'url' : 'text'}
          className={INPUT}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={field.type === 'url' ? 'https://…' : `Enter ${field.label.toLowerCase()}…`}
        />
      )}
    </div>
  );
}

// ─── Section editor panel ─────────────────────────────────────────────────────
function SectionEditor({ section, lang }: { section: SectionKey; lang: string }) {
  const [fields, setFields]   = useState<SectionContent>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [dirty, setDirty]     = useState(false);
  const [toast, setToast]     = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLoading(true);
    setDirty(false);
    siteContentApi.getSection(section)
      .then(res => setFields(res.data.content ?? {}))
      .catch(() => setFields({}))
      .finally(() => setLoading(false));
  }, [section]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  const handleChange = (key: string, val: string) => {
    setFields(prev => ({ ...prev, [key]: val }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await siteContentApi.updateSection(section, fields);
      setDirty(false);
      showToast(lang === 'sw' ? 'Imehifadhiwa' : 'Saved', 'success');
    } catch {
      showToast(lang === 'sw' ? 'Hitilafu ya kuhifadhi' : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-5 h-5 rounded-full border-2 border-[var(--gold)] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Fields — sit directly on the page background; no extra surface wrap */}
      <div className="flex flex-col gap-5 p-6">
        {SECTION_FIELDS[section].map(fd => (
          <Field
            key={fd.key}
            field={fd}
            value={fields[fd.key] ?? ''}
            onChange={val => handleChange(fd.key, val)}
          />
        ))}
      </div>

      {/* Save bar — sticky footer strip, separated by a border, not a background fill */}
      <div className="sticky bottom-0 border-t border-[var(--border-subtle)] px-6 py-4 flex items-center justify-between">
        <span className={`text-xs ${dirty ? 'text-[var(--warning)]' : 'text-[var(--text-tertiary)]'}`}>
          {dirty
            ? (lang === 'sw' ? 'Mabadiliko hayajahifadhiwa' : 'Unsaved changes')
            : (lang === 'sw' ? 'Hakuna mabadiliko' : 'No changes')}
        </span>
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="btn btn-primary btn-sm disabled:opacity-40 flex items-center gap-2"
        >
          {saving && <div className="w-3.5 h-3.5 rounded-full border-2 border-[var(--navy-dark)] border-t-transparent animate-spin" />}
          {saving
            ? (lang === 'sw' ? 'Inahifadhi…' : 'Saving…')
            : (lang === 'sw' ? 'Hifadhi' : 'Save changes')}
        </button>
      </div>

      {toast && <Toast {...toast} />}
    </div>
  );
}

// ─── Story row ────────────────────────────────────────────────────────────────
function StoryRow({
  story, lang, onEdit, onDelete, onTogglePublish,
}: {
  story: Story;
  lang: string;
  onEdit: (s: Story) => void;
  onDelete: (id: string) => void;
  onTogglePublish: (s: Story) => void;
}) {
  return (
    <div className="flex items-start gap-4 px-6 py-4 border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--surface-page)] transition-colors">
      {story.coverImage && (
        <img
          src={story.coverImage}
          alt=""
          className="w-12 h-12 rounded object-cover flex-shrink-0 bg-[var(--surface-page)]"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {/* Published / Draft badge — design-system badge tokens */}
          <span className={`badge ${story.published ? 'badge-success' : 'badge-warning'}`}>
            <span className={`status-dot ${story.published ? 'active' : 'pending'}`} />
            {story.published
              ? (lang === 'sw' ? 'Imechapishwa' : 'Published')
              : (lang === 'sw' ? 'Rasimu' : 'Draft')}
          </span>
          {story.tags.slice(0, 2).map(t => (
            <span key={t} className="badge badge-navy">{t}</span>
          ))}
        </div>
        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{story.title}</p>
        <p className="text-xs text-[var(--text-tertiary)] truncate mt-0.5">{story.excerpt}</p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => onTogglePublish(story)}
          className="btn btn-ghost btn-sm"
        >
          {story.published
            ? (lang === 'sw' ? 'Futa' : 'Unpublish')
            : (lang === 'sw' ? 'Chapisha' : 'Publish')}
        </button>
        <button
          onClick={() => onEdit(story)}
          className="btn btn-ghost btn-icon btn-sm"
          title="Edit"
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M9 1.5l2.5 2.5L3.5 11.5H1v-2.5L9 1.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          onClick={() => onDelete(story.id)}
          className="btn btn-ghost btn-icon btn-sm text-[var(--danger)] hover:bg-[var(--danger-bg)]"
          title="Delete"
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M1.5 3h10M4.5 3V1.5h4V3M5 5.5v4M8 5.5v4M2.5 3l.75 8h7.5L11.5 3H2.5z"
              stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Story form modal ─────────────────────────────────────────────────────────
// Modal uses --surface-card (white) as its own surface — permitted exception per
// the layout philosophy (it is an interactive overlay, not a passive content box).
function StoryModal({
  story, lang, onClose, onSaved,
}: {
  story: Partial<Story> | null;
  lang: string;
  onClose: () => void;
  onSaved: (s: Story) => void;
}) {
  const isNew = !story?.id;
  const [form, setForm] = useState<Partial<Story>>(story ?? {
    title: '', excerpt: '', content: '', coverImage: '', tags: [], published: false,
  });
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const set = (k: keyof Story, v: unknown) => setForm(p => ({ ...p, [k]: v }));

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !(form.tags ?? []).includes(t)) set('tags', [...(form.tags ?? []), t]);
    setTagInput('');
  };
  const removeTag = (t: string) => set('tags', (form.tags ?? []).filter(x => x !== t));

  const handleSave = async () => {
    if (!form.title?.trim()) {
      setError(lang === 'sw' ? 'Kichwa kinahitajika' : 'Title is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      let res;
      if (isNew) {
        // res = await storiesApi.create(form);
      } else {
        // res = await storiesApi.update(story!.id!, form);
      }
      onSaved(res.data.story);
    } catch {
      setError(lang === 'sw' ? 'Imeshindwa kuhifadhi' : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10">
      {/* Scrim — matches --surface-overlay */}
      <div
        className="absolute inset-0 bg-[rgba(9,9,15,0.64)] backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Modal panel — white surface is permitted here (interactive overlay) */}
      <div className="modal w-full max-w-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">
            {isNew
              ? (lang === 'sw' ? 'Hadithi Mpya' : 'New story')
              : (lang === 'sw' ? 'Hariri Hadithi' : 'Edit story')}
          </h2>
          <button onClick={onClose} className="btn btn-ghost btn-icon btn-sm">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M1 1l11 11M12 1L1 12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="modal-body flex flex-col gap-4">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className="form-label">
              {lang === 'sw' ? 'Kichwa' : 'Title'} *
            </label>
            <input
              type="text"
              className={INPUT}
              value={form.title ?? ''}
              onChange={e => set('title', e.target.value)}
              placeholder={lang === 'sw' ? 'Jina la hadithi…' : 'Story title…'}
            />
          </div>

          {/* Excerpt */}
          <div className="flex flex-col gap-1.5">
            <label className="form-label">{lang === 'sw' ? 'Muhtasari' : 'Excerpt'}</label>
            <textarea
              className={`${INPUT} min-h-[70px] resize-y`}
              value={form.excerpt ?? ''}
              onChange={e => set('excerpt', e.target.value)}
              placeholder={lang === 'sw' ? 'Maelezo mafupi…' : 'Short description shown in previews…'}
            />
          </div>

          {/* Content */}
          <div className="flex flex-col gap-1.5">
            <label className="form-label">{lang === 'sw' ? 'Maudhui' : 'Content'}</label>
            <textarea
              className={`${INPUT} min-h-[160px] resize-y font-mono leading-relaxed`}
              value={form.content ?? ''}
              onChange={e => set('content', e.target.value)}
              placeholder={lang === 'sw' ? 'Andika hapa… (HTML au Markdown)' : 'Full story content… (HTML or Markdown)'}
            />
          </div>

          {/* Cover image */}
          <div className="flex flex-col gap-1.5">
            <label className="form-label">{lang === 'sw' ? 'Picha ya Jalada' : 'Cover image URL'}</label>
            <input
              type="url"
              className={INPUT}
              value={form.coverImage ?? ''}
              onChange={e => set('coverImage', e.target.value)}
              placeholder="https://…"
            />
          </div>

          {/* Tags */}
          <div className="flex flex-col gap-1.5">
            <label className="form-label">{lang === 'sw' ? 'Lebo' : 'Tags'}</label>
            <div className="flex gap-2">
              <input
                type="text"
                className={`${INPUT} flex-1`}
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder={lang === 'sw' ? 'Andika lebo…' : 'Type a tag and press Enter…'}
              />
              <button onClick={addTag} className="btn btn-secondary btn-sm">
                {lang === 'sw' ? 'Ongeza' : 'Add'}
              </button>
            </div>
            {(form.tags ?? []).length > 0 && (
              <div className="flex flex-wrap gap-2 mt-1">
                {(form.tags ?? []).map(t => (
                  <span key={t} className="badge badge-navy inline-flex items-center gap-1.5">
                    {t}
                    <button
                      onClick={() => removeTag(t)}
                      className="hover:text-[var(--danger)] transition-colors"
                      aria-label={`Remove tag ${t}`}
                    >
                      <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                        <path d="M1 1l7 7M8 1L1 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Publish toggle — using design-system .switch */}
          <label className="field-row cursor-pointer select-none">
            <span className="switch">
              <input
                type="checkbox"
                checked={form.published ?? false}
                onChange={e => set('published', e.target.checked)}
              />
              <span className="switch-track" />
              <span className="switch-thumb" />
            </span>
            <span className="text-sm text-[var(--text-primary)]">
              {lang === 'sw' ? 'Chapisha mara moja' : 'Publish immediately'}
            </span>
          </label>

          {error && (
            <p className="banner banner-danger text-sm">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-secondary btn-sm">
            {lang === 'sw' ? 'Ghairi' : 'Cancel'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary btn-sm disabled:opacity-40 flex items-center gap-2"
          >
            {saving && <div className="w-3.5 h-3.5 rounded-full border-2 border-[var(--navy-dark)] border-t-transparent animate-spin" />}
            {saving
              ? (lang === 'sw' ? 'Inahifadhi…' : 'Saving…')
              : (lang === 'sw' ? 'Hifadhi' : 'Save')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Stories tab ──────────────────────────────────────────────────────────────
function StoriesTab({ lang }: { lang: string }) {
  const [stories, setStories]   = useState<Story[]>([]);
  const [loading, setLoading]   = useState(true);
  const [editTarget, setEdit]   = useState<Partial<Story> | null | undefined>(undefined);
  const [toast, setToast]       = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  const load = async () => {
    setLoading(true);
    try {
      // const res = await storiesApi.list();
      // setStories(res.data.stories ?? []);
    } catch {
      setStories([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm(lang === 'sw' ? 'Futa hadithi hii?' : 'Delete this story?')) return;
    try {
      // await storiesApi.delete(id);
      setStories(p => p.filter(s => s.id !== id));
      showToast(lang === 'sw' ? 'Imefutwa' : 'Deleted', 'success');
    } catch {
      showToast(lang === 'sw' ? 'Imeshindwa kufuta' : 'Delete failed', 'error');
    }
  };

  const handleTogglePublish = async (story: Story) => {
    try {
      let res;
      if (!story.published) {
        // res = await storiesApi.publish(story.id);
      } else {
        // res = await storiesApi.update(story.id, { published: false });
      }
      setStories(p => p.map(s => s.id === story.id ? res.data.story : s));
      showToast(
        story.published
          ? (lang === 'sw' ? 'Imefutwa kuchapishwa' : 'Unpublished')
          : (lang === 'sw' ? 'Imechapishwa' : 'Published'),
        'success',
      );
    } catch {
      showToast(lang === 'sw' ? 'Imeshindwa' : 'Action failed', 'error');
    }
  };

  const handleSaved = (saved: Story) => {
    setStories(p => {
      const exists = p.find(s => s.id === saved.id);
      return exists ? p.map(s => s.id === saved.id ? saved : s) : [saved, ...p];
    });
    setEdit(undefined);
    showToast(lang === 'sw' ? 'Imehifadhiwa' : 'Saved', 'success');
  };

  return (
    <div>
      {/* Toolbar — a simple flex row directly on the page bg, separated by a border */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
        <p className="text-xs text-[var(--text-tertiary)]">
          {stories.length} {lang === 'sw' ? 'hadithi' : 'stories'}
          {' · '}
          {stories.filter(s => s.published).length} {lang === 'sw' ? 'zilizochapishwa' : 'published'}
        </p>
        <button
          onClick={() => setEdit({ title: '', excerpt: '', content: '', tags: [], published: false })}
          className="btn btn-primary btn-sm flex items-center gap-2"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
          {lang === 'sw' ? 'Hadithi Mpya' : 'New story'}
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-5 h-5 rounded-full border-2 border-[var(--gold)] border-t-transparent animate-spin" />
        </div>
      ) : stories.length === 0 ? (
        <div className="empty-state">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="empty-state-icon">
            <rect x="6" y="4" width="24" height="32" rx="3" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12 14h14M12 20h14M12 26h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <p className="empty-state-title">
            {lang === 'sw' ? 'Hakuna hadithi bado' : 'No stories yet'}
          </p>
          <p className="empty-state-body">
            {lang === 'sw'
              ? 'Unda hadithi yako ya kwanza kwa kubonyeza kitufe hapo juu'
              : 'Create your first story using the button above.'}
          </p>
        </div>
      ) : (
        <div>
          {stories.map(s => (
            <StoryRow
              key={s.id}
              story={s}
              lang={lang}
              onEdit={setEdit}
              onDelete={handleDelete}
              onTogglePublish={handleTogglePublish}
            />
          ))}
        </div>
      )}

      {editTarget !== undefined && (
        <StoryModal
          story={editTarget}
          lang={lang}
          onClose={() => setEdit(undefined)}
          onSaved={handleSaved}
        />
      )}

      {toast && <Toast {...toast} />}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
const SECTIONS: SectionKey[] = ['hero', 'mission', 'events_preview', 'join_cta'];

export default function EditorPage() {
  const { user, lang } = useAuth();
  const { t } = useTranslation(lang);

  const [tab, setTab]         = useState<'landing' | 'stories'>('landing');
  const [section, setSection] = useState<SectionKey>('hero');

  // Role guard — only pastor / elder can edit
  if (!user || !['pastor', 'elder'].includes(user.role)) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-sm text-[var(--text-tertiary)]">
          {lang === 'sw' ? 'Huna ruhusa ya ukurasa huu.' : 'You dont have access to this page.'}
        </p>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <PageHeader
        breadcrumb={null}
        title={lang === 'sw' ? 'Mhariri wa Maudhui' : 'Content editor'}
        subtitle={lang === 'sw'
          ? 'Simamia kurasa ya umma na hadithi'
          : 'Manage the public landing page and stories'}
        action={null}
      />

      {/* Main tabs — design-system .tabs, gold active underline */}
      <div className="tabs sticky top-0 z-10 bg-[var(--surface-page)] px-6">
        {(['landing', 'stories'] as const).map(t_ => (
          <button
            key={t_}
            onClick={() => setTab(t_)}
            className={`tab ${tab === t_ ? 'active' : ''}`}
          >
            {t_ === 'landing'
              ? (lang === 'sw' ? 'Kurasa Kuu' : 'Landing page')
              : (lang === 'sw' ? 'Hadithi' : 'Stories')}
          </button>
        ))}
      </div>

      {tab === 'landing' ? (
        <div className="flex min-h-[500px]">
          {/*
           * Section sidebar — nav chrome, not a content surface.
           * Uses a right border to separate, no background fill of its own;
           * inherits the page background.
           */}
          <nav className="w-48 flex-shrink-0 border-r border-[var(--border-subtle)] py-3 flex flex-col">
            {SECTIONS.map(s => (
              <button
                key={s}
                onClick={() => setSection(s)}
                className={[
                  'w-full text-left px-5 py-2.5 text-sm transition-colors relative',
                  section === s
                    ? 'text-[var(--navy)] font-medium'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                ].join(' ')}
              >
                {/* Active gold bar — mirrors .nav-item::before from the sidebar */}
                {section === s && (
                  <span className="absolute left-0 top-1 bottom-1 w-[3px] bg-[var(--gold)] rounded-r-sm" />
                )}
                {SECTION_LABELS[s][lang === 'sw' ? 'sw' : 'en']}
              </button>
            ))}
          </nav>

          {/* Editor — inherits page background; no surface wrap */}
          <div className="flex-1 min-w-0">
            <SectionEditor key={section} section={section} lang={lang} />
          </div>
        </div>
      ) : (
        <StoriesTab lang={lang} />
      )}
    </div>
  );
}