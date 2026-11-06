'use client';
/**
 * components/auth/PhoneLogin.jsx
 * ───────────────────────────────
 * Passwordless phone OTP login — NextSMS backend.
 *
 * Uses:
 *   • authApi (axios, church_token, port 4000) from lib/api.js
 *   • setAuth from lib/auth.js (same helper AuthContext uses)
 *   • KKKT design system CSS classes (card, btn, input, etc.)
 *   • Tailwind stone + amber palette
 *
 * Usage:
 *   import PhoneLogin from '@/components/auth/PhoneLogin';
 *
 *   // Standalone page (no AuthContext needed):
 *   <PhoneLogin onSuccess={(token, user) => {
 *     setAuth(token, user);           // persist to localStorage
 *     router.push('/dashboard');
 *   }} />
 *
 *   // Inside AuthProvider — calls context login after OTP:
 *   <PhoneLogin onSuccess={(token, user) => {
 *     setAuth(token, user);
 *     setUser(user);                  // update context manually
 *     router.push('/dashboard');
 *   }} />
 */

import { useState, useRef, useEffect } from 'react';
import { authApi }  from '../../lib/api';
import { setAuth }  from '../../lib/auth';

// ── OTP_TTL must match OTP_TTL_MINUTES in phoneLoginController.js ──────────
const OTP_TTL_MINUTES = 5;
const RESEND_COOLDOWN = 60; // seconds before "Resend" becomes active

// ═══════════════════════════════════════════════════════════════════════════
// 6-box OTP input
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
    <div className="flex gap-2.5 justify-center mb-6">
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
          className={[
            // base sizing
            'w-11 h-14 text-center text-xl font-bold rounded-lg',
            // border — uses design system input focus colours
            'border-2 border-neutral-300 outline-none',
            'transition-all duration-150',
            // focus: amber-400 ring, matches .input:focus in index.css
            'focus:border-gold-400 focus:shadow-[0_0_0_2px_rgba(251,191,36,0.40)]',
            // filled digit
            d.trim() ? 'bg-gold-50 border-gold-400 text-neutral-800' : 'bg-white text-neutral-800',
            // disabled
            disabled ? 'bg-neutral-100 cursor-not-allowed opacity-60' : '',
          ].join(' ')}
        />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════════════════════
export default function PhoneLogin({ onSuccess }) {
  const [step,      setStep]      = useState('phone');   // 'phone' | 'otp'
  const [phone,     setPhone]     = useState('');
  const [otp,       setOtp]       = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [countdown, setCountdown] = useState(0);

  // ── Countdown timer for resend cooldown ──────────────────────────────────
  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  // ── Auto-submit when all 6 digits entered ────────────────────────────────
  useEffect(() => {
    if (step === 'otp' && otp.length === 6 && !loading) {
      handleVerify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  // ── API helpers — use authApi from lib/api.js ────────────────────────────
  // authApi uses axios with baseURL http://localhost:4000/api
  // These two endpoints are added to authApi below as a local extension
  // rather than modifying lib/api.js (keeps the diff minimal).
  async function requestOTP(phone) {
    return authApi.requestPhoneOTP({ phone });
  }

  async function verifyOTP(phone, otp) {
    return authApi.verifyPhoneOTP({ phone, otp });
  }

  // ── Step 1: request OTP ──────────────────────────────────────────────────
  async function handleRequest(e) {
    e?.preventDefault();
    if (!phone.trim()) {
      setError('Tafadhali weka nambari ya simu.');
      return;
    }
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

  // ── Step 2: verify OTP ───────────────────────────────────────────────────
  async function handleVerify(e) {
    e?.preventDefault();
    if (otp.length !== 6) {
      setError('Tafadhali weka nambari zote 6.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res  = await verifyOTP(phone.trim(), otp);
      const data = res.data;                          // axios wraps in .data
      setAuth(data.token, data.user);                 // persist to localStorage
      onSuccess?.(data.token, data.user);
    } catch (err) {
      setError(err.message);
      setOtp('');
    } finally {
      setLoading(false);
    }
  }

  // ── Resend OTP ────────────────────────────────────────────────────────────
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

  // ── Shared layout wrapper ─────────────────────────────────────────────────
  // Uses --surface-page as the full-screen background (design system rule:
  // single root background, no nested boxes).
  const Wrap = ({ children }) => (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--surface-page)' }}
    >
      {/* card — white, shadow-md, rounded-2xl — matches .card in index.css */}
      <div
        className="card w-full max-w-sm"
        style={{ padding: '2.5rem 2rem' }}
      >
        {children}
      </div>
    </div>
  );

  // ── STEP: phone entry ─────────────────────────────────────────────────────
  if (step === 'phone') {
    return (
      <Wrap>
        {/* Amber top rule — matches stat-card::before in index.css */}
        <div
          className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
          style={{ background: 'var(--gold)' }}
        />

        {/* Church icon */}
        <div className="flex justify-center mb-5">
          <span
            className="flex items-center justify-center w-12 h-12 rounded-xl text-2xl"
            style={{ background: 'var(--gold-subtle)' }}
            aria-hidden="true"
          >
            ⛪
          </span>
        </div>

        {/* Heading */}
        <div className="text-center mb-6">
          <h2
            className="font-display font-bold text-xl mb-1"
            style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
          >
            Ingia kwa Simu
          </h2>
          <p
            className="text-sm"
            style={{ color: 'var(--text-tertiary)', maxWidth: 'none' }}
          >
            Tutakutumia nambari ya OTP kwa SMS.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleRequest} noValidate>
          <div className="form-group mb-4">
            <label className="form-label" htmlFor="phone-input">
              Nambari ya Simu
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
            />
          </div>

          {error && (
            <div
              className="banner banner-danger mb-4 text-sm py-2.5 px-3"
              role="alert"
            >
              {error}
            </div>
          )}

          <button
            className="btn btn-primary w-full btn-lg"
            type="submit"
            disabled={loading}
          >
            {loading
              ? <><Spinner /> Inatuma OTP…</>
              : 'Tuma OTP'}
          </button>
        </form>
      </Wrap>
    );
  }

  // ── STEP: OTP entry ───────────────────────────────────────────────────────
  return (
    <Wrap>
      {/* Amber top rule */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
        style={{ background: 'var(--gold)' }}
      />

      {/* Phone icon */}
      <div className="flex justify-center mb-5">
        <span
          className="flex items-center justify-center w-12 h-12 rounded-xl text-2xl"
          style={{ background: 'var(--gold-subtle)' }}
          aria-hidden="true"
        >
          📱
        </span>
      </div>

      {/* Heading */}
      <div className="text-center mb-6">
        <h2
          className="font-display font-bold text-xl mb-1"
          style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
        >
          Weka Nambari ya OTP
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-tertiary)', maxWidth: 'none' }}>
          Imetumwa kwa{' '}
          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
            {phone}
          </span>
          {' '}— inaisha dakika {OTP_TTL_MINUTES}.
        </p>
      </div>

      {/* OTP boxes */}
      <form onSubmit={handleVerify} noValidate>
        <OTPBoxes value={otp} onChange={v => { setOtp(v); setError(''); }} disabled={loading} />

        {error && (
          <div
            className="banner banner-danger mb-4 text-sm py-2.5 px-3"
            role="alert"
          >
            {error}
          </div>
        )}

        <button
          className="btn btn-primary w-full btn-lg"
          type="submit"
          disabled={loading || otp.length !== 6}
        >
          {loading
            ? <><Spinner /> Inathibitisha…</>
            : 'Thibitisha & Ingia'}
        </button>
      </form>

      {/* Resend row */}
      <div
        className="text-center mt-4 text-sm"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {countdown > 0 ? (
          <span>Tuma tena baada ya {countdown}s</span>
        ) : (
          <>
            Hukupokea OTP?{' '}
            <button
              type="button"
              className="font-semibold underline bg-transparent border-none cursor-pointer"
              style={{ color: 'var(--gold-dark)' }}
              onClick={handleResend}
              disabled={loading}
            >
              Tuma tena
            </button>
          </>
        )}
      </div>

      {/* Back link */}
      <div className="text-center mt-3">
        <button
          type="button"
          className="text-xs bg-transparent border-none cursor-pointer transition-colors duration-150"
          style={{ color: 'var(--text-tertiary)' }}
          onMouseEnter={e => e.target.style.color = 'var(--gold-dark)'}
          onMouseLeave={e => e.target.style.color = 'var(--text-tertiary)'}
          onClick={() => { setStep('phone'); setOtp(''); setError(''); }}
        >
          ← Badilisha nambari ya simu
        </button>
      </div>
    </Wrap>
  );
}

// ── Tiny inline spinner ───────────────────────────────────────────────────────
function Spinner() {
  return (
    <svg
      className="animate-spin mr-2"
      style={{ width: 16, height: 16, flexShrink: 0 }}
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12" cy="12" r="10"
        stroke="currentColor" strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}