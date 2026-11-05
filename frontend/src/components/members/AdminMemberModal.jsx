'use client';

import { useState, useRef, useCallback } from 'react';
import { authApi } from '../../lib/api';
import * as XLSX from 'xlsx';
import { JUMUIYA_LIST } from '../../lib/constants';

// ── Icons ──────────────────────────────────────────────────────────────────
const Icon = ({ path, size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"
    strokeLinejoin="round" className={className}>
    <path d={path} />
  </svg>
);
const ICONS = {
  x:          'M18 6L6 18M6 6l12 12',
  check:      'M20 6L9 17l-5-5',
  copy:       'M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-4-4H8zM14 2v6h6',
  eye:        'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  eyeOff:     'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22',
  upload:     'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  download:   'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  user:       'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  users:      'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  alert:      'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
  trash:      'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2',
  plus:       'M12 5v14M5 12h14',
  chevronR:   'M9 18l6-6-6-6',
  chevronL:   'M15 18l-6-6 6-6',
  heart:      'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',
  briefcase:  'M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2',
  mapPin:     'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  baby:       'M9 12h6M9 16h6M3 8h18M5 8V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2M5 8l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2L19 8',
  key:        'M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4',
  hash:       'M4 9h16M4 15h16M10 3L8 21M16 3l-2 18',
};

// ── Shared primitives ──────────────────────────────────────────────────────
function Field({ label, error, hint, children }) {
  return (
    <div className="form-group">
      {label && <label className="form-label">{label}</label>}
      {children}
      {hint  && <p className="form-hint">{hint}</p>}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
function TextInput({ className = '', ...props }) {
  return <input className={`input ${className}`} {...props} />;
}
function SelectInput({ children, ...props }) {
  return <select className="select" {...props}>{children}</select>;
}

// ── Step progress bar ──────────────────────────────────────────────────────
function StepBar({ steps, current }) {
  return (
    <div className="px-6 py-4 border-b border-subtle">
      <div className="flex items-center justify-between mb-2">
        {steps.map((s, i) => (
          <button key={i} type="button" disabled={i > current}
            className={`flex flex-col items-center gap-1 flex-1 ${i > current ? 'cursor-not-allowed' : 'cursor-default'}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition
              ${i < current  ? 'bg-[var(--gold)] text-[var(--navy-dark)]' : ''}
              ${i === current ? 'bg-[var(--navy)] text-white ring-2 ring-[var(--gold)] ring-offset-2' : ''}
              ${i > current  ? 'bg-[var(--border-subtle)] text-[var(--text-disabled)]' : ''}`}>
              {i < current ? <Icon path={ICONS.check} size={13} /> : i + 1}
            </div>
            <span className={`hidden sm:block text-[10px] font-medium leading-tight text-center transition
              ${i === current ? 'text-[var(--navy)]' : i < current ? 'text-[var(--gold-dark)]' : 'text-[var(--text-disabled)]'}`}>
              {s.short}
            </span>
          </button>
        ))}
      </div>
      <div className="progress-bar mt-1">
        <div className="progress-fill" style={{ width: `${(current / (steps.length - 1)) * 100}%` }} />
      </div>
    </div>
  );
}

// ── Constants ──────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  // Step 0 – Account basics
  full_name: '', email: '', phone: '', role: 'member',
  namba_ya_usharika: '', ahadi_number: '',
  // Step 1 – Personal
  gender: '', date_of_birth: '', place_of_birth: '',
  // Step 2 – Marital
  marital_status: '', marriage_type: '', marriage_date: '',
  marriage_place: '', spouse_name: '', spouse_phone: '',
  cohabiting_partner_name: '',
  // Step 3 – Professional
  occupation: '', workplace: '', education: '', profession: '',
  willing_to_volunteer: '',
  // Step 4 – Residence
  jumuiya: '', block_no: '', area_name: '', slp: '',
  neighbour_member_name: '', neighbour_member_phone: '',
  elder_name: '', elder_phone: '', previous_church: '',
  // Step 5 – Dependants (array, separate state)
  // Step 6 – Password
  password: '', autoPassword: true,
};

const EMPTY_DEPENDANT = { full_name: '', date_of_birth: '', relationship: '' };

const WIZARD_STEPS = [
  { short: 'Account',    label: 'Account basics',           icon: ICONS.user },
  { short: 'Personal',   label: 'Personal details',         icon: ICONS.user },
  { short: 'Marital',    label: 'Marital information',      icon: ICONS.heart },
  { short: 'Work',       label: 'Professional & education', icon: ICONS.briefcase },
  { short: 'Residence',  label: 'Residence & contacts',     icon: ICONS.mapPin },
  { short: 'Dependants', label: 'Dependants',               icon: ICONS.baby },
  { short: 'Password',   label: 'Password',                 icon: ICONS.key },
];

// ── Bulk: column map ───────────────────────────────────────────────────────
// KKKT Excel exact column names (Swahili) first, then generic English template names
const COL_MAP = {
  // ── KKKT Excel (Swahili) ─────────────────────────────────────────────────
  'ahadi number':               'ahadi_number',
  'jina la msharika':           'full_name',
  'namba ya simu':              'phone',
  'gander':                     'gender',          // typo in Excel — handled
  'marital status':             'marital_status',
  'kazi/ujuzi':                 'occupation',
  'kazi':                       'occupation',
  'ujuzi':                      'occupation',
  'jumuiya':                    'jumuiya',

  // ── Generic template (English) ───────────────────────────────────────────
  'full name':                  'full_name',
  'fullname':                   'full_name',
  'name':                       'full_name',
  'email':                      'email',
  'phone':                      'phone',
  'phone number':               'phone',
  'role':                       'role',
  'namba ya usharika':          'namba_ya_usharika',
  'membership number':          'namba_ya_usharika',
  'member number':              'namba_ya_usharika',
  'password':                   'password',
  'gender':                     'gender',
  'date of birth':              'date_of_birth',
  'dob':                        'date_of_birth',
  'place of birth':             'place_of_birth',
  'marriage type':              'marriage_type',
  'marriage date':              'marriage_date',
  'marriage place':             'marriage_place',
  'spouse name':                'spouse_name',
  'spouse phone':               'spouse_phone',
  'cohabiting partner name':    'cohabiting_partner_name',
  'occupation':                 'occupation',
  'workplace':                  'workplace',
  'education':                  'education',
  'profession':                 'profession',
  'willing to volunteer':       'willing_to_volunteer',
  'block no':                   'block_no',
  'block number':               'block_no',
  'area name':                  'area_name',
  'area':                       'area_name',
  'mtaa':                       'area_name',
  'slp':                        'slp',
  'p.o. box':                   'slp',
  'po box':                     'slp',
  'neighbour member name':      'neighbour_member_name',
  'neighbour member phone':     'neighbour_member_phone',
  'elder name':                 'elder_name',
  'elder phone':                'elder_phone',
  'previous church':            'previous_church',
};

const VALID_ROLES = new Set(['pastor', 'elder', 'group_leader', 'member']);

// ── Bulk: download template ────────────────────────────────────────────────
function downloadTemplate() {
  const headers = [
    'Full Name', 'Email', 'Phone', 'Ahadi Number', 'Role', 'Namba Ya Usharika', 'Password',
    'Gender', 'Date of Birth', 'Place of Birth',
    'Marital Status', 'Marriage Type', 'Marriage Date', 'Marriage Place',
    'Spouse Name', 'Spouse Phone', 'Cohabiting Partner Name',
    'Occupation', 'Workplace', 'Education', 'Profession', 'Willing to Volunteer',
    'Jumuiya', 'Block No', 'Area Name', 'SLP',
    'Neighbour Member Name', 'Neighbour Member Phone',
    'Elder Name', 'Elder Phone', 'Previous Church',
  ];

  const hints = [
    'Required', 'Optional if phone/ahadi given', 'Optional if email given',
    'Unique church pledge number e.g. 5', 'pastor | elder | group_leader | member',
    'e.g. U-001', 'Leave blank to auto-generate',
    'Male | Female', 'YYYY-MM-DD', '',
    'Ameoa | Ameolewa | Hajaoa | Hajaolewa | Mjane | Mgane | Talikiwa | Tengana',
    'Kikristo | Siya Kikristo', 'YYYY-MM-DD', '', '', '', '',
    '', '', '', '', 'Yes | No',
    '', '', '', '', '', '', '', '', '',
  ];

  const example = [
    'Maria Joseph', 'maria@example.com', '+255700000001', '5', 'member', 'U-001', '',
    'Female', '1990-05-15', 'Dar es Salaam',
    'Ameolewa', 'Kikristo', '2015-06-20', 'Kanisa Kuu',
    'Joseph Mwangi', '+255700000002', '',
    'Teacher', 'Shule ya Sekondari Yombo', "Bachelor's Degree", 'Electrician', 'Yes',
    'Jumuiya ya Upendo', 'B-12', 'Kinondoni', 'S.L.P 1234',
    'Anna Banda', '+255700000003', 'Mzee Paulo', '+255700000004', 'KKKT Dar es Salaam',
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, hints, example]);
  ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 4, 20) }));
  ws['!freeze'] = { xSplit: 0, ySplit: 2 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Members');
  XLSX.writeFile(wb, 'members_template.xlsx');
}

// ── Bulk: parse workbook (supports KKKT multi-sheet + generic template) ────
function parseWorkbook(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
  const allUsers = [];

  for (const sheetName of wb.SheetNames) {
    const ws   = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (rows.length < 2) continue;

    // Find the real header row — scan first 5 rows for a recognised column
    let headerIdx = 0;
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      const joined = rows[i].map(c => String(c).toLowerCase().trim()).join(' ');
      if (
        joined.includes('jina la msharika') ||
        joined.includes('ahadi number') ||
        joined.includes('full name') ||
        joined.includes('fullname')
      ) { headerIdx = i; break; }
    }

    const rawHeaders = rows[headerIdx].map(h => String(h).toLowerCase().trim());

    // Detect and skip a hints row (template format: row 1 contains "optional" in email col)
    const emailColIdx = rawHeaders.indexOf('email');
    const isHintsRow  = rows[headerIdx + 1] && emailColIdx >= 0 &&
      String(rows[headerIdx + 1][emailColIdx]).toLowerCase().includes('optional');
    const dataStart = headerIdx + (isHintsRow ? 2 : 1);

    // Build field → column index map (ignore unmapped / pledge columns)
    const fieldIndex = {};
    rawHeaders.forEach((h, i) => { if (COL_MAP[h]) fieldIndex[COL_MAP[h]] = i; });
    if (!('full_name' in fieldIndex)) continue;  // sheet has no recognisable name column

    for (let r = dataStart; r < rows.length; r++) {
      const row = rows[r];
      if (row.every(c => c === '' || c === null || c === undefined)) continue;

      // Skip KKKT sub-header row (pledge column labels: JENGO, UWAKILI, etc.)
      const firstCell = String(row[0] ?? '').trim().toUpperCase();
      if (['JENGO', 'UWAKILI', 'MFUKO WA ELIMU', 'MAENDELEO'].some(k => firstCell.includes(k))) continue;

      const user = {};
      for (const [field, idx] of Object.entries(fieldIndex)) {
        let val = row[idx];

        if (val instanceof Date) {
          val = `${val.getFullYear()}-${String(val.getMonth()+1).padStart(2,'0')}-${String(val.getDate()).padStart(2,'0')}`;
        }

        val = (val === null || val === undefined) ? '' : String(val).trim();
        if (!val || val === '0') continue;   // ignore empty cells and pledge zeroes

        // Normalise gender — Excel has 'MALE'/'FEMALE', DB wants 'Male'/'Female'
        if (field === 'gender') {
          const g = val.toLowerCase();
          val = g === 'male' ? 'Male' : g === 'female' ? 'Female' : val;
        }

        // Normalise willing_to_volunteer → boolean string
        if (field === 'willing_to_volunteer') {
          val = ['yes', 'ndio', 'true', '1'].includes(val.toLowerCase()) ? 'true' : 'false';
        }

        user[field] = val;
      }

      if (!user.role || !VALID_ROLES.has((user.role ?? '').toLowerCase())) {
        user.role = 'member';
      } else {
        user.role = user.role.toLowerCase();
      }

      user._sheet = sheetName;
      user._row   = r + 1;
      allUsers.push(user);
    }
  }

  if (allUsers.length === 0) throw new Error('No valid member rows found in spreadsheet.');
  return allUsers;
}

// ── Bulk: validate rows ────────────────────────────────────────────────────
// Accept email, phone, OR ahadi_number as a valid identifier (KKKT Excel has no email)
function validateRows(rows) {
  return rows.map(u => {
    const errs = [];
    if (!u.full_name) errs.push('Missing name');
    if (!u.email && !u.phone && !u.ahadi_number)
      errs.push('Needs email, phone, or ahadi number');
    else if (u.email && !/\S+@\S+\.\S+/.test(u.email))
      errs.push('Invalid email');
    return { ...u, _errors: errs };
  });
}

// ── BulkPreviewTable ───────────────────────────────────────────────────────
function BulkPreviewTable({ rows, onRemove }) {
  // Count per sheet for the footer summary
  const sheetCounts = rows.reduce((acc, r) => {
    if (r._sheet) acc[r._sheet] = (acc[r._sheet] || 0) + 1;
    return acc;
  }, {});
  const sheetNames = Object.keys(sheetCounts);

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto max-h-64">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-8">#</th>
              <th>Sheet</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Ahadi No.</th>
              <th>Gender</th>
              <th>Marital</th>
              <th>Occupation</th>
              <th>Jumuiya</th>
              <th>Status</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map((u, idx) => {
              const hasErr = u._errors?.length > 0;
              return (
                <tr key={idx} className={hasErr ? 'bg-[var(--danger-bg)]' : ''}>
                  <td className="text-[var(--text-tertiary)]">{u._row}</td>
                  <td className="text-[var(--text-tertiary)] text-xs whitespace-nowrap">{u._sheet || '—'}</td>
                  <td className="font-medium max-w-[140px] truncate">
                    {u.full_name || <span className="text-[var(--danger)] italic">missing</span>}
                  </td>
                  <td className="text-[var(--text-secondary)]">{u.phone || '—'}</td>
                  <td className="text-[var(--text-secondary)]">{u.ahadi_number || '—'}</td>
                  <td className="text-[var(--text-secondary)]">{u.gender || '—'}</td>
                  <td className="text-[var(--text-secondary)] text-xs max-w-[90px] truncate">{u.marital_status || '—'}</td>
                  <td className="text-[var(--text-secondary)] text-xs max-w-[100px] truncate">{u.occupation || '—'}</td>
                  <td className="text-[var(--text-secondary)] text-xs max-w-[90px] truncate">{u.jumuiya || '—'}</td>
                  <td>
                    {hasErr
                      ? <span className="text-[var(--danger)] text-xs">{u._errors.join(', ')}</span>
                      : <span className="text-[var(--success)] text-xs font-medium">✓ Ready</span>}
                  </td>
                  <td>
                    <button onClick={() => onRemove(idx)}
                      className="btn btn-ghost btn-icon btn-sm text-[var(--text-disabled)] hover:text-[var(--danger)]">
                      <Icon path={ICONS.trash} size={12} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="card-footer flex items-center gap-2 flex-wrap">
        <span className="text-xs text-[var(--text-tertiary)]">{rows.length} rows total</span>
        {/* Per-sheet counts — useful when WANAUME + WANAWAKE are both loaded */}
        {sheetNames.length > 1 && sheetNames.map(s => (
          <span key={s} className="text-xs text-[var(--text-tertiary)]">
            · {s}: {sheetCounts[s]}
          </span>
        ))}
        {rows.some(r => r._errors?.length > 0) && (
          <>
            <span className="text-[var(--border-default)]">·</span>
            <span className="text-xs text-[var(--danger)]">
              {rows.filter(r => r._errors?.length > 0).length} rows have errors and will be skipped
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ── BulkResultsSummary ─────────────────────────────────────────────────────
function BulkResultsSummary({ summary, results, onClose, onReset }) {
  const skipped = results.filter(r => r.status !== 'created');
  return (
    <div className="px-6 py-6 space-y-5">
      <div className="flex gap-3">
        <div className="flex-1 banner banner-success text-center flex-col items-center justify-center py-4">
          <p className="text-2xl font-bold">{summary.created}</p>
          <p className="text-xs mt-0.5">Added</p>
        </div>
        <div className="flex-1 card px-4 py-3 text-center">
          <p className="text-2xl font-bold text-[var(--text-secondary)]">{summary.skipped}</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Skipped</p>
        </div>
        <div className="flex-1 banner banner-gold text-center flex-col items-center justify-center py-4">
          <p className="text-2xl font-bold">{summary.total}</p>
          <p className="text-xs mt-0.5">Total rows</p>
        </div>
      </div>

      {skipped.length > 0 && (
        <div>
          <p className="stat-label mb-2">Skipped rows</p>
          <div className="card overflow-hidden max-h-44 overflow-y-auto">
            {skipped.map((r, i) => (
              <div key={i} className="flex items-start gap-2 px-3 py-2 border-b border-subtle last:border-b-0 bg-[var(--danger-bg)]">
                <Icon path={ICONS.alert} size={13} className="text-[var(--danger)] flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-medium text-[var(--text-primary)]">
                    Row {r.row}{r.name ? ` — ${r.name}` : ''}
                  </span>
                  <p className="text-xs text-[var(--danger)]">{r.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button onClick={onReset} className="btn btn-secondary flex-1">Upload another file</button>
        <button onClick={onClose} className="btn btn-primary flex-1">Done</button>
      </div>
    </div>
  );
}

// ── Section heading helper ─────────────────────────────────────────────────
function SectionLabel({ children }) {
  return <p className="stat-label mb-3 mt-1">{children}</p>;
}

// ── Dependant row ──────────────────────────────────────────────────────────
function DependantRow({ dep, idx, onChange, onRemove }) {
  return (
    <div className="card card-body grid grid-cols-1 sm:grid-cols-3 gap-3 relative">
      <button type="button" onClick={() => onRemove(idx)}
        className="btn btn-ghost btn-icon btn-sm absolute top-2 right-2 text-[var(--text-disabled)] hover:text-[var(--danger)]">
        <Icon path={ICONS.trash} size={13} />
      </button>
      <Field label="Full name">
        <TextInput value={dep.full_name}
          onChange={e => onChange(idx, 'full_name', e.target.value)}
          placeholder="e.g. John Joseph" />
      </Field>
      <Field label="Date of birth">
        <TextInput type="date" value={dep.date_of_birth}
          onChange={e => onChange(idx, 'date_of_birth', e.target.value)} />
      </Field>
      <Field label="Relationship">
        <SelectInput value={dep.relationship}
          onChange={e => onChange(idx, 'relationship', e.target.value)}>
          <option value="">— Select —</option>
          <option value="Mwana">Mwana (Child)</option>
          <option value="Mke">Mke (Wife)</option>
          <option value="Mume">Mume (Husband)</option>
          <option value="Ndugu">Ndugu (Sibling)</option>
          <option value="Mzazi">Mzazi (Parent)</option>
          <option value="Mwingine">Mwingine (Other)</option>
        </SelectInput>
      </Field>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Main modal
// ════════════════════════════════════════════════════════════════════════════
export default function AdminAddMemberModal({ onClose, onAdded }) {
  const [tab, setTab] = useState('single'); // 'single' | 'bulk'

  // ── Single – wizard state ────────────────────────────────────────────────
  const [step, setStep]             = useState(0);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [dependants, setDependants] = useState([]);
  const [errors, setErrors]         = useState({});
  const [saving, setSaving]         = useState(false);
  const [showPw, setShowPw]         = useState(false);
  const [result, setResult]         = useState(null);
  const [copied, setCopied]         = useState(false);

  // ── Bulk state ───────────────────────────────────────────────────────────
  const [bulkRows, setBulkRows]     = useState(null);
  const [bulkFile, setBulkFile]     = useState(null);
  const [parseError, setParseError] = useState('');
  const [uploading, setUploading]   = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // ── Form helpers ─────────────────────────────────────────────────────────
  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: undefined }));
  };

  // ── Step validation ───────────────────────────────────────────────────────
  const validateStep = (s) => {
    const e = {};
    if (s === 0) {
      if (!form.full_name.trim()) e.full_name = 'Full name is required.';
      if (!form.email.trim() && !form.phone.trim() && !form.ahadi_number.trim())
        e.email = 'At least an email, phone, or ahadi number is required.';
      else if (form.email.trim() && !/\S+@\S+\.\S+/.test(form.email))
        e.email = 'Enter a valid email address.';
    }
    if (s === 6) {
      if (!form.autoPassword && form.password.length < 6)
        e.password = 'Password must be at least 6 characters.';
    }
    return e;
  };

  const goNext = () => {
    const e = validateStep(step);
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    setStep(s => Math.min(s + 1, WIZARD_STEPS.length - 1));
  };
  const goBack = () => { setErrors({}); setStep(s => Math.max(s - 1, 0)); };

  // ── Dependants helpers ────────────────────────────────────────────────────
  const addDependant    = ()        => setDependants(d => [...d, { ...EMPTY_DEPENDANT }]);
  const removeDependant = (i)       => setDependants(d => d.filter((_, idx) => idx !== i));
  const updateDependant = (i, k, v) => setDependants(d =>
    d.map((dep, idx) => idx === i ? { ...dep, [k]: v } : dep)
  );

  // ── Final submit ──────────────────────────────────────────────────────────
  const handleSingleSubmit = async () => {
    const e = validateStep(6);
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      const payload = {
        full_name:                form.full_name.trim()              || undefined,
        email:                    form.email.trim()                  || undefined,
        phone:                    form.phone.trim()                  || undefined,
        role:                     form.role,
        namba_ya_usharika:        form.namba_ya_usharika.trim()      || undefined,
        ahadi_number:             form.ahadi_number.trim()           || undefined,
        gender:                   form.gender                        || undefined,
        date_of_birth:            form.date_of_birth                 || undefined,
        place_of_birth:           form.place_of_birth.trim()         || undefined,
        marital_status:           form.marital_status                || undefined,
        marriage_type:            form.marriage_type                 || undefined,
        marriage_date:            form.marriage_date                 || undefined,
        marriage_place:           form.marriage_place.trim()         || undefined,
        spouse_name:              form.spouse_name.trim()            || undefined,
        spouse_phone:             form.spouse_phone.trim()           || undefined,
        cohabiting_partner_name:  form.cohabiting_partner_name.trim()|| undefined,
        occupation:               form.occupation.trim()             || undefined,
        workplace:                form.workplace.trim()              || undefined,
        education:                form.education.trim()              || undefined,
        profession:               form.profession.trim()             || undefined,
        willing_to_volunteer:     form.willing_to_volunteer === ''
                                    ? undefined
                                    : form.willing_to_volunteer === 'true',
        jumuiya:                  form.jumuiya.trim()                || undefined,
        block_no:                 form.block_no.trim()               || undefined,
        area_name:                form.area_name.trim()              || undefined,
        slp:                      form.slp.trim()                    || undefined,
        neighbour_member_name:    form.neighbour_member_name.trim()  || undefined,
        neighbour_member_phone:   form.neighbour_member_phone.trim() || undefined,
        elder_name:               form.elder_name.trim()             || undefined,
        elder_phone:              form.elder_phone.trim()            || undefined,
        previous_church:          form.previous_church.trim()        || undefined,
        dependants: dependants
          .filter(d => d.full_name.trim())
          .map(({ full_name, date_of_birth, relationship }) => ({
            full_name,
            date_of_birth:  date_of_birth  || undefined,
            relationship:   relationship   || undefined,
          })),
        password: form.autoPassword ? undefined : form.password,
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

  // ── Bulk helpers ──────────────────────────────────────────────────────────
  const processFile = useCallback(async (file) => {
    setParseError(''); setBulkRows(null); setBulkFile(null);
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      setParseError('Upload an Excel (.xlsx/.xls) or CSV file.'); return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setParseError('File is too large. Max 5 MB.'); return;
    }
    try {
      const buffer    = await file.arrayBuffer();
      const parsed    = parseWorkbook(buffer);
      const validated = validateRows(parsed);
      setBulkRows(validated);
      setBulkFile(file);
    } catch (err) { setParseError(err.message); }
  }, []);

  const handleFileInput = e => processFile(e.target.files[0]);
  const handleDrop = e => {
    e.preventDefault(); setIsDragging(false);
    processFile(e.dataTransfer.files[0]);
  };
  const removeRow = idx => setBulkRows(r => {
    const n = r.filter((_, i) => i !== idx);
    return n.length ? n : null;
  });

  const handleBulkUpload = async () => {
    if (!bulkRows?.length) return;
    const validRows = bulkRows.filter(r => !r._errors?.length);
    if (!validRows.length) {
      setParseError('All rows have errors. Fix the file and re-upload.'); return;
    }
    setUploading(true);
    try {
      // Strip internal tracking keys before sending
      const payload = validRows.map(({ _row, _errors, _sheet, ...u }) => u);
      const res = await authApi.adminBulkCreate({ users: payload });
      setBulkResult(res.data);
      onAdded?.();
    } catch (err) {
      setParseError(err?.response?.data?.message ?? err?.message ?? 'Something went wrong.');
    } finally { setUploading(false); }
  };

  const resetBulk = () => {
    setBulkRows(null); setBulkFile(null);
    setParseError(''); setBulkResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Derived flags ─────────────────────────────────────────────────────────
  const isMarried    = ['Ameoa', 'Ameolewa'].includes(form.marital_status);
  const isCohabiting = form.marital_status === 'Tengana';

  // ── Success screen ────────────────────────────────────────────────────────
  if (result) return (
    <div className="modal-overlay">
      <div className="modal max-w-md">
        <div className="px-6 py-8 text-center">
          <div className="w-14 h-14 rounded-full bg-[var(--success-bg)] flex items-center justify-center mx-auto mb-4">
            <Icon path={ICONS.check} size={24} className="text-[var(--success)]" />
          </div>
          <h2 className="card-title mb-1">Member Added</h2>
          <p className="text-sm text-[var(--text-secondary)] mb-5">
            <span className="font-medium text-[var(--text-primary)]">{result.name}</span> has been added and can now log in.
          </p>

          {result.temporaryPassword && (
            <div className="banner banner-gold text-left mb-5">
              <div className="w-full">
                <p className="text-xs font-semibold mb-2 uppercase tracking-wide">
                  Temporary password — share with member
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 input font-mono text-sm truncate h-9 flex items-center px-3">
                    {result.temporaryPassword}
                  </code>
                  <button onClick={copyPassword}
                    className="btn btn-secondary btn-sm btn-icon" title="Copy">
                    {copied
                      ? <Icon path={ICONS.check} size={14} className="text-[var(--success)]" />
                      : <Icon path={ICONS.copy} size={14} />}
                  </button>
                </div>
                {result.email && (
                  <p className="text-xs mt-2 opacity-80">
                    A welcome email has been sent to {result.email}.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => { setForm(EMPTY_FORM); setDependants([]); setResult(null); setStep(0); }}
              className="btn btn-secondary flex-1">
              Add another
            </button>
            <button onClick={onClose} className="btn btn-primary flex-1">Done</button>
          </div>
        </div>
      </div>
    </div>
  );

  // ── Main modal ────────────────────────────────────────────────────────────
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: '600px' }}>

        {/* Header */}
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Add Member</h2>
            <p className="card-subtitle mt-0.5">Members will be immediately active — no approval needed.</p>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon btn-sm">
            <Icon path={ICONS.x} size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="tabs px-6 pt-2">
          {[
            { id: 'single', label: 'Single member', icon: ICONS.user },
            { id: 'bulk',   label: 'Bulk upload',   icon: ICONS.users },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`tab ${tab === t.id ? 'active' : ''}`}>
              <Icon path={t.icon} size={14} />
              {t.label}
            </button>
          ))}
        </div>

        {/* ── SINGLE TAB ──────────────────────────────────────────────────── */}
        {tab === 'single' && (
          <>
            <StepBar steps={WIZARD_STEPS} current={step} />

            {/* Step header */}
            <div className="px-6 pt-4 pb-1 flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[var(--navy-50)] flex items-center justify-center flex-shrink-0">
                <Icon path={WIZARD_STEPS[step].icon} size={14} className="text-[var(--navy)]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">{WIZARD_STEPS[step].label}</h3>
                <p className="text-xs text-[var(--text-tertiary)]">Step {step + 1} of {WIZARD_STEPS.length}</p>
              </div>
            </div>

            <div className="modal-body space-y-4">

              {errors._global && (
                <div className="banner banner-danger">
                  <Icon path={ICONS.alert} size={15} className="flex-shrink-0 mt-0.5" />
                  <span>{errors._global}</span>
                </div>
              )}

              {/* ── Step 0: Account basics ─────────────────────────────── */}
              {step === 0 && (
                <>
                  <SectionLabel>Required</SectionLabel>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Full name *" error={errors.full_name}>
                      <TextInput
                        value={form.full_name}
                        onChange={e => set('full_name', e.target.value)}
                        placeholder="Maria Joseph"
                      />
                    </Field>
                    <Field label="Phone" error={!form.email.trim() && !form.phone.trim() && !form.ahadi_number.trim() ? errors.email : undefined}>
                      <TextInput
                        type="tel"
                        value={form.phone}
                        onChange={e => set('phone', e.target.value)}
                        placeholder="+255 700 000 000"
                      />
                    </Field>
                  </div>

                  <Field
                    label="Email"
                    error={form.email.trim() ? errors.email : undefined}
                    hint="At least one of email, phone, or ahadi number is required.">
                    <TextInput
                      type="email"
                      value={form.email}
                      onChange={e => set('email', e.target.value)}
                      placeholder="maria@example.com (optional)"
                    />
                  </Field>

                  {/* Show root identifier error only when all three are empty */}
                  {!form.email.trim() && !form.phone.trim() && !form.ahadi_number.trim() && errors.email && (
                    <p className="form-error -mt-2">{errors.email}</p>
                  )}

                  <div className="divider" />
                  <SectionLabel>Church records</SectionLabel>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field
                      label="Ahadi Number"
                      hint="Unique pledge number from church register (e.g. 5, 100)">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">
                          <Icon path={ICONS.hash} size={13} />
                        </span>
                        <TextInput
                          value={form.ahadi_number}
                          onChange={e => set('ahadi_number', e.target.value)}
                          placeholder="e.g. 5"
                          className="pl-7"
                        />
                      </div>
                    </Field>
                    <Field label="Namba ya usharika">
                      <TextInput
                        value={form.namba_ya_usharika}
                        onChange={e => set('namba_ya_usharika', e.target.value)}
                        placeholder="U-001"
                      />
                    </Field>
                  </div>
                  <Field label="Role">
                    <SelectInput value={form.role} onChange={e => set('role', e.target.value)}>
                      <option value="member">Member</option>
                      <option value="group_leader">Group Leader</option>
                      <option value="elder">Elder</option>
                      <option value="pastor">Pastor</option>
                    </SelectInput>
                  </Field>
                </>
              )}

              {/* ── Step 1: Personal ──────────────────────────────────── */}
              {step === 1 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Gender">
                    <SelectInput value={form.gender} onChange={e => set('gender', e.target.value)}>
                      <option value="">— Select —</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </SelectInput>
                  </Field>
                  <Field label="Date of birth">
                    <TextInput type="date" value={form.date_of_birth}
                      onChange={e => set('date_of_birth', e.target.value)} />
                  </Field>
                  <Field label="Place of birth" className="sm:col-span-2">
                    <TextInput value={form.place_of_birth}
                      onChange={e => set('place_of_birth', e.target.value)}
                      placeholder="e.g. Dar es Salaam" />
                  </Field>
                </div>
              )}

              {/* ── Step 2: Marital ───────────────────────────────────── */}
              {step === 2 && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Marital status">
                      <SelectInput value={form.marital_status} onChange={e => set('marital_status', e.target.value)}>
                        <option value="">— Select —</option>
                        <option value="Ameoa">Ameoa (Married — Male)</option>
                        <option value="Ameolewa">Ameolewa (Married — Female)</option>
                        <option value="Hajaoa">Hajaoa (Single — Male)</option>
                        <option value="Hajaolewa">Hajaolewa (Single — Female)</option>
                        <option value="Mjane">Mjane (Widower — Male)</option>
                        <option value="Mgane">Mgane (Widow — Female)</option>
                        <option value="Talikiwa">Talikiwa (Divorced)</option>
                        <option value="Tengana">Tengana (Separated / Cohabiting)</option>
                      </SelectInput>
                    </Field>
                    <Field label="Marriage type">
                      <SelectInput value={form.marriage_type} onChange={e => set('marriage_type', e.target.value)}>
                        <option value="">— Select —</option>
                        <option value="Kikristo">Kikristo (Christian)</option>
                        <option value="Siya Kikristo">Siya Kikristo (Non-Christian)</option>
                      </SelectInput>
                    </Field>
                  </div>

                  {isMarried && (
                    <>
                      <div className="divider" />
                      <SectionLabel>Spouse information</SectionLabel>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="Spouse name">
                          <TextInput value={form.spouse_name}
                            onChange={e => set('spouse_name', e.target.value)}
                            placeholder="Full name" />
                        </Field>
                        <Field label="Spouse phone">
                          <TextInput type="tel" value={form.spouse_phone}
                            onChange={e => set('spouse_phone', e.target.value)}
                            placeholder="+255 700 000 000" />
                        </Field>
                        <Field label="Marriage date">
                          <TextInput type="date" value={form.marriage_date}
                            onChange={e => set('marriage_date', e.target.value)} />
                        </Field>
                        <Field label="Marriage place">
                          <TextInput value={form.marriage_place}
                            onChange={e => set('marriage_place', e.target.value)}
                            placeholder="e.g. Kanisa Kuu" />
                        </Field>
                      </div>
                    </>
                  )}

                  {isCohabiting && (
                    <>
                      <div className="divider" />
                      <SectionLabel>Partner information</SectionLabel>
                      <Field label="Partner name">
                        <TextInput value={form.cohabiting_partner_name}
                          onChange={e => set('cohabiting_partner_name', e.target.value)}
                          placeholder="Full name" />
                      </Field>
                    </>
                  )}
                </>
              )}

              {/* ── Step 3: Professional ─────────────────────────────── */}
              {step === 3 && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Occupation">
                      <TextInput value={form.occupation}
                        onChange={e => set('occupation', e.target.value)}
                        placeholder="e.g. Teacher" />
                    </Field>
                    <Field label="Workplace">
                      <TextInput value={form.workplace}
                        onChange={e => set('workplace', e.target.value)}
                        placeholder="e.g. Shule ya Sekondari" />
                    </Field>
                    <Field label="Education level">
                      <TextInput value={form.education}
                        onChange={e => set('education', e.target.value)}
                        placeholder="e.g. Bachelor's Degree" />
                    </Field>
                    <Field label="Profession / Skill">
                      <TextInput value={form.profession}
                        onChange={e => set('profession', e.target.value)}
                        placeholder="e.g. Electrician" />
                    </Field>
                  </div>
                  <div className="divider" />
                  <Field label="Willing to volunteer?">
                    <SelectInput value={form.willing_to_volunteer}
                      onChange={e => set('willing_to_volunteer', e.target.value)}>
                      <option value="">— Not specified —</option>
                      <option value="true">Yes — Ndio</option>
                      <option value="false">No — Hapana</option>
                    </SelectInput>
                  </Field>
                </>
              )}

              {/* ── Step 4: Residence ─────────────────────────────────── */}
              {step === 4 && (
                <>
                  <SectionLabel>Location</SectionLabel>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Jumuiya">
                      <TextInput
                        list="jumuiya-options"
                        value={form.jumuiya}
                        onChange={e => set('jumuiya', e.target.value)}
                        placeholder="Select or type jumuiya…"
                      />
                      <datalist id="jumuiya-options">
                        {JUMUIYA_LIST.map(j => <option key={j} value={j} />)}
                      </datalist>
                    </Field>
                    <Field label="Block no.">
                      <TextInput value={form.block_no}
                        onChange={e => set('block_no', e.target.value)}
                        placeholder="e.g. B-12" />
                    </Field>
                    <Field label="Area / Mtaa">
                      <TextInput value={form.area_name}
                        onChange={e => set('area_name', e.target.value)}
                        placeholder="e.g. Kinondoni" />
                    </Field>
                    <Field label="S.L.P (P.O. Box)">
                      <TextInput value={form.slp}
                        onChange={e => set('slp', e.target.value)}
                        placeholder="e.g. S.L.P 1234" />
                    </Field>
                  </div>

                  <div className="divider" />
                  <SectionLabel>Local contacts</SectionLabel>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Neighbour member name">
                      <TextInput value={form.neighbour_member_name}
                        onChange={e => set('neighbour_member_name', e.target.value)}
                        placeholder="Full name" />
                    </Field>
                    <Field label="Neighbour member phone">
                      <TextInput type="tel" value={form.neighbour_member_phone}
                        onChange={e => set('neighbour_member_phone', e.target.value)}
                        placeholder="+255 700 000 000" />
                    </Field>
                    <Field label="Elder name (Mzee)">
                      <TextInput value={form.elder_name}
                        onChange={e => set('elder_name', e.target.value)}
                        placeholder="Full name" />
                    </Field>
                    <Field label="Elder phone">
                      <TextInput type="tel" value={form.elder_phone}
                        onChange={e => set('elder_phone', e.target.value)}
                        placeholder="+255 700 000 000" />
                    </Field>
                  </div>

                  <div className="divider" />
                  <Field label="Previous church">
                    <TextInput value={form.previous_church}
                      onChange={e => set('previous_church', e.target.value)}
                      placeholder="e.g. KKKT Dar es Salaam" />
                  </Field>
                </>
              )}

              {/* ── Step 5: Dependants ───────────────────────────────── */}
              {step === 5 && (
                <>
                  {dependants.length === 0 ? (
                    <div className="empty-state py-8">
                      <Icon path={ICONS.baby} size={36} className="empty-state-icon" />
                      <p className="empty-state-title">No dependants yet</p>
                      <p className="empty-state-body">
                        Add children or other family members who depend on this member.
                      </p>
                      <div className="empty-state-actions">
                        <button type="button" onClick={addDependant} className="btn btn-secondary">
                          <Icon path={ICONS.plus} size={14} />
                          Add dependant
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3">
                        {dependants.map((dep, i) => (
                          <DependantRow key={i} dep={dep} idx={i}
                            onChange={updateDependant} onRemove={removeDependant} />
                        ))}
                      </div>
                      <button type="button" onClick={addDependant}
                        className="btn btn-secondary w-full mt-1">
                        <Icon path={ICONS.plus} size={14} />
                        Add another dependant
                      </button>
                    </>
                  )}
                </>
              )}

              {/* ── Step 6: Password ─────────────────────────────────── */}
              {step === 6 && (
                <>
                  <label className="field-row cursor-pointer mb-1">
                    <input type="checkbox" className="checkbox"
                      checked={form.autoPassword}
                      onChange={e => set('autoPassword', e.target.checked)} />
                    <span>Auto-generate a temporary password</span>
                  </label>

                  {form.autoPassword ? (
                    <div className="banner banner-gold">
                      <Icon path={ICONS.key} size={15} className="flex-shrink-0 mt-0.5" />
                      <p className="text-sm">
                        A random password will be generated and shown after saving.
                        The member will also receive it by email if one was provided.
                      </p>
                    </div>
                  ) : (
                    <Field label="Password" error={errors.password}>
                      <div className="input-group">
                        <TextInput
                          type={showPw ? 'text' : 'password'}
                          value={form.password}
                          onChange={e => set('password', e.target.value)}
                          placeholder="Min. 6 characters"
                          className="pr-10"
                        />
                        <button type="button" onClick={() => setShowPw(s => !s)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition">
                          <Icon path={showPw ? ICONS.eyeOff : ICONS.eye} size={15} />
                        </button>
                      </div>
                    </Field>
                  )}
                </>
              )}
            </div>

            {/* Wizard footer */}
            <div className="modal-footer">
              {step > 0 && (
                <button onClick={goBack} className="btn btn-ghost mr-auto">
                  <Icon path={ICONS.chevronL} size={14} />
                  Back
                </button>
              )}
              <button onClick={onClose} className="btn btn-secondary">Cancel</button>
              {step < WIZARD_STEPS.length - 1 ? (
                <button onClick={goNext} className="btn btn-primary">
                  Next
                  <Icon path={ICONS.chevronR} size={14} />
                </button>
              ) : (
                <button onClick={handleSingleSubmit} disabled={saving} className="btn btn-primary">
                  {saving && (
                    <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  )}
                  {saving ? 'Adding…' : 'Add member'}
                </button>
              )}
            </div>
          </>
        )}

        {/* ── BULK TAB ────────────────────────────────────────────────────── */}
        {tab === 'bulk' && (
          <>
            {bulkResult ? (
              <BulkResultsSummary
                summary={bulkResult.summary}
                results={bulkResult.results}
                onClose={onClose}
                onReset={resetBulk}
              />
            ) : (
              <>
                <div className="modal-body space-y-4">

                  {/* Template download */}
                  <div className="card card-body flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm text-[var(--text-primary)]">Download template</p>
                      <p className="form-hint mt-0.5">
                        Fill in the spreadsheet, then upload below.
                        Your KKKT Excel file (.xlsx) is also accepted directly.
                      </p>
                    </div>
                    <button onClick={downloadTemplate} className="btn btn-secondary btn-sm">
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
                      className={`border-2 border-dashed rounded-lg px-6 py-10 flex flex-col items-center text-center cursor-pointer transition
                        ${isDragging
                          ? 'border-[var(--gold)] bg-[var(--gold-subtle)]'
                          : 'border-[var(--border-default)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-page)]'}`}
                    >
                      <div className="w-10 h-10 rounded-full bg-[var(--surface-page)] flex items-center justify-center mb-3">
                        <Icon path={ICONS.upload} size={18} className="text-[var(--text-tertiary)]" />
                      </div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        Drop your file here, or{' '}
                        <span className="text-[var(--gold)] underline underline-offset-2">browse</span>
                      </p>
                      <p className="form-hint mt-1">
                        .xlsx, .xls, or .csv · up to 200 members · 5 MB max
                      </p>
                      <p className="form-hint mt-0.5">
                        KKKT Excel (WANAUME &amp; WANAWAKE sheets) processed automatically
                      </p>
                      <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv"
                        onChange={handleFileInput} className="hidden" />
                    </div>
                  )}

                  {parseError && (
                    <div className="banner banner-danger">
                      <Icon path={ICONS.alert} size={15} className="flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">Could not read file</p>
                        <p className="text-xs mt-0.5 opacity-80">{parseError}</p>
                      </div>
                    </div>
                  )}

                  {bulkRows && (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="stat-label">Preview — {bulkFile?.name}</p>
                        <button onClick={resetBulk}
                          className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] underline underline-offset-2 transition">
                          Replace file
                        </button>
                      </div>
                      <BulkPreviewTable rows={bulkRows} onRemove={removeRow} />
                    </>
                  )}
                </div>

                <div className="modal-footer">
                  <button onClick={onClose} className="btn btn-secondary">Cancel</button>
                  <button
                    onClick={handleBulkUpload}
                    disabled={!bulkRows || uploading || bulkRows.filter(r => !r._errors?.length).length === 0}
                    className="btn btn-primary"
                  >
                    {uploading && (
                      <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
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