'use client';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useTranslation } from '../../../lib/i18n';
import { getAuth } from '../../../lib/auth';
import CloudinaryService from '../../../lib/cloudinary';
import PageHeader from '../../../components/ui/PageHeader';

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

const ROLE_LABELS = {
  pastor:       { en: 'Pastor',       sw: 'Mchungaji' },
  elder:        { en: 'Elder',        sw: 'Mzee' },
  group_leader: { en: 'Group Leader', sw: 'Kiongozi wa Kikundi' },
  member:       { en: 'Member',       sw: 'Mwanakamati' },
};

// ─── Avatar component ─────────────────────────────────────────────────────────

function Avatar({ src, name, size = 96 }) {
  const initials = name
    ? name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }}
        className="border-2 border-hairline"
      />
    );
  }

  return (
    <div
      style={{
        width: size, height: size, borderRadius: '50%',
        background: 'var(--color-navy, #1B3A6B)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <span style={{ color: '#fff', fontSize: size * 0.35, fontWeight: 700, letterSpacing: '-0.02em' }}>
        {initials}
      </span>
    </div>
  );
}

// ─── Info row ─────────────────────────────────────────────────────────────────

function InfoRow({ label, value, placeholder }) {
  return (
    <div className="py-3 flex items-start gap-4 border-b border-hairline last:border-0">
      <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider w-36 flex-shrink-0 pt-0.5">
        {label}
      </span>
      <span className={`text-sm flex-1 ${value ? 'text-ink' : 'text-ink-faint italic'}`}>
        {value || placeholder || '—'}
      </span>
    </div>
  );
}

// ─── Password modal ───────────────────────────────────────────────────────────

function PasswordModal({ onClose, onSave, lang }) {
  const sw = lang === 'sw';
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (form.next.length < 6) {
      setError(sw ? 'Nenosiri lazima liwe na herufi 6 au zaidi.' : 'Password must be at least 6 characters.');
      return;
    }
    if (form.next !== form.confirm) {
      setError(sw ? 'Manenosiri hayalingani.' : 'Passwords do not match.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(form.current, form.next);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel max-w-md w-full">
        <div className="modal-header">
          <h2 className="font-semibold text-ink text-base">
            {sw ? 'Badilisha Nenosiri' : 'Change Password'}
          </h2>
          <button className="btn-ghost px-2" onClick={onClose}>✕</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {error && <div className="banner-error text-sm">{error}</div>}
          <div>
            <label className="field-label">{sw ? 'Nenosiri la Sasa' : 'Current Password'}</label>
            <input
              type="password"
              className="field-input"
              value={form.current}
              onChange={e => setForm(f => ({ ...f, current: e.target.value }))}
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="field-label">{sw ? 'Nenosiri Jipya' : 'New Password'}</label>
            <input
              type="password"
              className="field-input"
              value={form.next}
              onChange={e => setForm(f => ({ ...f, next: e.target.value }))}
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="field-label">{sw ? 'Thibitisha Nenosiri' : 'Confirm Password'}</label>
            <input
              type="password"
              className="field-input"
              value={form.confirm}
              onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
              placeholder="••••••••"
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-hairline flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>{sw ? 'Ghairi' : 'Cancel'}</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? (sw ? 'Inahifadhi…' : 'Saving…') : (sw ? 'Hifadhi' : 'Save')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user: authUser, lang, refreshUser } = useAuth();
  const { t } = useTranslation(lang);
  const sw = lang === 'sw';

  const [profile, setProfile]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [editing, setEditing]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [toast, setToast]         = useState(null);
  const [showPwModal, setShowPwModal] = useState(false);

  // Photo upload state
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoProgress, setPhotoProgress]   = useState(0);
  const photoRef = useRef(null);

  // Editable form state
  const [form, setForm] = useState({
    full_name: '', phone: '', namba_ya_usharika: '',
  });

  // ── Load profile ────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await apiFetch('/auth/me');
        setProfile(res.user);
        setForm({
          full_name:         res.user.full_name || '',
          phone:             res.user.phone || '',
          namba_ya_usharika: res.user.namba_ya_usharika || '',
        });
      } catch {
        showToast(sw ? 'Imeshindwa kupakia wasifu.' : 'Failed to load profile.', 'error');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ── Toast ───────────────────────────────────────────────────────────────────

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  // ── Save profile edits ──────────────────────────────────────────────────────

  async function handleSave() {
    if (!form.full_name.trim()) {
      showToast(sw ? 'Jina linahitajika.' : 'Name is required.', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch('/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
      setProfile(res.user);
      if (refreshUser) refreshUser(res.user);
      setEditing(false);
      showToast(sw ? 'Wasifu umehifadhiwa.' : 'Profile saved.');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  // ── Photo upload ────────────────────────────────────────────────────────────

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast(sw ? 'Tafadhali chagua picha.' : 'Please select an image file.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast(sw ? 'Picha ni kubwa sana. Hadi 5 MB.' : 'Image too large. Max 5 MB.', 'error');
      return;
    }

    setPhotoUploading(true);
    setPhotoProgress(0);
    try {
      const result = await CloudinaryService.uploadFromFile({
        file,
        folder: 'church_portal/profiles',
        onProgress: pct => setPhotoProgress(pct),
      });

      const res = await apiFetch('/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({ profile_photo_url: result.secureUrl }),
      });

      setProfile(res.user);
      if (refreshUser) refreshUser(res.user);
      showToast(sw ? 'Picha imebadilishwa.' : 'Photo updated.');
    } catch (err) {
      showToast(sw ? 'Imeshindwa kupakia picha.' : 'Photo upload failed.', 'error');
    } finally {
      setPhotoUploading(false);
      setPhotoProgress(0);
      if (photoRef.current) photoRef.current.value = '';
    }
  }

  // ── Change password ─────────────────────────────────────────────────────────

  async function handleChangePassword(currentPassword, newPassword) {
    await apiFetch('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    showToast(sw ? 'Nenosiri limebadilishwa.' : 'Password changed.');
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div>
        <PageHeader
          breadcrumb={sw ? 'Wasifu' : 'Profile'}
          title={sw ? 'Wasifu Wangu' : 'My Profile'}
        />
        <div className="px-8 py-16 flex justify-center">
          <span className="w-5 h-5 border-2 border-border border-t-ink-muted rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const roleLabel = ROLE_LABELS[profile.role]?.[lang] || profile.role;
  const joinDate  = new Date(profile.created_at).toLocaleDateString(
    sw ? 'sw-TZ' : 'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' }
  );

  return (
    <div>
      <PageHeader
        breadcrumb={sw ? 'Wasifu' : 'Profile'}
        title={sw ? 'Wasifu Wangu' : 'My Profile'}
        subtitle={sw ? 'Tazama na hariri maelezo yako' : 'View and edit your information'}
      />

      <div className="px-8 py-8 max-w-content space-y-6">

        {/* ── Profile hero card ─── */}
        <div className="card">
          <div className="flex items-start gap-5 flex-wrap">

            {/* Avatar + upload */}
            <div className="relative flex-shrink-0">
              {photoUploading ? (
                <div
                  style={{ width: 88, height: 88, borderRadius: '50%', background: '#F5F4F1' }}
                  className="flex flex-col items-center justify-center border-2 border-hairline"
                >
                  <span className="text-xs text-ink-muted mb-1">{photoProgress}%</span>
                  <div className="progress-track" style={{ width: 52 }}>
                    <div className="progress-fill" style={{ width: `${photoProgress}%` }} />
                  </div>
                </div>
              ) : (
                <Avatar src={profile.profile_photo_url} name={profile.full_name} size={88} />
              )}

              {/* Camera overlay */}
              <button
                onClick={() => photoRef.current?.click()}
                disabled={photoUploading}
                title={sw ? 'Badilisha picha' : 'Change photo'}
                style={{
                  position: 'absolute', bottom: 0, right: 0,
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'var(--color-navy, #1B3A6B)',
                  border: '2px solid white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: photoUploading ? 'not-allowed' : 'pointer',
                  opacity: photoUploading ? 0.5 : 1,
                }}
              >
                <span style={{ fontSize: 13, color: '#fff' }}>✎</span>
              </button>
              <input
                ref={photoRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handlePhotoChange}
              />
            </div>

            {/* Name / role / status */}
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-ink leading-tight">{profile.full_name}</h2>
              <p className="text-sm text-ink-muted mt-0.5">{profile.email}</p>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className={`role-badge role-badge-${profile.role}`}>
                  {roleLabel}
                </span>
                {profile.group_name && (
                  <>
                    <span className="text-ink-faint text-xs">·</span>
                    <span className="text-xs text-ink-muted">{profile.group_name}</span>
                  </>
                )}
                <span className="text-ink-faint text-xs">·</span>
                <span className="flex items-center gap-1 text-xs">
                  <span className={`status-dot ${profile.is_active ? 'status-dot-completed' : 'status-dot-open'}`} />
                  <span className="text-ink-muted">
                    {profile.is_active
                      ? (sw ? 'Akaunti Hai' : 'Active')
                      : (sw ? 'Inasubiri Idhini' : 'Pending Approval')}
                  </span>
                </span>
              </div>
            </div>

            {/* Edit / Save / Cancel */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {editing ? (
                <>
                  <button className="btn-secondary" onClick={() => setEditing(false)}>
                    {sw ? 'Ghairi' : 'Cancel'}
                  </button>
                  <button className="btn-primary" onClick={handleSave} disabled={saving}>
                    {saving ? (sw ? 'Inahifadhi…' : 'Saving…') : (sw ? 'Hifadhi' : 'Save Changes')}
                  </button>
                </>
              ) : (
                <button className="btn-secondary" onClick={() => setEditing(true)}>
                  {sw ? 'Hariri' : 'Edit Profile'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Personal information ─── */}
        <div className="card">
          <p className="section-label mb-4">{sw ? 'Maelezo ya Kibinafsi' : 'Personal Information'}</p>

          {editing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="field-label">{sw ? 'Jina Kamili *' : 'Full Name *'}</label>
                  <input
                    className="field-input"
                    value={form.full_name}
                    onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                    placeholder={sw ? 'Jina lako kamili' : 'Your full name'}
                  />
                </div>
                <div>
                  <label className="field-label">{sw ? 'Simu' : 'Phone'}</label>
                  <input
                    className="field-input"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+255 7XX XXX XXX"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="field-label">{sw ? 'Namba ya Usharika' : 'Membership Number'}</label>
                  <input
                    className="field-input"
                    value={form.namba_ya_usharika}
                    onChange={e => setForm(f => ({ ...f, namba_ya_usharika: e.target.value }))}
                    placeholder="e.g. KAN-00123"
                  />
                </div>
                <div>
                  {/* Email is read-only */}
                  <label className="field-label">{sw ? 'Barua Pepe' : 'Email'}</label>
                  <input
                    className="field-input"
                    value={profile.email}
                    disabled
                    style={{ opacity: 0.6, cursor: 'not-allowed' }}
                  />
                  <p className="text-xs text-ink-faint mt-1">
                    {sw ? 'Barua pepe haiwezi kubadilishwa.' : 'Email cannot be changed.'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <InfoRow label={sw ? 'Jina Kamili' : 'Full Name'}         value={profile.full_name} />
              <InfoRow label={sw ? 'Barua Pepe' : 'Email'}              value={profile.email} />
              <InfoRow label={sw ? 'Simu' : 'Phone'}                    value={profile.phone}             placeholder={sw ? 'Haijawekwa' : 'Not set'} />
              <InfoRow label={sw ? 'Namba ya Usharika' : 'Member No.'}  value={profile.namba_ya_usharika} placeholder={sw ? 'Haijawekwa' : 'Not set'} />
              <InfoRow label={sw ? 'Kikundi' : 'Group'}                 value={profile.group_name}        placeholder={sw ? 'Hakuna kikundi' : 'No group'} />
              <InfoRow label={sw ? 'Tarehe ya Kujiunga' : 'Joined'}     value={joinDate} />
            </div>
          )}
        </div>

        {/* ── Account & security ─── */}
        <div className="card">
          <p className="section-label mb-4">{sw ? 'Akaunti na Usalama' : 'Account & Security'}</p>

          <div className="flex items-center justify-between py-3 border-b border-hairline">
            <div>
              <p className="text-sm font-medium text-ink">{sw ? 'Nenosiri' : 'Password'}</p>
              <p className="text-xs text-ink-faint mt-0.5">••••••••</p>
            </div>
            <button className="btn-ghost" onClick={() => setShowPwModal(true)}>
              {sw ? 'Badilisha' : 'Change'}
            </button>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-ink">{sw ? 'Hali ya Akaunti' : 'Account Status'}</p>
              <p className="text-xs text-ink-faint mt-0.5">
                {profile.is_verified
                  ? (sw ? 'Imethibitishwa' : 'Verified')
                  : (sw ? 'Haijakamilika' : 'Unverified')}
              </p>
            </div>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              profile.is_active
                ? 'bg-green-50 text-green-700'
                : 'bg-amber-50 text-amber-700'
            }`}>
              {profile.is_active
                ? (sw ? 'Hai' : 'Active')
                : (sw ? 'Inasubiri' : 'Pending')}
            </span>
          </div>
        </div>

      </div>

      {/* Password modal */}
      {showPwModal && (
        <PasswordModal
          lang={lang}
          onClose={() => setShowPwModal(false)}
          onSave={handleChangePassword}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.type === 'error' ? 'bg-danger text-white' : 'bg-ink text-white'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}