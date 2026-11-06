'use client';
/**
 * components/auth/PhoneLogin.jsx
 * ───────────────────────────────
 * Passwordless phone OTP login — NextSMS backend.
 * Corporate minimalist, responsive, no icons/emojis.
 */

import { useState, useRef, useEffect } from 'react';
import { authApi } from '../../lib/api';
import { setAuth } from '../../lib/auth';

const OTP_TTL_MINUTES = 5;
const RESEND_COOLDOWN = 60;

// ═══════════════════════════════════════════════════════════════════════════
// 6-digit OTP input — underline-only style
// ═══════════════════════════════════════════════════════════════════════════
function OTPBoxes({ value, onChange, disabled }) {
  const refs   = useRef([]);
  const digits = (value + '      ').slice(0, 6).split('');

  function handleInput(i, e) {
    const ch   = e.target.value.replace(/\D/g, '').slice(-1);
    const next = digits.map((d, j) => (j === i ? ch : d)).join('').trimEnd();
    onChange(next);
    if (ch && i < 5) refs.current[i + 1]?.focus();
  }

  function handleKeyDown(i, e) {
    if (e.key === 'Backspace' && !digits[i].trim() && i > 0) {
      refs.current[i - 1]?.focus();
    }
  }

  function handlePaste(e) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(pasted);
    setTimeout(() => refs.current[Math.min(pasted.length, 5)]?.focus(), 0);
    e.preventDefault();
  }

  return (
    <div className="flex gap-3 justify-center mb-8">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={el => (refs.current[i] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d.trim()}
          onChange={e => handleInput(i, e)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={handlePaste}
          disabled={disabled}
          autoFocus={i === 0 && !disabled}
          style={{
            width: '2.75rem',
            height: '3.25rem',
            textAlign: 'center',
            fontSize: '1.375rem',
            fontWeight: 600,
            background: 'transparent',
            border: 'none',
            borderBottom: `2px solid ${d.trim() ? 'var(--text-primary)' : 'var(--border, #d1d5db)'}`,
            outline: 'none',
            borderRadius: 0,
            color: 'var(--text-primary)',
            transition: 'border-color 120ms ease',
            cursor: disabled ? 'not-allowed' : 'text',
            opacity: disabled ? 0.5 : 1,
          }}
          onFocus={e => {
            if (!disabled) e.target.style.borderBottomColor = 'var(--text-primary)';
          }}
          onBlur={e => {
            e.target.style.borderBottomColor =
              d.trim() ? 'var(--text-primary)' : 'var(--border, #d1d5db)';
          }}
        />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════════════════════
export default function PhoneLogin({ onSuccess }) {
  const [step,      setStep]      = useState('phone');
  const [phone,     setPhone]     = useState('');
  const [otp,       setOtp]       = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  useEffect(() => {
    if (step === 'otp' && otp.length === 6 && !loading) handleVerify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  async function requestOTP(phone) {
    return authApi.requestPhoneOTP({ phone });
  }

  async function verifyOTP(phone, otp) {
    return authApi.verifyPhoneOTP({ phone, otp });
  }

  async function handleRequest(e) {
    e?.preventDefault();
    if (!phone.trim()) { setError('Tafadhali weka nambari ya simu.'); return; }
    setError('');
    setLoading(true);
    try {
      await requestOTP(phone.trim());
      setStep('otp');
      setCountdown(RESEND_COOLDOWN);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e) {
    e?.preventDefault();
    if (otp.length !== 6) { setError('Tafadhali weka nambari zote 6.'); return; }
    setError('');
    setLoading(true);
    try {
      const res  = await verifyOTP(phone.trim(), otp);
      const data = res.data;
      setAuth(data.token, data.user);
      onSuccess?.(data.token, data.user);
    } catch (err) {
      setError(err.message);
      setOtp('');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (countdown > 0 || loading) return;
    setOtp('');
    setError('');
    setLoading(true);
    try {
      await requestOTP(phone.trim());
      setCountdown(RESEND_COOLDOWN);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Layout shell ──────────────────────────────────────────────────────────
  const Wrap = ({ children }) => (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{
        background: 'var(--surface-page)',
        padding: 'clamp(1.5rem, 5vw, 3rem) 1rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '26rem',          // ~416 px — comfortable on mobile, not wide on desktop
          padding: 'clamp(2rem, 6vw, 3rem) clamp(1.5rem, 5vw, 2.5rem)',
          background: 'var(--surface-card, #ffffff)',
          borderRadius: '2px',        // near-sharp — deliberately non-rounded for corporate feel
          border: '1px solid var(--border, #e5e7eb)',
        }}
      >
        {children}
      </div>
    </div>
  );

  // ── STEP: phone entry ──────────────────────────────────────────────────────
  if (step === 'phone') {
    return (
      <Wrap>
        {/* Wordmark / org label */}
        <p
          style={{
            fontSize: '0.6875rem',
            fontWeight: 600,
            letterSpacing: '0.12em',
            color: 'var(--text-tertiary)',
            textTransform: 'uppercase',
            marginBottom: '2rem',
          }}
        >
          Kanisa la KKKT
        </p>

        <div style={{ marginBottom: '2rem' }}>
          <h1
            className="font-display"
            style={{
              fontSize: 'clamp(1.25rem, 4vw, 1.5rem)',
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              marginBottom: '0.5rem',
            }}
          >
            Ingia kwa nambari ya simu
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', margin: 0 }}>
            Utapokea nambari ya uthibitisho kwa SMS.
          </p>
        </div>

        {/* Thin rule — the one decorative gesture */}
        <div
          style={{
            height: '1px',
            background: 'var(--border, #e5e7eb)',
            marginBottom: '2rem',
          }}
        />

        <form onSubmit={handleRequest} noValidate>
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label
              className="form-label"
              htmlFor="phone-input"
              style={{ fontSize: '0.8125rem', fontWeight: 500 }}
            >
              Nambari ya simu
            </label>
            <input
              id="phone-input"
              className="input"
              type="tel"
              placeholder="0712 345 678"
              value={phone}
              onChange={e => { setPhone(e.target.value); setError(''); }}
              autoFocus
              autoComplete="tel"
              required
              style={{ borderRadius: '2px' }}
            />
          </div>

          {error && (
            <div
              className="banner banner-danger"
              role="alert"
              style={{
                fontSize: '0.8125rem',
                padding: '0.625rem 0.75rem',
                borderRadius: '2px',
                marginBottom: '1.25rem',
              }}
            >
              {error}
            </div>
          )}

          <button
            className="btn btn-primary w-full"
            type="submit"
            disabled={loading}
            style={{
              borderRadius: '2px',
              fontWeight: 600,
              fontSize: '0.9375rem',
              height: '2.75rem',
            }}
          >
            {loading ? <><Spinner /> Inatuma…</> : 'Tuma nambari ya uthibitisho'}
          </button>
        </form>
      </Wrap>
    );
  }

  // ── STEP: OTP entry ────────────────────────────────────────────────────────
  return (
    <Wrap>
      {/* Wordmark */}
      <p
        style={{
          fontSize: '0.6875rem',
          fontWeight: 600,
          letterSpacing: '0.12em',
          color: 'var(--text-tertiary)',
          textTransform: 'uppercase',
          marginBottom: '2rem',
        }}
      >
        Kanisa la KKKT
      </p>

      <div style={{ marginBottom: '2rem' }}>
        <h1
          className="font-display"
          style={{
            fontSize: 'clamp(1.25rem, 4vw, 1.5rem)',
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
            marginBottom: '0.5rem',
          }}
        >
          Weka nambari ya uthibitisho
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', margin: 0 }}>
          Imetumwa kwa{' '}
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{phone}</span>
          {' '}— inaisha baada ya dakika {OTP_TTL_MINUTES}.
        </p>
      </div>

      <div
        style={{
          height: '1px',
          background: 'var(--border, #e5e7eb)',
          marginBottom: '2rem',
        }}
      />

      <form onSubmit={handleVerify} noValidate>
        <OTPBoxes
          value={otp}
          onChange={v => { setOtp(v); setError(''); }}
          disabled={loading}
        />

        {error && (
          <div
            className="banner banner-danger"
            role="alert"
            style={{
              fontSize: '0.8125rem',
              padding: '0.625rem 0.75rem',
              borderRadius: '2px',
              marginBottom: '1.25rem',
            }}
          >
            {error}
          </div>
        )}

        <button
          className="btn btn-primary w-full"
          type="submit"
          disabled={loading || otp.length !== 6}
          style={{
            borderRadius: '2px',
            fontWeight: 600,
            fontSize: '0.9375rem',
            height: '2.75rem',
          }}
        >
          {loading ? <><Spinner /> Inathibitisha…</> : 'Thibitisha na uingie'}
        </button>
      </form>

      {/* Resend row */}
      <div
        style={{
          textAlign: 'center',
          marginTop: '1.5rem',
          fontSize: '0.8125rem',
          color: 'var(--text-tertiary)',
        }}
      >
        {countdown > 0 ? (
          <span>Tuma tena baada ya {countdown}s</span>
        ) : (
          <>
            Hukupokea nambari?{' '}
            <button
              type="button"
              onClick={handleResend}
              disabled={loading}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                fontWeight: 600,
                fontSize: 'inherit',
                color: 'var(--text-primary)',
                cursor: loading ? 'not-allowed' : 'pointer',
                textDecoration: 'underline',
                textUnderlineOffset: '2px',
              }}
            >
              Tuma tena
            </button>
          </>
        )}
      </div>

      {/* Back link */}
      <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
        <button
          type="button"
          onClick={() => { setStep('phone'); setOtp(''); setError(''); }}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            fontSize: '0.8125rem',
            color: 'var(--text-tertiary)',
            cursor: 'pointer',
            transition: 'color 120ms ease',
          }}
          onMouseEnter={e => e.target.style.color = 'var(--text-primary)'}
          onMouseLeave={e => e.target.style.color = 'var(--text-tertiary)'}
        >
          ← Badilisha nambari
        </button>
      </div>
    </Wrap>
  );
}

// ── Minimal inline spinner ─────────────────────────────────────────────────
function Spinner() {
  return (
    <svg
      className="animate-spin"
      style={{ width: 15, height: 15, flexShrink: 0, marginRight: '0.5rem' }}
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}