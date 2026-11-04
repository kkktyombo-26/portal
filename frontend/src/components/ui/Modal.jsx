'use client';
import { useEffect, useRef } from 'react';

export default function Modal({ isOpen, onClose, title, children }) {
  const overlayRef = useRef();
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    if (isOpen) { document.addEventListener('keydown', onKey); document.body.style.overflow = 'hidden'; }
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [isOpen, onClose]);
  if (!isOpen) return null;
  return (
    <div
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
    >
      <div className="flex flex-col w-full max-w-modal max-h-[90vh] rounded-2xl shadow-modal
        bg-white/10 backdrop-blur-xl backdrop-saturate-150
        border border-white/20
        before:absolute before:inset-0 before:rounded-2xl
        before:bg-gradient-to-br before:from-white/15 before:via-white/5 before:to-transparent
        before:pointer-events-none relative overflow-hidden">

        {/* shimmer sweep */}
        <div className="absolute inset-0 rounded-2xl pointer-events-none
          bg-[linear-gradient(135deg,rgba(255,255,255,0.18)_0%,rgba(255,255,255,0)_50%,rgba(255,255,255,0.06)_100%)]" />

        <div className="flex items-center justify-between flex-shrink-0 px-6 py-5 border-b border-white/15 relative">
          <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
          <button onClick={onClose} className="btn-ghost w-8 h-8 text-lg leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 relative">{children}</div>
      </div>
    </div>
  );
}