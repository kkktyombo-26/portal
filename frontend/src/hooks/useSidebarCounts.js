'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { dashboardApi } from '../lib/api';

/**
 * useSidebarCounts
 * ────────────────
 * Fetches the badge numbers for the sidebar from GET /api/dashboard/counts.
 *
 * Refetches when:
 *   • the hook mounts
 *   • the route changes — so a badge drops as soon as you clear the queue
 *   • the poll interval elapses
 *   • the tab becomes visible again after being hidden
 *
 * Polling pauses while the tab is hidden. A sidebar left open in a background
 * tab shouldn't keep spending a user's mobile data, and most of this app's
 * users are on phones.
 *
 * Errors are swallowed on purpose: a failed poll means the badges keep their
 * last known values rather than the whole sidebar erroring out. A genuine 401
 * is still handled by the axios interceptor in lib/api.js, which clears the
 * session and redirects.
 *
 * @param {Object}  options
 * @param {boolean} options.enabled  — skip fetching entirely (e.g. no user yet)
 * @param {number}  options.pollMs   — poll interval; 0 disables polling
 */
export function useSidebarCounts({ enabled = true, pollMs = 60000 } = {}) {
  const [counts,  setCounts]  = useState({});
  const [loading, setLoading] = useState(enabled);

  const pathname = usePathname();
  const alive    = useRef(true);
  const inFlight = useRef(false);

  const fetchCounts = useCallback(async () => {
    if (!enabled || inFlight.current) return;

    inFlight.current = true;
    try {
      const res  = await dashboardApi.getCounts();
      const next = res?.data?.counts;

      if (alive.current && next && typeof next === 'object') {
        setCounts(next);
      }
    } catch {
      // Intentionally silent — see note above.
    } finally {
      inFlight.current = false;
      if (alive.current) setLoading(false);
    }
  }, [enabled]);

  // Mount + every navigation.
  useEffect(() => {
    if (!enabled) return;
    fetchCounts();
  }, [enabled, pathname, fetchCounts]);

  // Polling, paused while the tab is in the background.
  useEffect(() => {
    if (!enabled || !pollMs) return;

    let timer = null;

    const start = () => {
      if (timer) return;
      timer = setInterval(fetchCounts, pollMs);
    };

    const stop = () => {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchCounts();   // catch up on what changed while hidden
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [enabled, pollMs, fetchCounts]);

  // Guard against setState after unmount.
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  return { counts, loading, refresh: fetchCounts };
}

export default useSidebarCounts;