'use client';

import { useState, useEffect, useCallback } from "react";
import { useAuth } from '../../../hooks/useAuth'; // adjust path

const API = process.env.NEXT_PUBLIC_API_URL || "";


function Avatar({ name, photoUrl, size = 44, onClick }) {
  const initials = name
    ?.split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        onClick={onClick}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
          border: "1.5px solid var(--color-border-tertiary)",
          cursor: onClick ? "zoom-in" : "default",
          transition: "opacity 0.15s",
        }}
        onMouseEnter={(e) => { if (onClick) e.currentTarget.style.opacity = "0.85"; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
        onError={(e) => { e.currentTarget.style.display = "none"; }}
      />
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--color-background-info)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 500,
        fontSize: size * 0.32,
        color: "var(--color-text-info)",
        flexShrink: 0,
        letterSpacing: "0.04em",
      }}
    >
      {initials}
    </div>
  );
}


function Badge({ children, variant = "default" }) {
  const styles = {
    default: { background: "var(--color-background-secondary)", color: "var(--color-text-secondary)" },
    warning: { background: "var(--color-background-warning)", color: "var(--color-text-warning)" },
    success: { background: "var(--color-background-success)", color: "var(--color-text-success)" },
    danger:  { background: "var(--color-background-danger)",  color: "var(--color-text-danger)"  },
  };
  return (
    <span
      style={{
        ...styles[variant],
        fontSize: 11,
        fontWeight: 500,
        padding: "2px 8px",
        borderRadius: 99,
        display: "inline-block",
        letterSpacing: "0.02em",
      }}
    >
      {children}
    </span>
  );
}

function PhotoLightbox({ member, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.82)",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        animation: "fadeIn 0.18s ease",
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: 20,
          right: 24,
          background: "rgba(255,255,255,0.12)",
          border: "none",
          borderRadius: "50%",
          width: 36,
          height: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "#fff",
          fontSize: 18,
          lineHeight: 1,
        }}
      >
        ✕
      </button>

      {/* Image */}
      <img
        src={member.profile_photo_url}
        alt={member.full_name}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "min(520px, 90vw)",
          maxHeight: "75vh",
          borderRadius: 12,
          objectFit: "contain",
          border: "1.5px solid rgba(255,255,255,0.15)",
          boxShadow: "0 8px 48px rgba(0,0,0,0.5)",
        }}
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />

      {/* Name + email caption */}
      <div style={{ marginTop: 18, textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: "#fff" }}>
          {member.full_name}
        </p>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "rgba(255,255,255,0.55)" }}>
          {member.email}
        </p>
      </div>

      <p style={{ marginTop: 16, fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
        Bonyeza nje au ESC kufunga
      </p>
    </div>
  );
}

function Toast({ message, type, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [onDone]);

  const colors = {
    success: { bg: "var(--color-background-success)", color: "var(--color-text-success)", border: "var(--color-border-success)" },
    error:   { bg: "var(--color-background-danger)",  color: "var(--color-text-danger)",  border: "var(--color-border-danger)"  },
  };
  const c = colors[type] || colors.success;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 28,
        right: 28,
        zIndex: 9999,
        background: c.bg,
        color: c.color,
        border: `0.5px solid ${c.border}`,
        borderRadius: "var(--border-radius-md)",
        padding: "12px 18px",
        fontSize: 14,
        fontWeight: 500,
        boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
        animation: "slideUp 0.2s ease",
        maxWidth: 320,
      }}
    >
      {message}
    </div>
  );
}

function RejectModal({ user, onConfirm, onCancel, loading }) {
  const [reason, setReason] = useState("");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        zIndex: 999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        style={{
          background: "var(--color-background-primary)",
          borderRadius: "var(--border-radius-lg)",
          border: "0.5px solid var(--color-border-tertiary)",
          padding: "28px 28px 24px",
          width: "100%",
          maxWidth: 440,
        }}
      >
        <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 500, color: "var(--color-text-primary)" }}>
          Kataa ombi
        </h3>
        <p style={{ margin: "0 0 18px", fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
          Unakataa ombi la <strong style={{ fontWeight: 500, color: "var(--color-text-primary)" }}>{user.full_name}</strong>. Toa sababu hapa chini (si lazima).
        </p>

        <label style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Sababu
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Andika sababu hapa..."
          rows={3}
          style={{
            width: "100%",
            padding: "10px 12px",
            fontSize: 14,
            border: "0.5px solid var(--color-border-secondary)",
            borderRadius: "var(--border-radius-md)",
            background: "var(--color-background-secondary)",
            color: "var(--color-text-primary)",
            resize: "vertical",
            fontFamily: "inherit",
            boxSizing: "border-box",
          }}
        />

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              padding: "8px 18px",
              fontSize: 13,
              fontWeight: 500,
              border: "0.5px solid var(--color-border-secondary)",
              borderRadius: "var(--border-radius-md)",
              background: "transparent",
              color: "var(--color-text-secondary)",
              cursor: "pointer",
            }}
          >
            Ghairi
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={loading}
            style={{
              padding: "8px 18px",
              fontSize: 13,
              fontWeight: 500,
              border: "none",
              borderRadius: "var(--border-radius-md)",
              background: "var(--color-background-danger)",
              color: "var(--color-text-danger)",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Inawasilisha..." : "Kataa ombi"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MemberCard({ member, onApprove, onReject, actionLoading }) {
  const isLoading = actionLoading === member.id;
  const [showLightbox, setShowLightbox] = useState(false);

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString("sw-TZ", { day: "numeric", month: "short", year: "numeric" }) : "—";

  return (
    <>
      {showLightbox && member.profile_photo_url && (
        <PhotoLightbox member={member} onClose={() => setShowLightbox(false)} />
      )}

      <div
        style={{
          background: "var(--color-background-primary)",
          border: "0.5px solid var(--color-border-tertiary)",
          borderRadius: "var(--border-radius-lg)",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          transition: "border-color 0.15s",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <Avatar
            name={member.full_name}
            photoUrl={member.profile_photo_url}
            size={48}
            onClick={member.profile_photo_url ? () => setShowLightbox(true) : undefined}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-primary)" }}>
                {member.full_name}
              </span>
              <Badge variant="warning">Inasubiri</Badge>
            </div>
            <p style={{ margin: "3px 0 0", fontSize: 13, color: "var(--color-text-secondary)", wordBreak: "break-word" }}>
              {member.email}
            </p>
          </div>
          <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", whiteSpace: "nowrap", flexShrink: 0, paddingTop: 2 }}>
            {formatDate(member.created_at)}
          </span>
        </div>

        {/* Details grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "10px 20px",
            background: "var(--color-background-secondary)",
            borderRadius: "var(--border-radius-md)",
            padding: "12px 14px",
          }}
        >
          {[
            { label: "Simu", value: member.phone || "Haijatolewa" },
            { label: "Namba ya usharika", value: member.namba_ya_usharika || "Haijatolewa" },
          ].map(({ label, value }) => (
            <div key={label}>
              <p style={{ margin: 0, fontSize: 11, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 }}>
                {label}
              </p>
              <p style={{ margin: "3px 0 0", fontSize: 13, color: "var(--color-text-primary)", fontWeight: value.startsWith("Haijatol") ? 400 : 500 }}>
                {value.startsWith("Haijatol")
                  ? <em style={{ color: "var(--color-text-tertiary)", fontStyle: "italic", fontWeight: 400 }}>{value}</em>
                  : value}
              </p>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={() => onReject(member)}
            disabled={isLoading}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 500,
              border: "0.5px solid var(--color-border-secondary)",
              borderRadius: "var(--border-radius-md)",
              background: "transparent",
              color: "var(--color-text-secondary)",
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.5 : 1,
              transition: "background 0.1s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-background-secondary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            Kataa
          </button>
          <button
            onClick={() => onApprove(member)}
            disabled={isLoading}
            style={{
              padding: "8px 18px",
              fontSize: 13,
              fontWeight: 500,
              border: "none",
              borderRadius: "var(--border-radius-md)",
              background: isLoading ? "var(--color-background-secondary)" : "var(--color-text-primary)",
              color: isLoading ? "var(--color-text-secondary)" : "var(--color-background-primary)",
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.6 : 1,
              transition: "opacity 0.1s",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {isLoading ? (
              <>
                <span style={{
                  display: "inline-block",
                  width: 12,
                  height: 12,
                  border: "1.5px solid currentColor",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  animation: "spin 0.7s linear infinite",
                }} />
                Inaidhinisha...
              </>
            ) : "Idhinisha"}
          </button>
        </div>
      </div>
    </>
  );
}

export default function PendingMembersPage() {
  const [members, setMembers]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [toast, setToast]               = useState(null);
  const [search, setSearch]             = useState("");

  const { token } = useAuth();



  const fetchPending = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/auth/pending`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Hitilafu ya seva");
      setMembers(data.users || []);
      console.log("Pending users photos:", (data.users || []).map(u => ({ id: u.id, name: u.full_name, photo: u.profile_photo_url })));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  const showToast = (message, type = "success") => setToast({ message, type });

  const handleApprove = async (member) => {
    setActionLoading(member.id);
    try {
      const res = await fetch(`${API}/auth/approve/${member.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      showToast(`${member.full_name} ameidhinishwa.`, "success");
    } catch (e) {
      showToast(e.message || "Imeshindwa kuidhinisha.", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectConfirm = async (reason) => {
    if (!rejectTarget) return;
    setActionLoading(rejectTarget.id);
    try {
      const res = await fetch(`${API}/auth/reject/${rejectTarget.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setMembers((prev) => prev.filter((m) => m.id !== rejectTarget.id));
      showToast(`Ombi la ${rejectTarget.full_name} limekataliwa.`, "error");
    } catch (e) {
      showToast(e.message || "Imeshindwa kukataa.", "error");
    } finally {
      setActionLoading(null);
      setRejectTarget(null);
    }
  };

  const filtered = members.filter(
    (m) =>
      m.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      m.email?.toLowerCase().includes(search.toLowerCase()) ||
      m.namba_ya_usharika?.toLowerCase().includes(search.toLowerCase()) ||
      m.phone?.includes(search)
  );

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      {toast && (
        <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />
      )}

      {rejectTarget && (
        <RejectModal
          user={rejectTarget}
          onConfirm={handleRejectConfirm}
          onCancel={() => setRejectTarget(null)}
          loading={actionLoading === rejectTarget.id}
        />
      )}

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 20px" }}>

        {/* Page header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 500, color: "var(--color-text-primary)" }}>
            Maombi ya kujiunga
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--color-text-secondary)" }}>
            Kagua na idhinisha au ukatae wanachama wapya wanaoomba kujiunga na kanisa.
          </p>
        </div>

        {/* Stats + search row */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22, flexWrap: "wrap" }}>
          <div
            style={{
              background: "var(--color-background-secondary)",
              borderRadius: "var(--border-radius-md)",
              padding: "10px 16px",
              display: "flex",
              alignItems: "baseline",
              gap: 6,
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 22, fontWeight: 500, color: "var(--color-text-primary)" }}>
              {loading ? "—" : members.length}
            </span>
            <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
              inasubiri
            </span>
          </div>

          <input
            type="search"
            placeholder="Tafuta jina, barua pepe, namba..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              minWidth: 180,
              padding: "9px 14px",
              fontSize: 14,
              border: "0.5px solid var(--color-border-secondary)",
              borderRadius: "var(--border-radius-md)",
              background: "var(--color-background-primary)",
              color: "var(--color-text-primary)",
              fontFamily: "inherit",
            }}
          />

          <button
            onClick={fetchPending}
            disabled={loading}
            style={{
              padding: "9px 14px",
              fontSize: 13,
              fontWeight: 500,
              border: "0.5px solid var(--color-border-secondary)",
              borderRadius: "var(--border-radius-md)",
              background: "transparent",
              color: "var(--color-text-secondary)",
              cursor: loading ? "not-allowed" : "pointer",
              flexShrink: 0,
            }}
          >
            {loading ? "..." : "Onyesha upya"}
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  height: 160,
                  borderRadius: "var(--border-radius-lg)",
                  background: "var(--color-background-secondary)",
                  animation: "fadeIn 0.3s ease",
                  opacity: 0.6,
                }}
              />
            ))}
          </div>
        ) : error ? (
          <div
            style={{
              padding: "20px 22px",
              borderRadius: "var(--border-radius-lg)",
              background: "var(--color-background-danger)",
              border: "0.5px solid var(--color-border-danger)",
              color: "var(--color-text-danger)",
              fontSize: 14,
            }}
          >
            <strong style={{ fontWeight: 500 }}>Hitilafu:</strong> {error}
            <button
              onClick={fetchPending}
              style={{
                marginLeft: 12,
                fontSize: 13,
                background: "none",
                border: "none",
                color: "var(--color-text-danger)",
                cursor: "pointer",
                textDecoration: "underline",
                padding: 0,
                fontFamily: "inherit",
              }}
            >
              Jaribu tena
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              color: "var(--color-text-tertiary)",
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            {search ? (
              <>Hakuna matokeo kwa "<strong style={{ fontWeight: 500, color: "var(--color-text-secondary)" }}>{search}</strong>"</>
            ) : (
              <>Hakuna maombi yanayosubiri kwa sasa.<br />Maombi mapya yataonekana hapa.</>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {filtered.map((member) => (
              <MemberCard
                key={member.id}
                member={member}
                onApprove={handleApprove}
                onReject={setRejectTarget}
                actionLoading={actionLoading}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}