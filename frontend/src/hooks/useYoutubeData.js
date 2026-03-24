/**
 * useYouTubeData.js
 * ─────────────────────────────────────────────────────────────────
 * React hook — drop into your church portal.
 * Fetches live YouTube stats from your /api/youtube/dashboard
 * and /api/youtube/live endpoints.
 *
 * Usage:
 *   import { useYouTubeData, useLiveStatus } from "./useYouTubeData";
 *
 *   const { data, loading, error, refresh } = useYouTubeData();
 *   const { live, checking } = useLiveStatus({ pollInterval: 60000 });
 * ─────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback, useRef } from "react";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

// ── Main dashboard data hook ─────────────────────────────────────
// Fetches: channel stats, latest videos, YPP progress
// Refreshes every 5 minutes automatically.

export function useYouTubeData({ refreshInterval = 5 * 60 * 1000 } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`${BASE_URL}/youtube/dashboard`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Unknown error");
      setData(json.data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchData, refreshInterval]);

  return { data, loading, error, lastUpdated, refresh: fetchData };
}

// ── Live stream status hook ───────────────────────────────────────
// Polls /api/youtube/live at the given interval.
// Default: every 60 seconds. Only poll during service hours to save quota.

export function useLiveStatus({ pollInterval = 60 * 1000 } = {}) {
  const [live, setLive] = useState(null);
  const [checking, setChecking] = useState(true);

  const check = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/youtube/live`);
      const json = await res.json();
      if (json.success) setLive(json.data);
    } catch {
      // Silent fail — live indicator just stays as last known state
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    check();
    const interval = setInterval(check, pollInterval);
    return () => clearInterval(interval);
  }, [check, pollInterval]);

  return { live, checking, recheck: check };
}

// ── Watch hours hook ──────────────────────────────────────────────
// Fetches from /api/youtube/watch-hours (requires OAuth2 on backend).
// Pass startDate / endDate as "YYYY-MM-DD" strings.

export function useWatchHours({ startDate, endDate } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [oauthRequired, setOauthRequired] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (startDate) params.set("start", startDate);
    if (endDate) params.set("end", endDate);

    fetch(`${BASE_URL}/youtube/watch-hours?${params}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.setupRequired) {
          setOauthRequired(true);
          setError("OAuth2 setup required for watch hours.");
        } else if (json.success) {
          setData(json.data);
        } else {
          setError(json.error);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  return { data, loading, error, oauthRequired };
}