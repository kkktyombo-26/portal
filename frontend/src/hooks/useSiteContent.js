// hooks/useSiteContent.js  (Next.js / React client hook)
// Drop this in your hooks/ folder.
// Usage:
//   const { content, loading, error, save, saving } = useSiteContent('hero_slides');

import { useState, useEffect, useCallback } from 'react';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export function useSiteContent(key) {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${BASE}/site-content/${key}`)
      .then(r => r.json())
      .then(json => {
        if (!cancelled) {
          if (json.success) setContent(json.data);
          else setError(json.message);
        }
      })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [key]);

  const save = useCallback(async (value) => {
    setSaving(true);
    setError(null);
    try {
      const token = document.cookie.match(/(?:^|; )token=([^;]*)/)?.[1]
        ?? localStorage.getItem('token')
        ?? '';
      const res = await fetch(`${BASE}/site-content/${key}`, {
        method:  'PUT',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${decodeURIComponent(token)}`,
        },
        body: JSON.stringify(value),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Save failed');
      setContent(json.data);
      return json.data;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setSaving(false);
    }
  }, [key]);

  return { content, loading, error, save, saving };
}

// Fetch ALL blocks at once (for the content dashboard page)
export async function fetchAllSiteContent() {
  const res  = await fetch(`${BASE}/site-content`);
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data; // { hero_slides: […], schedule: […], … }
}