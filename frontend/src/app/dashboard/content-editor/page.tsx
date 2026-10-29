'use client';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useTranslation } from '../../../lib/i18n';
import { siteContentApi } from '../../../lib/api';
import PageHeader from '../../../components/ui/PageHeader';

// ─── Types (mirroring backend) ───────────────────────────────────────────────
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
    { key: 'headline',    label: 'Headline',      type: 'text' },
    { key: 'subheadline', label: 'Sub-headline',  type: 'text' },
    { key: 'ctaLabel',    label: 'CTA Label',     type: 'text' },
    { key: 'ctaHref',     label: 'CTA Link',      type: 'url' },
    { key: 'imageUrl',    label: 'Background Image URL', type: 'url' },
  ],
  mission: [
    { key: 'title',   label: 'Section Title', type: 'text' },
    { key: 'body',    label: 'Body Text',     type: 'textarea' },
    { key: 'quote',   label: 'Pull Quote',    type: 'textarea' },
    { key: 'imageUrl',label: 'Image URL',     type: 'url' },
  ],
  events_preview: [
    { key: 'title',      label: 'Section Title',  type: 'text' },
    { key: 'ctaLabel',   label: 'View All Label', type: 'text' },
    { key: 'ctaHref',    label: 'View All Link',  type: 'url' },
  ],
  join_cta: [
    { key: 'headline', label: 'Headline',   type: 'text' },
    { key: 'body',     label: 'Body Text',  type: 'textarea' },
    { key: 'ctaLabel', label: 'CTA Label',  type: 'text' },
    { key: 'ctaHref',  label: 'CTA Link',   type: 'url' },
  ],
};

const SECTION_LABELS: Record<SectionKey, { en: string; sw: string }> = {
  hero:           { en: 'Hero Banner',    sw: 'Bango Kuu' },
  mission:        { en: 'Mission',        sw: 'Dhamira' },
  events_preview: { en: 'Events Preview', sw: 'Matukio' },
  join_cta:       { en: 'Join CTA',       sw: 'Jiunge' },
};

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium
      ${type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
      {type === 'success' ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M2.5 8.5l3.5 3.5 7.5-7.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 3v5M8 11.5v.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
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
  const base = 'w-full bg-surface border border-hairline rounded-lg text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all';

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted uppercase tracking-wide">{field.label}</label>
      {field.type === 'textarea' ? (
        <textarea
          className={`${base} px-3 py-2.5 min-h-[100px] resize-y`}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={`Enter ${field.label.toLowerCase()}…`}
        />
      ) : (
        <input
          type={field.type === 'url' ? 'url' : 'text'}
          className={`${base} px-3 py-2.5`}
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
  const [fields, setFields]     = useState<SectionContent>({});
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [dirty, setDirty]       = useState(false);
  const [toast, setToast]       = useState<{ message: string; type: 'success' | 'error' } | null>(null);
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

  const fieldDefs = SECTION_FIELDS[section];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Fields */}
      <div className="flex flex-col gap-4 p-6">
        {fieldDefs.map(fd => (
          <Field
            key={fd.key}
            field={fd}
            value={fields[fd.key] ?? ''}
            onChange={val => handleChange(fd.key, val)}
          />
        ))}
      </div>

      {/* Save bar */}
      <div className="sticky bottom-0 bg-canvas border-t border-hairline px-6 py-4 flex items-center justify-between">
        <span className={`text-xs ${dirty ? 'text-amber-500' : 'text-muted'}`}>
          {dirty
            ? (lang === 'sw' ? 'Mabadiliko hayajahifadhiwa' : 'Unsaved changes')
            : (lang === 'sw' ? 'Hakuna mabadiliko' : 'No changes')}
        </span>
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="btn-primary flex items-center gap-2 text-sm px-4 py-2 disabled:opacity-40"
        >
          {saving && <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />}
          {saving
            ? (lang === 'sw' ? 'Inahifadhi…' : 'Saving…')
            : (lang === 'sw' ? 'Hifadhi' : 'Save')}
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
    <div className="flex items-start gap-4 p-4 border-b border-hairline last:border-0 hover:bg-surface/50 transition-colors">
      {story.coverImage && (
        <img src={story.coverImage} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0 bg-surface" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium
            ${story.published ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/15 text-amber-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${story.published ? 'bg-green-400' : 'bg-amber-400'}`} />
            {story.published
              ? (lang === 'sw' ? 'Imechapishwa' : 'Published')
              : (lang === 'sw' ? 'Rasimu' : 'Draft')}
          </span>
          {story.tags.slice(0, 2).map(t => (
            <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">{t}</span>
          ))}
        </div>
        <p className="text-sm font-semibold text-ink truncate">{story.title}</p>
        <p className="text-xs text-muted truncate mt-0.5">{story.excerpt}</p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => onTogglePublish(story)}
          className="btn-ghost text-xs px-3 py-1.5 rounded-md"
          title={story.published ? 'Unpublish' : 'Publish'}
        >
          {story.published
            ? (lang === 'sw' ? 'Futa' : 'Unpublish')
            : (lang === 'sw' ? 'Chapisha' : 'Publish')}
        </button>
        <button
          onClick={() => onEdit(story)}
          className="btn-ghost w-8 h-8 flex items-center justify-center rounded-md"
          title="Edit"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9.5 1.5l3 3L4 13H1v-3L9.5 1.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
          </svg>
        </button>
        <button
          onClick={() => onDelete(story.id)}
          className="btn-ghost w-8 h-8 flex items-center justify-center rounded-md text-red-400 hover:text-red-300"
          title="Delete"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 3.5h10M5.5 3.5V2h3v1.5M6 6.5v4M8 6.5v4M3 3.5l.75 8.25h6.5L11 3.5H3z"
              stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Story form modal ─────────────────────────────────────────────────────────
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
    if (t && !(form.tags ?? []).includes(t)) {
      set('tags', [...(form.tags ?? []), t]);
    }
    setTagInput('');
  };

  const removeTag = (t: string) => set('tags', (form.tags ?? []).filter(x => x !== t));

  const handleSave = async () => {
    if (!form.title?.trim()) { setError(lang === 'sw' ? 'Kichwa kinahitajika' : 'Title is required'); return; }
    setSaving(true);
    setError('');
    try {
      let res;
      if (isNew) {
     //   res = await storiesApi.create(form);
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
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-canvas border border-hairline rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-hairline flex-shrink-0">
          <h2 className="text-base font-bold text-ink">
            {isNew
              ? (lang === 'sw' ? 'Hadithi Mpya' : 'New Story')
              : (lang === 'sw' ? 'Hariri Hadithi' : 'Edit Story')}
          </h2>
          <button onClick={onClose} className="btn-ghost w-8 h-8 flex items-center justify-center rounded-lg">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 flex flex-col gap-4">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted uppercase tracking-wide">
              {lang === 'sw' ? 'Kichwa' : 'Title'} *
            </label>
            <input
              type="text"
              className="w-full bg-surface border border-hairline rounded-lg px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-blue-600"
              value={form.title ?? ''}
              onChange={e => set('title', e.target.value)}
              placeholder={lang === 'sw' ? 'Jina la hadithi…' : 'Story title…'}
            />
          </div>

          {/* Excerpt */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted uppercase tracking-wide">
              {lang === 'sw' ? 'Muhtasari' : 'Excerpt'}
            </label>
            <textarea
              className="w-full bg-surface border border-hairline rounded-lg px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-blue-600 resize-y min-h-[70px]"
              value={form.excerpt ?? ''}
              onChange={e => set('excerpt', e.target.value)}
              placeholder={lang === 'sw' ? 'Maelezo mafupi…' : 'Short description shown in previews…'}
            />
          </div>

          {/* Content */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted uppercase tracking-wide">
              {lang === 'sw' ? 'Maudhui' : 'Content'}
            </label>
            <textarea
              className="w-full bg-surface border border-hairline rounded-lg px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-blue-600 resize-y min-h-[160px] font-mono leading-relaxed"
              value={form.content ?? ''}
              onChange={e => set('content', e.target.value)}
              placeholder={lang === 'sw' ? 'Andika hapa… (HTML au Markdown)' : 'Full story content… (HTML or Markdown)'}
            />
          </div>

          {/* Cover image */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted uppercase tracking-wide">
              {lang === 'sw' ? 'Picha ya Jalada' : 'Cover Image URL'}
            </label>
            <input
              type="url"
              className="w-full bg-surface border border-hairline rounded-lg px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-blue-600"
              value={form.coverImage ?? ''}
              onChange={e => set('coverImage', e.target.value)}
              placeholder="https://…"
            />
          </div>

          {/* Tags */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted uppercase tracking-wide">
              {lang === 'sw' ? 'Lebo' : 'Tags'}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 bg-surface border border-hairline rounded-lg px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-blue-600"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder={lang === 'sw' ? 'Andika lebo…' : 'Type a tag and press Enter…'}
              />
              <button onClick={addTag} className="btn-ghost px-4 py-2.5 text-sm rounded-lg border border-hairline">
                {lang === 'sw' ? 'Ongeza' : 'Add'}
              </button>
            </div>
            {(form.tags ?? []).length > 0 && (
              <div className="flex flex-wrap gap-2 mt-1">
                {(form.tags ?? []).map(t => (
                  <span key={t} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {t}
                    <button onClick={() => removeTag(t)} className="hover:text-red-400 transition-colors">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Publish toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only"
                checked={form.published ?? false}
                onChange={e => set('published', e.target.checked)}
              />
              <div className={`w-10 h-6 rounded-full transition-colors ${form.published ? 'bg-blue-600' : 'bg-surface border border-hairline'}`}>
                <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.published ? 'translate-x-4' : ''}`} />
              </div>
            </div>
            <span className="text-sm text-ink">
              {lang === 'sw' ? 'Chapisha mara moja' : 'Publish immediately'}
            </span>
          </label>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-hairline flex-shrink-0">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm rounded-lg">
            {lang === 'sw' ? 'Ghairi' : 'Cancel'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-40"
          >
            {saving && <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />}
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
   //   const res = await storiesApi.list();
    //  setStories(res.data.stories ?? []);
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
      //  res = await storiesApi.update(story.id, { published: false });
      }
      setStories(p => p.map(s => s.id === story.id ? res.data.story : s));
      showToast(
        story.published
          ? (lang === 'sw' ? 'Imefutwa kuchapishwa' : 'Unpublished')
          : (lang === 'sw' ? 'Imechapishwa' : 'Published'),
        'success'
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
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-hairline">
        <div>
          <p className="text-xs text-muted">
            {stories.length} {lang === 'sw' ? 'hadithi' : 'stories'} · {stories.filter(s => s.published).length} {lang === 'sw' ? 'zilizochapishwa' : 'published'}
          </p>
        </div>
        <button
          onClick={() => setEdit({ title: '', excerpt: '', content: '', tags: [], published: false })}
          className="btn-primary flex items-center gap-2 text-sm px-4 py-2"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
          </svg>
          {lang === 'sw' ? 'Hadithi Mpya' : 'New Story'}
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
        </div>
      ) : stories.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center px-6">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="text-muted opacity-40">
            <rect x="6" y="4" width="24" height="32" rx="3" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M12 14h14M12 20h14M12 26h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <p className="text-sm font-medium text-ink">
            {lang === 'sw' ? 'Hakuna hadithi bado' : 'No stories yet'}
          </p>
          <p className="text-xs text-muted max-w-xs">
            {lang === 'sw'
              ? 'Unda hadithi yako ya kwanza kwa kubonyeza kitufe hapo juu'
              : 'Create your first story by clicking the button above'}
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

      {/* Modal */}
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

  const [tab, setTab] = useState<'landing' | 'stories'>('landing');
  const [section, setSection] = useState<SectionKey>('hero');

  // Role guard – only pastor/elder can edit
  if (!user || !['pastor', 'elder'].includes(user.role)) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-sm text-muted">
          {lang === 'sw' ? 'Huna ruhusa ya ukurasa huu.' : 'You dont have access to this page.'}
        </p>
      </div>
    );
  }

  return (
    <div className="pb-8">
     <PageHeader
  breadcrumb={null}
  title={lang === 'sw' ? 'Mhariri wa Maudhui' : 'Content Editor'}
  subtitle={lang === 'sw' ? 'Simamia kurasa ya umma na hadithi' : 'Manage the public landing page and stories'}
  action={null}
/>

      {/* Main tabs */}
      <div className="flex gap-0 border-b border-hairline bg-canvas sticky top-0 z-10">
        {(['landing', 'stories'] as const).map(t_ => (
          <button
            key={t_}
            onClick={() => setTab(t_)}
            className={`px-6 py-3.5 text-sm font-medium border-b-2 transition-colors
              ${tab === t_
                ? 'border-blue-600 text-blue-400'
                : 'border-transparent text-muted hover:text-ink'}`}
          >
            {t_ === 'landing'
              ? (lang === 'sw' ? 'Kurasa Kuu' : 'Landing Page')
              : (lang === 'sw' ? 'Hadithi' : 'Stories')}
          </button>
        ))}
      </div>

      {tab === 'landing' ? (
        <div className="flex min-h-[500px]">
          {/* Section sidebar */}
          <nav className="w-52 flex-shrink-0 border-r border-hairline py-3 flex flex-col gap-0.5">
            {SECTIONS.map(s => (
              <button
                key={s}
                onClick={() => setSection(s)}
                className={`w-full text-left px-5 py-2.5 text-sm transition-colors rounded-none
                  ${section === s
                    ? 'bg-blue-600/10 text-blue-400 font-medium border-r-2 border-blue-600'
                    : 'text-muted hover:text-ink hover:bg-surface/60'}`}
              >
                {SECTION_LABELS[s][lang === 'sw' ? 'sw' : 'en']}
              </button>
            ))}
          </nav>

          {/* Editor */}
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