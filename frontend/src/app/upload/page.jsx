'use client';

/**
 * UploadPage.jsx
 * ─────────────────────────────────────────────────────────────────
 * Service upload workflow — all YouTube operations happen via
 * direct fetch() calls to the YouTube Data API v3 from the browser.
 * No local Node scripts required.
 *
 * Only Step 3 (Whisper transcription) still runs locally as a CLI
 * command — everything else is done in-browser.
 *
 * Prerequisites:
 *   • A Google OAuth2 access token with youtube.upload + youtube scope
 *     (obtain via your existing scripts/authorise.js, then paste it here)
 *   • The video file selected via <input type="file">
 *   • The Whisper .srt output file selected via <input type="file">
 * ─────────────────────────────────────────────────────────────────
 */

import { useState, useRef, useCallback } from "react";

// ── Design tokens ────────────────────────────────────────────────
const T = {
  navy:    "#1B3A6B",
  navyL:   "#2a5298",
  gold:    "#C8A84B",
  goldL:   "#e0c068",
  green:   "#1a7a4a",
  greenL:  "#d1fae5",
  red:     "#b91c1c",
  grayBg:  "#f3f4f6",
  grayBd:  "#e5e7eb",
  grayT:   "#6b7280",
  white:   "#ffffff",
};

const STATUS = { IDLE: "idle", DONE: "done", ACTIVE: "active", LOADING: "loading" };

// ── Helpers ───────────────────────────────────────────────────────
function today() { return new Date().toISOString().split("T")[0]; }

function displayDate(dateStr) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
}

function buildTitle({ type, date, church, pastor, series }) {
  const d = displayDate(date);
  const s = series ? ` | ${series}` : "";
  const templates = {
    sunday:    `Sunday Service — ${d} | ${church}`,
    easter:    `Easter Sunday Service ${d} | ${church}`,
    christmas: `Christmas Service ${d} | ${church}`,
    special:   `Special Service — ${d} | ${church}`,
    friday:    `Friday Prayer Night — ${d} | ${church}`,
    midweek:   `Midweek Service — ${d} | ${church}`,
  };
  return (templates[type] || templates.sunday) + s;
}

function buildDescription({ type, church, pastor, series, mpesa, airtel, website, ytUrl }) {
  const s = series ? ` | ${series}` : "";
  return `Welcome to ${church}!

${type === "easter" ? "🙏 Celebrating the Resurrection of Jesus Christ this Easter Sunday.\n" : ""}${type === "christmas" ? "🎄 Celebrating the birth of Jesus Christ.\n" : ""}
📖 Join us as ${pastor} ministers the Word of God.${s}

───────────────────────────────────────
📍 Join us in person or follow us online:
   YouTube: ${ytUrl || "https://www.youtube.com/@" + church.replace(/\s+/g, "")}
   Website: ${website || ""}

💝 Support the Ministry (Online Giving):
   M-Pesa:   ${mpesa || ""}
   Airtel:   ${airtel || ""}
───────────────────────────────────────

👍 Like, Subscribe & Share this video with family and friends.
🔔 Turn on notifications to never miss a service.

#${church.replace(/\s+/g, "")} #Church #Tanzania #LiveService #Gospel`.trim();
}

// ── YouTube API helpers ───────────────────────────────────────────

/**
 * Resumable upload to YouTube Data API v3.
 * Uses the resumable upload protocol so large files work in-browser.
 */


async function uploadViaBackend({ file, snippet, status, accessToken, onProgress, onPhase }) {
  const formData = new FormData();
  formData.append("video", file);
  formData.append("snippet", JSON.stringify(snippet));
  formData.append("status", JSON.stringify(status));
  formData.append("accessToken", accessToken);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "http://localhost:4000/api/youtube/upload");

    let buffer = "";

    xhr.onprogress = () => {
      // Parse SSE chunks as they stream in
      const newData = xhr.responseText.slice(buffer.length);
      buffer = xhr.responseText;

      const lines = newData.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const msg = JSON.parse(line.slice(6));
            if (msg.type === "progress") {
              onProgress(msg.pct);
              if (onPhase) onPhase(msg.phase, msg.message);
            } else if (msg.type === "done") {
              resolve({ id: msg.id });
            } else if (msg.type === "error") {
              reject(new Error(msg.error));
            }
          } catch {}
        }
      }
    };

    xhr.onload = () => {
      // Parse any final messages if onprogress missed them
      const lines = xhr.responseText.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const msg = JSON.parse(line.slice(6));
            if (msg.type === "done") resolve({ id: msg.id });
            else if (msg.type === "error") reject(new Error(msg.error));
          } catch {}
        }
      }
    };

    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(formData);
  });
}

/**
 * Fetch current video snippet then PATCH description with chapters block.
 */

async function addChaptersToDescription({ videoId, chaptersText, accessToken }) {
  const res = await fetch("http://localhost:4000/api/youtube/upload/chapters", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoId, chaptersText, accessToken }),
  });

  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || `Chapters update failed: ${res.status}`);
  }

  return await res.json();
}


/**
 * Upload an SRT file as captions to a YouTube video.
 */

async function uploadSRT({ videoId, srtFile, language, accessToken }) {
  const formData = new FormData();
  formData.append("srt", srtFile);
  formData.append("videoId", videoId);
  formData.append("language", language);
  formData.append("accessToken", accessToken);

  const res = await fetch("http://localhost:4000/api/youtube/upload/captions", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || `Caption upload failed: ${res.status}`);
  }

  return await res.json();
}

/**
 * Parse a .srt or .json Whisper output and extract chapter timestamps.
 * Supports the Whisper JSON format (segments[].start / .text) and a plain
 * newline-separated "HH:MM:SS text" format.
 */
function parseChaptersFromFile(text) {
  // Try Whisper JSON
  try {
    const data = JSON.parse(text);
    if (Array.isArray(data.segments)) {
      const CHAPTER_PATTERNS = [
        { patterns: [/welcome|karibu|opening/i],        label: "Welcome & Opening Prayer" },
        { patterns: [/worship|praise|sifa|imba/i],       label: "Worship & Praise" },
        { patterns: [/announ/i],                         label: "Announcements" },
        { patterns: [/offering|sadaka|tithes/i],         label: "Tithes & Offering" },
        { patterns: [/sermon|message|neno|preaching/i],  label: "Sermon" },
        { patterns: [/altar|prayer line|waliokuja/i],    label: "Altar Call" },
        { patterns: [/closing|dismiss|end|tunaomba/i],   label: "Closing Prayer" },
      ];

      const chapters = [];
      let lastLabel = null;
      data.segments.forEach((seg) => {
        const t = seg.text.toLowerCase();
        for (const { patterns, label } of CHAPTER_PATTERNS) {
          if (patterns.some((p) => p.test(t)) && label !== lastLabel) {
            chapters.push({ startSeconds: Math.floor(seg.start), label });
            lastLabel = label;
            break;
          }
        }
      });
      if (!chapters.length || chapters[0].startSeconds > 30) {
        chapters.unshift({ startSeconds: 0, label: "Introduction" });
      }

      const fmt = (s) => {
        const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
        if (h > 0) return `${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
        return `${m}:${String(sec).padStart(2,"0")}`;
      };
      return chapters.map((c) => `${fmt(c.startSeconds)} ${c.label}`).join("\n");
    }
  } catch { /* not JSON */ }

  // Fallback: treat as plain "MM:SS Label" lines
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const timeLines = lines.filter(l => /^\d+:\d{2}/.test(l));
  if (timeLines.length) return timeLines.join("\n");

  return null;
}

// ── UI sub-components ─────────────────────────────────────────────

function SectionHeader({ step, label, status, onClick }) {
  const isActive = status === STATUS.ACTIVE || status === STATUS.LOADING;
  const isDone   = status === STATUS.DONE;
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 14,
        padding: "14px 20px", border: "none", cursor: "pointer",
        background: isActive ? T.navy : isDone ? "#f0fdf4" : T.white,
        borderBottom: `1px solid ${isActive ? "rgba(255,255,255,0.1)" : isDone ? "#bbf7d0" : T.grayBd}`,
        textAlign: "left", transition: "background 0.2s",
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 700, fontSize: 13,
        background: isActive ? T.gold : isDone ? T.green : T.grayBd,
        color: isActive ? T.navy : isDone ? T.white : T.grayT,
        boxShadow: isActive ? `0 0 0 3px ${T.gold}44` : "none",
        transition: "all 0.2s",
      }}>
        {status === STATUS.LOADING ? "⏳" : isDone ? "✓" : step}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: isActive ? T.white : isDone ? T.green : T.navy }}>
          {label}
        </div>
      </div>
      <div style={{
        fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99,
        background: isActive ? "rgba(255,255,255,0.15)" : isDone ? T.greenL : T.grayBg,
        color: isActive ? T.white : isDone ? T.green : T.grayT,
      }}>
        {status === STATUS.LOADING ? "Running…" : isActive ? "In Progress" : isDone ? "Done" : "Pending"}
      </div>
    </button>
  );
}

function InputField({ label, value, onChange, placeholder, type = "text", mono = false }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: T.grayT, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{
          width: "100%", padding: "9px 12px", fontSize: 13,
          border: `1px solid ${T.grayBd}`, borderRadius: 7, outline: "none",
          boxSizing: "border-box", fontFamily: mono ? "'Courier New', monospace" : "inherit",
          color: "#111827", background: T.white,
        }} />
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: T.grayT, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </label>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{
          width: "100%", padding: "9px 12px", fontSize: 13,
          border: `1px solid ${T.grayBd}`, borderRadius: 7, outline: "none",
          boxSizing: "border-box", fontFamily: "inherit", color: "#111827",
          background: T.white, appearance: "none",
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center",
        }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function FileField({ label, accept, onChange, file }) {
  const ref = useRef();
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: T.grayT, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </label>
      <div
        onClick={() => ref.current.click()}
        style={{
          border: `2px dashed ${file ? T.navy : T.grayBd}`, borderRadius: 8,
          padding: "12px 16px", cursor: "pointer",
          background: file ? "#eff6ff" : T.white,
          display: "flex", alignItems: "center", gap: 10,
          transition: "all 0.2s",
        }}>
        <span style={{ fontSize: 20 }}>{file ? "📹" : "📁"}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {file
            ? <><div style={{ fontWeight: 600, fontSize: 13, color: T.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{file.name}</div>
                <div style={{ fontSize: 11, color: T.grayT }}>{(file.size / 1024 / 1024).toFixed(1)} MB</div></>
            : <div style={{ fontSize: 13, color: T.grayT }}>Click to select file</div>}
        </div>
      </div>
      <input ref={ref} type="file" accept={accept} style={{ display: "none" }}
        onChange={e => onChange(e.target.files?.[0] || null)} />
    </div>
  );
}

function InfoBox({ children, type = "info" }) {
  const colors = {
    info:    { bg: "#eff6ff", border: "#bfdbfe", text: "#1e40af" },
    success: { bg: T.greenL,  border: "#bbf7d0", text: T.green },
    warn:    { bg: "#fffbeb", border: "#fde68a", text: "#92400e" },
    error:   { bg: "#fef2f2", border: "#fecaca", text: T.red },
  };
  const c = colors[type];
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: c.text, marginBottom: 12, lineHeight: 1.6 }}>
      {children}
    </div>
  );
}

function ProgressBar({ pct, label }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.grayT, marginBottom: 4 }}>
        <span>{label}</span><span style={{ fontWeight: 700 }}>{pct}%</span>
      </div>
      <div style={{ background: T.grayBd, borderRadius: 99, height: 8 }}>
        <div style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${T.navy}, ${T.navyL})`, height: "100%", borderRadius: 99, transition: "width 0.3s ease" }} />
      </div>
    </div>
  );
}

function ActionButton({ label, onClick, disabled, variant = "primary", loading }) {
  const styles = {
    primary:  { background: disabled ? T.grayBd : T.navy, color: disabled ? T.grayT : T.white, border: "none" },
    success:  { background: T.green, color: T.white, border: "none" },
    outline:  { background: T.white, color: T.navy, border: `2px solid ${T.navy}` },
  };
  const s = styles[variant];
  return (
    <button onClick={onClick} disabled={disabled || loading}
      style={{
        padding: "10px 20px", borderRadius: 8, fontWeight: 700, fontSize: 13,
        cursor: disabled || loading ? "not-allowed" : "pointer",
        display: "inline-flex", alignItems: "center", gap: 8,
        transition: "all 0.2s", opacity: loading ? 0.7 : 1,
        ...s,
      }}>
      {loading ? "⏳ " : ""}{label}
    </button>
  );
}

function CopyBox({ label, code }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ marginBottom: 12 }}>
      {label && <div style={{ fontSize: 11, fontWeight: 600, color: T.grayT, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>}
      <div style={{ background: "#0f172a", borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, fontFamily: "'Courier New', monospace" }}>
        <code style={{ flex: 1, fontSize: 12, color: "#e2e8f0", wordBreak: "break-all", lineHeight: 1.6 }}>{code}</code>
        <button onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          style={{ flexShrink: 0, background: copied ? T.green : "rgba(255,255,255,0.1)", border: "none", borderRadius: 5, padding: "5px 10px", color: T.white, fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "background 0.2s" }}>
          {copied ? "✓" : "Copy"}
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────
export default function UploadPage() {
  // OAuth
  const [accessToken, setAccessToken] = useState("");

  // Service config
  const [videoFile,  setVideoFile]  = useState(null);
  const [srtFile,    setSrtFile]    = useState(null);
  const [jsonFile,   setJsonFile]   = useState(null);
  const [videoId,    setVideoId]    = useState("");
  const [date,       setDate]       = useState(today());
  const [type,       setType]       = useState("sunday");
  const [pastor,     setPastor]     = useState("");
  const [series,     setSeries]     = useState("");
  const [church,     setChurch]     = useState("");
  const [mpesa,      setMpesa]      = useState("");
  const [airtel,     setAirtel]     = useState("");
  const [website,    setWebsite]    = useState("");
  const [ytUrl,      setYtUrl]      = useState("");
  const [language,   setLanguage]   = useState("sw");

  // Step statuses
  const [steps, setSteps] = useState({ config: STATUS.ACTIVE, upload: STATUS.IDLE, transcribe: STATUS.IDLE, chapters: STATUS.IDLE, subtitles: STATUS.IDLE });
  const [open, setOpen] = useState("config");

  // Per-step state
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError,    setUploadError]    = useState("");
  const [chaptersError,  setChaptersError]  = useState("");
  const [chaptersText,   setChaptersText]   = useState("");
  const [srtError,       setSrtError]       = useState("");
  const [configError,    setConfigError]    = useState("");

  function setStep(key, status) {
    setSteps(s => ({ ...s, [key]: status }));
  }
  function markDone(key, next) {
    setSteps(s => ({ ...s, [key]: STATUS.DONE, ...(next ? { [next]: STATUS.ACTIVE } : {}) }));
    if (next) setOpen(next);
  }
  function toggleOpen(key) { setOpen(p => p === key ? null : key); }

  // ── Step 1: Confirm config ──────────────────────────────────────
  function confirmConfig() {
    if (!church) { setConfigError("Church name is required."); return; }
    if (!videoFile) { setConfigError("Please select a video file."); return; }
    if (!accessToken) { setConfigError("Please enter your OAuth2 access token."); return; }
    setConfigError("");
    markDone("config", "upload");
  }

  // ── Step 2: Upload to YouTube via API ───────────────────────────

  
const [uploadPhase, setUploadPhase] = useState(""); // add this with other state

async function runUpload() {
  setUploadError("");
  setUploadProgress(0);
  setUploadPhase("");
  setStep("upload", STATUS.LOADING);

  const snippet = {
    title: buildTitle({ type, date, church, pastor, series }),
    description: buildDescription({ type, church, pastor, series, mpesa, airtel, website, ytUrl }),
    tags: [church, "church service", "Tanzania church", "gospel", "sermon", pastor, "Dar es Salaam church", displayDate(date)].filter(Boolean),
    categoryId: "29",
    defaultLanguage: "en",
  };
  const status = { privacyStatus: "public", selfDeclaredMadeForKids: false };

  try {
    const data = await uploadViaBackend({
      file: videoFile,
      snippet,
      status,
      accessToken,
      onProgress: setUploadProgress,
      onPhase: (phase, message) => setUploadPhase(message),
    });

    if (!data.id) throw new Error("No video ID returned from server");
    setVideoId(data.id);
    setUploadProgress(100);
    setUploadPhase("");
    setStep("upload", STATUS.ACTIVE);
  } catch (e) {
    setUploadError(e.message);
    setStep("upload", STATUS.ACTIVE);
  }

}
  // ── Step 4: Add chapters via API ────────────────────────────────
  async function runChapters() {
    setChaptersError("");
    if (!videoId) { setChaptersError("No video ID — complete Step 2 first."); return; }
    if (!jsonFile && !chaptersText) { setChaptersError("Select your Whisper .json file, or paste chapters text above."); return; }

    setStep("chapters", STATUS.LOADING);
    let text = chaptersText;

    if (jsonFile && !text) {
      try {
        text = await jsonFile.text();
        const parsed = parseChaptersFromFile(text);
        if (!parsed) throw new Error("Could not parse chapters from file.");
        text = parsed;
        setChaptersText(parsed);
      } catch (e) {
        setChaptersError(e.message);
        setStep("chapters", STATUS.ACTIVE);
        return;
      }
    }

    try {
      await addChaptersToDescription({ videoId, chaptersText: text, accessToken });
      markDone("chapters", "subtitles");
    } catch (e) {
      setChaptersError(e.message);
      setStep("chapters", STATUS.ACTIVE);
    }
  }

  // ── Step 5: Upload SRT via Captions API ─────────────────────────
  async function runSRTUpload() {
    setSrtError("");
    if (!videoId) { setSrtError("No video ID — complete Step 2 first."); return; }
    if (!srtFile) { setSrtError("Please select your .srt file."); return; }

    setStep("subtitles", STATUS.LOADING);
    try {
      await uploadSRT({ videoId, srtFile, language, accessToken });
      markDone("subtitles", null);
    } catch (e) {
      setSrtError(e.message);
      setStep("subtitles", STATUS.ACTIVE);
    }
  }

  const stepOrder = ["config", "upload", "transcribe", "chapters", "subtitles"];
  const totalDone = stepOrder.filter(k => steps[k] === STATUS.DONE).length;
  const pct = Math.round((totalDone / stepOrder.length) * 100);

  const whisperCmd = videoFile
    ? `whisper "${videoFile.name}" --model medium --language ${language} --output_format all`
    : `whisper recording.mp4 --model medium --language ${language} --output_format all`;

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", maxWidth: 700, margin: "0 auto", padding: "24px 16px", background: T.grayBg, minHeight: "100vh" }}>
      <style>{`
        input:focus, select:focus { border-color: ${T.navy} !important; box-shadow: 0 0 0 3px ${T.navy}22; }
        button:not(:disabled):hover { filter: brightness(1.08); }
        a:hover { opacity: 0.85; }
      `}</style>

      {/* Header */}
      <div style={{ background: T.navy, borderRadius: "12px 12px 0 0", padding: "20px 24px" }}>
        <div style={{ color: T.gold, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>IT Team</div>
        <div style={{ color: T.white, fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Service Upload Workflow</div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(255,255,255,0.6)", marginBottom: 6 }}>
          <span>Overall Progress</span>
          <span style={{ color: pct === 100 ? T.gold : "rgba(255,255,255,0.6)", fontWeight: 700 }}>{pct}%</span>
        </div>
        <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 99, height: 6 }}>
          <div style={{ width: `${pct}%`, background: pct === 100 ? T.gold : "#60a5fa", height: "100%", borderRadius: 99, transition: "width 0.4s ease" }} />
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 6 }}>{totalDone} of {stepOrder.length} steps completed</div>
      </div>

      <div style={{ background: T.white, borderRadius: "0 0 12px 12px", border: `1px solid ${T.grayBd}`, borderTop: "none", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>

        {/* ══ STEP 1: Configure ══ */}
        <SectionHeader step={1} label="Configure Service Details" status={steps.config} onClick={() => toggleOpen("config")} />
        {open === "config" && (
          <div style={{ padding: "20px 24px", borderBottom: `1px solid ${T.grayBd}` }}>
            <InfoBox>Set up your service details and credentials. These are used to build the YouTube title, description, and tags automatically.</InfoBox>

            {/* OAuth token */}
            <div style={{ background: "#fef9ec", border: "1px solid #fde68a", borderRadius: 8, padding: "12px 16px", marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: "#92400e", marginBottom: 6 }}>🔑 OAuth2 Access Token</div>
              <div style={{ fontSize: 12, color: "#78350f", marginBottom: 8, lineHeight: 1.6 }}>
                Run <code style={{ background: "#fde68a", padding: "1px 5px", borderRadius: 3 }}>node scripts/authorise.js</code> once to get a token, then paste it here. Tokens expire after ~1 hour; re-run authorise.js if you get auth errors.
              </div>
              <input value={accessToken} onChange={e => setAccessToken(e.target.value)}
                placeholder="ya29.A0..."
                style={{ width: "100%", padding: "9px 12px", fontSize: 12, border: "1px solid #fde68a", borderRadius: 7, outline: "none", boxSizing: "border-box", fontFamily: "'Courier New', monospace", color: "#111827", background: "#fffbeb" }} />
            </div>

            <FileField label="Video File" accept="video/*" file={videoFile} onChange={setVideoFile} />

            <InputField label="Church Name" value={church} onChange={setChurch} placeholder="Grace Community Church" />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <InputField label="Service Date" value={date} onChange={setDate} type="date" />
              <SelectField label="Service Type" value={type} onChange={setType} options={[
                { value: "sunday", label: "Sunday Service" },
                { value: "friday", label: "Friday Prayer Night" },
                { value: "midweek", label: "Midweek Service" },
                { value: "easter", label: "Easter Sunday" },
                { value: "christmas", label: "Christmas Service" },
                { value: "special", label: "Special Service" },
              ]} />
            </div>

            <InputField label="Preaching Pastor" value={pastor} onChange={setPastor} placeholder="Pastor John" />
            <InputField label="Sermon Series (optional)" value={series} onChange={setSeries} placeholder="Walking in Faith" />

            {/* Optional extras (collapsed) */}
            <details style={{ marginBottom: 12 }}>
              <summary style={{ fontSize: 12, fontWeight: 600, color: T.navyL, cursor: "pointer", marginBottom: 8 }}>
                ▸ Optional: giving & contact details (for description)
              </summary>
              <div style={{ paddingTop: 8 }}>
                <InputField label="M-Pesa Number" value={mpesa} onChange={setMpesa} placeholder="0712 345 678" />
                <InputField label="Airtel Money Number" value={airtel} onChange={setAirtel} placeholder="0682 345 678" />
                <InputField label="Church Website" value={website} onChange={setWebsite} placeholder="https://church.org" />
                <InputField label="YouTube Channel URL" value={ytUrl} onChange={setYtUrl} placeholder="https://youtube.com/@church" />
              </div>
            </details>

            <SelectField label="Subtitle Language" value={language} onChange={setLanguage} options={[
              { value: "sw", label: "Swahili (sw)" },
              { value: "en", label: "English (en)" },
            ]} />

            {configError && <InfoBox type="error">⚠️ {configError}</InfoBox>}

            {date && <div style={{ fontSize: 12, color: T.grayT, marginBottom: 12 }}>📅 Formatted date: <strong>{displayDate(date)}</strong></div>}

            <ActionButton label="Confirm Details → Go to Upload" onClick={confirmConfig} />
          </div>
        )}

        {/* ══ STEP 2: Upload ══ */}
        <SectionHeader step={2} label="Upload Video to YouTube" status={steps.upload} onClick={() => toggleOpen("upload")} />
        {open === "upload" && (
          <div style={{ padding: "20px 24px", borderBottom: `1px solid ${T.grayBd}` }}>
            <InfoBox>
              The video is uploaded directly from your browser to YouTube using the YouTube Data API v3. No local scripts needed.
            </InfoBox>

            {videoFile && (
              <div style={{ background: T.grayBg, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: T.grayT, marginBottom: 12 }}>
                📹 <strong>{videoFile.name}</strong> · {(videoFile.size / 1024 / 1024).toFixed(1)} MB
                <div style={{ marginTop: 4 }}>
                  <strong>Title:</strong> {buildTitle({ type, date, church, pastor, series })}
                </div>
              </div>
            )}

{steps.upload === STATUS.LOADING && (
  <>
    <ProgressBar
      pct={uploadProgress}
      label={uploadPhase || "Preparing upload..."}
    />
    {uploadProgress >= 100 && (
      <InfoBox type="warn">
        ⏳ Finalising on YouTube — do not close this tab.
      </InfoBox>
    )}
  </>
)}

     {uploadError && <InfoBox type="error">❌ {uploadError}</InfoBox>}

            {videoId && steps.upload !== STATUS.LOADING && (
              <InfoBox type="success">
                ✅ Upload complete!<br />
                Video ID: <strong>{videoId}</strong><br />
                <a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener noreferrer" style={{ color: T.green, fontWeight: 600 }}>
                  https://www.youtube.com/watch?v={videoId}
                </a>
              </InfoBox>
            )}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {!videoId && (
                <ActionButton label="Upload Now" onClick={runUpload}
                  disabled={!videoFile || !accessToken}
                  loading={steps.upload === STATUS.LOADING} />
              )}
              {videoId && steps.upload !== STATUS.DONE && (
                <ActionButton label="Continue → Transcribe" variant="success"
                  onClick={() => markDone("upload", "transcribe")} />
              )}
            </div>

            {!videoFile && <div style={{ fontSize: 12, color: T.grayT, marginTop: 8 }}>Go back to Step 1 to select a video file.</div>}
          </div>
        )}

        {/* ══ STEP 3: Transcribe (local Whisper only) ══ */}
        <SectionHeader step={3} label="Transcribe Locally with Whisper" status={steps.transcribe} onClick={() => toggleOpen("transcribe")} />
        {open === "transcribe" && (
          <div style={{ padding: "20px 24px", borderBottom: `1px solid ${T.grayBd}` }}>
            <InfoBox>
              Whisper runs <strong>locally on your machine</strong> — free, offline, handles Swahili + English. This step generates the <code style={{ background: "#e0e7ff", padding: "1px 5px", borderRadius: 3 }}>.srt</code> and <code style={{ background: "#e0e7ff", padding: "1px 5px", borderRadius: 3 }}>.json</code> files you'll need in the next two steps.
            </InfoBox>

            <CopyBox label="Run in PowerShell (same folder as your video)" code={whisperCmd} />

            <InfoBox type="warn">
              ⏳ On CPU this takes roughly <strong>1 hour per 90-minute service</strong>. Minimise PowerShell and let it run. Do not close the window.
            </InfoBox>

            <div style={{ fontSize: 12, color: T.grayT, marginBottom: 16 }}>
              <strong>Output files Whisper creates:</strong>
              <ul style={{ margin: "6px 0 0 0", paddingLeft: 18, lineHeight: 2 }}>
                <li><code>recording.json</code> — timestamped segments → upload in Step 4</li>
                <li><code>recording.srt</code> — subtitle captions → upload in Step 5</li>
                <li><code>recording.txt</code> — plain text transcript</li>
                <li><code>recording.vtt</code> — web subtitles</li>
              </ul>
            </div>

            <ActionButton label="Transcription Done → Add Chapters"
              onClick={() => markDone("transcribe", "chapters")} />
          </div>
        )}

        {/* ══ STEP 4: Chapters via API ══ */}
        <SectionHeader step={4} label="Add Chapters to YouTube Description" status={steps.chapters} onClick={() => toggleOpen("chapters")} />
        {open === "chapters" && (
          <div style={{ padding: "20px 24px", borderBottom: `1px solid ${T.grayBd}` }}>
            <InfoBox>
              Select your Whisper <code style={{ background: "#e0e7ff", padding: "1px 5px", borderRadius: 3 }}>.json</code> output. The app detects chapter boundaries (Worship, Sermon, Altar Call…) and updates the YouTube description directly via the API — no script needed.
            </InfoBox>

            {!videoId && <InfoBox type="error">⚠️ No Video ID — complete Step 2 first.</InfoBox>}

            <FileField label="Whisper .json output file" accept=".json"
              file={jsonFile}
              onChange={(f) => {
                setJsonFile(f);
                setChaptersText("");
                if (f) {
                  f.text().then(text => {
                    const parsed = parseChaptersFromFile(text);
                    if (parsed) setChaptersText(parsed);
                  });
                }
              }} />

            {chaptersText && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.grayT, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Detected Chapters (editable)
                </div>
                <textarea value={chaptersText} onChange={e => setChaptersText(e.target.value)}
                  style={{
                    width: "100%", minHeight: 140, padding: "10px 12px", fontSize: 12,
                    border: `1px solid ${T.grayBd}`, borderRadius: 7, outline: "none",
                    boxSizing: "border-box", fontFamily: "'Courier New', monospace",
                    color: "#111827", background: "#0f172a", color: "#e2e8f0",
                    lineHeight: 1.8, resize: "vertical",
                  }} />
                <div style={{ fontSize: 11, color: T.grayT, marginTop: 4 }}>
                  Each line: <code>MM:SS Label</code> or <code>H:MM:SS Label</code>. First chapter must start at <code>0:00</code>.
                </div>
              </div>
            )}

            {chaptersError && <InfoBox type="error">❌ {chaptersError}</InfoBox>}

            <ActionButton label="Add Chapters to YouTube" onClick={runChapters}
              disabled={!videoId || (!jsonFile && !chaptersText)}
              loading={steps.chapters === STATUS.LOADING} />
          </div>
        )}

        {/* ══ STEP 5: SRT via Captions API ══ */}
        <SectionHeader step={5} label="Upload Subtitles to YouTube" status={steps.subtitles} onClick={() => toggleOpen("subtitles")} />
        {open === "subtitles" && (
          <div style={{ padding: "20px 24px" }}>
            <InfoBox>
              Select your Whisper <code style={{ background: "#e0e7ff", padding: "1px 5px", borderRadius: 3 }}>.srt</code> file and it will be uploaded directly to YouTube via the Captions API — no manual YouTube Studio upload needed.
            </InfoBox>

            {!videoId && <InfoBox type="error">⚠️ No Video ID — complete Step 2 first.</InfoBox>}

            <FileField label="Whisper .srt subtitle file" accept=".srt" file={srtFile} onChange={setSrtFile} />

            {srtError && <InfoBox type="error">❌ {srtError}</InfoBox>}

            <ActionButton label="Upload Subtitles to YouTube" onClick={runSRTUpload}
              disabled={!videoId || !srtFile}
              loading={steps.subtitles === STATUS.LOADING} />

            {steps.subtitles === STATUS.DONE && (
              <div style={{ marginTop: 20, background: `linear-gradient(135deg, ${T.navy}, ${T.navyL})`, borderRadius: 12, padding: "20px 24px", textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
                <div style={{ color: T.gold, fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Service Published!</div>
                <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, marginBottom: 16 }}>
                  Video is live on YouTube with chapters and subtitles.
                </div>
                {videoId && (
                  <a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener noreferrer"
                    style={{ display: "inline-block", padding: "10px 24px", borderRadius: 8, background: T.gold, color: T.navy, fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
                    View on YouTube ↗
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ textAlign: "center", fontSize: 11, color: T.grayT, marginTop: 16 }}>
        Whisper: run locally in PowerShell · All other steps: direct YouTube API calls from browser
      </div>
    </div>
  );
}