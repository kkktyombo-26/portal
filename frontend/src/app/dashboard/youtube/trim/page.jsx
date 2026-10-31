'use client';
import { useState, useRef } from 'react';

// ── Constants ────────────────────────────────────────────────────────────────
const API_BASE = process.env.NEXT_PUBLIC_YT_TRIM_API_URL || 'https://yt-trimmer-21vn.onrender.com';

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
      <label className="form-label">{children}</label>
      {hint && <p className="form-hint">{hint}</p>}
    </div>
  );
}

function Field({ value, onChange, placeholder, type = 'text', error }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`input${error ? ' error' : ''}`}
    />
  );
}

function StatusPill({ status }) {
  const map = {
    idle:        { label: 'Ready',      className: 'badge badge-neutral' },
    preparing:   { label: 'Preparing…', className: 'badge badge-navy'    },
    downloading: { label: 'Trimming…',  className: 'badge badge-navy'    },
    done:        { label: 'Complete',   className: 'badge badge-success'  },
    error:       { label: 'Failed',     className: 'badge badge-danger'   },
  };
  const s = map[status] || map.idle;
  return (
    <span className={s.className}>
      {status === 'downloading' && (
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: 'var(--navy)',
          animation: 'pulse 1.5s ease-in-out infinite',
          display: 'inline-block',
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
  const [status,   setStatus]   = useState('idle');
  const [error,    setError]    = useState('');
  const [progress, setProgress] = useState(0);
  const [errors,   setErrors]   = useState({});
  const abortRef = useRef(null);

  const videoId  = extractVideoId(url);
  const startSec = toSeconds(start);
  const endSec   = toSeconds(end);
  const duration = (startSec != null && endSec != null && endMode === 'endtime')
    ? endSec - startSec
    : (endSec != null && endMode === 'duration') ? endSec : null;

  function validate() {
    const e = {};
    if (!url.trim())   e.url   = 'Paste a YouTube URL.';
    else if (!videoId) e.url   = "Doesn't look like a valid YouTube URL.";
    if (!start.trim()) e.start = 'Enter a start time.';
    else if (startSec == null) e.start = 'Use HH:MM:SS or plain seconds.';
    if (!end.trim())   e.end   = 'Enter an end time or duration.';
    else if (endSec == null)   e.end   = 'Use HH:MM:SS or plain seconds.';
    if (!e.start && !e.end) {
      if (endMode === 'endtime'  && endSec <= startSec) e.end = 'End must be after start.';
      if (endMode === 'duration' && endSec <= 0)        e.end = 'Duration must be greater than 0.';
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

    const body = {
      url:      url.trim(),
      start:    start.trim(),
      end:      end.trim(),
      end_mode: endMode,
      ...(filename.trim() && { filename: filename.trim().endsWith('.mp4')
          ? filename.trim()
          : `${filename.trim()}.mp4` }),
    };

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch(`${API_BASE}/clip`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
        signal:  controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Server error ${res.status}`);
      }

      setStatus('downloading');

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

      const cd    = res.headers.get('Content-Disposition') || '';
      const match = cd.match(/filename="?([^"]+)"?/);
      const fname = match?.[1] || body.filename || 'clip.mp4';

      const blob = new Blob(chunks, { type: 'video/mp4' });
      const link = document.createElement('a');
      link.href     = URL.createObjectURL(blob);
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
    <div style={{ padding: '2rem 2.5rem', maxWidth: 680 }}>

      {/* ── Page header ── */}
      <div style={{ marginBottom: '1.75rem' }}>
        <p className="page-header-eyebrow" style={{ position: 'static' }}>IT Desk</p>
        <div className="flex items-center justify-between gap-4 mt-1">
          <div className="flex items-center gap-3">
            <div style={{
              width: 36, height: 36, borderRadius: 8, flexShrink: 0,
              background: 'var(--navy)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z"/>
              </svg>
            </div>
            <div>
              <h1 className="font-display font-bold" style={{ fontSize: '1.25rem', letterSpacing: '-0.02em', color: 'var(--text-primary)', lineHeight: 1.2 }}>
                Clip Trimmer
              </h1>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                Trim a YouTube video and download it as an MP4
              </p>
            </div>
          </div>
          <StatusPill status={status} />
        </div>
      </div>

      {/* ── Form card ── */}
      <div className="card">

        {/* Video URL */}
        <div className="card-body" style={{ paddingBottom: 0 }}>
          <div className="form-group">
            <FieldLabel hint="Paste any youtube.com or youtu.be link">Video URL</FieldLabel>
            <Field
              value={url}
              onChange={v => { setUrl(v); setErrors(e => ({ ...e, url: '' })); }}
              placeholder="https://www.youtube.com/watch?v=..."
              error={errors.url}
            />
            {errors.url && <p className="form-error">{errors.url}</p>}
          </div>
        </div>

        {/* Thumbnail preview */}
        {videoId && (
          <div style={{ padding: '0.75rem 1.5rem 0' }}>
            <div style={{
              borderRadius: 6, overflow: 'hidden',
              border: '1px solid var(--border-subtle)',
              position: 'relative', background: '#000',
              aspectRatio: '16/5', maxHeight: 110,
            }}>
              <img
                src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
                alt="Video thumbnail"
                style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }}
              />
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to right, rgba(6,13,26,0.65) 0%, transparent 55%)',
                display: 'flex', alignItems: 'center', padding: '0 1rem',
              }}>
                <p style={{ color: '#fff', fontSize: '0.75rem', fontWeight: 600, margin: 0, maxWidth: 260 }}>
                  Video found — set your clip times below
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Timing row */}
        <div style={{ padding: '1rem 1.5rem 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div className="form-group">
            <FieldLabel hint="HH:MM:SS or plain seconds">Start time</FieldLabel>
            <Field
              value={start}
              onChange={v => { setStart(v); setErrors(e => ({ ...e, start: '' })); }}
              placeholder="0:30 or 30"
              error={errors.start}
            />
            {errors.start && <p className="form-error">{errors.start}</p>}
          </div>
          <div className="form-group">
            <FieldLabel hint={endMode === 'duration' ? 'How many seconds to clip' : 'HH:MM:SS or plain seconds'}>
              {endMode === 'duration' ? 'Duration (seconds)' : 'End time'}
            </FieldLabel>
            <Field
              value={end}
              onChange={v => { setEnd(v); setErrors(e => ({ ...e, end: '' })); }}
              placeholder={endMode === 'duration' ? '60' : '1:30 or 90'}
              error={errors.end}
            />
            {errors.end && <p className="form-error">{errors.end}</p>}
          </div>
        </div>

        {/* End mode toggle + duration preview */}
        <div style={{ padding: '0.625rem 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div className="tabs-pill">
            {[['endtime', 'End time'], ['duration', 'Duration']].map(([val, label]) => (
              <button
                key={val}
                onClick={() => { setEndMode(val); setErrors(e => ({ ...e, end: '' })); }}
                className={`tab-pill${endMode === val ? ' active' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>

          {duration != null && duration > 0 && (
            <div className="badge badge-gold" style={{ gap: '0.375rem' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>
              </svg>
              {formatDuration(duration)} clip
              {duration > 3600 && (
                <span className="badge badge-danger" style={{ marginLeft: 4 }}>exceeds 1 hour limit</span>
              )}
            </div>
          )}
        </div>

        {/* Optional filename */}
        <div style={{ padding: '1rem 1.5rem 0' }}>
          <div className="form-group">
            <FieldLabel hint="Optional — defaults to clip.mp4">Save as</FieldLabel>
            <Field value={filename} onChange={setFilename} placeholder="my-clip" />
          </div>
        </div>

        {/* Progress bar */}
        {status === 'downloading' && (
          <div style={{ padding: '0.875rem 1.5rem 0' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '0.375rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Streaming clip…
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                {(progress / 1024 / 1024).toFixed(1)} MB received
              </span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{
                width: '100%',
                background: 'linear-gradient(90deg, var(--navy) 0%, var(--gold) 100%)',
                animation: 'shimmer 1.5s ease-in-out infinite',
                backgroundSize: '400px 100%',
              }}/>
            </div>
          </div>
        )}

        {/* Preparing */}
        {status === 'preparing' && (
          <div style={{ padding: '0.875rem 1.5rem 0' }}>
            <div className="flex items-center gap-2">
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: 'var(--navy)',
                animation: 'pulse 1.2s ease-in-out infinite',
                display: 'inline-block',
              }}/>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Contacting server…
              </span>
            </div>
          </div>
        )}

        {/* Success */}
        {status === 'done' && (
          <div className="banner banner-success" style={{ margin: '1rem 1.5rem 0' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
              <path d="M20 6L9 17l-5-5"/>
            </svg>
            <p style={{ fontSize: '0.8125rem', fontWeight: 600, margin: 0 }}>
              Clip downloaded — check your downloads folder.
            </p>
          </div>
        )}

        {/* Error */}
        {status === 'error' && error && (
          <div className="banner banner-danger" style={{ margin: '1rem 1.5rem 0' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>
            </svg>
            <p style={{ fontSize: '0.8125rem', margin: 0 }}>{error}</p>
          </div>
        )}

        {/* Actions */}
        <div
          className="card-footer flex items-center gap-3"
          style={{ marginTop: '1rem' }}
        >
          {!busy && status !== 'done' && (
            <button onClick={handleTrim} className="btn btn-primary">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Trim &amp; Download
            </button>
          )}

          {busy && (
            <button onClick={handleCancel} className="btn btn-secondary">
              Cancel
            </button>
          )}

          {status === 'done' && (
            <button onClick={handleReset} className="btn btn-primary">
              Trim another clip
            </button>
          )}

          {status === 'error' && (
            <button onClick={handleReset} className="btn btn-secondary">
              Try again
            </button>
          )}

          <a
            href={`${API_BASE}/health`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1"
            style={{ marginLeft: 'auto', fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>
            </svg>
            Server status
          </a>
        </div>
      </div>

      {/* ── Usage notes ── */}
      <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
        <p className="stat-label" style={{ marginBottom: '0.75rem' }}>How it works</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
          {[
            ['Paste URL',  'Any youtube.com or youtu.be link works.'],
            ['Set times',  'Use HH:MM:SS, M:SS, or plain seconds like 90.'],
            ['Download',   'The clip streams directly — nothing is saved on the server.'],
          ].map(([title, desc]) => (
            <div key={title} className="flex gap-2">
              <div style={{
                width: 22, height: 22, borderRadius: 4, flexShrink: 0, marginTop: 1,
                background: 'var(--border-subtle)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <rect x="5" y="1.5" width="2" height="9" rx="1" fill="var(--navy)"/>
                  <rect x="1.5" y="4.5" width="9" height="2" rx="1" fill="var(--navy)" opacity="0.4"/>
                </svg>
              </div>
              <div>
                <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px' }}>{title}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}