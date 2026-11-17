'use client';
/**
 * /components/meetings/SendInviteModal.jsx
 * ────────────────────
 * Drop this component into MeetingDetailPage.jsx.
 *
 * Also shows the RSVP summary strip at the top of the Attendees tab,
 * and the per-row Confirm button in the attendees table.
 *
 * ─────────────────────────────────────────────────────────────
 * Integration checklist for MeetingDetailPage.jsx:
 *
 * 1. Add IconSend to your icon list (defined below).
 *
 * 2. Add state:
 *      const [showSendInvite, setShowSendInvite] = useState(false);
 *      const [rsvpSummary,    setRsvpSummary]    = useState(null);
 *
 * 3. Load RSVP summary alongside other data in fetchMeeting():
 *      const sRes = await meetingApi.getRsvpSummary(id).catch(() => ({ data: { data: null } }));
 *      setRsvpSummary(sRes.data.data);
 *
 * 4. In the Attendees tab toolbar, add:
 *      {canEdit && (
 *        <button className="btn btn-secondary btn-sm" onClick={() => setShowSendInvite(true)}>
 *          <IconSend className="w-3.5 h-3.5"/> Tuma Mialiko
 *        </button>
 *      )}
 *
 * 5. Replace the attendance summary strip with <RsvpSummaryStrip/> (below).
 *
 * 6. In the attendees table, add a Confirm button per row (see ConfirmCell below).
 *
 * 7. Add confirm-all button in the tab toolbar (see ConfirmAllButton below).
 *
 * 8. Mount modal at the bottom:
 *      {showSendInvite && (
 *        <SendInviteModal
 *          meeting={meeting}
 *          onClose={() => setShowSendInvite(false)}
 *          onSent={() => { setShowSendInvite(false); fetchMeeting(); }}
 *        />
 *      )}
 * ─────────────────────────────────────────────────────────────
 */

import { useState } from 'react';
import { meetingApi } from '../../lib/api';

// ── Extra Icon ────────────────────────────────────────────────────────────────
export const IconSend = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path d="M17.5 2.5L2.5 8.5l5.5 2 2 5.5 7.5-13.5z" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M8 10.5l3.5-3.5" strokeLinecap="round"/>
  </svg>
);

const IconX = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round"/>
  </svg>
);
const IconAlertCircle = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <circle cx="10" cy="10" r="8"/>
    <path d="M10 6v4M10 14h.01" strokeLinecap="round"/>
  </svg>
);
const IconCheckCircle = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <circle cx="10" cy="10" r="8"/>
    <path d="M6.5 10l2.5 2.5 4.5-4.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconUserCheck = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <circle cx="8" cy="6" r="3"/>
    <path d="M2 17c0-3.314 2.686-6 6-6" strokeLinecap="round"/>
    <path d="M12 15l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// SEND INVITE MODAL
// ─────────────────────────────────────────────────────────────────────────────
export function SendInviteModal({ meeting, onClose, onSent }) {
  const isGroupMeeting = !!meeting.group_id;

  const [scope,       setScope]       = useState(isGroupMeeting ? 'group' : 'church');
  const [jumuiyaName, setJumuiyaName] = useState('');
  const [resend,      setResend]      = useState(false);
  const [sending,     setSending]     = useState(false);
  const [result,      setResult]      = useState(null);  // success response
  const [error,       setError]       = useState('');

  async function handleSend() {
    setSending(true); setError(''); setResult(null);
    try {
      const payload = { scope, resend };
      if (scope === 'jumuiya') {
        if (!jumuiyaName.trim()) {
          setError('Tafadhali weka jina la jumuiya.');
          setSending(false);
          return;
        }
        payload.jumuiya_name = jumuiyaName.trim();
      }
      const res = await meetingApi.sendInvites(meeting.id, payload);
      setResult(res.data);
    } catch (err) {
      setError(err.message || 'Imeshindwa kutuma mialiko.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Tuma Mialiko ya Mahudhurio</h2>
            <p className="card-subtitle mt-0.5">
              Wanachama watapata ujumbe wa WhatsApp na kiungo cha kuthibitisha uhudhuria.
            </p>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <IconX className="w-4 h-4"/>
          </button>
        </div>

        <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>

          {/* Success result */}
          {result && (
            <div className="banner banner-success">
              <IconCheckCircle className="w-4 h-4 flex-shrink-0"/>
              <div>
                <p className="text-sm font-medium">{result.message}</p>
                <div style={{ display:'flex', gap:'1.5rem', marginTop:'0.375rem', flexWrap:'wrap' }}>
                  {[
                    { label:'Waliotumwa', value: result.summary?.sent },
                    { label:'Bila Simu',  value: result.summary?.no_phone },
                    { label:'Imeshashwa', value: result.summary?.already_invited },
                    { label:'Imeshindwa', value: result.summary?.failed },
                  ].filter(s => s.value > 0).map(s => (
                    <span key={s.label} className="text-xs" style={{ color:'var(--text-secondary)' }}>
                      {s.label}: <strong>{s.value}</strong>
                    </span>
                  ))}
                </div>
                {result.rsvp_link && (
                  <p className="text-xs mt-2" style={{ color:'var(--text-tertiary)', wordBreak:'break-all' }}>
                    Kiungo: {result.rsvp_link}
                  </p>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="banner banner-danger">
              <IconAlertCircle className="w-4 h-4 flex-shrink-0"/>
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Meeting info pill */}
          <div
            style={{
              padding:'0.75rem 1rem', borderRadius:10,
              background:'var(--surface-sunken)', border:'1px solid var(--border-subtle)',
            }}
          >
            <p className="text-sm font-medium text-navy-900">{meeting.title}</p>
            <p className="text-xs text-navy-500 mt-0.5">
              {meeting.group_name || 'Kanisa Lote'} ·{' '}
              {new Date(meeting.meeting_date).toLocaleDateString('sw-TZ', { day:'numeric', month:'long', year:'numeric' })}
            </p>
          </div>

          {/* Scope selector */}
          <div className="form-group">
            <label className="form-label">Tuma kwa Nani?</label>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>

              {isGroupMeeting && (
                <ScopeOption
                  value="group"
                  selected={scope}
                  onSelect={setScope}
                  label={`Wanachama wote wa "${meeting.group_name}"`}
                  sub="Wanachama wote wanaofanya kazi katika kikundi hiki"
                />
              )}

              <ScopeOption
                value="church"
                selected={scope}
                onSelect={setScope}
                label="Washarika Wote wa Kanisa"
                sub="Wanachama wote wenye hali ya 'hai'"
              />

              <ScopeOption
                value="jumuiya"
                selected={scope}
                onSelect={setScope}
                label="Jumuiya Maalum"
                sub="Chagua jumuiya moja kuwasiliana nayo"
              />
            </div>
          </div>

          {/* Jumuiya name input */}
          {scope === 'jumuiya' && (
            <div className="form-group">
              <label className="form-label">Jina la Jumuiya</label>
              <input
                className="input"
                placeholder="mfano: Jumuiya ya Upendo"
                value={jumuiyaName}
                onChange={e => setJumuiyaName(e.target.value)}
              />
            </div>
          )}

          {/* Resend toggle */}
          <label
            style={{
              display:'flex', alignItems:'center', gap:'0.75rem',
              padding:'0.75rem', borderRadius:8,
              background:'var(--surface-sunken)', border:'1px solid var(--border-subtle)',
              cursor:'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={resend}
              onChange={e => setResend(e.target.checked)}
              style={{ width:16, height:16, accentColor:'var(--gold)' }}
            />
            <div>
              <p className="text-sm font-medium text-navy-900">Tuma tena kwa waliopokea mwaliko</p>
              <p className="text-xs text-navy-500">Kawaida, watu walioshainvitiwa hawatumiwi tena.</p>
            </div>
          </label>
        </div>

        <div className="modal-footer">
          {result ? (
            <button className="btn btn-primary" onClick={onSent}>Imekamilika</button>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={onClose} disabled={sending}>Ghairi</button>
              <button className="btn btn-primary" onClick={handleSend} disabled={sending}>
                <IconSend className="w-4 h-4"/>
                {sending ? 'Inatuma…' : 'Tuma Mialiko'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ScopeOption({ value, selected, onSelect, label, sub }) {
  const isSelected = selected === value;
  return (
    <button
      onClick={() => onSelect(value)}
      style={{
        display:'flex', alignItems:'center', gap:'0.75rem',
        padding:'0.75rem 1rem', borderRadius:10, textAlign:'left',
        background: isSelected ? 'rgba(196,154,42,0.08)' : 'var(--surface-card, #fff)',
        border: `1.5px solid ${isSelected ? 'var(--gold)' : 'var(--border-default)'}`,
        cursor:'pointer', transition:'all 0.12s ease', outline:'none',
      }}
    >
      <div
        style={{
          width:18, height:18, borderRadius:'50%', flexShrink:0,
          border: `2px solid ${isSelected ? 'var(--gold)' : 'var(--border-default)'}`,
          background: isSelected ? 'var(--gold)' : 'transparent',
          transition:'all 0.12s ease',
        }}
      />
      <div>
        <p className="text-sm font-medium" style={{ color: isSelected ? 'var(--navy)' : 'var(--text-primary)' }}>
          {label}
        </p>
        <p className="text-xs" style={{ color:'var(--text-secondary)', marginTop:1 }}>{sub}</p>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RSVP SUMMARY STRIP
// Replace the existing attendance summary strip in the Attendees tab with this.
// ─────────────────────────────────────────────────────────────────────────────
export function RsvpSummaryStrip({ rsvpSummary, attSummary }) {
  const cards = [
    // Invite stats
    { label:'Walioalikwa',      count: rsvpSummary?.invited          ?? '—', cls:'badge-neutral' },
    { label:'Waliojaza',        count: rsvpSummary?.responded        ?? '—', cls:'badge-gold'    },
    { label:'Wanasubiri',       count: rsvpSummary?.awaiting_rsvp    ?? '—', cls:'badge-warning' },
    // RSVP breakdown
    { label:'Nitahudhuria ✅',  count: rsvpSummary?.rsvp_yes         ?? attSummary?.present ?? 0, cls:'badge-success' },
    { label:'Sitatoa Udhuru ⏰',count: rsvpSummary?.rsvp_apology     ?? attSummary?.apology ?? 0, cls:'badge-warning' },
    { label:'Sitahudhuria ❌',  count: rsvpSummary?.rsvp_no          ?? attSummary?.absent  ?? 0, cls:'badge-danger'  },
    // Confirmed
    { label:'Imethibitishwa ✓', count: rsvpSummary?.confirmed_present ?? 0, cls:'badge-navy'    },
  ].filter(c => c.count !== '—' ? c.count > 0 || ['Walioalikwa','Waliojaza','Wanasubiri'].includes(c.label) : true);

  return (
    <div style={{ display:'flex', gap:'0.625rem', flexWrap:'wrap', marginBottom:'1.25rem' }}>
      {cards.map(s => (
        <div
          key={s.label}
          className="card"
          style={{ padding:'0.625rem 0.875rem', display:'flex', alignItems:'center', gap:'0.625rem', flexShrink:0 }}
        >
          <span className={`badge ${s.cls}`} style={{ fontSize:'0.9375rem', padding:'0.15rem 0.5rem', fontWeight:700 }}>
            {s.count}
          </span>
          <span style={{ fontSize:'0.75rem', color:'var(--text-secondary)', whiteSpace:'nowrap' }}>{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIRM ALL BUTTON
// Drop into the attendees tab toolbar, next to "Ongeza Mhudhuria".
// ─────────────────────────────────────────────────────────────────────────────
export function ConfirmAllButton({ meetingId, attendees, onDone }) {
  const [loading, setLoading] = useState(false);

  const rsvpYesCount = attendees.filter(a => a.attendance_type === 'rsvp_yes').length;
  if (rsvpYesCount === 0) return null;

  async function handleConfirmAll() {
    setLoading(true);
    try {
      await meetingApi.confirmAll(meetingId);
      onDone();
    } catch (err) {
      alert(err.message || 'Imeshindwa kuthibitisha.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button className="btn btn-secondary btn-sm" onClick={handleConfirmAll} disabled={loading}>
      <IconUserCheck className="w-3.5 h-3.5"/>
      {loading ? 'Inathibitisha…' : `Thibitisha Wote (${rsvpYesCount})`}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIRM CELL
// Replace the existing delete-only cell in the attendees table <td>.
// ─────────────────────────────────────────────────────────────────────────────
export function AttendeeActions({ meetingId, attendee, canEdit, canManage, onConfirmed, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  const isConfirmed = !!attendee.confirmed_at;
  const isRsvp      = attendee.attendance_type?.startsWith('rsvp_');

  async function handleConfirm(type) {
    setConfirming(true);
    try {
      await meetingApi.confirmAttendee(meetingId, attendee.attendance_id, type);
      onConfirmed();
    } catch (err) {
      alert(err.message || 'Imeshindwa kuthibitisha.');
    } finally {
      setConfirming(false);
    }
  }

  if (!canEdit) return null;

  return (
    <div style={{ display:'flex', gap:'0.25rem', alignItems:'center' }}>
      {/* Confirm button — only for RSVP rows not yet confirmed */}
      {isRsvp && !isConfirmed && (
        <div style={{ position:'relative', display:'inline-block' }}>
          {confirming ? (
            <span style={{ fontSize:'0.75rem', color:'var(--text-tertiary)' }}>…</span>
          ) : (
            <div style={{ display:'flex', gap:'0.2rem' }}>
              <button
                className="btn btn-ghost btn-icon btn-sm"
                title="Thibitisha: Alihudhuia"
                style={{ color:'var(--success)' }}
                onClick={() => handleConfirm('present')}
              >
                <IconUserCheck className="w-3.5 h-3.5"/>
              </button>
            </div>
          )}
        </div>
      )}
      {/* Delete */}
      {canManage && (
        <button
          className="btn btn-ghost btn-icon btn-sm"
          style={{ color:'var(--danger)' }}
          onClick={onDelete}
        >
          <IconX className="w-3.5 h-3.5"/>
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RSVP ATTENDANCE TYPE BADGE
// Use in the attendees table instead of plain attendanceConfig badge.
// Shows RSVP state and confirmed indicator together.
// ─────────────────────────────────────────────────────────────────────────────
export function AttendanceTypeBadge({ attendee }) {
  const type = attendee.attendance_type;
  const confirmed = !!attendee.confirmed_at;

  const configs = {
    rsvp_yes:     { label:'Nitahudhuria',  cls:'badge-success',  prefix:'🔄 ' },
    rsvp_apology: { label:'Sitatoa Udhuru',cls:'badge-warning',  prefix:'🔄 ' },
    rsvp_no:      { label:'Sitahudhuria',  cls:'badge-danger',   prefix:'🔄 ' },
    present:      { label:'Alihudhuia',    cls:'badge-success',  prefix:''    },
    apology:      { label:'Alitoa Udhuru', cls:'badge-warning',  prefix:''    },
    absent:       { label:'Hakuhudhuia',   cls:'badge-danger',   prefix:''    },
  };
  const cfg = configs[type] || { label: type, cls:'badge-neutral', prefix:'' };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
      <span className={`badge ${cfg.cls}`}>
        {cfg.prefix}{cfg.label}
      </span>
      {confirmed && (
        <span style={{ fontSize:'0.6875rem', color:'var(--success)', display:'flex', alignItems:'center', gap:3 }}>
          <IconCheckCircle className="w-2.5 h-2.5"/> Imethibitishwa
        </span>
      )}
    </div>
  );
}