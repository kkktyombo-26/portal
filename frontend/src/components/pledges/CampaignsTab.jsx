'use client';

/**
 * CampaignsTab.jsx
 * ─────────────────
 * Tab 1 — Campaign list with create / edit modals.
 * Role guards:
 *   pastor / elder      → create any scope, soft-delete
 *   group_leader        → create group-scope only (own group)
 *   member              → read-only (this tab is hidden for them anyway)
 */

import { useState } from 'react';
import { pledgeApi } from '../../lib/pledgeApi';

// ── Icons ─────────────────────────────────────────────────────────────────────
const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="7" y1="1" x2="7" y2="13"/><line x1="1" y1="7" x2="13" y2="7"/>
  </svg>
);
const ChevronIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 5 7 8 10 5"/>
  </svg>
);
const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/>
  </svg>
);

// ── Scope badge ───────────────────────────────────────────────────────────────
const SCOPE_BADGE = {
  church: { cls: 'badge-gold',    label: 'Church-wide' },
  group:  { cls: 'badge-navy',    label: 'Group'       },
  member: { cls: 'badge-neutral', label: 'Member'      },
};

// ── Progress bar inline ───────────────────────────────────────────────────────
function MiniProgress({ pct }) {
  const color = pct >= 100 ? 'var(--success)' : pct >= 60 ? '#F59E0B' : 'var(--danger)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <div className="progress-bar" style={{ flex: 1 }}>
        <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span style={{ fontSize: '0.6875rem', fontWeight: 600, color, minWidth: 32, textAlign: 'right' }}>
        {pct}%
      </span>
    </div>
  );
}

// ── Create / Edit modal ───────────────────────────────────────────────────────
function CampaignModal({ pledgeTypes, role, editing, onClose, onSaved, addToast }) {
  const isEdit = !!editing;
  const currentYear = new Date().getFullYear();

  const [form, setForm] = useState({
    name:           editing?.name           || '',
    pledge_type_id: editing?.pledge_type_id || '',
    scope:          editing?.scope          || (role === 'group_leader' ? 'group' : 'church'),
    pledge_year:    editing?.pledge_year    || currentYear,
    target_amount:  editing?.target_amount  || '',
    start_date:     editing?.start_date     ? editing.start_date.slice(0, 10) : '',
    end_date:       editing?.end_date       ? editing.end_date.slice(0, 10)   : '',
    description:    editing?.description    || '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim())      return setError('Campaign name is required.');
    if (!form.pledge_type_id)   return setError('Pledge type is required.');
    if (!form.pledge_year)      return setError('Year is required.');

    setSaving(true);
    try {
      const payload = {
        ...form,
        pledge_type_id: Number(form.pledge_type_id),
        pledge_year:    Number(form.pledge_year),
        target_amount:  form.target_amount ? Number(form.target_amount) : 0,
        start_date:     form.start_date || null,
        end_date:       form.end_date   || null,
      };

      if (isEdit) {
        await pledgeApi.updateCampaign(editing.id, payload);
        addToast(`Campaign "${form.name}" updated.`);
      } else {
        await pledgeApi.createCampaign(payload);
        addToast(`Campaign "${form.name}" created.`);
      }
      onSaved();
    } catch (err) {
      setError(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const canSetScope = role !== 'group_leader';

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      {/* FIX: modal uses flex-column so header/footer are fixed and body scrolls */}
      <div
        className="modal"
        style={{
          maxWidth: 520,
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'min(90vh, 680px)',
        }}
      >
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <div>
            <p className="modal-title">{isEdit ? 'Edit Campaign' : 'New Pledge Campaign'}</p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
              {isEdit ? `Editing: ${editing.name}` : 'Create a new ahadi campaign'}
            </p>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><XIcon /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          {/* FIX: modal-body scrolls independently */}
          <div
            className="modal-body"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              overflowY: 'auto',
              flex: 1,
              minHeight: 0,
            }}
          >

            {/* Name */}
            <div className="form-group">
              <label className="form-label">Campaign Name *</label>
              <input className="input" value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="e.g. Jengo 2026" />
            </div>

            {/* Type + Year */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Pledge Type *</label>
                <select className="select" value={form.pledge_type_id} onChange={e => set('pledge_type_id', e.target.value)}>
                  <option value="">Select type…</option>
                  {pledgeTypes.map(t => (
                    <option key={t.id} value={t.id}>{t.name_sw} — {t.name_en}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Year *</label>
                <input className="input" type="number" min="2000" max="2100"
                  value={form.pledge_year} onChange={e => set('pledge_year', e.target.value)} />
              </div>
            </div>

            {/* Scope — hidden for group_leader (locked to 'group') */}
            {canSetScope && !isEdit && (
              <div className="form-group">
                <label className="form-label">Scope</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {['church','group','member'].map(s => (
                    <button
                      key={s} type="button"
                      onClick={() => set('scope', s)}
                      className="btn btn-sm"
                      style={{
                        flex: 1,
                        background: form.scope === s ? '#F59E0B' : 'var(--surface-page)',
                        color:      form.scope === s ? '#fff'    : 'var(--text-secondary)',
                        border:     `1px solid ${form.scope === s ? '#F59E0B' : 'var(--border-default)'}`,
                        fontWeight: form.scope === s ? 600 : 400,
                        textTransform: 'capitalize',
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Target amount */}
            <div className="form-group">
              <label className="form-label">Target Amount (TShs) — optional</label>
              <div className="input-group">
                <span className="input-icon" style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-tertiary)' }}>
                  TShs
                </span>
                <input className="input" style={{ paddingLeft: '3rem' }} type="number" min="0" step="1000"
                  value={form.target_amount} onChange={e => set('target_amount', e.target.value)}
                  placeholder="0" />
              </div>
            </div>

            {/* Dates */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Start Date</label>
                <input className="input" type="date" value={form.start_date}
                  onChange={e => set('start_date', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">End Date</label>
                <input className="input" type="date" value={form.end_date}
                  onChange={e => set('end_date', e.target.value)} />
              </div>
            </div>

            {/* Description */}
            <div className="form-group">
              <label className="form-label">Description — optional</label>
              <textarea className="textarea" rows={2} value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder="Brief description for this campaign…" />
            </div>

            {error && <p className="form-error">{error}</p>}
          </div>

          <div className="modal-footer" style={{ flexShrink: 0 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Confirm delete modal ──────────────────────────────────────────────────────
function ConfirmDeleteModal({ campaign, onClose, onDeleted, addToast }) {
  const [loading, setLoading] = useState(false);
  const handle = async () => {
    setLoading(true);
    try {
      const res = await pledgeApi.deleteCampaign(campaign.id);
      addToast(
        `"${campaign.name}" deactivated.${res.data.affected_pledges > 0 ? ` (${res.data.affected_pledges} pledge(s) affected)` : ''}`,
        'warning'
      );
      onDeleted();
    } catch (err) {
      addToast(err.message || 'Delete failed.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <p className="modal-title">Deactivate Campaign?</p>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><XIcon /></button>
        </div>
        <div className="modal-body">
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--text-primary)' }}>{campaign.name}</strong> will be
            deactivated. Existing pledges and payment history are preserved.
            {Number(campaign.subscriber_count) > 0 && (
              <> This campaign has <strong>{campaign.subscriber_count} member pledge(s)</strong>.</>
            )}
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" onClick={handle} disabled={loading}>
            {loading ? 'Deactivating…' : 'Deactivate'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAMPAIGNS TAB
// ═══════════════════════════════════════════════════════════════════════════════
export default function CampaignsTab({
  campaigns, pledgeTypes, role, onRefresh, onDrill, addToast, fmtMoney, fmtDate, pctBar
}) {
  const [showCreate,  setShowCreate]  = useState(false);
  const [editing,     setEditing]     = useState(null);
  const [deleting,    setDeleting]    = useState(null);
  const [filterYear,  setFilterYear]  = useState('');
  const [filterScope, setFilterScope] = useState('');
  const [filterActive,setFilterActive]= useState('1'); // '1' | '0' | ''
  const [expandedId,  setExpandedId]  = useState(null);

  const canCreate = ['pastor','elder','group_leader'].includes(role);
  const canDelete = ['pastor','elder'].includes(role);

  // Years available in data
  const years = [...new Set(campaigns.map(c => c.pledge_year))].sort((a,b) => b - a);

  const filtered = campaigns.filter(c => {
    if (filterYear   && String(c.pledge_year) !== filterYear)   return false;
    if (filterScope  && c.scope !== filterScope)                return false;
    if (filterActive !== '' && String(c.is_active) !== filterActive) return false;
    return true;
  });

  const handleSaved = () => {
    setShowCreate(false);
    setEditing(null);
    onRefresh();
  };

  return (
    <>
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.5rem', marginTop: '1.5rem' }}>

        {/* Filters */}
        <select className="select" style={{ width: 120 }} value={filterYear}
          onChange={e => setFilterYear(e.target.value)}>
          <option value="">All years</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        <select className="select" style={{ width: 140 }} value={filterScope}
          onChange={e => setFilterScope(e.target.value)}>
          <option value="">All scopes</option>
          <option value="church">Church-wide</option>
          <option value="group">Group</option>
          <option value="member">Member</option>
        </select>

        <select className="select" style={{ width: 120 }} value={filterActive}
          onChange={e => setFilterActive(e.target.value)}>
          <option value="1">Active</option>
          <option value="0">Inactive</option>
          <option value="">All</option>
        </select>

        <span style={{ marginLeft: 'auto', fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>
          {filtered.length} campaign{filtered.length !== 1 ? 's' : ''}
        </span>

        {canCreate && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
            <PlusIcon /> New Campaign
          </button>
        )}
      </div>

      {/* ── Campaign list ─────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <svg className="empty-state-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.4">
            <rect x="8" y="12" width="32" height="28" rx="3"/>
            <path d="M16 12V9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3"/>
            <line x1="18" y1="22" x2="30" y2="22"/><line x1="18" y1="28" x2="24" y2="28"/>
          </svg>
          <p className="empty-state-title">No campaigns found</p>
          <p className="empty-state-body">Adjust your filters or create a new pledge campaign.</p>
          {canCreate && (
            <div className="empty-state-actions">
              <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                <PlusIcon /> New Campaign
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filtered.map(c => {
            const paid    = Number(c.total_paid    || 0);
            const pledged = Number(c.total_pledged || 0);
            const target  = Number(c.target_amount || 0);
            const pct     = pctBar(paid, pledged || target);
            const isOpen  = expandedId === c.id;
            const scopeMeta = SCOPE_BADGE[c.scope] || SCOPE_BADGE.church;

            return (
              <div key={c.id} className="card" style={{ opacity: c.is_active ? 1 : 0.6 }}>
                {/* Card top row */}
                <div style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>

                  {/* Year badge */}
                  <div style={{
                    minWidth: 48, height: 48, borderRadius: 10,
                    background: c.is_active ? '#FFFBEB' : '#F5F5F4',
                    color: c.is_active ? '#B45309' : 'var(--text-tertiary)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <span style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', lineHeight: 1 }}>
                      {c.pledge_type_name?.slice(0,3).toUpperCase() || 'PLG'}
                    </span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 700, lineHeight: 1.2 }}>
                      {String(c.pledge_year).slice(-2)}
                    </span>
                  </div>

                  {/* Campaign name + meta */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'Lora, serif' }}>
                        {c.name}
                      </span>
                      <span className={`badge ${scopeMeta.cls}`}>{scopeMeta.label}</span>
                      {!c.is_active && <span className="badge badge-danger">Inactive</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                        {c.pledge_type_name} · {c.pledge_year}
                      </span>
                      {c.group_name && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                          Group: {c.group_name}
                        </span>
                      )}
                      {c.start_date && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                          {fmtDate(c.start_date)} — {fmtDate(c.end_date)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quick stats */}
                  <div style={{ display: 'flex', gap: '1.5rem', flexShrink: 0, alignItems: 'center' }}>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Members</p>
                      <p style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Lora, serif' }}>
                        {c.subscriber_count || 0}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Collected</p>
                      <p style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-accent)', fontFamily: 'Lora, serif' }}>
                        {fmtMoney(paid)}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Pledged</p>
                      <p style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Lora, serif' }}>
                        {fmtMoney(pledged)}
                      </p>
                    </div>
                  </div>

                  {/* Expand toggle */}
                  <button
                    className="btn btn-ghost btn-icon btn-sm"
                    onClick={() => setExpandedId(isOpen ? null : c.id)}
                    style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}
                    aria-label="Expand"
                  >
                    <ChevronIcon />
                  </button>
                </div>

                {/* Progress bar */}
                <div style={{ padding: '0 1.25rem 0.75rem' }}>
                  <MiniProgress pct={pct} />
                  {target > 0 && (
                    <p style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', marginTop: 4 }}>
                      Target: TShs {fmtMoney(target)}
                    </p>
                  )}
                </div>

                {/* Expanded actions row */}
                {isOpen && (
                  <div style={{
                    borderTop: '1px solid var(--border-subtle)',
                    padding: '0.75rem 1.25rem',
                    display: 'flex', gap: '0.5rem', alignItems: 'center',
                    background: 'var(--surface-page)',
                    borderRadius: '0 0 12px 12px',
                  }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => onDrill(c)}
                    >
                      View Pledges ({c.subscriber_count || 0})
                    </button>
                    {canCreate && (
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditing(c)}>
                        Edit
                      </button>
                    )}
                    {canDelete && c.is_active && (
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--danger)', marginLeft: 'auto' }}
                        onClick={() => setDeleting(c)}
                      >
                        Deactivate
                      </button>
                    )}
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginLeft: canDelete ? '' : 'auto' }}>
                      Created by {c.created_by_name}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {(showCreate || editing) && (
        <CampaignModal
          pledgeTypes={pledgeTypes}
          role={role}
          editing={editing}
          onClose={() => { setShowCreate(false); setEditing(null); }}
          onSaved={handleSaved}
          addToast={addToast}
        />
      )}
      {deleting && (
        <ConfirmDeleteModal
          campaign={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => { setDeleting(null); onRefresh(); }}
          addToast={addToast}
        />
      )}
    </>
  );
}