'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../lib/i18n';
import { userApi, dependantApi, groupApi } from '../../lib/api';
import R2UploadService from '../../lib/r2UploadService';
import { JUMUIYA_LIST } from '../../lib/constants';

// ── Icons ─────────────────────────────────────────────────────────────────
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

function TinyCross({ className = 'text-amber-400' }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" className={className} aria-hidden>
      <line x1="6" y1="1" x2="6" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

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

function FloatingSaveBtn({ saving, saved, onClick, t }) {
  return (
    <div className="fab-profile-save">
      <button
        onClick={onClick}
        disabled={saving}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '12px 20px', fontSize: '14px', fontWeight: 600,
          fontFamily: 'Inter, system-ui, sans-serif', color: '#ffffff',
          backgroundColor: saved ? '#16a34a' : '#f59e0b',
          border: 'none', borderRadius: '9999px',
          cursor: saving ? 'not-allowed' : 'pointer',
          opacity: saving ? 0.75 : 1,
          boxShadow: '0 8px 24px rgba(245,158,11,0.35)', whiteSpace: 'nowrap',
        }}
      >
        {saving ? (
          <span style={{
            width: 15, height: 15, borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff',
            display: 'inline-block', animation: 'spin 0.7s linear infinite', flexShrink: 0,
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
        <span>{saving ? t('loading') : saved ? t('save') + '!' : t('save')}</span>
      </button>
    </div>
  );
}

function Section({ icon, title, children, noPadding = false }) {
  return (
    <div className="bg-white rounded-2xl border border-stone-100 shadow-sm">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-stone-100">
        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex-shrink-0">
          <Icon path={icon} size={16} />
        </span>
        <h2 className="font-semibold text-stone-800">{title}</h2>
      </div>
      <div className={noPadding ? '' : 'px-6 py-5'}>{children}</div>
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

function ServiceCheck({ label, checked, onChange }) {
  return (
    <label
      className="flex items-center gap-2.5 cursor-pointer select-none"
      onClick={onChange}
    >
      <span style={{
        width: 16, height: 16, borderRadius: 4, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: checked ? '2px solid #f59e0b' : '1.5px solid #d6d3d1',
        backgroundColor: checked ? '#f59e0b' : '#ffffff',
        transition: 'all 0.15s',
      }}>
        {checked && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </span>
      <span className="text-sm text-stone-700">{label}</span>
    </label>
  );
}

function ProgressRing({ percent, size = 64 }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <svg width={size} height={size} className="absolute inset-0 -rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="white" strokeWidth="3"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.2s' }} />
    </svg>
  );
}

// ════════════════════════════════════════════════════════════════════════════
export default function ProfilePage() {


  // ── Language toggle ───────────────────────────────────────────────────────
 const { user: authUser, lang, switchLang } = useAuth();
const { t } = useTranslation(lang);

  const TABS = [
    { id: 'personal',   label: t('tab_personal'),   icon: icons.user },
    { id: 'family',     label: t('tab_family'),      icon: icons.heart },
    { id: 'work',       label: t('tab_work'),        icon: icons.briefcase },
    { id: 'address',    label: t('tab_address'),     icon: icons.mapPin },
    { id: 'spiritual',  label: t('tab_spiritual'),   icon: icons.cross },
    { id: 'dependants', label: t('tab_dependants'),  icon: icons.users },
    { id: 'security',   label: t('tab_security'),    icon: icons.lock },
  ];

  const MEMBER_STATUS = [
    { value: 'hai',       label: t('status_hai') },
    { value: 'amehamia',  label: t('status_amehamia') },
    { value: 'amefariki', label: t('status_amefariki') },
  ];
  const MARITAL_STATUS = [
    { value: 'Ameoa',          label: t('marital_ameoa') },
    { value: 'Ameolewa',       label: t('marital_ameolewa') },
    { value: 'Hajaoa',         label: t('marital_hajaoa') },
    { value: 'Hajaolewa',      label: t('marital_hajaolewa') },
    { value: 'Mjane',          label: t('marital_mjane') },
    { value: 'Talaka',         label: t('marital_talaka') },
    { value: 'Anaishi na mtu', label: t('marital_cohabiting') },
  ];
  const MARRIAGE_TYPE = [
    { value: 'Kikristo',      label: t('marriage_church') },
    { value: 'Siya Kikristo', label: t('marriage_civil') },
  ];

  const [activeTab, setActiveTab] = useState('personal');
  const [profile,   setProfile]   = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  const [sectionState, setSectionState] = useState({});
  const setSaving = (key, val) =>
    setSectionState(s => ({ ...s, [key]: { ...s[key], saving: val } }));
  const setSaved = (key, val) =>
    setSectionState(s => ({ ...s, [key]: { ...s[key], saved: val } }));
  const ss = key => ({
    saving: sectionState[key]?.saving ?? false,
    saved:  sectionState[key]?.saved  ?? false,
  });

  const [photoStage,    setPhotoStage]    = useState('idle');
  const [photoProgress, setPhotoProgress] = useState(0);
  const [photoError,    setPhotoError]    = useState(null);
  const photoInputRef = useRef(null);

  const [cvStage,    setCvStage]    = useState('idle');
  const [cvProgress, setCvProgress] = useState(0);
  const [cvFileName, setCvFileName] = useState(null);
  const [cvError,    setCvError]    = useState(null);
  const cvInputRef = useRef(null);

  const spiritualFetched = useRef(false);

  const [spiritualGroups,  setSpiritualGroups] = useState({ ministries: [], committees: [] });
  const [memberGroupIds,   setMemberGroupIds]  = useState([]);
  const [minLoading,       setMinLoading]  = useState(false);

  const [dependants, setDependants] = useState([]);
  const [depLoading, setDepLoading] = useState(false);
  const [depForm,    setDepForm]    = useState({ full_name: '', relationship: '', date_of_birth: '' });
  const [depError,   setDepError]   = useState('');

  const [pwForm,  setPwForm]  = useState({ current_password: '', new_password: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [showPw,  setShowPw]  = useState({ current_password: false, new_password: false, confirm: false });

  useEffect(() => {
    if (!authUser?.id) return;
    setLoading(true);
    userApi.getOne(authUser.id)
      .then(res => { setProfile(res.data.data ?? res.data); setError(null); })
      .catch(() => setError('Could not load profile. Please refresh.'))
      .finally(() => setLoading(false));
  }, [authUser?.id]);

useEffect(() => {
  if (!authUser?.id || activeTab !== 'spiritual') return;
  if (spiritualFetched.current) return;
  spiritualFetched.current = true;

  setMinLoading(true);
  Promise.all([
    groupApi.getAll({ types: 'huduma,kwaya,idara,kamati' }),
    groupApi.getMemberGroups(authUser.id),  // ← plain, no .then()
  ])
    .then(([allGroups, memberGroups]) => {
      console.log('member groups raw:', memberGroups.data.data); // log here instead
      const groups = allGroups.data.data ?? [];
      const ministryTypes = ['huduma', 'kwaya', 'idara'];
      setSpiritualGroups({
        ministries: groups.filter(g => ministryTypes.includes(g.type)),
        committees: groups.filter(g => g.type === 'kamati'),
      });
      setMemberGroupIds(
        (memberGroups.data.data ?? []).map(m => Number(m.group_id ?? m.id))
      );
    })
    .catch((err) => {
      console.error('spiritual fetch error:', err); // ← don't silently swallow!
      spiritualFetched.current = false;
    })
    .finally(() => setMinLoading(false));
}, [authUser?.id, activeTab]);

  useEffect(() => {
    if (!authUser?.id || activeTab !== 'dependants') return;
    setDepLoading(true);
    dependantApi.getAll(authUser.id)
      .then(res => setDependants(res.data.data ?? []))
      .catch(() => {})
      .finally(() => setDepLoading(false));
  }, [authUser?.id, activeTab]);

  const setField = useCallback((key, val) =>
    setProfile(p => p ? { ...p, [key]: val } : p), []);

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
      const result = await R2UploadService.uploadFromFile({
        file, folder: 'church_portal/profile_photos',
        onProgress: pct => setPhotoProgress(pct),
      });
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
      const result = await R2UploadService.uploadFromFile({
        file, folder: 'church_portal/cvs',
        onProgress: pct => setCvProgress(pct),
      });
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

  const savePersonal = () => saveSection('personal', {
    full_name: profile.full_name, email: profile.email, phone: profile.phone,
    gender: profile.gender, date_of_birth: profile.date_of_birth,
    place_of_birth: profile.place_of_birth, member_since: profile.member_since,
    member_status: profile.member_status, willing_to_volunteer: profile.willing_to_volunteer,
  });

  const saveFamily = () => {
    const isMarried    = ['Ameoa', 'Ameolewa'].includes(profile.marital_status);
    const isCohabiting = profile.marital_status === 'Anaishi na mtu';
    return saveSection('family', {
      marital_status: profile.marital_status,
      marriage_type:           isMarried    ? profile.marriage_type           : null,
      marriage_date:           isMarried    ? profile.marriage_date           : null,
      marriage_place:          isMarried    ? profile.marriage_place          : null,
      spouse_name:             isMarried    ? profile.spouse_name             : null,
      spouse_phone:            isMarried    ? profile.spouse_phone            : null,
      cohabiting_partner_name: isCohabiting ? profile.cohabiting_partner_name : null,
    });
  };

  const saveWork    = () => saveSection('work', {
    occupation: profile.occupation, workplace: profile.workplace,
    education: profile.education, profession: profile.profession,
  });

  const saveAddress = () => saveSection('address', {
    street: profile.street, district: profile.district, region: profile.region,
    postal_code: profile.postal_code, area_name: profile.area_name,
    block_no: profile.block_no, jumuiya: profile.jumuiya, slp: profile.slp,
    previous_church: profile.previous_church,
    neighbour_member_name: profile.neighbour_member_name,
    neighbour_member_phone: profile.neighbour_member_phone,
    elder_name: profile.elder_name, elder_phone: profile.elder_phone,
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
        groupApi.syncMemberGroups(authUser.id, memberGroupIds),
      ]);
      setSaved('spiritual', true);
      setTimeout(() => setSaved('spiritual', false), 2500);
    } catch (err) {
      alert(err?.response?.data?.message ?? 'Save failed. Please try again.');
    } finally {
      setSaving('spiritual', false);
    }
  };

  const addDependant = async () => {
    if (!depForm.full_name.trim()) { setDepError(t('profile_dep_name_placeholder')); return; }
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
    if (!confirm(t('profile_dep_remove_confirm'))) return;
    try {
      await dependantApi.remove(authUser.id, depId);
      setDependants(d => d.filter(x => x.id !== depId));
    } catch (err) {
      alert(err?.message ?? 'Could not remove dependant.');
    }
  };

const toggleGroup = (id) => {
   console.log('toggleGroup called:', id); // ← add this
  const nid = Number(id);
  setMemberGroupIds(prev =>
    prev.includes(nid) ? prev.filter(x => x !== nid) : [...prev, nid]
  );
};

  const saveSecurity = async () => {
    if (pwForm.new_password !== pwForm.confirm) { setPwError(t('profile_pw_mismatch')); return; }
    if (pwForm.new_password.length < 8)          { setPwError(t('profile_pw_tooshort')); return; }
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

  const isMarried    = ['Ameoa', 'Ameolewa'].includes(profile?.marital_status);
  const isCohabiting = profile?.marital_status === 'Anaishi na mtu';

  const ministryGroups = spiritualGroups.ministries.reduce((acc, g) => {
    const cat = g.type === 'kwaya' ? 'Choir' : g.type === 'idara' ? 'Umoja' : 'Spiritual';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(g);
    return acc;
  }, {});

  const avatarSrc = profile?._photoPreview || profile?.profile_photo_url || null;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <span className="w-6 h-6 border-2 border-stone-300 border-t-amber-400 rounded-full animate-spin" />
    </div>
  );
  if (error)    return <div className="p-6 text-center text-red-500 text-sm">{error}</div>;
  if (!profile) return null;

  return (
    <div className="min-h-screen bg-[#F5F4F0]">

      {/* Header */}
      <div className="bg-white border-b border-stone-100 px-6 py-5">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <TinyCross className="text-amber-400" />
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-stone-900">{t('profile_my_profile')}</h1>
            <p className="text-xs text-stone-400 mt-0.5">{profile.email}</p>
          </div>

        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 xl:pr-6 py-6 pb-24 space-y-4">

        {/* Avatar card */}
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
                title={t('profile_add_photo')}
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
              {profile.role} · {MEMBER_STATUS.find(s => s.value === profile.member_status)?.label ?? t('member')}
            </p>
            {photoError && <p className="text-xs text-red-500 mt-1">{photoError}</p>}
            {!avatarSrc && photoStage === 'idle' && (
              <button onClick={() => photoInputRef.current?.click()}
                className="mt-1 text-xs text-amber-600 hover:underline">
                {t('profile_add_photo')}
              </button>
            )}
          </div>
          <span className="hidden sm:block text-xs text-stone-300 font-mono">
            #{String(profile.id).padStart(4, '0')}
          </span>
        </div>

        {/* Tab bar */}
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

        {/* ── PERSONAL ── */}
        {activeTab === 'personal' && (
          <Section icon={icons.user} title={t('profile_personal_info')}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t('profile_full_name')}>
                <Input value={profile.full_name ?? ''} onChange={e => setField('full_name', e.target.value)} />
              </Field>
              <Field label={t('profile_email_address')}>
                <Input type="email" value={profile.email ?? ''} onChange={e => setField('email', e.target.value)}
                  placeholder={t('profile_email_placeholder')} />
              </Field>
              <Field label={t('profile_phone')}>
                <Input type="tel" value={profile.phone ?? ''} onChange={e => setField('phone', e.target.value)}
                  placeholder={t('profile_phone_placeholder')} />
              </Field>
              <Field label={t('profile_gender')}>
                <Select value={profile.gender ?? ''} onChange={e => setField('gender', e.target.value)}>
                  <option value="">{t('profile_select')}</option>
                  <option value="male">{t('profile_gender_male')}</option>
                  <option value="female">{t('profile_gender_female')}</option>
                </Select>
              </Field>
              <Field label={t('profile_dob')}>
                <Input type="date" value={profile.date_of_birth?.split('T')[0] ?? ''}
                  onChange={e => setField('date_of_birth', e.target.value)} />
              </Field>
              <Field label={t('profile_place_of_birth')}>
                <Input value={profile.place_of_birth ?? ''} onChange={e => setField('place_of_birth', e.target.value)}
                  placeholder={t('profile_pob_placeholder')} />
              </Field>
              <Field label={t('profile_member_since')}>
                <Input type="date" value={profile.member_since?.split('T')[0] ?? ''}
                  onChange={e => setField('member_since', e.target.value)} />
              </Field>
              <Field label={t('profile_member_status')}>
                <Select value={profile.member_status ?? ''} onChange={e => setField('member_status', e.target.value)}>
                  <option value="">{t('profile_select')}</option>
                  {MEMBER_STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </Select>
              </Field>
              <Field label={t('profile_volunteer')} className="sm:col-span-2">
                <Select value={profile.willing_to_volunteer ? 'yes' : 'no'}
                  onChange={e => setField('willing_to_volunteer', e.target.value === 'yes')}>
                  <option value="yes">{t('profile_yes')}</option>
                  <option value="no">{t('profile_no')}</option>
                </Select>
              </Field>
            </div>

            {/* CV upload */}
            <div className="mt-6 pt-5 border-t border-stone-100">
              <SubHeading>{t('profile_cv_heading')}</SubHeading>
              <input ref={cvInputRef} type="file" accept=".pdf,.doc,.docx"
                className="hidden" onChange={handleCvChange} />
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => cvInputRef.current?.click()}
                  disabled={cvStage === 'uploading' || cvStage === 'saving'}
                  className="flex items-center gap-2 px-3 py-2 text-sm border border-stone-200 rounded-lg
                    bg-white text-stone-600 hover:border-amber-400 hover:text-amber-600
                    disabled:opacity-50 disabled:cursor-not-allowed transition">
                  <Icon path={icons.upload} size={14} />
                  {profile.cv_url ? t('profile_cv_replace') : t('profile_cv_upload')}
                </button>
                {cvStage === 'uploading' && (
                  <div className="flex items-center gap-2 text-xs text-stone-500">
                    <span className="w-3.5 h-3.5 border-2 border-stone-300 border-t-amber-500 rounded-full animate-spin flex-shrink-0" />
                    {t('profile_cv_uploading')} {cvProgress}%
                    <div className="w-24 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${cvProgress}%` }} />
                    </div>
                  </div>
                )}
                {cvStage === 'saving' && (
                  <div className="flex items-center gap-2 text-xs text-stone-500">
                    <span className="w-3.5 h-3.5 border-2 border-stone-300 border-t-amber-500 rounded-full animate-spin flex-shrink-0" />
                    {t('profile_cv_saving')}
                  </div>
                )}
                {cvStage === 'done' && (
                  <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                    <Icon path={icons.check} size={13} />{t('profile_cv_uploaded')}
                  </div>
                )}
                {cvStage === 'idle' && cvFileName && (
                  <span className="text-xs text-stone-500 truncate max-w-[180px]">{cvFileName}</span>
                )}
                {profile.cv_url && cvStage === 'idle' && (
                  <a href={profile.cv_url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs text-amber-600 hover:underline ml-auto">
                    <Icon path={icons.file} size={13} />{t('profile_cv_view')}
                  </a>
                )}
              </div>
              {cvError && <p className="mt-2 text-xs text-red-500">{cvError}</p>}
              {cvStage === 'idle' && !cvError && (
                <p className="mt-1.5 text-xs text-stone-400">{t('profile_cv_hint')}</p>
              )}
            </div>
          </Section>
        )}

        {/* ── FAMILY ── */}
        {activeTab === 'family' && (
          <Section icon={icons.heart} title={t('profile_family_title')}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t('profile_marital_status')} className="sm:col-span-2">
                <Select value={profile.marital_status ?? ''} onChange={e => setField('marital_status', e.target.value)}>
                  <option value="">{t('profile_select')}</option>
                  {MARITAL_STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </Select>
              </Field>
              {isCohabiting && (
                <Field label={t('profile_partner_name')} className="sm:col-span-2">
                  <Input value={profile.cohabiting_partner_name ?? ''}
                    onChange={e => setField('cohabiting_partner_name', e.target.value)}
                    placeholder={t('profile_partner_placeholder')} />
                </Field>
              )}
              {isMarried && (
                <>
                  <Field label={t('profile_marriage_type')}>
                    <Select value={profile.marriage_type ?? ''} onChange={e => setField('marriage_type', e.target.value)}>
                      <option value="">{t('profile_select')}</option>
                      {MARRIAGE_TYPE.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </Select>
                  </Field>
                  <Field label={t('profile_marriage_date')}>
                    <Input type="date" value={profile.marriage_date?.split('T')[0] ?? ''}
                      onChange={e => setField('marriage_date', e.target.value)} />
                  </Field>
                  <Field label={t('profile_marriage_place')}>
                    <Input value={profile.marriage_place ?? ''} onChange={e => setField('marriage_place', e.target.value)}
                      placeholder={t('profile_marriage_place_placeholder')} />
                  </Field>
                  <Field label={t('profile_spouse_name')}>
                    <Input value={profile.spouse_name ?? ''} onChange={e => setField('spouse_name', e.target.value)} />
                  </Field>
                  <Field label={t('profile_spouse_phone')}>
                    <Input type="tel" value={profile.spouse_phone ?? ''} onChange={e => setField('spouse_phone', e.target.value)}
                      placeholder={t('profile_phone_placeholder')} />
                  </Field>
                </>
              )}
            </div>
          </Section>
        )}

        {/* ── WORK ── */}
        {activeTab === 'work' && (
          <Section icon={icons.briefcase} title={t('profile_work_title')}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t('profile_occupation')}>
                <Input value={profile.occupation ?? ''} onChange={e => setField('occupation', e.target.value)}
                  placeholder={t('profile_occupation_placeholder')} />
              </Field>
              <Field label={t('profile_workplace')}>
                <Input value={profile.workplace ?? ''} onChange={e => setField('workplace', e.target.value)} />
              </Field>
              <Field label={t('profile_education')}>
                <Select value={profile.education ?? ''} onChange={e => setField('education', e.target.value)}>
                  <option value="">{t('profile_select')}</option>
                  <option value="none">{t('profile_edu_none')}</option>
                  <option value="primary">{t('profile_edu_primary')}</option>
                  <option value="secondary">{t('profile_edu_secondary')}</option>
                  <option value="diploma">{t('profile_edu_diploma')}</option>
                  <option value="degree">{t('profile_edu_degree')}</option>
                  <option value="postgraduate">{t('profile_edu_postgrad')}</option>
                </Select>
              </Field>
              <Field label={t('profile_profession')}>
                <Input value={profile.profession ?? ''} onChange={e => setField('profession', e.target.value)}
                  placeholder={t('profile_profession_placeholder')} />
              </Field>
            </div>
          </Section>
        )}

        {/* ── ADDRESS ── */}
        {activeTab === 'address' && (
          <Section icon={icons.mapPin} title={t('profile_address_title')}>
            <SubHeading>{t('profile_address_general')}</SubHeading>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">



            <Field label={t('profile_jumuiya')}>
  <Select value={profile.jumuiya ?? ''} onChange={e => setField('jumuiya', e.target.value)}>
    <option value="">{t('profile_select')}</option>
    {JUMUIYA_LIST.map(j => (
      <option key={j} value={j}>{j}</option>
    ))}
  </Select>
</Field>




            </div>
            <SubHeading>{t('profile_church_history')}</SubHeading>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <Field label={t('profile_prev_church')} className="sm:col-span-2">
                <Input value={profile.previous_church ?? ''} onChange={e => setField('previous_church', e.target.value)}
                  placeholder={t('profile_prev_church_placeholder')} />
              </Field>
            </div>
            <SubHeading>{t('profile_neighbour_ref')}</SubHeading>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <Field label={t('profile_neighbour_name')}>
                <Input value={profile.neighbour_member_name ?? ''} onChange={e => setField('neighbour_member_name', e.target.value)}
                  placeholder={t('profile_neighbour_name_placeholder')} />
              </Field>
              <Field label={t('profile_neighbour_phone')}>
                <Input type="tel" value={profile.neighbour_member_phone ?? ''}
                  onChange={e => setField('neighbour_member_phone', e.target.value)}
                  placeholder={t('profile_phone_placeholder')} />
              </Field>
            </div>
            <SubHeading>{t('profile_elder_section')}</SubHeading>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t('profile_elder_name')}>
                <Input value={profile.elder_name ?? ''} onChange={e => setField('elder_name', e.target.value)}
                  placeholder={t('profile_elder_name_placeholder')} />
              </Field>
              <Field label={t('profile_elder_phone')}>
                <Input type="tel" value={profile.elder_phone ?? ''} onChange={e => setField('elder_phone', e.target.value)}
                  placeholder={t('profile_phone_placeholder')} />
              </Field>
            </div>
          </Section>
        )}

        {/* ── SPIRITUAL ── */}
        {activeTab === 'spiritual' && (
          <Section icon={icons.cross} title={t('profile_spiritual_title')}>
       
            <SubHeading>{t('profile_sacraments')}</SubHeading>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <Field label={t('profile_baptism_date')}>
                <Input type="date" value={profile.baptism_date?.split('T')[0] ?? ''}
                  onChange={e => setField('baptism_date', e.target.value)} />
              </Field>
              <Field label={t('profile_confirmation_date')}>
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
                    {t('profile_communion')}
                    <span className="text-stone-400 ml-1">{t('profile_communion_sub')}</span>
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
                <SubHeading>{t('profile_ministries')}</SubHeading>
                {spiritualGroups.ministries.length === 0 ? (
                  <p className="text-sm text-stone-400 mb-6">{t('profile_no_ministries')}</p>
                ) : (
                  <div className="space-y-5 mb-8">
                    {Object.entries(ministryGroups).map(([cat, items]) => (
                      <div key={cat}>
                        <p className="text-xs font-medium text-stone-400 mb-2">{cat}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {items.map(g => (
                            <ServiceCheck key={g.id} label={g.name}
                              checked={memberGroupIds.includes(Number(g.id))}
                              onChange={() => toggleGroup(g.id)} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <SubHeading>{t('profile_committees')}</SubHeading>
                {spiritualGroups.committees.length === 0 ? (
                  <p className="text-sm text-stone-400">{t('profile_no_committees')}</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {spiritualGroups.committees.map(g => (
                      <ServiceCheck key={g.id} label={g.name}
                        checked={memberGroupIds.includes(Number(g.id))}
                        onChange={() => toggleGroup(g.id)} />
                    ))}
                  </div>
                )}
              </>
            )}
          </Section>
        )}

        {/* ── DEPENDANTS ── */}
        {activeTab === 'dependants' && (
          <Section icon={icons.users} title={t('profile_dependants_title')} noPadding>
            <div className="px-6 py-5 border-b border-stone-100">
              <p className="text-xs text-stone-500 mb-3">{t('profile_dependants_hint')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input placeholder={t('profile_dep_name_placeholder')} value={depForm.full_name}
                  onChange={e => setDepForm(f => ({ ...f, full_name: e.target.value }))} />
                <Select value={depForm.relationship}
                  onChange={e => setDepForm(f => ({ ...f, relationship: e.target.value }))}>
                  <option value="">{t('profile_dep_relationship')}</option>
                  <option value="child">{t('profile_dep_child')}</option>
                  <option value="parent">{t('profile_dep_parent')}</option>
                  <option value="sibling">{t('profile_dep_sibling')}</option>
                  <option value="other">{t('profile_dep_other')}</option>
                </Select>
                <Input type="date" value={depForm.date_of_birth}
                  onChange={e => setDepForm(f => ({ ...f, date_of_birth: e.target.value }))} />
              </div>
              {depError && <p className="text-xs text-red-500 mt-2">{depError}</p>}
              <button onClick={addDependant}
                className="mt-3 flex items-center gap-1.5 px-4 py-2 text-sm font-medium
                  bg-amber-500 hover:bg-amber-600 text-white rounded-lg shadow-sm transition">
                <Icon path={icons.plus} size={14} />
                {t('profile_add_dependant')}
              </button>
            </div>
            {depLoading ? (
              <div className="flex justify-center py-8">
                <span className="w-5 h-5 border-2 border-stone-200 border-t-amber-400 rounded-full animate-spin" />
              </div>
            ) : dependants.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-stone-400">{t('profile_no_dependants')}</p>
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
                          ? ` · ${t('profile_dep_born')} ${new Date(dep.date_of_birth).toLocaleDateString(lang === 'sw' ? 'sw-TZ' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
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

        {/* ── SECURITY ── */}
        {activeTab === 'security' && (
          <Section icon={icons.lock} title={t('profile_security_title')}>
            <div className="max-w-sm space-y-4">
              {[
                { key: 'current_password', label: t('profile_current_password') },
                { key: 'new_password',     label: t('profile_new_password') },
                { key: 'confirm',          label: t('profile_confirm_password') },
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
              <p className="text-xs text-stone-400">{t('profile_pw_hint')}</p>
            </div>
          </Section>
        )}

      </div>

      {/* Floating save buttons */}
      {activeTab === 'personal'  && <FloatingSaveBtn {...ss('personal')}  onClick={savePersonal}  t={t} />}
      {activeTab === 'family'    && <FloatingSaveBtn {...ss('family')}    onClick={saveFamily}    t={t} />}
      {activeTab === 'work'      && <FloatingSaveBtn {...ss('work')}      onClick={saveWork}      t={t} />}
      {activeTab === 'address'   && <FloatingSaveBtn {...ss('address')}   onClick={saveAddress}   t={t} />}
      {activeTab === 'spiritual' && <FloatingSaveBtn {...ss('spiritual')} onClick={saveSpiritual} t={t} />}
      {activeTab === 'security'  && <FloatingSaveBtn {...ss('security')}  onClick={saveSecurity}  t={t} />}

    </div>
  );
}