'use client';

import { useState, useRef, useCallback } from 'react';
import { authApi } from '../../lib/api';
import * as XLSX from 'xlsx';

// ── Icons ─────────────────────────────────────────────────────────────────────
const Icon = ({ path, size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"
    strokeLinejoin="round" className={className}>
    <path d={path} />
  </svg>
);
const ICONS = {
  x:        'M18 6L6 18M6 6l12 12',
  check:    'M20 6L9 17l-5-5',
  copy:     'M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-4-4H8zM14 2v6h6',
  eye:      'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  eyeOff:   'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22',
  upload:   'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  file:     'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  user:     'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  users:    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  alert:    'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
  trash:    'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2',
};

// ── Shared primitives ─────────────────────────────────────────────────────────
function Field({ label, error, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-stone-500 tracking-wide">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  );
}

function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg
        text-stone-800 placeholder-stone-300
        focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400
        disabled:bg-stone-50 disabled:text-stone-400 transition ${className}`}
      {...props}
    />
  );
}

function Select({ children, ...props }) {
  return (
    <select
      className="w-full px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg
        text-stone-800 appearance-none
        focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 transition"
      {...props}
    >
      {children}
    </select>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────
const EMPTY = {
  full_name: '', email: '', phone: '',
  role: 'member', gender: '', date_of_birth: '',
  namba_ya_usharika: '', password: '', autoPassword: true,
};

// Expected column names (case-insensitive) → internal field name
const COL_MAP = {
  'full name':          'full_name',
  'fullname':           'full_name',
  'name':               'full_name',
  'email':              'email',
  'phone':              'phone',
  'phone number':       'phone',
  'role':               'role',
  'gender':             'gender',
  'date of birth':      'date_of_birth',
  'dob':                'date_of_birth',
  'namba ya usharika':  'namba_ya_usharika',
  'membership number':  'namba_ya_usharika',
  'member number':      'namba_ya_usharika',
  'password':           'password',
};

const VALID_ROLES = new Set(['pastor', 'elder', 'group_leader', 'member']);

// ── Template download ─────────────────────────────────────────────────────────
function downloadTemplate() {
  const headers = [
    'Full Name', 'Email', 'Phone', 'Role',
    'Gender', 'Date of Birth', 'Namba Ya Usharika', 'Password',
  ];
  const example = [
    'Maria Joseph', 'maria@example.com', '+255700000001', 'member',
    'Female', '1990-05-15', 'U-001', '',
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, example]);

  // Column widths
  ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 4, 18) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Members');
  XLSX.writeFile(wb, 'members_template.xlsx');
}

// ── Parse Excel → array of user objects ──────────────────────────────────────
function parseWorkbook(arrayBuffer) {
  const wb   = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  if (rows.length < 2) throw new Error('Spreadsheet has no data rows.');

  const headerRow = rows[0].map(h => String(h).toLowerCase().trim());

  // Map header index → field name
  const fieldIndex = {};
  headerRow.forEach((h, i) => {
    if (COL_MAP[h]) fieldIndex[COL_MAP[h]] = i;
  });

  if (!('full_name' in fieldIndex)) {
    throw new Error('Column "Full Name" is required but was not found in the spreadsheet.');
  }

  const users = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];

    // Skip completely empty rows
    if (row.every(c => c === '' || c === null || c === undefined)) continue;

    const user = {};
    for (const [field, idx] of Object.entries(fieldIndex)) {
      let val = row[idx];

      // XLSX may parse dates as Date objects
      if (val instanceof Date) {
        const y = val.getFullYear();
        const m = String(val.getMonth() + 1).padStart(2, '0');
        const d = String(val.getDate()).padStart(2, '0');
        val = `${y}-${m}-${d}`;
      }

      val = val === null || val === undefined ? '' : String(val).trim();
      if (val) user[field] = val;
    }

    // Default role if omitted or invalid
    if (!user.role || !VALID_ROLES.has(user.role.toLowerCase())) {
      user.role = 'member';
    } else {
      user.role = user.role.toLowerCase();
    }

    users.push({ _row: r + 1, ...user });
  }

  if (users.length === 0) throw new Error('No valid rows found in spreadsheet.');
  return users;
}

// ── Validate parsed rows client-side ─────────────────────────────────────────
function validateRows(rows) {
  return rows.map(u => {
    const errs = [];
    if (!u.full_name) errs.push('Missing name');
    if (!u.email && !u.phone) errs.push('Needs email or phone');
    if (u.email && !/\S+@\S+\.\S+/.test(u.email)) errs.push('Invalid email');
    return { ...u, _errors: errs };
  });
}

// ── Sub-component: BulkPreviewTable ──────────────────────────────────────────
function BulkPreviewTable({ rows, onRemove }) {
  return (
    <div className="border border-stone-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto max-h-64">
        <table className="w-full text-xs">
          <thead className="bg-stone-50 sticky top-0">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-stone-400 w-8">#</th>
              <th className="text-left px-3 py-2 font-medium text-stone-500">Name</th>
              <th className="text-left px-3 py-2 font-medium text-stone-500">Email / Phone</th>
              <th className="text-left px-3 py-2 font-medium text-stone-500">Role</th>
              <th className="text-left px-3 py-2 font-medium text-stone-500">Status</th>
              <th className="w-8 px-2 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.map((u, idx) => {
              const hasErr = u._errors && u._errors.length > 0;
              return (
                <tr key={idx} className={hasErr ? 'bg-red-50' : 'bg-white hover:bg-stone-50'}>
                  <td className="px-3 py-2 text-stone-400">{u._row}</td>
                  <td className="px-3 py-2 text-stone-800 font-medium max-w-[140px] truncate">
                    {u.full_name || <span className="text-red-400 italic">missing</span>}
                  </td>
                  <td className="px-3 py-2 text-stone-500 max-w-[180px] truncate">
                    {u.email || u.phone || <span className="text-red-400 italic">missing</span>}
                  </td>
                  <td className="px-3 py-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium
                      bg-stone-100 text-stone-500 capitalize">
                      {u.role}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {hasErr ? (
                      <span className="text-red-500">{u._errors.join(', ')}</span>
                    ) : (
                      <span className="text-green-600">✓ Ready</span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <button
                      onClick={() => onRemove(idx)}
                      className="p-1 text-stone-300 hover:text-red-400 rounded transition"
                    >
                      <Icon path={ICONS.trash} size={12} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-3 py-2 border-t border-stone-100 bg-stone-50 flex items-center gap-2">
        <span className="text-xs text-stone-400">{rows.length} rows</span>
        {rows.some(r => r._errors?.length > 0) && (
          <>
            <span className="text-stone-200">·</span>
            <span className="text-xs text-red-500">
              {rows.filter(r => r._errors?.length > 0).length} rows have errors and will be skipped
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ── Sub-component: BulkResultsSummary ────────────────────────────────────────
function BulkResultsSummary({ summary, results, onClose, onReset }) {
  const created = results.filter(r => r.status === 'created');
  const skipped = results.filter(r => r.status !== 'created');

  return (
    <div className="px-6 py-6 space-y-5">
      {/* Summary banner */}
      <div className="flex gap-3">
        <div className="flex-1 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-center">
          <p className="text-2xl font-bold text-green-700">{summary.created}</p>
          <p className="text-xs text-green-600 mt-0.5">Added</p>
        </div>
        <div className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-center">
          <p className="text-2xl font-bold text-stone-500">{summary.skipped}</p>
          <p className="text-xs text-stone-400 mt-0.5">Skipped</p>
        </div>
        <div className="flex-1 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
          <p className="text-2xl font-bold text-amber-600">{summary.total}</p>
          <p className="text-xs text-amber-500 mt-0.5">Total rows</p>
        </div>
      </div>

      {/* Skipped rows (if any) */}
      {skipped.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-2">
            Skipped rows
          </p>
          <div className="border border-stone-200 rounded-xl overflow-hidden max-h-44 overflow-y-auto">
            {skipped.map((r, i) => (
              <div key={i} className="flex items-start gap-2 px-3 py-2 border-b
                border-stone-100 last:border-b-0 bg-red-50">
                <Icon path={ICONS.alert} size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-medium text-stone-700">
                    Row {r.row}{r.name ? ` — ${r.name}` : ''}
                  </span>
                  <p className="text-xs text-red-500">{r.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={onReset}
          className="flex-1 px-4 py-2 text-sm font-medium border border-stone-200
            rounded-lg text-stone-600 hover:bg-stone-50 transition"
        >
          Upload another file
        </button>
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2 text-sm font-medium bg-amber-500
            hover:bg-amber-600 text-white rounded-lg transition"
        >
          Done
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// Main modal
// ════════════════════════════════════════════════════════════════════════════════
export default function AdminAddMemberModal({ onClose, onAdded }) {
  const [tab, setTab] = useState('single'); // 'single' | 'bulk'

  // ── Single-member state ────────────────────────────────────────────────────
  const [form, setForm]       = useState(EMPTY);
  const [errors, setErrors]   = useState({});
  const [saving, setSaving]   = useState(false);
  const [showPw, setShowPw]   = useState(false);
  const [result, setResult]   = useState(null);
  const [copied, setCopied]   = useState(false);

  // ── Bulk state ─────────────────────────────────────────────────────────────
  const [bulkRows, setBulkRows]       = useState(null);   // parsed & validated rows
  const [bulkFile, setBulkFile]       = useState(null);   // File object
  const [parseError, setParseError]   = useState('');
  const [uploading, setUploading]     = useState(false);
  const [bulkResult, setBulkResult]   = useState(null);   // server response
  const [isDragging, setIsDragging]   = useState(false);
  const fileInputRef = useRef(null);

  // ── Single helpers ─────────────────────────────────────────────────────────
  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!form.full_name.trim()) e.full_name = 'Full name is required.';
    if (!form.email.trim() && !form.phone.trim())
      e.email = 'Either an email or phone number is required.';
    else if (form.email.trim() && !/\S+@\S+\.\S+/.test(form.email))
      e.email = 'Enter a valid email address.';
    if (!form.autoPassword && form.password.length < 6)
      e.password = 'Password must be at least 6 characters.';
    return e;
  };

  const handleSingleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      const payload = {
        full_name:         form.full_name.trim(),
        email:             form.email.trim()             || undefined,
        phone:             form.phone.trim()             || undefined,
        role:              form.role,
        gender:            form.gender                  || undefined,
        date_of_birth:     form.date_of_birth           || undefined,
        namba_ya_usharika: form.namba_ya_usharika.trim() || undefined,
        password:          form.autoPassword ? undefined : form.password,
      };
      const res  = await authApi.adminCreate(payload);
      const data = res.data;
      setResult({
        name:              form.full_name,
        email:             form.email,
        temporaryPassword: data.temporaryPassword ?? null,
      });
      onAdded?.(data.userId);
    } catch (err) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Something went wrong.';
      setErrors({ _global: msg });
    } finally {
      setSaving(false);
    }
  };

  const copyPassword = () => {
    navigator.clipboard.writeText(result.temporaryPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Bulk helpers ───────────────────────────────────────────────────────────
  const processFile = useCallback(async (file) => {
    setParseError('');
    setBulkRows(null);
    setBulkFile(null);

    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      setParseError('Please upload an Excel (.xlsx / .xls) or CSV file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setParseError('File is too large. Maximum size is 5 MB.');
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseWorkbook(buffer);
      const validated = validateRows(parsed);
      setBulkRows(validated);
      setBulkFile(file);
    } catch (err) {
      setParseError(err.message);
    }
  }, []);

  const handleFileInput = (e) => processFile(e.target.files[0]);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    processFile(e.dataTransfer.files[0]);
  };

  const removeRow = (idx) => {
    setBulkRows(r => {
      const next = r.filter((_, i) => i !== idx);
      return next.length ? next : null;
    });
  };

  const handleBulkUpload = async () => {
    if (!bulkRows || bulkRows.length === 0) return;

    const validRows = bulkRows.filter(r => !r._errors || r._errors.length === 0);
    if (validRows.length === 0) {
      setParseError('All rows have errors. Please fix the file and re-upload.');
      return;
    }

    setUploading(true);
    try {
      // Strip internal _row and _errors before sending
      const payload = validRows.map(({ _row, _errors, ...u }) => u);
      const res  = await authApi.adminBulkCreate({ users: payload });
      const data = res.data;
      setBulkResult(data);
      onAdded?.();
    } catch (err) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Something went wrong.';
      setParseError(msg);
    } finally {
      setUploading(false);
    }
  };

  const resetBulk = () => {
    setBulkRows(null);
    setBulkFile(null);
    setParseError('');
    setBulkResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Render: single-member success screen ──────────────────────────────────
  if (result) return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center
      justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-8 text-center">
          <div className="w-14 h-14 rounded-full bg-green-50 flex items-center
            justify-center mx-auto mb-4">
            <Icon path={ICONS.check} size={24} className="text-green-600" />
          </div>
          <h2 className="text-lg font-semibold text-stone-900 mb-1">Member Added</h2>
          <p className="text-sm text-stone-500 mb-5">
            <span className="font-medium text-stone-700">{result.name}</span> has been
            added and can now log in.
          </p>

          {result.temporaryPassword && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-4 mb-5 text-left">
              <p className="text-xs font-medium text-amber-700 mb-2 uppercase tracking-wide">
                Temporary password — share with member
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-white border border-amber-200 rounded-lg
                  px-3 py-2 text-sm font-mono text-stone-800 truncate">
                  {result.temporaryPassword}
                </code>
                <button
                  onClick={copyPassword}
                  className="flex-shrink-0 p-2 text-amber-600 hover:bg-amber-100
                    rounded-lg transition"
                  title="Copy to clipboard"
                >
                  {copied
                    ? <Icon path={ICONS.check} size={15} className="text-green-600" />
                    : <Icon path={ICONS.copy} size={15} />}
                </button>
              </div>
              {result.email && (
                <p className="text-xs text-amber-600 mt-2">
                  A welcome email with these credentials has been sent to {result.email}.
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => { setForm(EMPTY); setResult(null); }}
              className="flex-1 px-4 py-2 text-sm font-medium border border-stone-200
                rounded-lg text-stone-600 hover:bg-stone-50 transition"
            >
              Add another
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium bg-amber-500
                hover:bg-amber-600 text-white rounded-lg transition"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ── Main modal ─────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center
      justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden
        max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <div>
            <h2 className="font-semibold text-stone-900">Add Members</h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Members will be immediately active — no approval needed.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100
              rounded-lg transition"
          >
            <Icon path={ICONS.x} size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-stone-100 px-6 pt-3">
          {[
            { id: 'single', label: 'Single member', icon: ICONS.user },
            { id: 'bulk',   label: 'Bulk upload',   icon: ICONS.users },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium
                border-b-2 -mb-px transition
                ${tab === t.id
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-stone-400 hover:text-stone-600'}`}
            >
              <Icon path={t.icon} size={14} />
              {t.label}
            </button>
          ))}
        </div>

        {/* ── SINGLE TAB ─────────────────────────────────────────────────── */}
        {tab === 'single' && (
          <>
            <div className="px-6 py-5 overflow-y-auto space-y-5">

              {errors._global && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3
                  text-sm text-red-600">
                  {errors._global}
                </div>
              )}

              {/* Required */}
              <div>
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-3">
                  Required
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Full name *" error={errors.full_name}>
                    <Input
                      value={form.full_name}
                      onChange={e => set('full_name', e.target.value)}
                      placeholder="Maria Joseph"
                    />
                  </Field>
                  <Field label="Phone" error={!form.email.trim() && !form.phone.trim() ? errors.email : undefined}>
                    <Input
                      type="tel"
                      value={form.phone}
                      onChange={e => set('phone', e.target.value)}
                      placeholder="+255 700 000 000"
                    />
                  </Field>
                </div>
                <div className="mt-3">
                  <Field label="Email" error={form.email.trim() ? errors.email : undefined}>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={e => set('email', e.target.value)}
                      placeholder="maria@example.com (optional)"
                    />
                  </Field>
                  <p className="text-xs text-stone-400 mt-1.5">
                    Email or phone is required. Members without email can log in with their phone number or membership number.
                  </p>
                  {errors.email && !form.email.trim() && !form.phone.trim() && (
                    <p className="text-xs text-red-500 mt-1">{errors.email}</p>
                  )}
                </div>
              </div>

              {/* Optional details */}
              <div>
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-3">
                  Details (optional)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Namba ya usharika">
                    <Input
                      value={form.namba_ya_usharika}
                      onChange={e => set('namba_ya_usharika', e.target.value)}
                      placeholder="U-001"
                    />
                  </Field>
                  <Field label="Role">
                    <Select value={form.role} onChange={e => set('role', e.target.value)}>
                      <option value="member">Member</option>
                      <option value="group_leader">Group Leader</option>
                      <option value="elder">Elder</option>
                      <option value="pastor">Pastor</option>
                    </Select>
                  </Field>
                  <Field label="Gender">
                    <Select value={form.gender} onChange={e => set('gender', e.target.value)}>
                      <option value="">— Select —</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </Select>
                  </Field>
                  <Field label="Date of birth">
                    <Input
                      type="date"
                      value={form.date_of_birth}
                      onChange={e => set('date_of_birth', e.target.value)}
                    />
                  </Field>
                </div>
              </div>

              {/* Password */}
              <div>
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-3">
                  Password
                </p>
                <label className="flex items-center gap-2 cursor-pointer mb-3">
                  <input
                    type="checkbox"
                    checked={form.autoPassword}
                    onChange={e => set('autoPassword', e.target.checked)}
                    className="accent-amber-500 w-4 h-4"
                  />
                  <span className="text-sm text-stone-700">
                    Auto-generate a temporary password
                  </span>
                </label>

                {!form.autoPassword && (
                  <Field label="Password" error={errors.password}>
                    <div className="relative">
                      <Input
                        type={showPw ? 'text' : 'password'}
                        value={form.password}
                        onChange={e => set('password', e.target.value)}
                        placeholder="Min. 6 characters"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(s => !s)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2
                          text-stone-300 hover:text-stone-500 transition"
                      >
                        <Icon path={showPw ? ICONS.eyeOff : ICONS.eye} size={15} />
                      </button>
                    </div>
                  </Field>
                )}

                {form.autoPassword && (
                  <p className="text-xs text-stone-400">
                    A random password will be generated and shown after saving.
                    The member will also receive it by email.
                  </p>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-stone-100 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-stone-600
                  border border-stone-200 rounded-lg hover:bg-stone-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSingleSubmit}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium
                  bg-amber-500 hover:bg-amber-600 text-white rounded-lg
                  shadow-sm transition disabled:opacity-60"
              >
                {saving && (
                  <span className="w-3.5 h-3.5 border-2 border-white/40
                    border-t-white rounded-full animate-spin" />
                )}
                {saving ? 'Adding…' : 'Add member'}
              </button>
            </div>
          </>
        )}

        {/* ── BULK TAB ───────────────────────────────────────────────────── */}
        {tab === 'bulk' && (
          <>
            {/* Bulk results view */}
            {bulkResult ? (
              <BulkResultsSummary
                summary={bulkResult.summary}
                results={bulkResult.results}
                onClose={onClose}
                onReset={resetBulk}
              />
            ) : (
              <>
                <div className="px-6 py-5 overflow-y-auto space-y-4">

                  {/* Template download */}
                  <div className="flex items-center justify-between bg-stone-50
                    border border-stone-200 rounded-xl px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-stone-700">Download template</p>
                      <p className="text-xs text-stone-400 mt-0.5">
                        Fill in the spreadsheet, then upload it below.
                      </p>
                    </div>
                    <button
                      onClick={downloadTemplate}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs
                        font-medium border border-stone-200 rounded-lg text-stone-600
                        hover:bg-white transition"
                    >
                      <Icon path={ICONS.download} size={13} />
                      .xlsx
                    </button>
                  </div>

                  {/* Drop zone */}
                  {!bulkRows && (
                    <div
                      onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl px-6 py-10
                        flex flex-col items-center text-center cursor-pointer
                        transition
                        ${isDragging
                          ? 'border-amber-400 bg-amber-50'
                          : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50'}`}
                    >
                      <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center
                        justify-center mb-3">
                        <Icon path={ICONS.upload} size={18} className="text-stone-400" />
                      </div>
                      <p className="text-sm font-medium text-stone-700">
                        Drop your file here, or{' '}
                        <span className="text-amber-600 underline underline-offset-2">browse</span>
                      </p>
                      <p className="text-xs text-stone-400 mt-1">
                        .xlsx, .xls, or .csv — up to 200 members, 5 MB max
                      </p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleFileInput}
                        className="hidden"
                      />
                    </div>
                  )}

                  {/* Parse error */}
                  {parseError && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-200
                      rounded-xl px-4 py-3">
                      <Icon path={ICONS.alert} size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-700">Could not read file</p>
                        <p className="text-xs text-red-500 mt-0.5">{parseError}</p>
                      </div>
                    </div>
                  )}

                  {/* Preview table */}
                  {bulkRows && (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest">
                          Preview — {bulkFile?.name}
                        </p>
                        <button
                          onClick={resetBulk}
                          className="text-xs text-stone-400 hover:text-stone-600 underline
                            underline-offset-2 transition"
                        >
                          Replace file
                        </button>
                      </div>
                      <BulkPreviewTable rows={bulkRows} onRemove={removeRow} />
                    </>
                  )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-stone-100 flex justify-end gap-2">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-stone-600
                      border border-stone-200 rounded-lg hover:bg-stone-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBulkUpload}
                    disabled={!bulkRows || uploading ||
                      bulkRows.filter(r => !r._errors?.length).length === 0}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium
                      bg-amber-500 hover:bg-amber-600 text-white rounded-lg
                      shadow-sm transition disabled:opacity-50"
                  >
                    {uploading && (
                      <span className="w-3.5 h-3.5 border-2 border-white/40
                        border-t-white rounded-full animate-spin" />
                    )}
                    {uploading
                      ? 'Uploading…'
                      : bulkRows
                        ? `Add ${bulkRows.filter(r => !r._errors?.length).length} members`
                        : 'Add members'}
                  </button>
                </div>
              </>
            )}
          </>
        )}

      </div>
    </div>
  );
}