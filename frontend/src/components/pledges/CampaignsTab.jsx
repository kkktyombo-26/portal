'use client';

/**
 * CampaignsTab.jsx
 * ─────────────────
 * Tab 1 — Campaign list with create / edit modals.
 * Role guards:
 *   pastor / elder      → create any scope, soft-delete
 *   group_leader        → create group-scope only (own group)
 *   member              → read-only (this tab is hidden for them anyway)
 *
 * Bilingual: all strings go through t() (en / sw). Pass `lang` from page.jsx.
 * Add the keys from translations-campaigns.js to src/lib/i18n.js.
 *
 * Theme: colours come from design-system tokens / classes only.
 * The expanded row no longer fills with --surface-page (a third surface
 * inside a card); it is separated by a 1px rule instead.
 */

import { useState } from 'react';
import { pledgeApi } from '../../lib/pledgeApi';
import { useTranslation } from '../../lib/i18n';

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

// ── Helpers ───────────────────────────────────────────────────────────────────
const SCOPE_BADGE = {
  church: 'badge-gold',
  group:  'badge-navy',
  member: 'badge-neutral',
};

// Replace {placeholders} in a translated string
const fill = (str, vars = {}) =>
  Object.entries(vars).reduce((s, [k, v]) => s.replace(`{${k}}`, v), str);

const statLabel = {
  fontSize: '0.6875rem',
  color: 'var(--text-tertiary)',
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
};

// ── Progress bar inline ───────────────────────────────────────────────────────
function MiniProgress({ pct }) {
  const color = pct >= 100 ? 'var(--success)' : pct >= 60 ? 'var(--gold)' : 'var(--danger)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <div className="progress-bar" style={{ flex: 1 }}>
        <div className="progress-fill" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
      </div>
      <span style={{ fontSize: '0.6875rem', fontWeight: 600, color, minWidth: 32, textAlign: 'right' }}>
        {pct}%
      </span>
    </div>
  );
}

// ── Create / Edit modal ───────────────────────────────────────────────────────
function CampaignModal({ pledgeTypes, role, editing, onClose, onSaved, addToast, t, lang }) {
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
    if (!form.name.trim())    return setError(t('cp_err_name'));
    if (!form.pledge_type_id) return setError(t('cp_err_type'));
    if (!form.pledge_year)    return setError(t('cp_err_year'));

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
        addToast(fill(t('cp_toast_updated'), { name: form.name }));
      } else {
        await pledgeApi.createCampaign(payload);
        addToast(fill(t('cp_toast_created'), { name: form.name }));
      }
      onSaved();
    } catch (err) {
      setError(err.message || t('cp_err_save'));
    } finally {
      setSaving(false);
    }
  };

  const canSetScope = role !== 'group_leader';
  const typeName = (pt) => (lang === 'sw' ? pt.name_sw || pt.name_en : pt.name_en || pt.name_sw);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div
        className="modal"
        style={{ maxWidth: 520, display: 'flex', flexDirection: 'column', maxHeight: 'min(90vh, 680px)' }}
      >
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <div>
            <p className="modal-title">{isEdit ? t('cp_edit_title') : t('cp_new_title')}</p>
            <p className="card-subtitle">
              {isEdit ? fill(t('cp_editing'), { name: editing.name }) : t('cp_new_subtitle')}
            </p>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label={t('cancel')}>
            <XIcon />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div
            className="modal-body"
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', flex: 1, minHeight: 0 }}
          >
            {/* Name */}
            <div className="form-group">
              <label className="form-label">{t('cp_name')} *</label>
              <input
                className="input"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder={t('cp_name_placeholder')}
              />
            </div>

            {/* Type + Year */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">{t('cp_pledge_type')} *</label>
                <select
                  className="select"
                  value={form.pledge_type_id}
                  onChange={e => set('pledge_type_id', e.target.value)}
                >
                  <option value="">{t('cp_select_type')}</option>
                  {pledgeTypes.map(pt => (
                    <option key={pt.id} value={pt.id}>{typeName(pt)}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{t('cp_year')} *</label>
                <input
                  className="input" type="number" min="2000" max="2100"
                  value={form.pledge_year}
                  onChange={e => set('pledge_year', e.target.value)}
                />
              </div>
            </div>

            {/* Scope — hidden for group_leader (locked to 'group') */}
            {canSetScope && !isEdit && (
              <div className="form-group">
                <label className="form-label">{t('cp_scope')}</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {['church', 'group', 'member'].map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => set('scope', s)}
                      className={`btn btn-sm ${form.scope === s ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1 }}
                    >
                      {t(`cp_scope_${s}`)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Target amount */}
            <div className="form-group">
              <label className="form-label">{t('cp_target')}</label>
              <div className="input-group">
                <span className="input-icon" style={{ width: 'auto', fontSize: '0.8125rem', fontWeight: 500 }}>
                  TShs
                </span>
                <input
                  className="input" style={{ paddingLeft: '3rem' }}
                  type="number" min="0" step="1000"
                  value={form.target_amount}
                  onChange={e => set('target_amount', e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Dates */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">{t('cp_start_date')}</label>
                <input className="input" type="date" value={form.start_date}
                  onChange={e => set('start_date', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('cp_end_date')}</label>
                <input className="input" type="date" value={form.end_date}
                  onChange={e => set('end_date', e.target.value)} />
              </div>
            </div>

            {/* Description */}
            <div className="form-group">
              <label className="form-label">{t('cp_description')}</label>
              <textarea
                className="textarea" rows={2}
                value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder={t('cp_description_placeholder')}
              />
            </div>

            {error && <div className="banner banner-danger">{error}</div>}
          </div>

          <div className="modal-footer" style={{ flexShrink: 0 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>{t('cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? t('cp_saving') : isEdit ? t('cp_save_changes') : t('cp_create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Confirm deactivate modal ──────────────────────────────────────────────────
function ConfirmDeleteModal({ campaign, onClose, onDeleted, addToast, t }) {
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    setLoading(true);
    try {
      const res = await pledgeApi.deleteCampaign(campaign.id);
      const affected = res.data?.affected_pledges ?? 0;
      addToast(
        fill(t('cp_toast_deactivated'), { name: campaign.name }) +
          (affected > 0 ? ` ${fill(t('cp_toast_affected'), { n: affected })}` : ''),
        'warning'
      );
      onDeleted();
    } catch (err) {
      addToast(err.message || t('cp_err_delete'), 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <p className="modal-title">{t('cp_deactivate_title')}</p>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label={t('cancel')}>
            <XIcon />
          </button>
        </div>
        <div className="modal-body">
          <p style={{ lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--text-primary)' }}>{campaign.name}</strong>{' '}
            {t('cp_deactivate_body')}
            {Number(campaign.subscriber_count) > 0 && (
              <>
                {' '}
                {fill(t('cp_deactivate_pledges'), { n: campaign.subscriber_count })}
              </>
            )}
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>{t('cancel')}</button>
          <button className="btn btn-danger" onClick={handle} disabled={loading}>
            {loading ? t('cp_deactivating') : t('cp_deactivate')}
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
  campaigns, pledgeTypes, role, onRefresh, onDrill, addToast, fmtMoney, fmtDate, pctBar, lang,
}) {
  const { t } = useTranslation(lang);

  const [showCreate,   setShowCreate]   = useState(false);
  const [editing,      setEditing]      = useState(null);
  const [deleting,     setDeleting]     = useState(null);
  const [filterYear,   setFilterYear]   = useState('');
  const [filterScope,  setFilterScope]  = useState('');
  const [filterActive, setFilterActive] = useState('1'); // '1' | '0' | ''
  const [expandedId,   setExpandedId]   = useState(null);

  const canCreate = ['pastor', 'elder', 'group_leader'].includes(role);
  const canDelete = ['pastor', 'elder'].includes(role);

  const years = [...new Set(campaigns.map(c => c.pledge_year))].sort((a, b) => b - a);

  const filtered = campaigns.filter(c => {
    if (filterYear   && String(c.pledge_year) !== filterYear)        return false;
    if (filterScope  && c.scope !== filterScope)                     return false;
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
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', margin: '1.5rem 0' }}>
        <select className="select" style={{ width: 130 }} value={filterYear}
          onChange={e => setFilterYear(e.target.value)}>
          <option value="">{t('cp_all_years')}</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        <select className="select" style={{ width: 150 }} value={filterScope}
          onChange={e => setFilterScope(e.target.value)}>
          <option value="">{t('cp_all_scopes')}</option>
          <option value="church">{t('cp_scope_church')}</option>
          <option value="group">{t('cp_scope_group')}</option>
          <option value="member">{t('cp_scope_member')}</option>
        </select>

        <select className="select" style={{ width: 130 }} value={filterActive}
          onChange={e => setFilterActive(e.target.value)}>
          <option value="1">{t('active')}</option>
          <option value="0">{t('inactive')}</option>
          <option value="">{t('all')}</option>
        </select>

        <span className="form-hint" style={{ marginLeft: 'auto', marginTop: 0 }}>
          {filtered.length} {filtered.length === 1 ? t('cp_campaign_one') : t('cp_campaign_many')}
        </span>

        {canCreate && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
            <PlusIcon /> {t('cp_new_campaign')}
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
          <p className="empty-state-title">{t('cp_empty_title')}</p>
          <p className="empty-state-body">{t('cp_empty_body')}</p>
          {canCreate && (
            <div className="empty-state-actions">
              <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                <PlusIcon /> {t('cp_new_campaign')}
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
            const scopeCls = SCOPE_BADGE[c.scope] || SCOPE_BADGE.church;

            return (
              <div key={c.id} className="card" style={{ opacity: c.is_active ? 1 : 0.6 }}>
                {/* Card top row */}
                <div style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>

                  {/* Year badge */}
                  <div style={{
                    minWidth: 48, height: 48, borderRadius: 10,
                    background: c.is_active ? 'var(--gold-subtle)' : 'var(--border-subtle)',
                    color: c.is_active ? 'var(--gold-dark)' : 'var(--text-tertiary)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <span style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', lineHeight: 1 }}>
                      {c.pledge_type_name?.slice(0, 3).toUpperCase() || 'PLG'}
                    </span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 700, lineHeight: 1.2 }}>
                      {String(c.pledge_year).slice(-2)}
                    </span>
                  </div>

                  {/* Name + meta */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span className="card-title" style={{ fontSize: '0.9375rem' }}>{c.name}</span>
                      <span className={`badge ${scopeCls}`}>{t(`cp_scope_${c.scope}`)}</span>
                      {!c.is_active && <span className="badge badge-danger">{t('inactive')}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                      <span className="form-hint" style={{ marginTop: 0 }}>
                        {c.pledge_type_name} · {c.pledge_year}
                      </span>
                      {c.group_name && (
                        <span className="form-hint" style={{ marginTop: 0 }}>
                          {t('cp_group')}: {c.group_name}
                        </span>
                      )}
                      {c.start_date && (
                        <span className="form-hint" style={{ marginTop: 0 }}>
                          {fmtDate(c.start_date)} — {c.end_date ? fmtDate(c.end_date) : '…'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quick stats */}
                  <div style={{ display: 'flex', gap: '1.5rem', flexShrink: 0, alignItems: 'center' }}>
                    <div style={{ textAlign: 'right' }}>
                      <p style={statLabel}>{t('cp_members')}</p>
                      <p className="card-title" style={{ fontWeight: 700 }}>{c.subscriber_count || 0}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={statLabel}>{t('cp_collected')}</p>
                      <p className="card-title" style={{ fontWeight: 700, color: 'var(--text-accent)' }}>
                        {fmtMoney(paid)}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={statLabel}>{t('cp_pledged')}</p>
                      <p className="card-title" style={{ fontWeight: 700 }}>{fmtMoney(pledged)}</p>
                    </div>
                  </div>

                  {/* Expand toggle */}
                  <button
                    className="btn btn-ghost btn-icon btn-sm"
                    onClick={() => setExpandedId(isOpen ? null : c.id)}
                    style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}
                    aria-label={t('cp_expand')}
                    aria-expanded={isOpen}
                  >
                    <ChevronIcon />
                  </button>
                </div>

                {/* Progress bar */}
                <div style={{ padding: '0 1.25rem 0.75rem' }}>
                  <MiniProgress pct={pct} />
                  {target > 0 && (
                    <p className="form-hint" style={{ marginTop: 4 }}>
                      {t('target')}: TShs {fmtMoney(target)}
                    </p>
                  )}
                </div>

                {/* Expanded actions row — separated by a rule, no extra surface */}
                {isOpen && (
                  <div style={{
                    borderTop: '1px solid var(--border-subtle)',
                    padding: '0.75rem 1.25rem',
                    display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap',
                  }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => onDrill(c)}>
                      {t('cp_view_pledges')} ({c.subscriber_count || 0})
                    </button>
                    {canCreate && (
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditing(c)}>
                        {t('edit')}
                      </button>
                    )}
                    {canDelete && c.is_active && (
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--danger)', marginLeft: 'auto' }}
                        onClick={() => setDeleting(c)}
                      >
                        {t('cp_deactivate')}
                      </button>
                    )}
                    {c.created_by_name && (
                      <span
                        className="form-hint"
                        style={{ marginTop: 0, marginLeft: canDelete && c.is_active ? undefined : 'auto' }}
                      >
                        {t('cp_created_by')} {c.created_by_name}
                      </span>
                    )}
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
          t={t}
          lang={lang}
        />
      )}
      {deleting && (
        <ConfirmDeleteModal
          campaign={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => { setDeleting(null); onRefresh(); }}
          addToast={addToast}
          t={t}
        />
      )}
    </>
  );
}