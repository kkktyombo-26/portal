'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../lib/i18n';
import { userApi, dependantApi, ministryApi, committeeApi } from '../../lib/api';
// ── CHANGED: was `import CloudinaryService from '../../lib/cloudinary'`
import R2UploadService from '../../lib/r2UploadService';

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
  plus:      'M12 5v14M5 12h14',
  trash:     'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  eye:       'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  eyeOff:    'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22',
  cross:     'M12 2v20M2 12h20',
  upload:    'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  file:      'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6',
  camera:    'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  x:         'M18 6L6 18M6 6l12 12',
};

// ── Tiny cross decoration ────────────────────────────────────────────────────
function TinyCross({ className = 'text-amber-400' }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" className={className} aria-hidden>
      <line x1="6" y1="1" x2="6" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ── Primitives ────────────────────────────────────────────────────────────────
function Field({ label, hint, error, children, className = '' }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-xs font-medium text-stone-500 tracking-wide">{label}</label>
      {children}
      {hint  && <p className="text-xs text-stone-400">{hint}</p>}
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

// ── Floating Save Button ──────────────────────────────────────────────────────

function FloatingSaveBtn({ saving, saved, onClick }) {
  return (
    <div className="fab-profile-save">
      <button
        onClick={onClick}
        disabled={saving}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 20px',
          fontSize: '14px',
          fontWeight: 600,
          fontFamily: 'Inter, system-ui, sans-serif',
          color: '#ffffff',
          backgroundColor: saved ? '#16a34a' : '#f59e0b',
          border: 'none',
          borderRadius: '9999px',
          cursor: saving ? 'not-allowed' : 'pointer',
          opacity: saving ? 0.75 : 1,
          boxShadow: '0 8px 24px rgba(245,158,11,0.35)',
          whiteSpace: 'nowrap',
        }}
      >
        {saving ? (
          <span style={{
            width: 15, height: 15, borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.35)',
            borderTopColor: '#fff',
            display: 'inline-block',
            animation: 'spin 0.7s linear infinite',
            flexShrink: 0,
          }} />
        ) : saved ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
          </svg>
        )}
        <span>{saving ? 'Saving…' : saved ? 'Saved!' : 'Save changes'}</span>
      </button>
    </div>
  );
}


// ── Section wrapper ──────────────────────────────────────────────────────────
function Section({ icon, title, children, noPadding = false }) {
  return (
    <div className="bg-white rounded-2xl border border-stone-100 shadow-sm">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-stone-100">
        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex-shrink-0">
          <Icon path={icon} size={16} />
        </span>
        <h2 className="font-semibold text-stone-800">{title}</h2>
      </div>
      <div className={noPadding ? '' : 'px-6 py-5'}>
        {children}
      </div>
    </div>
  );
}

function SubHeading({ children }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-xs font-semibold text-stone-400 uppercase tracking-widest">{children}</span>
      <span className="flex-1 h-px bg-stone-100" />
    </div>
  );
}

// ── Shared checkbox (ministries & committees) ────────────────────────────────
function ServiceCheck({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer group">
      <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition
        ${checked ? 'bg-amber-500 border-amber-500' : 'border-stone-300 bg-white group-hover:border-amber-400'}`}>
        {checked && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </span>
      <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
      <span className="text-sm text-stone-700">{label}</span>
    </label>
  );
}

// ── Upload progress ring ──────────────────────────────────────────────────────
function ProgressRing({ percent, size = 64 }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <svg width={size} height={size} className="absolute inset-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="white" strokeWidth="3"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.2s' }} />
    </svg>
  );
}

// ── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'personal',   label: 'Personal',        icon: icons.user },
  { id: 'family',     label: 'Family',           icon: icons.heart },
  { id: 'work',       label: 'Work & Education', icon: icons.briefcase },
  { id: 'address',    label: 'Address',          icon: icons.mapPin },
  { id: 'spiritual',  label: 'Spiritual',        icon: icons.cross },
  { id: 'dependants', label: 'Dependants',       icon: icons.users },
  { id: 'security',   label: 'Security',         icon: icons.lock },
];

// ── DB ENUM maps ──────────────────────────────────────────────────────────────
const MEMBER_STATUS = [
  { value: 'hai',       label: 'Active (Hai)' },
  { value: 'amehamia',  label: 'Transferred (Amehamia)' },
  { value: 'amefariki', label: 'Deceased (Amefariki)' },
];
const MARITAL_STATUS = [
  { value: 'Ameoa',          label: 'Married — male (Ameoa)' },
  { value: 'Ameolewa',       label: 'Married — female (Ameolewa)' },
  { value: 'Hajaoa',         label: 'Single — male (Hajaoa)' },
  { value: 'Hajaolewa',      label: 'Single — female (Hajaolewa)' },
  { value: 'Mjane',          label: 'Widowed (Mjane)' },
  { value: 'Talaka',         label: 'Divorced (Talaka)' },
  { value: 'Anaishi na mtu', label: 'Cohabiting (Anaishi na mtu)' },
];
const MARRIAGE_TYPE = [
  { value: 'Kikristo',      label: 'Church (Kikristo)' },
  { value: 'Siya Kikristo', label: 'Civil / Customary (Siya Kikristo)' },
];

// ════════════════════════════════════════════════════════════════════════════
// Main component
// ════════════════════════════════════════════════════════════════════════════
export default function ProfilePage() {
  const { user: authUser } = useAuth();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState('personal');
  const [profile,   setProfile]   = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  // Per-section save state
  const [sectionState, setSectionState] = useState({});
  const setSaving = (key, val) =>
    setSectionState(s => ({ ...s, [key]: { ...s[key], saving: val } }));
  const setSaved = (key, val) =>
    setSectionState(s => ({ ...s, [key]: { ...s[key], saved: val } }));
  const ss = key => ({
    saving: sectionState[key]?.saving ?? false,
    saved:  sectionState[key]?.saved  ?? false,
  });

  // ── Photo upload state ────────────────────────────────────────────────────
  const [photoStage,    setPhotoStage]    = useState('idle');
  const [photoProgress, setPhotoProgress] = useState(0);
  const [photoError,    setPhotoError]    = useState(null);
  const photoInputRef = useRef(null);

  // ── CV upload state ───────────────────────────────────────────────────────
  const [cvStage,    setCvStage]    = useState('idle');
  const [cvProgress, setCvProgress] = useState(0);
  const [cvFileName, setCvFileName] = useState(null);
  const [cvError,    setCvError]    = useState(null);
  const cvInputRef = useRef(null);

  // ── Ministries ────────────────────────────────────────────────────────────
  const [ministries,       setMinistries]  = useState([]);
  const [memberMinistries, setMemberMin]   = useState([]);

  // ── Committees ───────────────────────────────────────────────────────────
  const [committees,       setCommittees]  = useState([]);
  const [memberCommittees, setMemberCom]   = useState([]);

  // Single loading flag shared by both spiritual data fetches
  const [minLoading, setMinLoading] = useState(false);

  // ── Dependants ────────────────────────────────────────────────────────────
  const [dependants, setDependants] = useState([]);
  const [depLoading, setDepLoading] = useState(false);
  const [depForm,    setDepForm]    = useState({ full_name: '', relationship: '', date_of_birth: '' });
  const [depError,   setDepError]   = useState('');

  // ── Security ──────────────────────────────────────────────────────────────
  const [pwForm,  setPwForm]  = useState({ current_password: '', new_password: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [showPw,  setShowPw]  = useState({ current_password: false, new_password: false, confirm: false });

  // ── Load profile ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authUser?.id) return;
    setLoading(true);
    userApi.getOne(authUser.id)
      .then(res => { setProfile(res.data.data ?? res.data); setError(null); })
      .catch(() => setError('Could not load profile. Please refresh.'))
      .finally(() => setLoading(false));
  }, [authUser?.id]);

  // ── Load spiritual data (lazy) — ministries + committees together ─────────
  useEffect(() => {
    if (!authUser?.id || activeTab !== 'spiritual') return;
    if (ministries.length > 0 || committees.length > 0) return;

    setMinLoading(true);
    Promise.all([
      ministryApi.getAll(),
      ministryApi.getMemberMinistries(authUser.id),
      committeeApi.getAll(),
      committeeApi.getMemberCommittees(authUser.id),
    ])
      .then(([minCat, minMem, comCat, comMem]) => {
        setMinistries(minCat.data.data ?? []);
        setMemberMin((minMem.data.data ?? []).map(m => m.ministry_id ?? m.id));
        setCommittees(comCat.data.data ?? []);
        setMemberCom((comMem.data.data ?? []).map(c => c.committee_id ?? c.id));
      })
      .catch(() => {})
      .finally(() => setMinLoading(false));
  }, [authUser?.id, activeTab]);

  // ── Load dependants (lazy) ────────────────────────────────────────────────
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

  // ════════════════════════════════════════════════════════════════════════
  // PHOTO UPLOAD
  // ── CHANGED: CloudinaryService.uploadFromFile → R2UploadService.uploadFromFile
  //    folder maps to an R2 key prefix on your backend instead of a Cloudinary folder
  //    result.secureUrl is still result.secureUrl (R2UploadService mirrors the shape)
  // ════════════════════════════════════════════════════════════════════════
  async function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setPhotoError(null);
    setPhotoProgress(0);

    if (file.size > 5 * 1024 * 1024) { setPhotoError('Image must be under 5 MB.'); return; }

    const localPreview = URL.createObjectURL(file);
    setField('_photoPreview', localPreview);

    try {
      setPhotoStage('uploading');
      // ── CHANGED ──────────────────────────────────────────────────────────
      const result = await R2UploadService.uploadFromFile({
        file,
        folder: 'church_portal/profile_photos',
        onProgress: pct => setPhotoProgress(pct),
      });
      // ─────────────────────────────────────────────────────────────────────
      setPhotoStage('saving');
      await userApi.update(authUser.id, { profile_photo_url: result.secureUrl });
      setField('profile_photo_url', result.secureUrl);
      setField('_photoPreview', null);
      URL.revokeObjectURL(localPreview);
      setPhotoStage('done');
      setTimeout(() => setPhotoStage('idle'), 2000);
    } catch {
      setPhotoError('Photo upload failed. Please try again.');
      setField('_photoPreview', null);
      URL.revokeObjectURL(localPreview);
      setPhotoStage('idle');
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // CV UPLOAD
  // ── CHANGED: same swap as above
  // ════════════════════════════════════════════════════════════════════════
  async function handleCvChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setCvError(null);
    setCvProgress(0);
    setCvFileName(file.name);

    if (file.size > 10 * 1024 * 1024) { setCvError('CV must be under 10 MB.'); setCvFileName(null); return; }

    try {
      setCvStage('uploading');
      // ── CHANGED ──────────────────────────────────────────────────────────
      const result = await R2UploadService.uploadFromFile({
        file,
        folder: 'church_portal/cvs',
        onProgress: pct => setCvProgress(pct),
      });
      // ─────────────────────────────────────────────────────────────────────
      setCvStage('saving');
      await userApi.update(authUser.id, { cv_url: result.secureUrl });
      setField('cv_url', result.secureUrl);
      setCvStage('done');
      setTimeout(() => setCvStage('idle'), 2000);
    } catch {
      setCvError('CV upload failed. Please try again.');
      setCvStage('idle');
      setCvFileName(null);
    }
  }

  // ── Save handlers ─────────────────────────────────────────────────────────
  const savePersonal = () => saveSection('personal', {
    full_name:            profile.full_name,
    email:                profile.email,
    phone:                profile.phone,
    gender:               profile.gender,
    date_of_birth:        profile.date_of_birth,
    place_of_birth:       profile.place_of_birth,
    member_since:         profile.member_since,
    member_status:        profile.member_status,
    willing_to_volunteer: profile.willing_to_volunteer,
  });

  const saveFamily = () => {
    const isMarried    = ['Ameoa', 'Ameolewa'].includes(profile.marital_status);
    const isCohabiting = profile.marital_status === 'Anaishi na mtu';
    return saveSection('family', {
      marital_status:          profile.marital_status,
      marriage_type:           isMarried    ? profile.marriage_type           : null,
      marriage_date:           isMarried    ? profile.marriage_date           : null,
      marriage_place:          isMarried    ? profile.marriage_place          : null,
      spouse_name:             isMarried    ? profile.spouse_name             : null,
      spouse_phone:            isMarried    ? profile.spouse_phone            : null,
      cohabiting_partner_name: isCohabiting ? profile.cohabiting_partner_name : null,
    });
  };

  const saveWork    = () => saveSection('work', {
    occupation: profile.occupation,
    workplace:  profile.workplace,
    education:  profile.education,
    profession: profile.profession,
  });

  const saveAddress = () => saveSection('address', {
    street:                 profile.street,
    district:               profile.district,
    region:                 profile.region,
    postal_code:            profile.postal_code,
    area_name:              profile.area_name,
    block_no:               profile.block_no,
    jumuiya:                profile.jumuiya,
    slp:                    profile.slp,
    previous_church:        profile.previous_church,
    neighbour_member_name:  profile.neighbour_member_name,
    neighbour_member_phone: profile.neighbour_member_phone,
    elder_name:             profile.elder_name,
    elder_phone:            profile.elder_phone,
  });

  const saveSpiritual = async () => {
    setSaving('spiritual', true);
    try {
      await Promise.all([
        userApi.update(authUser.id, {
          baptism_date:      profile.baptism_date,
          confirmation_date: profile.confirmation_date,
          takes_communion:   profile.takes_communion,
        }),
        ministryApi.syncMemberMinistries(authUser.id, memberMinistries),
        committeeApi.syncMemberCommittees(authUser.id, memberCommittees),
      ]);
      setSaved('spiritual', true);
      setTimeout(() => setSaved('spiritual', false), 2500);
    } catch (err) {
      alert(err?.response?.data?.message ?? 'Save failed. Please try again.');
    } finally {
      setSaving('spiritual', false);
    }
  };

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

  // ── Toggle helpers ────────────────────────────────────────────────────────
  const toggleMinistry  = (id) =>
    setMemberMin(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleCommittee = (id) =>
    setMemberCom(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  // ── Password handler ──────────────────────────────────────────────────────
  const saveSecurity = async () => {
    if (pwForm.new_password !== pwForm.confirm) { setPwError('New passwords do not match.'); return; }
    if (pwForm.new_password.length < 8)          { setPwError('Password must be at least 8 characters.'); return; }
    setPwError('');
    setSaving('security', true);
    try {
      await userApi.changePassword(authUser.id, {
        current_password: pwForm.current_password,
        new_password:     pwForm.new_password,
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

  // ── Derived ───────────────────────────────────────────────────────────────
  const isMarried    = ['Ameoa', 'Ameolewa'].includes(profile?.marital_status);
  const isCohabiting = profile?.marital_status === 'Anaishi na mtu';

  const ministryGroups = ministries.reduce((acc, m) => {
    const cat = m.category ?? 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(m);
    return acc;
  }, {});

  const avatarSrc = profile?._photoPreview || profile?.profile_photo_url || null;

  // ── Loading / error ───────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <span className="w-6 h-6 border-2 border-stone-300 border-t-amber-400 rounded-full animate-spin" />
    </div>
  );
  if (error)    return <div className="p-6 text-center text-red-500 text-sm">{error}</div>;
  if (!profile) return null;

  // ── Render ────────────────────────────────────────────────────────────────
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

      <div className="max-w-3xl mx-auto px-4 xl:pr-6 py-6 pb-24 space-y-4">

        {/* ── Avatar / identity card ──────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm px-6 py-5 flex items-center gap-5">
          <div className="relative flex-shrink-0 group">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-amber-100 flex items-center
              justify-center text-amber-700 text-2xl font-bold select-none">
              {avatarSrc
                ? <img src={avatarSrc} alt={profile.full_name} className="w-full h-full object-cover" />
                : (profile.full_name?.trim() || '?')[0].toUpperCase()
              }
            </div>

            {photoStage === 'idle' || photoStage === 'done' ? (
              <label
                className={`absolute inset-0 rounded-full flex items-center justify-center
                  bg-black/40 cursor-pointer transition-opacity duration-150
                  ${photoStage === 'done' ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'}`}
                title="Change photo"
              >
                <Icon path={icons.camera} size={18} className="text-white" />
                <input ref={photoInputRef} type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden" onChange={handlePhotoChange} />
              </label>
            ) : (
              <div className="absolute inset-0 rounded-full bg-black/50 flex flex-col items-center justify-center">
                <ProgressRing percent={photoProgress} size={64} />
                <span className="absolute text-white text-[10px] font-bold">
                  {photoStage === 'saving' ? '…' : `${photoProgress}%`}
                </span>
              </div>
            )}

            {photoStage === 'done' && (
              <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full
                bg-green-500 border-2 border-white flex items-center justify-center">
                <Icon path={icons.check} size={10} className="text-white" />
              </span>
            )}
            {(photoStage === 'idle' || photoStage === 'done') && (
              <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white
                ${profile.member_status === 'hai' ? 'bg-green-400' : 'bg-stone-300'}`} />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-semibold text-stone-900 truncate">{profile.full_name}</p>
            <p className="text-xs text-stone-400 capitalize">
              {profile.role} · {MEMBER_STATUS.find(s => s.value === profile.member_status)?.label ?? 'Member'}
            </p>
            {photoError && <p className="text-xs text-red-500 mt-1">{photoError}</p>}
            {!avatarSrc && photoStage === 'idle' && (
              <button onClick={() => photoInputRef.current?.click()}
                className="mt-1 text-xs text-amber-600 hover:underline">
                + Add photo
              </button>
            )}
          </div>

          <span className="hidden sm:block text-xs text-stone-300 font-mono">
            #{String(profile.id).padStart(4, '0')}
          </span>
        </div>

        {/* ── Tab bar ─────────────────────────────────────────────────── */}
        <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-hide">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition
                ${activeTab === tab.id
                  ? 'bg-white text-amber-600 shadow-sm border border-stone-100'
                  : 'text-stone-500 hover:text-stone-700 hover:bg-stone-100'}`}>
              <Icon path={tab.icon} size={13} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════
            PERSONAL
        ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'personal' && (
          <Section icon={icons.user} title="Personal Information">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full name">
                <Input value={profile.full_name ?? ''} onChange={e => setField('full_name', e.target.value)} />
              </Field>
              <Field label="Email address">
                <Input type="email" value={profile.email ?? ''} onChange={e => setField('email', e.target.value)}
                  placeholder="member@example.com" />
              </Field>
              <Field label="Phone">
                <Input type="tel" value={profile.phone ?? ''} onChange={e => setField('phone', e.target.value)}
                  placeholder="+255 700 000 000" />
              </Field>
              <Field label="Gender">
                <Select value={profile.gender ?? ''} onChange={e => setField('gender', e.target.value)}>
                  <option value="">— Select —</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </Select>
              </Field>
              <Field label="Date of birth">
                <Input type="date" value={profile.date_of_birth?.split('T')[0] ?? ''}
                  onChange={e => setField('date_of_birth', e.target.value)} />
              </Field>
              <Field label="Place of birth">
                <Input value={profile.place_of_birth ?? ''} onChange={e => setField('place_of_birth', e.target.value)}
                  placeholder="City or town" />
              </Field>
              <Field label="Member since">
                <Input type="date" value={profile.member_since?.split('T')[0] ?? ''}
                  onChange={e => setField('member_since', e.target.value)} />
              </Field>
              <Field label="Member status">
                <Select value={profile.member_status ?? ''} onChange={e => setField('member_status', e.target.value)}>
                  <option value="">— Select —</option>
                  {MEMBER_STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </Select>
              </Field>
              <Field label="Willing to volunteer?" className="sm:col-span-2">
                <Select value={profile.willing_to_volunteer ? 'yes' : 'no'}
                  onChange={e => setField('willing_to_volunteer', e.target.value === 'yes')}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </Select>
              </Field>
            </div>

            {/* CV upload */}
            <div className="mt-6 pt-5 border-t border-stone-100">
              <SubHeading>CV / Résumé</SubHeading>
              <input ref={cvInputRef} type="file" accept=".pdf,.doc,.docx"
                className="hidden" onChange={handleCvChange} />
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => cvInputRef.current?.click()}
                  disabled={cvStage === 'uploading' || cvStage === 'saving'}
                  className="flex items-center gap-2 px-3 py-2 text-sm border border-stone-200 rounded-lg
                    bg-white text-stone-600 hover:border-amber-400 hover:text-amber-600
                    disabled:opacity-50 disabled:cursor-not-allowed transition">
                  <Icon path={icons.upload} size={14} />
                  {profile.cv_url ? 'Replace CV' : 'Upload CV'}
                </button>
                {cvStage === 'uploading' && (
                  <div className="flex items-center gap-2 text-xs text-stone-500">
                    <span className="w-3.5 h-3.5 border-2 border-stone-300 border-t-amber-500 rounded-full animate-spin flex-shrink-0" />
                    Uploading… {cvProgress}%
                    <div className="w-24 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${cvProgress}%` }} />
                    </div>
                  </div>
                )}
                {cvStage === 'saving' && (
                  <div className="flex items-center gap-2 text-xs text-stone-500">
                    <span className="w-3.5 h-3.5 border-2 border-stone-300 border-t-amber-500 rounded-full animate-spin flex-shrink-0" />
                    Saving…
                  </div>
                )}
                {cvStage === 'done' && (
                  <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                    <Icon path={icons.check} size={13} />CV uploaded
                  </div>
                )}
                {cvStage === 'idle' && cvFileName && (
                  <span className="text-xs text-stone-500 truncate max-w-[180px]">{cvFileName}</span>
                )}
                {profile.cv_url && cvStage === 'idle' && (
                  <a href={profile.cv_url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs text-amber-600 hover:underline ml-auto">
                    <Icon path={icons.file} size={13} />View current CV
                  </a>
                )}
              </div>
              {cvError && <p className="mt-2 text-xs text-red-500">{cvError}</p>}
              {cvStage === 'idle' && !cvError && (
                <p className="mt-1.5 text-xs text-stone-400">PDF or Word · max 10 MB</p>
              )}
            </div>
          </Section>
        )}

        {/* ══════════════════════════════════════════════════════════════
            FAMILY
        ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'family' && (
          <Section icon={icons.heart} title="Family & Marital Status">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Marital status" className="sm:col-span-2">
                <Select value={profile.marital_status ?? ''} onChange={e => setField('marital_status', e.target.value)}>
                  <option value="">— Select —</option>
                  {MARITAL_STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </Select>
              </Field>
              {isCohabiting && (
                <Field label="Partner name" className="sm:col-span-2">
                  <Input value={profile.cohabiting_partner_name ?? ''}
                    onChange={e => setField('cohabiting_partner_name', e.target.value)}
                    placeholder="Full name of partner" />
                </Field>
              )}
              {isMarried && (
                <>
                  <Field label="Type of marriage">
                    <Select value={profile.marriage_type ?? ''} onChange={e => setField('marriage_type', e.target.value)}>
                      <option value="">— Select —</option>
                      {MARRIAGE_TYPE.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </Select>
                  </Field>
                  <Field label="Marriage date">
                    <Input type="date" value={profile.marriage_date?.split('T')[0] ?? ''}
                      onChange={e => setField('marriage_date', e.target.value)} />
                  </Field>
                  <Field label="Marriage place">
                    <Input value={profile.marriage_place ?? ''} onChange={e => setField('marriage_place', e.target.value)}
                      placeholder="Church or office name" />
                  </Field>
                  <Field label="Spouse name">
                    <Input value={profile.spouse_name ?? ''} onChange={e => setField('spouse_name', e.target.value)} />
                  </Field>
                  <Field label="Spouse phone">
                    <Input type="tel" value={profile.spouse_phone ?? ''} onChange={e => setField('spouse_phone', e.target.value)}
                      placeholder="+255 700 000 000" />
                  </Field>
                </>
              )}
            </div>
          </Section>
        )}

        {/* ══════════════════════════════════════════════════════════════
            WORK & EDUCATION
        ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'work' && (
          <Section icon={icons.briefcase} title="Work & Education">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Occupation">
                <Input value={profile.occupation ?? ''} onChange={e => setField('occupation', e.target.value)}
                  placeholder="e.g. Teacher" />
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
                <Input value={profile.profession ?? ''} onChange={e => setField('profession', e.target.value)}
                  placeholder="e.g. Engineering" />
              </Field>
            </div>
          </Section>
        )}

        {/* ══════════════════════════════════════════════════════════════
            ADDRESS
        ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'address' && (
          <Section icon={icons.mapPin} title="Address & Contact Details">
            <SubHeading>General address</SubHeading>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <Field label="Street / Plot no.">
                <Input value={profile.street ?? ''} onChange={e => setField('street', e.target.value)}
                  placeholder="Plot 12, Uhuru Street" />
              </Field>
              <Field label="Area name (Mtaa)">
                <Input value={profile.area_name ?? ''} onChange={e => setField('area_name', e.target.value)}
                  placeholder="e.g. Mikocheni" />
              </Field>
              <Field label="Block no.">
                <Input value={profile.block_no ?? ''} onChange={e => setField('block_no', e.target.value)}
                  placeholder="e.g. B-14" />
              </Field>
              <Field label="Jumuiya">
                <Input value={profile.jumuiya ?? ''} onChange={e => setField('jumuiya', e.target.value)}
                  placeholder="Jumuiya name" />
              </Field>
              <Field label="District">
                <Input value={profile.district ?? ''} onChange={e => setField('district', e.target.value)}
                  placeholder="Kinondoni" />
              </Field>
              <Field label="Region">
                <Input value={profile.region ?? ''} onChange={e => setField('region', e.target.value)}
                  placeholder="Dar es Salaam" />
              </Field>
              <Field label="P.O. Box (SLP)">
                <Input value={profile.slp ?? ''} onChange={e => setField('slp', e.target.value)}
                  placeholder="S.L.P 1234" />
              </Field>
              <Field label="Postal code">
                <Input value={profile.postal_code ?? ''} onChange={e => setField('postal_code', e.target.value)}
                  placeholder="11101" />
              </Field>
            </div>
            <SubHeading>Church history</SubHeading>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <Field label="Previous church" className="sm:col-span-2">
                <Input value={profile.previous_church ?? ''} onChange={e => setField('previous_church', e.target.value)}
                  placeholder="Name of previous congregation" />
              </Field>
            </div>
            <SubHeading>Neighbour member reference</SubHeading>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <Field label="Neighbour member name">
                <Input value={profile.neighbour_member_name ?? ''} onChange={e => setField('neighbour_member_name', e.target.value)}
                  placeholder="Full name" />
              </Field>
              <Field label="Neighbour member phone">
                <Input type="tel" value={profile.neighbour_member_phone ?? ''}
                  onChange={e => setField('neighbour_member_phone', e.target.value)}
                  placeholder="+255 700 000 000" />
              </Field>
            </div>
            <SubHeading>Elder / Cell leader</SubHeading>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Elder name (Mzee wa roho)">
                <Input value={profile.elder_name ?? ''} onChange={e => setField('elder_name', e.target.value)}
                  placeholder="Full name" />
              </Field>
              <Field label="Elder phone">
                <Input type="tel" value={profile.elder_phone ?? ''} onChange={e => setField('elder_phone', e.target.value)}
                  placeholder="+255 700 000 000" />
              </Field>
            </div>
          </Section>
        )}

        {/* ══════════════════════════════════════════════════════════════
            SPIRITUAL
        ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'spiritual' && (
          <Section icon={icons.cross} title="Spiritual Services (Huduma za Kiroho)">

            <SubHeading>Sacraments (Sakramenti)</SubHeading>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <Field label="Baptism date (Tarehe ya Ubatizo)">
                <Input type="date" value={profile.baptism_date?.split('T')[0] ?? ''}
                  onChange={e => setField('baptism_date', e.target.value)} />
              </Field>
              <Field label="Confirmation date (Tarehe ya Kipaimara)">
                <Input type="date" value={profile.confirmation_date?.split('T')[0] ?? ''}
                  onChange={e => setField('confirmation_date', e.target.value)} />
              </Field>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2.5 cursor-pointer group">
                  <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition
                    ${profile.takes_communion ? 'bg-amber-500 border-amber-500' : 'border-stone-300 bg-white group-hover:border-amber-400'}`}>
                    {profile.takes_communion && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </span>
                  <input type="checkbox" className="sr-only"
                    checked={!!profile.takes_communion}
                    onChange={e => setField('takes_communion', e.target.checked)} />
                  <span className="text-sm text-stone-700">
                    Participates in Lord's Supper
                    <span className="text-stone-400 ml-1">(Sakramenti ya Meza ya Bwana)</span>
                  </span>
                </label>
              </div>
            </div>

            {minLoading ? (
              <div className="flex justify-center py-6">
                <span className="w-5 h-5 border-2 border-stone-200 border-t-amber-400 rounded-full animate-spin" />
              </div>
            ) : (
              <>
                <SubHeading>Ministry involvement (Huduma)</SubHeading>
                {ministries.length === 0 ? (
                  <p className="text-sm text-stone-400 mb-6">No ministries found.</p>
                ) : (
                  <div className="space-y-5 mb-8">
                    {Object.entries(ministryGroups).map(([cat, items]) => (
                      <div key={cat}>
                        <p className="text-xs font-medium text-stone-400 mb-2">{cat}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {items.map(m => (
                            <ServiceCheck key={m.id} label={m.name}
                              checked={memberMinistries.includes(m.id)}
                              onChange={() => toggleMinistry(m.id)} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <SubHeading>Committee membership (Kamati)</SubHeading>
                {committees.length === 0 ? (
                  <p className="text-sm text-stone-400">No committees found.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {committees.map(c => (
                      <ServiceCheck key={c.id} label={c.name}
                        checked={memberCommittees.includes(c.id)}
                        onChange={() => toggleCommittee(c.id)} />
                    ))}
                  </div>
                )}
              </>
            )}
          </Section>
        )}

        {/* ══════════════════════════════════════════════════════════════
            DEPENDANTS
        ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'dependants' && (
          <Section icon={icons.users} title="Dependants" noPadding>
            <div className="px-6 py-5 border-b border-stone-100">
              <p className="text-xs text-stone-500 mb-3">Add children, elderly relatives, or others under your care.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input placeholder="Full name *" value={depForm.full_name}
                  onChange={e => setDepForm(f => ({ ...f, full_name: e.target.value }))} />
                <Select value={depForm.relationship}
                  onChange={e => setDepForm(f => ({ ...f, relationship: e.target.value }))}>
                  <option value="">Relationship</option>
                  <option value="child">Child</option>
                  <option value="parent">Parent</option>
                  <option value="sibling">Sibling</option>
                  <option value="other">Other</option>
                </Select>
                <Input type="date" value={depForm.date_of_birth}
                  onChange={e => setDepForm(f => ({ ...f, date_of_birth: e.target.value }))} />
              </div>
              {depError && <p className="text-xs text-red-500 mt-2">{depError}</p>}
              <button onClick={addDependant}
                className="mt-3 flex items-center gap-1.5 px-4 py-2 text-sm font-medium
                  bg-amber-500 hover:bg-amber-600 text-white rounded-lg shadow-sm transition">
                <Icon path={icons.plus} size={14} />
                Add dependant
              </button>
            </div>
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
                    <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center
                      text-stone-500 text-sm font-semibold flex-shrink-0">
                      {dep.full_name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-800 truncate">{dep.full_name}</p>
                      <p className="text-xs text-stone-400 capitalize">
                        {dep.relationship || '—'}
                        {dep.date_of_birth
                          ? ` · Born ${new Date(dep.date_of_birth).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                          : ''}
                      </p>
                    </div>
                    <button onClick={() => removeDependant(dep.id)}
                      className="p-1.5 text-stone-300 hover:text-red-400 transition rounded-lg hover:bg-red-50">
                      <Icon path={icons.trash} size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}

        {/* ══════════════════════════════════════════════════════════════
            SECURITY
        ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'security' && (
          <Section icon={icons.lock} title="Change Password">
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
                    <button type="button"
                      onClick={() => setShowPw(s => ({ ...s, [key]: !s[key] }))}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-300 hover:text-stone-500 transition">
                      <Icon path={showPw[key] ? icons.eyeOff : icons.eye} size={15} />
                    </button>
                  </div>
                </Field>
              ))}
              {pwError && <p className="text-xs text-red-500">{pwError}</p>}
              <p className="text-xs text-stone-400">
                Minimum 8 characters. Use a mix of letters, numbers, and symbols.
              </p>
            </div>
          </Section>
        )}

      </div>

      {/* ── Floating save button ── */}
      {activeTab === 'personal'  && <FloatingSaveBtn {...ss('personal')}  onClick={savePersonal}  />}
      {activeTab === 'family'    && <FloatingSaveBtn {...ss('family')}    onClick={saveFamily}    />}
      {activeTab === 'work'      && <FloatingSaveBtn {...ss('work')}      onClick={saveWork}      />}
      {activeTab === 'address'   && <FloatingSaveBtn {...ss('address')}   onClick={saveAddress}   />}
      {activeTab === 'spiritual' && <FloatingSaveBtn {...ss('spiritual')} onClick={saveSpiritual} />}
      {activeTab === 'security'  && <FloatingSaveBtn {...ss('security')}  onClick={saveSecurity}  />}

    </div>
  );
}