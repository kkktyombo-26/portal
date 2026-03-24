'use client';
import { useState } from 'react';
import Sidebar from './Sidebar';
import RightPanel from './RightPanel';
import { useAuth } from '../../hooks/useAuth';

export default function DashboardShell({ children }) {
  const [sidebarOpen,    setSidebarOpen]    = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const { lang } = useAuth();

  return (
    <div className="min-h-screen bg-surface flex">

      {/* ── Left sidebar ── */}
      <Sidebar mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">

        {/* Mobile top bar */}
        <header className="xl:hidden bg-canvas border-b border-hairline h-14 flex items-center px-4 gap-3 sticky top-0 z-20 flex-shrink-0">
          {/* Left: hamburger (sidebar) */}
          <button onClick={() => setSidebarOpen(true)}
            className="btn-ghost w-9 h-9 flex items-center justify-center" aria-label="Menu">
            <svg width="18" height="13" viewBox="0 0 18 13" fill="none">
              <rect width="18" height="1.5" rx="0.75" fill="currentColor"/>
              <rect y="5.75" width="12" height="1.5" rx="0.75" fill="currentColor"/>
              <rect y="11.5" width="18" height="1.5" rx="0.75" fill="currentColor"/>
            </svg>
          </button>

          {/* Title */}
          <span className="font-display text-base font-bold text-ink flex-1">
            {lang === 'sw' ? 'Mfumo wa Kanisa' : 'Church Portal'}
          </span>

          {/* Right: info panel toggle */}
          <button onClick={() => setRightPanelOpen(true)}
            className="btn-ghost w-9 h-9 flex items-center justify-center" aria-label="Church info">
            {/* Info icon — bare, Rule 4 */}
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="9" cy="9" r="7.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M9 8v5M9 6.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* ── Right panel ── */}
      <RightPanel
        lang={lang}
        mobileOpen={rightPanelOpen}
        onMobileClose={() => setRightPanelOpen(false)}
      />
    </div>
  );
}
