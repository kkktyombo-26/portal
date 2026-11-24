'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../lib/i18n';
import { userApi, dependantApi, groupApi } from '../../lib/api';
import R2UploadService from '../../lib/r2UploadService';
import { JUMUIYA_LIST } from '../../lib/constants';

/* ─── Structure ───────────────────────────────────────────────────────────────
 * TAARIFA MUHIMU (prerequisite) — six fields, always open, saved on their own:
 *   Namba ya Ahadi · Hali ya Ndoa · Jumuiya · Mzee wa Kanisa
 *   Ubatizo (Ndio/Hapana) · Kipaimara (Ndio/Hapana)
 * Everything else is TAARIFA ZA ZIADA (advanced) — collapsed by default, the
 * original seven tabs untouched behind the disclosure.
 *
 * Each of the six owns its field exclusively: the duplicate controls for
 * jumuiya, elder and marital status were removed from the Address and Family
 * tabs so there is only one place to change each value. The exact baptism and
 * confirmation dates stay in the Spiritual tab as optional detail, revealed
 * only once the matching answer here is Ndio.
 *
 * Styling: classes and variables from globals.css. This file previously used
 * stone, amber, red and green Tailwind utilities, none of which exist -
 * theme.colors replaces Tailwind's defaults with navy/gold/neutral/semantic.
 * ──────────────────────────────────────────────────────────────────────────── */

// Schema notes (see migrate-member-profile-02.js):
//   ahadi_number   VARCHAR(20) UNIQUE  - already exists (migration 001)
//   is_baptized    TINYINT(1)          - added by migration 002
//   is_confirmed   TINYINT(1)          - added by migration 002
//   marital_status ENUM                - 002 adds 'Anaishi na mtu'
// Until 002 runs, the Ndio/Hapana answers fall back to "a date is present",
// so the screen still works - it just cannot record a Ndio without a date.
// Every name written here must also be in userApi.update's column whitelist.

// ── Icons ─────────────────────────────────────────────────────────────────
const Icon = ({ path, size = 18, className = '', style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
    className={className} style={style}>
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
  chevron:   'M6 9l6 6 6-6',
  tag:       'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01',
};

// ── Labels for the prerequisite block ─────────────────────────────────────
// Kept local so the screen does not depend on new i18n keys existing yet.
// Move them into lib/i18n when convenient and swap L() for t().
const LABELS = {
  essentials:    { sw: 'Taarifa Muhimu',  en: 'Essential information' },
  essentialsSub: { sw: 'Sehemu hizi sita zinahitajika kwa daftari la usharika.',
                   en: 'These six fields are required for the parish register.' },
  pledgeNo:      { sw: 'Namba ya Ahadi',  en: 'Pledge number' },
  pledgeHint:    { sw: 'Namba kwenye kadi yako ya ahadi.', en: 'The number on your pledge card.' },
  marital:       { sw: 'Hali ya Ndoa',    en: 'Marital status' },
  jumuiya:       { sw: 'Jumuiya',         en: 'Jumuiya' },
  elder:         { sw: 'Mzee wa Kanisa',  en: 'Church elder' },
  elderPhone:    { sw: 'Simu ya Mzee',    en: "Elder's phone" },
  baptism:       { sw: 'Ubatizo',         en: 'Baptised' },
  confirmation:  { sw: 'Kipaimara',       en: 'Confirmed' },
  yes:           { sw: 'Ndio',            en: 'Yes' },
  no:            { sw: 'Hapana',          en: 'No' },
  select:        { sw: 'Chagua',          en: 'Select' },
  advanced:      { sw: 'Taarifa za Ziada', en: 'Additional information' },
  advancedSub:   { sw: 'Hiari. Unaweza kukamilisha wakati wowote.',
                   en: 'Optional. You can complete these any time.' },
  open:          { sw: 'Fungua',          en: 'Open' },
  close:         { sw: 'Funga',           en: 'Close' },
  done:          { sw: 'zimekamilika',    en: 'complete' },
  allDone:       { sw: 'Taarifa muhimu zote zimekamilika.',
                   en: 'All essential information is complete.' },
  changeIn:      { sw: 'Ibadilishe katika Taarifa Muhimu juu.',
                   en: 'Change this in Essential information above.' },
  optionalDate:  { sw: 'Tarehe (hiari)',  en: 'Date (optional)' },
  notBaptised:   { sw: 'Jibu "Ndio" kwenye Ubatizo juu kuweka tarehe.',
                   en: 'Answer "Yes" to Baptised above to record a date.' },
  notConfirmed:  { sw: 'Jibu "Ndio" kwenye Kipaimara juu kuweka tarehe.',
                   en: 'Answer "Yes" to Confirmed above to record a date.' },
};

// ── Primitives on the design system ───────────────────────────────────────
function Grid({ children, min = 240, style }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`,
      gap: '1rem',
      ...style,
    }}>
      {children}
    </div>
  );
}

function Field({ label, hint, error, children, span = false, id }) {
  return (
    <div className="form-group" style={span ? { gridColumn: '1 / -1' } : undefined}>
      {label && <label className="form-label" htmlFor={id}>{label}</label>}
      {children}
      {hint  && <p className="form-hint">{hint}</p>}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

const Input  = ({ className = '', ...p }) => <input  className={`input ${className}`.trim()} {...p} />;
const Select = ({ className = '', children, ...p }) => (
  <select className={`select ${className}`.trim()} {...p}>{children}</select>
);

function TinyCross({ style }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden
      style={{ color: 'var(--gold)', flexShrink: 0, ...style }}>
      <line x1="6" y1="1" x2="6" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function Spinner({ size = 20 }) {
  return (
    <span className="animate-spin" style={{
      display: 'inline-block', width: size, height: size, borderRadius: '50%',
      border: '2px solid var(--border-default)', borderTopColor: 'var(--gold)',
      flexShrink: 0,
    }} />
  );
}

function SubHeading({ children }) {
  return (
    <div className="divider-label" style={{ margin: '0 0 1rem' }}>
      <span style={{ flex: '0 0 auto' }}>{children}</span>
    </div>
  );
}

function ServiceCheck({ id, label, checked, onChange }) {
  return (
    <div className="field-row">
      <input id={id} type="checkbox" className="checkbox" checked={checked} onChange={onChange} />
      <label htmlFor={id}>{label}</label>
    </div>
  );
}

function ProgressRing({ percent, size = 64 }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <svg width={size} height={size} style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#FFFFFF" strokeWidth="3"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.2s' }} />
    </svg>
  );
}

function SaveBtn({ saving, saved, onClick, label, savedLabel, loadingLabel, className = '' }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className={`btn btn-primary ${className}`.trim()}
      style={saved ? { background: 'var(--success)', borderColor: 'var(--success)' } : undefined}
    >
      {saving
        ? <span className="animate-spin" style={{
            width: 15, height: 15, borderRadius: '50%', flexShrink: 0,
            border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#FFFFFF',
            display: 'inline-block',
          }} />
        : <Icon path={saved ? icons.check : icons.upload} size={15} />
      }
      <span>{saving ? loadingLabel : saved ? savedLabel : label}</span>
    </button>
  );
}

// ════════════════════════════════════════════════════════════════════════════
export default function ProfilePage() {

  const { user: authUser, lang } = useAuth();
  const { t } = useTranslation(lang);
  const L = key => LABELS[key][lang === 'sw' ? 'sw' : 'en'];

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
    { value: 'Talikiwa',       label: t('marital_talaka') },   // ENUM value; label unchanged
    { value: 'Anaishi na mtu', label: t('marital_cohabiting') },
  ];
  const MARRIAGE_TYPE = [
    { value: 'Kikristo',      label: t('marriage_church') },
    { value: 'Siya Kikristo', label: t('marriage_civil') },
  ];

  const [showAdvanced, setShowAdvanced] = useState(false);
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

  // Spiritual groups load when the Spiritual tab is first opened inside the
  // advanced disclosure.
  useEffect(() => {
    if (!authUser?.id) return;
    if (!showAdvanced || activeTab !== 'spiritual') return;
    if (spiritualFetched.current) return;
    spiritualFetched.current = true;

    setMinLoading(true);
    Promise.all([
      groupApi.getAll({ types: 'huduma,kwaya,idara,kamati' }),
      groupApi.getMemberGroups(authUser.id),
    ])
      .then(([allGroups, memberGroups]) => {
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
        console.error('spiritual fetch error:', err);
        spiritualFetched.current = false;
      })
      .finally(() => setMinLoading(false));
  }, [authUser?.id, activeTab, showAdvanced]);

  useEffect(() => {
    if (!authUser?.id) return;
    if (!showAdvanced || activeTab !== 'dependants') return;
    setDepLoading(true);
    dependantApi.getAll(authUser.id)
      .then(res => setDependants(res.data.data ?? []))
      .catch(() => {})
      .finally(() => setDepLoading(false));
  }, [authUser?.id, activeTab, showAdvanced]);

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

  // ── Ubatizo / Kipaimara as Ndio / Hapana ────────────────────────────────
  // Reads the boolean when the column exists, otherwise infers "Ndio" from a
  // stored date. Returns true | false | null (null = not yet answered).
  const answer = (bool, date) =>
    (bool === true || bool === false) ? bool : (date ? true : null);

  const baptized  = profile ? answer(profile.is_baptized,  profile.baptism_date)      : null;
  const confirmed = profile ? answer(profile.is_confirmed, profile.confirmation_date) : null;

  const setAnswer = (boolKey, dateKey) => (value) => {
    if (value === '') { setField(boolKey, null); return; }
    const yes = value === 'yes';
    setField(boolKey, yes);
    if (!yes) setField(dateKey, null);   // Hapana clears any stored date
  };

  const toSelect = v => (v === true ? 'yes' : v === false ? 'no' : '');

  // ── Prerequisite completeness ───────────────────────────────────────────
  const essentials = profile ? [
    !!profile.ahadi_number,
    !!profile.marital_status,
    !!profile.jumuiya,
    !!profile.elder_name,
    baptized  !== null,
    confirmed !== null,
  ] : [];
  const filled = essentials.filter(Boolean).length;
  const total  = essentials.length || 6;
  const pct    = Math.round((filled / total) * 100);

  const saveEssentials = () => saveSection('essentials', {
    ahadi_number:   profile.ahadi_number   ?? null,
    marital_status: profile.marital_status ?? null,
    jumuiya:        profile.jumuiya        ?? null,
    elder_name:     profile.elder_name     ?? null,
    elder_phone:    profile.elder_phone    ?? null,
    is_baptized:    baptized,
    is_confirmed:   confirmed,
    baptism_date:      baptized  ? (profile.baptism_date      || null) : null,
    confirmation_date: confirmed ? (profile.confirmation_date || null) : null,
  });

  const savePersonal = () => saveSection('personal', {
    full_name: profile.full_name, email: profile.email, phone: profile.phone,
    gender: profile.gender, date_of_birth: profile.date_of_birth,
    place_of_birth: profile.place_of_birth, member_since: profile.member_since,
    member_status: profile.member_status, willing_to_volunteer: profile.willing_to_volunteer,
  });

  const saveFamily = () => {
    const married = ['Ameoa', 'Ameolewa'].includes(profile.marital_status);
    const cohab   = profile.marital_status === 'Anaishi na mtu';
    return saveSection('family', {
      marriage_type:           married ? profile.marriage_type           : null,
      marriage_date:           married ? profile.marriage_date           : null,
      marriage_place:          married ? profile.marriage_place          : null,
      spouse_name:             married ? profile.spouse_name             : null,
      spouse_phone:            married ? profile.spouse_phone            : null,
      cohabiting_partner_name: cohab   ? profile.cohabiting_partner_name : null,
    });
  };

  const saveWork = () => saveSection('work', {
    occupation: profile.occupation, workplace: profile.workplace,
    education: profile.education, profession: profile.profession,
  });

  // street / district / region / postal_code are not columns on users and have
  // no control on this screen, so they are no longer sent. area_name, block_no
  // and slp do exist but have no control yet - add fields before sending them.
  const saveAddress = () => saveSection('address', {
    previous_church: profile.previous_church,
    neighbour_member_name: profile.neighbour_member_name,
    neighbour_member_phone: profile.neighbour_member_phone,
  });

  // Spiritual now carries only the optional dates plus group membership;
  // the Ndio/Hapana answers belong to the prerequisite block.
  const saveSpiritual = async () => {
    setSaving('spiritual', true);
    try {
      await Promise.all([
        userApi.update(authUser.id, {
          baptism_date:      baptized  ? (profile.baptism_date      || null) : null,
          confirmation_date: confirmed ? (profile.confirmation_date || null) : null,
          takes_communion:   profile.takes_communion ?? false,
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '16rem' }}>
      <Spinner size={24} />
    </div>
  );
  if (error) return (
    <div className="empty-state"><p className="empty-state-body" style={{ color: 'var(--danger)' }}>{error}</p></div>
  );
  if (!profile) return null;

  const marital = MARITAL_STATUS.find(s => s.value === profile.marital_status)?.label;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-page)' }}>

      {/* Header */}
      <div style={{
        background: 'var(--surface-card)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '1.25rem 1.5rem',
      }}>
        <div style={{ maxWidth: 768, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <TinyCross />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h4 style={{ fontSize: '1.125rem' }}>{t('profile_my_profile')}</h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 2 }}>{profile.email}</p>
          </div>
        </div>
      </div>

      <div style={{
        maxWidth: 768, margin: '0 auto',
        padding: '1.5rem 1rem 6rem',
        display: 'flex', flexDirection: 'column', gap: '1rem',
      }}>

        {/* ── Avatar card ──────────────────────────────────────────────── */}
        <div className="card prose-full" style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div className="profile-avatar-wrap" style={{ position: 'relative', flexShrink: 0 }}>
            <div className="avatar" style={{ width: 64, height: 64, fontSize: '1.5rem', fontWeight: 700 }}>
              {avatarSrc
                ? <img src={avatarSrc} alt={profile.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (profile.full_name?.trim() || '?')[0].toUpperCase()
              }
            </div>
            {photoStage === 'idle' || photoStage === 'done' ? (
              <label
                className="profile-avatar-overlay"
                title={t('profile_add_photo')}
                style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(36,19,48,0.45)', cursor: 'pointer',
                  opacity: 0, transition: 'opacity 150ms var(--ease-out)',
                  color: '#FFFFFF',
                }}
              >
                <Icon path={icons.camera} size={18} />
                <input ref={photoInputRef} type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: 'none' }} onChange={handlePhotoChange} />
              </label>
            ) : (
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: 'rgba(36,19,48,0.55)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <ProgressRing percent={photoProgress} size={64} />
                <span style={{ position: 'absolute', color: '#FFFFFF', fontSize: 10, fontWeight: 700 }}>
                  {photoStage === 'saving' ? '…' : `${photoProgress}%`}
                </span>
              </div>
            )}
            {photoStage === 'done' && (
              <span style={{
                position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: '50%',
                background: 'var(--success)', border: '2px solid var(--surface-card)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF',
              }}>
                <Icon path={icons.check} size={10} />
              </span>
            )}
            {(photoStage === 'idle' || photoStage === 'done') && (
              <span className={`status-dot ${profile.member_status === 'hai' ? 'active' : 'inactive'}`}
                style={{ position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, border: '2px solid var(--surface-card)' }} />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile.full_name}
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>
              {profile.role} · {MEMBER_STATUS.find(s => s.value === profile.member_status)?.label ?? t('member')}
            </p>
            {photoError && <p className="form-error">{photoError}</p>}
            {!avatarSrc && photoStage === 'idle' && (
              <button onClick={() => photoInputRef.current?.click()} className="btn btn-ghost btn-sm" style={{ marginTop: 4, padding: '0 0.5rem' }}>
                {t('profile_add_photo')}
              </button>
            )}
          </div>
          <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-disabled)', flexShrink: 0 }}>
            #{String(profile.id).padStart(4, '0')}
          </span>
        </div>

        {/* ══ TAARIFA MUHIMU — prerequisite ═══════════════════════════════ */}
        <section className="card prose-full">
          <div className="card-header">
            <div style={{ minWidth: 0 }}>
              <div className="card-title">{L('essentials')}</div>
              <div className="card-subtitle">{L('essentialsSub')}</div>
            </div>
            <span className={`badge ${filled === total ? 'badge-success' : 'badge-gold'}`} style={{ flexShrink: 0 }}>
              {filled}/{total} {L('done')}
            </span>
          </div>

          <div className="card-body">
            <div className="progress-bar" style={{ marginBottom: '1.5rem' }}>
              <div className={`progress-fill ${filled === total ? 'success' : ''}`.trim()} style={{ width: `${pct}%` }} />
            </div>

            <Grid>
              {/* 1 — Namba ya Ahadi */}
              <Field label={L('pledgeNo')} hint={L('pledgeHint')} id="ahadi_number">
                <div className="input-group">
                  <Icon path={icons.tag} size={16} className="input-icon" />
                  <Input id="ahadi_number" value={profile.ahadi_number ?? ''}
                    onChange={e => setField('ahadi_number', e.target.value)}
                    placeholder="—" inputMode="numeric" />
                </div>
              </Field>

              {/* 2 — Hali ya Ndoa */}
              <Field label={L('marital')} id="marital_status">
                <Select id="marital_status" value={profile.marital_status ?? ''}
                  onChange={e => setField('marital_status', e.target.value)}>
                  <option value="">{L('select')}</option>
                  {MARITAL_STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </Select>
              </Field>

              {/* 3 — Jumuiya */}
              <Field label={L('jumuiya')} id="jumuiya">
                <Select id="jumuiya" value={profile.jumuiya ?? ''}
                  onChange={e => setField('jumuiya', e.target.value)}>
                  <option value="">{L('select')}</option>
                  {JUMUIYA_LIST.map(j => <option key={j} value={j}>{j}</option>)}
                </Select>
              </Field>

              {/* 4 — Mzee wa Kanisa */}
              <Field label={L('elder')} id="elder_name">
                <Input id="elder_name" value={profile.elder_name ?? ''}
                  onChange={e => setField('elder_name', e.target.value)}
                  placeholder={t('profile_elder_name_placeholder')} />
              </Field>
              <Field label={L('elderPhone')} id="elder_phone">
                <Input id="elder_phone" type="tel" value={profile.elder_phone ?? ''}
                  onChange={e => setField('elder_phone', e.target.value)}
                  placeholder={t('profile_phone_placeholder')} />
              </Field>

              {/* 5 — Ubatizo */}
              <Field label={L('baptism')} id="is_baptized">
                <Select id="is_baptized" value={toSelect(baptized)}
                  onChange={e => setAnswer('is_baptized', 'baptism_date')(e.target.value)}>
                  <option value="">{L('select')}</option>
                  <option value="yes">{L('yes')}</option>
                  <option value="no">{L('no')}</option>
                </Select>
              </Field>

              {/* 6 — Kipaimara */}
              <Field label={L('confirmation')} id="is_confirmed">
                <Select id="is_confirmed" value={toSelect(confirmed)}
                  onChange={e => setAnswer('is_confirmed', 'confirmation_date')(e.target.value)}>
                  <option value="">{L('select')}</option>
                  <option value="yes">{L('yes')}</option>
                  <option value="no">{L('no')}</option>
                </Select>
              </Field>
            </Grid>

            {filled === total && (
              <div className="banner banner-success" style={{ marginTop: '1.25rem', alignItems: 'center' }}>
                <Icon path={icons.check} size={15} style={{ flexShrink: 0 }} />
                <span>{L('allDone')}</span>
              </div>
            )}
          </div>

          <div className="card-footer">
            <SaveBtn {...ss('essentials')} onClick={saveEssentials}
              label={t('save')} savedLabel={`${t('save')}!`} loadingLabel={t('loading')} />
          </div>
        </section>

        {/* ══ TAARIFA ZA ZIADA — advanced, collapsed ══════════════════════ */}
        <div style={{ marginTop: '0.75rem' }}>
          <button
            onClick={() => setShowAdvanced(v => !v)}
            aria-expanded={showAdvanced}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '1rem',
              justifyContent: 'space-between', textAlign: 'left',
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '0.5rem 0',
            }}
          >
            <span style={{ minWidth: 0 }}>
              <span className="font-display" style={{
                display: 'block', fontSize: '1.0625rem', fontWeight: 600,
                letterSpacing: '-0.015em', color: 'var(--text-primary)',
              }}>
                {L('advanced')}
              </span>
              <span style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                {L('advancedSub')}
              </span>
            </span>
            <span className="btn btn-secondary btn-sm" style={{ flexShrink: 0, pointerEvents: 'none' }}>
              {showAdvanced ? L('close') : L('open')}
              <Icon path={icons.chevron} size={14}
                style={{ transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: 'transform 200ms var(--ease-out)' }} />
            </span>
          </button>
          <hr className="divider" />
        </div>

        {showAdvanced && (
          <div className="animate-slide-down prose-full" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Tab bar */}
            <div className="tabs-pill" style={{ scrollbarWidth: 'none' }}>
              {TABS.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`tab-pill ${activeTab === tab.id ? 'active' : ''}`.trim()}>
                  <Icon path={tab.icon} size={13} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── PERSONAL ── */}
            {activeTab === 'personal' && (
              <div>
                <SubHeading>{t('profile_personal_info')}</SubHeading>
                <Grid>
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
                      {/* Must match ENUM('Male','Female'). MySQL matches
                          case-insensitively on write but reads back 'Male',
                          so a lowercase value never re-selects on reload. */}
                      <option value="Male">{t('profile_gender_male')}</option>
                      <option value="Female">{t('profile_gender_female')}</option>
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
                  <Field label={t('profile_volunteer')} span>
                    <Select value={profile.willing_to_volunteer ? 'yes' : 'no'}
                      onChange={e => setField('willing_to_volunteer', e.target.value === 'yes')}>
                      <option value="yes">{t('profile_yes')}</option>
                      <option value="no">{t('profile_no')}</option>
                    </Select>
                  </Field>
                </Grid>

                {/* CV upload */}
                <div style={{ marginTop: '1.5rem' }}>
                  <SubHeading>{t('profile_cv_heading')}</SubHeading>
                  <input ref={cvInputRef} type="file" accept=".pdf,.doc,.docx"
                    style={{ display: 'none' }} onChange={handleCvChange} />
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
                    <button type="button" onClick={() => cvInputRef.current?.click()}
                      disabled={cvStage === 'uploading' || cvStage === 'saving'}
                      className="btn btn-secondary">
                      <Icon path={icons.upload} size={14} />
                      {profile.cv_url ? t('profile_cv_replace') : t('profile_cv_upload')}
                    </button>
                    {(cvStage === 'uploading' || cvStage === 'saving') && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        <Spinner size={14} />
                        {cvStage === 'uploading'
                          ? <>{t('profile_cv_uploading')} {cvProgress}%</>
                          : t('profile_cv_saving')}
                        {cvStage === 'uploading' && (
                          <span className="progress-bar" style={{ width: 96, display: 'block' }}>
                            <span className="progress-fill" style={{ display: 'block', width: `${cvProgress}%` }} />
                          </span>
                        )}
                      </div>
                    )}
                    {cvStage === 'done' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', fontWeight: 500, color: 'var(--success)' }}>
                        <Icon path={icons.check} size={13} />{t('profile_cv_uploaded')}
                      </div>
                    )}
                    {cvStage === 'idle' && cvFileName && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cvFileName}
                      </span>
                    )}
                    {profile.cv_url && cvStage === 'idle' && (
                      <a href="/dashboard/profile/cv" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', marginLeft: 'auto' }}>
                        <Icon path={icons.file} size={13} />{t('profile_cv_view')}
                      </a>
                    )}
                  </div>
                  {cvError && <p className="form-error" style={{ marginTop: '0.5rem' }}>{cvError}</p>}
                  {cvStage === 'idle' && !cvError && (
                    <p className="form-hint" style={{ marginTop: '0.375rem' }}>{t('profile_cv_hint')}</p>
                  )}
                </div>
              </div>
            )}

            {/* ── FAMILY ── */}
            {activeTab === 'family' && (
              <div>
                <SubHeading>{t('profile_family_title')}</SubHeading>
                <div className="banner banner-gold" style={{ marginBottom: '1.25rem', alignItems: 'center' }}>
                  <span>
                    <strong>{L('marital')}:</strong> {marital ?? '—'} · {L('changeIn')}
                  </span>
                </div>
                {!isMarried && !isCohabiting ? (
                  <p className="form-hint">{t('profile_select')}</p>
                ) : (
                  <Grid>
                    {isCohabiting && (
                      <Field label={t('profile_partner_name')} span>
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
                  </Grid>
                )}
              </div>
            )}

            {/* ── WORK ── */}
            {activeTab === 'work' && (
              <div>
                <SubHeading>{t('profile_work_title')}</SubHeading>
                <Grid>
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
                </Grid>
              </div>
            )}

            {/* ── ADDRESS ── */}
            {activeTab === 'address' && (
              <div>
                <SubHeading>{t('profile_church_history')}</SubHeading>
                <Grid style={{ marginBottom: '1.5rem' }}>
                  <Field label={t('profile_prev_church')} span>
                    <Input value={profile.previous_church ?? ''} onChange={e => setField('previous_church', e.target.value)}
                      placeholder={t('profile_prev_church_placeholder')} />
                  </Field>
                </Grid>
                <SubHeading>{t('profile_neighbour_ref')}</SubHeading>
                <Grid>
                  <Field label={t('profile_neighbour_name')}>
                    <Input value={profile.neighbour_member_name ?? ''} onChange={e => setField('neighbour_member_name', e.target.value)}
                      placeholder={t('profile_neighbour_name_placeholder')} />
                  </Field>
                  <Field label={t('profile_neighbour_phone')}>
                    <Input type="tel" value={profile.neighbour_member_phone ?? ''}
                      onChange={e => setField('neighbour_member_phone', e.target.value)}
                      placeholder={t('profile_phone_placeholder')} />
                  </Field>
                </Grid>
              </div>
            )}

            {/* ── SPIRITUAL ── */}
            {activeTab === 'spiritual' && (
              <div>
                <SubHeading>{t('profile_sacraments')}</SubHeading>
                <Grid style={{ marginBottom: '1.5rem' }}>
                  <Field label={`${L('baptism')} — ${L('optionalDate')}`}
                    hint={baptized ? undefined : L('notBaptised')}>
                    <Input type="date" disabled={!baptized}
                      value={profile.baptism_date?.split('T')[0] ?? ''}
                      onChange={e => setField('baptism_date', e.target.value)} />
                  </Field>
                  <Field label={`${L('confirmation')} — ${L('optionalDate')}`}
                    hint={confirmed ? undefined : L('notConfirmed')}>
                    <Input type="date" disabled={!confirmed}
                      value={profile.confirmation_date?.split('T')[0] ?? ''}
                      onChange={e => setField('confirmation_date', e.target.value)} />
                  </Field>
                  <div className="field-row" style={{ gridColumn: '1 / -1' }}>
                    <input id="takes_communion" type="checkbox" className="checkbox"
                      checked={!!profile.takes_communion}
                      onChange={e => setField('takes_communion', e.target.checked)} />
                    <label htmlFor="takes_communion">
                      {t('profile_communion')}
                      <span style={{ color: 'var(--text-tertiary)', marginLeft: 4 }}>{t('profile_communion_sub')}</span>
                    </label>
                  </div>
                </Grid>

                {minLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '1.5rem 0' }}><Spinner /></div>
                ) : (
                  <>
                    <SubHeading>{t('profile_ministries')}</SubHeading>
                    {spiritualGroups.ministries.length === 0 ? (
                      <p className="form-hint" style={{ marginBottom: '1.5rem' }}>{t('profile_no_ministries')}</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2rem' }}>
                        {Object.entries(ministryGroups).map(([cat, items]) => (
                          <div key={cat}>
                            <p className="stat-label" style={{ marginBottom: '0.5rem' }}>{cat}</p>
                            <Grid min={200}>
                              {items.map(g => (
                                <ServiceCheck key={g.id} id={`grp-${g.id}`} label={g.name}
                                  checked={memberGroupIds.includes(Number(g.id))}
                                  onChange={() => toggleGroup(g.id)} />
                              ))}
                            </Grid>
                          </div>
                        ))}
                      </div>
                    )}
                    <SubHeading>{t('profile_committees')}</SubHeading>
                    {spiritualGroups.committees.length === 0 ? (
                      <p className="form-hint">{t('profile_no_committees')}</p>
                    ) : (
                      <Grid min={200}>
                        {spiritualGroups.committees.map(g => (
                          <ServiceCheck key={g.id} id={`grp-${g.id}`} label={g.name}
                            checked={memberGroupIds.includes(Number(g.id))}
                            onChange={() => toggleGroup(g.id)} />
                        ))}
                      </Grid>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── DEPENDANTS ── */}
            {activeTab === 'dependants' && (
              <div>
                <SubHeading>{t('profile_dependants_title')}</SubHeading>
                <p className="form-hint" style={{ marginBottom: '0.75rem' }}>{t('profile_dependants_hint')}</p>
                <Grid min={180}>
                  <Field>
                    <Input placeholder={t('profile_dep_name_placeholder')} value={depForm.full_name}
                      onChange={e => setDepForm(f => ({ ...f, full_name: e.target.value }))} />
                  </Field>
                  <Field>
                    <Select value={depForm.relationship}
                      onChange={e => setDepForm(f => ({ ...f, relationship: e.target.value }))}>
                      <option value="">{t('profile_dep_relationship')}</option>
                      <option value="child">{t('profile_dep_child')}</option>
                      <option value="parent">{t('profile_dep_parent')}</option>
                      <option value="sibling">{t('profile_dep_sibling')}</option>
                      <option value="other">{t('profile_dep_other')}</option>
                    </Select>
                  </Field>
                  <Field>
                    <Input type="date" value={depForm.date_of_birth}
                      onChange={e => setDepForm(f => ({ ...f, date_of_birth: e.target.value }))} />
                  </Field>
                </Grid>
                {depError && <p className="form-error" style={{ marginTop: '0.5rem' }}>{depError}</p>}
                <button onClick={addDependant} className="btn btn-primary" style={{ marginTop: '0.75rem' }}>
                  <Icon path={icons.plus} size={14} />
                  {t('profile_add_dependant')}
                </button>

                <hr className="divider" style={{ margin: '1.5rem 0' }} />

                {depLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem 0' }}><Spinner /></div>
                ) : dependants.length === 0 ? (
                  <div className="empty-state"><p className="empty-state-body">{t('profile_no_dependants')}</p></div>
                ) : (
                  <div>
                    {dependants.map((dep, i) => (
                      <div key={dep.id}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.875rem 0' }}>
                          <div className="avatar avatar-sm" aria-hidden>
                            {dep.full_name[0].toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {dep.full_name}
                            </p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>
                              {dep.relationship || '—'}
                              {dep.date_of_birth
                                ? ` · ${t('profile_dep_born')} ${new Date(dep.date_of_birth).toLocaleDateString(lang === 'sw' ? 'sw-TZ' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                                : ''}
                            </p>
                          </div>
                          <button onClick={() => removeDependant(dep.id)}
                            className="btn btn-ghost btn-icon btn-sm"
                            aria-label={t('profile_dep_remove_confirm')}>
                            <Icon path={icons.trash} size={15} />
                          </button>
                        </div>
                        {i < dependants.length - 1 && <hr className="divider" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── SECURITY ── */}
            {activeTab === 'security' && (
              <div>
                <SubHeading>{t('profile_security_title')}</SubHeading>
                <div style={{ maxWidth: 384, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {[
                    { key: 'current_password', label: t('profile_current_password') },
                    { key: 'new_password',     label: t('profile_new_password') },
                    { key: 'confirm',          label: t('profile_confirm_password') },
                  ].map(({ key, label }) => (
                    <Field key={key} label={label} id={key}>
                      <div style={{ position: 'relative' }}>
                        <Input
                          id={key}
                          type={showPw[key] ? 'text' : 'password'}
                          value={pwForm[key]}
                          onChange={e => setPwForm(f => ({ ...f, [key]: e.target.value }))}
                          style={{ paddingRight: '2.5rem' }}
                        />
                        <button type="button"
                          onClick={() => setShowPw(s => ({ ...s, [key]: !s[key] }))}
                          aria-label={label}
                          style={{
                            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                            background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                            color: 'var(--text-tertiary)', display: 'flex',
                          }}>
                          <Icon path={showPw[key] ? icons.eyeOff : icons.eye} size={15} />
                        </button>
                      </div>
                    </Field>
                  ))}
                  {pwError && <p className="form-error">{pwError}</p>}
                  <p className="form-hint">{t('profile_pw_hint')}</p>
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      {/* Floating save — only for the advanced tab in view. The prerequisite
          block saves from its own footer so the two never compete. */}
      {showAdvanced && activeTab !== 'dependants' && (
        <div className="fab-profile-save">
          <SaveBtn
            {...ss(activeTab)}
            onClick={{
              personal:  savePersonal,
              family:    saveFamily,
              work:      saveWork,
              address:   saveAddress,
              spiritual: saveSpiritual,
              security:  saveSecurity,
            }[activeTab]}
            label={t('save')} savedLabel={`${t('save')}!`} loadingLabel={t('loading')}
            className="btn-lg"
          />
        </div>
      )}

      <style>{`
        .profile-avatar-wrap:hover .profile-avatar-overlay { opacity: 1; }
        .tabs-pill::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}