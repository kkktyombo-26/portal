'use client';
import { useState, useRef } from 'react';

import { BG } from 'bgutils-js';

// ── Constants ────────────────────────────────────────────────────────────────
const API_BASE = process.env.NEXT_PUBLIC_YT_TRIM_API_URL || 'https://api.kkktdmpyombo.org';

// ── Helpers ──────────────────────────────────────────────────────────────────
function toSeconds(str) {
  if (!str) return null;
  str = str.trim();
  if (/^\d+$/.test(str)) return parseInt(str, 10);
  const parts = str.split(':').map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}


async function generatePoToken(videoId) {
  try {
    const requestKey = 'O43z0dpjhgX20SCx4KAo';
    const bgConfig = {
      fetch: (url, opts) => fetch(url, opts),
      globalObj: globalThis,
      identifier: videoId,
      requestKey,
    };
    const bg = await BG.create(bgConfig);
    const token = await bg.generatePoToken(videoId);
    return token || null;
  } catch {
    return null;
  }
}

function extractVideoId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1);
    return u.searchParams.get('v');
  } catch {
    return null;
  }
}

// ── Sub-components ───────────────────────────────────────────────────────────
function FieldLabel({ children, hint }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-ink-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {children}
      </label>
      {hint && <p style={{ fontSize: 11, color: 'var(--color-ink-faint)', marginTop: 2 }}>{hint}</p>}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = 'text', error }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%', boxSizing: 'border-box',
        padding: '9px 12px', fontSize: 13,
        border: `1px solid ${error ? 'var(--color-error-border)' : 'var(--color-border)'}`,
        borderRadius: 8, outline: 'none',
        background: 'var(--color-canvas)',
        color: 'var(--color-ink)',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
      onFocus={e => { e.target.style.borderColor = '#1B3A6B'; e.target.style.boxShadow = '0 0 0 3px rgba(27,58,107,0.12)'; }}
      onBlur={e => { e.target.style.borderColor = error ? 'var(--color-error-border)' : 'var(--color-border)'; e.target.style.boxShadow = 'none'; }}
    />
  );
}

function StatusPill({ status }) {
  const map = {
    idle:        { label: 'Ready',       bg: 'var(--color-surface)',      color: 'var(--color-ink-muted)' },
    preparing:   { label: 'Preparing…',  bg: '#EFF6FF',                   color: '#1D4ED8' },
    downloading: { label: 'Trimming…',   bg: 'var(--color-navy-muted)',   color: 'var(--color-navy-text)' },
    done:        { label: 'Complete',    bg: 'var(--color-success-bg)',   color: 'var(--color-success-text)' },
    error:       { label: 'Failed',      bg: 'var(--color-error-bg)',     color: 'var(--color-error-text)' },
  };
  const s = map[status] || map.idle;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
      background: s.bg, color: s.color,
    }}>
      {status === 'downloading' && (
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: 'var(--color-navy)', animation: 'pulse 1.5s ease-in-out infinite',
        }}/>
      )}
      {s.label}
    </span>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function YTTrimPage() {
  const [url,      setUrl]      = useState('');
  const [start,    setStart]    = useState('');
  const [end,      setEnd]      = useState('');
  const [endMode,  setEndMode]  = useState('endtime');
  const [filename, setFilename] = useState('');
  const [status,   setStatus]   = useState('idle'); // idle | preparing | downloading | done | error
  const [error,    setError]    = useState('');
  const [progress, setProgress] = useState(0); // bytes received
  const [errors,   setErrors]   = useState({});
  const abortRef = useRef(null);

  // Derived
  const videoId  = extractVideoId(url);
  const startSec = toSeconds(start);
  const endSec   = toSeconds(end);
  const duration = (startSec != null && endSec != null && endMode === 'endtime')
    ? endSec - startSec
    : (endSec != null && endMode === 'duration') ? endSec : null;

  function validate() {
    const e = {};
    if (!url.trim())   e.url   = 'Paste a YouTube URL.';
    else if (!videoId) e.url   = 'Doesn\'t look like a valid YouTube URL.';
    if (!start.trim()) e.start = 'Enter a start time.';
    else if (startSec == null) e.start = 'Use HH:MM:SS or plain seconds.';
    if (!end.trim())   e.end   = 'Enter an end time.';
    else if (endSec == null)   e.end   = 'Use HH:MM:SS or plain seconds.';
    if (!e.start && !e.end) {
      if (endMode === 'endtime' && endSec <= startSec) e.end = 'End must be after start.';
      if (endMode === 'duration' && endSec <= 0)       e.end = 'Duration must be greater than 0.';
      if (duration > 3600) e.end = 'Clips cannot exceed 1 hour.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleTrim() {
    if (!validate()) return;
    setError('');
    setStatus('preparing');
    setProgress(0);

    const poToken = await generatePoToken(videoId);
    const body = {
      url: url.trim(),
      start: start.trim(),
      end: end.trim(),
      end_mode: endMode,
      filename: filename.trim() || undefined,
      po_token: poToken || undefined,
    };

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch(`${API_BASE}/clip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Server error ${res.status}`);
      }

      setStatus('downloading');

      // Stream to a blob
      const reader = res.body.getReader();
      const chunks = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        setProgress(received);
      }

      // Derive filename from Content-Disposition or fallback
      const cd   = res.headers.get('Content-Disposition') || '';
      const match = cd.match(/filename="?([^"]+)"?/);
      const fname = match?.[1] || filename.trim() || 'clip.mp4';

      const blob = new Blob(chunks, { type: 'video/mp4' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fname;
      link.click();
      URL.revokeObjectURL(link.href);

      setStatus('done');
    } catch (err) {
      if (err.name === 'AbortError') {
        setStatus('idle');
      } else {
        setError(err.message || 'Something went wrong.');
        setStatus('error');
      }
    }
  }

  function handleCancel() {
    abortRef.current?.abort();
    setStatus('idle');
    setProgress(0);
  }

  function handleReset() {
    setStatus('idle');
    setError('');
    setProgress(0);
    setErrors({});
  }

  const busy = status === 'preparing' || status === 'downloading';

  return (
    <div style={{ padding: '28px 24px', maxWidth: 680, margin: '0 auto' }}>

      {/* ── Page header ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          {/* YouTube icon */}
          <span style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: 'linear-gradient(135deg, #1B3A6B 0%, #2a5298 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
              <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z"/>
            </svg>
          </span>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-ink)', margin: 0, lineHeight: 1.2 }}>
              Clip Trimmer
            </h1>
            <p style={{ fontSize: 12, color: 'var(--color-ink-faint)', margin: 0 }}>
              Trim a YouTube video and download it as an MP4
            </p>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <StatusPill status={status} />
          </div>
        </div>
      </div>

      {/* ── Form card ── */}
      <div style={{
        background: 'var(--color-canvas)',
        border: '1px solid var(--color-hairline)',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 2px 6px rgba(28,25,23,0.06)',
      }}>

        {/* Video URL */}
        <div style={{ padding: '20px 20px 0' }}>
          <FieldLabel hint="Paste any youtube.com or youtu.be link">Video URL</FieldLabel>
          <Input
            value={url}
            onChange={v => { setUrl(v); setErrors(e => ({ ...e, url: '' })); }}
            placeholder="https://www.youtube.com/watch?v=..."
            error={errors.url}
          />
          {errors.url && <p style={{ fontSize: 11, color: 'var(--color-error-text)', marginTop: 4 }}>{errors.url}</p>}
        </div>

        {/* Thumbnail preview */}
        {videoId && (
          <div style={{ padding: '12px 20px 0' }}>
            <div style={{
              borderRadius: 8, overflow: 'hidden',
              border: '1px solid var(--color-hairline)',
              position: 'relative', background: '#000',
              aspectRatio: '16/5', maxHeight: 120,
            }}>
              <img
                src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
                alt="Video thumbnail"
                style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }}
              />
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to right, rgba(0,0,0,0.5) 0%, transparent 50%)',
                display: 'flex', alignItems: 'center', padding: '0 16px',
              }}>
                <p style={{ color: '#fff', fontSize: 12, fontWeight: 600, margin: 0, maxWidth: 260 }}>
                  Video found — set your clip times below
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Timing row */}
        <div style={{ padding: '16px 20px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <FieldLabel hint="HH:MM:SS or plain seconds">Start time</FieldLabel>
            <Input
              value={start}
              onChange={v => { setStart(v); setErrors(e => ({ ...e, start: '' })); }}
              placeholder="0:30 or 30"
              error={errors.start}
            />
            {errors.start && <p style={{ fontSize: 11, color: 'var(--color-error-text)', marginTop: 4 }}>{errors.start}</p>}
          </div>
          <div>
            <FieldLabel hint={endMode === 'duration' ? 'How many seconds to clip' : 'HH:MM:SS or plain seconds'}>
              {endMode === 'duration' ? 'Duration (seconds)' : 'End time'}
            </FieldLabel>
            <Input
              value={end}
              onChange={v => { setEnd(v); setErrors(e => ({ ...e, end: '' })); }}
              placeholder={endMode === 'duration' ? '60' : '1:30 or 90'}
              error={errors.end}
            />
            {errors.end && <p style={{ fontSize: 11, color: 'var(--color-error-text)', marginTop: 4 }}>{errors.end}</p>}
          </div>
        </div>

        {/* End mode toggle + duration preview */}
        <div style={{ padding: '10px 20px 0', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 2,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-hairline)',
            borderRadius: 8, padding: 3,
          }}>
            {[['endtime', 'End time'], ['duration', 'Duration']].map(([val, label]) => (
              <button
                key={val}
                onClick={() => { setEndMode(val); setErrors(e => ({ ...e, end: '' })); }}
                style={{
                  padding: '4px 12px', fontSize: 11, fontWeight: 700,
                  borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: endMode === val
                    ? 'linear-gradient(135deg, #1B3A6B 0%, #2a5298 100%)'
                    : 'transparent',
                  color: endMode === val ? '#fff' : 'var(--color-ink-muted)',
                  transition: 'all 0.15s',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {duration != null && duration > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 10px', borderRadius: 8,
              background: 'var(--color-gold-light)',
              border: '1px solid var(--color-gold-border)',
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--color-gold-dark)" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>
              </svg>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-gold-dark)' }}>
                {formatDuration(duration)} clip
              </span>
              {duration > 3600 && (
                <span style={{ fontSize: 11, color: 'var(--color-error-text)', fontWeight: 600 }}>
                  — exceeds 1 hour limit
                </span>
              )}
            </div>
          )}
        </div>

        {/* Optional filename */}
        <div style={{ padding: '16px 20px 0' }}>
          <FieldLabel hint="Optional — defaults to clip_start-end.mp4">Save as</FieldLabel>
          <Input
            value={filename}
            onChange={setFilename}
            placeholder="sunday-sermon-highlight"
          />
        </div>

        {/* Progress bar (only while downloading) */}
        {status === 'downloading' && (
          <div style={{ padding: '14px 20px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-ink-muted)' }}>
                Streaming clip…
              </span>
              <span style={{ fontSize: 11, color: 'var(--color-ink-faint)' }}>
                {(progress / 1024 / 1024).toFixed(1)} MB received
              </span>
            </div>
            <div style={{
              height: 4, borderRadius: 999, background: 'var(--color-navy-muted)', overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', borderRadius: 999,
                background: 'linear-gradient(90deg, #1B3A6B, #C8A84B)',
                width: '100%',
                animation: 'fillBar 2s ease infinite alternate',
              }}/>
            </div>
          </div>
        )}

        {/* Success state */}
        {status === 'done' && (
          <div style={{
            margin: '16px 20px 0',
            padding: '12px 14px',
            borderRadius: 8,
            background: 'var(--color-success-bg)',
            border: '1px solid var(--color-success-border)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-success-text)" strokeWidth="2.5" strokeLinecap="round">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
            <p style={{ fontSize: 13, color: 'var(--color-success-text)', fontWeight: 600, margin: 0 }}>
              Clip downloaded — check your downloads folder.
            </p>
          </div>
        )}

        {/* Error state */}
        {status === 'error' && error && (
          <div style={{
            margin: '16px 20px 0',
            padding: '12px 14px',
            borderRadius: 8,
            background: 'var(--color-error-bg)',
            border: '1px solid var(--color-error-border)',
            display: 'flex', alignItems: 'flex-start', gap: 10,
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-error-text)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>
            </svg>
            <p style={{ fontSize: 13, color: 'var(--color-error-text)', margin: 0 }}>{error}</p>
          </div>
        )}

        {/* Actions */}
        <div style={{
          padding: '16px 20px 20px',
          display: 'flex', alignItems: 'center', gap: 10,
          borderTop: status !== 'idle' ? '1px solid var(--color-hairline)' : 'none',
          marginTop: 16,
        }}>
          {!busy && status !== 'done' && (
            <button
              onClick={handleTrim}
              disabled={busy}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 20px', borderRadius: 8, border: 'none',
                background: 'linear-gradient(135deg, #1B3A6B 0%, #2a5298 100%)',
                color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(27,58,107,0.25)',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Trim &amp; Download
            </button>
          )}

          {busy && (
            <button
              onClick={handleCancel}
              style={{
                padding: '9px 20px', borderRadius: 8, border: '1px solid var(--color-border)',
                background: 'var(--color-canvas)', color: 'var(--color-ink-muted)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          )}

          {status === 'done' && (
            <>
              <button
                onClick={handleReset}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '9px 20px', borderRadius: 8, border: 'none',
                  background: 'linear-gradient(135deg, #1B3A6B 0%, #2a5298 100%)',
                  color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Trim another clip
              </button>
            </>
          )}

          {status === 'error' && (
            <button
              onClick={handleReset}
              style={{
                padding: '9px 16px', borderRadius: 8,
                border: '1px solid var(--color-border)',
                background: 'var(--color-canvas)', color: 'var(--color-ink-muted)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Try again
            </button>
          )}

          {/* Server health link */}
          <a
            href={`${API_BASE}/status`}
            target="_blank"
            rel="noreferrer"
            style={{
              marginLeft: 'auto', fontSize: 11, color: 'var(--color-ink-faint)',
              textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>
            </svg>
            Server status
          </a>
        </div>
      </div>

      {/* ── Usage notes ── */}
      <div style={{
        marginTop: 20,
        padding: '14px 16px',
        borderRadius: 10,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-hairline)',
      }}>
        <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-ink-faint)', margin: '0 0 8px' }}>
          How it works
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          {[
            ['Paste URL', 'Any youtube.com or youtu.be link works.'],
            ['Set times', 'Use HH:MM:SS, M:SS, or plain seconds like 90.'],
            ['Download', 'The clip streams directly — nothing is saved on the server.'],
          ].map(([title, desc]) => (
            <div key={title} style={{ display: 'flex', gap: 8 }}>
              <div style={{
                width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                background: 'var(--color-navy-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <rect x="5" y="1.5" width="2" height="9" rx="1" fill="#1B3A6B"/>
                  <rect x="1.5" y="4.5" width="9" height="2" rx="1" fill="#1B3A6B" opacity="0.5"/>
                </svg>
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-ink)', margin: '0 0 2px' }}>{title}</p>
                <p style={{ fontSize: 11, color: 'var(--color-ink-muted)', margin: 0, lineHeight: 1.5 }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}