'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useTranslation } from '../../../lib/i18n';
import { getAuth } from '../../../lib/auth';
import CloudinaryService from '../../../lib/cloudinary';
import PageHeader from '../../../components/ui/PageHeader';

// ─── API helpers ─────────────────────────────────────────────────────────────

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

async function apiFetch(path, opts = {}) {
  const { token } = getAuth();
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...opts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FIELD_TYPES = [
  { value: 'text',     label: 'Short text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'number',   label: 'Number' },
  { value: 'date',     label: 'Date' },
  { value: 'select',   label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkbox' },
];

const EMPTY_FIELD = () => ({
  id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  label_en: '', label_sw: '',
  type: 'text', required: false, options: '',
});

const EMPTY_TEMPLATE = {
  title_en: '', title_sw: '',
  description_en: '', description_sw: '',
  scope: 'church', group_id: null, fields: [],
};

const EMPTY_UPLOAD = {
  title_en: '', title_sw: '',
  description_en: '', description_sw: '',
  scope: 'church', group_id: null,
};

// ─── FieldRow (template builder) ─────────────────────────────────────────────

function FieldRow({ field, index, onChange, onRemove, totalFields }) {
  return (
    <div className="card mb-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Field {index + 1}</span>
        {totalFields > 1 && (
          <button onClick={() => onRemove(field.id)} className="btn-ghost text-danger px-2 py-1">Remove</button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="field-label">Label (English)</label>
          <input className="field-input" value={field.label_en} onChange={e => onChange(field.id, 'label_en', e.target.value)} placeholder="e.g. Full Name" />
        </div>
        <div>
          <label className="field-label">Label (Swahili)</label>
          <input className="field-input" value={field.label_sw} onChange={e => onChange(field.id, 'label_sw', e.target.value)} placeholder="e.g. Jina Kamili" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 items-end">
        <div>
          <label className="field-label">Type</label>
          <select className="field-input" value={field.type} onChange={e => onChange(field.id, 'type', e.target.value)}>
            {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 cursor-pointer pb-2.5">
          <input type="checkbox" checked={field.required} onChange={e => onChange(field.id, 'required', e.target.checked)} className="w-3.5 h-3.5 accent-ink" />
          <span className="text-sm text-ink-muted">Required</span>
        </label>
      </div>
      {field.type === 'select' && (
        <div className="mt-3">
          <label className="field-label">Options (comma-separated)</label>
          <input className="field-input" value={field.options} onChange={e => onChange(field.id, 'options', e.target.value)} placeholder="Option A, Option B, Option C" />
        </div>
      )}
    </div>
  );
}

// ─── TemplateCard ─────────────────────────────────────────────────────────────

function TemplateCard({ tpl, lang, onEdit, onDelete, canEdit, onDownload }) {
  const [dlOpen, setDlOpen] = useState(false);
  return (
    <div className="py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-ink text-sm leading-snug">{lang === 'sw' ? tpl.title_sw : tpl.title_en}</p>
          {(tpl.description_en || tpl.description_sw) && (
            <p className="text-sm text-ink-muted mt-1 leading-relaxed line-clamp-2">{lang === 'sw' ? tpl.description_sw : tpl.description_en}</p>
          )}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="text-xs text-ink-faint">{tpl.fields?.length || 0} fields</span>
            <span className="text-ink-faint text-xs">·</span>
            <span className={`text-xs font-medium ${tpl.scope === 'church' ? 'text-ink-muted' : 'text-ink-faint'}`}>
              {tpl.scope === 'church' ? 'Church-wide' : tpl.group_name || 'Group'}
            </span>
            <span className="text-ink-faint text-xs">·</span>
            <span className="text-xs text-ink-faint">by {tpl.author_name}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <div className="relative">
            <button className="btn-ghost" onClick={() => setDlOpen(o => !o)}>Download ▾</button>
            {dlOpen && (
              <div className="absolute right-0 top-full mt-1 bg-canvas border border-hairline rounded-md shadow z-10 min-w-[140px]">
                <button className="block w-full text-left px-4 py-2.5 text-sm hover:bg-surface transition-colors" onClick={() => { onDownload(tpl, 'pdf'); setDlOpen(false); }}>Download PDF</button>
                <div className="hairline" />
                <button className="block w-full text-left px-4 py-2.5 text-sm hover:bg-surface transition-colors" onClick={() => { onDownload(tpl, 'xlsx'); setDlOpen(false); }}>Download Excel</button>
              </div>
            )}
          </div>
          {canEdit && (
            <>
              <button className="btn-ghost" onClick={() => onEdit(tpl)}>Edit</button>
              <button className="btn-ghost text-danger" onClick={() => onDelete(tpl.id)}>Delete</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── UploadedFormCard ─────────────────────────────────────────────────────────

function UploadedFormCard({ form, lang, canEdit, onEdit, onDelete }) {
  return (
    <div className="py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* PDF icon + title */}
          <div className="flex items-center gap-2">
            <span className="text-base leading-none">📄</span>
            <p className="font-semibold text-ink text-sm leading-snug">{lang === 'sw' ? form.title_sw : form.title_en}</p>
          </div>
          {(form.description_en || form.description_sw) && (
            <p className="text-sm text-ink-muted mt-1 leading-relaxed line-clamp-2 ml-6">{lang === 'sw' ? form.description_sw : form.description_en}</p>
          )}
          <div className="flex items-center gap-3 mt-2 flex-wrap ml-6">
            <span className={`text-xs font-medium ${form.scope === 'church' ? 'text-ink-muted' : 'text-ink-faint'}`}>
              {form.scope === 'church' ? 'Church-wide' : form.group_name || 'Group'}
            </span>
            <span className="text-ink-faint text-xs">·</span>
            <span className="text-xs text-ink-faint">by {form.author_name}</span>
            <span className="text-ink-faint text-xs">·</span>
            <span className="text-xs text-ink-faint">{new Date(form.created_at).toLocaleDateString()}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Primary: download PDF */}
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={async () => {
              const filename = `${(lang === 'sw' ? form.title_sw : form.title_en).replace(/\s+/g, '_')}.pdf`;
              const res = await fetch(form.pdf_url);
              const blob = await res.blob();
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = filename;
              a.click();
              URL.revokeObjectURL(a.href);
            }}
          >
            Download PDF
          </button>

          {canEdit && (
            <>
              <button className="btn-ghost" onClick={() => onEdit(form)}>Edit</button>
              <button className="btn-ghost text-danger" onClick={() => onDelete(form.id)}>Delete</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── PDF Upload dropzone ──────────────────────────────────────────────────────

function PdfDropzone({ file, onFile, uploading, uploadProgress, uploadedUrl, sw }) {
  const fileRef = useRef(null);

  function handleChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type !== 'application/pdf') {
      alert(sw ? 'Tafadhali chagua faili la PDF.' : 'Please select a PDF file.');
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      alert(sw ? 'Faili ni kubwa sana. Hadi 20 MB tu.' : 'File too large. Maximum 20 MB.');
      return;
    }
    onFile(f);
  }

  function handleDrop(e) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  }

  return (
    <div>
      <label className="field-label">{sw ? 'Faili la PDF *' : 'PDF File *'}</label>
      <div
        onClick={() => !uploading && fileRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${uploadedUrl ? '#166534' : '#DDD8CE'}`,
          borderRadius: 10,
          background: uploadedUrl ? '#F0FDF4' : '#FAFAF9',
          padding: '24px 16px',
          textAlign: 'center',
          cursor: uploading ? 'not-allowed' : 'pointer',
          transition: 'border-color 0.2s, background 0.2s',
        }}
      >
        {uploading ? (
          <div>
            <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
            <p className="text-sm text-ink-muted mb-2">{sw ? 'Inapakia...' : 'Uploading…'} {uploadProgress}%</p>
            {/* Progress bar */}
            <div className="progress-track mx-auto" style={{ maxWidth: 200 }}>
              <div className="progress-fill" style={{ width: `${uploadProgress}%`, transition: 'width 0.3s' }} />
            </div>
          </div>
        ) : uploadedUrl ? (
          <div>
            <div style={{ fontSize: 28, marginBottom: 6 }}>✅</div>
            <p className="text-sm font-semibold text-green-700 mb-1">
              {file?.name || (sw ? 'Faili limepakiwa' : 'File uploaded')}
            </p>
            <p className="text-xs text-ink-faint">{sw ? 'Bonyeza kubadilisha' : 'Click to replace'}</p>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
            <p className="text-sm font-semibold text-ink mb-1">{sw ? 'Bonyeza au buruta PDF hapa' : 'Click or drag PDF here'}</p>
            <p className="text-xs text-ink-faint">{sw ? 'PDF pekee · Hadi 20 MB' : 'PDF only · Up to 20 MB'}</p>
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={handleChange} />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FormsPage() {
  const { user, lang } = useAuth();
  const { t } = useTranslation(lang);
  const canEdit = user.role === 'pastor' || user.role === 'elder';

  // ── Tab ──────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('templates'); // 'templates' | 'uploads'

  // ── Shared ───────────────────────────────────────────────────────────────
  const [groups, setGroups]   = useState([]);
  const [toast, setToast]     = useState(null);

  // ── Template state ────────────────────────────────────────────────────────
  const [templates, setTemplates]       = useState([]);
  const [tplLoading, setTplLoading]     = useState(true);
  const [showBuilder, setShowBuilder]   = useState(false);
  const [editTarget, setEditTarget]     = useState(null);
  const [tplForm, setTplForm]           = useState(EMPTY_TEMPLATE);
  const [saving, setSaving]             = useState(false);

  // ── Uploaded forms state ──────────────────────────────────────────────────
  const [uploads, setUploads]           = useState([]);
  const [uplLoading, setUplLoading]     = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editUploadTarget, setEditUploadTarget] = useState(null);
  const [uplForm, setUplForm]           = useState(EMPTY_UPLOAD);
  const [pdfFile, setPdfFile]           = useState(null);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [pdfProgress, setPdfProgress]   = useState(0);
  const [pdfUrl, setPdfUrl]             = useState('');
  const [pdfPublicId, setPdfPublicId]   = useState('');
  const [uplSaving, setUplSaving]       = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadTemplates = useCallback(async () => {
    setTplLoading(true);
    try {
      const res = await apiFetch('/form-templates');
      setTemplates(res.data);
    } catch { showToast('Failed to load templates', 'error'); }
    finally { setTplLoading(false); }
  }, []);

  const loadUploads = useCallback(async () => {
    setUplLoading(true);
    try {
      const res = await apiFetch('/uploaded-forms');
      setUploads(res.data);
    } catch { showToast('Failed to load uploaded forms', 'error'); }
    finally { setUplLoading(false); }
  }, []);

  useEffect(() => { loadTemplates(); loadUploads(); }, [loadTemplates, loadUploads]);

  useEffect(() => {
    if (!canEdit) return;
    apiFetch('/groups').then(r => setGroups(r.data || [])).catch(() => {});
  }, [canEdit]);

  // ── Toast ─────────────────────────────────────────────────────────────────

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  // ── Template builder helpers ───────────────────────────────────────────────

  function openCreate() {
    setEditTarget(null);
    setTplForm({ ...EMPTY_TEMPLATE, fields: [EMPTY_FIELD()] });
    setShowBuilder(true);
  }

  function openEditTemplate(tpl) {
    setEditTarget(tpl.id);
    setTplForm({
      title_en: tpl.title_en, title_sw: tpl.title_sw,
      description_en: tpl.description_en || '',
      description_sw: tpl.description_sw || '',
      scope: tpl.scope, group_id: tpl.group_id,
      fields: tpl.fields.map(f => ({
        ...f,
        options: Array.isArray(f.options) ? f.options.join(', ') : f.options || '',
      })),
    });
    setShowBuilder(true);
  }

  function updateField(id, key, val) {
    setTplForm(f => ({ ...f, fields: f.fields.map(fld => fld.id === id ? { ...fld, [key]: val } : fld) }));
  }
  function removeField(id) {
    setTplForm(f => ({ ...f, fields: f.fields.filter(fld => fld.id !== id) }));
  }
  function addField() {
    setTplForm(f => ({ ...f, fields: [...f.fields, EMPTY_FIELD()] }));
  }

  async function handleSaveTemplate() {
    setSaving(true);
    try {
      const fields = tplForm.fields.map(f => ({
        ...f,
        options: f.type === 'select' ? f.options.split(',').map(o => o.trim()).filter(Boolean) : undefined,
      }));
      const payload = { ...tplForm, fields };
      if (editTarget) {
        await apiFetch(`/form-templates/${editTarget}`, { method: 'PUT', body: JSON.stringify(payload) });
        showToast('Template updated');
      } else {
        await apiFetch('/form-templates', { method: 'POST', body: JSON.stringify(payload) });
        showToast('Template created');
      }
      setShowBuilder(false);
      loadTemplates();
    } catch (err) { showToast(err.message, 'error'); }
    finally { setSaving(false); }
  }

  async function handleDeleteTemplate(id) {
    if (!confirm('Delete this template?')) return;
    try {
      await apiFetch(`/form-templates/${id}`, { method: 'DELETE' });
      showToast('Template deleted');
      loadTemplates();
    } catch (err) { showToast(err.message, 'error'); }
  }

  // ── Upload modal helpers ───────────────────────────────────────────────────

  function openUploadCreate() {
    setEditUploadTarget(null);
    setUplForm(EMPTY_UPLOAD);
    setPdfFile(null); setPdfUrl(''); setPdfPublicId(''); setPdfProgress(0);
    setShowUploadModal(true);
  }

  function openEditUpload(form) {
    setEditUploadTarget(form.id);
    setUplForm({
      title_en: form.title_en, title_sw: form.title_sw,
      description_en: form.description_en || '',
      description_sw: form.description_sw || '',
      scope: form.scope, group_id: form.group_id,
    });
    // Keep existing pdf_url/public_id — user may or may not replace the file
    setPdfFile(null); setPdfUrl(form.pdf_url); setPdfPublicId(form.public_id); setPdfProgress(0);
    setShowUploadModal(true);
  }

  async function handlePdfFile(file) {
    setPdfFile(file);
    setPdfUploading(true);
    setPdfProgress(0);
    try {
      const result = await CloudinaryService.uploadFromFile({
        file,
        folder: 'church_portal/uploaded_forms',
        onProgress: pct => setPdfProgress(pct),
      });
      setPdfUrl(result.secureUrl);
      setPdfPublicId(result.publicId);
    } catch (err) {
      showToast('PDF upload failed: ' + err.message, 'error');
      setPdfFile(null); setPdfUrl(''); setPdfPublicId('');
    } finally {
      setPdfUploading(false);
    }
  }

  async function handleSaveUpload() {
    if (!pdfUrl || !pdfPublicId) {
      showToast('Please upload a PDF first.', 'error');
      return;
    }
    if (!uplForm.title_en.trim() || !uplForm.title_sw.trim()) {
      showToast('Both English and Swahili titles are required.', 'error');
      return;
    }
    setUplSaving(true);
    try {
      const payload = { ...uplForm, pdf_url: pdfUrl, public_id: pdfPublicId };
      if (editUploadTarget) {
        await apiFetch(`/uploaded-forms/${editUploadTarget}`, { method: 'PUT', body: JSON.stringify(payload) });
        showToast('Form updated');
      } else {
        await apiFetch('/uploaded-forms', { method: 'POST', body: JSON.stringify(payload) });
        showToast('Form uploaded');
      }
      setShowUploadModal(false);
      loadUploads();
    } catch (err) { showToast(err.message, 'error'); }
    finally { setUplSaving(false); }
  }

  async function handleDeleteUpload(id) {
    if (!confirm('Delete this form?')) return;
    try {
      await apiFetch(`/uploaded-forms/${id}`, { method: 'DELETE' });
      showToast('Form deleted');
      loadUploads();
    } catch (err) { showToast(err.message, 'error'); }
  }

  // ── Download helpers (templates only) ─────────────────────────────────────

  async function handleDownload(tpl, format) {
    try {
      if (format === 'pdf') await downloadAsPdf(tpl, lang);
      else await downloadAsXlsx(tpl, lang);
    } catch (err) { showToast('Download failed: ' + err.message, 'error'); }
  }

  // ── Shared scope selector ─────────────────────────────────────────────────

  function ScopeFields({ form, setForm }) {
    return (
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label">Scope</label>
          <select className="field-input" value={form.scope}
            onChange={e => setForm(f => ({ ...f, scope: e.target.value, group_id: null }))}>
            <option value="church">Church-wide</option>
            <option value="group">Specific Group</option>
          </select>
        </div>
        {form.scope === 'group' && (
          <div>
            <label className="field-label">Group</label>
            <select className="field-input" value={form.group_id || ''}
              onChange={e => setForm(f => ({ ...f, group_id: e.target.value || null }))}>
              <option value="">— Select group —</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        )}
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        breadcrumb={lang === 'sw' ? 'Fomu/Documents' : 'Forms'}
        title={lang === 'sw' ? 'Fomu na Documents za Kanisa' : 'Church Documents & Forms'}
        subtitle={lang === 'sw' ? 'Pakua na ujaze fomu' : 'Download and fill church forms'}
        action={canEdit ? (
          <div className="flex gap-2">
            {activeTab === 'templates' && (
              <button className="btn-primary" onClick={openCreate}>+ New Template</button>
            )}
            {activeTab === 'uploads' && (
              <button className="btn-primary" onClick={openUploadCreate}>+ Upload PDF</button>
            )}
          </div>
        ) : null}
      />

      <div className="px-8 py-8 max-w-content">

        {/* ── Tabs ── */}
        <div className="flex gap-0 mb-6 border-b border-hairline">
          {[
            { key: 'templates', label: lang === 'sw' ? 'Fomu za Ujenzi' : 'Form Builder' },
            { key: 'uploads',   label: lang === 'sw' ? 'PDF Zilizopakiwa' : 'Uploaded PDFs' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors duration-100 -mb-px ${
                activeTab === tab.key
                  ? 'border-navy text-navy'
                  : 'border-transparent text-ink-muted hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════
            TAB: Form Builder templates
        ══════════════════════════════════════════════════════════ */}
        {activeTab === 'templates' && (
          <>
            {/* Template builder modal */}
            {showBuilder && (
              <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowBuilder(false)}>
                <div className="modal-panel max-w-2xl w-full max-h-[90vh] flex flex-col">
                  <div className="modal-header">
                    <h2 className="font-semibold text-ink text-base">{editTarget ? 'Edit Template' : 'New Form Template'}</h2>
                    <button className="btn-ghost px-2" onClick={() => setShowBuilder(false)}>✕</button>
                  </div>
                  <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="field-label">Title (English) *</label>
                        <input className="field-input" value={tplForm.title_en} onChange={e => setTplForm(f => ({ ...f, title_en: e.target.value }))} placeholder="e.g. Membership Registration Form" />
                      </div>
                      <div>
                        <label className="field-label">Title (Swahili) *</label>
                        <input className="field-input" value={tplForm.title_sw} onChange={e => setTplForm(f => ({ ...f, title_sw: e.target.value }))} placeholder="e.g. Fomu ya Usajili" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="field-label">Description (English)</label>
                        <textarea className="field-input resize-none" rows={2} value={tplForm.description_en} onChange={e => setTplForm(f => ({ ...f, description_en: e.target.value }))} placeholder="Optional description" />
                      </div>
                      <div>
                        <label className="field-label">Description (Swahili)</label>
                        <textarea className="field-input resize-none" rows={2} value={tplForm.description_sw} onChange={e => setTplForm(f => ({ ...f, description_sw: e.target.value }))} placeholder="Maelezo ya hiari" />
                      </div>
                    </div>
                    <ScopeFields form={tplForm} setForm={setTplForm} />
                    <div>
                      <p className="section-label mb-3">Form Fields</p>
                      {tplForm.fields.map((field, i) => (
                        <FieldRow key={field.id} field={field} index={i} onChange={updateField} onRemove={removeField} totalFields={tplForm.fields.length} />
                      ))}
                      <button className="btn-secondary w-full mt-1" onClick={addField}>+ Add Field</button>
                    </div>
                  </div>
                  <div className="px-6 py-4 border-t border-hairline flex justify-end gap-2">
                    <button className="btn-secondary" onClick={() => setShowBuilder(false)}>Cancel</button>
                    <button className="btn-primary" onClick={handleSaveTemplate} disabled={saving}>
                      {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Create Template'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Template list */}
            {tplLoading ? (
              <div className="py-12 flex justify-center">
                <span className="w-5 h-5 border-2 border-border border-t-ink-muted rounded-full animate-spin" />
              </div>
            ) : templates.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-ink-muted text-sm">
                  {canEdit ? 'No form templates yet. Create one to get started.' : 'No forms are available right now.'}
                </p>
              </div>
            ) : (
              <div className="space-y-0">
                {templates.map((tpl, i) => (
                  <div key={tpl.id} className={`animate-slide-up stagger-${Math.min(i + 1, 6)}`}>
                    <TemplateCard
                      tpl={tpl} lang={lang}
                      canEdit={canEdit && (user.role === 'pastor' || tpl.created_by === user.id)}
                      onEdit={openEditTemplate}
                      onDelete={handleDeleteTemplate}
                      onDownload={handleDownload}
                    />
                    {i < templates.length - 1 && <div className="hairline" />}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════
            TAB: Uploaded PDFs
        ══════════════════════════════════════════════════════════ */}
        {activeTab === 'uploads' && (
          <>
            {/* Upload modal */}
            {showUploadModal && (
              <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowUploadModal(false)}>
                <div className="modal-panel max-w-xl w-full max-h-[90vh] flex flex-col">
                  <div className="modal-header">
                    <h2 className="font-semibold text-ink text-base">
                      {editUploadTarget ? 'Edit Uploaded Form' : 'Upload PDF Form'}
                    </h2>
                    <button className="btn-ghost px-2" onClick={() => setShowUploadModal(false)}>✕</button>
                  </div>

                  <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

                    {/* PDF dropzone */}
                    <PdfDropzone
                      file={pdfFile}
                      onFile={handlePdfFile}
                      uploading={pdfUploading}
                      uploadProgress={pdfProgress}
                      uploadedUrl={pdfUrl}
                      sw={lang === 'sw'}
                    />

                    {/* Titles */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="field-label">Title (English) *</label>
                        <input className="field-input" value={uplForm.title_en} onChange={e => setUplForm(f => ({ ...f, title_en: e.target.value }))} placeholder="e.g. Baptism Application" />
                      </div>
                      <div>
                        <label className="field-label">Title (Swahili) *</label>
                        <input className="field-input" value={uplForm.title_sw} onChange={e => setUplForm(f => ({ ...f, title_sw: e.target.value }))} placeholder="e.g. Fomu ya Ubatizo" />
                      </div>
                    </div>

                    {/* Descriptions */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="field-label">Description (English)</label>
                        <textarea className="field-input resize-none" rows={2} value={uplForm.description_en} onChange={e => setUplForm(f => ({ ...f, description_en: e.target.value }))} placeholder="Optional description" />
                      </div>
                      <div>
                        <label className="field-label">Description (Swahili)</label>
                        <textarea className="field-input resize-none" rows={2} value={uplForm.description_sw} onChange={e => setUplForm(f => ({ ...f, description_sw: e.target.value }))} placeholder="Maelezo ya hiari" />
                      </div>
                    </div>

                    <ScopeFields form={uplForm} setForm={setUplForm} />
                  </div>

                  <div className="px-6 py-4 border-t border-hairline flex justify-end gap-2">
                    <button className="btn-secondary" onClick={() => setShowUploadModal(false)}>Cancel</button>
                    <button
                      className="btn-primary"
                      onClick={handleSaveUpload}
                      disabled={uplSaving || pdfUploading || !pdfUrl}
                    >
                      {uplSaving ? 'Saving…' : pdfUploading ? 'Uploading PDF…' : editUploadTarget ? 'Save Changes' : 'Save Form'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Uploads list */}
            {uplLoading ? (
              <div className="py-12 flex justify-center">
                <span className="w-5 h-5 border-2 border-border border-t-ink-muted rounded-full animate-spin" />
              </div>
            ) : uploads.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-ink-muted text-sm">
                  {canEdit ? 'No PDFs uploaded yet. Upload one to get started.' : 'No forms are available right now.'}
                </p>
              </div>
            ) : (
              <div className="space-y-0">
                {uploads.map((form, i) => (
                  <div key={form.id} className={`animate-slide-up stagger-${Math.min(i + 1, 6)}`}>
                    <UploadedFormCard
                      form={form} lang={lang}
                      canEdit={canEdit && (user.role === 'pastor' || form.created_by === user.id)}
                      onEdit={openEditUpload}
                      onDelete={handleDeleteUpload}
                    />
                    {i < uploads.length - 1 && <div className="hairline" />}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.type === 'error' ? 'bg-danger text-white' : 'bg-ink text-white'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ─── PDF / XLSX download helpers (unchanged) ──────────────────────────────────

async function buildPdfDoc(tpl, lang) {
  const { jsPDF } = await import('jspdf');
  const title  = lang === 'sw' ? tpl.title_sw  : tpl.title_en;
  const desc   = lang === 'sw' ? tpl.description_sw : tpl.description_en;
  const fields = tpl.fields || [];
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = 210, margin = 20, contentW = pageW - margin * 2;
  let y = 25;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(28, 25, 23);
  doc.text(title, margin, y); y += 8;

  if (desc) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(120, 113, 108);
    const descLines = doc.splitTextToSize(desc, contentW);
    doc.text(descLines, margin, y); y += descLines.length * 5 + 4;
  }

  doc.setDrawColor(231, 229, 224); doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y); y += 8;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(168, 162, 158);
  doc.text('Church Portal  ·  ' + new Date().toLocaleDateString(), margin, y); y += 10;

  for (const field of fields) {
    const label = (lang === 'sw' ? field.label_sw : field.label_en) || field.label_en;
    if (y > 265) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(120, 113, 108);
    doc.text((label + (field.required ? ' *' : '')).toUpperCase(), margin, y); y += 5;
    if (field.type === 'textarea') {
      doc.setDrawColor(214, 211, 206); doc.setLineWidth(0.4); doc.rect(margin, y, contentW, 22); y += 26;
    } else if (field.type === 'checkbox') {
      doc.setDrawColor(214, 211, 206); doc.setLineWidth(0.4); doc.rect(margin, y, 5, 5);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(28, 25, 23);
      doc.text(label, margin + 7, y + 3.5); y += 10;
    } else if (field.type === 'select' && Array.isArray(field.options) && field.options.length) {
      for (const opt of field.options) {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.setDrawColor(214, 211, 206); doc.setLineWidth(0.4); doc.rect(margin, y, 4, 4);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(28, 25, 23);
        doc.text(opt, margin + 6, y + 3); y += 7;
      }
      y += 2;
    } else {
      doc.setDrawColor(214, 211, 206); doc.setLineWidth(0.4);
      doc.line(margin, y + 7, margin + contentW, y + 7); y += 12;
    }
    y += 3;
  }

  if (y < 260) {
    y += 10;
    doc.setDrawColor(214, 211, 206); doc.setLineWidth(0.4);
    doc.line(margin, y, margin + 60, y); doc.line(margin + 80, y, margin + 140, y);
    y += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(168, 162, 158);
    doc.text('Signature', margin, y); doc.text('Date', margin + 80, y);
  }

  return { doc, title };
}

async function downloadAsPdf(tpl, lang) {
  const { doc, title } = await buildPdfDoc(tpl, lang);
  doc.save(`${title.replace(/\s+/g, '_')}.pdf`);
}

async function downloadAsXlsx(tpl, lang) {
  const XLSX = await import('xlsx');
  const title  = lang === 'sw' ? tpl.title_sw  : tpl.title_en;
  const desc   = lang === 'sw' ? tpl.description_sw : tpl.description_en;
  const fields = tpl.fields || [];
  const rows = [[title], []];
  if (desc) { rows.push([desc]); rows.push([]); }
  rows.push(['Generated:', new Date().toLocaleDateString()], [], ['Field', 'Answer'], ['']);
  for (const field of fields) {
    const label = (lang === 'sw' ? field.label_sw : field.label_en) || field.label_en;
    const req   = field.required ? ' *' : '';
    if (field.type === 'select' && Array.isArray(field.options) && field.options.length) {
      rows.push([`${label}${req}`, '— select one:']);
      field.options.forEach(opt => rows.push([`  ☐ ${opt}`, '']));
      rows.push(['']);
    } else if (field.type === 'checkbox') {
      rows.push([`☐  ${label}${req}`, '']);
    } else {
      rows.push([`${label}${req}`, '']);
    }
  }
  rows.push([''], ['Signature:', '', 'Date:', '']);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 40 }, { wch: 50 }, { wch: 12 }, { wch: 30 }];
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31));
  XLSX.writeFile(wb, `${title.replace(/\s+/g, '_')}.xlsx`);
}