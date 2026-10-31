'use client';
import { useState, useEffect, useCallback } from 'react';
import api from '../../../lib/api';
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
  const h = +(m[1] || 0), mn = +(m[2] || 0), s = +(m[3] || 0);
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

// Stat card — uses .stat-card / .stat-label / .stat-value from globals.css
function StatCard({ label, value, sub }) {
  return (
    <div className="stat-card text-center">
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
      {sub && (
        <p className="text-2xs text-neutral-400 mt-1.5 font-mono">{sub}</p>
      )}
    </div>
  );
}

// Skeleton — uses .skeleton from globals.css
function SkeletonCard() {
  return (
    <div
      className="bg-white border border-neutral-100 rounded-lg overflow-hidden"
      style={{ boxShadow: '0 1px 3px rgba(15,31,61,.06)' }}
    >
      <div className="skeleton" style={{ aspectRatio: '16/9' }} />
      <div className="p-4 space-y-2">
        <div className="skeleton h-3.5 rounded w-full" />
        <div className="skeleton h-3 rounded w-3/5" />
      </div>
    </div>
  );
}

// Live banner
function LiveBanner({ live }) {
  if (!live?.isLive) return null;
  return (
    <a
      href={live.url} target="_blank" rel="noopener noreferrer"
      className="block mb-6 rounded-xl overflow-hidden border border-neutral-200 no-underline"
      style={{
        boxShadow: '0 4px 16px rgba(15,31,61,.10)',
        transition: 'box-shadow var(--dur-base)',
      }}
    >
      <div
        className="flex items-center gap-4 p-4 flex-wrap"
        style={{ background: 'var(--navy-dark)' }}
      >
        {live.thumbnail && (
          <img
            src={live.thumbnail} alt=""
            className="w-28 h-16 object-cover rounded-lg flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {/* Live badge */}
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-2xs font-bold tracking-wider uppercase"
              style={{ background: 'var(--danger)', color: '#fff' }}
            >
              <span
                className="w-1.5 h-1.5 rounded-pill bg-white animate-pulse"
                style={{ flexShrink: 0 }}
              />
              LIVE NOW
            </span>
            {live.viewerCount > 0 && (
              <span className="text-2xs font-mono" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {fmt(live.viewerCount)} watching
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-white leading-snug truncate">
            {live.title}
          </p>
          <p className="text-2xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Tap to join the live stream →
          </p>
        </div>
      </div>
    </a>
  );
}

// YPP progress bar
function YPPBar({ current, target, percent, met }) {
  return (
    <div
      className="bg-white border border-neutral-100 rounded-lg p-5 mb-6"
      style={{ boxShadow: '0 1px 3px rgba(15,31,61,.06)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-2xs font-black tracking-widest uppercase text-neutral-400">
          YouTube Partner Progress
        </p>
        {met ? (
          <span className="badge badge-gold">Milestone reached ✓</span>
        ) : (
          <span className="badge badge-navy">
            {current.toLocaleString()} / {target.toLocaleString()}
          </span>
        )}
      </div>
      {/* Progress bar — using globals.css .progress-bar / .progress-fill */}
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
      <p className="text-2xs text-neutral-400 mt-2 font-mono">
        {met
          ? 'Subscriber milestone reached — keep growing!'
          : `${(target - current).toLocaleString()} more subscribers needed`}
      </p>
    </div>
  );
}

// Video card
function VideoCard({ video }) {
  return (
    <a
      href={video.url} target="_blank" rel="noopener noreferrer"
      className="bg-white border border-neutral-100 rounded-lg overflow-hidden block no-underline group"
      style={{
        color: 'inherit',
        boxShadow: '0 1px 3px rgba(15,31,61,.06)',
        transition: 'box-shadow var(--dur-base), transform var(--dur-base)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = '0 6px 20px rgba(15,31,61,.12)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(15,31,61,.06)';
        e.currentTarget.style.transform = 'none';
      }}
    >
      {/* Thumbnail */}
      <div
        className="relative overflow-hidden"
        style={{ aspectRatio: '16/9', background: 'var(--navy-dark)' }}
      >
        {video.thumbnail ? (
          <img
            src={video.thumbnail} alt={video.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="rgba(255,255,255,0.2)">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
        )}
        {/* Duration pill */}
        {video.duration && (
          <span
            className="absolute bottom-2 right-2 text-2xs font-bold font-mono px-1.5 py-0.5 rounded text-white"
            style={{ background: 'rgba(0,0,0,0.75)' }}
          >
            {duration(video.duration)}
          </span>
        )}
        {/* Play overlay */}
        <div
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          style={{ background: 'rgba(0,0,0,0.25)' }}
        >
          <div
            className="w-11 h-11 rounded-pill flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.92)', boxShadow: '0 2px 12px rgba(0,0,0,0.3)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--navy)">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Meta */}
      <div className="p-3.5">
        <p
          className="text-sm font-semibold text-navy-900 leading-snug mb-2"
          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {video.title}
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <span className="text-2xs text-neutral-400 font-mono">{fmt(video.viewCount)} views</span>
          <span className="text-2xs text-neutral-400 font-mono">{fmt(video.likeCount)} likes</span>
          {video.commentCount > 0 && (
            <span className="text-2xs text-neutral-400 font-mono">{fmt(video.commentCount)} comments</span>
          )}
          <span className="text-2xs text-neutral-400 font-mono">{ago(video.publishedAt)}</span>
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
    <div className="max-w-5xl mx-auto px-6 py-8">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
        <div>
          {/* Eyebrow */}
          <div className="flex items-center gap-2 mb-2">
            <div className="gold-bar-v" style={{ height: 16 }} />
            <span className="text-2xs font-black tracking-widest uppercase text-neutral-400">
              {lang === 'sw' ? 'Chaneli ya YouTube' : 'YouTube Channel'}
            </span>
          </div>
          <h1 className="font-display text-2xl font-bold text-navy-900 leading-heading tracking-tight mb-1">
            {lang === 'sw' ? 'Mahubiri & Ibada' : 'Sermons & Worship'}
          </h1>
          <p className="text-sm text-neutral-500">
            {lang === 'sw'
              ? 'Tazama mahubiri, ibada, na zaidi'
              : 'Watch sermons, worship sessions, and more'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {lastUpdated && (
            <span className="text-2xs text-neutral-400 font-mono hidden sm:block">
              Updated {ago(lastUpdated)}
            </span>
          )}
          <button
            onClick={refresh}
            className="btn btn-secondary btn-sm"
            title="Refresh"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M23 4v6h-6M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            {lang === 'sw' ? 'Onyesha upya' : 'Refresh'}
          </button>
          {channel?.channelId && (
            <a
              href={`https://www.youtube.com/channel/${channel.channelId}`}
              target="_blank" rel="noopener noreferrer"
              className="btn btn-danger btn-sm no-underline"
              style={{ background: '#FF0000', borderColor: '#FF0000', gap: 6 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z"/>
              </svg>
              {lang === 'sw' ? 'Jiunge YouTube' : 'Subscribe'}
            </a>
          )}
        </div>
      </div>

      {/* ── Error banner — uses .banner from globals.css ── */}
      {error && (
        <div className="banner banner-warning mb-6">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="flex-shrink-0 mt-0.5">
            <path d="M12 2L1 21h22L12 2zm0 3.5L20.5 19h-17L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/>
          </svg>
          <span className="flex-1 text-sm">
            {lang === 'sw' ? 'Hitilafu ya data ya YouTube' : 'Could not load YouTube data'} — {error}
          </span>
          <button onClick={refresh} className="btn btn-ghost btn-sm">
            {lang === 'sw' ? 'Jaribu tena' : 'Retry'}
          </button>
        </div>
      )}

      {/* ── Live banner ── */}
      <LiveBanner live={live} />

      {/* ── Stats row — uses .stat-card from globals.css ── */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {loading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="bg-white border border-neutral-100 rounded-lg p-5"
              style={{ boxShadow: '0 1px 3px rgba(15,31,61,.06)' }}>
              <div className="skeleton h-3 w-2/3 rounded mb-3" />
              <div className="skeleton h-7 w-1/2 rounded" />
            </div>
          ))
        ) : channel ? (
          <>
            <StatCard
              label={lang === 'sw' ? 'Wafuasi' : 'Subscribers'}
              value={channel.hiddenSubscriberCount ? '—' : fmt(channel.subscriberCount)}
              sub={channel.hiddenSubscriberCount ? 'Hidden by channel' : undefined}
            />
            <StatCard
              label={lang === 'sw' ? 'Video' : 'Videos'}
              value={fmt(channel.videoCount)}
            />
            <StatCard
              label={lang === 'sw' ? 'Maoni Yote' : 'Total Views'}
              value={fmt(channel.viewCount)}
            />
          </>
        ) : null}
      </div>

      {/* ── YPP progress ── */}
      {!loading && ypp && <YPPBar {...ypp} />}

      {/* ── Videos section header ── */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-2xs font-black tracking-widest uppercase text-neutral-400">
          {lang === 'sw' ? 'Video za Hivi Karibuni' : 'Latest Videos'}
        </p>
        {channel?.channelId && (
          <a
            href={`https://www.youtube.com/channel/${channel.channelId}/videos`}
            target="_blank" rel="noopener noreferrer"
            className="btn btn-ghost btn-sm no-underline"
          >
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
        <div
          className="bg-white border border-neutral-100 rounded-lg text-center py-14"
          style={{ boxShadow: '0 1px 3px rgba(15,31,61,.06)' }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor"
            className="mx-auto mb-3 text-neutral-200">
            <path d="M8 5v14l11-7z"/>
          </svg>
          <p className="text-sm font-medium text-neutral-400">
            {lang === 'sw' ? 'Hakuna video bado.' : 'No videos uploaded yet.'}
          </p>
          <p className="text-2xs text-neutral-300 mt-1">
            {lang === 'sw' ? 'Video zitaonekana hapa baada ya kupakiwa.' : 'Videos will appear here once uploaded.'}
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