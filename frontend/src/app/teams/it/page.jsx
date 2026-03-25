/**
 * ChurchDashboard.jsx  (updated — WhatsApp panel + desktop responsive)
 *
 * New features:
 *   - WhatsApp tab: send live notifications & test messages
 *   - Responsive 2-column layout on desktop (≥900px)
 *   - Sidebar with live status + quick actions on desktop
 *
 * Backend requirement for WhatsApp:
 *   POST /api/whatsapp/send   { type: "live"|"test", stream? }
 *   POST /api/whatsapp/test   (convenience alias)
 *
 * All existing YouTube hooks unchanged.
 */

'use client';

import { useState, useEffect, useCallback } from "react";
import { useYouTubeData, useLiveStatus, useWatchHours } from "../../../hooks/useYoutubeData";

// ── Design tokens ────────────────────────────────────────────────
const NAVY   = "#1B3A6B";
const GOLD   = "#C8A84B";
const GREEN  = "#1a7a4a";
const RED    = "#b91c1c";
const ORANGE = "#c05621";
const WA_GREEN = "#25D366";
const WA_DARK  = "#128C7E";

// ── Checklist data ───────────────────────────────────────────────
const CHECKLIST = {
  "Pre-Stream Setup": [
    { id: "gmail",       label: "Log into church Gmail account" },
    { id: "obs_open",    label: "Open OBS Studio on streaming laptop" },
    { id: "stream_key",  label: "Paste YouTube stream key into OBS" },
    { id: "scene_check", label: "Verify scenes: Camera, Screen Share, Bumper" },
    { id: "audio_check", label: "Audio levels checked (Focusrite interface)" },
    { id: "camera1",     label: "Camera 1 (main) powered & framed" },
    { id: "camera2",     label: "Camera 2 (wide) powered & framed" },
    { id: "wireless",    label: "Wireless transmitter/receiver paired" },
    { id: "internet",    label: "Internet connection confirmed (fiber/hotspot)" },
    { id: "backup_rec",  label: "SD cards inserted & recording started (backup)" },
  ],
  "Go Live": [
    { id: "yt_dashboard",  label: "Open YouTube Studio → Go Live" },
    { id: "schedule_set",  label: "Stream title & thumbnail set" },
    { id: "obs_start",     label: "OBS: Start Streaming" },
    { id: "preview_check", label: "Check YouTube preview — video & audio OK" },
    { id: "chat_pinned",   label: "Pin giving details in live chat (M-Pesa/Airtel)" },
    { id: "announce",      label: "Signal pastor/MC: stream is live" },
  ],
  "During Service": [
    { id: "monitor_chat",     label: "Monitor live chat (assign 1 team member)" },
    { id: "camera_switch",    label: "Switch cameras during sermon/worship" },
    { id: "copyright_watch",  label: "Watch for copyrighted music — mute if needed" },
    { id: "internet_monitor", label: "Check internet stability every 15 min" },
    { id: "super_thanks",     label: "Respond to Super Thanks in chat" },
  ],
  "Post-Stream": [
    { id: "obs_stop",     label: "OBS: Stop Streaming" },
    { id: "end_stream",   label: "End live stream on YouTube Studio" },
    { id: "backup_copy",  label: "Copy SD card recordings to external SSD" },
    { id: "upload_edit",  label: "Upload edited recording within 24 hours" },
    { id: "title_tags",   label: "Add optimised title, description & tags" },
    { id: "whatsapp_share",label: "Share video link in church WhatsApp groups" },
    { id: "analytics",    label: "Log views & watch time in tracking sheet" },
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

// ── Shared components ────────────────────────────────────────────
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

// ── WhatsApp Tab ─────────────────────────────────────────────────
function WhatsAppTab({ live }) {
  const API = process.env.NEXT_PUBLIC_API_URL || "";

  const [sending, setSending]     = useState(false);
  const [testing, setTesting]     = useState(false);
  const [log, setLog]             = useState([]);       // { id, time, type, status, detail }
  const [customTitle, setCustomTitle] = useState("");
  const [customUrl, setCustomUrl]     = useState("");

  const addLog = useCallback((type, status, detail) => {
    setLog(prev => [
      { id: Date.now(), time: new Date().toLocaleTimeString(), type, status, detail },
      ...prev.slice(0, 19),
    ]);
  }, []);

  // Send live notification using current stream data
  async function sendLiveNotification() {
    setSending(true);
    try {
      const body = {
        type: "live",
        stream: live?.isLive
          ? { title: live.title, url: live.url, videoId: live.videoId }
          : {
              title: customTitle || "Live Stream",
              url:   customUrl   || "https://youtube.com",
            },
      };
      const res  = await fetch(`${API}/whatsapp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      addLog("Live notification", "success", data.message || `Sent to ${data.sent ?? "?"} recipients`);
    } catch (err) {
      addLog("Live notification", "error", err.message);
    } finally {
      setSending(false);
    }
  }

  // Send a test message
  async function sendTest() {
    setTesting(true);
    try {
      const res  = await fetch(`${API}/whatsapp/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      addLog("Test message", "success", data.message || "Test delivered");
    } catch (err) {
      addLog("Test message", "error", err.message);
    } finally {
      setTesting(false);
    }
  }

  const inputStyle = {
    width: "100%", padding: "8px 10px", fontSize: 13,
    border: "1px solid #d1d5db", borderRadius: 7,
    outline: "none", boxSizing: "border-box",
    fontFamily: "inherit", color: "#111827",
  };

  const btnStyle = (bg, disabled) => ({
    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
    padding: "10px 18px", borderRadius: 8, border: "none", cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 13, fontWeight: 600, color: "#fff",
    background: disabled ? "#9ca3af" : bg,
    opacity: disabled ? 0.7 : 1,
    transition: "opacity 0.2s",
    flex: 1,
  });

  return (
    <div>
      {/* Status banner */}
      <div style={{
        background: live?.isLive ? "#f0fdf4" : "#f9fafb",
        border: `1px solid ${live?.isLive ? "#bbf7d0" : "#e5e7eb"}`,
        borderRadius: 10, padding: "10px 14px", marginBottom: 16,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{
          width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
          background: live?.isLive ? WA_GREEN : "#9ca3af",
          boxShadow: live?.isLive ? `0 0 0 3px ${WA_GREEN}33` : "none",
        }} />
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: live?.isLive ? GREEN : "#374151" }}>
            {live?.isLive ? `Stream detected: ${live.title}` : "No active stream detected"}
          </div>
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 1 }}>
            {live?.isLive
              ? "Live notification will use current stream details automatically."
              : "Fill in details below to send a manual notification."}
          </div>
        </div>
      </div>

      {/* Manual override (shown when not live) */}
      {!live?.isLive && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: NAVY, marginBottom: 10 }}>Manual Notification Details</div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Stream / Video Title</label>
            <input
              style={inputStyle}
              placeholder="e.g. Ibada ya Jumapili — 25 March 2025"
              value={customTitle}
              onChange={e => setCustomTitle(e.target.value)}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>YouTube URL</label>
            <input
              style={inputStyle}
              placeholder="https://youtube.com/watch?v=..."
              value={customUrl}
              onChange={e => setCustomUrl(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <button
          style={btnStyle(WA_DARK, sending || testing)}
          onClick={sendLiveNotification}
          disabled={sending || testing}
        >
          {sending ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M13.507 0C6.041 0 .013 6.028.013 13.494c0 2.378.627 4.707 1.818 6.745L0 27l6.948-1.809A13.459 13.459 0 0013.507 27C20.973 27 27 20.972 27 13.506 27 6.041 20.973.013 13.507.013z" fillRule="evenodd" clipRule="evenodd"/></svg>
          )}
          {sending ? "Sending…" : "Send Live Notification"}
        </button>

        <button
          style={btnStyle("#374151", sending || testing)}
          onClick={sendTest}
          disabled={sending || testing}
        >
          {testing ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          )}
          {testing ? "Sending…" : "Send Test Message"}
        </button>
      </div>

      {/* Message preview */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: NAVY, marginBottom: 10 }}>Message Preview</div>
        <div style={{
          background: "#DCF8C6", borderRadius: "12px 12px 2px 12px",
          padding: "10px 12px", maxWidth: 280, marginLeft: "auto",
          fontSize: 13, color: "#111827", lineHeight: 1.5,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 3 }}>Habari njema! 🔴</div>
          <div>
            <em style={{ color: "#374151" }}>
              {live?.isLive
                ? live.title
                : customTitle || "Ibada ya Jumapili"}
            </em>{" "}
            inaendelea sasa hivi. Jiunge nasi ukitumia kiungo hiki:{" "}
            <span style={{ color: WA_DARK, textDecoration: "underline" }}>
              {live?.isLive ? live.url : (customUrl || "https://youtube.com/...")}
            </span>{" "}
            — Mungu akubariki!
          </div>
          <div style={{ fontSize: 10, color: "#6b7280", marginTop: 6, textAlign: "right" }}>
            {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ✓✓
          </div>
        </div>
      </div>

      {/* Send log */}
      {log.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: NAVY }}>Send Log</span>
            <button onClick={() => setLog([])} style={{ fontSize: 11, color: "#9ca3af", background: "none", border: "none", cursor: "pointer" }}>Clear</button>
          </div>
          {log.map(entry => (
            <div key={entry.id} style={{
              padding: "8px 14px", borderBottom: "1px solid #f3f4f6",
              display: "flex", alignItems: "center", gap: 10, fontSize: 12,
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                background: entry.status === "success" ? WA_GREEN : RED,
              }} />
              <span style={{ color: "#6b7280", flexShrink: 0 }}>{entry.time}</span>
              <span style={{ fontWeight: 500, color: "#374151", flexShrink: 0 }}>{entry.type}</span>
              <span style={{ color: entry.status === "success" ? GREEN : RED, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {entry.status === "success" ? "✓" : "✗"} {entry.detail}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Channel Tab ──────────────────────────────────────────────────
function ChannelTab({ ytData, ytLoading, ytError, watchData, watchLoading, watchOauth }) {
  const channel = ytData?.channel;

  return (
    <div>
      {ytError && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: RED }}>
          API error: {ytError} — showing cached or default values.
        </div>
      )}

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

// ── Desktop Sidebar ──────────────────────────────────────────────
function DesktopSidebar({ live, liveChecking, ytData, ytLoading, lastUpdated, checkedPct, totalChecked, totalItems }) {
  const channel = ytData?.channel;
  return (
    <div style={{ width: 220, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Live status card */}
      <div style={{ background: "#fff", border: `2px solid ${live?.isLive ? "#fecaca" : "#e5e7eb"}`, borderRadius: 12, padding: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Stream Status</div>
        {liveChecking ? (
          <div style={{ height: 20, background: "#e5e7eb", borderRadius: 4, animation: "pulse 1.5s infinite" }} />
        ) : live?.isLive ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: RED, boxShadow: `0 0 0 3px #fecaca` }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: RED }}>LIVE NOW</span>
            </div>
            <div style={{ fontSize: 11, color: "#374151", marginBottom: 4, lineHeight: 1.4 }}>{live.title}</div>
            <div style={{ fontSize: 11, color: "#6b7280" }}>{fmt(live.viewerCount)} watching</div>
            <a href={live.url} target="_blank" rel="noopener noreferrer" style={{
              display: "block", marginTop: 10, textAlign: "center", fontSize: 11, fontWeight: 600,
              background: RED, color: "#fff", borderRadius: 6, padding: "6px 0", textDecoration: "none",
            }}>Open Stream ↗</a>
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#9ca3af" }} />
            <span style={{ fontSize: 12, color: "#6b7280" }}>Offline</span>
          </div>
        )}
      </div>

      {/* Quick stats */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Quick Stats</div>
        {[
          { label: "Subscribers", value: ytLoading ? "…" : fmt(channel?.subscriberCount) },
          { label: "Total Views",  value: ytLoading ? "…" : fmt(channel?.viewCount) },
          { label: "Videos",       value: ytLoading ? "…" : fmt(channel?.videoCount) },
        ].map(s => (
          <div key={s.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8 }}>
            <span style={{ color: "#6b7280" }}>{s.label}</span>
            <span style={{ fontWeight: 600, color: NAVY }}>{s.value}</span>
          </div>
        ))}
        {lastUpdated && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>Updated {lastUpdated.toLocaleTimeString()}</div>}
      </div>

      {/* Checklist progress */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Readiness</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: checkedPct === 100 ? GREEN : NAVY, marginBottom: 4 }}>{checkedPct}%</div>
        <ProgressBar value={checkedPct} max={100} color={checkedPct === 100 ? GREEN : NAVY} />
        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>{totalChecked} / {totalItems} tasks done</div>
      </div>
    </div>
  );
}

// ── Main Dashboard ───────────────────────────────────────────────
export default function ChurchDashboard() {
  const [tab, setTab]     = useState("channel");
  const [checked, setChecked] = useState({});
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    setIsDesktop(mq.matches);
    const handler = e => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const { data: ytData, loading: ytLoading, error: ytError, lastUpdated } = useYouTubeData();
  const { live, checking: liveChecking } = useLiveStatus({ pollInterval: 60000 });

  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const today      = new Date().toISOString().split("T")[0];
  const { data: watchData, loading: watchLoading, oauthRequired: watchOauth } = useWatchHours({ startDate: oneYearAgo, endDate: today });

  const totalItems   = Object.values(CHECKLIST).flat().length;
  const totalChecked = Object.values(checked).filter(Boolean).length;
  const pct          = Math.round((totalChecked / totalItems) * 100);

  const tabs = [
    { id: "channel",   label: "Channel Stats" },
    { id: "checklist", label: "Sunday Checklist" },
    { id: "whatsapp",  label: "WhatsApp" },
  ];

  const header = (
    <div style={{ background: NAVY, padding: isDesktop ? "20px 28px 0" : "20px 24px 0", borderRadius: isDesktop ? "12px 12px 0 0" : 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ color: GOLD, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>Church IT Team</div>
          <div style={{ color: "#fff", fontSize: isDesktop ? 21 : 18, fontWeight: 700 }}>Sunday Operations Dashboard</div>
        </div>
        {!isDesktop && <LiveBadge live={live} checking={liveChecking} />}
      </div>

      {live?.isLive && (
        <div style={{ background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.4)", borderRadius: 8, padding: "8px 12px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#fca5a5", fontSize: 12 }}>🔴 {live.title}</span>
          <a href={live.url} target="_blank" rel="noopener noreferrer" style={{ color: "#fca5a5", fontSize: 11, textDecoration: "none" }}>Open ↗</a>
        </div>
      )}

      {!isDesktop && lastUpdated && (
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>
          Stats updated: {lastUpdated.toLocaleTimeString()}
        </div>
      )}

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
            flex: 1, padding: "9px 8px", border: "none", cursor: "pointer",
            fontSize: isDesktop ? 13 : 12, fontWeight: 600,
            background: tab === t.id ? "#fff" : "transparent",
            color: tab === t.id ? NAVY : "rgba(255,255,255,0.65)",
            borderRadius: tab === t.id ? "8px 8px 0 0" : 0,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
          }}>
            {t.id === "whatsapp" && (
              <svg width="13" height="13" viewBox="0 0 27 27" fill={tab === t.id ? WA_DARK : "rgba(255,255,255,0.65)"}><path d="M13.507 0C6.041 0 .013 6.028.013 13.494c0 2.378.627 4.707 1.818 6.745L0 27l6.948-1.809A13.459 13.459 0 0013.507 27C20.973 27 27 20.972 27 13.506 27 6.041 20.973.013 13.507.013z"/></svg>
            )}
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );

  const body = (
    <div style={{ background: "#f3f4f6", padding: isDesktop ? 20 : 16, borderRadius: isDesktop ? "0 0 12px 12px" : 0, flex: 1 }}>
      {tab === "channel" && (
        <ChannelTab ytData={ytData} ytLoading={ytLoading} ytError={ytError} watchData={watchData} watchLoading={watchLoading} watchOauth={watchOauth} />
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
      {tab === "whatsapp" && <WhatsAppTab live={live} />}
    </div>
  );

  // ── Responsive layout ────────────────────────────────────────
  if (isDesktop) {
    return (
      <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", maxWidth: 1100, margin: "0 auto", padding: "24px 24px" }}>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
          <DesktopSidebar
            live={live} liveChecking={liveChecking} ytData={ytData} ytLoading={ytLoading}
            lastUpdated={lastUpdated} checkedPct={pct} totalChecked={totalChecked} totalItems={totalItems}
          />
          <div style={{ flex: 1, minWidth: 0, borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
            {header}
            {body}
          </div>
        </div>
      </div>
    );
  }

  // Mobile layout
  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", maxWidth: 680, margin: "0 auto" }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      {header}
      {body}
    </div>
  );
}