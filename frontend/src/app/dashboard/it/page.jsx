'use client';
/**
 * app/dashboard/it/page.jsx
 * ─────────────────────────────────────────────────────────────────
 * Church IT / streaming dashboard — lives inside DashboardShell.
 *
 * Route:  /dashboard/it
 * Shell:  DashboardShell (Sidebar + RightPanel already mounted)
 *
 * Tabs: Channel stats · Service checklist · WhatsApp notifications
 * Upload tab links to /dashboard/youtube/upload
 * ─────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback } from 'react';
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

// ── CheckSection ──────────────────────────────────────────────────
function CheckSection({ title, items, checked, onToggle }) {
  const done    = items.filter(i => checked[i.id]).length;
  const allDone = done === items.length;

  return (
    <div className={`mb-4 rounded-xl overflow-hidden border ${allDone ? 'border-success-border' : 'border-hairline'}`}>
      <div className={`flex items-center justify-between px-4 py-2.5 border-b ${allDone ? 'bg-success-bg border-success-border' : 'bg-surface border-hairline'}`}>
        <span className={`text-sm font-semibold ${allDone ? 'text-success-text' : 'text-ink'}`}>{title}</span>
        <span className={`text-xs font-medium ${allDone ? 'text-success-text' : 'text-ink-muted'}`}>{done}/{items.length}</span>
      </div>
      <div className="bg-canvas py-1">
        {items.map(item => (
          <label key={item.id} className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-surface transition-colors">
            <div
              onClick={() => onToggle(item.id)}
              className={`w-4.5 h-4.5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${checked[item.id] ? 'bg-status-completed border-status-completed' : 'border-border bg-canvas'}`}
              style={{ width: 18, height: 18, borderRadius: 5 }}
            >
              {checked[item.id] && (
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <span className={`text-sm transition-colors ${checked[item.id] ? 'text-ink-faint line-through' : 'text-ink'}`}>
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
    setLog(prev => [{ id: Date.now(), time: new Date().toLocaleTimeString(), type, status, detail }, ...prev.slice(0, 19)]);
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
      const res  = await fetch(`${API}/whatsapp/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
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
      const res  = await fetch(`${API}/whatsapp/test`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
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
      <div className={`flex items-start gap-3 p-3.5 rounded-xl border ${live?.isLive ? 'bg-success-bg border-success-border' : 'bg-surface border-hairline'}`}>
        <span className={`status-dot mt-1.5 flex-shrink-0 ${live?.isLive ? 'status-dot-live' : 'bg-ink-faint'}`} />
        <div>
          <p className={`text-sm font-semibold ${live?.isLive ? 'text-success-text' : 'text-ink'}`}>
            {live?.isLive ? `${t('wa_stream_detected')}: ${live.title}` : t('wa_no_stream')}
          </p>
          <p className="text-2xs text-ink-muted mt-0.5">
            {live?.isLive ? t('wa_auto_details') : t('wa_fill_manual')}
          </p>
        </div>
      </div>

      {/* Manual override */}
      {!live?.isLive && (
        <div className="card space-y-3">
          <p className="section-label">{t('wa_manual_details')}</p>
          <div>
            <label className="field-label">{t('wa_stream_title_label')}</label>
            <input className="field-input" placeholder={t('wa_stream_title_placeholder')} value={customTitle} onChange={e => setCustomTitle(e.target.value)} />
          </div>
          <div>
            <label className="field-label">{t('wa_url_label')}</label>
            <input className="field-input" placeholder="https://youtube.com/watch?v=..." value={customUrl} onChange={e => setCustomUrl(e.target.value)} />
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <button onClick={sendLiveNotification} disabled={busy} className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed">
          {sending ? '⏳ ' : ''}
          {sending ? t('sending') : t('wa_send_live')}
        </button>
        <button onClick={sendTest} disabled={busy} className="btn-secondary flex-1 disabled:opacity-40 disabled:cursor-not-allowed">
          {testing ? '⏳ ' : ''}
          {testing ? t('sending') : t('wa_send_test')}
        </button>
      </div>

      {/* Message preview */}
      <div className="card">
        <p className="section-label mb-3">{t('wa_preview')}</p>
        <div className="flex justify-end">
          <div className="rounded-xl rounded-br-sm px-3.5 py-2.5 text-sm leading-relaxed max-w-[280px]"
            style={{ background: '#DCF8C6', color: '#111827' }}>
            <p className="font-semibold mb-1">Habari njema! 🔴</p>
            <p>
              <em>{live?.isLive ? live.title : customTitle || t('wa_default_title')}</em>{' '}
              inaendelea sasa hivi. Jiunge nasi:{' '}
              <span className="underline" style={{ color: '#128C7E' }}>
                {live?.isLive ? live.url : (customUrl || 'https://youtube.com/…')}
              </span>{' '}
              — Mungu akubariki!
            </p>
            <p className="text-right text-2xs mt-1.5" style={{ color: '#6b7280' }}>
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ✓✓
            </p>
          </div>
        </div>
      </div>

      {/* Send log */}
      {log.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-hairline">
            <span className="section-label">{t('wa_send_log')}</span>
            <button onClick={() => setLog([])} className="btn-ghost text-xs">{t('clear')}</button>
          </div>
          {log.map(entry => (
            <div key={entry.id} className="flex items-center gap-3 px-4 py-2 border-b border-hairline last:border-0 text-xs">
              <span className={`status-dot flex-shrink-0 ${entry.status === 'success' ? 'status-dot-completed' : 'status-dot-live'}`} />
              <span className="text-ink-faint font-mono flex-shrink-0">{entry.time}</span>
              <span className="font-medium text-ink flex-shrink-0">{entry.type}</span>
              <span className={`flex-1 truncate ${entry.status === 'success' ? 'text-success-text' : 'text-error-text'}`}>
                {entry.status === 'success' ? '✓' : '✗'} {entry.detail}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Channel Tab ───────────────────────────────────────────────────
function ChannelTab({ ytData, ytLoading, ytError, watchData, watchLoading, watchOauth, t }) {
  const channel = ytData?.channel;

  return (
    <div className="space-y-5">
      {ytError && (
        <div className="banner-error text-sm">
          {t('api_error')}: {ytError}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: t('subscribers'),      value: fmt(channel?.subscriberCount), sub: `${t('target')}: 1,000` },
          { label: t('total_views'),       value: fmt(channel?.viewCount) },
          { label: t('watch_hours_12m'),   value: watchLoading ? '…' : watchOauth ? t('setup_needed') : `${fmt(watchData?.estimatedHoursWatched)}h`, sub: `${t('target')}: 4,000h` },
          { label: t('videos_published'),  value: fmt(channel?.videoCount) },
        ].map(s => (
          <div key={s.label} className="card text-center">
            <p className="section-label mb-2">{s.label}</p>
            {ytLoading
              ? <div className="skeleton h-7 w-16 mx-auto rounded" />
              : <p className="text-2xl font-bold text-ink leading-none">{s.value}</p>
            }
            {s.sub && <p className="text-2xs text-ink-faint mt-1">{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* YPP tracker */}
      <div className="card">
        <p className="section-label mb-4">{t('ypp_tracker')}</p>

        {/* Subscribers */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1.5">
            <span className="text-ink-muted">{t('subscribers')}</span>
            <span className={`font-semibold ${(channel?.subscriberCount || 0) >= 1000 ? 'text-success-text' : 'text-ink'}`}>
              {(channel?.subscriberCount || 0) >= 1000 ? `✓ ${t('met')}` : `${fmt(channel?.subscriberCount)} / 1,000`}
            </span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${Math.min(100, Math.round(((channel?.subscriberCount || 0) / 1000) * 100))}%` }} />
          </div>
        </div>

        {/* Watch hours */}
        <div className="mb-3">
          <div className="flex justify-between text-sm mb-1.5">
            <span className="text-ink-muted">{t('watch_hours_12m')}</span>
            <span className={`font-semibold ${watchOauth ? 'text-warning-text' : (watchData?.estimatedHoursWatched || 0) >= 4000 ? 'text-success-text' : 'text-ink'}`}>
              {watchOauth ? t('oauth_needed') : `${fmt(watchData?.estimatedHoursWatched || 0)}h / 4,000h`}
            </span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${Math.min(100, Math.round(((watchData?.estimatedHoursWatched || 0) / 4000) * 100))}%`, background: 'var(--color-purple, #7c3aed)' }} />
          </div>
        </div>

        {watchOauth && (
          <div className="banner-warning text-xs mt-2">
            {t('oauth_run')} <code className="font-mono bg-warning-bg px-1 rounded">node scripts/authorise.js</code>
          </div>
        )}
      </div>

      {/* Recent uploads */}
      <div>
        <p className="section-label mb-3">{t('recent_uploads')}</p>
        {ytLoading ? (
          [1,2,3].map(i => <div key={i} className="skeleton h-16 rounded-xl mb-2" />)
        ) : !(ytData?.latestVideos || []).length ? (
          <div className="card text-center py-8 text-ink-muted text-sm">{t('no_videos_yet')}</div>
        ) : (ytData?.latestVideos || []).map(v => (
          <div key={v.id} className="card flex items-center gap-3 mb-2 p-3">
            {v.thumbnail && (
              <img src={v.thumbnail} alt="" className="w-18 h-10 object-cover rounded flex-shrink-0" style={{ width: 72, height: 40 }} />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink truncate">{v.title}</p>
              <p className="text-2xs text-ink-faint mt-0.5 font-mono">
                {fmt(v.viewCount)} {t('views')} · {fmt(v.likeCount)} {t('likes')} · {fmtDuration(v.duration)} · {timeAgo(v.publishedAt, t)}
              </p>
            </div>
            <a href={v.url} target="_blank" rel="noopener noreferrer" className="btn-ghost text-xs flex-shrink-0">
              {t('view')} ↗
            </a>
          </div>
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
  const { data: watchData, loading: watchLoading, oauthRequired: watchOauth } = useWatchHours({ startDate: oneYearAgo, endDate: today_ });

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
    <div className="max-w-4xl mx-auto px-5 py-7">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <p className="section-label mb-1">{t('it_team')}</p>
          <h1 className="text-xl font-bold text-ink">{t('dashboard_title')}</h1>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Lang toggle */}
          <div className="flex bg-surface border border-hairline rounded-full p-0.5 gap-0.5">
            {['en', 'sw'].map(l => (
              <button key={l} onClick={() => switchLang(l)}
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${lang === l ? 'bg-navy text-white' : 'text-ink-muted hover:text-ink'}`}>
                {l}
              </button>
            ))}
          </div>

          {/* Live badge */}
          {liveChecking ? null : live?.isLive ? (
            <span className="live-badge animate-pulse">
              <span className="status-dot status-dot-live" />
              {t('live_now')} · {fmt(live.viewerCount)} {t('watching')}
            </span>
          ) : (
            <span className="badge-navy text-xs">{t('offline')}</span>
          )}

          {/* Upload shortcut */}
          <Link href="/dashboard/youtube/upload" className="btn-primary text-sm" style={{ textDecoration: 'none' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            {t('tab_upload')}
          </Link>
        </div>
      </div>

      {/* Live stream banner */}
      {live?.isLive && (
        <a href={live.url} target="_blank" rel="noopener noreferrer"
          className="block mb-5 rounded-xl overflow-hidden border border-hairline"
          style={{ textDecoration: 'none' }}>
          <div className="bg-ink flex items-center gap-4 px-4 py-3 flex-wrap">
            {live.thumbnail && (
              <img src={live.thumbnail} alt="" className="w-24 h-14 object-cover rounded-lg flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="live-badge">
                  <span className="status-dot status-dot-live animate-pulse" />
                  {t('live_now')}
                </span>
                <span className="text-2xs text-white/50">{fmt(live.viewerCount)} {t('watching')}</span>
              </div>
              <p className="text-sm font-semibold text-white truncate">{live.title}</p>
            </div>
            <span className="text-white/40 text-sm flex-shrink-0">{t('open')} ↗</span>
          </div>
        </a>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-5">

        {/* ── Left sidebar (desktop) ── */}
        <div className="hidden lg:flex flex-col gap-4">

          {/* Stream status */}
          <div className={`card border-2 ${live?.isLive ? 'border-error-border' : 'border-hairline'}`}>
            <p className="section-label mb-3">{t('stream_status')}</p>
            {liveChecking ? (
              <div className="skeleton h-5 rounded" />
            ) : live?.isLive ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <span className="status-dot status-dot-live animate-pulse" />
                  <span className="text-sm font-bold text-error-text">{t('live_now')}</span>
                </div>
                <p className="text-xs text-ink leading-snug mb-1">{live.title}</p>
                <p className="text-2xs text-ink-faint">{fmt(live.viewerCount)} {t('watching')}</p>
                <a href={live.url} target="_blank" rel="noopener noreferrer"
                  className="btn-destructive w-full mt-3 text-xs justify-center" style={{ textDecoration: 'none' }}>
                  {t('open_stream')} ↗
                </a>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <span className="status-dot bg-ink-faint" />
                <span className="text-sm text-ink-muted">{t('offline')}</span>
              </div>
            )}
          </div>

          {/* Quick stats */}
          <div className="card">
            <p className="section-label mb-3">{t('quick_stats')}</p>
            {[
              { label: t('subscribers'), value: ytLoading ? '…' : fmt(ytData?.channel?.subscriberCount) },
              { label: t('total_views'),  value: ytLoading ? '…' : fmt(ytData?.channel?.viewCount) },
              { label: t('videos'),       value: ytLoading ? '…' : fmt(ytData?.channel?.videoCount) },
            ].map(s => (
              <div key={s.label} className="flex justify-between text-sm mb-2.5 last:mb-0">
                <span className="text-ink-muted">{s.label}</span>
                <span className="font-semibold text-ink">{s.value}</span>
              </div>
            ))}
            {lastUpdated && (
              <p className="text-2xs text-ink-faint mt-3 font-mono">
                {t('updated')} {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>

          {/* Readiness */}
          <div className="card">
            <p className="section-label mb-3">{t('readiness')}</p>
            <p className={`text-3xl font-bold mb-2 leading-none ${pct === 100 ? 'text-success-text' : 'text-ink'}`}>{pct}%</p>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-2xs text-ink-faint mt-2">{totalChecked} / {totalItems} {t('tasks_done')}</p>
          </div>
        </div>

        {/* ── Main content ── */}
        <div className="card p-0 overflow-hidden min-w-0">

          {/* Tab bar */}
          <div className="flex border-b border-hairline bg-surface overflow-x-auto">
            {TABS.map(({ id, label }) => (
              <button key={id} onClick={() => setTab(id)}
                className={`px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 -mb-px
                  ${tab === id
                    ? 'border-navy text-navy bg-canvas'
                    : 'border-transparent text-ink-muted hover:text-ink hover:bg-canvas'}`}>
                {label}
              </button>
            ))}
          </div>

          {/* Checklist progress strip */}
          {tab === 'checklist' && (
            <div className="flex items-center gap-4 px-4 py-2.5 bg-surface border-b border-hairline">
              <div className="flex-1">
                <div className="progress-track h-1.5">
                  <div className="progress-fill h-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <span className="text-xs font-semibold text-ink-muted flex-shrink-0">{totalChecked}/{totalItems}</span>
              <button onClick={() => setChecked({})} className="btn-ghost text-xs text-error-text px-2 py-1">
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
                <p className="text-xs text-ink-muted mb-4">
                  {pct === 100 ? t('all_checks_done') : `${totalItems - totalChecked} ${t('items_remaining')}`}
                </p>
                {resolvedChecklist.map(({ sectionLabel, items }) => (
                  <CheckSection key={sectionLabel} title={sectionLabel} items={items} checked={checked}
                    onToggle={id => setChecked(p => ({ ...p, [id]: !p[id] }))} />
                ))}
              </div>
            )}
            {tab === 'whatsapp' && <WhatsAppTab live={live} t={t} />}
          </div>
        </div>
      </div>
    </div>
  );
}