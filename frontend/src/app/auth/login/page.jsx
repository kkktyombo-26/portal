'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../hooks/useAuth';
import { useTranslation } from '../../../lib/i18n';

// ─── identifier type detection ────────────────────────────
function detectIdentifierType(value) {
  const trimmed = value.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'email';
  if (/^[\d\s\-\+\(\)]{7,}$/.test(trimmed))        return 'phone';
  if (/^[A-Z0-9]{3,12}$/i.test(trimmed))            return 'memberNo';
  return 'unknown';
}

const IDENTIFIER_HINTS = {
  sw: {
    email:    'Barua pepe',
    phone:    'Nambari ya simu',
    memberNo: 'Nambari ya usharika',
    unknown:  'Ingiza kitambulisho',
  },
  en: {
    email:    'Email address',
    phone:    'Phone number',
    memberNo: 'Membership number',
    unknown:  'Enter identifier',
  },
};

// ─── all views in the flow ────────────────────────────────
const VIEW = {
  LOGIN:          'login',
  FORGOT:         'forgot',
  VERIFY_OTP:     'verify_otp',
  RESET_PASSWORD: 'reset_password',
  RESET_DONE:     'reset_done',
};

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// ─── helper: extract error message from any response shape ─
function extractError(data, fallback = 'Request failed') {
  return (
    data?.message ??
    data?.error ??
    data?.errors?.[0]?.message ??
    fallback
  );
}

export default function LoginPage() {
  const { login, lang } = useAuth();
  const { t } = useTranslation(lang);
  const router = useRouter();
  const sw = lang === 'sw';

  // ── login form ──────────────────────────────────────────
  const [identifier, setIdentifier] = useState('');
  const [password,   setPassword]   = useState('');
  const [showPass,   setShowPass]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);

  // ── forgot-password flow state ──────────────────────────
  const [view,          setView]          = useState(VIEW.LOGIN);
  const [forgotId,      setForgotId]      = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError,   setForgotError]   = useState(null);

  // ── OTP verify state ────────────────────────────────────
  const [otp,        setOtp]        = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError,   setOtpError]   = useState(null);
  const [resetToken, setResetToken] = useState('');

  // ── reset password state ────────────────────────────────
  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPass,     setShowNewPass]     = useState(false);
  const [resetLoading,    setResetLoading]    = useState(false);
  const [resetError,      setResetError]      = useState(null);

  const idType    = detectIdentifierType(identifier);
  const idTypeKey = ['email','phone','memberNo'].includes(idType) ? idType : 'unknown';
  const hint      = IDENTIFIER_HINTS[lang]?.[idTypeKey] ?? IDENTIFIER_HINTS.en[idTypeKey];

  // ── helper: go back to login, clear everything ──────────
  const backToLogin = () => {
    setView(VIEW.LOGIN);
    setForgotId(''); setForgotError(null);
    setOtp('');      setOtpError(null);
    setNewPassword(''); setConfirmPassword(''); setResetError(null);
    setResetToken('');
  };

  // ── login submit ────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      await login(identifier.trim(), password);
      router.replace('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── step 1: request OTP ─────────────────────────────────
const handleForgot = async (e) => {
  e.preventDefault();
  setForgotLoading(true);
  setForgotError(null);
  try {
    const res  = await fetch(`${API_URL}/auth/forgot-password`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ identifier: forgotId.trim() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(extractError(data));

    // ✅ Only advance if the backend actually sent an OTP
    if (data.sent) {
      setView(VIEW.VERIFY_OTP);
    } else {
      // Account not found — show a neutral message that doesn't confirm/deny
      setForgotError(
        sw
          ? 'Hakuna akaunti inayolingana. Angalia tena au jisajili.'
          : 'No account matched. Double-check your details or register.'
      );
    }
  } catch (err) {
    setForgotError(err.message);
  } finally {
    setForgotLoading(false);
  }
};

  // ── step 2: verify OTP ──────────────────────────────────
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setOtpLoading(true);
    setOtpError(null);
    try {
      const res  = await fetch(`${API_URL}/auth/verify-otp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ identifier: forgotId.trim(), otp: otp.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(extractError(data,
        sw ? 'Nambari si sahihi au imekwisha muda.' : 'Invalid or expired OTP.'
      ));
      setResetToken(data.resetToken);
      setView(VIEW.RESET_PASSWORD);
    } catch (err) {
      setOtpError(err.message);
    } finally {
      setOtpLoading(false);
    }
  };

  // ── step 3: reset password ──────────────────────────────
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setResetError(sw ? 'Manenosiri hayafanani.' : 'Passwords do not match.');
      return;
    }
    setResetLoading(true);
    setResetError(null);
    try {
      const res  = await fetch(`${API_URL}/auth/reset-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ resetToken, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(extractError(data));
      setView(VIEW.RESET_DONE);
    } catch (err) {
      setResetError(err.message);
    } finally {
      setResetLoading(false);
    }
  };

  // ─── decorative cross watermark ──────────────────────
  const CrossWatermark = () => (
    <div aria-hidden style={{
      position:'absolute', top:0, right:0,
      width:220, height:220, overflow:'hidden',
      pointerEvents:'none', opacity:0.04,
    }}>
      <div style={{ position:'absolute', top:16, right:80, width:12, height:120, background:'#1B3A6B', borderRadius:3 }} />
      <div style={{ position:'absolute', top:58, right:30, width:100, height:12,  background:'#1B3A6B', borderRadius:3 }} />
    </div>
  );

  // ═══════════════════════════════════════════════════════
  // VIEW: PASSWORD RESET SUCCESS
  // ═══════════════════════════════════════════════════════
  if (view === VIEW.RESET_DONE) {
    return (
      <PageShell>
        <CrossWatermark />
        <LogoBlock sw={sw} />
        <div style={{
          background:'#F0FDF4', border:'1px solid #BBF7D0',
          borderRadius:12, padding:'28px 24px', textAlign:'center', marginTop:8,
        }}>
          <div style={{fontSize:36, marginBottom:12}}>✅</div>
          <h2 style={{margin:'0 0 8px', fontSize:18, fontWeight:700, color:'#15803D'}}>
            {sw ? 'Nenosiri Limebadilishwa!' : 'Password Reset!'}
          </h2>
          <p style={{margin:0, fontSize:14, color:'#4B5563', lineHeight:1.6}}>
            {sw
              ? 'Nenosiri lako limewekwa upya. Unaweza sasa kuingia.'
              : 'Your password has been reset. You can now sign in.'}
          </p>
        </div>
        <button onClick={backToLogin} className="btn-primary w-full justify-center" style={{marginTop:16}}>
          {sw ? 'Ingia Sasa' : 'Sign In Now'}
        </button>
      </PageShell>
    );
  }

  // ═══════════════════════════════════════════════════════
  // VIEW: SET NEW PASSWORD
  // ═══════════════════════════════════════════════════════
  if (view === VIEW.RESET_PASSWORD) {
    return (
      <PageShell>
        <CrossWatermark />
        <LogoBlock sw={sw} />

        <div style={{marginBottom:24}}>
          <h2 style={{margin:'0 0 4px', fontSize:20, fontWeight:700, color:'#111827'}}>
            {sw ? 'Weka Nenosiri Jipya' : 'Set New Password'}
          </h2>
          <p style={{margin:0, fontSize:13, color:'#6B7280'}}>
            {sw
              ? 'Chagua nenosiri salama la angalau herufi 6.'
              : 'Choose a secure password of at least 6 characters.'}
          </p>
        </div>

        <form onSubmit={handleResetPassword} style={{display:'flex', flexDirection:'column', gap:16}}>
          {resetError && <ErrorBanner msg={resetError} />}

          <div>
            <label className="field-label">{sw ? 'Nenosiri Jipya' : 'New Password'}</label>
            <div style={{position:'relative'}}>
              <input
                className="field-input"
                type={showNewPass ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                required
                autoFocus
                style={{paddingRight:44}}
              />
              <button
                type="button"
                onClick={() => setShowNewPass(p => !p)}
                aria-label={showNewPass ? 'Hide' : 'Show'}
                style={{
                  position:'absolute', right:12, top:'50%', transform:'translateY(-50%)',
                  background:'none', border:'none', cursor:'pointer', padding:4,
                  color:'#9CA3AF', fontSize:16, lineHeight:1,
                }}
              >
                {showNewPass ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div>
            <label className="field-label">{sw ? 'Thibitisha Nenosiri' : 'Confirm Password'}</label>
            <input
              className="field-input"
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              required
            />
            {confirmPassword.length > 0 && (
              <p style={{
                margin:'4px 0 0', fontSize:11, fontWeight:600,
                color: newPassword === confirmPassword ? '#15803D' : '#DC2626',
              }}>
                {newPassword === confirmPassword
                  ? (sw ? '✓ Yanafanana' : '✓ Passwords match')
                  : (sw ? '✗ Hayafanani' : '✗ Passwords do not match')}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={resetLoading || newPassword.length < 6 || newPassword !== confirmPassword}
            className="btn-primary w-full justify-center"
          >
            {resetLoading
              ? <Spinner label={sw ? 'Inabadilisha...' : 'Resetting...'} />
              : (sw ? 'Badilisha Nenosiri' : 'Reset Password')}
          </button>
        </form>
      </PageShell>
    );
  }

  // ═══════════════════════════════════════════════════════
  // VIEW: VERIFY OTP
  // ═══════════════════════════════════════════════════════
  if (view === VIEW.VERIFY_OTP) {
    return (
      <PageShell>
        <CrossWatermark />
        <LogoBlock sw={sw} />

        <div style={{
          background:'#EAF0F8', border:'1px solid #C5D5EA',
          borderRadius:12, padding:'16px 20px', marginBottom:24,
        }}>
          <p style={{margin:0, fontSize:13, color:'#1B3A6B', lineHeight:1.6}}>
            <span style={{fontSize:20, marginRight:8}}>📩</span>
            {sw ? 'Tumetuma nambari ya 6 kwa: ' : 'We sent a 6-digit code to: '}
            <strong>{forgotId}</strong>
          </p>
        </div>

        <div style={{marginBottom:20}}>
          <h2 style={{margin:'0 0 4px', fontSize:20, fontWeight:700, color:'#111827'}}>
            {sw ? 'Ingiza Nambari ya OTP' : 'Enter OTP Code'}
          </h2>
          <p style={{margin:0, fontSize:13, color:'#6B7280'}}>
            {sw ? 'Nambari itakwisha kwa dakika 10.' : 'The code expires in 10 minutes.'}
          </p>
        </div>

        <form onSubmit={handleVerifyOtp} style={{display:'flex', flexDirection:'column', gap:16}}>
          {otpError && <ErrorBanner msg={otpError} />}

          <div>
            <label className="field-label">
              {sw ? 'Nambari ya OTP (tarakimu 6)' : 'OTP Code (6 digits)'}
            </label>
            <input
              className="field-input"
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              inputMode="numeric"
              maxLength={6}
              required
              autoFocus
              style={{
                fontSize:24, letterSpacing:'0.3em', textAlign:'center',
                fontFamily:'monospace', fontWeight:700,
              }}
            />
          </div>

          <button
            type="submit"
            disabled={otpLoading || otp.length !== 6}
            className="btn-primary w-full justify-center"
          >
            {otpLoading
              ? <Spinner label={sw ? 'Inathibitisha...' : 'Verifying...'} />
              : (sw ? 'Thibitisha Nambari' : 'Verify Code')}
          </button>
        </form>

        <div className="hairline" style={{margin:'20px 0'}} />

        <p style={{textAlign:'center', fontSize:13, color:'#6B7280', margin:'0 0 12px'}}>
          {sw ? 'Hukupokea nambari?' : "Didn't receive the code?"}{' '}
          <button
            type="button"
            onClick={() => { setOtp(''); setOtpError(null); setView(VIEW.FORGOT); }}
            style={{
              background:'none', border:'none', cursor:'pointer',
              color:'#1B3A6B', fontWeight:700, fontSize:13,
              textDecoration:'underline', textUnderlineOffset:2, padding:0,
            }}
          >
            {sw ? 'Tuma tena' : 'Resend'}
          </button>
        </p>

        <button onClick={backToLogin} className="btn-ghost w-full justify-center">
          ← {sw ? 'Rudi Kuingia' : 'Back to Login'}
        </button>
      </PageShell>
    );
  }

  // ═══════════════════════════════════════════════════════
  // VIEW: FORGOT PASSWORD (enter identifier)
  // ═══════════════════════════════════════════════════════
  if (view === VIEW.FORGOT) {
    return (
      <PageShell>
        <CrossWatermark />
        <LogoBlock sw={sw} />

        <div style={{marginBottom:24}}>
          <h2 style={{margin:'0 0 4px', fontSize:20, fontWeight:700, color:'#111827'}}>
            {sw ? 'Umesahau Nenosiri?' : 'Forgot Password?'}
          </h2>
          <p style={{margin:0, fontSize:13, color:'#6B7280'}}>
            {sw
              ? 'Ingiza barua pepe, simu, au nambari ya usharika. Tutatuma nambari ya kubadilisha nenosiri.'
              : "Enter your email, phone, or membership number. We'll send a 6-digit reset code."}
          </p>
        </div>

        <form onSubmit={handleForgot} style={{display:'flex', flexDirection:'column', gap:16}}>
          {forgotError && <ErrorBanner msg={forgotError} />}
          <div>
            <label className="field-label">
              {sw ? 'Barua Pepe / Simu / Nambari' : 'Email / Phone / Member No.'}
            </label>
            <input
              className="field-input"
              value={forgotId}
              onChange={e => setForgotId(e.target.value)}
              placeholder={sw ? 'mfano: +255712345678' : 'e.g. pastor@church.com'}
              required
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={forgotLoading || !forgotId.trim()}
            className="btn-primary w-full justify-center"
          >
            {forgotLoading
              ? <Spinner label={sw ? 'Inatuma...' : 'Sending...'} />
              : (sw ? 'Tuma Nambari' : 'Send Reset Code')}
          </button>
        </form>

        <div className="hairline" style={{margin:'20px 0'}} />

        <button onClick={backToLogin} className="btn-ghost w-full justify-center">
          ← {sw ? 'Rudi Kuingia' : 'Back to Login'}
        </button>
      </PageShell>
    );
  }

  // ═══════════════════════════════════════════════════════
  // VIEW: MAIN LOGIN
  // ═══════════════════════════════════════════════════════
  return (
    <PageShell>
      <CrossWatermark />
      <LogoBlock sw={sw} />

      {identifier.trim().length > 2 && (
        <div style={{
          display:'inline-flex', alignItems:'center', gap:6,
          padding:'3px 10px', borderRadius:20,
          background: idTypeKey === 'unknown' ? '#FEF3C7' : '#EAF0F8',
          border: `1px solid ${idTypeKey === 'unknown' ? '#FDE68A' : '#C5D5EA'}`,
          fontSize:11, fontWeight:600, letterSpacing:'0.04em',
          color: idTypeKey === 'unknown' ? '#92400E' : '#1B3A6B',
          textTransform:'uppercase', marginBottom:12, transition:'all 0.2s',
        }}>
          <span style={{fontSize:13}}>
            { idTypeKey === 'email'    ? '✉️'
            : idTypeKey === 'phone'    ? '📱'
            : idTypeKey === 'memberNo' ? '🪪'
            : '❓' }
          </span>
          {hint}
        </div>
      )}

      <form onSubmit={handleLogin} style={{display:'flex', flexDirection:'column', gap:16}}>
        {error && <ErrorBanner msg={error} />}

        <div>
          <label className="field-label">
            {sw ? 'Barua Pepe / Simu / Nambari ya Usharika' : 'Email / Phone / Membership No.'}
          </label>
          <input
            className="field-input"
            value={identifier}
            onChange={e => setIdentifier(e.target.value)}
            placeholder={sw ? 'mfano: +255712… au KKKT-001' : 'e.g. pastor@church.com or +255712…'}
            required
            autoFocus
            autoComplete="username"
          />
        </div>

        <div>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6}}>
            <label className="field-label" style={{margin:0}}>
              {sw ? 'Nenosiri' : 'Password'}
            </label>
            <button
              type="button"
              onClick={() => setView(VIEW.FORGOT)}
              style={{
                background:'none', border:'none', padding:0, cursor:'pointer',
                fontSize:12, color:'#1B3A6B', fontWeight:600,
                textDecoration:'underline', textUnderlineOffset:2,
              }}
            >
              {sw ? 'Umesahau?' : 'Forgot?'}
            </button>
          </div>
          <div style={{position:'relative'}}>
            <input
              className="field-input"
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              style={{paddingRight:44}}
            />
            <button
              type="button"
              onClick={() => setShowPass(p => !p)}
              aria-label={showPass ? 'Hide password' : 'Show password'}
              style={{
                position:'absolute', right:12, top:'50%', transform:'translateY(-50%)',
                background:'none', border:'none', cursor:'pointer', padding:4,
                color:'#9CA3AF', fontSize:16, lineHeight:1,
              }}
            >
              {showPass ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !identifier.trim() || !password}
          className="btn-primary w-full justify-center"
          style={{marginTop:4}}
        >
          {loading
            ? <Spinner label={sw ? 'Inaingia...' : 'Signing in…'} />
            : (sw ? 'Ingia' : 'Sign In')}
        </button>
      </form>

      <div className="hairline" style={{margin:'20px 0'}} />

      <p style={{textAlign:'center', fontSize:13, color:'#6B7280', margin:0}}>
        {sw ? 'Huna akaunti?' : "Don't have an account?"}{' '}
        <Link
          href="/auth/register"
          style={{fontWeight:700, color:'#1B3A6B', textDecoration:'underline', textUnderlineOffset:2}}
        >
          {sw ? 'Jisajili' : 'Register'}
        </Link>
      </p>

      <details style={{marginTop:20}}>
        <summary style={{
          fontSize:11, fontWeight:700, color:'#9CA3AF',
          textTransform:'uppercase', letterSpacing:'0.06em',
          cursor:'pointer', userSelect:'none', listStyle:'none', textAlign:'center',
        }}>
          {sw ? '▾ Akaunti za Majaribio' : '▾ Demo Accounts'}
        </summary>
        <div style={{
          marginTop:12, padding:'14px 16px',
          background:'#F5F0E8', borderRadius:8, border:'1px solid #E8DFC8',
        }}>
          <div style={{display:'grid', gap:4, fontFamily:'monospace', fontSize:11, color:'#6B7280'}}>
            {[
              ['pastor@church.com', 'pastor123', 'Mchungaji'],
              ['elder@church.com',  'elder123',  'Mzee'],
              ['+255711000001',     'choir123',  'Kwaya'],
              ['KKKT-0042',         'member123', 'Mwanakamati'],
            ].map(([id, pass, role]) => (
              <button
                key={id}
                type="button"
                onClick={() => { setIdentifier(id); setPassword(pass); }}
                style={{
                  display:'grid', gridTemplateColumns:'1fr auto auto',
                  gap:8, alignItems:'center',
                  background:'none', border:'none', cursor:'pointer',
                  padding:'6px 4px', borderRadius:4, textAlign:'left',
                  color:'#6B7280', fontFamily:'monospace', fontSize:11,
                  transition:'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background='#EDE8D8'}
                onMouseLeave={e => e.currentTarget.style.background='none'}
              >
                <span style={{color:'#374151', fontWeight:600}}>{id}</span>
                <span>{pass}</span>
                <span style={{
                  fontSize:10, fontWeight:700, color:'#1B3A6B',
                  background:'#D1DCF0', borderRadius:4, padding:'1px 6px',
                  textTransform:'uppercase', letterSpacing:'0.04em',
                }}>
                  {role}
                </span>
              </button>
            ))}
          </div>
          <p style={{margin:'8px 0 0', fontSize:10, color:'#9CA3AF', textAlign:'center'}}>
            {sw ? 'Bonyeza mstari ili ujaze fomu otomatiki' : 'Click a row to auto-fill'}
          </p>
        </div>
      </details>
    </PageShell>
  );
}

// ─── shared sub-components ────────────────────────────────

function PageShell({ children }) {
  return (
    <div style={{
      minHeight:'100vh', background:'#EEE9DF',
      display:'flex', alignItems:'center', justifyContent:'center',
      padding:'24px 16px',
    }}>
      <div style={{
        width:'100%', maxWidth:400,
        background:'#FDFCF9', borderRadius:16,
        border:'1px solid #DDD8CE',
        boxShadow:'0 2px 16px rgba(27,58,107,0.07), 0 1px 3px rgba(27,58,107,0.04)',
        padding:'36px 32px', position:'relative', overflow:'hidden',
        animation:'slideUp 0.35s cubic-bezier(0.16,1,0.3,1) both',
      }}>
        <style>{`
          @keyframes slideUp {
            from { opacity:0; transform:translateY(18px); }
            to   { opacity:1; transform:translateY(0); }
          }
        `}</style>
        {children}
      </div>
    </div>
  );
}

function LogoBlock({ sw }) {
  return (
    <div style={{textAlign:'center', marginBottom:28}}>
      <img
        src="https://res.cloudinary.com/dcka18xuw/image/upload/v1775397623/luther_rb1fbu.webp"
        alt="KKKT Yombo DMP"
        style={{width:72, height:72, objectFit:'contain', marginBottom:14}}
      />
      <h1 style={{margin:'0 0 4px', fontSize:17, fontWeight:800, color:'#1B3A6B', letterSpacing:'0.01em'}}>
        KKKT Yombo DMP
      </h1>
      <p style={{margin:0, fontSize:11, color:'#9CA3AF', letterSpacing:'0.06em', textTransform:'uppercase'}}>
        {sw ? 'Mfumo wa Kanisa' : 'Church Portal'}
      </p>
    </div>
  );
}

function ErrorBanner({ msg }) {
  return (
    <div style={{
      padding:'10px 14px', borderRadius:8,
      border:'1px solid #FECACA', background:'#FEF2F2',
      color:'#991B1B', fontSize:13, lineHeight:1.5,
    }}>
      {msg}
    </div>
  );
}

function Spinner({ label }) {
  return (
    <span style={{display:'flex', alignItems:'center', gap:8}}>
      <span style={{
        width:14, height:14,
        border:'2px solid rgba(255,255,255,0.35)',
        borderTopColor:'#fff', borderRadius:'50%',
        display:'inline-block',
        animation:'spin 0.7s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
      {label}
    </span>
  );
}