'use client';
/**
 * app/dashboard/youtube/page.jsx
 * ─────────────────────────────────────────────────────────────────
 * YouTube content page — lives inside DashboardShell as {children}.
 * Connects to /api/youtube/* via the shared axios instance.
 *
 * Route:  /dashboard/youtube
 * Shell:  DashboardShell (Sidebar + RightPanel are already mounted)
 * ─────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import api from '../../../lib/api';
// Note: RightPanel YouTube link should use href='/dashboard/youtube' (internal Link, not target="_blank")          // your shared axios instance
import { useAuth } from '../../../hooks/useAuth';

// ── Helpers ───────────────────────────────────────────────────────
function fmt(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function duration(iso) {
  if (!iso) return '';
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return '';
  const h = +( m[1] || 0), mn = +(m[2] || 0), s = +(m[3] || 0);
  return h
    ? `${h}:${String(mn).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    : `${mn}:${String(s).padStart(2,'0')}`;
}

function ago(dateStr) {
  const d = (Date.now() - new Date(dateStr)) / 1000;
  if (d < 3600)    return `${Math.floor(d / 60)}m ago`;
  if (d < 86400)   return `${Math.floor(d / 3600)}h ago`;
  if (d < 2592000) return `${Math.floor(d / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Data hooks ────────────────────────────────────────────────────
function useDashboard() {
  const [data,        setData]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetch_ = useCallback(async () => {
    try {
      setError(null);
      const res = await api.get('/youtube/dashboard');
      setData(res.data.data);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch_();
    const t = setInterval(fetch_, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [fetch_]);

  return { data, loading, error, lastUpdated, refresh: fetch_ };
}

function useLive() {
  const [live,     setLive]     = useState(null);
  const [checking, setChecking] = useState(true);

  const check = useCallback(async () => {
    try {
      const res = await api.get('/youtube/live');
      if (res.data.success) setLive(res.data.data);
    } catch { /* silent */ } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    check();
    const t = setInterval(check, 60_000);
    return () => clearInterval(t);
  }, [check]);

  return { live, checking };
}

// ── UI atoms ──────────────────────────────────────────────────────
function StatCard({ label, value, sub }) {
  return (
    <div className="card text-center">
      <p className="section-label mb-2">{label}</p>
      <p className="text-2xl font-bold text-ink leading-none">{value}</p>
      {sub && <p className="text-2xs text-ink-faint mt-1.5">{sub}</p>}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="card p-0 overflow-hidden">
      <div className="skeleton" style={{ aspectRatio: '16/9' }} />
      <div className="p-4 space-y-2">
        <div className="skeleton h-3.5 rounded w-full" />
        <div className="skeleton h-3 rounded w-3/5" />
      </div>
    </div>
  );
}

function LiveBanner({ live }) {
  if (!live?.isLive) return null;
  return (
    <a href={live.url} target="_blank" rel="noopener noreferrer"
      className="block mb-6 rounded-xl overflow-hidden border border-hairline hover:shadow-md transition-shadow"
      style={{ textDecoration: 'none' }}>
      <div className="bg-ink flex items-center gap-4 p-4 flex-wrap">
        {live.thumbnail && (
          <img src={live.thumbnail} alt="" className="w-28 h-16 object-cover rounded-lg flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="live-badge">
              <span className="status-dot status-dot-live animate-pulse" />
              LIVE NOW
            </span>
            {live.viewerCount > 0 && (
              <span className="text-2xs text-white/50">{fmt(live.viewerCount)} watching</span>
            )}
          </div>
          <p className="text-sm font-semibold text-white leading-snug truncate">{live.title}</p>
          <p className="text-2xs text-white/40 mt-0.5">Tap to join the live stream →</p>
        </div>
      </div>
    </a>
  );
}

function YPPBar({ current, target, percent, met }) {
  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-3">
        <p className="section-label">YouTube Partner Progress</p>
        {met
          ? <span className="badge-gold">Milestone reached ✓</span>
          : <span className="badge-navy">{current.toLocaleString()} / {target.toLocaleString()}</span>
        }
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-2xs text-ink-faint mt-2">
        {met
          ? 'Subscriber milestone reached — keep growing!'
          : `${(target - current).toLocaleString()} more subscribers needed`}
      </p>
    </div>
  );
}

function VideoCard({ video }) {
  return (
    <a href={video.url} target="_blank" rel="noopener noreferrer"
      className="card p-0 overflow-hidden block hover:shadow-md transition-shadow group"
      style={{ textDecoration: 'none', color: 'inherit' }}>
      {/* Thumbnail */}
      <div className="relative overflow-hidden bg-ink" style={{ aspectRatio: '16/9' }}>
        {video.thumbnail
          ? <img src={video.thumbnail} alt={video.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          : <div className="w-full h-full flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="#555"><path d="M8 5v14l11-7z"/></svg>
            </div>
        }
        {video.duration && (
          <span className="absolute bottom-2 right-2 bg-ink/80 text-white text-2xs font-semibold px-1.5 py-0.5 rounded">
            {duration(video.duration)}
          </span>
        )}
      </div>
      {/* Meta */}
      <div className="p-3.5">
        <p className="text-sm font-semibold text-ink leading-snug mb-2"
          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {video.title}
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-2xs text-ink-faint font-mono">
          <span>{fmt(video.viewCount)} views</span>
          <span>{fmt(video.likeCount)} likes</span>
          {video.commentCount > 0 && <span>{fmt(video.commentCount)} comments</span>}
          <span>{ago(video.publishedAt)}</span>
        </div>
      </div>
    </a>
  );
}

// ── Page ──────────────────────────────────────────────────────────
export default function YouTubeDashboardPage() {
  const { lang } = useAuth();
  const { data, loading, error, lastUpdated, refresh } = useDashboard();
  const { live } = useLive();

  const channel = data?.channel;
  const videos  = data?.latestVideos ?? [];
  const ypp     = data?.yppProgress?.subscribers;

  return (
    <div className="max-w-5xl mx-auto px-5 py-7">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-xl font-bold text-ink mb-1">
            {lang === 'sw' ? 'Chaneli ya YouTube' : 'YouTube Channel'}
          </h1>
          <p className="text-sm text-ink-muted">
            {lang === 'sw'
              ? 'Tazama mahubiri, ibada, na zaidi'
              : 'Watch sermons, worship sessions, and more'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {lastUpdated && (
            <span className="text-2xs text-ink-faint font-mono hidden sm:block">
              Updated {ago(lastUpdated)}
            </span>
          )}
          {channel?.channelId && (
            <a href={`https://www.youtube.com/channel/${channel.channelId}`}
              target="_blank" rel="noopener noreferrer"
              className="btn-primary text-sm" style={{ textDecoration: 'none' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z"/>
              </svg>
              {lang === 'sw' ? 'Jiunge YouTube' : 'Subscribe'}
            </a>
          )}
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="banner-warning mb-6">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="flex-shrink-0 mt-0.5">
            <path d="M12 2L1 21h22L12 2zm0 3.5L20.5 19h-17L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/>
          </svg>
          <span className="flex-1 text-sm">
            {lang === 'sw' ? 'Hitilafu ya data ya YouTube' : 'Could not load YouTube data'} — {error}
          </span>
          <button onClick={refresh} className="btn-ghost text-xs">
            {lang === 'sw' ? 'Jaribu tena' : 'Retry'}
          </button>
        </div>
      )}

      {/* ── Live banner ── */}
      <LiveBanner live={live} />

      {/* ── Stats row ── */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {loading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="card min-h-[80px]">
              <div className="skeleton h-3 w-2/3 rounded mb-3" />
              <div className="skeleton h-6 w-1/2 rounded" />
            </div>
          ))
        ) : channel ? (
          <>
            <StatCard
              label={lang === 'sw' ? 'Wafuasi' : 'Subscribers'}
              value={channel.hiddenSubscriberCount ? '—' : fmt(channel.subscriberCount)}
              sub={channel.hiddenSubscriberCount ? 'Hidden by channel' : undefined}
            />
            <StatCard label={lang === 'sw' ? 'Video' : 'Videos'} value={fmt(channel.videoCount)} />
            <StatCard label={lang === 'sw' ? 'Maoni Yote' : 'Total Views'} value={fmt(channel.viewCount)} />
          </>
        ) : null}
      </div>

      {/* ── YPP progress ── */}
      {!loading && ypp && <YPPBar {...ypp} />}

      {/* ── Videos section header ── */}
      <div className="flex items-center justify-between mb-4">
        <p className="section-label">
          {lang === 'sw' ? 'Video za Hivi Karibuni' : 'Latest Videos'}
        </p>
        {channel?.channelId && (
          <a href={`https://www.youtube.com/channel/${channel.channelId}/videos`}
            target="_blank" rel="noopener noreferrer"
            className="btn-ghost text-xs" style={{ textDecoration: 'none' }}>
            {lang === 'sw' ? 'Zote →' : 'View all →'}
          </a>
        )}
      </div>

      {/* ── Video grid ── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : videos.length === 0 ? (
        <div className="card text-center py-12 text-ink-muted">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor"
            className="mx-auto mb-3 opacity-20"><path d="M8 5v14l11-7z"/></svg>
          <p className="text-sm">
            {lang === 'sw' ? 'Hakuna video bado.' : 'No videos uploaded yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {videos.map(v => <VideoCard key={v.id} video={v} />)}
        </div>
      )}
    </div>
  );
}