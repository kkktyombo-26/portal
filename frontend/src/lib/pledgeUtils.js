/**
 * lib/pledgeUtils.js
 * ──────────────────
 * Shared formatting helpers for the Pledge Campaign module.
 * Kept outside page.jsx so Next.js App Router does not reject
 * them as invalid Page export fields.
 */

export function fmtMoney(n) {
  const num = Number(n) || 0;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000)     return `${(num / 1_000).toFixed(0)}K`;
  return num.toLocaleString();
}

export function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function pctBar(paid, pledged) {
  if (!pledged || pledged <= 0) return 0;
  return Math.min(100, Math.round((paid / pledged) * 100));
}