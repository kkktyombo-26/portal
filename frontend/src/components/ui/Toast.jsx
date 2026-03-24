'use client';
export default function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className={`toast ${toast.type === 'error' ? 'bg-danger text-white' : 'bg-ink text-white'}`}>
      <span className="text-xs">{toast.type === 'error' ? '✕' : '✓'}</span>
      <span>{toast.msg}</span>
    </div>
  );
}
