'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { userApi } from '../../lib/api'
import EpubReader from '../meetings/MeetingDocReader'

/**
 * CvReaderPage
 * ─────────────
 * Fetches the signed-in user's cv_url from the API, then hands it
 * straight to EpubReader via the `directUrl` prop — reusing all the
 * PDF.js / polyfill wiring that already works in the portfolio reader.
 *
 * Route: /dashboard/profile/cv
 */
export default function CvReaderPage() {
  const { user: authUser } = useAuth()

  const [cvUrl,   setCvUrl]   = useState<string | null>(null)
  const [name,    setName]    = useState('')
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    if (!authUser?.id) return

    userApi.getOne(authUser.id)
      .then(res => {
        const data = res.data.data ?? res.data
        if (!data.cv_url) throw new Error('Hakuna CV iliyopakiwa.')
        setCvUrl(data.cv_url)
        setName(data.full_name || '')
      })
      .catch((err: any) => {
        setError(err.message || 'Imeshindwa kupakia CV.')
      })
      .finally(() => setLoading(false))
  }, [authUser?.id])

  if (loading) {
    return (
      <div className="min-h-screen bg-bss-black flex items-center justify-center">
        <p className="text-2xs tracking-widest uppercase text-bss-muted animate-pulse">
          Inapakia CV…
        </p>
      </div>
    )
  }

  if (error || !cvUrl) {
    return (
      <div className="min-h-screen bg-bss-black flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-red-400">{error || 'CV haikupatikana.'}</p>
        <a
          href="/dashboard/profile"
          className="text-2xs tracking-widest uppercase text-bss-muted hover:text-bss-white transition-colors"
        >
          ← Rudi kwa Wasifu
        </a>
      </div>
    )
  }

  return (
    <EpubReader
      directUrl={cvUrl}
      directTitle={name ? `${name} — CV` : 'CV'}
      backHref="/dashboard/profile"
      backLabel="← Rudi kwa Wasifu"
    />
  )
}