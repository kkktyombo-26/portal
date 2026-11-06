'use client';
/**
 * components/dashboard/DashboardShell.jsx
 * ─────────────────────────────────────────
 * Wraps every dashboard page with:
 *   • Left sidebar (fixed on desktop, overlay on mobile)
 *   • Right info panel (fixed on xl+, overlay on mobile)
 *   • Mobile top bar with hamburger + church-info toggle
 *   • Auth guard — redirects to /get-account if not logged in
 *
 * Auth guard behaviour:
 *   loading=true  → show full-screen spinner (avoids flash of redirect)
 *   loading=false, no user → router.replace('/get-account')
 *   loading=false, user present → render layout normally
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar    from './Sidebar';
import RightPanel from './RightPanel';
import { useAuth } from '../../hooks/useAuth';

// ── Full-screen loading spinner shown while auth state resolves ─────────────
function FullScreenSpinner() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--surface-page)',
      }}
      aria-label="Inapakia…"
    >
      <svg
        className="animate-spin"
        style={{ width: 32, height: 32, color: 'var(--text-tertiary)' }}
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
        <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
    </div>
  );
}

export default function DashboardShell({ children }) {
  const [sidebarOpen,    setSidebarOpen]    = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);

  const { user, loading, lang } = useAuth();
  const router = useRouter();

  // Redirect unauthenticated visitors back to the login page.
  // router.replace() removes the protected route from browser history
  // so the back button does not loop back to a page they can't see.
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/get-account');
    }
  }, [loading, user, router]);

  // While auth state is being resolved from localStorage, show a spinner
  // rather than a blank flash or a premature redirect.
  if (loading || !user) return <FullScreenSpinner />;

  return (
    <div className="min-h-screen bg-neutral-50 flex">

      {/* ── Left sidebar — fixed on desktop, overlay on mobile ── */}
      <Sidebar
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />

      {/* ── Centre column ──
          On desktop (md+) the sidebar is fixed at 280px, so we push
          the centre column right with margin-left. The right panel is
          fixed at 260px on xl+, so we also pull the right edge in.
          On mobile both panels are full-screen overlays — the column
          fills the full width with no margin.
      */}
      <div
        className={[
          'flex flex-col min-h-screen w-full',
          'md:ml-[280px]',    // desktop: clear the fixed sidebar
          'xl:mr-[260px]',    // desktop xl: clear the fixed right panel
          'overflow-y-auto',
        ].join(' ')}
      >
        {/* Mobile top bar — hidden on desktop */}
        <header
          className="md:hidden bg-white border-b border-neutral-100 flex items-center px-4 gap-3 sticky top-0 z-20 flex-shrink-0"
          style={{ height: 'var(--topbar-h, 64px)' }}
        >
          {/* Hamburger */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded hover:bg-neutral-100 transition-colors"
            aria-label="Fungua menyu"
          >
            <svg width="18" height="13" viewBox="0 0 18 13" fill="none">
              <rect width="18" height="1.5" rx="0.75" fill="currentColor" />
              <rect y="5.75" width="12" height="1.5" rx="0.75" fill="currentColor" />
              <rect y="11.5" width="18" height="1.5" rx="0.75" fill="currentColor" />
            </svg>
          </button>

          {/* Brand */}
          <span className="font-display font-bold text-navy-900 flex-1 text-base">
            KKKT DMP Yombo
          </span>

          {/* Church info toggle */}
          <button
            onClick={() => setRightPanelOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded hover:bg-neutral-100 transition-colors"
            aria-label="Maelezo ya kanisa"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="9" cy="9" r="7.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M9 8v5M9 6.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1">
          {children}
        </main>
      </div>

      {/* ── Right panel — fixed on xl+, overlay on smaller screens ── */}
      <RightPanel
        lang={lang}
        mobileOpen={rightPanelOpen}
        onMobileClose={() => setRightPanelOpen(false)}
      />
    </div>
  );
}