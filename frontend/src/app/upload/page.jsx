'use client';

/**
 * UploadPage.jsx
 * ─────────────────────────────────────────────────────────────────
 * A step-by-step service upload workflow page.
 * Matches ChurchDashboard navy + gold design tokens.
 *
 * Steps:
 *   1. Configure service details (date, type, pastor, series)
 *   2. Upload video to YouTube  →  node scripts/upload.js
 *   3. Transcribe locally       →  whisper "file.mp4" --model medium --language sw
 *   4. Add chapters             →  node scripts/transcribe.js --id VIDEO_ID
 *   5. Upload SRT subtitles     →  YouTube Studio manual step
 *
 * No backend required — shows live command previews and tracks
 * what the user has completed via checkbox confirmation.
 * ─────────────────────────────────────────────────────────────────
 */

import { useState, useRef } from "react";

// ── Design tokens (match ChurchDashboard) ────────────────────────
const NAVY     = "#1B3A6B";
const NAVY_L   = "#2a5298";
const GOLD     = "#C8A84B";
const GOLD_L   = "#e0c068";
const GREEN    = "#1a7a4a";
const GREEN_L  = "#d1fae5";
const RED      = "#b91c1c";
const GRAY_BG  = "#f3f4f6";
const GRAY_BD  = "#e5e7eb";
const GRAY_T   = "#6b7280";
const WHITE    = "#ffffff";

// ── Step states ───────────────────────────────────────────────────
const STATUS = { IDLE: "idle", DONE: "done", ACTIVE: "active" };

// ── Helpers ───────────────────────────────────────────────────────
function today() {
  return new Date().toISOString().split("T")[0];
}
function displayDate(dateStr) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
}
function escapePath(p) {
  // Wrap in quotes; if it has spaces it'll still work
  return `"${p}"`;
}

// ── Sub-components ────────────────────────────────────────────────

function SectionHeader({ step, label, status, onClick }) {
  const isActive = status === STATUS.ACTIVE;
  const isDone   = status === STATUS.DONE;
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 14,
        padding: "14px 20px", border: "none", cursor: "pointer",
        background: isActive ? NAVY : isDone ? "#f0fdf4" : WHITE,
        borderBottom: `1px solid ${isActive ? "rgba(255,255,255,0.1)" : isDone ? "#bbf7d0" : GRAY_BD}`,
        textAlign: "left", transition: "background 0.2s",
      }}
    >
      {/* Step badge */}
      <div style={{
        width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 700, fontSize: 13,
        background: isActive ? GOLD : isDone ? GREEN : GRAY_BD,
        color: isActive ? NAVY : isDone ? WHITE : GRAY_T,
        boxShadow: isActive ? `0 0 0 3px ${GOLD}44` : "none",
        transition: "all 0.2s",
      }}>
        {isDone ? "✓" : step}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{
          fontWeight: 700, fontSize: 14,
          color: isActive ? WHITE : isDone ? GREEN : NAVY,
        }}>{label}</div>
      </div>
      <div style={{
        fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99,
        background: isActive ? "rgba(255,255,255,0.15)" : isDone ? GREEN_L : GRAY_BG,
        color: isActive ? WHITE : isDone ? GREEN : GRAY_T,
      }}>
        {isActive ? "In Progress" : isDone ? "Done" : "Pending"}
      </div>
    </button>
  );
}

function CopyBox({ label, code }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <div style={{ marginBottom: 12 }}>
      {label && <div style={{ fontSize: 11, fontWeight: 600, color: GRAY_T, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>}
      <div style={{
        background: "#0f172a", borderRadius: 8, padding: "10px 14px",
        display: "flex", alignItems: "center", gap: 10,
        fontFamily: "'Courier New', monospace",
      }}>
        <code style={{ flex: 1, fontSize: 12, color: "#e2e8f0", wordBreak: "break-all", lineHeight: 1.6 }}>
          {code}
        </code>
        <button onClick={copy} style={{
          flexShrink: 0, background: copied ? GREEN : "rgba(255,255,255,0.1)",
          border: "none", borderRadius: 5, padding: "5px 10px",
          color: WHITE, fontSize: 11, fontWeight: 600, cursor: "pointer",
          transition: "background 0.2s",
        }}>
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function ConfirmButton({ label, onConfirm, done }) {
  return (
    <button
      onClick={onConfirm}
      style={{
        marginTop: 8, padding: "10px 20px", borderRadius: 8,
        border: done ? `2px solid ${GREEN}` : `2px solid ${NAVY}`,
        background: done ? GREEN : WHITE,
        color: done ? WHITE : NAVY,
        fontWeight: 700, fontSize: 13, cursor: "pointer",
        display: "flex", alignItems: "center", gap: 8,
        transition: "all 0.2s",
      }}
    >
      {done ? "✓ " : ""}{label}
    </button>
  );
}

function InputField({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: GRAY_T, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%", padding: "9px 12px", fontSize: 13,
          border: `1px solid ${GRAY_BD}`, borderRadius: 7,
          outline: "none", boxSizing: "border-box",
          fontFamily: "inherit", color: "#111827",
          background: WHITE,
        }}
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: GRAY_T, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: "100%", padding: "9px 12px", fontSize: 13,
          border: `1px solid ${GRAY_BD}`, borderRadius: 7,
          outline: "none", boxSizing: "border-box",
          fontFamily: "inherit", color: "#111827",
          background: WHITE, appearance: "none",
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center",
        }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function InfoBox({ children, color = NAVY }) {
  return (
    <div style={{
      background: color === GREEN ? GREEN_L : "#eff6ff",
      border: `1px solid ${color === GREEN ? "#bbf7d0" : "#bfdbfe"}`,
      borderRadius: 8, padding: "10px 14px", fontSize: 12,
      color: color === GREEN ? GREEN : "#1e40af",
      marginBottom: 12, lineHeight: 1.6,
    }}>
      {children}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────
export default function UploadPage() {
  // Service config
  const [filePath,  setFilePath]  = useState("");
  const [videoId,   setVideoId]   = useState("");
  const [date,      setDate]      = useState(today());
  const [type,      setType]      = useState("sunday");
  const [pastor,    setPastor]    = useState("");
  const [series,    setSeries]    = useState("");
  const [language,  setLanguage]  = useState("sw");
  const [model,     setModel]     = useState("medium");

  // Step statuses
  const [steps, setSteps] = useState({
    config:      STATUS.ACTIVE,
    upload:      STATUS.IDLE,
    transcribe:  STATUS.IDLE,
    chapters:    STATUS.IDLE,
    subtitles:   STATUS.IDLE,
  });

  // Which step panel is open
  const [open, setOpen] = useState("config");

  function markDone(stepKey, nextKey) {
    setSteps(s => ({ ...s, [stepKey]: STATUS.DONE, ...(nextKey ? { [nextKey]: STATUS.ACTIVE } : {}) }));
    if (nextKey) setOpen(nextKey);
  }

  function toggleOpen(key) {
    setOpen(prev => prev === key ? null : key);
  }

  // Derived commands
  const fp = filePath || "C:\\path\\to\\recording.mp4";
  const vid = videoId || "YOUR_VIDEO_ID";
  const dateFlag = date ? `--date ${date}` : "";
  const typeFlag = `--type ${type}`;
  const pastorFlag = pastor ? `--pastor "${pastor}"` : "";
  const seriesFlag = series ? `--series "${series}"` : "";
  const uploadCmd = `node scripts/upload.js --file ${escapePath(fp)} ${dateFlag} ${typeFlag} ${pastorFlag} ${seriesFlag}`.replace(/\s+/g, " ").trim();
  const whisperCmd = `whisper ${escapePath(fp)} --model ${model} --language ${language}`;
  const chaptersCmd = `node scripts/transcribe.js --file ${escapePath(fp)} --id ${vid}`;
  const srtFile = filePath ? filePath.replace(/\.[^/.]+$/, ".srt") : "recording.srt";

  const stepOrder = ["config", "upload", "transcribe", "chapters", "subtitles"];
  const totalDone = stepOrder.filter(k => steps[k] === STATUS.DONE).length;
  const pct = Math.round((totalDone / stepOrder.length) * 100);

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", maxWidth: 700, margin: "0 auto", padding: "24px 16px", background: GRAY_BG, minHeight: "100vh" }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        input:focus, select:focus { border-color: ${NAVY} !important; box-shadow: 0 0 0 3px ${NAVY}22; }
        button:hover { filter: brightness(1.08); }
      `}</style>

      {/* ── Header ── */}
      <div style={{ background: NAVY, borderRadius: "12px 12px 0 0", padding: "20px 24px" }}>
        <div style={{ color: GOLD, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
          IT TEAM
        </div>
        <div style={{ color: WHITE, fontSize: 20, fontWeight: 700, marginBottom: 16 }}>
          Service Upload Workflow
        </div>

        {/* Progress bar */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(255,255,255,0.6)", marginBottom: 6 }}>
          <span>Overall Progress</span>
          <span style={{ color: pct === 100 ? GOLD : "rgba(255,255,255,0.6)", fontWeight: 700 }}>{pct}%</span>
        </div>
        <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 99, height: 6 }}>
          <div style={{ width: `${pct}%`, background: pct === 100 ? GOLD : "#60a5fa", height: "100%", borderRadius: 99, transition: "width 0.4s ease" }} />
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 6 }}>
          {totalDone} of {stepOrder.length} steps completed
        </div>
      </div>

      {/* ── Steps container ── */}
      <div style={{ background: WHITE, borderRadius: "0 0 12px 12px", border: `1px solid ${GRAY_BD}`, borderTop: "none", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>

        {/* ══ STEP 1: Configure ══ */}
        <SectionHeader step={1} label="Configure Service Details" status={steps.config} onClick={() => toggleOpen("config")} />
        {open === "config" && (
          <div style={{ padding: "20px 24px", borderBottom: `1px solid ${GRAY_BD}` }}>
            <InfoBox>
              Fill in your service details. These will be used to auto-generate the YouTube title, description, and tags.
            </InfoBox>

            <InputField label="Video File Path" value={filePath} onChange={setFilePath}
              placeholder="C:\Users\pc\Desktop\recording.mp4" />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <InputField label="Service Date" value={date} onChange={setDate} type="date" />
              <SelectField label="Service Type" value={type} onChange={setType} options={[
                { value: "sunday",    label: "Sunday Service" },
                { value: "friday",    label: "Friday Prayer Night" },
                { value: "midweek",   label: "Midweek Service" },
                { value: "easter",    label: "Easter Sunday" },
                { value: "christmas", label: "Christmas Service" },
                { value: "special",   label: "Special Service" },
              ]} />
            </div>

            <InputField label="Preaching Pastor" value={pastor} onChange={setPastor} placeholder="Pastor John" />
            <InputField label="Sermon Series (optional)" value={series} onChange={setSeries} placeholder="Walking in Faith" />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <SelectField label="Whisper Language" value={language} onChange={setLanguage} options={[
                { value: "sw", label: "Swahili (sw)" },
                { value: "en", label: "English (en)" },
                { value: "auto", label: "Auto-detect" },
              ]} />
              <SelectField label="Whisper Model" value={model} onChange={setModel} options={[
                { value: "tiny",   label: "Tiny (fastest, less accurate)" },
                { value: "base",   label: "Base" },
                { value: "small",  label: "Small" },
                { value: "medium", label: "Medium (recommended)" },
                { value: "large",  label: "Large (slowest, most accurate)" },
              ]} />
            </div>

            {date && <div style={{ fontSize: 12, color: GRAY_T, marginBottom: 12 }}>
              📅 Formatted date: <strong>{displayDate(date)}</strong>
            </div>}

            <ConfirmButton
              label={filePath ? "Details Confirmed — Go to Upload" : "Enter file path to continue"}
              done={steps.config === STATUS.DONE}
              onConfirm={() => filePath && markDone("config", "upload")}
            />
          </div>
        )}

        {/* ══ STEP 2: Upload to YouTube ══ */}
        <SectionHeader step={2} label="Upload Video to YouTube" status={steps.upload} onClick={() => toggleOpen("upload")} />
        {open === "upload" && (
          <div style={{ padding: "20px 24px", borderBottom: `1px solid ${GRAY_BD}` }}>
            <InfoBox>
              Run this command in PowerShell from your <code style={{ background: "#e0e7ff", padding: "1px 5px", borderRadius: 3 }}>transcribe</code> folder. It will upload the video and auto-generate the title, description, and tags.
            </InfoBox>

            <CopyBox label="1. Open PowerShell and navigate to your project" code="cd C:\Users\pc\Desktop\transcribe" />
            <CopyBox label="2. Run the upload script" code={uploadCmd} />

            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#92400e", marginBottom: 16 }}>
              ⏳ Upload time depends on your internet speed and file size. <strong>Do not close PowerShell</strong> while it runs. At the end you will see a <strong>Video ID</strong> — copy it, you'll need it in Step 4.
            </div>

            <InputField label="Paste Video ID here once upload is done" value={videoId} onChange={setVideoId}
              placeholder="e.g. dQw4w9WgXcQ" />

            {videoId && (
              <InfoBox color={GREEN}>
                ✓ Video URL: <a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener noreferrer"
                  style={{ color: GREEN, fontWeight: 600 }}>
                  https://www.youtube.com/watch?v={videoId}
                </a>
              </InfoBox>
            )}

            <ConfirmButton
              label={videoId ? "Upload Done — Go to Transcription" : "Paste Video ID to continue"}
              done={steps.upload === STATUS.DONE}
              onConfirm={() => videoId && markDone("upload", "transcribe")}
            />
          </div>
        )}

        {/* ══ STEP 3: Transcribe locally ══ */}
        <SectionHeader step={3} label="Transcribe Locally with Whisper" status={steps.transcribe} onClick={() => toggleOpen("transcribe")} />
        {open === "transcribe" && (
          <div style={{ padding: "20px 24px", borderBottom: `1px solid ${GRAY_BD}` }}>
            <InfoBox>
              Run Whisper on your computer — this is <strong>free</strong> and runs offline. It will generate <code style={{ background: "#e0e7ff", padding: "1px 5px", borderRadius: 3 }}>.txt</code>, <code style={{ background: "#e0e7ff", padding: "1px 5px", borderRadius: 3 }}>.srt</code>, and <code style={{ background: "#e0e7ff", padding: "1px 5px", borderRadius: 3 }}>.json</code> files in the same folder as your video.
            </InfoBox>

            <CopyBox label="Run Whisper transcription" code={whisperCmd} />

            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#92400e", marginBottom: 16 }}>
              ⏳ On CPU this takes roughly <strong>1 hour per 90-minute service</strong>. You can minimize PowerShell and let it run in the background. Do not close the window.
            </div>

            <div style={{ fontSize: 12, color: GRAY_T, marginBottom: 16 }}>
              <strong>Output files you'll get:</strong>
              <ul style={{ margin: "6px 0 0 0", paddingLeft: 18, lineHeight: 2 }}>
                <li><code>recording.txt</code> — full text transcript</li>
                <li><code>recording.srt</code> — subtitle file for YouTube</li>
                <li><code>recording.json</code> — timestamped segments for chapters</li>
                <li><code>recording.vtt</code> — web subtitles</li>
              </ul>
            </div>

            <ConfirmButton
              label="Transcription Done — Go to Chapters"
              done={steps.transcribe === STATUS.DONE}
              onConfirm={() => markDone("transcribe", "chapters")}
            />
          </div>
        )}

        {/* ══ STEP 4: Add chapters ══ */}
        <SectionHeader step={4} label="Add Chapters to YouTube Description" status={steps.chapters} onClick={() => toggleOpen("chapters")} />
        {open === "chapters" && (
          <div style={{ padding: "20px 24px", borderBottom: `1px solid ${GRAY_BD}` }}>
            <InfoBox>
              This reads your local transcript and automatically adds timestamped chapters to the YouTube video description. Requires the Video ID from Step 2.
            </InfoBox>

            {!videoId && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: RED, marginBottom: 12 }}>
                ⚠️ No Video ID entered yet — go back to Step 2 and paste it.
              </div>
            )}

            <CopyBox label="Add chapters to YouTube description" code={chaptersCmd} />

            <div style={{ fontSize: 12, color: GRAY_T, marginBottom: 16, lineHeight: 1.7 }}>
              This will detect sections like <strong>Worship</strong>, <strong>Sermon</strong>, <strong>Altar Call</strong> etc. from the transcript and add timestamps like:
              <div style={{ background: "#0f172a", borderRadius: 6, padding: "10px 14px", marginTop: 8, fontFamily: "monospace", fontSize: 12, color: "#e2e8f0", lineHeight: 2 }}>
                0:00 Introduction<br/>
                12:34 Worship & Praise<br/>
                45:00 Sermon<br/>
                1:15:00 Altar Call<br/>
                1:28:00 Closing Prayer
              </div>
            </div>

            <ConfirmButton
              label="Chapters Added — Go to Subtitles"
              done={steps.chapters === STATUS.DONE}
              onConfirm={() => markDone("chapters", "subtitles")}
            />
          </div>
        )}

        {/* ══ STEP 5: Upload SRT ══ */}
        <SectionHeader step={5} label="Upload SRT Subtitles to YouTube" status={steps.subtitles} onClick={() => toggleOpen("subtitles")} />
        {open === "subtitles" && (
          <div style={{ padding: "20px 24px" }}>
            <InfoBox>
              Upload your <code style={{ background: "#e0e7ff", padding: "1px 5px", borderRadius: 3 }}>.srt</code> file to YouTube Studio so viewers see live captions. This is done manually in the browser.
            </InfoBox>

            <div style={{ fontSize: 13, color: "#374151", lineHeight: 2, marginBottom: 16 }}>
              <strong>Steps in YouTube Studio:</strong>
              <ol style={{ margin: "6px 0 0 0", paddingLeft: 20 }}>
                <li>Go to <a href="https://studio.youtube.com" target="_blank" rel="noopener noreferrer" style={{ color: NAVY_L, fontWeight: 600 }}>studio.youtube.com</a></li>
                <li>Click <strong>Content</strong> → find your uploaded video</li>
                <li>Click the video → go to <strong>Subtitles</strong> tab</li>
                <li>Click <strong>Add language</strong> → select Swahili or English</li>
                <li>Click <strong>Add</strong> → choose <strong>Upload file</strong></li>
                <li>Select <strong>With timing</strong> → upload your <code>.srt</code> file</li>
                <li>Click <strong>Publish</strong></li>
              </ol>
            </div>

            <div style={{ background: "#f9fafb", border: `1px solid ${GRAY_BD}`, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: GRAY_T, marginBottom: 16 }}>
              📁 Your SRT file is at: <code style={{ color: NAVY, fontWeight: 600 }}>{srtFile}</code>
            </div>

            {videoId && (
              <a
                href={`https://studio.youtube.com/video/${videoId}/translations`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "10px 18px", borderRadius: 8,
                  background: RED, color: WHITE,
                  fontWeight: 700, fontSize: 13, textDecoration: "none",
                  marginBottom: 16,
                }}
              >
                ▶ Open YouTube Studio Subtitles ↗
              </a>
            )}

            <ConfirmButton
              label="Subtitles Uploaded — All Done! 🎉"
              done={steps.subtitles === STATUS.DONE}
              onConfirm={() => markDone("subtitles", null)}
            />

            {steps.subtitles === STATUS.DONE && (
              <div style={{
                marginTop: 20, background: `linear-gradient(135deg, ${NAVY}, ${NAVY_L})`,
                borderRadius: 12, padding: "20px 24px", textAlign: "center",
              }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
                <div style={{ color: GOLD, fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Service Published!</div>
                <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, marginBottom: 16 }}>
                  Video is live on YouTube with chapters and subtitles.
                </div>
                {videoId && (
                  <a
                    href={`https://www.youtube.com/watch?v=${videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-block", padding: "10px 24px", borderRadius: 8,
                      background: GOLD, color: NAVY,
                      fontWeight: 700, fontSize: 13, textDecoration: "none",
                    }}
                  >
                    View on YouTube ↗
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Footer note ── */}
      <div style={{ textAlign: "center", fontSize: 11, color: GRAY_T, marginTop: 16 }}>
        Commands run in PowerShell from <code>C:\Users\pc\Desktop\transcribe</code>
      </div>
    </div>
  );
}