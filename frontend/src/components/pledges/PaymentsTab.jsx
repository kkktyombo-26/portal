'use client';

/**
 * PaymentsTab.jsx
 * ───────────────
 * Records installment payments against a member_pledge and lists
 * the full payment history for that pledge.
 *
 * Route refs
 * ──────────
 *  GET  /api/pledges/member-pledges/:pledgeId/payments  → history
 *  POST /api/pledges/member-pledges/:pledgeId/payments  → record payment
 *
 * Props
 * ─────
 *  activePledge : pledge row from v_pledge_summary (may be null)
 *  onChangePledge() : open a pledge-selector so the user can pick a different pledge
 */

import { useState, useEffect, useCallback } from 'react';
import { pledgeApi } from '../../lib/pledgeApi';
import { useAuth } from '../../hooks/useAuth';

/* ── helpers ─────────────────────────────────────────────── */
const fmt = (n) =>
  n == null ? '—' : new Intl.NumberFormat('sw-TZ').format(Number(n));

const fmtDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short', year: 'numeric' });
};

const METHOD_LABELS = {
  cash:         'Taslimu',
  mobile_money: 'Simu ya Fedha',
  bank:         'Benki',
  cheque:       'Hundi',
};

/* ── Payment form ────────────────────────────────────────── */
function PaymentForm({ pledge, onSuccess }) {
  const { user } = useAuth();
  const isAdmin  = ['pastor', 'elder', 'group_leader'].includes(user?.role);

  const [form, setForm] = useState({
    amount:           '',
    payment_date:     new Date().toISOString().slice(0, 10),
    payment_method:   'cash',
    reference_number: '',
    notes:            '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const [ok,     setOk]     = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const balance = Math.max(0, Number(pledge.annual_amount ?? 0) - Number(pledge.total_paid ?? 0));

  const submit = async () => {
    if (!form.amount || Number(form.amount) <= 0) {
      setError('Ingiza kiasi halali cha malipo.');
      return;
    }
    setSaving(true);
    setError('');
    setOk(false);
    try {
      await pledgeApi.payments.record(pledge.id, {
        amount:           Number(form.amount),
        payment_date:     form.payment_date,
        payment_method:   form.payment_method,
        reference_number: form.reference_number || undefined,
        notes:            form.notes || undefined,
      });
      setOk(true);
      setForm(f => ({ ...f, amount: '', reference_number: '', notes: '' }));
      onSuccess?.();
    } catch (e) {
      setError(e?.response?.data?.message ?? 'Hitilafu imetokea. Jaribu tena.');
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) return null; // members cannot record payments

  return (
    <div className="border border-stone-200 rounded-xl bg-white divide-y divide-stone-100">
      <div className="px-4 py-3">
        <h4 className="text-sm font-semibold text-stone-800">Rekodi Malipo</h4>
        <p className="text-xs text-stone-400 mt-0.5">
          Baki ya sasa: <span className="font-medium text-stone-700">{fmt(balance)} TZS</span>
        </p>
      </div>

      <div className="px-4 py-4 space-y-3">
        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
        )}
        {ok && (
          <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
            ✓ Malipo yamesajiliwa.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          {/* Amount */}
          <div className="col-span-2 sm:col-span-1 space-y-1">
            <label className="text-xs font-medium text-stone-600">Kiasi (TZS) *</label>
            <input
              type="number"
              min="1"
              placeholder="0"
              value={form.amount}
              onChange={e => set('amount', e.target.value)}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          {/* Date */}
          <div className="col-span-2 sm:col-span-1 space-y-1">
            <label className="text-xs font-medium text-stone-600">Tarehe ya Malipo</label>
            <input
              type="date"
              value={form.payment_date}
              onChange={e => set('payment_date', e.target.value)}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          {/* Method */}
          <div className="col-span-2 sm:col-span-1 space-y-1">
            <label className="text-xs font-medium text-stone-600">Njia ya Malipo</label>
            <select
              value={form.payment_method}
              onChange={e => set('payment_method', e.target.value)}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              {Object.entries(METHOD_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          {/* Reference */}
          <div className="col-span-2 sm:col-span-1 space-y-1">
            <label className="text-xs font-medium text-stone-600">Kumb. ya Malipo <span className="text-stone-400">(hiari)</span></label>
            <input
              type="text"
              placeholder="e.g. MP-123456"
              value={form.reference_number}
              onChange={e => set('reference_number', e.target.value)}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          {/* Notes */}
          <div className="col-span-2 space-y-1">
            <label className="text-xs font-medium text-stone-600">Maelezo <span className="text-stone-400">(hiari)</span></label>
            <textarea
              rows={2}
              placeholder="Maelezo ya ziada…"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={submit}
            disabled={saving}
            className="px-5 py-2 text-sm font-medium bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            {saving ? 'Inasajili…' : 'Sajili Malipo'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Payment history list ────────────────────────────────── */
function PaymentHistory({ pledgeId, refreshKey }) {
  const [payments, setPayments] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await pledgeApi.payments.list(pledgeId);
      setPayments(r.data.payments ?? r.data ?? []);
    } catch {
      setError('Imeshindwa kupakia historia ya malipo.');
    } finally {
      setLoading(false);
    }
  }, [pledgeId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  if (loading) return (
    <div className="space-y-2 py-2">
      {[1, 2].map(i => (
        <div key={i} className="flex justify-between items-center py-2 animate-pulse">
          <div className="space-y-1">
            <div className="h-3 w-24 bg-stone-200 rounded" />
            <div className="h-2.5 w-36 bg-stone-100 rounded" />
          </div>
          <div className="h-4 w-20 bg-stone-200 rounded" />
        </div>
      ))}
    </div>
  );

  if (error) return <p className="text-xs text-red-500 py-2">{error}</p>;

  if (payments.length === 0) return (
    <p className="text-xs text-stone-400 py-4 text-center">Hakuna malipo yaliyosajiliwa bado.</p>
  );

  const total = payments.reduce((s, p) => s + Number(p.amount ?? 0), 0);

  return (
    <div>
      <div className="divide-y divide-stone-100">
        {payments.map(p => (
          <div key={p.id} className="flex items-center justify-between py-3 gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-stone-800 tabular-nums">{fmt(p.amount)} TZS</p>
              <p className="text-xs text-stone-400">
                {fmtDate(p.payment_date)} · {METHOD_LABELS[p.payment_method] ?? p.payment_method}
                {p.reference_number && ` · ${p.reference_number}`}
              </p>
              {p.notes && <p className="text-xs text-stone-400 italic mt-0.5 truncate">{p.notes}</p>}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-stone-200 pt-3 mt-1 flex justify-between text-xs font-semibold text-stone-700">
        <span>Jumla ya Malipo</span>
        <span className="tabular-nums">{fmt(total)} TZS</span>
      </div>
    </div>
  );
}

/* ── No pledge selected placeholder ─────────────────────── */
function NoPledgeSelected({ onChangePledge }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 space-y-3 text-center">
      <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#78716C" strokeWidth="1.5">
          <path d="M3 11h18M3 6h18M3 16h10"/>
        </svg>
      </div>
      <p className="text-sm font-medium text-stone-700">Chagua Ahadi</p>
      <p className="text-xs text-stone-400 max-w-xs">
        Nenda kwenye kichupo cha Ahadi, kisha bonyeza "Malipo →" kwenye ahadi unayotaka kulipa.
      </p>
      <button
        onClick={onChangePledge}
        className="mt-1 text-xs text-amber-600 hover:text-amber-700 font-medium transition-colors"
      >
        Nenda kwenye Ahadi ↗
      </button>
    </div>
  );
}

/* ── Main export ─────────────────────────────────────────── */
export default function PaymentsTab({ activePledge, onChangePledge }) {
  const [refreshKey, setRefreshKey] = useState(0);

  if (!activePledge) {
    return <NoPledgeSelected onChangePledge={onChangePledge} />;
  }

  const paid    = Number(activePledge.total_paid    ?? 0);
  const pledged = Number(activePledge.annual_amount ?? 0);
  const pct     = pledged > 0 ? Math.min(100, Math.round((paid / pledged) * 100)) : 0;

  return (
    <div className="space-y-5">
      {/* context banner */}
      <div className="border border-amber-200 bg-amber-50 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-stone-800 truncate">{activePledge.campaign_name}</p>
          <p className="text-xs text-stone-500">
            {activePledge.member_name ?? '—'} · Ahadi {fmt(pledged)} TZS · Imelipwa {pct}%
          </p>
        </div>
        <button
          onClick={onChangePledge}
          className="text-xs text-amber-700 hover:text-amber-800 font-medium whitespace-nowrap transition-colors flex-shrink-0"
        >
          Badilisha ↗
        </button>
      </div>

      {/* form */}
      <PaymentForm
        pledge={activePledge}
        onSuccess={() => setRefreshKey(k => k + 1)}
      />

      {/* history */}
      <div className="border border-stone-200 rounded-xl bg-white divide-y divide-stone-100">
        <div className="px-4 py-3">
          <h4 className="text-sm font-semibold text-stone-800">Historia ya Malipo</h4>
        </div>
        <div className="px-4 py-1">
          <PaymentHistory pledgeId={activePledge.id} refreshKey={refreshKey} />
        </div>
      </div>
    </div>
  );
}