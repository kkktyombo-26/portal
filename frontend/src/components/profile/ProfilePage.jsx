'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../lib/i18n';
import { userApi, dependantApi } from '../../lib/api';

// ── Icons ────────────────────────────────────────────────────────────────────
const Icon = ({ path, size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
    className={className}>
    <path d={path} />
  </svg>
);
const icons = {
  user:      'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  lock:      'M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 10 0v4',
  heart:     'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',
  briefcase: 'M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2',
  mapPin:    'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  users:     'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM23 21v-2a4 4 0 0 1-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  check:     'M20 6L9 17l-5-5',
  x:         'M18 6L6 18M6 6l12 12',
  plus:      'M12 5v14M5 12h14',
  trash:     'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  eye:       'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  eyeOff:    'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22',
};

// ── Tiny decorative cross ────────────────────────────────────────────────────
function TinyCross({ className = 'text-amber-400' }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" className={className} aria-hidden>
      <line x1="6" y1="1" x2="6" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ── Reusable field components ────────────────────────────────────────────────
function Field({ label, error, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-stone-500 tracking-wide">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
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

function Select({ className = '', children, ...props }) {
  return (
    <select
      className={`w-full px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg
        text-stone-800 appearance-none
        focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400
        disabled:bg-stone-50 disabled:text-stone-400 transition ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

function Textarea({ className = '', ...props }) {
  return (
    <textarea
      rows={3}
      className={`w-full px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg
        text-stone-800 placeholder-stone-300 resize-none
        focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400
        disabled:bg-stone-50 disabled:text-stone-400 transition ${className}`}
      {...props}
    />
  );
}

function SaveBtn({ saving, saved, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className="flex items-center gap-2 px-4 py-2 text-sm font-medium
        bg-amber-500 hover:bg-amber-600 active:bg-amber-700
        text-white rounded-lg shadow-sm transition disabled:opacity-60"
    >
      {saving ? (
        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
      ) : saved ? (
        <Icon path={icons.check} size={15} />
      ) : null}
      {saving ? 'Saving…' : saved ? 'Saved' : 'Save changes'}
    </button>
  );
}

// ── Section wrapper ──────────────────────────────────────────────────────────
function Section({ icon, title, children, saving, saved, onSave, noPadding = false }) {
  return (
    <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-50 text-amber-600">
            <Icon path={icon} size={16} />
          </span>
          <h2 className="font-semibold text-stone-800">{title}</h2>
        </div>
        {onSave && <SaveBtn saving={saving} saved={saved} onClick={onSave} />}
      </div>
      <div className={noPadding ? '' : 'px-6 py-5'}>
        {children}
      </div>
    </div>
  );
}

// ── Tab nav ──────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'personal',    label: 'Personal',    icon: icons.user },
  { id: 'family',      label: 'Family',      icon: icons.heart },
  { id: 'work',        label: 'Work & Education', icon: icons.briefcase },
  { id: 'address',     label: 'Address',     icon: icons.mapPin },
  { id: 'dependants',  label: 'Dependants',  icon: icons.users },
  { id: 'security',    label: 'Security',    icon: icons.lock },
];

// ════════════════════════════════════════════════════════════════════════════
// Main component
// ════════════════════════════════════════════════════════════════════════════
export default function ProfilePage() {
  const { user: authUser } = useAuth();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState('personal');
  const [profile, setProfile]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  // Per-section save state
  const [sectionState, setSectionState] = useState({});
  const setSaving = (key, val) =>
    setSectionState(s => ({ ...s, [key]: { ...s[key], saving: val } }));
  const setSaved = (key, val) =>
    setSectionState(s => ({ ...s, [key]: { ...s[key], saved: val } }));

  // Dependants
  const [dependants, setDependants]   = useState([]);
  const [depLoading, setDepLoading]   = useState(false);
  const [depForm, setDepForm]         = useState({ full_name: '', relationship: '', date_of_birth: '' });
  const [depError, setDepError]       = useState('');

  // Security form
  const [pwForm, setPwForm]   = useState({ current_password: '', new_password: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [showPw, setShowPw]   = useState({ current: false, new: false, confirm: false });

  // ── Load profile ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authUser?.id) return;
    setLoading(true);
    userApi.getOne(authUser.id)
      .then(res => {
        setProfile(res.data.data ?? res.data);
        setError(null);
      })
      .catch(() => setError('Could not load profile. Please refresh.'))
      .finally(() => setLoading(false));
  }, [authUser?.id]);

  // ── Load dependants ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!authUser?.id || activeTab !== 'dependants') return;
    setDepLoading(true);
    dependantApi.getAll(authUser.id)
      .then(res => setDependants(res.data.data ?? []))
      .catch(() => {})
      .finally(() => setDepLoading(false));
  }, [authUser?.id, activeTab]);

  // ── Generic field updater ─────────────────────────────────────────────────
  const setField = useCallback((key, val) =>
    setProfile(p => p ? { ...p, [key]: val } : p), []);

  // ── Save section ──────────────────────────────────────────────────────────
  const saveSection = async (sectionKey, payload) => {
    setSaving(sectionKey, true);
    try {
      await userApi.update(authUser.id, payload);
      setSaved(sectionKey, true);
      setTimeout(() => setSaved(sectionKey, false), 2500);
    } catch (err) {
      alert(err?.response?.data?.message ?? 'Save failed. Please try again.');
    } finally {
      setSaving(sectionKey, false);
    }
  };

  // ── Save handlers ─────────────────────────────────────────────────────────
  const savePersonal = () => saveSection('personal', {
    full_name: profile.full_name,
    phone: profile.phone,
    gender: profile.gender,
    date_of_birth: profile.date_of_birth,
    place_of_birth: profile.place_of_birth,
    member_since: profile.member_since,
    member_status: profile.member_status,
    willing_to_volunteer: profile.willing_to_volunteer,
  });

  const saveFamily = () => saveSection('family', {
    marital_status: profile.marital_status,
    marriage_type: profile.marriage_type,
    marriage_date: profile.marriage_date,
    spouse_name: profile.spouse_name,
    spouse_phone: profile.spouse_phone,
  });

  const saveWork = () => saveSection('work', {
    occupation: profile.occupation,
    workplace: profile.workplace,
    education: profile.education,
    profession: profile.profession,
  });

  const saveAddress = () => saveSection('address', {
    street: profile.street,
    district: profile.district,
    region: profile.region,
    postal_code: profile.postal_code,
  });

  // ── Dependant handlers ────────────────────────────────────────────────────
  const addDependant = async () => {
    if (!depForm.full_name.trim()) { setDepError('Name is required.'); return; }
    setDepError('');
    try {
      const res = await dependantApi.add(authUser.id, depForm);
      setDependants(d => [...d, res.data.data]);
      setDepForm({ full_name: '', relationship: '', date_of_birth: '' });
    } catch (err) {
      setDepError(err?.response?.data?.message ?? 'Could not add dependant.');
    }
  };

  const removeDependant = async (depId) => {
    if (!confirm('Remove this dependant?')) return;
    try {
      await dependantApi.remove(authUser.id, depId);
      setDependants(d => d.filter(x => x.id !== depId));
    } catch (err) {
      alert(err?.message ?? 'Could not remove dependant.');
    }
  };

  // ── Password handler ──────────────────────────────────────────────────────
  const saveSecurity = async () => {
    if (pwForm.new_password !== pwForm.confirm) {
      setPwError('New passwords do not match.'); return;
    }
    if (pwForm.new_password.length < 8) {
      setPwError('Password must be at least 8 characters.'); return;
    }
    setPwError('');
    setSaving('security', true);
    try {
      await userApi.changePassword(authUser.id, {
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      });
      setSaved('security', true);
      setPwForm({ current_password: '', new_password: '', confirm: '' });
      setTimeout(() => setSaved('security', false), 2500);
    } catch (err) {
      setPwError(err?.response?.data?.message ?? 'Could not change password.');
    } finally {
      setSaving('security', false);
    }
  };

  // ── Loading / error states ─────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center h-64 text-stone-400">
      <span className="w-6 h-6 border-2 border-stone-300 border-t-amber-400 rounded-full animate-spin" />
    </div>
  );
  if (error) return (
    <div className="p-6 text-center text-red-500 text-sm">{error}</div>
  );
  if (!profile) return null;

  const ss = sectionKey => ({
    saving: sectionState[sectionKey]?.saving ?? false,
    saved:  sectionState[sectionKey]?.saved  ?? false,
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F5F4F0]">
      {/* Header */}
      <div className="bg-white border-b border-stone-100 px-6 py-5">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <TinyCross className="text-amber-400" />
          <div>
            <h1 className="text-lg font-semibold text-stone-900">My Profile</h1>
            <p className="text-xs text-stone-400 mt-0.5">{profile.email}</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">

        {/* Avatar row */}
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm px-6 py-5 flex items-center gap-5">
          <div className="relative flex-shrink-0">
            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-2xl font-bold select-none">
              {(profile.full_name ?? '?')[0].toUpperCase()}
            </div>
            <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white
              ${profile.member_status === 'active' ? 'bg-green-400' : 'bg-stone-300'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-stone-900 truncate">{profile.full_name}</p>
            <p className="text-xs text-stone-400 capitalize">{profile.role} · {profile.member_status ?? 'Member'}</p>
          </div>
          <span className="hidden sm:block text-xs text-stone-300 font-mono">
            #{String(profile.id).padStart(4, '0')}
          </span>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-hide">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition
                ${activeTab === tab.id
                  ? 'bg-white text-amber-600 shadow-sm border border-stone-100'
                  : 'text-stone-500 hover:text-stone-700 hover:bg-stone-100'}`}
            >
              <Icon path={tab.icon} size={13} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── PERSONAL ─────────────────────────────────────────────────── */}
        {activeTab === 'personal' && (
          <Section icon={icons.user} title="Personal Information"
            {...ss('personal')} onSave={savePersonal}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full name">
                <Input value={profile.full_name ?? ''} onChange={e => setField('full_name', e.target.value)} />
              </Field>
              <Field label="Phone">
                <Input type="tel" value={profile.phone ?? ''} onChange={e => setField('phone', e.target.value)} placeholder="+255 700 000 000" />
              </Field>
              <Field label="Gender">
                <Select value={profile.gender ?? ''} onChange={e => setField('gender', e.target.value)}>
                  <option value="">— Select —</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </Select>
              </Field>
              <Field label="Date of birth">
                <Input type="date" value={profile.date_of_birth?.split('T')[0] ?? ''} onChange={e => setField('date_of_birth', e.target.value)} />
              </Field>
              <Field label="Place of birth">
                <Input value={profile.place_of_birth ?? ''} onChange={e => setField('place_of_birth', e.target.value)} placeholder="City or town" />
              </Field>
              <Field label="Member since">
                <Input type="date" value={profile.member_since?.split('T')[0] ?? ''} onChange={e => setField('member_since', e.target.value)} />
              </Field>
              <Field label="Member status">
                <Select value={profile.member_status ?? ''} onChange={e => setField('member_status', e.target.value)}>
                  <option value="">— Select —</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="visitor">Visitor</option>
                  <option value="transferred">Transferred</option>
                </Select>
              </Field>
              <Field label="Willing to volunteer?">
                <Select value={profile.willing_to_volunteer ? 'yes' : 'no'}
                  onChange={e => setField('willing_to_volunteer', e.target.value === 'yes')}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </Select>
              </Field>
            </div>
          </Section>
        )}

        {/* ── FAMILY ───────────────────────────────────────────────────── */}
        {activeTab === 'family' && (
          <Section icon={icons.heart} title="Family & Marital Status"
            {...ss('family')} onSave={saveFamily}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Marital status">
                <Select value={profile.marital_status ?? ''} onChange={e => setField('marital_status', e.target.value)}>
                  <option value="">— Select —</option>
                  <option value="single">Single</option>
                  <option value="married">Married</option>
                  <option value="widowed">Widowed</option>
                  <option value="divorced">Divorced</option>
                  <option value="separated">Separated</option>
                </Select>
              </Field>
              {profile.marital_status === 'married' && <>
                <Field label="Type of marriage">
                  <Select value={profile.marriage_type ?? ''} onChange={e => setField('marriage_type', e.target.value)}>
                    <option value="">— Select —</option>
                    <option value="church">Church</option>
                    <option value="civil">Civil</option>
                    <option value="customary">Customary</option>
                  </Select>
                </Field>
                <Field label="Marriage date">
                  <Input type="date" value={profile.marriage_date?.split('T')[0] ?? ''} onChange={e => setField('marriage_date', e.target.value)} />
                </Field>
                <Field label="Spouse name">
                  <Input value={profile.spouse_name ?? ''} onChange={e => setField('spouse_name', e.target.value)} />
                </Field>
                <Field label="Spouse phone">
                  <Input type="tel" value={profile.spouse_phone ?? ''} onChange={e => setField('spouse_phone', e.target.value)} placeholder="+255 700 000 000" />
                </Field>
              </>}
            </div>
          </Section>
        )}

        {/* ── WORK & EDUCATION ──────────────────────────────────────────── */}
        {activeTab === 'work' && (
          <Section icon={icons.briefcase} title="Work & Education"
            {...ss('work')} onSave={saveWork}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Occupation">
                <Input value={profile.occupation ?? ''} onChange={e => setField('occupation', e.target.value)} placeholder="e.g. Teacher" />
              </Field>
              <Field label="Workplace / Employer">
                <Input value={profile.workplace ?? ''} onChange={e => setField('workplace', e.target.value)} />
              </Field>
              <Field label="Highest education">
                <Select value={profile.education ?? ''} onChange={e => setField('education', e.target.value)}>
                  <option value="">— Select —</option>
                  <option value="none">None</option>
                  <option value="primary">Primary</option>
                  <option value="secondary">Secondary</option>
                  <option value="diploma">Diploma</option>
                  <option value="degree">Degree</option>
                  <option value="postgraduate">Postgraduate</option>
                </Select>
              </Field>
              <Field label="Profession / Field">
                <Input value={profile.profession ?? ''} onChange={e => setField('profession', e.target.value)} placeholder="e.g. Engineering" />
              </Field>
            </div>
          </Section>
        )}

        {/* ── ADDRESS ──────────────────────────────────────────────────── */}
        {activeTab === 'address' && (
          <Section icon={icons.mapPin} title="Address"
            {...ss('address')} onSave={saveAddress}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Street / Plot no.">
                <Input value={profile.street ?? ''} onChange={e => setField('street', e.target.value)} placeholder="Plot 12, Uhuru Street" />
              </Field>
              <Field label="District">
                <Input value={profile.district ?? ''} onChange={e => setField('district', e.target.value)} placeholder="Kinondoni" />
              </Field>
              <Field label="Region">
                <Input value={profile.region ?? ''} onChange={e => setField('region', e.target.value)} placeholder="Dar es Salaam" />
              </Field>
              <Field label="Postal code">
                <Input value={profile.postal_code ?? ''} onChange={e => setField('postal_code', e.target.value)} placeholder="11101" />
              </Field>
            </div>
          </Section>
        )}

        {/* ── DEPENDANTS ───────────────────────────────────────────────── */}
        {activeTab === 'dependants' && (
          <Section icon={icons.users} title="Dependants" noPadding>

            {/* Add form */}
            <div className="px-6 py-5 border-b border-stone-100">
              <p className="text-xs text-stone-500 mb-3">Add children, elderly relatives, or others under your care.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  placeholder="Full name *"
                  value={depForm.full_name}
                  onChange={e => setDepForm(f => ({ ...f, full_name: e.target.value }))}
                />
                <Select
                  value={depForm.relationship}
                  onChange={e => setDepForm(f => ({ ...f, relationship: e.target.value }))}
                >
                  <option value="">Relationship</option>
                  <option value="child">Child</option>
                  <option value="parent">Parent</option>
                  <option value="sibling">Sibling</option>
                  <option value="spouse">Spouse</option>
                  <option value="other">Other</option>
                </Select>
                <Input
                  type="date"
                  value={depForm.date_of_birth}
                  onChange={e => setDepForm(f => ({ ...f, date_of_birth: e.target.value }))}
                />
              </div>
              {depError && <p className="text-xs text-red-500 mt-2">{depError}</p>}
              <button
                onClick={addDependant}
                className="mt-3 flex items-center gap-1.5 px-4 py-2 text-sm font-medium
                  bg-amber-500 hover:bg-amber-600 text-white rounded-lg shadow-sm transition"
              >
                <Icon path={icons.plus} size={14} />
                Add dependant
              </button>
            </div>

            {/* List */}
            {depLoading ? (
              <div className="flex justify-center py-8">
                <span className="w-5 h-5 border-2 border-stone-200 border-t-amber-400 rounded-full animate-spin" />
              </div>
            ) : dependants.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-stone-400">No dependants added yet.</p>
            ) : (
              <ul className="divide-y divide-stone-50">
                {dependants.map(dep => (
                  <li key={dep.id} className="flex items-center gap-4 px-6 py-4">
                    <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 text-sm font-semibold flex-shrink-0">
                      {dep.full_name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-800 truncate">{dep.full_name}</p>
                      <p className="text-xs text-stone-400 capitalize">
                        {dep.relationship || '—'}
                        {dep.date_of_birth ? ` · Born ${new Date(dep.date_of_birth).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => removeDependant(dep.id)}
                      className="p-1.5 text-stone-300 hover:text-red-400 transition rounded-lg hover:bg-red-50"
                      title="Remove"
                    >
                      <Icon path={icons.trash} size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}

        {/* ── SECURITY ─────────────────────────────────────────────────── */}
        {activeTab === 'security' && (
          <Section icon={icons.lock} title="Change Password"
            {...ss('security')} onSave={saveSecurity}>
            <div className="max-w-sm space-y-4">
              {[
                { key: 'current_password', label: 'Current password' },
                { key: 'new_password',     label: 'New password' },
                { key: 'confirm',          label: 'Confirm new password' },
              ].map(({ key, label }) => (
                <Field key={key} label={label}>
                  <div className="relative">
                    <Input
                      type={showPw[key] ? 'text' : 'password'}
                      value={pwForm[key]}
                      onChange={e => setPwForm(f => ({ ...f, [key]: e.target.value }))}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(s => ({ ...s, [key]: !s[key] }))}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-300 hover:text-stone-500 transition"
                    >
                      <Icon path={showPw[key] ? icons.eyeOff : icons.eye} size={15} />
                    </button>
                  </div>
                </Field>
              ))}
              {pwError && <p className="text-xs text-red-500">{pwError}</p>}
              <p className="text-xs text-stone-400">Minimum 8 characters. Use a mix of letters, numbers, and symbols for a strong password.</p>
            </div>
          </Section>
        )}

      </div>
    </div>
  );
}