'use client';

/**
 * PledgesTab.jsx
 * ──────────────
 * Lists member_pledges (via v_pledge_summary), lets eligible roles
 * subscribe a member to an active campaign, and delete their own pledge.
 *
 * Route refs
 * ──────────
 *  GET  /api/pledges/member/:memberId          → list a member's pledges
 *  GET  /api/pledges/campaigns?active=1        → dropdown in subscribe modal
 *  POST /api/pledges/member/:memberId/subscribe → create member_pledge
 *  DEL  /api/pledges/member-pledges/:pledgeId  → remove pledge
 *
 * Role guard (mirrors backend)
 *  pastor / elder  → see all members, can subscribe anyone
 *  group_leader    → can subscribe members in own group
 *  member          → sees own pledges only; subscribe button hidden
 */

import { useState, useEffect, useCallback } from 'react';
import { pledgeApi } from '../../lib/pledgeApi';
import { useAuth } from '../../hooks/useAuth';

/* ── helpers ──────────────────────────────────────────────── */
const fmt = (n) =>
  n == null ? '—' : new Intl.NumberFormat('sw-TZ').format(n);

const SCOPE_LABEL = { church: 'Kanisa', group: 'Kikundi', member: 'Mwanachama' };

/* ── tiny shared UI primitives ───────────────────────────── */
function Badge({ fulfilled }) {
  return fulfilled ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M2 5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      Imetimizwa
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
      Inaendelea
    </span>
  );
}

function ProgressBar({ paid, pledged }) {
  const p = pledged > 0 ? Math.min(100, Math.round((paid / pledged) * 100)) : 0;
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-500 rounded-full transition-all"
          style={{ width: `${p}%` }}
        />
      </div>
      <span className="text-xs text-stone-400 tabular-nums w-8 text-right">{p}%</span>
    </div>
  );
}

/* ── Subscribe modal ─────────────────────────────────────── */
function SubscribeModal({ memberId, onClose, onSuccess }) {
  const [campaigns, setCampaigns]   = useState([]);
  const [form, setForm]             = useState({
    campaign_id:   '',
    annual_amount: '',
    signed_date:   new Date().toISOString().slice(0, 10),
    pledge_number: '',
  });
  const [saving, setSaving]         = useState(false);
  const [error,  setError]          = useState('');

  useEffect(() => {
    pledgeApi.campaigns.list({ active: 1 })
      .then(r => setCampaigns(r.data.campaigns ?? r.data))
      .catch(() => setError('Imeshindwa kupakia kampeni.'));
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.campaign_id || !form.annual_amount) {
      setError('Tafadhali jaza kampeni na kiasi cha ahadi.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await pledgeApi.pledges.subscribe(memberId, {
        campaign_id:   Number(form.campaign_id),
        annual_amount: Number(form.annual_amount),
        signed_date:   form.signed_date || undefined,
        pledge_number: form.pledge_number || undefined,
      });
      onSuccess();
    } catch (e) {
      setError(e?.response?.data?.message ?? 'Hitilafu imetokea. Jaribu tena.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
        {/* header */}
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
          <h3 className="font-semibold text-stone-800">Jiunge na Kampeni</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-stone-100 text-stone-400 transition-colors">
            ✕
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Campaign picker */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-600">Kampeni *</label>
            <select
              value={form.campaign_id}
              onChange={e => set('campaign_id', e.target.value)}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
            >
              <option value="">— Chagua kampeni —</option>
              {campaigns.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.year}) — {SCOPE_LABEL[c.scope] ?? c.scope}
                </option>
              ))}
            </select>
          </div>

          {/* Amount */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-600">Kiasi cha Ahadi (TZS) *</label>
            <input
              type="number"
              min="0"
              placeholder="e.g. 500000"
              value={form.annual_amount}
              onChange={e => set('annual_amount', e.target.value)}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          {/* Pledge number (optional) */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-600">Nambari ya Ahadi <span className="text-stone-400">(hiari)</span></label>
            <input
              type="text"
              placeholder="e.g. AHD-001"
              value={form.pledge_number}
              onChange={e => set('pledge_number', e.target.value)}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          {/* Signed date */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-600">Tarehe ya Kusaini</label>
            <input
              type="date"
              value={form.signed_date}
              onChange={e => set('signed_date', e.target.value)}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
        </div>

        <div className="px-6 pb-5 flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
          >
            Ghairi
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="px-5 py-2 text-sm font-medium bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            {saving ? 'Inasajili…' : 'Sajili Ahadi'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Row ─────────────────────────────────────────────────── */
function PledgeRow({ pledge, canDelete, onDelete, onSelectPayments }) {
  const paid    = Number(pledge.total_paid     ?? 0);
  const pledged = Number(pledge.annual_amount  ?? 0);

  return (
    <div className="border border-stone-200 rounded-xl bg-white px-4 py-3 space-y-2 hover:border-stone-300 transition-colors">
      {/* top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-stone-800 truncate">{pledge.campaign_name ?? pledge.campaign_id}</p>
          <p className="text-xs text-stone-500">
            {pledge.member_name ?? '—'} · {pledge.campaign_year ?? '—'} · {SCOPE_LABEL[pledge.scope] ?? pledge.scope ?? '—'}
          </p>
        </div>
        <Badge fulfilled={pledge.is_fulfilled} />
      </div>

      {/* amounts */}
      <div className="flex items-center gap-4 text-xs text-stone-600">
        <div>
          <span className="text-stone-400">Ahadi </span>
          <span className="font-medium tabular-nums">{fmt(pledged)}</span>
        </div>
        <div>
          <span className="text-stone-400">Imelipwa </span>
          <span className="font-medium tabular-nums text-amber-600">{fmt(paid)}</span>
        </div>
        <div>
          <span className="text-stone-400">Baki </span>
          <span className="font-medium tabular-nums">{fmt(Math.max(0, pledged - paid))}</span>
        </div>
      </div>

      <ProgressBar paid={paid} pledged={pledged} />

      {/* actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => onSelectPayments(pledge)}
          className="text-xs text-amber-600 hover:text-amber-700 font-medium transition-colors"
        >
          Malipo →
        </button>
        {pledge.pledge_number && (
          <span className="text-xs text-stone-400">#{pledge.pledge_number}</span>
        )}
        {canDelete && (
          <button
            onClick={() => onDelete(pledge)}
            className="ml-auto text-xs text-red-400 hover:text-red-600 transition-colors"
          >
            Futa
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Main export ─────────────────────────────────────────── */
export default function PledgesTab({ onNavigateToPayments }) {
  const { user } = useAuth();

  const [pledges,  setPledges]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [showSub,  setShowSub]  = useState(false);

  // target member: admins might pick; members always see themselves
  const memberId = user?.id;
  const isAdmin  = ['pastor', 'elder', 'group_leader'].includes(user?.role);

  const load = useCallback(async () => {
    if (!memberId) return;
    setLoading(true);
    setError('');
    try {
      const r = await pledgeApi.pledges.list(memberId);
      setPledges(r.data.pledges ?? r.data ?? []);
    } catch {
      setError('Imeshindwa kupakia ahadi. Jaribu tena.');
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (pledge) => {
    if (!confirm(`Futa ahadi ya "${pledge.campaign_name}"? Malipo yote yatafutwa.`)) return;
    try {
      await pledgeApi.pledges.delete(pledge.id);
      await load();
    } catch {
      alert('Imeshindwa kufuta ahadi.');
    }
  };

  /* ── empty / loading states ── */
  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
      <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#D97706" strokeWidth="1.5">
          <rect x="3" y="5" width="16" height="14" rx="2"/>
          <path d="M7 5V4a4 4 0 018 0v1"/>
          <path d="M11 11v3M11 9.5v.5"/>
        </svg>
      </div>
      <p className="text-sm font-medium text-stone-700">Hakuna ahadi bado</p>
      <p className="text-xs text-stone-400 max-w-xs">
        {isAdmin ? 'Sajili ahadi mpya kwa kutumia kitufe hapo chini.' : 'Wasiliana na kiongozi wako kwa usajili wa ahadi.'}
      </p>
      {isAdmin && (
        <button
          onClick={() => setShowSub(true)}
          className="mt-2 px-4 py-2 text-sm font-medium bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors"
        >
          Sajili Ahadi
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-stone-800">Ahadi za Mwanachama</h2>
          <p className="text-xs text-stone-500 mt-0.5">
            {loading ? '…' : `Ahadi ${pledges.length}`}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowSub(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6.5 1v11M1 6.5h11"/>
            </svg>
            Sajili Ahadi
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="border border-stone-100 rounded-xl bg-white px-4 py-3 animate-pulse space-y-2">
              <div className="h-3.5 w-40 bg-stone-200 rounded" />
              <div className="h-2.5 w-56 bg-stone-100 rounded" />
              <div className="h-1.5 w-full bg-stone-100 rounded-full" />
            </div>
          ))}
        </div>
      ) : pledges.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {pledges.map(p => (
            <PledgeRow
              key={p.id}
              pledge={p}
              canDelete={isAdmin}
              onDelete={handleDelete}
              onSelectPayments={(pledge) => onNavigateToPayments?.(pledge)}
            />
          ))}
        </div>
      )}

      {showSub && (
        <SubscribeModal
          memberId={memberId}
          onClose={() => setShowSub(false)}
          onSuccess={() => { setShowSub(false); load(); }}
        />
      )}
    </div>
  );
}