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
    <div ref={overlayRef} onClick={(e) => e.target === overlayRef.current && onClose()} className="modal-overlay">
      <div className="modal-panel">
        <div className="modal-header">
          <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
          <button onClick={onClose} className="btn-ghost w-8 h-8 text-lg leading-none">×</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
