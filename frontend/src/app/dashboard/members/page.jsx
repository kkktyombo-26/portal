'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useTranslation } from '../../../lib/i18n';
import { userApi, dependantApi } from '../../../lib/api';
import PageHeader from '../../../components/ui/PageHeader';
import Modal from '../../../components/ui/Modal';
import Toast from '../../../components/ui/Toast';
import RoleBadge from '../../../components/ui/RoleBadge';

// ─── Inline style tokens ──────────────────────────────────────────────────────
const tokens = {
  navy:       '#1B3A6B',
  navyLight:  '#2A4F8F',
  navyDark:   '#122748',
  navyMuted:  '#EEF3FB',
  gold:       '#C8A84B',
  goldLight:  '#F5EDD0',
  surface:    '#F5F4F0',
  canvas:     '#FFFFFF',
  ink:        '#1C1917',
  inkMuted:   '#78716C',
  inkFaint:   '#A8A29E',
  hairline:   '#E7E5E0',
  border:     '#D6D3CE',
  success:    '#166534',
  successBg:  '#F0FDF4',
  danger:     '#B45309',
  dangerBg:   '#FEF3C7',
  error:      '#B91C1C',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
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
  if (status === 'amefariki') return { bg: '#FEF2F2', text: '#B91C1C', dot: '#EF4444' };
  if (status === 'amehamia')  return { bg: '#FFFBEB', text: '#92400E', dot: '#F59E0B' };
  return                              { bg: '#F0FDF4', text: '#166534', dot: '#22C55E' };
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
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
        zIndex: 2000, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 20, right: 24,
          background: 'rgba(255,255,255,0.1)', border: 'none',
          borderRadius: '50%', width: 36, height: 36,
          cursor: 'pointer', color: '#fff', fontSize: 18,
        }}
      >✕</button>
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
      <div style={{ marginTop: 18, textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#fff' }}>{member.full_name}</p>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{member.email}</p>
      </div>
    </div>
  );
}

// ─── Field helpers ────────────────────────────────────────────────────────────
function FieldInput({ label, value, onChange, type = 'text', placeholder, required }) {
  return (
    <div>
      <label style={{
        display: 'block', fontSize: 11, fontWeight: 600,
        color: tokens.inkMuted, letterSpacing: '0.05em',
        textTransform: 'uppercase', marginBottom: 5,
      }}>{label}{required && <span style={{ color: tokens.error }}> *</span>}</label>
      <input
        type={type}
        value={value || ''}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        style={{
          width: '100%', padding: '8px 12px', borderRadius: 8,
          border: `1.5px solid ${tokens.border}`, background: tokens.canvas,
          fontSize: 13, color: tokens.ink, outline: 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          boxSizing: 'border-box',
        }}
        onFocus={(e) => {
          e.target.style.borderColor = tokens.navy;
          e.target.style.boxShadow = '0 0 0 3px rgba(27,58,107,0.1)';
        }}
        onBlur={(e) => {
          e.target.style.borderColor = tokens.border;
          e.target.style.boxShadow = 'none';
        }}
      />
    </div>
  );
}

function FieldSelect({ label, value, onChange, options, placeholder }) {
  return (
    <div>
      <label style={{
        display: 'block', fontSize: 11, fontWeight: 600,
        color: tokens.inkMuted, letterSpacing: '0.05em',
        textTransform: 'uppercase', marginBottom: 5,
      }}>{label}</label>
      <select
        value={value || ''}
        onChange={onChange}
        style={{
          width: '100%', padding: '8px 12px', borderRadius: 8,
          border: `1.5px solid ${tokens.border}`, background: tokens.canvas,
          fontSize: 13, color: value ? tokens.ink : tokens.inkFaint,
          outline: 'none', cursor: 'pointer', boxSizing: 'border-box',
          transition: 'border-color 0.15s',
        }}
        onFocus={(e) => {
          e.target.style.borderColor = tokens.navy;
          e.target.style.boxShadow = '0 0 0 3px rgba(27,58,107,0.1)';
        }}
        onBlur={(e) => {
          e.target.style.borderColor = tokens.border;
          e.target.style.boxShadow = 'none';
        }}
      >
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
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
      <input
        type="checkbox"
        checked={!!checked}
        onChange={onChange}
        style={{ width: 16, height: 16, accentColor: tokens.navy, cursor: 'pointer' }}
      />
      <span style={{ fontSize: 13, color: tokens.ink }}>{label}</span>
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
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0 14px' }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: tokens.navy, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
        {title}
      </span>
      <div style={{ flex: 1, height: 1, background: tokens.navyMuted }} />
    </div>
  );
}

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', gap: 8, padding: '8px 0', borderBottom: `1px solid ${tokens.hairline}` }}>
      <span style={{ fontSize: 12, color: tokens.inkMuted, minWidth: 140, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: tokens.ink, fontWeight: 500 }}>{value}</span>
    </div>
  );
}

// ─── Dependants Mini-Manager ──────────────────────────────────────────────────
function DependantsTab({ memberId, lang }) {
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
    <div style={{ textAlign: 'center', padding: 32, color: tokens.inkMuted }}>Loading…</div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: tokens.inkMuted }}>{deps.length} dependant{deps.length !== 1 ? 's' : ''} recorded</span>
        <button
          onClick={() => setAdding(true)}
          style={{
            padding: '6px 14px', borderRadius: 7, background: tokens.navy,
            color: '#fff', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
        >+ Add</button>
      </div>

      {deps.length === 0 && !adding && (
        <div style={{
          textAlign: 'center', padding: '28px 16px',
          background: tokens.surface, borderRadius: 10,
          border: `1.5px dashed ${tokens.border}`,
          color: tokens.inkMuted, fontSize: 13,
        }}>
          No dependants recorded yet
        </div>
      )}

      {deps.map((d) => (
        <div key={d.id} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', background: tokens.surface,
          borderRadius: 8, marginBottom: 8,
          border: `1px solid ${tokens.hairline}`,
        }}>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: tokens.ink }}>{d.full_name}</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: tokens.inkMuted }}>
              {d.relationship && `${d.relationship}`}
              {d.relationship && d.date_of_birth && ' · '}
              {d.date_of_birth && `Born ${d.date_of_birth}`}
            </p>
          </div>
          <button
            onClick={() => handleRemove(d.id)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: tokens.inkFaint, fontSize: 16, padding: '2px 6px',
            }}
          >×</button>
        </div>
      ))}

      {adding && (
        <div style={{
          marginTop: 8, padding: 16, background: tokens.navyMuted,
          borderRadius: 10, border: `1.5px solid ${tokens.navy}22`,
        }}>
          <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 700, color: tokens.navy, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            New Dependant
          </p>
          <Grid2>
            <FieldInput
              label="Full Name"
              value={newDep.full_name}
              onChange={(e) => setNewDep(p => ({ ...p, full_name: e.target.value }))}
              required
            />
            <FieldInput
              label="Relationship"
              value={newDep.relationship}
              placeholder="e.g. Mtoto, Ndugu"
              onChange={(e) => setNewDep(p => ({ ...p, relationship: e.target.value }))}
            />
          </Grid2>
          <div style={{ marginTop: 10 }}>
            <FieldInput
              label="Date of Birth"
              type="date"
              value={newDep.date_of_birth}
              onChange={(e) => setNewDep(p => ({ ...p, date_of_birth: e.target.value }))}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setAdding(false)}
              style={{
                padding: '7px 14px', borderRadius: 7, background: tokens.canvas,
                border: `1.5px solid ${tokens.border}`, fontSize: 12,
                fontWeight: 600, color: tokens.ink, cursor: 'pointer',
              }}
            >Cancel</button>
            <button
              onClick={handleAdd}
              disabled={saving || !newDep.full_name.trim()}
              style={{
                padding: '7px 14px', borderRadius: 7, background: tokens.navy,
                color: '#fff', border: 'none', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', opacity: saving ? 0.6 : 1,
              }}
            >{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Profile Edit Modal (Multi-tab) ──────────────────────────────────────────
function ProfileModal({ member, user, lang, onClose, onSaved }) {
  const [tab, setTab]     = useState('overview');
  const [form, setForm]   = useState({ ...member });
  const [saving, setSaving] = useState(false);
  const [toast, setToast]  = useState(null);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));
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
        full_name: form.full_name,
        phone: form.phone,
        role: form.role,
        gender: form.gender,
        date_of_birth: form.date_of_birth,
        place_of_birth: form.place_of_birth,
        member_status: form.member_status,
        marital_status: form.marital_status,
        marriage_type: form.marriage_type,
        marriage_date: form.marriage_date,
        marriage_place: form.marriage_place,
        spouse_name: form.spouse_name,
        spouse_phone: form.spouse_phone,
        cohabiting_partner_name: form.cohabiting_partner_name,
        occupation: form.occupation,
        workplace: form.workplace,
        education: form.education,
        profession: form.profession,
        willing_to_volunteer: form.willing_to_volunteer,
        jumuiya: form.jumuiya,
        block_no: form.block_no,
        area_name: form.area_name,
        slp: form.slp,
        neighbour_member_name: form.neighbour_member_name,
        neighbour_member_phone: form.neighbour_member_phone,
        elder_name: form.elder_name,
        elder_phone: form.elder_phone,
        previous_church: form.previous_church,
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
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1500,
        background: 'rgba(17,24,39,0.55)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 760,
          maxHeight: '92vh', background: tokens.canvas,
          borderRadius: 16, boxShadow: '0 24px 64px rgba(17,24,39,0.18)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: `1px solid ${tokens.hairline}`,
          background: `linear-gradient(135deg, ${tokens.navyDark} 0%, ${tokens.navy} 100%)`,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {form.profile_photo_url ? (
              <img
                src={form.profile_photo_url}
                alt={form.full_name}
                style={{ width: 46, height: 46, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.25)' }}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <div style={{
                width: 46, height: 46, borderRadius: '50%',
                background: 'rgba(255,255,255,0.12)',
                border: '2px solid rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 700, color: '#fff',
              }}>
                {form.full_name?.[0]?.toUpperCase()}
              </div>
            )}
            <div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#fff' }}>{form.full_name}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{form.email}</span>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                  background: sc.bg, color: sc.text,
                  border: `1px solid ${sc.dot}33`,
                }}>
                  <span style={{ marginRight: 4, fontSize: 8 }}>●</span>
                  {statusLabel(form.member_status || 'hai')}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)', border: 'none',
              borderRadius: 8, width: 34, height: 34,
              cursor: 'pointer', color: '#fff', fontSize: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >×</button>
        </div>

        {/* Tab Bar */}
        <div style={{
          display: 'flex', gap: 0, padding: '0 24px',
          background: tokens.surface, borderBottom: `1px solid ${tokens.hairline}`,
          flexShrink: 0, overflowX: 'auto',
        }}>
          {PROFILE_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '11px 14px', background: 'none', border: 'none',
                borderBottom: tab === t.id ? `2px solid ${tokens.navy}` : '2px solid transparent',
                fontSize: 12, fontWeight: tab === t.id ? 700 : 500,
                color: tab === t.id ? tokens.navy : tokens.inkMuted,
                cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'all 0.12s',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
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
                  <FieldSelect
                    label="Role"
                    value={form.role}
                    onChange={set('role')}
                    options={ROLE_OPTIONS}
                  />
                </>
              )}
              <SectionDivider title="Member Status" />
              <Grid2>
                <FieldSelect
                  label="Status"
                  value={form.member_status}
                  onChange={set('member_status')}
                  options={MEMBER_STATUS_OPTIONS}
                />
                <FieldSelect
                  label="Gender"
                  value={form.gender}
                  onChange={set('gender')}
                  options={GENDER_OPTIONS}
                  placeholder="Select gender"
                />
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
                <FieldSelect
                  label="Marital Status"
                  value={form.marital_status}
                  onChange={set('marital_status')}
                  options={MARITAL_OPTIONS}
                  placeholder="Select status"
                />
                <FieldSelect
                  label="Marriage Type"
                  value={form.marriage_type}
                  onChange={set('marriage_type')}
                  options={MARRIAGE_TYPE_OPTIONS}
                  placeholder="Select type"
                />
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
                <FieldInput
                  label="Cohabiting Partner Name"
                  value={form.cohabiting_partner_name}
                  onChange={set('cohabiting_partner_name')}
                  placeholder="If applicable"
                />
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
              <FieldCheckbox
                label="Willing to volunteer in church ministry"
                checked={form.willing_to_volunteer}
                onChange={setCheck('willing_to_volunteer')}
              />
            </div>
          )}

          {/* ── RESIDENCE ── */}
          {tab === 'residence' && (
            <div>
              <SectionDivider title="Address" />
              <Grid2>
                <FieldInput label="Jumuiya" value={form.jumuiya} onChange={set('jumuiya')} placeholder="Local community group" />
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
          {tab === 'dependants' && (
            <DependantsTab memberId={form.id} lang={lang} />
          )}

          {/* Save bar — hidden on dependants tab (managed separately) */}
          {tab !== 'dependants' && (
            <div style={{
              display: 'flex', justifyContent: 'flex-end', gap: 10,
              marginTop: 24, paddingTop: 18,
              borderTop: `1px solid ${tokens.hairline}`,
            }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '8px 18px', borderRadius: 8,
                  border: `1.5px solid ${tokens.border}`,
                  background: tokens.canvas, fontSize: 13,
                  fontWeight: 600, color: tokens.ink, cursor: 'pointer',
                }}
              >Cancel</button>
              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: '8px 20px', borderRadius: 8,
                  background: tokens.navy, color: '#fff',
                  border: 'none', fontSize: 13,
                  fontWeight: 600, cursor: 'pointer',
                  opacity: saving ? 0.65 : 1,
                  transition: 'opacity 0.15s',
                }}
              >{saving ? 'Saving…' : 'Save Changes'}</button>
            </div>
          )}
        </form>

        {/* Inline toast */}
        {toast && (
          <div style={{
            position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            padding: '10px 18px', borderRadius: 10,
            background: toast.type === 'error' ? '#FEF2F2' : '#F0FDF4',
            border: `1px solid ${toast.type === 'error' ? '#FECACA' : '#BBF7D0'}`,
            color: toast.type === 'error' ? '#991B1B' : '#166534',
            fontSize: 13, fontWeight: 600,
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            zIndex: 100, whiteSpace: 'nowrap',
          }}>
            {toast.msg}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Member Row Card ──────────────────────────────────────────────────────────
function MemberCard({ m, user, t, lang, onEdit, onToggle, onDelete }) {
  const [lightbox, setLightbox] = useState(false);
  const sc = statusColor(m.member_status);

  return (
    <>
      {lightbox && m.profile_photo_url && (
        <PhotoLightbox member={m} onClose={() => setLightbox(false)} />
      )}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 0', gap: 12,
      }}>
        {/* Left: avatar + info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          {m.profile_photo_url ? (
            <img
              src={m.profile_photo_url}
              alt={m.full_name}
              onClick={() => setLightbox(true)}
              style={{
                width: 36, height: 36, borderRadius: '50%', objectFit: 'cover',
                flexShrink: 0, border: `1.5px solid ${tokens.border}`,
                cursor: 'zoom-in', transition: 'opacity 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.75'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: `linear-gradient(135deg, ${tokens.navyMuted}, #dde8f5)`,
              border: `1.5px solid ${tokens.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, fontSize: 14, fontWeight: 700, color: tokens.navy,
            }}>
              {m.full_name?.[0]?.toUpperCase()}
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: tokens.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {m.full_name}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
              <RoleBadge role={m.role} lang={lang} />
              {m.group_name && (
                <>
                  <span style={{ color: tokens.inkFaint, fontSize: 11 }}>·</span>
                  <span style={{ fontSize: 11, color: tokens.inkFaint }}>{m.group_name}</span>
                </>
              )}
              {m.member_status && m.member_status !== 'hai' && (
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '1px 7px',
                  borderRadius: 20, background: sc.bg, color: sc.text,
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                  border: `1px solid ${sc.dot}44`,
                }}>
                  {m.member_status}
                </span>
              )}
              {m.gender && (
                <span style={{ fontSize: 11, color: tokens.inkFaint }}>
                  {m.gender === 'Male' ? '♂' : '♀'}
                </span>
              )}
              {m.occupation && (
                <span style={{ fontSize: 11, color: tokens.inkFaint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
                  {m.occupation}
                </span>
              )}
              {!m.is_active && (
                <span style={{ fontSize: 10, fontWeight: 700, color: tokens.danger, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Inactive
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: actions */}
        {user?.role === 'pastor' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <button
              onClick={onEdit}
              style={{
                padding: '5px 11px', borderRadius: 7,
                background: tokens.navyMuted, color: tokens.navy,
                border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                transition: 'background 0.12s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#d4e3f5'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = tokens.navyMuted; }}
            >Edit</button>
            <button
              onClick={onToggle}
              style={{
                padding: '5px 11px', borderRadius: 7,
                background: tokens.surface, color: tokens.inkMuted,
                border: `1px solid ${tokens.border}`, fontSize: 12,
                fontWeight: 600, cursor: 'pointer',
              }}
            >{m.is_active ? 'Deactivate' : 'Activate'}</button>
            <button
              onClick={onDelete}
              style={{
                padding: '5px 11px', borderRadius: 7,
                background: 'none', color: tokens.error,
                border: 'none', fontSize: 12, fontWeight: 600,
                cursor: 'pointer',
              }}
            >Delete</button>
          </div>
        )}
      </div>
      <div style={{ height: 1, background: tokens.hairline }} />
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MembersPage() {
  const { user, lang }        = useAuth();
  const { t }                 = useTranslation(lang);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState('all');  // all | active | inactive | amehamia | amefariki
  const [toast, setToast]     = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [saving, setSaving]   = useState(false);

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

  // Stats
  const activeCount   = members.filter(m => m.is_active && m.member_status !== 'amefariki').length;
  const transferCount = members.filter(m => m.member_status === 'amehamia').length;
  const deceasedCount = members.filter(m => m.member_status === 'amefariki').length;
  const volunteerCount = members.filter(m => m.willing_to_volunteer).length;

  const FILTER_OPTIONS = [
    { id: 'all',       label: 'All', count: members.length },
    { id: 'active',    label: 'Active', count: activeCount },
    { id: 'amehamia',  label: 'Transferred', count: transferCount },
    { id: 'amefariki', label: 'Deceased', count: deceasedCount },
    { id: 'inactive',  label: 'Inactive', count: members.filter(m => !m.is_active).length },
  ];

  const displayed = members.filter(m => {
    const matchSearch = (
      m.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      m.email?.toLowerCase().includes(search.toLowerCase()) ||
      m.occupation?.toLowerCase().includes(search.toLowerCase()) ||
      m.jumuiya?.toLowerCase().includes(search.toLowerCase())
    );
    const matchFilter = filter === 'all' ? true
      : filter === 'active'    ? (m.is_active && m.member_status !== 'amefariki')
      : filter === 'inactive'  ? !m.is_active
      : m.member_status === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div>
      <PageHeader
        breadcrumb={lang === 'sw' ? 'Watu' : 'People'}
        title={t('members')}
        subtitle={`${members.length} ${lang === 'sw' ? 'washarika wote' : 'total members'}`}
      />

      <div style={{ padding: '24px 32px', maxWidth: 900 }}>

        {/* Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Total Members',  value: members.length, accent: tokens.navy,    bg: tokens.navyMuted },
            { label: 'Active',         value: activeCount,    accent: '#16A34A',      bg: '#F0FDF4' },
            { label: 'Transferred',    value: transferCount,  accent: '#D97706',      bg: '#FFFBEB' },
            { label: 'Volunteers',     value: volunteerCount, accent: tokens.gold,    bg: tokens.goldLight },
          ].map((s) => (
            <div key={s.label} style={{
              background: s.bg, borderRadius: 12, padding: '14px 18px',
              border: `1px solid ${s.accent}22`,
            }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: s.accent, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{s.label}</p>
              <p style={{ margin: '4px 0 0', fontSize: 26, fontWeight: 700, color: s.accent, lineHeight: 1.1 }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Search + Filter bar */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <span style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              color: tokens.inkFaint, fontSize: 14, pointerEvents: 'none',
            }}>⊙</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, occupation, jumuiya…"
              style={{
                width: '100%', padding: '9px 12px 9px 34px',
                borderRadius: 9, border: `1.5px solid ${tokens.border}`,
                background: tokens.canvas, fontSize: 13, color: tokens.ink,
                outline: 'none', boxSizing: 'border-box',
              }}
              onFocus={(e) => { e.target.style.borderColor = tokens.navy; e.target.style.boxShadow = '0 0 0 3px rgba(27,58,107,0.1)'; }}
              onBlur={(e)  => { e.target.style.borderColor = tokens.border; e.target.style.boxShadow = 'none'; }}
            />
          </div>

          {/* Filter pills */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {FILTER_OPTIONS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                style={{
                  padding: '6px 12px', borderRadius: 20,
                  background: filter === f.id ? tokens.navy : tokens.canvas,
                  color: filter === f.id ? '#fff' : tokens.inkMuted,
                  border: `1.5px solid ${filter === f.id ? tokens.navy : tokens.border}`,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  transition: 'all 0.12s',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                {f.label}
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  background: filter === f.id ? 'rgba(255,255,255,0.2)' : tokens.surface,
                  color: filter === f.id ? '#fff' : tokens.inkMuted,
                  borderRadius: 20, padding: '1px 6px',
                }}>
                  {f.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div style={{
          background: tokens.canvas, borderRadius: 12,
          border: `1px solid ${tokens.hairline}`,
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(27,58,107,0.04)',
        }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%',
                border: `2.5px solid ${tokens.border}`,
                borderTopColor: tokens.navy,
                animation: 'spin 0.7s linear infinite',
              }} />
            </div>
          ) : displayed.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: tokens.inkMuted, fontSize: 13 }}>
              {search ? `No members found for "${search}"` : t('no_data')}
            </div>
          ) : (
            <div style={{ padding: '0 16px' }}>
              {displayed.map((m) => (
                <MemberCard
                  key={m.id}
                  m={m}
                  user={user}
                  t={t}
                  lang={lang}
                  onEdit={() => setEditUser({ ...m })}
                  onToggle={() => handleToggle(m)}
                  onDelete={() => setDeleteId(m.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Shown count */}
        {!loading && displayed.length > 0 && (
          <p style={{ margin: '10px 0 0', fontSize: 12, color: tokens.inkFaint, textAlign: 'right' }}>
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

      {/* Delete Confirm Modal */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title={t('delete_member')}>
        <p style={{ fontSize: 14, color: tokens.inkMuted, margin: '0 0 20px' }}>
          {t('confirm_delete')}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={() => setDeleteId(null)}
            style={{
              padding: '8px 16px', borderRadius: 8,
              border: `1.5px solid ${tokens.border}`,
              background: tokens.canvas, fontSize: 13,
              fontWeight: 600, color: tokens.ink, cursor: 'pointer',
            }}
          >{t('cancel')}</button>
          <button
            onClick={() => handleDelete(deleteId)}
            style={{
              padding: '8px 16px', borderRadius: 8,
              background: tokens.error, color: '#fff',
              border: 'none', fontSize: 13,
              fontWeight: 600, cursor: 'pointer',
            }}
          >{t('delete')}</button>
        </div>
      </Modal>

      <Toast toast={toast} />

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}