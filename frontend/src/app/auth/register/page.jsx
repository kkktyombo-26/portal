'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../hooks/useAuth';
import { authApi } from '../../../lib/api';
import { setAuth } from '../../../lib/auth';
import CloudinaryService from '../../../lib/cloudinary';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

async function apiFetch(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

// ─── OTP digit input ──────────────────────────────────────────────────────────
function OtpInput({ value, onChange, disabled }) {
  const inputs = useRef([]);
  const digits = (value + '      ').slice(0, 6).split('');

  function handleKey(i, e) {
    if (e.key === 'Backspace') {
      const next = value.slice(0, i) + value.slice(i + 1);
      onChange(next);
      if (i > 0) inputs.current[i - 1]?.focus();
      return;
    }
    if (!/^\d$/.test(e.key)) return;
    const next = (value + '      ').split('');
    next[i] = e.key;
    onChange(next.join('').slice(0, 6).trim());
    if (i < 5) inputs.current[i + 1]?.focus();
  }

  function handlePaste(e) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) { onChange(pasted); inputs.current[Math.min(pasted.length, 5)]?.focus(); }
    e.preventDefault();
  }

  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={el => (inputs.current[i] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d.trim()}
          disabled={disabled}
          onChange={() => {}}
          onKeyDown={e => handleKey(i, e)}
          onPaste={handlePaste}
          onFocus={e => e.target.select()}
          style={{
            width: 46, height: 54, borderRadius: 10,
            border: `2px solid ${d.trim() ? '#1B3A6B' : '#DDD8CE'}`,
            background: d.trim() ? '#EAF0F8' : '#FDFCF9',
            fontSize: 22, fontWeight: 700, textAlign: 'center',
            color: '#1B3A6B', outline: 'none',
            transition: 'border-color 0.15s, background 0.15s',
            caretColor: 'transparent',
          }}
        />
      ))}
    </div>
  );
}

// ─── Countdown timer ──────────────────────────────────────────────────────────
function Countdown({ seconds, onExpire }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    setLeft(seconds);
    const t = setInterval(() => setLeft(s => {
      if (s <= 1) { clearInterval(t); onExpire(); return 0; }
      return s - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [seconds]);
  const m = String(Math.floor(left / 60)).padStart(2, '0');
  const s = String(left % 60).padStart(2, '0');
  return <span style={{ fontVariantNumeric: 'tabular-nums', color: left < 30 ? '#991B1B' : '#6B7280' }}>{m}:{s}</span>;
}

// ─── Photo upload picker ──────────────────────────────────────────────────────
function PhotoPicker({ previewUrl, onFile, uploading, uploadProgress, sw }) {
  const fileRef = useRef(null);

  function handleChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert(sw ? 'Picha ni kubwa sana. Chagua picha chini ya 5 MB.' : 'Image too large. Please choose one under 5 MB.');
      return;
    }
    onFile(file);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      {/* Avatar ring */}
      <div
        onClick={() => !uploading && fileRef.current?.click()}
        style={{
          width: 110, height: 110, borderRadius: '50%',
          border: `3px dashed ${previewUrl ? '#1B3A6B' : '#DDD8CE'}`,
          background: previewUrl ? 'transparent' : '#F5F3EF',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: uploading ? 'not-allowed' : 'pointer',
          overflow: 'hidden', position: 'relative',
          transition: 'border-color 0.2s',
        }}
      >
        {previewUrl ? (
          <img src={previewUrl} alt="Profile preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ textAlign: 'center', pointerEvents: 'none' }}>
            <div style={{ fontSize: 28, marginBottom: 4 }}>📷</div>
            <p style={{ margin: 0, fontSize: 10, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {sw ? 'Chagua Picha' : 'Choose Photo'}
            </p>
          </div>
        )}

        {/* Upload progress overlay */}
        {uploading && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(27,58,107,0.65)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <div style={{
              width: 36, height: 36,
              border: '3px solid rgba(255,255,255,0.3)',
              borderTopColor: '#fff',
              borderRadius: '50%',
              animation: 'spin 0.75s linear infinite',
            }} />
            <span style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>{uploadProgress}%</span>
          </div>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleChange} />

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        style={{
          padding: '8px 18px', borderRadius: 8,
          border: '1px solid #DDD8CE', background: '#FDFCF9',
          color: '#1B3A6B', fontSize: 13, fontWeight: 600,
          cursor: uploading ? 'not-allowed' : 'pointer',
          opacity: uploading ? 0.6 : 1,
        }}
      >
        {previewUrl ? (sw ? 'Badilisha Picha' : 'Change Photo') : (sw ? 'Pakia Picha' : 'Upload Photo')}
      </button>

      <p style={{ margin: 0, fontSize: 11, color: '#9CA3AF', textAlign: 'center' }}>
        {sw ? 'JPEG, PNG au WebP · Hadi 5 MB · Inahitajika kwa uthibitisho' : 'JPEG, PNG or WebP · Up to 5 MB · Required for verification'}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page — Steps: 'email' → 'otp' → 'photo' → 'form' → 'pending'
// ─────────────────────────────────────────────────────────────────────────────
export default function RegisterPage() {
  const { lang } = useAuth();
  const sw = lang === 'sw';
  const router = useRouter();

  const [step,           setStep]           = useState('email');
  const [email,          setEmail]          = useState('');
  const [otpValue,       setOtpValue]       = useState('');
  const [verifiedToken,  setVerifiedToken]  = useState('');
  const [otpExpired,     setOtpExpired]     = useState(false);
  const [photoPreview,   setPhotoPreview]   = useState('');
  const [photoUrl,       setPhotoUrl]       = useState('');
  const [uploading,      setUploading]      = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [form,           setForm]           = useState({ full_name: '', password: '', phone: '', namba_ya_usharika: '' });
  const [showPass,       setShowPass]       = useState(false);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState(null);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview); }, [photoPreview]);

  // ── Step 1: send OTP ──────────────────────────────────────────────────────
  async function handleSendOtp(e) {
    e?.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiFetch('/auth/send-verification-otp', { email });
      setOtpExpired(false);
      setOtpValue('');
      setStep('otp');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: verify OTP ────────────────────────────────────────────────────
  async function handleVerifyOtp(e) {
    e?.preventDefault();
    if (otpValue.length < 6) return;
    setError(null);
    setLoading(true);
    try {
      const data = await apiFetch('/auth/verify-email-otp', { email, otp: otpValue });
      setVerifiedToken(data.verifiedToken);
      setStep('photo');
    } catch (err) {
      setError(err.message);
      setOtpValue('');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (step === 'otp' && otpValue.length === 6 && !loading) handleVerifyOtp();
  }, [otpValue]);

  // ── Step 3a: file chosen → upload to Cloudinary ───────────────────────────
  async function handlePhotoFile(file) {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(URL.createObjectURL(file));
    setError(null);
    setUploading(true);
    setUploadProgress(0);
    try {
      const result = await CloudinaryService.uploadFromFile({
        file,
        folder: 'church_portal/profile_photos',
        onProgress: pct => setUploadProgress(pct),
      });
      setPhotoUrl(result.secureUrl);
    } catch {
      setError(sw ? 'Imeshindwa kupakia picha. Jaribu tena.' : 'Photo upload failed. Please try again.');
      setPhotoPreview('');
      setPhotoUrl('');
    } finally {
      setUploading(false);
    }
  }

  // ── Step 3b: continue from photo ──────────────────────────────────────────
  function handlePhotoContinue() {
    if (!photoUrl) {
      setError(sw ? 'Tafadhali pakia picha yako kwanza.' : 'Please upload your photo before continuing.');
      return;
    }
    setError(null);
    setStep('form');
  }

  // ── Step 4: register ──────────────────────────────────────────────────────
  async function handleRegister(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await authApi.register({
        ...form,
        email,
        role: 'member',
        verifiedToken,
        profile_photo_url: photoUrl || null,
      });
      setAuth(res.data.token, res.data.user);
      setStep('pending');
    } catch (err) {
      if (err.message?.includes('verification token')) {
        setVerifiedToken('');
        setStep('email');
        setError(sw ? 'Muda wa uthibitisho umekwisha. Tafadhali anza tena.' : 'Verification expired. Please start again.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Shared decoration ─────────────────────────────────────────────────────
  const CrossWatermark = () => (
    <div aria-hidden style={{ position: 'absolute', top: 0, right: 0, width: 220, height: 220, overflow: 'hidden', pointerEvents: 'none', opacity: 0.04 }}>
      <div style={{ position: 'absolute', top: 16, right: 80, width: 12, height: 120, background: '#1B3A6B', borderRadius: 3 }} />
      <div style={{ position: 'absolute', top: 58, right: 30, width: 100, height: 12, background: '#1B3A6B', borderRadius: 3 }} />
    </div>
  );

  const STEPS = ['email', 'otp', 'photo', 'form'];
  const stepIdx = STEPS.indexOf(step);
  const StepDots = () => (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 28 }}>
      {STEPS.map((s, i) => (
        <div key={s} style={{ width: i === stepIdx ? 24 : 8, height: 8, borderRadius: 4, background: i <= stepIdx ? '#1B3A6B' : '#DDD8CE', transition: 'width 0.3s, background 0.3s' }} />
      ))}
    </div>
  );

  // ── PENDING ───────────────────────────────────────────────────────────────
  if (step === 'pending') {
    return (
      <PageShell>
        <CrossWatermark />
        <LogoBlock sw={sw} />
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          {photoUrl
            ? <img src={photoUrl} alt="Profile" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '3px solid #C5D5EA', marginBottom: 14 }} />
            : <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#EAF0F8', border: '2px solid #C5D5EA', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, marginBottom: 14 }}>🕐</div>
          }
          <h2 style={{ margin: '0 0 8px', fontSize: 19, fontWeight: 700, color: '#1B3A6B' }}>
            {sw ? 'Akaunti Yako Inasubiri Idhini' : 'Account Pending Approval'}
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: '#6B7280', lineHeight: 1.6, maxWidth: 300, marginInline: 'auto' }}>
            {sw
              ? 'Usajili wako umepokewa. Kiongozi wa kanisa atakagua na kukuidhinisha akaunti yako.'
              : 'Your registration has been received. A church leader will review and approve your account.'}
          </p>
        </div>

        <div style={{ background: '#F5F0E8', border: '1px solid #E8DFC8', borderRadius: 10, padding: '16px 18px', marginBottom: 20 }}>
          <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {sw ? 'Hatua Zinazofuata' : 'What Happens Next'}
          </p>
          {[
            sw ? '✅  Barua pepe yako imethibitishwa'          : '✅  Your email has been verified',
            sw ? '📷  Picha yako imepakiwa kwa uthibitisho'    : '📷  Your photo has been submitted for verification',
            sw ? '👤  Kiongozi ataangalia maombi yako'         : '👤  A leader will review your request',
            sw ? '🔔  Utaarifu ukikubaliwa'                    : '🔔  You\'ll be notified once approved',
          ].map((s, i, arr) => (
            <p key={i} style={{ margin: i < arr.length - 1 ? '0 0 6px' : '0', fontSize: 13, color: '#374151' }}>{s}</p>
          ))}
        </div>

        <div style={{ background: '#EAF0F8', border: '1px solid #C5D5EA', borderRadius: 10, padding: '14px 18px', marginBottom: 20 }}>
          <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {sw ? 'Taarifa Ulizoweka' : 'Registered Details'}
          </p>
          {[
            [sw ? 'Jina' : 'Name',  form.full_name],
            ['Email',               email],
            ...(form.phone             ? [[sw ? 'Simu'  : 'Phone',      form.phone]]             : []),
            ...(form.namba_ya_usharika ? [[sw ? 'Namba' : 'Member No.', form.namba_ya_usharika]] : []),
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: '#6B7280' }}>{label}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#1B3A6B' }}>{value}</span>
            </div>
          ))}
        </div>

        <Link href="/auth/login" style={{ display: 'block', textAlign: 'center', padding: 11, borderRadius: 8, border: '1px solid #DDD8CE', background: '#FDFCF9', color: '#1B3A6B', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
          ← {sw ? 'Rudi Ukurasa wa Kuingia' : 'Back to Login'}
        </Link>
      </PageShell>
    );
  }

  // ── EMAIL ─────────────────────────────────────────────────────────────────
  if (step === 'email') {
    return (
      <PageShell>
        <CrossWatermark />
        <LogoBlock sw={sw} />
        <StepDots />
        <div style={{ marginBottom: 22 }}>
          <h2 style={{ margin: '0 0 3px', fontSize: 19, fontWeight: 700, color: '#111827' }}>
            {sw ? 'Thibitisha Barua Pepe' : 'Verify Your Email'}
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: '#6B7280' }}>
            {sw ? 'Tutakutumia nambari ya uthibitisho' : "We'll send you a verification code first"}
          </p>
        </div>
        <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <ErrorBanner msg={error} />}
          <div>
            <label style={labelStyle}>{sw ? 'Barua Pepe' : 'Email Address'}</label>
            <input className="field-input" type="email" value={email} onChange={e => { setEmail(e.target.value); setError(null); }} placeholder="you@church.com" required autoFocus autoComplete="email" />
          </div>
          <button type="submit" disabled={loading || !email} className="btn-primary w-full justify-center" style={{ marginTop: 4 }}>
            {loading ? <Spinner label={sw ? 'Inatuma...' : 'Sending…'} /> : (sw ? 'Tuma Nambari' : 'Send Code')}
          </button>
        </form>
        <div className="hairline" style={{ margin: '20px 0' }} />
        <p style={{ textAlign: 'center', fontSize: 13, color: '#6B7280', margin: 0 }}>
          {sw ? 'Una akaunti?' : 'Already have an account?'}{' '}
          <Link href="/auth/login" style={{ fontWeight: 700, color: '#1B3A6B', textDecoration: 'underline', textUnderlineOffset: 2 }}>
            {sw ? 'Ingia' : 'Sign In'}
          </Link>
        </p>
      </PageShell>
    );
  }

  // ── OTP ───────────────────────────────────────────────────────────────────
  if (step === 'otp') {
    return (
      <PageShell>
        <CrossWatermark />
        <LogoBlock sw={sw} />
        <StepDots />
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#EAF0F8', border: '2px solid #C5D5EA', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, marginBottom: 12 }}>✉️</div>
          <h2 style={{ margin: '0 0 6px', fontSize: 19, fontWeight: 700, color: '#111827' }}>
            {sw ? 'Ingiza Nambari ya Uthibitisho' : 'Enter Verification Code'}
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: '#6B7280', lineHeight: 1.6 }}>
            {sw ? 'Tumekutumia nambari ya tarakimu 6 kwenda' : 'We sent a 6-digit code to'}{' '}
            <strong style={{ color: '#1B3A6B' }}>{email}</strong>
          </p>
        </div>
        {error && <div style={{ marginBottom: 12 }}><ErrorBanner msg={error} /></div>}
        <div style={{ margin: '24px 0' }}>
          <OtpInput value={otpValue} onChange={v => { setOtpValue(v); setError(null); }} disabled={loading} />
        </div>
        {!otpExpired ? (
          <p style={{ textAlign: 'center', fontSize: 13, color: '#6B7280', margin: '0 0 20px' }}>
            {sw ? 'Inakwisha baada ya' : 'Expires in'}{' '}<Countdown seconds={600} onExpire={() => setOtpExpired(true)} />
          </p>
        ) : (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 20, textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 13, color: '#991B1B' }}>{sw ? 'Nambari imekwisha.' : 'Code expired.'}</p>
          </div>
        )}
        <button onClick={handleVerifyOtp} disabled={loading || otpValue.length < 6 || otpExpired} className="btn-primary w-full justify-center" style={{ marginBottom: 14 }}>
          {loading ? <Spinner label={sw ? 'Inathibitisha...' : 'Verifying…'} /> : (sw ? 'Thibitisha' : 'Verify Code')}
        </button>
        <div style={{ textAlign: 'center' }}>
          <button onClick={handleSendOtp} disabled={loading} style={{ background: 'none', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13, color: '#1B3A6B', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 2, padding: 0 }}>
            {sw ? 'Tuma tena nambari' : 'Resend code'}
          </button>
        </div>
        <button onClick={() => { setStep('email'); setError(null); setOtpValue(''); }} style={{ display: 'block', width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#9CA3AF', marginTop: 16, padding: 0 }}>
          ← {sw ? 'Badilisha barua pepe' : 'Change email'}
        </button>
      </PageShell>
    );
  }

  // ── PHOTO ─────────────────────────────────────────────────────────────────
  if (step === 'photo') {
    return (
      <PageShell>
        <CrossWatermark />
        <LogoBlock sw={sw} />
        <StepDots />
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: '0 0 6px', fontSize: 19, fontWeight: 700, color: '#111827' }}>
            {sw ? 'Pakia Picha Yako' : 'Upload Your Photo'}
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: '#6B7280', lineHeight: 1.6 }}>
            {sw
              ? 'Picha yako itasaidia viongozi wa kanisa kukuthibitisha haraka zaidi.'
              : 'Your photo helps church leaders verify your identity quickly.'}
          </p>
        </div>

        {error && <div style={{ marginBottom: 16 }}><ErrorBanner msg={error} /></div>}

        <PhotoPicker previewUrl={photoPreview} onFile={handlePhotoFile} uploading={uploading} uploadProgress={uploadProgress} sw={sw} />

        {photoUrl && !uploading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '9px 14px', marginTop: 16 }}>
            <span style={{ fontSize: 14 }}>✅</span>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#166534' }}>
              {sw ? 'Picha imepakiwa kikamilifu' : 'Photo uploaded successfully'}
            </p>
          </div>
        )}

        <button onClick={handlePhotoContinue} disabled={!photoUrl || uploading} className="btn-primary w-full justify-center" style={{ marginTop: 20 }}>
          {sw ? 'Endelea →' : 'Continue →'}
        </button>

        <button
          onClick={() => { setPhotoUrl(''); setStep('form'); setError(null); }}
          disabled={uploading}
          style={{ display: 'block', width: '100%', background: 'none', border: 'none', cursor: uploading ? 'not-allowed' : 'pointer', fontSize: 12, color: '#9CA3AF', marginTop: 12, padding: 0, textAlign: 'center' }}
        >
          {sw ? 'Ruka hatua hii kwa sasa' : 'Skip for now'}
        </button>
      </PageShell>
    );
  }

  // ── FORM ──────────────────────────────────────────────────────────────────
  return (
    <PageShell>
      <CrossWatermark />
      <LogoBlock sw={sw} />
      <StepDots />

      {/* Status pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 20, padding: '5px 12px' }}>
          <span style={{ fontSize: 12 }}>✅</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#166534' }}>{email}</span>
        </div>
        {photoUrl ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 20, padding: '4px 10px' }}>
            <img src={photoUrl} alt="" style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#166534' }}>{sw ? 'Picha ✓' : 'Photo ✓'}</span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FEF9EC', border: '1px solid #FDE68A', borderRadius: 20, padding: '5px 12px' }}>
            <span style={{ fontSize: 12 }}>📷</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#92400E' }}>{sw ? 'Picha imeachwa' : 'No photo'}</span>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 22 }}>
        <h2 style={{ margin: '0 0 3px', fontSize: 19, fontWeight: 700, color: '#111827' }}>
          {sw ? 'Kamilisha Usajili' : 'Complete Registration'}
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: '#6B7280' }}>
          {sw ? 'Jaza maelezo yako' : 'Fill in your details below'}
        </p>
      </div>

      <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && <ErrorBanner msg={error} />}
        <div>
          <label style={labelStyle}>{sw ? 'Jina Kamili' : 'Full Name'}</label>
          <input className="field-input" value={form.full_name} onChange={set('full_name')} placeholder={sw ? 'mfano: Yohana Mwangi' : 'e.g. John Mwangi'} required autoFocus />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>{sw ? 'Simu' : 'Phone'}</label>
            <input className="field-input" value={form.phone} onChange={set('phone')} placeholder="+255 712…" inputMode="tel" />
          </div>
          <div>
            <label style={labelStyle}>{sw ? 'Namba ya Usharika' : 'Member No.'}</label>
            <input className="field-input" value={form.namba_ya_usharika} onChange={set('namba_ya_usharika')} placeholder="KKKT-001" />
          </div>
        </div>
        <p style={{ margin: '-8px 0 0', fontSize: 11, color: '#9CA3AF' }}>
          {sw ? 'Namba ya usharika si lazima.' : 'Member number is optional.'}
        </p>
        <div>
          <label style={labelStyle}>{sw ? 'Nenosiri' : 'Password'}</label>
          <div style={{ position: 'relative' }}>
            <input className="field-input" type={showPass ? 'text' : 'password'} value={form.password} onChange={set('password')} placeholder="••••••••" required minLength={6} autoComplete="new-password" style={{ paddingRight: 44 }} />
            <button type="button" onClick={() => setShowPass(p => !p)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#9CA3AF', fontSize: 16, lineHeight: 1 }}>
              {showPass ? '🙈' : '👁️'}
            </button>
          </div>
          {form.password.length > 0 && form.password.length < 6 && (
            <p style={{ margin: '4px 0 0', fontSize: 11, color: '#991B1B' }}>
              {sw ? 'Herufi 6 au zaidi zinahitajika' : 'At least 6 characters required'}
            </p>
          )}
        </div>
        <button type="submit" disabled={loading || !form.full_name || !form.password} className="btn-primary w-full justify-center" style={{ marginTop: 4 }}>
          {loading ? <Spinner label={sw ? 'Inasajili...' : 'Creating account…'} /> : (sw ? 'Kamilisha Usajili' : 'Create Account')}
        </button>
      </form>

      <div className="hairline" style={{ margin: '20px 0' }} />
      <p style={{ textAlign: 'center', fontSize: 13, color: '#6B7280', margin: 0 }}>
        {sw ? 'Una akaunti?' : 'Already have an account?'}{' '}
        <Link href="/auth/login" style={{ fontWeight: 700, color: '#1B3A6B', textDecoration: 'underline', textUnderlineOffset: 2 }}>
          {sw ? 'Ingia' : 'Sign In'}
        </Link>
      </p>
    </PageShell>
  );
}

// ─── style constants ──────────────────────────────────────────────────────────
const labelStyle = { display: 'block', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 };

// ─── shared sub-components ────────────────────────────────────────────────────
function PageShell({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: '#EEE9DF', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#FDFCF9', borderRadius: 16, border: '1px solid #DDD8CE', boxShadow: '0 2px 16px rgba(27,58,107,0.07), 0 1px 3px rgba(27,58,107,0.04)', padding: '36px 32px', position: 'relative', overflow: 'hidden', animation: 'slideUp 0.35s cubic-bezier(0.16,1,0.3,1) both' }}>
        <style>{`
          @keyframes slideUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
          @keyframes spin    { to   { transform:rotate(360deg); } }
        `}</style>
        {children}
      </div>
    </div>
  );
}

function LogoBlock({ sw }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 24 }}>
      <img src="https://res.cloudinary.com/dcka18xuw/image/upload/v1775397623/luther_rb1fbu.webp" alt="KKKT Yombo DMP" style={{ width: 64, height: 64, objectFit: 'contain', marginBottom: 12 }} />
      <h1 style={{ margin: '0 0 3px', fontSize: 16, fontWeight: 800, color: '#1B3A6B', letterSpacing: '0.01em' }}>KKKT Yombo DMP</h1>
      <p style={{ margin: 0, fontSize: 11, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{sw ? 'Mfumo wa Kanisa' : 'Church Portal'}</p>
    </div>
  );
}

function ErrorBanner({ msg }) {
  return (
    <div style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #FECACA', background: '#FEF2F2', color: '#991B1B', fontSize: 13, lineHeight: 1.5 }}>
      {msg}
    </div>
  );
}

function Spinner({ label }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
      {label}
    </span>
  );
}