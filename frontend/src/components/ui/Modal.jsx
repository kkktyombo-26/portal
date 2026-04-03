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
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
  >
    <div className="flex flex-col w-full max-w-modal max-h-[90vh] bg-canvas rounded-2xl shadow-modal">
      <div className="flex items-center justify-between flex-shrink-0 px-6 py-5 border-b border-hairline">
        <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
        <button onClick={onClose} className="btn-ghost w-8 h-8 text-lg leading-none">×</button>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
    </div>
  </div>
);
}
