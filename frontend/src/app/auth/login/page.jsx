'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../hooks/useAuth';
import { useTranslation } from '../../../lib/i18n';

// ─── format local digits as "712 345 678" while typing ───────────────────────
function formatLocal(digits) {
  const d = digits.slice(0, 9);
  if (d.length <= 3) return d;
  if (d.length <= 6) return d.slice(0, 3) + ' ' + d.slice(3);
  return d.slice(0, 3) + ' ' + d.slice(3, 6) + ' ' + d.slice(6);
}

export default function LoginPage() {
  const { login, lang } = useAuth();
  const { t }           = useTranslation(lang);
  const router          = useRouter();
  const sw              = lang === 'sw';

  const [localDigits, setLocalDigits] = useState('');
  const [password,    setPassword]    = useState('');
  const [showPass,    setShowPass]    = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);

  // The full identifier sent to the backend: 255 + 9 local digits
  const fullPhone = localDigits.length === 9 ? '255' + localDigits : '';

  const handleLocalInput = (raw) => {
    let stripped = raw.replace(/\D/g, '');
    if (stripped.startsWith('255')) stripped = stripped.slice(3);
    if (stripped.startsWith('0'))   stripped = stripped.slice(1);
    setLocalDigits(stripped.slice(0, 9));
    setError(null);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(fullPhone, password);
      router.replace('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── cross watermark ──────────────────────────────────────────────────────
  const CrossWatermark = () => (
    <div aria-hidden style={{
      position: 'absolute', top: 0, right: 0,
      width: 220, height: 220, overflow: 'hidden',
      pointerEvents: 'none', opacity: 0.04,
    }}>
      <div style={{ position: 'absolute', top: 16, right: 80, width: 12, height: 120, background: '#1B3A6B', borderRadius: 3 }} />
      <div style={{ position: 'absolute', top: 58, right: 30, width: 100, height: 12, background: '#1B3A6B', borderRadius: 3 }} />
    </div>
  );

  return (
    <PageShell>
      <CrossWatermark />
      <LogoBlock sw={sw} />

      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {error && <ErrorBanner msg={error} />}

        {/* ── Phone number ── */}
        <div>
          <label style={styles.label}>
            {sw ? 'Nambari ya Simu' : 'Phone Number'}
          </label>
          <div style={styles.phoneWrap}>
            <div style={styles.countryBadge}>
              <span style={{ fontSize: 15, lineHeight: 1 }}>🇹🇿</span>
              <span style={styles.countryCode}>+255</span>
            </div>
            <div style={styles.phoneDivider} />
            <input
              type="tel"
              inputMode="numeric"
              value={formatLocal(localDigits)}
              onChange={e => handleLocalInput(e.target.value)}
              placeholder="712 345 678"
              autoFocus
              autoComplete="tel-national"
              required
              style={{
                border: 'none', background: 'transparent', flex: 1,
                padding: '0 14px 0 10px', fontSize: 15, fontWeight: 500,
                color: '#111827', outline: 'none', letterSpacing: '0.03em', height: '100%',
              }}
            />
            {localDigits.length > 0 && (
              <div style={{
                width: 7, height: 7, borderRadius: '50%', marginRight: 14, flexShrink: 0,
                background: localDigits.length === 9 ? '#16A34A' : '#E5E7EB',
                transition: 'background 200ms ease',
              }} />
            )}
          </div>
          {localDigits.length > 0 && localDigits.length < 9 && (
            <p style={{ margin: '4px 0 0', fontSize: 11, color: '#9CA3AF' }}>
              {sw
                ? `Tarakimu ${9 - localDigits.length} zaidi zinahitajika`
                : `${9 - localDigits.length} more digit${9 - localDigits.length !== 1 ? 's' : ''} needed`}
            </p>
          )}
        </div>

        {/* ── Password ── */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={{ ...styles.label, margin: 0 }}>
              {sw ? 'Nenosiri' : 'Password'}
            </label>
            <button
              type="button"
              onClick={() => router.push('/get-account')}
              style={styles.textBtn}
            >
              {sw ? 'Umesahau?' : 'Forgot?'}
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            <input
              className="field-input"
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              style={{ paddingRight: 44 }}
            />
            <EyeToggle show={showPass} onToggle={() => setShowPass(p => !p)} />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || localDigits.length !== 9 || !password}
          className="btn-primary w-full justify-center"
          style={{ marginTop: 2 }}
        >
          {loading
            ? <Spinner label={sw ? 'Inaingia...' : 'Signing in…'} />
            : (sw ? 'Ingia' : 'Sign In')}
        </button>
      </form>

      <div style={{ height: 1, background: '#E5E7EB', margin: '20px 0' }} />

      <p style={{ textAlign: 'center', fontSize: 13, color: '#6B7280', margin: 0 }}>
        {sw ? 'Huna akaunti?' : "Don't have an account?"}{' '}
        <Link
          href="/auth/register"
          style={{ fontWeight: 700, color: '#1B3A6B', textDecoration: 'underline', textUnderlineOffset: 2 }}
        >
          {sw ? 'Jisajili' : 'Register'}
        </Link>
      </p>

      <details style={{ marginTop: 20 }}>
        <summary style={{
          fontSize: 11, fontWeight: 700, color: '#9CA3AF',
          textTransform: 'uppercase', letterSpacing: '0.06em',
          cursor: 'pointer', userSelect: 'none', listStyle: 'none', textAlign: 'center',
        }}>
          {sw ? '▾ Akaunti za Majaribio' : '▾ Demo Accounts'}
        </summary>
        <div style={{
          marginTop: 12, padding: '14px 16px',
          background: '#F5F0E8', borderRadius: 8, border: '1px solid #E8DFC8',
        }}>
          <div style={{ display: 'grid', gap: 4, fontFamily: 'monospace', fontSize: 11, color: '#6B7280' }}>
            {[
              ['711000001', 'pastor123', 'Mchungaji'],
              ['722000002', 'elder123',  'Mzee'],
              ['711000003', 'choir123',  'Kwaya'],
              ['733000004', 'member123', 'Mwanakamati'],
            ].map(([digits, pass, role]) => (
              <button
                key={digits}
                type="button"
                onClick={() => { setLocalDigits(digits); setPassword(pass); }}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr auto auto',
                  gap: 8, alignItems: 'center',
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '6px 4px', borderRadius: 4, textAlign: 'left',
                  color: '#6B7280', fontFamily: 'monospace', fontSize: 11,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#EDE8D8'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <span style={{ color: '#374151', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>🇹🇿</span>
                  <span>+255 {formatLocal(digits)}</span>
                </span>
                <span>{pass}</span>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: '#1B3A6B',
                  background: '#D1DCF0', borderRadius: 4, padding: '1px 6px',
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  {role}
                </span>
              </button>
            ))}
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 10, color: '#9CA3AF', textAlign: 'center' }}>
            {sw ? 'Bonyeza mstari ili ujaze fomu otomatiki' : 'Click a row to auto-fill'}
          </p>
        </div>
      </details>
    </PageShell>
  );
}

// ─── shared styles ────────────────────────────────────────────────────────────
const styles = {
  label: {
    display: 'block', fontSize: 12, fontWeight: 600,
    color: '#374151', marginBottom: 6, letterSpacing: '0.02em',
  },
  textBtn: {
    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
    fontSize: 12, color: '#1B3A6B', fontWeight: 600,
    textDecoration: 'underline', textUnderlineOffset: 2,
  },
  phoneWrap: {
    display: 'flex', alignItems: 'center', height: 44,
    border: '1.5px solid #DDD8CE', borderRadius: 8,
    background: '#FDFCF9', overflow: 'hidden',
    transition: 'border-color 150ms ease',
  },
  countryBadge: {
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '0 10px 0 12px', flexShrink: 0,
  },
  countryCode: {
    fontSize: 13, fontWeight: 700, color: '#1B3A6B', letterSpacing: '0.01em',
  },
  phoneDivider: {
    width: 1, height: 22, background: '#DDD8CE', flexShrink: 0,
  },
};

// ─── sub-components ───────────────────────────────────────────────────────────

function PageShell({ children }) {
  return (
    <div style={{
      minHeight: '100vh', background: '#EEE9DF',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px',
    }}>
      <div style={{
        width: '100%', maxWidth: 400,
        background: '#FDFCF9', borderRadius: 16,
        border: '1px solid #DDD8CE',
        boxShadow: '0 2px 16px rgba(27,58,107,0.07), 0 1px 3px rgba(27,58,107,0.04)',
        padding: '36px 32px', position: 'relative', overflow: 'hidden',
        animation: 'slideUp 0.35s cubic-bezier(0.16,1,0.3,1) both',
      }}>
        <style>{`
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(18px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
        {children}
      </div>
    </div>
  );
}

function LogoBlock({ sw }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 28 }}>
      <img
        src="https://res.cloudinary.com/dcka18xuw/image/upload/v1775397623/luther_rb1fbu.webp"
        alt="KKKT Yombo DMP"
        style={{ width: 72, height: 72, objectFit: 'contain', marginBottom: 14 }}
      />
      <h1 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800, color: '#1B3A6B', letterSpacing: '0.01em' }}>
        KKKT Yombo DMP
      </h1>
      <p style={{ margin: 0, fontSize: 11, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {sw ? 'KKKT DMP YOMBO' : 'KKKT YOMBO DMP'}
      </p>
    </div>
  );
}

function ErrorBanner({ msg }) {
  return (
    <div style={{
      padding: '10px 14px', borderRadius: 8,
      border: '1px solid #FECACA', background: '#FEF2F2',
      color: '#991B1B', fontSize: 13, lineHeight: 1.5,
    }}>
      {msg}
    </div>
  );
}

function Spinner({ label }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{
        width: 14, height: 14,
        border: '2px solid rgba(255,255,255,0.35)',
        borderTopColor: '#fff', borderRadius: '50%',
        display: 'inline-block',
        animation: 'spin 0.7s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {label}
    </span>
  );
}

function EyeToggle({ show, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={show ? 'Hide password' : 'Show password'}
      style={{
        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
        background: 'none', border: 'none', cursor: 'pointer', padding: 4,
        color: '#9CA3AF', lineHeight: 1, display: 'flex', alignItems: 'center',
      }}
    >
      {show ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
          <path d="M14.12 14.12A3 3 0 1 1 9.88 9.88" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  );
}