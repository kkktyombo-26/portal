'use client';
import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../hooks/useAuth';
import { useTranslation } from '../../../lib/i18n';
import { useYouTubeData, useLiveStatus, useWatchHours } from '../../../hooks/useYoutubeData';

// ── Checklist keys ────────────────────────────────────────────────
const CHECKLIST_KEYS = [
  {
    sectionKey: 'section_pre_stream',
    items: [
      { id: 'gmail',       key: 'check_gmail' },
      { id: 'obs_open',    key: 'check_obs_open' },
      { id: 'stream_key',  key: 'check_stream_key' },
      { id: 'scene_check', key: 'check_scene_check' },
      { id: 'audio_check', key: 'check_audio_check' },
      { id: 'camera1',     key: 'check_camera1' },
      { id: 'camera2',     key: 'check_camera2' },
      { id: 'wireless',    key: 'check_wireless' },
      { id: 'internet',    key: 'check_internet' },
      { id: 'backup_rec',  key: 'check_backup_rec' },
    ],
  },
  {
    sectionKey: 'section_go_live',
    items: [
      { id: 'yt_dashboard',  key: 'check_yt_dashboard' },
      { id: 'schedule_set',  key: 'check_schedule_set' },
      { id: 'obs_start',     key: 'check_obs_start' },
      { id: 'preview_check', key: 'check_preview_check' },
      { id: 'chat_pinned',   key: 'check_chat_pinned' },
      { id: 'announce',      key: 'check_announce' },
    ],
  },
  {
    sectionKey: 'section_during',
    items: [
      { id: 'monitor_chat',     key: 'check_monitor_chat' },
      { id: 'camera_switch',    key: 'check_camera_switch' },
      { id: 'copyright_watch',  key: 'check_copyright_watch' },
      { id: 'internet_monitor', key: 'check_internet_monitor' },
      { id: 'super_thanks',     key: 'check_super_thanks' },
    ],
  },
  {
    sectionKey: 'section_post_stream',
    items: [
      { id: 'obs_stop',       key: 'check_obs_stop' },
      { id: 'end_stream',     key: 'check_end_stream' },
      { id: 'backup_copy',    key: 'check_backup_copy' },
      { id: 'upload_edit',    key: 'check_upload_edit' },
      { id: 'title_tags',     key: 'check_title_tags' },
      { id: 'whatsapp_share', key: 'check_whatsapp_share' },
      { id: 'analytics',      key: 'check_analytics' },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────
function fmt(n) { return (n || 0).toLocaleString(); }

function fmtDuration(iso) {
  if (!iso) return '';
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return iso;
  const h = parseInt(m[1] || 0), min = parseInt(m[2] || 0), sec = parseInt(m[3] || 0);
  return h > 0 ? `${h}h ${min}m` : `${min}m ${sec}s`;
}

function timeAgo(dateStr, t) {
  if (!dateStr) return '';
  const days = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
  if (days === 0) return t('today');
  if (days === 1) return t('yesterday');
  if (days < 7)  return `${days}${t('days_ago')}`;
  return `${Math.floor(days / 7)}${t('weeks_ago')}`;
}

// ── Shared card shell ─────────────────────────────────────────────
function Card({ children, className = '', style = {} }) {
  return (
    <div
      className={` border border-neutral-100 rounded-lg ${className}`}
      style={{ boxShadow: '0 1px 3px rgba(15,31,61,.06)', ...style }}
    >
      {children}
    </div>
  );
}

// ── Progress bar — uses globals.css .progress-bar / .progress-fill ─
function ProgressBar({ percent, color }) {
  return (
    <div className="progress-bar">
      <div
        className="progress-fill"
        style={{ width: `${Math.min(percent, 100)}%`, ...(color ? { background: color } : {}) }}
      />
    </div>
  );
}

// ── Section eyebrow label ─────────────────────────────────────────
function SectionLabel({ children, className = '' }) {
  return (
    <p className={`text-2xs font-black tracking-widest uppercase text-neutral-400 ${className}`}>
      {children}
    </p>
  );
}

// ── CheckSection ──────────────────────────────────────────────────
function CheckSection({ title, items, checked, onToggle }) {
  const done    = items.filter(i => checked[i.id]).length;
  const allDone = done === items.length;

  return (
    <div
      className={`mb-4 rounded-lg overflow-hidden border ${
        allDone ? 'border-success' : 'border-neutral-100'
      }`}
      style={allDone ? { borderColor: 'var(--success)' } : {}}
    >
      {/* Section header */}
      <div
        className={`flex items-center justify-between px-4 py-2.5 border-b ${
          allDone ? 'border-success' : 'border-neutral-100'
        }`}
        style={{
          background: allDone ? 'var(--success-bg)' : 'var(--surface-page)',
          borderColor: allDone ? 'rgba(26,127,85,.2)' : undefined,
        }}
      >
        <span className={`text-sm font-semibold ${allDone ? 'text-success' : 'text-navy-900'}`}
          style={allDone ? { color: 'var(--success)' } : {}}>
          {title}
        </span>
        <span className={`text-xs font-medium font-mono ${allDone ? 'text-success' : 'text-neutral-400'}`}
          style={allDone ? { color: 'var(--success)' } : {}}>
          {done}/{items.length}
        </span>
      </div>

      {/* Items */}
      <div className=" py-1">
        {items.map(item => (
          <label
            key={item.id}
            className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-neutral-50 transition-colors duration-100"
          >
            <div
              onClick={() => onToggle(item.id)}
              className="flex items-center justify-center flex-shrink-0 border-2 transition-colors duration-150"
              style={{
                width: 18, height: 18, borderRadius: 5,
                background: checked[item.id] ? 'var(--navy)' : 'white',
                borderColor: checked[item.id] ? 'var(--navy)' : 'var(--border-default)',
              }}
            >
              {checked[item.id] && (
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <span className={`text-sm transition-colors duration-100 ${
              checked[item.id] ? 'text-neutral-300 line-through' : 'text-navy-900'
            }`}>
              {item.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ── WhatsApp Tab ──────────────────────────────────────────────────
function WhatsAppTab({ live, t }) {
  const API = process.env.NEXT_PUBLIC_API_URL || '';

  const [sending,     setSending]     = useState(false);
  const [testing,     setTesting]     = useState(false);
  const [log,         setLog]         = useState([]);
  const [customTitle, setCustomTitle] = useState('');
  const [customUrl,   setCustomUrl]   = useState('');

  const addLog = useCallback((type, status, detail) => {
    setLog(prev => [
      { id: Date.now(), time: new Date().toLocaleTimeString(), type, status, detail },
      ...prev.slice(0, 19),
    ]);
  }, []);

  async function sendLiveNotification() {
    setSending(true);
    try {
      const body = {
        type: 'live',
        stream: live?.isLive
          ? { title: live.title, url: live.url, videoId: live.videoId }
          : { title: customTitle || t('wa_default_title'), url: customUrl || 'https://youtube.com' },
      };
      const res  = await fetch(`${API}/whatsapp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      addLog(t('wa_live_notif'), 'success', data.message || `${t('wa_sent_to')} ${data.sent ?? '?'} ${t('wa_recipients')}`);
    } catch (err) {
      addLog(t('wa_live_notif'), 'error', err.message);
    } finally {
      setSending(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    try {
      const res  = await fetch(`${API}/whatsapp/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      addLog(t('wa_test_msg'), 'success', data.message || t('wa_test_delivered'));
    } catch (err) {
      addLog(t('wa_test_msg'), 'error', err.message);
    } finally {
      setTesting(false);
    }
  }

  const busy = sending || testing;

  return (
    <div className="space-y-4">

      {/* Stream status banner */}
      <div
        className="flex items-start gap-3 p-3.5 rounded-lg border"
        style={{
          background: live?.isLive ? 'var(--success-bg)' : 'var(--surface-page)',
          borderColor: live?.isLive ? 'rgba(26,127,85,.2)' : 'var(--border-subtle)',
        }}
      >
        <span
          className="w-2 h-2 rounded-pill flex-shrink-0 mt-1.5"
          style={{
            background: live?.isLive ? 'var(--success)' : 'var(--text-disabled)',
            ...(live?.isLive ? { animation: 'pulse-gold 2s ease-in-out infinite' } : {}),
          }}
        />
        <div>
          <p className="text-sm font-semibold"
            style={{ color: live?.isLive ? 'var(--success)' : 'var(--text-primary)' }}>
            {live?.isLive
              ? `${t('wa_stream_detected')}: ${live.title}`
              : t('wa_no_stream')}
          </p>
          <p className="text-2xs text-neutral-400 mt-0.5">
            {live?.isLive ? t('wa_auto_details') : t('wa_fill_manual')}
          </p>
        </div>
      </div>

      {/* Manual override */}
      {!live?.isLive && (
        <Card className="p-4 space-y-3">
          <SectionLabel>{t('wa_manual_details')}</SectionLabel>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">
              {t('wa_stream_title_label')}
            </label>
            <input
              className="input"
              placeholder={t('wa_stream_title_placeholder')}
              value={customTitle}
              onChange={e => setCustomTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">
              {t('wa_url_label')}
            </label>
            <input
              className="input"
              placeholder="https://youtube.com/watch?v=..."
              value={customUrl}
              onChange={e => setCustomUrl(e.target.value)}
            />
          </div>
        </Card>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={sendLiveNotification}
          disabled={busy}
          className="btn btn-primary flex-1"
          style={{ borderRadius: 8 }}
        >
          {sending ? t('sending') + '…' : t('wa_send_live')}
        </button>
        <button
          onClick={sendTest}
          disabled={busy}
          className="btn btn-secondary flex-1"
          style={{ borderRadius: 8 }}
        >
          {testing ? t('sending') + '…' : t('wa_send_test')}
        </button>
      </div>

      {/* Message preview */}
      <Card className="p-4">
        <SectionLabel className="mb-3">{t('wa_preview')}</SectionLabel>
        <div className="flex justify-end">
          <div
            className="rounded-xl rounded-br-sm px-3.5 py-2.5 text-sm leading-relaxed max-w-[280px]"
            style={{ background: '#DCF8C6', color: '#111827' }}
          >
            <p className="font-semibold mb-1">Habari njema! 🔴</p>
            <p>
              <em>{live?.isLive ? live.title : customTitle || t('wa_default_title')}</em>{' '}
              inaendelea sasa hivi. Jiunge nasi:{' '}
              <span className="underline" style={{ color: '#128C7E' }}>
                {live?.isLive ? live.url : (customUrl || 'https://youtube.com/…')}
              </span>
              {' '}— Mungu akubariki!
            </p>
            <p className="text-right text-2xs mt-1.5 text-neutral-400">
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ✓✓
            </p>
          </div>
        </div>
      </Card>

      {/* Send log */}
      {log.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-100">
            <SectionLabel>{t('wa_send_log')}</SectionLabel>
            <button onClick={() => setLog([])} className="btn btn-ghost btn-sm">
              {t('clear')}
            </button>
          </div>
          {log.map(entry => (
            <div
              key={entry.id}
              className="flex items-center gap-3 px-4 py-2 border-b border-neutral-100 last:border-0 text-xs"
            >
              <span
                className="w-1.5 h-1.5 rounded-pill flex-shrink-0"
                style={{ background: entry.status === 'success' ? 'var(--success)' : 'var(--danger)' }}
              />
              <span className="text-neutral-400 font-mono flex-shrink-0">{entry.time}</span>
              <span className="font-medium text-navy-900 flex-shrink-0">{entry.type}</span>
              <span
                className="flex-1 truncate"
                style={{ color: entry.status === 'success' ? 'var(--success)' : 'var(--danger)' }}
              >
                {entry.status === 'success' ? '✓' : '✗'} {entry.detail}
              </span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ── Channel Tab ───────────────────────────────────────────────────
function ChannelTab({ ytData, ytLoading, ytError, watchData, watchLoading, watchOauth, t }) {
  const channel = ytData?.channel;

  return (
    <div className="space-y-5">

      {/* Error banner — .banner .banner-danger from globals.css */}
      {ytError && (
        <div className="banner banner-danger text-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="flex-shrink-0">
            <path d="M12 2L1 21h22L12 2zm0 3.5L20.5 19h-17L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/>
          </svg>
          {t('api_error')}: {ytError}
        </div>
      )}

      {/* Stats grid — .stat-card from globals.css */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: t('subscribers'),     value: fmt(channel?.subscriberCount), sub: `${t('target')}: 1,000` },
          { label: t('total_views'),      value: fmt(channel?.viewCount) },
          { label: t('watch_hours_12m'),  value: watchLoading ? '…' : watchOauth ? t('setup_needed') : `${fmt(watchData?.estimatedHoursWatched)}h`, sub: `${t('target')}: 4,000h` },
          { label: t('videos_published'), value: fmt(channel?.videoCount) },
        ].map(s => (
          <div key={s.label} className="stat-card text-center">
            <p className="stat-label">{s.label}</p>
            {ytLoading
              ? <div className="skeleton h-7 w-16 mx-auto rounded mt-1" />
              : <p className="stat-value">{s.value}</p>
            }
            {s.sub && <p className="text-2xs text-neutral-400 mt-1 font-mono">{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* YPP tracker */}
      <Card className="p-5">
        <SectionLabel className="mb-4">{t('ypp_tracker')}</SectionLabel>

        {/* Subscribers bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1.5">
            <span className="text-neutral-500">{t('subscribers')}</span>
            <span
              className="font-semibold"
              style={{ color: (channel?.subscriberCount || 0) >= 1000 ? 'var(--success)' : 'var(--text-primary)' }}
            >
              {(channel?.subscriberCount || 0) >= 1000
                ? `✓ ${t('met')}`
                : `${fmt(channel?.subscriberCount)} / 1,000`}
            </span>
          </div>
          <ProgressBar percent={Math.round(((channel?.subscriberCount || 0) / 1000) * 100)} />
        </div>

        {/* Watch hours bar */}
        <div className="mb-3">
          <div className="flex justify-between text-sm mb-1.5">
            <span className="text-neutral-500">{t('watch_hours_12m')}</span>
            <span
              className="font-semibold"
              style={{
                color: watchOauth
                  ? 'var(--warning)'
                  : (watchData?.estimatedHoursWatched || 0) >= 4000
                    ? 'var(--success)'
                    : 'var(--text-primary)',
              }}
            >
              {watchOauth
                ? t('oauth_needed')
                : `${fmt(watchData?.estimatedHoursWatched || 0)}h / 4,000h`}
            </span>
          </div>
          <ProgressBar
            percent={Math.round(((watchData?.estimatedHoursWatched || 0) / 4000) * 100)}
            color="var(--navy-light)"
          />
        </div>

        {watchOauth && (
          <div className="banner banner-warning text-xs mt-2">
            {t('oauth_run')}{' '}
            <code className="font-mono px-1 rounded border border-neutral-100">
              node scripts/authorise.js
            </code>
          </div>
        )}
      </Card>

      {/* Recent uploads */}
      <div>
        <SectionLabel className="mb-3">{t('recent_uploads')}</SectionLabel>
        {ytLoading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="skeleton h-16 rounded-lg mb-2" />
          ))
        ) : !(ytData?.latestVideos || []).length ? (
          <Card className="text-center py-8">
            <p className="text-sm text-neutral-400">{t('no_videos_yet')}</p>
          </Card>
        ) : (ytData?.latestVideos || []).map(v => (
          <Card key={v.id} className="flex items-center gap-3 mb-2 p-3">
            {v.thumbnail && (
              <img
                src={v.thumbnail} alt=""
                className="object-cover rounded flex-shrink-0"
                style={{ width: 72, height: 40 }}
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-navy-900 truncate">{v.title}</p>
              <p className="text-2xs text-neutral-400 mt-0.5 font-mono">
                {fmt(v.viewCount)} {t('views')} · {fmt(v.likeCount)} {t('likes')} · {fmtDuration(v.duration)} · {timeAgo(v.publishedAt, t)}
              </p>
            </div>
            <a
              href={v.url} target="_blank" rel="noopener noreferrer"
              className="btn btn-ghost btn-sm flex-shrink-0 no-underline"
            >
              {t('view')} ↗
            </a>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────
export default function ITDashboardPage() {
  const { lang, switchLang } = useAuth();
  const { t } = useTranslation(lang);

  const [tab,     setTab]     = useState('channel');
  const [checked, setChecked] = useState({});

  const { data: ytData, loading: ytLoading, error: ytError, lastUpdated } = useYouTubeData();
  const { live, checking: liveChecking } = useLiveStatus({ pollInterval: 60_000 });

  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const today_     = new Date().toISOString().split('T')[0];
  const { data: watchData, loading: watchLoading, oauthRequired: watchOauth } = useWatchHours({
    startDate: oneYearAgo,
    endDate: today_,
  });

  const resolvedChecklist = CHECKLIST_KEYS.map(section => ({
    sectionLabel: t(section.sectionKey),
    items: section.items.map(item => ({ id: item.id, label: t(item.key) })),
  }));

  const totalItems   = resolvedChecklist.flatMap(s => s.items).length;
  const totalChecked = Object.values(checked).filter(Boolean).length;
  const pct          = Math.round((totalChecked / totalItems) * 100);

  const TABS = [
    { id: 'channel',   label: t('tab_channel') },
    { id: 'checklist', label: t('tab_checklist') },
    { id: 'whatsapp',  label: t('tab_whatsapp') },
  ];

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="gold-bar-v" style={{ height: 16 }} />
            <SectionLabel>{t('it_team')}</SectionLabel>
          </div>
          <h1 className="font-display text-2xl font-bold text-navy-900 leading-heading tracking-tight">
            {t('dashboard_title')}
          </h1>
        </div>

        <div className="flex items-center gap-3 flex-wrap">

          {/* Language toggle — .tabs-pill / .tab-pill from globals.css */}
          <div className="tabs-pill">
            {['en', 'sw'].map(l => (
              <button
                key={l}
                onClick={() => switchLang(l)}
                className={`tab-pill${lang === l ? ' active' : ''}`}
                style={{
                  textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 11,
                  background: lang === l ? 'var(--gold)' : 'transparent',
                  color:      lang === l ? 'var(--navy-dark)' : 'var(--text-secondary)',
                  fontWeight: lang === l ? 700 : 500,
                }}
              >
                {l}
              </button>
            ))}
          </div>

          {/* Live badge */}
          {!liveChecking && (
            live?.isLive ? (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-2xs font-bold tracking-wider uppercase text-white"
                style={{ background: 'var(--danger)' }}
              >
                <span className="w-1.5 h-1.5 rounded-pill animate-pulse flex-shrink-0" />
                {t('live_now')} · {fmt(live.viewerCount)} {t('watching')}
              </span>
            ) : (
              <span className="badge badge-neutral">{t('offline')}</span>
            )
          )}

          {/* Upload shortcut */}
          <Link
            href="/dashboard/youtube/upload"
            className="btn btn-primary btn-sm no-underline"
            style={{ gap: 6 }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            {t('tab_upload')}
          </Link>
        </div>
      </div>

      {/* ── Live stream banner ── */}
      {live?.isLive && (
        <a
          href={live.url} target="_blank" rel="noopener noreferrer"
          className="block mb-6 rounded-lg overflow-hidden border border-neutral-200 no-underline"
          style={{ boxShadow: '0 4px 16px rgba(15,31,61,.10)' }}
        >
          <div
            className="flex items-center gap-4 px-4 py-3 flex-wrap"
            style={{ background: 'var(--navy-dark)' }}
          >
            {live.thumbnail && (
              <img src={live.thumbnail} alt="" className="w-24 h-14 object-cover rounded-lg flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-2xs font-bold tracking-wider uppercase text-white"
                  style={{ background: 'var(--danger)' }}
                >
                  <span className="w-1.5 h-1.5 rounded-pill animate-pulse flex-shrink-0" />
                  {t('live_now')}
                </span>
                <span className="text-2xs font-mono" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  {fmt(live.viewerCount)} {t('watching')}
                </span>
              </div>
              <p className="text-sm font-semibold text-white truncate">{live.title}</p>
            </div>
            <span className="text-sm flex-shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {t('open')} ↗
            </span>
          </div>
        </a>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-5">

        {/* ── Left panel (desktop only) ── */}
        <div className="hidden lg:flex flex-col gap-4">

          {/* Stream status */}
          <Card
            className="p-4"
            style={live?.isLive ? { borderColor: 'var(--danger)', borderWidth: 2 } : {}}
          >
            <SectionLabel className="mb-3">{t('stream_status')}</SectionLabel>
            {liveChecking ? (
              <div className="skeleton h-5 rounded" />
            ) : live?.isLive ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="w-2 h-2 rounded-pill flex-shrink-0 animate-pulse"
                    style={{ background: 'var(--danger)' }}
                  />
                  <span className="text-sm font-bold" style={{ color: 'var(--danger)' }}>
                    {t('live_now')}
                  </span>
                </div>
                <p className="text-xs text-navy-900 leading-snug mb-1">{live.title}</p>
                <p className="text-2xs text-neutral-400 font-mono">
                  {fmt(live.viewerCount)} {t('watching')}
                </p>
                <a
                  href={live.url} target="_blank" rel="noopener noreferrer"
                  className="btn btn-danger btn-sm w-full mt-3 no-underline justify-center"
                  style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}
                >
                  {t('open_stream')} ↗
                </a>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-pill bg-neutral-300 flex-shrink-0" />
                <span className="text-sm text-neutral-400">{t('offline')}</span>
              </div>
            )}
          </Card>

          {/* Quick stats */}
          <Card className="p-4">
            <SectionLabel className="mb-3">{t('quick_stats')}</SectionLabel>
            {[
              { label: t('subscribers'), value: ytLoading ? '…' : fmt(ytData?.channel?.subscriberCount) },
              { label: t('total_views'),  value: ytLoading ? '…' : fmt(ytData?.channel?.viewCount) },
              { label: t('videos'),       value: ytLoading ? '…' : fmt(ytData?.channel?.videoCount) },
            ].map(s => (
              <div key={s.label} className="flex justify-between text-sm mb-2.5 last:mb-0">
                <span className="text-neutral-500">{s.label}</span>
                <span className="font-semibold text-navy-900 font-mono">{s.value}</span>
              </div>
            ))}
            {lastUpdated && (
              <p className="text-2xs text-neutral-400 mt-3 font-mono">
                {t('updated')} {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </Card>

          {/* Readiness */}
          <Card className="p-4">
            <SectionLabel className="mb-3">{t('readiness')}</SectionLabel>
            <p
              className="text-3xl font-bold mb-2 leading-none font-display"
              style={{ color: pct === 100 ? 'var(--success)' : 'var(--text-primary)' }}
            >
              {pct}%
            </p>
            <ProgressBar percent={pct} />
            <p className="text-2xs text-neutral-400 mt-2 font-mono">
              {totalChecked} / {totalItems} {t('tasks_done')}
            </p>
          </Card>
        </div>

        {/* ── Main content ── */}
        <Card className="p-0 overflow-hidden min-w-0">

          {/* Tab bar */}
          <div className="flex border-b border-neutral-100 bg-neutral-50 overflow-x-auto">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className="px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors duration-150 border-b-2 -mb-px"
                style={{
                  borderBottomColor: tab === id ? 'var(--navy)' : 'transparent',
                  color:   tab === id ? 'var(--navy)' : 'var(--text-secondary)',
                  background: tab === id ? 'white' : 'transparent',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Checklist progress strip */}
          {tab === 'checklist' && (
            <div className="flex items-center gap-4 px-4 py-2.5 bg-neutral-50 border-b border-neutral-100">
              <div className="flex-1">
                <ProgressBar percent={pct} />
              </div>
              <span className="text-xs font-semibold text-neutral-400 font-mono flex-shrink-0">
                {totalChecked}/{totalItems}
              </span>
              <button
                onClick={() => setChecked({})}
                className="btn btn-ghost btn-sm"
                style={{ color: 'var(--danger)' }}
              >
                {t('reset')}
              </button>
            </div>
          )}

          {/* Tab bodies */}
          <div className="p-5">
            {tab === 'channel' && (
              <ChannelTab
                ytData={ytData} ytLoading={ytLoading} ytError={ytError}
                watchData={watchData} watchLoading={watchLoading} watchOauth={watchOauth}
                t={t}
              />
            )}
            {tab === 'checklist' && (
              <div>
                <p className="text-xs text-neutral-400 mb-4">
                  {pct === 100 ? t('all_checks_done') : `${totalItems - totalChecked} ${t('items_remaining')}`}
                </p>
                {resolvedChecklist.map(({ sectionLabel, items }) => (
                  <CheckSection
                    key={sectionLabel}
                    title={sectionLabel}
                    items={items}
                    checked={checked}
                    onToggle={id => setChecked(p => ({ ...p, [id]: !p[id] }))}
                  />
                ))}
              </div>
            )}
            {tab === 'whatsapp' && <WhatsAppTab live={live} t={t} />}
          </div>
        </Card>
      </div>
    </div>
  );
}