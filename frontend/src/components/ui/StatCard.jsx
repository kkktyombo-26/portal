'use client';
export default function StatCard({ label, value, index = 0 }) {
  return (
    <div className={`bg-canvas border border-hairline rounded-xl px-5 py-4 animate-slide-up stagger-${index + 1}`}>
      <div className="font-mono text-3xl font-bold text-ink leading-none">{value ?? '—'}</div>
      <div className="section-label mt-1.5">{label}</div>
    </div>
  );
}
