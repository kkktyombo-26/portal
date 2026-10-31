'use client';

import { useState, useEffect, useCallback } from "react";
import { useAuth } from '../../../hooks/useAuth';

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
        style={{ width: size, height: size }}
        className={[
          "rounded-full object-cover shrink-0",
          "border border-neutral-100",
          "transition-opacity duration-150",
          onClick ? "cursor-zoom-in hover:opacity-85" : "cursor-default",
        ].join(" ")}
        onError={(e) => { e.currentTarget.style.display = "none"; }}
      />
    );
  }

  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.32 }}
      className="rounded-full bg-navy-50 flex items-center justify-center font-medium text-navy-700 shrink-0 tracking-wide"
    >
      {initials}
    </div>
  );
}


function Badge({ children, variant = "default" }) {
  const variantClasses = {
    default: "bg-neutral-100 text-neutral-500",
    warning: "bg-[#FEF3C7] text-warning",
    success: "bg-[#F0FDF4] text-success",
    danger:  "bg-[#FEF2F2] text-danger",
  };
  return (
    <span className={`${variantClasses[variant]} text-2xs font-medium px-2 py-0.5 rounded-pill inline-block tracking-wide`}>
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
      className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-6 animate-fade-in"
    >
      <button
        onClick={onClose}
        className="absolute top-5 right-6 bg-white/10 border-none rounded-full w-9 h-9 flex items-center justify-center cursor-pointer text-white text-lg leading-none hover:bg-white/20 transition-colors duration-150"
      >
        ✕
      </button>

      <img
        src={member.profile_photo_url}
        alt={member.full_name}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[75vh] rounded-xl object-contain border border-white/15"
        style={{ maxWidth: "min(520px, 90vw)", boxShadow: "0 8px 48px rgba(0,0,0,0.5)" }}
        onError={(e) => { e.currentTarget.style.display = "none"; }}
      />

      <div className="mt-5 text-center">
        <p className="m-0 text-sm font-medium text-white">{member.full_name}</p>
        <p className="mt-1 text-xs text-white/55">{member.email}</p>
      </div>

      <p className="mt-4 text-xs text-white/30">Bonyeza nje au ESC kufunga</p>
    </div>
  );
}


function Toast({ message, type, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [onDone]);

  const typeClasses = {
    success: "bg-[#F0FDF4] text-success border-[#1A7F55]",
    error:   "bg-[#FEF2F2] text-danger border-danger",
  };

  return (
    <div
      className={`fixed bottom-7 right-7 z-[60] ${typeClasses[type] || typeClasses.success} border rounded-lg px-[18px] py-3 text-sm font-medium max-w-xs animate-slide-up`}
      style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.12)" }}
    >
      {message}
    </div>
  );
}


function RejectModal({ user, onConfirm, onCancel, loading }) {
  const [reason, setReason] = useState("");

  return (
    <div
      className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-5"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="bg-white rounded-xl border border-neutral-100 p-7 w-full max-w-md">
        <h3 className="m-0 mb-1.5 text-base font-medium text-neutral-900">
          Kataa ombi
        </h3>
        <p className="m-0 mb-4 text-xs text-neutral-500 leading-snug">
          Unakataa ombi la{" "}
          <strong className="font-medium text-neutral-900">{user.full_name}</strong>.
          Toa sababu hapa chini (si lazima).
        </p>

        <label className="text-2xs font-medium text-neutral-400 block mb-1.5 uppercase tracking-wider">
          Sababu
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Andika sababu hapa..."
          rows={3}
          className="w-full px-3 py-2.5 text-sm border border-neutral-200 rounded-md bg-neutral-50 text-neutral-900 resize-y font-sans box-border focus:outline-none focus:border-navy-400 transition-colors duration-150"
        />

        <div className="flex gap-2.5 justify-end mt-5">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-[18px] py-2 text-xs font-medium border border-neutral-200 rounded-md bg-transparent text-neutral-500 cursor-pointer hover:bg-neutral-50 transition-colors duration-100 disabled:opacity-50"
          >
            Ghairi
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={loading}
            className="px-[18px] py-2 text-xs font-medium border-none rounded-md bg-[#FEF2F2] text-danger cursor-pointer transition-opacity duration-100 disabled:opacity-60 disabled:cursor-not-allowed"
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

      <div className="bg-white border border-neutral-100 rounded-xl p-5 flex flex-col gap-4 transition-colors duration-150">

        {/* Header */}
        <div className="flex items-start gap-3.5">
          <Avatar
            name={member.full_name}
            photoUrl={member.profile_photo_url}
            size={48}
            onClick={member.profile_photo_url ? () => setShowLightbox(true) : undefined}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-neutral-900">
                {member.full_name}
              </span>
              <Badge variant="warning">Inasubiri</Badge>
            </div>
            <p className="m-0 mt-0.5 text-xs text-neutral-500 break-words">
              {member.email}
            </p>
          </div>
          <span className="text-2xs text-neutral-400 whitespace-nowrap shrink-0 pt-0.5">
            {formatDate(member.created_at)}
          </span>
        </div>

        {/* Details grid */}
        <div className="grid gap-x-5 gap-y-2.5 bg-neutral-50 rounded-md px-3.5 py-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
          {[
            { label: "Simu",               value: member.phone              || "Haijatolewa" },
            { label: "Namba ya usharika",   value: member.namba_ya_usharika || "Haijatolewa" },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="m-0 text-2xs text-neutral-400 uppercase tracking-wider font-medium">
                {label}
              </p>
              <p className="m-0 mt-0.5 text-xs text-neutral-900">
                {value.startsWith("Haijatol")
                  ? <em className="text-neutral-400 not-italic font-regular">{value}</em>
                  : <span className="font-medium">{value}</span>}
              </p>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2.5 justify-end">
          <button
            onClick={() => onReject(member)}
            disabled={isLoading}
            className="px-4 py-2 text-xs font-medium border border-neutral-200 rounded-md bg-transparent text-neutral-500 cursor-pointer hover:bg-neutral-50 transition-colors duration-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Kataa
          </button>
          <button
            onClick={() => onApprove(member)}
            disabled={isLoading}
            className={[
              "px-[18px] py-2 text-xs font-medium border-none rounded-md transition-opacity duration-100",
              "flex items-center gap-1.5",
              isLoading
                ? "bg-neutral-100 text-neutral-500 cursor-not-allowed opacity-60"
                : "bg-navy-900 text-white cursor-pointer hover:opacity-90",
            ].join(" ")}
          >
            {isLoading ? (
              <>
                <span className="inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin-slow" />
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
  const [members, setMembers]             = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [rejectTarget, setRejectTarget]   = useState(null);
  const [toast, setToast]                 = useState(null);
  const [search, setSearch]               = useState("");

  const { token } = useAuth();

  const fetchPending = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`${API}/auth/pending`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Hitilafu ya seva");
      setMembers(data.users || []);
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
      const res  = await fetch(`${API}/auth/approve/${member.id}`, {
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
      const res  = await fetch(`${API}/auth/reject/${rejectTarget.id}`, {
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

      <div className="max-w-[760px] mx-auto px-5 py-8">

        {/* Page header */}
        <div className="mb-7">
          <h1 className="m-0 text-xl font-medium text-neutral-900">
            Maombi ya kujiunga
          </h1>
          <p className="m-0 mt-1.5 text-sm text-neutral-500">
            Kagua na idhinisha au ukatae washarika wapya wanaoomba kujiunga na kanisa.
          </p>
        </div>

        {/* Stats + search row */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <div className="bg-neutral-50 rounded-md px-4 py-2.5 flex items-baseline gap-1.5 shrink-0">
            <span className="text-xl font-medium text-neutral-900">
              {loading ? "—" : members.length}
            </span>
            <span className="text-xs text-neutral-500">inasubiri</span>
          </div>

          <input
            type="search"
            placeholder="Tafuta jina, barua pepe, namba..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[180px] px-3.5 py-2 text-sm border border-neutral-200 rounded-md bg-white text-neutral-900 font-sans focus:outline-none focus:border-navy-400 transition-colors duration-150"
          />

          <button
            onClick={fetchPending}
            disabled={loading}
            className="px-3.5 py-2 text-xs font-medium border border-neutral-200 rounded-md bg-transparent text-neutral-500 cursor-pointer shrink-0 hover:bg-neutral-50 transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "..." : "Onyesha upya"}
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col gap-3.5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-40 rounded-xl bg-neutral-50 opacity-60 animate-fade-in"
              />
            ))}
          </div>
        ) : error ? (
          <div className="px-5 py-5 rounded-xl bg-[#FEF2F2] border border-danger text-danger text-sm">
            <strong className="font-medium">Hitilafu:</strong> {error}
            <button
              onClick={fetchPending}
              className="ml-3 text-xs bg-transparent border-none text-danger cursor-pointer underline p-0 font-sans"
            >
              Jaribu tena
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 px-5 text-neutral-400 text-sm leading-relaxed">
            {search ? (
              <>
                Hakuna matokeo kwa "
                <strong className="font-medium text-neutral-500">{search}</strong>"
              </>
            ) : (
              <>
                Hakuna maombi yanayosubiri kwa sasa.<br />
                Maombi mapya yataonekana hapa.
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
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