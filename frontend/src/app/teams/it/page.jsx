/**
 * ChurchDashboard.jsx  (updated — YouTube API connected)
 * Drop this into your church portal to replace the static version.
 *
 * Dependencies:
 *   - useYouTubeData.js (the hooks file)
 *   - Your portal must expose /api/youtube/* (see routes/youtube.js)
 *
 * Set REACT_APP_PORTAL_API_URL in your portal's .env if the API
 * runs on a different port/host during development.
 */

'use client';

import { useState, useEffect } from "react";
import { useYouTubeData, useLiveStatus, useWatchHours } from "../../../hooks/useYoutubeData";

const NAVY = "#1B3A6B";
const GOLD = "#C8A84B";
const GREEN = "#1a7a4a";
const RED = "#b91c1c";
const ORANGE = "#c05621";

// ── Checklist data ───────────────────────────────────────────────
const CHECKLIST = {
  "Pre-Stream Setup": [
    { id: "gmail", label: "Log into church Gmail account" },
    { id: "obs_open", label: "Open OBS Studio on streaming laptop" },
    { id: "stream_key", label: "Paste YouTube stream key into OBS" },
    { id: "scene_check", label: "Verify scenes: Camera, Screen Share, Bumper" },
    { id: "audio_check", label: "Audio levels checked (Focusrite interface)" },
    { id: "camera1", label: "Camera 1 (main) powered & framed" },
    { id: "camera2", label: "Camera 2 (wide) powered & framed" },
    { id: "wireless", label: "Wireless transmitter/receiver paired" },
    { id: "internet", label: "Internet connection confirmed (fiber/hotspot)" },
    { id: "backup_rec", label: "SD cards inserted & recording started (backup)" },
  ],
  "Go Live": [
    { id: "yt_dashboard", label: "Open YouTube Studio → Go Live" },
    { id: "schedule_set", label: "Stream title & thumbnail set" },
    { id: "obs_start", label: "OBS: Start Streaming" },
    { id: "preview_check", label: "Check YouTube preview — video & audio OK" },
    { id: "chat_pinned", label: "Pin giving details in live chat (M-Pesa/Airtel)" },
    { id: "announce", label: "Signal pastor/MC: stream is live" },
  ],
  "During Service": [
    { id: "monitor_chat", label: "Monitor live chat (assign 1 team member)" },
    { id: "camera_switch", label: "Switch cameras during sermon/worship" },
    { id: "copyright_watch", label: "Watch for copyrighted music — mute if needed" },
    { id: "internet_monitor", label: "Check internet stability every 15 min" },
    { id: "super_thanks", label: "Respond to Super Thanks in chat" },
  ],
  "Post-Stream": [
    { id: "obs_stop", label: "OBS: Stop Streaming" },
    { id: "end_stream", label: "End live stream on YouTube Studio" },
    { id: "backup_copy", label: "Copy SD card recordings to external SSD" },
    { id: "upload_edit", label: "Upload edited recording within 24 hours" },
    { id: "title_tags", label: "Add optimised title, description & tags" },
    { id: "whatsapp_share", label: "Share video link in church WhatsApp groups" },
    { id: "analytics", label: "Log views & watch time in tracking sheet" },
  ],
};

// ── Helpers ──────────────────────────────────────────────────────
function fmt(n) { return (n || 0).toLocaleString(); }
function fmtDuration(iso) {
  if (!iso) return "";
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return iso;
  const h = parseInt(m[1] || 0), min = parseInt(m[2] || 0), sec = parseInt(m[3] || 0);
  return h > 0 ? `${h}h ${min}m` : `${min}m ${sec}s`;
}
function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function ProgressBar({ value, max, color = NAVY }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div style={{ background: "#e5e7eb", borderRadius: 99, height: 6, overflow: "hidden", marginTop: 6 }}>
      <div style={{ width: `${pct}%`, background: color, height: "100%", borderRadius: 99, transition: "width 0.5s ease" }} />
    </div>
  );
}

function StatCard({ label, value, sub, loading, color = NAVY }) {
  return (
    <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{label}</div>
      {loading
        ? <div style={{ height: 28, width: 80, background: "#e5e7eb", borderRadius: 6, animation: "pulse 1.5s infinite" }} />
        : <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
      }
      {sub && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function LiveBadge({ live, checking }) {
  if (checking) return null;
  if (!live?.isLive) return (
    <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 99, background: "#f3f4f6", color: "#6b7280", fontWeight: 500 }}>● Offline</span>
  );
  return (
    <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 99, background: "#fef2f2", color: RED, fontWeight: 600, border: `1px solid #fecaca` }}>
      ● LIVE · {fmt(live.viewerCount)} watching
    </span>
  );
}

function CheckSection({ title, items, checked, onToggle }) {
  const done = items.filter(i => checked[i.id]).length;
  const allDone = done === items.length;
  return (
    <div style={{ marginBottom: 16, background: "#fff", border: `1px solid ${allDone ? "#bbf7d0" : "#e5e7eb"}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "10px 16px", background: allDone ? "#f0fdf4" : "#f9fafb", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${allDone ? "#bbf7d0" : "#e5e7eb"}` }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: allDone ? GREEN : NAVY }}>{title}</span>
        <span style={{ fontSize: 12, color: allDone ? GREEN : "#6b7280", fontWeight: 500 }}>{done}/{items.length}</span>
      </div>
      <div style={{ padding: "8px 0" }}>
        {items.map(item => (
          <label key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 16px", cursor: "pointer" }}>
            <div onClick={() => onToggle(item.id)} style={{
              width: 18, height: 18, borderRadius: 5, border: `2px solid ${checked[item.id] ? GREEN : "#d1d5db"}`,
              background: checked[item.id] ? GREEN : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer"
            }}>
              {checked[item.id] && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
            <span style={{ fontSize: 13, color: checked[item.id] ? "#9ca3af" : "#374151", textDecoration: checked[item.id] ? "line-through" : "none" }}>{item.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ── Tabs ─────────────────────────────────────────────────────────
function ChannelTab({ ytData, ytLoading, ytError, watchData, watchLoading, watchOauth }) {
  const channel = ytData?.channel;
  const ypp = ytData?.yppProgress;

  return (
    <div>
      {ytError && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: RED }}>
          API error: {ytError} — showing cached or default values.
        </div>
      )}

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        <StatCard label="Subscribers" value={fmt(channel?.subscriberCount)} sub="Target: 1,000" loading={ytLoading} />
        <StatCard label="Total Views" value={fmt(channel?.viewCount)} loading={ytLoading} />
        <StatCard
          label="Watch Hours (12m)"
          value={watchLoading ? "..." : watchOauth ? "Setup needed" : fmt(watchData?.estimatedHoursWatched) + "h"}
          sub="Target: 4,000h"
          loading={false}
          color={watchOauth ? ORANGE : NAVY}
        />
        <StatCard label="Videos Published" value={fmt(channel?.videoCount)} loading={ytLoading} />
      </div>

      {/* YPP progress */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: NAVY, marginBottom: 12 }}>YPP Qualification Tracker</div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
            <span style={{ color: "#374151" }}>Subscribers</span>
            <span style={{ fontWeight: 600, color: (channel?.subscriberCount || 0) >= 1000 ? GREEN : "#374151" }}>
              {(channel?.subscriberCount || 0) >= 1000 ? "✓ Met" : `${fmt(channel?.subscriberCount)} / 1,000`}
            </span>
          </div>
          <ProgressBar value={channel?.subscriberCount || 0} max={1000} color={(channel?.subscriberCount || 0) >= 1000 ? GREEN : NAVY} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
            <span style={{ color: "#374151" }}>Watch Hours (12 months)</span>
            <span style={{ fontWeight: 600, color: watchOauth ? ORANGE : (watchData?.estimatedHoursWatched || 0) >= 4000 ? GREEN : "#374151" }}>
              {watchOauth ? "OAuth2 setup needed" : `${fmt(watchData?.estimatedHoursWatched || 0)}h / 4,000h`}
            </span>
          </div>
          <ProgressBar value={watchData?.estimatedHoursWatched || 0} max={4000} color={(watchData?.estimatedHoursWatched || 0) >= 4000 ? GREEN : "#7c3aed"} />
        </div>
        {watchOauth && (
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: ORANGE }}>
            Run <code style={{ background: "#fef3c7", padding: "1px 4px", borderRadius: 3 }}>node scripts/authorise.js</code> once to enable watch hour tracking.
          </div>
        )}
      </div>

      {/* Latest videos */}
      <div style={{ fontWeight: 600, fontSize: 13, color: NAVY, marginBottom: 8 }}>Recent Uploads</div>
      {ytLoading ? (
        [1,2,3].map(i => <div key={i} style={{ height: 60, background: "#e5e7eb", borderRadius: 8, marginBottom: 8, animation: "pulse 1.5s infinite" }} />)
      ) : (ytData?.latestVideos || []).map(v => (
        <div key={v.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 12px", marginBottom: 8, display: "flex", gap: 10, alignItems: "center" }}>
          {v.thumbnail && <img src={v.thumbnail} alt="" style={{ width: 72, height: 40, objectFit: "cover", borderRadius: 5, flexShrink: 0 }} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.title}</div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
              {fmt(v.viewCount)} views · {fmt(v.likeCount)} likes · {fmtDuration(v.duration)} · {timeAgo(v.publishedAt)}
            </div>
          </div>
          <a href={v.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: NAVY, textDecoration: "none", border: `1px solid ${NAVY}`, borderRadius: 5, padding: "3px 8px", flexShrink: 0 }}>View ↗</a>
        </div>
      ))}
    </div>
  );
}

// ── Main Dashboard ───────────────────────────────────────────────
export default function ChurchDashboard() {
  const [tab, setTab] = useState("channel");
  const [checked, setChecked] = useState({});
  const [serviceDate] = useState(() => new Date().toISOString().split("T")[0]);

  // YouTube API hooks
  const { data: ytData, loading: ytLoading, error: ytError, lastUpdated } = useYouTubeData();
  const { live, checking: liveChecking } = useLiveStatus({ pollInterval: 60000 });

  // Watch hours — last 12 months
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const today = new Date().toISOString().split("T")[0];
  const { data: watchData, loading: watchLoading, oauthRequired: watchOauth } = useWatchHours({ startDate: oneYearAgo, endDate: today });

  const totalItems = Object.values(CHECKLIST).flat().length;
  const totalChecked = Object.values(checked).filter(Boolean).length;
  const pct = Math.round((totalChecked / totalItems) * 100);

  const tabs = [
    { id: "channel", label: "Channel Stats" },
    { id: "checklist", label: "Sunday Checklist" },
  ];

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", maxWidth: 680, margin: "0 auto" }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>

      {/* Header */}
      <div style={{ background: NAVY, padding: "20px 24px 0", borderRadius: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div>
            <div style={{ color: GOLD, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>Church IT Team</div>
            <div style={{ color: "#fff", fontSize: 19, fontWeight: 700 }}>Sunday Operations Dashboard</div>
          </div>
          <LiveBadge live={live} checking={liveChecking} />
        </div>

        {live?.isLive && (
          <div style={{ background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.4)", borderRadius: 8, padding: "8px 12px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#fca5a5", fontSize: 12 }}>🔴 {live.title}</span>
            <a href={live.url} target="_blank" rel="noopener noreferrer" style={{ color: "#fca5a5", fontSize: 11, textDecoration: "none" }}>Open ↗</a>
          </div>
        )}

        {lastUpdated && (
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>
            Stats updated: {lastUpdated.toLocaleTimeString()}
          </div>
        )}

        {/* Progress bar (for checklist) */}
        {tab === "checklist" && (
          <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: "8px 8px 0 0", padding: "10px 14px", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(255,255,255,0.7)", marginBottom: 5 }}>
                <span>Service Readiness</span>
                <span style={{ color: pct === 100 ? GOLD : "rgba(255,255,255,0.7)", fontWeight: 600 }}>{pct}%</span>
              </div>
              <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 99, height: 6 }}>
                <div style={{ width: `${pct}%`, background: pct === 100 ? GOLD : "#60a5fa", height: "100%", borderRadius: 99, transition: "width 0.4s ease" }} />
              </div>
            </div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 600 }}>{totalChecked}/{totalItems}</div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 2, marginTop: tab === "checklist" ? 2 : 12 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, padding: "9px 8px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
              background: tab === t.id ? "#fff" : "transparent",
              color: tab === t.id ? NAVY : "rgba(255,255,255,0.65)",
              borderRadius: tab === t.id ? "8px 8px 0 0" : 0,
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ background: "#f3f4f6", padding: 16, borderRadius: "0 0 12px 12px" }}>
        {tab === "channel" && (
          <ChannelTab
            ytData={ytData} ytLoading={ytLoading} ytError={ytError}
            watchData={watchData} watchLoading={watchLoading} watchOauth={watchOauth}
          />
        )}
        {tab === "checklist" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: "#6b7280" }}>
                {pct === 100 ? "All checks done — ready to go live!" : `${totalItems - totalChecked} items remaining`}
              </span>
              <button onClick={() => setChecked({})} style={{ fontSize: 11, color: RED, background: "none", border: `1px solid ${RED}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>Reset</button>
            </div>
            {Object.entries(CHECKLIST).map(([section, items]) => (
              <CheckSection key={section} title={section} items={items} checked={checked}
                onToggle={(id) => setChecked(p => ({ ...p, [id]: !p[id] }))} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}