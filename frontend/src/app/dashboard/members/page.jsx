'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useTranslation } from '../../../lib/i18n';
import { userApi, dependantApi, ministryApi } from '../../../lib/api';
import PageHeader from '../../../components/ui/PageHeader';
import Modal from '../../../components/ui/Modal';
import Toast from '../../../components/ui/Toast';
import { JUMUIYA_LIST } from '../../../lib/constants';
import RoleBadge from '../../../components/ui/RoleBadge';
import AdminAddMemberModal from '../../../components/members/AdminMemberModal';

// ─── Constants ────────────────────────────────────────────────────────────────
const PROFILE_TABS = [
  { id: 'overview',     label: 'Overview',     icon: '◉' },
  { id: 'personal',     label: 'Personal',     icon: '👤' },
  { id: 'marital',      label: 'Marital',      icon: '💍' },
  { id: 'professional', label: 'Professional', icon: '💼' },
  { id: 'residence',    label: 'Residence',    icon: '🏠' },
  { id: 'dependants',   label: 'Dependants',   icon: '👨‍👩‍👧' },
];

const GENDER_OPTIONS        = ['Male', 'Female'];
const MEMBER_STATUS_OPTIONS = [
  { value: 'hai',       label: 'Hai (Active)' },
  { value: 'amehamia',  label: 'Amehamia (Transferred)' },
  { value: 'amefariki', label: 'Amefariki (Deceased)' },
];
const MARITAL_OPTIONS = [
  { value: 'Ameoa',       label: 'Ameoa (Married ♂)' },
  { value: 'Hajaoa',      label: 'Hajaoa (Single ♂)' },
  { value: 'Ameolewa',    label: 'Ameolewa (Married ♀)' },
  { value: 'Hajaolewa',   label: 'Hajaolewa (Single ♀)' },
  { value: 'Mjane',       label: 'Mjane (Widower ♂)' },
  { value: 'Mgane',       label: 'Mgane (Widow ♀)' },
  { value: 'Talikiwa',    label: 'Talikiwa (Divorced)' },
  { value: 'Tengana',     label: 'Tengana (Separated)' },
];
const MARRIAGE_TYPE_OPTIONS = [
  { value: 'Kikristo',      label: 'Kikristo (Christian)' },
  { value: 'Siya Kikristo', label: 'Siya Kikristo (Non-Christian)' },
];
const ROLE_OPTIONS = ['member', 'group_leader', 'elder', 'pastor'];

function statusColor(status) {
  if (status === 'amefariki') return 'danger';
  if (status === 'amehamia')  return 'warning';
  return 'success';
}

function statusLabel(status) {
  const found = MEMBER_STATUS_OPTIONS.find(o => o.value === status);
  return found ? found.label : (status || 'Hai');
}

// ─── Photo Lightbox ───────────────────────────────────────────────────────────
function PhotoLightbox({ member, onClose }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div onClick={onClose} className="modal-overlay" style={{ flexDirection: 'column' }}>
      <button onClick={onClose} className="btn btn-ghost-inverse btn-icon" style={{ position: 'absolute', top: 20, right: 24 }}>
        ✕
      </button>
      <img
        src={member.profile_photo_url}
        alt={member.full_name}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 'min(520px, 90vw)', maxHeight: '72vh',
          borderRadius: 16, objectFit: 'contain',
          border: '2px solid rgba(255,255,255,0.12)',
        }}
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
      <div className="text-center" style={{ marginTop: 18 }}>
        <p className="text-sm font-semibold text-white" style={{ margin: 0 }}>{member.full_name}</p>
        <p className="text-xs" style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.5)' }}>{member.email}</p>
      </div>
    </div>
  );
}

// ─── Field helpers ────────────────────────────────────────────────────────────
function FieldInput({ label, value, onChange, type = 'text', placeholder, required, listId }) {
  return (
    <div className="form-group">
      <label className="form-label">
        {label}{required && <span style={{ color: 'var(--danger)' }}> *</span>}
      </label>
      <input
        type={type}
        value={value || ''}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        list={listId}
        className="input"
      />
    </div>
  );
}

function FieldSelect({ label, value, onChange, options, placeholder }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <select value={value || ''} onChange={onChange} className="select">
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) =>
          typeof o === 'string'
            ? <option key={o} value={o}>{o}</option>
            : <option key={o.value} value={o.value}>{o.label}</option>
        )}
      </select>
    </div>
  );
}

function FieldCheckbox({ label, checked, onChange }) {
  return (
    <label className="field-row" style={{ cursor: 'pointer' }}>
      <input type="checkbox" checked={!!checked} onChange={onChange} className="checkbox" />
      <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{label}</span>
    </label>
  );
}

function Grid2({ children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>
      {children}
    </div>
  );
}

function SectionDivider({ title }) {
  return <div className="divider-label" style={{ margin: '20px 0 14px' }}>{title}</div>;
}

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 py-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <span className="text-xs" style={{ color: 'var(--text-tertiary)', minWidth: 140, flexShrink: 0 }}>{label}</span>
      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

// ─── Dependants Mini-Manager ──────────────────────────────────────────────────
function DependantsTab({ memberId }) {
  const [deps, setDeps]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding]   = useState(false);
  const [newDep, setNewDep]   = useState({ full_name: '', date_of_birth: '', relationship: '' });
  const [saving, setSaving]   = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await dependantApi.getAll(memberId);
      setDeps(res.data.data || []);
    } catch (_) {}
    finally { setLoading(false); }
  }, [memberId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!newDep.full_name.trim()) return;
    try {
      setSaving(true);
      await dependantApi.add(memberId, newDep);
      setAdding(false);
      setNewDep({ full_name: '', date_of_birth: '', relationship: '' });
      load();
    } catch (_) {}
    finally { setSaving(false); }
  };

  const handleRemove = async (depId) => {
    try {
      await dependantApi.remove(memberId, depId);
      load();
    } catch (_) {}
  };

  if (loading) return (
    <div className="empty-state">
      <div className="skeleton" style={{ width: 120, height: 16, borderRadius: 8 }} />
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
        <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
          {deps.length} dependant{deps.length !== 1 ? 's' : ''} recorded
        </span>
        <button onClick={() => setAdding(true)} className="btn btn-primary btn-sm">+ Add</button>
      </div>

      {deps.length === 0 && !adding && (
        <div className="empty-state" style={{ border: '1.5px dashed var(--border-default)', borderRadius: 10 }}>
          <span className="empty-state-icon">👨‍👩‍👧</span>
          <p className="empty-state-body">No dependants recorded yet</p>
        </div>
      )}

      {deps.map((d) => (
        <div
          key={d.id}
          className="flex items-center justify-between"
          style={{
            padding: '10px 14px', background: 'var(--surface-page)',
            borderRadius: 8, marginBottom: 8, border: '1px solid var(--border-subtle)',
          }}
        >
          <div>
            <p className="text-sm font-semibold" style={{ margin: 0, color: 'var(--text-primary)' }}>{d.full_name}</p>
            <p className="text-xs" style={{ margin: '2px 0 0', color: 'var(--text-tertiary)' }}>
              {d.relationship && `${d.relationship}`}
              {d.relationship && d.date_of_birth && ' · '}
              {d.date_of_birth && `Born ${d.date_of_birth}`}
            </p>
          </div>
          <button
            onClick={() => handleRemove(d.id)}
            className="btn btn-ghost btn-sm btn-icon"
            style={{ color: 'var(--text-disabled)', fontSize: 16 }}
          >×</button>
        </div>
      ))}

      {adding && (
        <div
          style={{
            marginTop: 8, padding: 16,
            background: 'color-mix(in srgb, var(--navy) 6%, white)',
            borderRadius: 10,
            border: '1.5px solid color-mix(in srgb, var(--navy) 15%, transparent)',
          }}
        >
          <p className="form-label" style={{ marginBottom: 12 }}>New Dependant</p>
          <Grid2>
            <FieldInput label="Full Name" value={newDep.full_name} onChange={(e) => setNewDep(p => ({ ...p, full_name: e.target.value }))} required />
            <FieldInput label="Relationship" value={newDep.relationship} placeholder="e.g. Mtoto, Ndugu" onChange={(e) => setNewDep(p => ({ ...p, relationship: e.target.value }))} />
          </Grid2>
          <div style={{ marginTop: 10 }}>
            <FieldInput label="Date of Birth" type="date" value={newDep.date_of_birth} onChange={(e) => setNewDep(p => ({ ...p, date_of_birth: e.target.value }))} />
          </div>
          <div className="flex gap-2 justify-end" style={{ marginTop: 14 }}>
            <button onClick={() => setAdding(false)} className="btn btn-secondary btn-sm">Cancel</button>
            <button
              onClick={handleAdd}
              disabled={saving || !newDep.full_name.trim()}
              className="btn btn-primary btn-sm"
            >{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Profile Edit Modal (Multi-tab) ──────────────────────────────────────────
function ProfileModal({ member, user, lang, onClose, onSaved }) {
  const [tab, setTab]       = useState('overview');
  const [form, setForm]     = useState({ ...member });
  const [saving, setSaving] = useState(false);
  const [toast, setToast]   = useState(null);

  const set      = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));
  const setCheck = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.checked ? 1 : 0 }));

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await userApi.update(form.id, {
        full_name:                form.full_name,
        phone:                    form.phone,
        role:                     form.role,
        gender:                   form.gender,
        date_of_birth:            form.date_of_birth,
        place_of_birth:           form.place_of_birth,
        member_status:            form.member_status,
        marital_status:           form.marital_status,
        marriage_type:            form.marriage_type,
        marriage_date:            form.marriage_date,
        marriage_place:           form.marriage_place,
        spouse_name:              form.spouse_name,
        spouse_phone:             form.spouse_phone,
        cohabiting_partner_name:  form.cohabiting_partner_name,
        occupation:               form.occupation,
        workplace:                form.workplace,
        education:                form.education,
        profession:               form.profession,
        willing_to_volunteer:     form.willing_to_volunteer,
        jumuiya:                  form.jumuiya,
        block_no:                 form.block_no,
        area_name:                form.area_name,
        slp:                      form.slp,
        neighbour_member_name:    form.neighbour_member_name,
        neighbour_member_phone:   form.neighbour_member_phone,
        elder_name:               form.elder_name,
        elder_phone:              form.elder_phone,
        previous_church:          form.previous_church,
      });
      showToast('Profile saved');
      onSaved();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const sc = statusColor(form.member_status);

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} className="modal-overlay">
      <div onClick={(e) => e.stopPropagation()} className="modal" style={{ maxWidth: 760, maxHeight: '92vh' }}>

        {/* Modal Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px',
          background: 'linear-gradient(135deg, var(--navy-dark) 0%, var(--navy) 100%)',
          borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
        }}>
          <div className="flex items-center gap-3">
            {form.profile_photo_url ? (
              <img
                src={form.profile_photo_url}
                alt={form.full_name}
                style={{ width: 46, height: 46, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.25)' }}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <div className="avatar avatar-md" style={{ width: 46, height: 46, fontSize: 18, background: 'rgba(255,255,255,0.12)', border: '2px solid rgba(255,255,255,0.2)', color: '#fff' }}>
                {form.full_name?.[0]?.toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-sm font-bold text-white" style={{ margin: 0 }}>{form.full_name}</p>
              <div className="flex items-center gap-2" style={{ marginTop: 3 }}>
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{form.email}</span>
                <span className={`badge badge-${sc}`}>
                  <span className={`status-dot ${sc}`} />
                  {statusLabel(form.member_status || 'hai')}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost-inverse btn-icon btn-sm">×</button>
        </div>

        {/* Tab Bar */}
        <div className="tabs-pill" style={{ padding: '0 24px', background: 'var(--surface-page)', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
          {PROFILE_TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`tab-pill ${tab === t.id ? 'active' : ''}`}>
              <span style={{ fontSize: 13 }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Body */}
        <form onSubmit={handleSave} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* ── OVERVIEW ── */}
          {tab === 'overview' && (
            <div>
              <Grid2>
                <FieldInput label="Full Name" value={form.full_name} onChange={set('full_name')} required />
                <FieldInput label="Phone" value={form.phone} onChange={set('phone')} />
              </Grid2>
              <div style={{ marginTop: 14 }}>
                <FieldInput label="Email" value={form.email} onChange={set('email')} type="email" />
              </div>
              {user?.role === 'pastor' && (
                <>
                  <SectionDivider title="System Role" />
                  <FieldSelect label="Role" value={form.role} onChange={set('role')} options={ROLE_OPTIONS} />
                </>
              )}
              <SectionDivider title="Member Status" />
              <Grid2>
                <FieldSelect label="Status" value={form.member_status} onChange={set('member_status')} options={MEMBER_STATUS_OPTIONS} />
                <FieldSelect label="Gender" value={form.gender} onChange={set('gender')} options={GENDER_OPTIONS} placeholder="Select gender" />
              </Grid2>
              {form.group_name && (
                <>
                  <SectionDivider title="Group" />
                  <InfoRow label="Current Group" value={form.group_name} />
                </>
              )}
            </div>
          )}

          {/* ── PERSONAL ── */}
          {tab === 'personal' && (
            <div>
              <SectionDivider title="Birth Information" />
              <Grid2>
                <FieldInput label="Date of Birth" type="date" value={form.date_of_birth} onChange={set('date_of_birth')} />
                <FieldInput label="Place of Birth" value={form.place_of_birth} onChange={set('place_of_birth')} placeholder="City / Town" />
              </Grid2>
            </div>
          )}

          {/* ── MARITAL ── */}
          {tab === 'marital' && (
            <div>
              <SectionDivider title="Marital Status" />
              <Grid2>
                <FieldSelect label="Marital Status" value={form.marital_status} onChange={set('marital_status')} options={MARITAL_OPTIONS} placeholder="Select status" />
                <FieldSelect label="Marriage Type" value={form.marriage_type} onChange={set('marriage_type')} options={MARRIAGE_TYPE_OPTIONS} placeholder="Select type" />
              </Grid2>
              <SectionDivider title="Marriage Details" />
              <Grid2>
                <FieldInput label="Marriage Date" type="date" value={form.marriage_date} onChange={set('marriage_date')} />
                <FieldInput label="Marriage Place" value={form.marriage_place} onChange={set('marriage_place')} placeholder="Church / City" />
              </Grid2>
              <SectionDivider title="Spouse / Partner" />
              <Grid2>
                <FieldInput label="Spouse Name" value={form.spouse_name} onChange={set('spouse_name')} />
                <FieldInput label="Spouse Phone" value={form.spouse_phone} onChange={set('spouse_phone')} />
              </Grid2>
              <div style={{ marginTop: 14 }}>
                <FieldInput label="Cohabiting Partner Name" value={form.cohabiting_partner_name} onChange={set('cohabiting_partner_name')} placeholder="If applicable" />
              </div>
            </div>
          )}

          {/* ── PROFESSIONAL ── */}
          {tab === 'professional' && (
            <div>
              <SectionDivider title="Employment" />
              <Grid2>
                <FieldInput label="Occupation" value={form.occupation} onChange={set('occupation')} placeholder="e.g. Teacher, Nurse" />
                <FieldInput label="Workplace" value={form.workplace} onChange={set('workplace')} placeholder="Employer / Company" />
              </Grid2>
              <SectionDivider title="Education & Skills" />
              <Grid2>
                <FieldInput label="Education Level" value={form.education} onChange={set('education')} placeholder="e.g. Bachelor's, Form 4" />
                <FieldInput label="Profession / Skill" value={form.profession} onChange={set('profession')} placeholder="e.g. Engineer, Accountant" />
              </Grid2>
              <SectionDivider title="Church Volunteering" />
              <FieldCheckbox label="Willing to volunteer in church ministry" checked={form.willing_to_volunteer} onChange={setCheck('willing_to_volunteer')} />
            </div>
          )}

          {/* ── RESIDENCE ── */}
          {tab === 'residence' && (
            <div>
              <SectionDivider title="Address" />
              <Grid2>
                <>
                  <FieldInput label="Jumuiya" value={form.jumuiya} onChange={set('jumuiya')} placeholder="Select or type jumuiya…" listId="jumuiya-options" />
                  <datalist id="jumuiya-options">
                    {JUMUIYA_LIST.map(j => <option key={j} value={j} />)}
                  </datalist>
                </>
                <FieldInput label="Block No." value={form.block_no} onChange={set('block_no')} placeholder="e.g. B-12" />
              </Grid2>
              <Grid2>
                <FieldInput label="Area Name" value={form.area_name} onChange={set('area_name')} placeholder="Neighbourhood" />
                <FieldInput label="SLP / P.O. Box" value={form.slp} onChange={set('slp')} placeholder="Postal address" />
              </Grid2>
              <SectionDivider title="Nearby Member Contact" />
              <Grid2>
                <FieldInput label="Neighbour Member Name" value={form.neighbour_member_name} onChange={set('neighbour_member_name')} />
                <FieldInput label="Neighbour Member Phone" value={form.neighbour_member_phone} onChange={set('neighbour_member_phone')} />
              </Grid2>
              <SectionDivider title="Elder Contact" />
              <Grid2>
                <FieldInput label="Elder Name" value={form.elder_name} onChange={set('elder_name')} />
                <FieldInput label="Elder Phone" value={form.elder_phone} onChange={set('elder_phone')} />
              </Grid2>
              <SectionDivider title="Church History" />
              <FieldInput label="Previous Church" value={form.previous_church} onChange={set('previous_church')} placeholder="If transferred" />
            </div>
          )}

          {/* ── DEPENDANTS ── */}
          {tab === 'dependants' && <DependantsTab memberId={form.id} />}

          {/* Save bar */}
          {tab !== 'dependants' && (
            <div className="flex justify-end gap-2" style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--border-subtle)' }}>
              <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          )}
        </form>

        {/* Inline toast */}
        {toast && (
          <div
            className={`toast ${toast.type}`}
            style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 100, whiteSpace: 'nowrap' }}
          >
            {toast.msg}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Member Row Card ──────────────────────────────────────────────────────────
function MemberCard({ m, user, lang, onEdit, onToggle, onDelete }) {
  const [lightbox, setLightbox] = useState(false);
  const sc = statusColor(m.member_status);

  return (
    <>
      {lightbox && m.profile_photo_url && (
        <PhotoLightbox member={m} onClose={() => setLightbox(false)} />
      )}
      <div
        className="flex items-center justify-between"
        style={{ padding: '12px 0', gap: 12, borderBottom: '1px solid var(--border-subtle)' }}
      >
        {/* Left: avatar + info */}
        <div className="flex items-center gap-3" style={{ minWidth: 0 }}>
          {m.profile_photo_url ? (
            <img
              src={m.profile_photo_url}
              alt={m.full_name}
              onClick={() => setLightbox(true)}
              className="avatar avatar-sm"
              style={{ cursor: 'zoom-in', width: 36, height: 36 }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <div className="avatar avatar-sm" style={{ width: 36, height: 36 }}>
              {m.full_name?.[0]?.toUpperCase()}
            </div>
          )}

          <div style={{ minWidth: 0 }}>
            <p
              className="text-sm font-semibold"
              style={{ margin: 0, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {m.full_name}
            </p>
            <div className="flex items-center gap-1" style={{ marginTop: 2, flexWrap: 'wrap' }}>
              <RoleBadge role={m.role} lang={lang} />
              {m.group_name && (
                <>
                  <span className="text-2xs" style={{ color: 'var(--text-disabled)' }}>·</span>
                  <span className="text-2xs" style={{ color: 'var(--text-tertiary)' }}>{m.group_name}</span>
                </>
              )}
              {m.jumuiya && (
                <>
                  <span className="text-2xs" style={{ color: 'var(--text-disabled)' }}>·</span>
                  <span className="badge badge-navy text-2xs">{m.jumuiya}</span>
                </>
              )}
              {m.member_status && m.member_status !== 'hai' && (
                <span className={`badge badge-${sc}`}>
                  <span className={`status-dot ${sc}`} />
                  {m.member_status}
                </span>
              )}
              {m.gender && (
                <span className="text-2xs" style={{ color: 'var(--text-tertiary)' }}>
                  {m.gender === 'Male' ? '♂' : '♀'}
                </span>
              )}
              {m.occupation && (
                <span className="text-2xs" style={{ color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
                  {m.occupation}
                </span>
              )}
              {!m.is_active && <span className="badge badge-warning">Inactive</span>}
            </div>
          </div>
        </div>

        {/* Right: actions */}
        {user?.role === 'pastor' && (
          <div className="flex items-center gap-1" style={{ flexShrink: 0 }}>
            <button onClick={onEdit} className="btn btn-secondary btn-sm">Edit</button>
            <button onClick={onToggle} className="btn btn-ghost btn-sm">
              {m.is_active ? 'Deactivate' : 'Activate'}
            </button>
            <button onClick={onDelete} className="btn btn-sm" style={{ color: 'var(--danger)', background: 'none', border: 'none' }}>
              Delete
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Filter Chip ─────────────────────────────────────────────────────────────
// Uses .filter-chip / .filter-chip--active classes (defined in the <style> block below).
// No inline styles — all appearance is driven by CSS utility classes.
function FilterChip({ label, active, onClear, children }) {
  return (
    <div className={`filter-chip${active ? ' filter-chip--active' : ''}`}>
      <span className="filter-chip__label">{label}</span>
      {children}
      {active && (
        <button
          onClick={onClear}
          className="btn btn-ghost btn-icon filter-chip__clear"
          aria-label={`Clear ${label} filter`}
        >
          ×
        </button>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MembersPage() {
  const { user, lang }      = useAuth();
  const { t }               = useTranslation(lang);

  const [members, setMembers]     = useState([]);
  const [ministries, setMinistries] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');

  // Status filter (pill row)
  const [statusFilter, setStatusFilter] = useState('all');

  // Prominent field filters
  const [jumuiyaFilter,    setJumuiyaFilter]    = useState('');
  const [ministryFilter,   setMinistryFilter]   = useState('');
  const [genderFilter,     setGenderFilter]     = useState('');
  const [occupationFilter, setOccupationFilter] = useState('');

  const [toast, setToast]               = useState(null);
  const [deleteId, setDeleteId]         = useState(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [editUser, setEditUser]         = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await userApi.getAll();
      setMembers(res.data.data);
    } catch (_) {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  // FIX: res.data is { success, data: [...] } — unwrap .data before storing
  useEffect(() => {
    ministryApi.getAll()
      .then(res => setMinistries(res.data.data || res.data || []))
      .catch(() => {});
  }, []);

  const handleToggle = async (m) => {
    try {
      await userApi.update(m.id, { is_active: m.is_active ? 0 : 1 });
      showToast('Status updated');
      fetchMembers();
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleDelete = async (id) => {
    try {
      await userApi.delete(id);
      showToast(lang === 'sw' ? 'Msharika ameondolewa' : 'Member removed');
      setDeleteId(null);
      fetchMembers();
    } catch (err) { showToast(err.message, 'error'); }
  };

  // Derived unique values for dropdowns (from live member data)
  const jumuiyaOptions    = [...new Set(members.map(m => m.jumuiya).filter(Boolean))].sort();
  const occupationOptions = [...new Set(members.map(m => m.occupation).filter(Boolean))].sort();

  const hasActiveFieldFilters = jumuiyaFilter || ministryFilter || genderFilter || occupationFilter;

  const clearAllFieldFilters = () => {
    setJumuiyaFilter('');
    setMinistryFilter('');
    setGenderFilter('');
    setOccupationFilter('');
  };

  // Stats
  const activeCount    = members.filter(m => m.is_active && m.member_status !== 'amefariki').length;
  const transferCount  = members.filter(m => m.member_status === 'amehamia').length;
  const deceasedCount  = members.filter(m => m.member_status === 'amefariki').length;
  const volunteerCount = members.filter(m => m.willing_to_volunteer).length;

  const STATUS_PILLS = [
    { id: 'all',       label: 'All',         count: members.length },
    { id: 'active',    label: 'Active',       count: activeCount },
    { id: 'amehamia',  label: 'Transferred',  count: transferCount },
    { id: 'amefariki', label: 'Deceased',     count: deceasedCount },
    { id: 'inactive',  label: 'Inactive',     count: members.filter(m => !m.is_active).length },
  ];

  const displayed = members.filter(m => {
    const q = search.toLowerCase();
    const matchSearch = !search || (
      m.full_name?.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q) ||
      m.occupation?.toLowerCase().includes(q) ||
      m.jumuiya?.toLowerCase().includes(q) ||
      m.profession?.toLowerCase().includes(q)
    );
    const matchStatus =
      statusFilter === 'all'      ? true :
      statusFilter === 'active'   ? (m.is_active && m.member_status !== 'amefariki') :
      statusFilter === 'inactive' ? !m.is_active :
      m.member_status === statusFilter;

    const matchJumuiya    = !jumuiyaFilter    || m.jumuiya === jumuiyaFilter;
    const matchGender     = !genderFilter     || m.gender  === genderFilter;
    const matchOccupation = !occupationFilter || m.occupation === occupationFilter;
    const matchMinistry   = !ministryFilter   ||
      (m.ministries || []).some(mn => String(mn.ministry_id) === String(ministryFilter));


      
    return matchSearch && matchStatus && matchJumuiya && matchGender && matchOccupation && matchMinistry;
  });

  return (
    <div>
      <PageHeader
        breadcrumb={lang === 'sw' ? 'Watu' : 'People'}
        title={t('members')}
        subtitle={`${members.length} ${lang === 'sw' ? 'washarika wote' : 'total members'}`}
      />

      <div style={{ padding: '24px 32px', maxWidth: 960 }}>

        {/* ── Stat Cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
          {[
            { label: 'Total Members', value: members.length },
            { label: 'Active',        value: activeCount },
            { label: 'Transferred',   value: transferCount },
            { label: 'Volunteers',    value: volunteerCount },
          ].map((s) => (
            <div key={s.label} className="stat-card">
              <p className="stat-label">{s.label}</p>
              <p className="stat-value">{s.value}</p>
            </div>
          ))}
        </div>

        {/* ── Search + Add ── */}
        <div className="flex gap-3 items-center" style={{ marginBottom: 12 }}>
          <div className="search-bar" style={{ flex: 1 }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: 'var(--text-disabled)' }}>
              <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, occupation, jumuiya…"
            />
            {search && (
              <button onClick={() => setSearch('')} className="btn btn-ghost btn-icon" style={{ width: 22, height: 22, fontSize: 13, flexShrink: 0 }}>
                ×
              </button>
            )}
          </div>

          {(user?.role === 'pastor' || user?.role === 'elder') && (
            <button onClick={() => setShowAddMember(true)} className="btn btn-primary" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
              + Add Member
            </button>
          )}
        </div>

        {/* ── Prominent Filter Bar ── */}
        <div className="card filter-bar">
          {/* Header row: label + clear-all */}
          <div className="flex items-center justify-between filter-bar__header">
            <span className="filter-bar__title">Filter members</span>
            {hasActiveFieldFilters && (
              <button onClick={clearAllFieldFilters} className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', fontSize: 11 }}>
                Clear all
              </button>
            )}
          </div>

          {/* Chip row */}
          <div className="flex items-center gap-2 flex-wrap">

            {/* Jumuiya */}
            <FilterChip label="Jumuiya" active={!!jumuiyaFilter} onClear={() => setJumuiyaFilter('')}>
              <select
                value={jumuiyaFilter}
                onChange={(e) => setJumuiyaFilter(e.target.value)}
                className={`filter-chip__select${jumuiyaFilter ? ' filter-chip__select--active' : ''}`}
              >
                <option value="">All jumuiya</option>
                {jumuiyaOptions.map(j => <option key={j} value={j}>{j}</option>)}
              </select>
            </FilterChip>

            {/* Ministry */}
            <FilterChip label="Ministry" active={!!ministryFilter} onClear={() => setMinistryFilter('')}>
              <select
                value={ministryFilter}
                onChange={(e) => setMinistryFilter(e.target.value)}
                className={`filter-chip__select${ministryFilter ? ' filter-chip__select--active' : ''}`}
              >
                <option value="">All ministries</option>
                {ministries.map(mn => <option key={mn.id} value={mn.id}>{mn.name}</option>)}
              </select>
            </FilterChip>

            {/* Gender */}
            <FilterChip label="Gender" active={!!genderFilter} onClear={() => setGenderFilter('')}>
              <select
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value)}
                className={`filter-chip__select${genderFilter ? ' filter-chip__select--active' : ''}`}
              >
                <option value="">All genders</option>
                <option value="Male">Male ♂</option>
                <option value="Female">Female ♀</option>
              </select>
            </FilterChip>

            {/* Occupation / Profession */}
            <FilterChip label="Occupation" active={!!occupationFilter} onClear={() => setOccupationFilter('')}>
              <select
                value={occupationFilter}
                onChange={(e) => setOccupationFilter(e.target.value)}
                className={`filter-chip__select${occupationFilter ? ' filter-chip__select--active' : ''}`}
              >
                <option value="">All occupations</option>
                {occupationOptions.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </FilterChip>

          </div>
        </div>

        {/* ── Status pills ── */}
        <div className="flex gap-2 items-center" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          {STATUS_PILLS.map((f) => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`tab-pill ${statusFilter === f.id ? 'active' : ''}`}
            >
              {f.label}
              <span className="badge badge-neutral" style={{ fontSize: 10, padding: '1px 6px', marginLeft: 2 }}>
                {f.count}
              </span>
            </button>
          ))}
        </div>

        {/* ── Member List ── */}
        <div className="card" style={{ overflow: 'hidden' }}>
          {loading ? (
            <div className="empty-state">
              <div className="skeleton" style={{ width: 160, height: 16, borderRadius: 8 }} />
              <div className="skeleton" style={{ width: 120, height: 12, borderRadius: 8, marginTop: 8 }} />
            </div>
          ) : displayed.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">🔍</span>
              <p className="empty-state-title">No members found</p>
              <p className="empty-state-body">
                {search ? `No results for "${search}"` : 'Try adjusting your filters'}
              </p>
            </div>
          ) : (
            <div style={{ padding: '0 16px' }}>
              {displayed.map((m) => (
                <MemberCard
                  key={m.id}
                  m={m}
                  user={user}
                  lang={lang}
                  onEdit={() => setEditUser({ ...m })}
                  onToggle={() => handleToggle(m)}
                  onDelete={() => setDeleteId(m.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Count */}
        {!loading && displayed.length > 0 && (
          <p className="text-xs text-right" style={{ margin: '10px 0 0', color: 'var(--text-disabled)' }}>
            Showing {displayed.length} of {members.length} members
          </p>
        )}
      </div>

      {/* Profile Edit Modal */}
      {editUser && (
        <ProfileModal
          member={editUser}
          user={user}
          lang={lang}
          onClose={() => setEditUser(null)}
          onSaved={() => { setEditUser(null); fetchMembers(); showToast(lang === 'sw' ? 'Mshirika amesasishwa' : 'Member updated'); }}
        />
      )}

      {/* Add Member Modal */}
      {showAddMember && (
        <AdminAddMemberModal
          onClose={() => setShowAddMember(false)}
          onAdded={() => {
            setShowAddMember(false);
            fetchMembers();
            showToast('Member added successfully');
          }}
        />
      )}

      {/* Delete Confirm Modal */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title={t('delete_member')}>
        <p className="text-sm" style={{ color: 'var(--text-secondary)', margin: '0 0 20px' }}>
          {t('confirm_delete')}
        </p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => setDeleteId(null)} className="btn btn-secondary">{t('cancel')}</button>
          <button onClick={() => handleDelete(deleteId)} className="btn btn-danger">{t('delete')}</button>
        </div>
      </Modal>

      <Toast toast={toast} />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── Filter bar container ───────────────────────────── */
        .filter-bar {
          padding: 14px 16px;
          margin-bottom: 14px;
        }
        .filter-bar__header {
          margin-bottom: 10px;
        }
        .filter-bar__title {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-tertiary);
        }

        /* ── Individual filter chip ─────────────────────────── */
        .filter-chip {
          display: inline-flex;
          align-items: center;
          height: 36px;
          padding: 0 6px 0 12px;
          border-radius: 8px;
          border: 1.5px solid var(--border-default);
          background: var(--surface-page);
          gap: 0;
          transition: border-color 0.12s ease, background 0.12s ease;
        }
        .filter-chip--active {
          border-color: var(--navy);
          background: color-mix(in srgb, var(--navy) 7%, transparent);
        }

        /* Label inside chip */
        .filter-chip__label {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-tertiary);
          white-space: nowrap;
          margin-right: 6px;
          pointer-events: none;
          user-select: none;
        }
        .filter-chip--active .filter-chip__label {
          color: var(--navy);
        }

        /* × clear button */
        .filter-chip__clear {
          width: 22px !important;
          height: 22px !important;
          font-size: 14px !important;
          flex-shrink: 0;
          margin-left: 2px;
          color: var(--navy) !important;
          opacity: 0.7;
        }
        .filter-chip__clear:hover { opacity: 1; }

        /* Select inside chip — borderless, transparent */
        .filter-chip__select {
          height: 24px;
          border: none !important;
          background: transparent !important;
          box-shadow: none !important;
          outline: none !important;
          font-size: 12px;
          font-weight: 400;
          color: var(--text-secondary);
          padding: 0 24px 0 2px;
          min-width: 110px;
          cursor: pointer;
        }
        .filter-chip__select--active {
          font-weight: 600;
          color: var(--navy);
        }
      `}</style>
    </div>
  );
}