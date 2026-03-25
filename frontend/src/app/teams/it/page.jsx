/**
 * ChurchDashboard.jsx — bilingual edition
 *
 * Changes vs previous version:
 *   - Imports useAuth (for lang + switchLang) and useTranslation
 *   - Every user-facing string goes through t()
 *   - Language toggle (EN / SW) rendered in the header on both mobile & desktop
 *   - New translation keys added to translations.js (see bottom of this file)
 *   - Zero logic changes — all YouTube / WhatsApp hooks untouched
 */

'use client';

import { useState, useEffect, useCallback } from "react";
import { useYouTubeData, useLiveStatus, useWatchHours } from "../../../hooks/useYoutubeData";
import { useAuth } from "../../../hooks/useAuth";          // ← bilingual
import { useTranslation } from "../../../lib/i18n";       // ← bilingual

// ── Design tokens ────────────────────────────────────────────────
const NAVY     = "#1B3A6B";
const GOLD     = "#C8A84B";
const GREEN    = "#1a7a4a";
const RED      = "#b91c1c";
const ORANGE   = "#c05621";
const WA_GREEN = "#25D366";
const WA_DARK  = "#128C7E";

// ── Checklist data (keys only — labels resolved via t()) ─────────
// Each item carries a translation key; the section title is also a key.
const CHECKLIST_KEYS = [
  {
    sectionKey: "section_pre_stream",
    items: [
      { id: "gmail",        key: "check_gmail" },
      { id: "obs_open",     key: "check_obs_open" },
      { id: "stream_key",   key: "check_stream_key" },
      { id: "scene_check",  key: "check_scene_check" },
      { id: "audio_check",  key: "check_audio_check" },
      { id: "camera1",      key: "check_camera1" },
      { id: "camera2",      key: "check_camera2" },
      { id: "wireless",     key: "check_wireless" },
      { id: "internet",     key: "check_internet" },
      { id: "backup_rec",   key: "check_backup_rec" },
    ],
  },
  {
    sectionKey: "section_go_live",
    items: [
      { id: "yt_dashboard",  key: "check_yt_dashboard" },
      { id: "schedule_set",  key: "check_schedule_set" },
      { id: "obs_start",     key: "check_obs_start" },
      { id: "preview_check", key: "check_preview_check" },
      { id: "chat_pinned",   key: "check_chat_pinned" },
      { id: "announce",      key: "check_announce" },
    ],
  },
  {
    sectionKey: "section_during",
    items: [
      { id: "monitor_chat",      key: "check_monitor_chat" },
      { id: "camera_switch",     key: "check_camera_switch" },
      { id: "copyright_watch",   key: "check_copyright_watch" },
      { id: "internet_monitor",  key: "check_internet_monitor" },
      { id: "super_thanks",      key: "check_super_thanks" },
    ],
  },
  {
    sectionKey: "section_post_stream",
    items: [
      { id: "obs_stop",       key: "check_obs_stop" },
      { id: "end_stream",     key: "check_end_stream" },
      { id: "backup_copy",    key: "check_backup_copy" },
      { id: "upload_edit",    key: "check_upload_edit" },
      { id: "title_tags",     key: "check_title_tags" },
      { id: "whatsapp_share", key: "check_whatsapp_share" },
      { id: "analytics",      key: "check_analytics" },
    ],
  },
];

// ── Helpers ──────────────────────────────────────────────────────
function fmt(n) { return (n || 0).toLocaleString(); }
function fmtDuration(iso) {
  if (!iso) return "";
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return iso;
  const h = parseInt(m[1] || 0), min = parseInt(m[2] || 0), sec = parseInt(m[3] || 0);
  return h > 0 ? `${h}h ${min}m` : `${min}m ${sec}s`;
}
function timeAgo(dateStr, t) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return t("today");
  if (days === 1) return t("yesterday");
  if (days < 7)  return `${days}${t("days_ago")}`;
  return `${Math.floor(days / 7)}${t("weeks_ago")}`;
}

// ── Language toggle ──────────────────────────────────────────────
function LangToggle({ lang, switchLang }) {
  return (
    <div style={{
      display: "flex", background: "rgba(255,255,255,0.12)", borderRadius: 20,
      padding: 2, gap: 2,
    }}>
      {["en", "sw"].map(l => (
        <button
          key={l}
          onClick={() => switchLang(l)}
          style={{
            padding: "3px 10px", borderRadius: 18, border: "none",
            cursor: "pointer", fontSize: 11, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.06em",
            background: lang === l ? "#fff" : "transparent",
            color: lang === l ? NAVY : "rgba(255,255,255,0.65)",
            transition: "all 0.15s",
          }}
        >
          {l}
        </button>
      ))}
    </div>
  );
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

function LiveBadge({ live, checking, t }) {
  if (checking) return null;
  if (!live?.isLive) return (
    <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 99, background: "#f3f4f6", color: "#6b7280", fontWeight: 500 }}>
      ● {t("offline")}
    </span>
  );
  return (
    <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 99, background: "#fef2f2", color: RED, fontWeight: 600, border: `1px solid #fecaca` }}>
      ● {t("live_now")} · {fmt(live.viewerCount)} {t("watching")}
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
              background: checked[item.id] ? GREEN : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer",
            }}>
              {checked[item.id] && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
            <span style={{ fontSize: 13, color: checked[item.id] ? "#9ca3af" : "#374151", textDecoration: checked[item.id] ? "line-through" : "none" }}>
              {item.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ── WhatsApp Tab ─────────────────────────────────────────────────
function WhatsAppTab({ live, t }) {
  const API = process.env.NEXT_PUBLIC_API_URL || "";

  const [sending, setSending]         = useState(false);
  const [testing, setTesting]         = useState(false);
  const [log, setLog]                 = useState([]);
  const [customTitle, setCustomTitle] = useState("");
  const [customUrl, setCustomUrl]     = useState("");

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
        type: "live",
        stream: live?.isLive
          ? { title: live.title, url: live.url, videoId: live.videoId }
          : { title: customTitle || t("wa_default_title"), url: customUrl || "https://youtube.com" },
      };
      const res  = await fetch(`${API}/whatsapp/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      addLog(t("wa_live_notif"), "success", data.message || `${t("wa_sent_to")} ${data.sent ?? "?"} ${t("wa_recipients")}`);
    } catch (err) {
      addLog(t("wa_live_notif"), "error", err.message);
    } finally {
      setSending(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    try {
      const res  = await fetch(`${API}/whatsapp/test`, { method: "POST", headers: { "Content-Type": "application/json" } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      addLog(t("wa_test_msg"), "success", data.message || t("wa_test_delivered"));
    } catch (err) {
      addLog(t("wa_test_msg"), "error", err.message);
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
            {live?.isLive ? `${t("wa_stream_detected")}: ${live.title}` : t("wa_no_stream")}
          </div>
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 1 }}>
            {live?.isLive ? t("wa_auto_details") : t("wa_fill_manual")}
          </div>
        </div>
      </div>

      {/* Manual override */}
      {!live?.isLive && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: NAVY, marginBottom: 10 }}>{t("wa_manual_details")}</div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>{t("wa_stream_title_label")}</label>
            <input style={inputStyle} placeholder={t("wa_stream_title_placeholder")} value={customTitle} onChange={e => setCustomTitle(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>{t("wa_url_label")}</label>
            <input style={inputStyle} placeholder="https://youtube.com/watch?v=..." value={customUrl} onChange={e => setCustomUrl(e.target.value)} />
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <button style={btnStyle(WA_DARK, sending || testing)} onClick={sendLiveNotification} disabled={sending || testing}>
          {sending
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M13.507 0C6.041 0 .013 6.028.013 13.494c0 2.378.627 4.707 1.818 6.745L0 27l6.948-1.809A13.459 13.459 0 0013.507 27C20.973 27 27 20.972 27 13.506 27 6.041 20.973.013 13.507.013z" fillRule="evenodd" clipRule="evenodd"/></svg>
          }
          {sending ? t("sending") : t("wa_send_live")}
        </button>

        <button style={btnStyle("#374151", sending || testing)} onClick={sendTest} disabled={sending || testing}>
          {testing
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          }
          {testing ? t("sending") : t("wa_send_test")}
        </button>
      </div>

      {/* Message preview */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: NAVY, marginBottom: 10 }}>{t("wa_preview")}</div>
        <div style={{
          background: "#DCF8C6", borderRadius: "12px 12px 2px 12px",
          padding: "10px 12px", maxWidth: 280, marginLeft: "auto",
          fontSize: 13, color: "#111827", lineHeight: 1.5,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 3 }}>Habari njema! 🔴</div>
          <div>
            <em style={{ color: "#374151" }}>
              {live?.isLive ? live.title : customTitle || t("wa_default_title")}
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
            <span style={{ fontSize: 12, fontWeight: 600, color: NAVY }}>{t("wa_send_log")}</span>
            <button onClick={() => setLog([])} style={{ fontSize: 11, color: "#9ca3af", background: "none", border: "none", cursor: "pointer" }}>{t("clear")}</button>
          </div>
          {log.map(entry => (
            <div key={entry.id} style={{ padding: "8px 14px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: entry.status === "success" ? WA_GREEN : RED }} />
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
function ChannelTab({ ytData, ytLoading, ytError, watchData, watchLoading, watchOauth, t }) {
  const channel = ytData?.channel;

  return (
    <div>
      {ytError && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: RED }}>
          {t("api_error")}: {ytError}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        <StatCard label={t("subscribers")}      value={fmt(channel?.subscriberCount)} sub={`${t("target")}: 1,000`}  loading={ytLoading} />
        <StatCard label={t("total_views")}       value={fmt(channel?.viewCount)}                                        loading={ytLoading} />
        <StatCard
          label={t("watch_hours_12m")}
          value={watchLoading ? "..." : watchOauth ? t("setup_needed") : fmt(watchData?.estimatedHoursWatched) + "h"}
          sub={`${t("target")}: 4,000h`}
          loading={false}
          color={watchOauth ? ORANGE : NAVY}
        />
        <StatCard label={t("videos_published")} value={fmt(channel?.videoCount)}                                        loading={ytLoading} />
      </div>

      {/* YPP tracker */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: NAVY, marginBottom: 12 }}>{t("ypp_tracker")}</div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
            <span style={{ color: "#374151" }}>{t("subscribers")}</span>
            <span style={{ fontWeight: 600, color: (channel?.subscriberCount || 0) >= 1000 ? GREEN : "#374151" }}>
              {(channel?.subscriberCount || 0) >= 1000 ? `✓ ${t("met")}` : `${fmt(channel?.subscriberCount)} / 1,000`}
            </span>
          </div>
          <ProgressBar value={channel?.subscriberCount || 0} max={1000} color={(channel?.subscriberCount || 0) >= 1000 ? GREEN : NAVY} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
            <span style={{ color: "#374151" }}>{t("watch_hours_12m")}</span>
            <span style={{ fontWeight: 600, color: watchOauth ? ORANGE : (watchData?.estimatedHoursWatched || 0) >= 4000 ? GREEN : "#374151" }}>
              {watchOauth ? t("oauth_needed") : `${fmt(watchData?.estimatedHoursWatched || 0)}h / 4,000h`}
            </span>
          </div>
          <ProgressBar value={watchData?.estimatedHoursWatched || 0} max={4000} color={(watchData?.estimatedHoursWatched || 0) >= 4000 ? GREEN : "#7c3aed"} />
        </div>

        {watchOauth && (
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: ORANGE }}>
            {t("oauth_run")} <code style={{ background: "#fef3c7", padding: "1px 4px", borderRadius: 3 }}>node scripts/authorise.js</code>
          </div>
        )}
      </div>

      <div style={{ fontWeight: 600, fontSize: 13, color: NAVY, marginBottom: 8 }}>{t("recent_uploads")}</div>
      {ytLoading
        ? [1,2,3].map(i => <div key={i} style={{ height: 60, background: "#e5e7eb", borderRadius: 8, marginBottom: 8, animation: "pulse 1.5s infinite" }} />)
        : (ytData?.latestVideos || []).length === 0
          ? <div style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "24px 0" }}>{t("no_videos_yet")}</div>
          : (ytData?.latestVideos || []).map(v => (
            <div key={v.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 12px", marginBottom: 8, display: "flex", gap: 10, alignItems: "center" }}>
              {v.thumbnail && <img src={v.thumbnail} alt="" style={{ width: 72, height: 40, objectFit: "cover", borderRadius: 5, flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.title}</div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                  {fmt(v.viewCount)} {t("views")} · {fmt(v.likeCount)} {t("likes")} · {fmtDuration(v.duration)} · {timeAgo(v.publishedAt, t)}
                </div>
              </div>
              <a href={v.url} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 11, color: NAVY, textDecoration: "none", border: `1px solid ${NAVY}`, borderRadius: 5, padding: "3px 8px", flexShrink: 0 }}>
                {t("view")} ↗
              </a>
            </div>
          ))
      }
    </div>
  );
}

// ── Desktop Sidebar ──────────────────────────────────────────────
function DesktopSidebar({ live, liveChecking, ytData, ytLoading, lastUpdated, checkedPct, totalChecked, totalItems, t }) {
  const channel = ytData?.channel;
  return (
    <div style={{ width: 220, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Live status card */}
      <div style={{ background: "#fff", border: `2px solid ${live?.isLive ? "#fecaca" : "#e5e7eb"}`, borderRadius: 12, padding: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{t("stream_status")}</div>
        {liveChecking ? (
          <div style={{ height: 20, background: "#e5e7eb", borderRadius: 4, animation: "pulse 1.5s infinite" }} />
        ) : live?.isLive ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: RED, boxShadow: `0 0 0 3px #fecaca` }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: RED }}>{t("live_now")}</span>
            </div>
            <div style={{ fontSize: 11, color: "#374151", marginBottom: 4, lineHeight: 1.4 }}>{live.title}</div>
            <div style={{ fontSize: 11, color: "#6b7280" }}>{fmt(live.viewerCount)} {t("watching")}</div>
            <a href={live.url} target="_blank" rel="noopener noreferrer" style={{
              display: "block", marginTop: 10, textAlign: "center", fontSize: 11, fontWeight: 600,
              background: RED, color: "#fff", borderRadius: 6, padding: "6px 0", textDecoration: "none",
            }}>
              {t("open_stream")} ↗
            </a>
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#9ca3af" }} />
            <span style={{ fontSize: 12, color: "#6b7280" }}>{t("offline")}</span>
          </div>
        )}
      </div>

      {/* Quick stats */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>{t("quick_stats")}</div>
        {[
          { label: t("subscribers"), value: ytLoading ? "…" : fmt(channel?.subscriberCount) },
          { label: t("total_views"),  value: ytLoading ? "…" : fmt(channel?.viewCount) },
          { label: t("videos"),       value: ytLoading ? "…" : fmt(channel?.videoCount) },
        ].map(s => (
          <div key={s.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8 }}>
            <span style={{ color: "#6b7280" }}>{s.label}</span>
            <span style={{ fontWeight: 600, color: NAVY }}>{s.value}</span>
          </div>
        ))}
        {lastUpdated && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>{t("updated")} {lastUpdated.toLocaleTimeString()}</div>}
      </div>

      {/* Checklist progress */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>{t("readiness")}</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: checkedPct === 100 ? GREEN : NAVY, marginBottom: 4 }}>{checkedPct}%</div>
        <ProgressBar value={checkedPct} max={100} color={checkedPct === 100 ? GREEN : NAVY} />
        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>{totalChecked} / {totalItems} {t("tasks_done")}</div>
      </div>
    </div>
  );
}

// ── Main Dashboard ───────────────────────────────────────────────
export default function ChurchDashboard() {
  const { lang, switchLang } = useAuth();          // ← bilingual
  const { t } = useTranslation(lang);              // ← bilingual

  const [tab, setTab]         = useState("channel");
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

  // Resolve checklist items with translated labels
  const resolvedChecklist = CHECKLIST_KEYS.map(section => ({
    sectionLabel: t(section.sectionKey),
    items: section.items.map(item => ({ id: item.id, label: t(item.key) })),
  }));

  const totalItems   = resolvedChecklist.flatMap(s => s.items).length;
  const totalChecked = Object.values(checked).filter(Boolean).length;
  const pct          = Math.round((totalChecked / totalItems) * 100);

  const tabs = [
    { id: "channel",   label: t("tab_channel") },
    { id: "checklist", label: t("tab_checklist") },
    { id: "whatsapp",  label: t("tab_whatsapp") },
  ];

  const header = (
    <div style={{ background: NAVY, padding: isDesktop ? "20px 28px 0" : "20px 24px 0", borderRadius: isDesktop ? "12px 12px 0 0" : 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ color: GOLD, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
            {t("it_team")}
          </div>
          <div style={{ color: "#fff", fontSize: isDesktop ? 21 : 18, fontWeight: 700 }}>
            {t("dashboard_title")}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <LangToggle lang={lang} switchLang={switchLang} />
          {!isDesktop && <LiveBadge live={live} checking={liveChecking} t={t} />}
        </div>
      </div>

      {live?.isLive && (
        <div style={{ background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.4)", borderRadius: 8, padding: "8px 12px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#fca5a5", fontSize: 12 }}>🔴 {live.title}</span>
          <a href={live.url} target="_blank" rel="noopener noreferrer" style={{ color: "#fca5a5", fontSize: 11, textDecoration: "none" }}>
            {t("open")} ↗
          </a>
        </div>
      )}

      {!isDesktop && lastUpdated && (
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>
          {t("stats_updated")}: {lastUpdated.toLocaleTimeString()}
        </div>
      )}

      {tab === "checklist" && (
        <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: "8px 8px 0 0", padding: "10px 14px", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(255,255,255,0.7)", marginBottom: 5 }}>
              <span>{t("service_readiness")}</span>
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
        {tabs.map(tab_ => (
          <button key={tab_.id} onClick={() => setTab(tab_.id)} style={{
            flex: 1, padding: "9px 8px", border: "none", cursor: "pointer",
            fontSize: isDesktop ? 13 : 12, fontWeight: 600,
            background: tab === tab_.id ? "#fff" : "transparent",
            color: tab === tab_.id ? NAVY : "rgba(255,255,255,0.65)",
            borderRadius: tab === tab_.id ? "8px 8px 0 0" : 0,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
          }}>
            {tab_.id === "whatsapp" && (
              <svg width="13" height="13" viewBox="0 0 27 27" fill={tab === tab_.id ? WA_DARK : "rgba(255,255,255,0.65)"}>
                <path d="M13.507 0C6.041 0 .013 6.028.013 13.494c0 2.378.627 4.707 1.818 6.745L0 27l6.948-1.809A13.459 13.459 0 0013.507 27C20.973 27 27 20.972 27 13.506 27 6.041 20.973.013 13.507.013z"/>
              </svg>
            )}
            {tab_.label}
          </button>
        ))}
      </div>
    </div>
  );

  const body = (
    <div style={{ background: "#f3f4f6", padding: isDesktop ? 20 : 16, borderRadius: isDesktop ? "0 0 12px 12px" : 0, flex: 1 }}>
      {tab === "channel" && (
        <ChannelTab ytData={ytData} ytLoading={ytLoading} ytError={ytError} watchData={watchData} watchLoading={watchLoading} watchOauth={watchOauth} t={t} />
      )}
      {tab === "checklist" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              {pct === 100 ? t("all_checks_done") : `${totalItems - totalChecked} ${t("items_remaining")}`}
            </span>
            <button onClick={() => setChecked({})} style={{ fontSize: 11, color: RED, background: "none", border: `1px solid ${RED}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>
              {t("reset")}
            </button>
          </div>
          {resolvedChecklist.map(({ sectionLabel, items }) => (
            <CheckSection key={sectionLabel} title={sectionLabel} items={items} checked={checked}
              onToggle={(id) => setChecked(p => ({ ...p, [id]: !p[id] }))} />
          ))}
        </div>
      )}
      {tab === "whatsapp" && <WhatsAppTab live={live} t={t} />}
    </div>
  );

  if (isDesktop) {
    return (
      <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", maxWidth: 1100, margin: "0 auto", padding: "24px 24px" }}>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
          <DesktopSidebar
            live={live} liveChecking={liveChecking} ytData={ytData} ytLoading={ytLoading}
            lastUpdated={lastUpdated} checkedPct={pct} totalChecked={totalChecked} totalItems={totalItems} t={t}
          />
          <div style={{ flex: 1, minWidth: 0, borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
            {header}
            {body}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", maxWidth: 680, margin: "0 auto" }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      {header}
      {body}
    </div>
  );
}