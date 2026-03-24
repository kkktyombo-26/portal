'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useTranslation } from '../../../lib/i18n';
import { getAuth } from '../../../lib/auth';
import PageHeader from '../../../components/ui/PageHeader';

// ─── API helpers ────────────────────────────────────────────────────────────

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

// ─── Constants ──────────────────────────────────────────────────────────────

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
  label_en: '',
  label_sw: '',
  type: 'text',
  required: false,
  options: '',          // comma-separated, for select type
});

const EMPTY_TEMPLATE = {
  title_en: '', title_sw: '',
  description_en: '', description_sw: '',
  scope: 'church', group_id: null,
  fields: [],
};

// ─── Sub-components ─────────────────────────────────────────────────────────

function FieldRow({ field, index, onChange, onRemove, totalFields }) {
  return (
    <div className="card mb-3 relative">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
          Field {index + 1}
        </span>
        {totalFields > 1 && (
          <button onClick={() => onRemove(field.id)} className="btn-ghost text-danger px-2 py-1">
            Remove
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="field-label">Label (English)</label>
          <input
            className="field-input"
            value={field.label_en}
            onChange={e => onChange(field.id, 'label_en', e.target.value)}
            placeholder="e.g. Full Name"
          />
        </div>
        <div>
          <label className="field-label">Label (Swahili)</label>
          <input
            className="field-input"
            value={field.label_sw}
            onChange={e => onChange(field.id, 'label_sw', e.target.value)}
            placeholder="e.g. Jina Kamili"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 items-end">
        <div>
          <label className="field-label">Type</label>
          <select
            className="field-input"
            value={field.type}
            onChange={e => onChange(field.id, 'type', e.target.value)}
          >
            {FIELD_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 cursor-pointer pb-2.5">
          <input
            type="checkbox"
            checked={field.required}
            onChange={e => onChange(field.id, 'required', e.target.checked)}
            className="w-3.5 h-3.5 accent-ink"
          />
          <span className="text-sm text-ink-muted">Required</span>
        </label>
      </div>

      {field.type === 'select' && (
        <div className="mt-3">
          <label className="field-label">Options (comma-separated)</label>
          <input
            className="field-input"
            value={field.options}
            onChange={e => onChange(field.id, 'options', e.target.value)}
            placeholder="Option A, Option B, Option C"
          />
        </div>
      )}
    </div>
  );
}

function TemplateCard({ tpl, lang, onEdit, onDelete, canEdit, onDownload }) {
  const [dlOpen, setDlOpen] = useState(false);

  return (
    <div className="py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-ink text-sm leading-snug">
            {lang === 'sw' ? tpl.title_sw : tpl.title_en}
          </p>
          {(tpl.description_en || tpl.description_sw) && (
            <p className="text-sm text-ink-muted mt-1 leading-relaxed line-clamp-2">
              {lang === 'sw' ? tpl.description_sw : tpl.description_en}
            </p>
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
          {/* Download dropdown */}
          <div className="relative">
            <button className="btn-ghost" onClick={() => setDlOpen(o => !o)}>
              Download ▾
            </button>
            {dlOpen && (
              <div className="absolute right-0 top-full mt-1 bg-canvas border border-hairline rounded-md shadow z-10 min-w-[130px]">
                <button
                  className="block w-full text-left px-4 py-2.5 text-sm hover:bg-surface transition-colors"
                  onClick={() => { onDownload(tpl, 'pdf'); setDlOpen(false); }}
                >
                  Download PDF
                </button>
                <div className="hairline" />
                <button
                  className="block w-full text-left px-4 py-2.5 text-sm hover:bg-surface transition-colors"
                  onClick={() => { onDownload(tpl, 'xlsx'); setDlOpen(false); }}
                >
                  Download Excel
                </button>
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

// ─── Main page ───────────────────────────────────────────────────────────────

export default function FormsPage() {
  const { user, lang } = useAuth();
  const { t } = useTranslation(lang);
  const canEdit = user.role === 'pastor' || user.role === 'elder';

  const [templates, setTemplates]   = useState([]);
  const [groups, setGroups]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editTarget, setEditTarget]   = useState(null);   // null = create mode
  const [form, setForm]               = useState(EMPTY_TEMPLATE);
  const [saving, setSaving]           = useState(false);
  const [toast, setToast]             = useState(null);
  const [dlLoading, setDlLoading]     = useState(null);   // template id being downloaded

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/form-templates');
      setTemplates(res.data);
    } catch {
      showToast('Failed to load templates', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  useEffect(() => {
    if (!canEdit) return;
    apiFetch('/groups').then(r => setGroups(r.data || [])).catch(() => {});
  }, [canEdit]);

  // ── Toast ─────────────────────────────────────────────────────────────────

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  // ── Builder helpers ────────────────────────────────────────────────────────

  function openCreate() {
    setEditTarget(null);
    setForm({ ...EMPTY_TEMPLATE, fields: [EMPTY_FIELD()] });
    setShowBuilder(true);
  }

  function openEdit(tpl) {
    setEditTarget(tpl.id);
    setForm({
      title_en: tpl.title_en,
      title_sw: tpl.title_sw,
      description_en: tpl.description_en || '',
      description_sw: tpl.description_sw || '',
      scope: tpl.scope,
      group_id: tpl.group_id,
      fields: tpl.fields.map(f => ({ ...f, options: Array.isArray(f.options) ? f.options.join(', ') : f.options || '' })),
    });
    setShowBuilder(true);
  }

  function updateField(id, key, val) {
    setForm(f => ({ ...f, fields: f.fields.map(fld => fld.id === id ? { ...fld, [key]: val } : fld) }));
  }

  function removeField(id) {
    setForm(f => ({ ...f, fields: f.fields.filter(fld => fld.id !== id) }));
  }

  function addField() {
    setForm(f => ({ ...f, fields: [...f.fields, EMPTY_FIELD()] }));
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true);
    try {
      // Normalise options string → array for select fields
      const fields = form.fields.map(f => ({
        ...f,
        options: f.type === 'select'
          ? f.options.split(',').map(o => o.trim()).filter(Boolean)
          : undefined,
      }));

      const payload = { ...form, fields };

      if (editTarget) {
        await apiFetch(`/form-templates/${editTarget}`, { method: 'PUT', body: JSON.stringify(payload) });
        showToast('Template updated');
      } else {
        await apiFetch('/form-templates', { method: 'POST', body: JSON.stringify(payload) });
        showToast('Template created');
      }

      setShowBuilder(false);
      loadTemplates();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete(id) {
    if (!confirm('Delete this template?')) return;
    try {
      await apiFetch(`/form-templates/${id}`, { method: 'DELETE' });
      showToast('Template deleted');
      loadTemplates();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // ── Download ──────────────────────────────────────────────────────────────

  async function handleDownload(tpl, format) {
    setDlLoading(`${tpl.id}-${format}`);
    try {
      if (format === 'pdf') {
        await downloadAsPdf(tpl, lang);
      } else {
        await downloadAsXlsx(tpl, lang);
      }
    } catch (err) {
      showToast('Download failed: ' + err.message, 'error');
    } finally {
      setDlLoading(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        breadcrumb={lang === 'sw' ? 'Fomu' : 'Forms'}
        title={lang === 'sw' ? 'Fomu za Kanisa' : 'Church Forms'}
        subtitle={lang === 'sw' ? 'Pakua na ujaze fomu' : 'Download and fill church forms'}
        action={canEdit ? (
          <button className="btn-primary" onClick={openCreate}>
            + New Template
          </button>
        ) : null}
      />

      <div className="px-8 py-8 max-w-content">

        {/* ── Template builder modal ── */}
        {showBuilder && (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowBuilder(false)}>
            <div className="modal-panel max-w-2xl w-full max-h-[90vh] flex flex-col">
              <div className="modal-header">
                <h2 className="font-semibold text-ink text-base">
                  {editTarget ? 'Edit Template' : 'New Form Template'}
                </h2>
                <button className="btn-ghost px-2" onClick={() => setShowBuilder(false)}>✕</button>
              </div>

              <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

                {/* Titles */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="field-label">Title (English) *</label>
                    <input className="field-input" value={form.title_en}
                      onChange={e => setForm(f => ({ ...f, title_en: e.target.value }))}
                      placeholder="e.g. Membership Registration Form" />
                  </div>
                  <div>
                    <label className="field-label">Title (Swahili) *</label>
                    <input className="field-input" value={form.title_sw}
                      onChange={e => setForm(f => ({ ...f, title_sw: e.target.value }))}
                      placeholder="e.g. Fomu ya Usajili" />
                  </div>
                </div>

                {/* Descriptions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="field-label">Description (English)</label>
                    <textarea className="field-input resize-none" rows={2} value={form.description_en}
                      onChange={e => setForm(f => ({ ...f, description_en: e.target.value }))}
                      placeholder="Optional description" />
                  </div>
                  <div>
                    <label className="field-label">Description (Swahili)</label>
                    <textarea className="field-input resize-none" rows={2} value={form.description_sw}
                      onChange={e => setForm(f => ({ ...f, description_sw: e.target.value }))}
                      placeholder="Maelezo ya hiari" />
                  </div>
                </div>

                {/* Scope */}
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

                {/* Fields */}
                <div>
                  <p className="section-label mb-3">Form Fields</p>
                  {form.fields.map((field, i) => (
                    <FieldRow
                      key={field.id}
                      field={field}
                      index={i}
                      onChange={updateField}
                      onRemove={removeField}
                      totalFields={form.fields.length}
                    />
                  ))}
                  <button className="btn-secondary w-full mt-1" onClick={addField}>
                    + Add Field
                  </button>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-hairline flex justify-end gap-2">
                <button className="btn-secondary" onClick={() => setShowBuilder(false)}>Cancel</button>
                <button className="btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Create Template'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Template list ── */}
        {loading ? (
          <div className="py-12 flex justify-center">
            <span className="w-5 h-5 border-2 border-border border-t-ink-muted rounded-full animate-spin" />
          </div>
        ) : templates.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-ink-muted text-sm">
              {canEdit
                ? 'No form templates yet. Create one to get started.'
                : 'No forms are available right now.'}
            </p>
          </div>
        ) : (
          <div className="space-y-0">
            {templates.map((tpl, i) => (
              <div key={tpl.id} className={`animate-slide-up stagger-${Math.min(i + 1, 6)}`}>
                <TemplateCard
                  tpl={tpl}
                  lang={lang}
                  canEdit={canEdit && (user.role === 'pastor' || tpl.created_by === user.id)}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  onDownload={handleDownload}
                />
                {i < templates.length - 1 && <div className="hairline" />}
              </div>
            ))}
          </div>
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

// ─────────────────────────────────────────────────────────────────────────────
// Download helpers (client-side, no extra server endpoint needed)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate and download a clean PDF form using jsPDF (loaded dynamically).
 */
async function downloadAsPdf(tpl, lang) {
  const { jsPDF } = await import('jspdf');

  const title = lang === 'sw' ? tpl.title_sw : tpl.title_en;
  const desc  = lang === 'sw' ? tpl.description_sw : tpl.description_en;
  const fields = tpl.fields || [];

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = 210;
  const margin = 20;
  const contentW = pageW - margin * 2;
  let y = 25;

  // ── Header ──────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(28, 25, 23);
  doc.text(title, margin, y);
  y += 8;

  if (desc) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(120, 113, 108);
    const descLines = doc.splitTextToSize(desc, contentW);
    doc.text(descLines, margin, y);
    y += descLines.length * 5 + 4;
  }

  // Thin rule
  doc.setDrawColor(231, 229, 224);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // ── Church name + date line ───────────────────────────────────────────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(168, 162, 158);
  doc.text('Church Portal  ·  ' + new Date().toLocaleDateString(), margin, y);
  y += 10;

  // ── Fields ───────────────────────────────────────────────────────────
  for (const field of fields) {
    const label = (lang === 'sw' ? field.label_sw : field.label_en) || field.label_en;
    const isRequired = field.required;

    // Check page break
    if (y > 265) {
      doc.addPage();
      y = 20;
    }

    // Label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(120, 113, 108);
    doc.text((label + (isRequired ? ' *' : '')).toUpperCase(), margin, y);
    y += 5;

    if (field.type === 'textarea') {
      // Larger box
      doc.setDrawColor(214, 211, 206);
      doc.setLineWidth(0.4);
      doc.rect(margin, y, contentW, 22);
      y += 26;
    } else if (field.type === 'checkbox') {
      // Single checkbox
      doc.setDrawColor(214, 211, 206);
      doc.setLineWidth(0.4);
      doc.rect(margin, y, 5, 5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(28, 25, 23);
      doc.text(label, margin + 7, y + 3.5);
      y += 10;
    } else if (field.type === 'select' && Array.isArray(field.options) && field.options.length) {
      // Render options as checkboxes
      for (const opt of field.options) {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.setDrawColor(214, 211, 206);
        doc.setLineWidth(0.4);
        doc.rect(margin, y, 4, 4);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(28, 25, 23);
        doc.text(opt, margin + 6, y + 3);
        y += 7;
      }
      y += 2;
    } else {
      // Default: underline input
      doc.setDrawColor(214, 211, 206);
      doc.setLineWidth(0.4);
      doc.line(margin, y + 7, margin + contentW, y + 7);
      y += 12;
    }

    y += 3; // spacing between fields
  }

  // ── Signature line ────────────────────────────────────────────────────
  if (y < 260) {
    y += 10;
    doc.setDrawColor(214, 211, 206);
    doc.setLineWidth(0.4);
    doc.line(margin, y, margin + 60, y);
    doc.line(margin + 80, y, margin + 140, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(168, 162, 158);
    doc.text('Signature', margin, y);
    doc.text('Date', margin + 80, y);
  }

  doc.save(`${title.replace(/\s+/g, '_')}.pdf`);
}

/**
 * Generate and download an Excel (.xlsx) form using SheetJS (loaded dynamically).
 * Creates a header section + labelled rows with blank answer cells.
 */
async function downloadAsXlsx(tpl, lang) {
  const XLSX = await import('xlsx');

  const title = lang === 'sw' ? tpl.title_sw : tpl.title_en;
  const desc  = lang === 'sw' ? tpl.description_sw : tpl.description_en;
  const fields = tpl.fields || [];

  // Build rows
  const rows = [];

  // Title row
  rows.push([title]);
  rows.push([]);

  if (desc) {
    rows.push([desc]);
    rows.push([]);
  }

  rows.push(['Generated:', new Date().toLocaleDateString()]);
  rows.push([]);

  // Header
  rows.push(['Field', 'Answer']);
  rows.push(['']);

  for (const field of fields) {
    const label = (lang === 'sw' ? field.label_sw : field.label_en) || field.label_en;
    const required = field.required ? ' *' : '';

    if (field.type === 'select' && Array.isArray(field.options) && field.options.length) {
      rows.push([`${label}${required}`, '— select one:']);
      for (const opt of field.options) {
        rows.push([`  ☐ ${opt}`, '']);
      }
      rows.push(['']);
    } else if (field.type === 'checkbox') {
      rows.push([`☐  ${label}${required}`, '']);
    } else {
      rows.push([`${label}${required}`, '']);
    }
  }

  rows.push(['']);
  rows.push(['Signature:', '', 'Date:', '']);

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Column widths
  ws['!cols'] = [{ wch: 40 }, { wch: 50 }, { wch: 12 }, { wch: 30 }];

  // Merge title cell across columns
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31));
  XLSX.writeFile(wb, `${title.replace(/\s+/g, '_')}.xlsx`);
}