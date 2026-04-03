'use client';


/**
 * YouTubePage.jsx
 * ──────────────────────────────────────────────────────────────
 * Church YouTube portal page.
 * Connects to your existing /api/youtube/* endpoints.
 *
 * Drop-in usage:
 *   import YouTubePage from "./YouTubePage";
 *   <YouTubePage />
 *
 * Requires:
 *   NEXT_PUBLIC_API_URL in .env (defaults to http://localhost:4000/api)
 *
 * Hooks used from useYouTubeData.js:
 *   useYouTubeData()   → channel stats + latest videos + YPP progress
 *   useLiveStatus()    → polls live stream every 60 s
 * ──────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback, useRef } from "react";

// ── Inline hooks (mirrors useYouTubeData.js so this file is self-contained) ──
const BASE_URL =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_URL) ||
  "http://localhost:4000/api";

function useYouTubeData({ refreshInterval = 5 * 60 * 1000 } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`${BASE_URL}/youtube/dashboard`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Unknown error");
      setData(json.data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchData, refreshInterval]);

  return { data, loading, error, lastUpdated, refresh: fetchData };
}

function useLiveStatus({ pollInterval = 60 * 1000 } = {}) {
  const [live, setLive] = useState(null);
  const [checking, setChecking] = useState(true);

  const check = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/youtube/live`);
      const json = await res.json();
      if (json.success) setLive(json.data);
    } catch {
      // silent fail
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    check();
    const interval = setInterval(check, pollInterval);
    return () => clearInterval(interval);
  }, [check, pollInterval]);

  return { live, checking, recheck: check };
}

// ── Helpers ───────────────────────────────────────────────────────
function formatCount(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n?.toLocaleString() ?? "—";
}

function parseDuration(iso) {
  if (!iso) return "";
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return "";
  const h = parseInt(match[1] || 0);
  const m = parseInt(match[2] || 0);
  const s = parseInt(match[3] || 0);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ── Sub-components ────────────────────────────────────────────────

function LiveBadge({ live }) {
  if (!live?.isLive) return null;
  return (
    <a
      href={live.url}
      target="_blank"
      rel="noopener noreferrer"
      className="live-badge animate-pulse"
      style={{ textDecoration: "none" }}
    >
      <span className="status-dot status-dot-live" />
      LIVE NOW
      {live.viewerCount > 0 && (
        <span style={{ fontWeight: 400, marginLeft: 4 }}>
          · {formatCount(live.viewerCount)} watching
        </span>
      )}
    </a>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="card" style={{ textAlign: "center" }}>
      <p className="section-label" style={{ marginBottom: 8 }}>{label}</p>
      <p style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0, lineHeight: 1 }}>{value}</p>
      {sub && (
        <p style={{ fontSize: "0.75rem", marginTop: 6, color: "var(--ink-muted, #6b7280)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function YPPBar({ current, target, percent, met }) {
  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span className="section-label">YouTube Partner Progress</span>
        {met ? (
          <span className="badge-gold">Threshold Met ✓</span>
        ) : (
          <span className="badge-navy">{current.toLocaleString()} / {target.toLocaleString()} subs</span>
        )}
      </div>
      <div className="progress-track">
        <div
          className="progress-fill"
          style={{ width: `${percent}%`, "--bar-width": `${percent}%` }}
        />
      </div>
      <p style={{ fontSize: "0.75rem", marginTop: 8, color: "var(--ink-muted, #6b7280)" }}>
        {met
          ? "Subscriber milestone reached — keep growing!"
          : `${target - current} more subscribers needed to reach 1,000`}
      </p>
    </div>
  );
}

function VideoCard({ video, featured = false }) {
  return (
    <a
      href={video.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
    >
      <div
        className="card"
        style={{
          padding: 0,
          overflow: "hidden",
          transition: "box-shadow 0.15s",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.12)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = "";
        }}
      >
        {/* Thumbnail */}
        <div style={{ position: "relative", aspectRatio: "16/9", background: "#111", overflow: "hidden" }}>
          {video.thumbnail ? (
            <img
              src={video.thumbnail}
              alt={video.title}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : (
            <div style={{ width: "100%", height: "100%", background: "#1c1c1e", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="#555">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          )}
          {video.duration && (
            <span style={{
              position: "absolute", bottom: 8, right: 8,
              background: "rgba(0,0,0,0.8)", color: "#fff",
              fontSize: "0.7rem", fontWeight: 600, padding: "2px 6px", borderRadius: 4,
            }}>
              {parseDuration(video.duration)}
            </span>
          )}
        </div>

        {/* Meta */}
        <div style={{ padding: "14px 16px 16px" }}>
          <p style={{
            fontWeight: 600, fontSize: featured ? "1rem" : "0.875rem",
            margin: "0 0 8px", lineHeight: 1.35,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>
            {video.title}
          </p>
          <div style={{ display: "flex", gap: 14, fontSize: "0.75rem", color: "var(--ink-muted, #6b7280)", flexWrap: "wrap" }}>
            <span>👁 {formatCount(video.viewCount)}</span>
            <span>👍 {formatCount(video.likeCount)}</span>
            {video.commentCount > 0 && <span>💬 {formatCount(video.commentCount)}</span>}
            <span>{timeAgo(video.publishedAt)}</span>
          </div>
        </div>
      </div>
    </a>
  );
}

function SkeletonCard() {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="skeleton" style={{ aspectRatio: "16/9" }} />
      <div style={{ padding: "14px 16px 16px" }}>
        <div className="skeleton" style={{ height: 16, marginBottom: 8, borderRadius: 6 }} />
        <div className="skeleton" style={{ height: 12, width: "60%", borderRadius: 6 }} />
      </div>
    </div>
  );
}

function ErrorBanner({ message, onRetry }) {
  return (
    <div className="banner-warning" style={{ marginBottom: 24 }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0, marginTop: 2 }}>
        <path d="M12 2L1 21h22L12 2zm0 3.5L20.5 19h-17L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/>
      </svg>
      <div>
        <span>Could not load YouTube data — {message}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{ marginLeft: 12, textDecoration: "underline", background: "none", border: "none", cursor: "pointer", fontSize: "inherit", color: "inherit", padding: 0 }}
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────
export default function YouTubePage() {
  const { data, loading, error, lastUpdated, refresh } = useYouTubeData();
  const { live } = useLiveStatus({ pollInterval: 60_000 });

  const channel = data?.channel;
  const videos = data?.latestVideos ?? [];
  const ypp = data?.yppProgress?.subscribers;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 1.25rem" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 28 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>
              {channel?.channelTitle ?? "Our YouTube Channel"}
            </h1>
            <LiveBadge live={live} />
          </div>
          <p style={{ color: "var(--ink-muted, #6b7280)", marginTop: 4, marginBottom: 0, fontSize: "0.9rem" }}>
            Watch sermons, worship sessions, and more — anytime, anywhere.
          </p>
        </div>

        <a
          href={`https://www.youtube.com/channel/${channel?.channelId ?? ""}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary"
          style={{ textDecoration: "none", gap: 8 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z"/>
          </svg>
          Subscribe on YouTube
        </a>
      </div>

      {error && <ErrorBanner message={error} onRetry={refresh} />}

      {/* ── Live Banner ── */}
      {live?.isLive && (
        <a
          href={live.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: "none", display: "block", marginBottom: 24 }}
        >
          <div style={{
            background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12,
            padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap"
          }}>
            {live.thumbnail && (
              <img src={live.thumbnail} alt="" style={{ width: 120, height: 68, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span className="live-badge">
                  <span className="status-dot status-dot-live" />
                  LIVE
                </span>
                {live.viewerCount > 0 && (
                  <span style={{ fontSize: "0.8rem", color: "#991b1b" }}>
                    {formatCount(live.viewerCount)} watching now
                  </span>
                )}
              </div>
              <p style={{ fontWeight: 600, margin: 0, color: "#1a1a1a" }}>{live.title}</p>
              <p style={{ fontSize: "0.8rem", color: "#b91c1c", margin: "4px 0 0" }}>
                Tap to join the live stream →
              </p>
            </div>
          </div>
        </a>
      )}

      {/* ── Stats Row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14, marginBottom: 28 }}>
        {loading ? (
          <>
            {[1, 2, 3].map((i) => (
              <div key={i} className="card" style={{ minHeight: 90 }}>
                <div className="skeleton" style={{ height: 12, width: "60%", marginBottom: 10, borderRadius: 6 }} />
                <div className="skeleton" style={{ height: 28, width: "80%", borderRadius: 6 }} />
              </div>
            ))}
          </>
        ) : channel ? (
          <>
            <StatCard
              label="Subscribers"
              value={channel.hiddenSubscriberCount ? "Hidden" : formatCount(channel.subscriberCount)}
              sub={channel.hiddenSubscriberCount ? "Channel keeps this private" : undefined}
            />
            <StatCard label="Total Videos" value={formatCount(channel.videoCount)} />
            <StatCard label="Total Views" value={formatCount(channel.viewCount)} />
          </>
        ) : null}
      </div>

      {/* ── YPP Progress ── */}
      {!loading && ypp && (
        <div style={{ marginBottom: 28 }}>
          <YPPBar {...ypp} />
        </div>
      )}

      {/* ── Latest Videos ── */}
      <div style={{ marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>Latest Videos</h2>
        {lastUpdated && (
          <span style={{ fontSize: "0.72rem", color: "var(--ink-muted, #9ca3af)" }}>
            Updated {timeAgo(lastUpdated)}
          </span>
        )}
      </div>

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18 }}>
          {[1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : videos.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem", color: "var(--ink-muted, #6b7280)" }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.3, marginBottom: 12 }}>
            <path d="M8 5v14l11-7z" />
          </svg>
          <p style={{ margin: 0 }}>No videos uploaded yet. Check back soon!</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18 }}>
          {videos.map((video, i) => (
            <VideoCard key={video.id} video={video} featured={i === 0} />
          ))}
        </div>
      )}

      {/* ── Channel Link Footer ── */}
      {!loading && channel && (
        <div style={{ marginTop: 36, textAlign: "center" }}>
          <a
            href={`https://www.youtube.com/channel/${channel.channelId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
            style={{ textDecoration: "none" }}
          >
            View all videos on YouTube →
          </a>
        </div>
      )}
    </div>
  );
}