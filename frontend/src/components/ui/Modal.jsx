'use client';
import { useEffect, useRef } from 'react';

export default function Modal({ isOpen, onClose, title, children }) {
  const overlayRef = useRef();

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    if (isOpen) {
      document.addEventListener('keydown', onKey);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(20, 16, 12, 0.72)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="flex flex-col w-full max-w-md relative overflow-hidden"
        style={{
          background: '#FFFFFF',
          borderRadius: 20,
          boxShadow: '0 24px 64px rgba(0,0,0,0.30), 0 2px 8px rgba(0,0,0,0.12)',
          border: '1px solid rgba(68,64,60,0.12)',
          maxHeight: '90vh',
        }}
      >
        {/* Amber accent top bar — matches the design system */}
        <div
          className="absolute top-0 left-0 right-0 h-0.5"
          style={{
            background: 'linear-gradient(90deg, #B45309 0%, #FCD34D 50%, #B45309 100%)',
          }}
        />

        {/* Header */}
        <div
          className="flex items-center justify-between flex-shrink-0 px-6 py-4 border-b"
          style={{ borderColor: '#F5F4F0' }}
        >
          <h2
            className="text-base font-bold text-neutral-900"
            style={{ fontFamily: 'Lora, Georgia, serif' }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  );
}