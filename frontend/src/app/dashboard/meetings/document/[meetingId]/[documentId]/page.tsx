'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { meetingApi } from '../../../../../../lib/api'
import EpubReader from '../../../../../../components/meetings/MeetingDocReader'

// /dashboard/meetings/document/[meetingId]/[documentId]/page.tsx
//
// Fetches the document record, then hands file_url straight to EpubReader
// via its new `directUrl` prop — reuses all the pdfjs + polyfill wiring
// that already works in the portfolio reader.

export default function MeetingDocumentPage() {
  const params     = useParams()
  const meetingId  = params?.meetingId  as string
  const documentId = params?.documentId as string

  const [doc,     setDoc]     = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    if (!meetingId || !documentId) return

    async function fetchDoc() {
      try {
        const res   = await meetingApi.getDocuments(meetingId)
        const docs  = res.data.data || []
        const found = docs.find((d: any) => String(d.id) === String(documentId))
        if (!found) throw new Error('Hati haikupatikana.')
        setDoc(found)
      } catch (err: any) {
        setError(err.message || 'Imeshindwa kupakia hati.')
      } finally {
        setLoading(false)
      }
    }

    fetchDoc()
  }, [meetingId, documentId])

  if (loading) {
    return (
      <div className="min-h-screen bg-bss-black flex items-center justify-center">
        <p className="text-2xs tracking-widest uppercase text-bss-muted animate-pulse">
          Inapakia hati…
        </p>
      </div>
    )
  }

  if (error || !doc) {
    return (
      <div className="min-h-screen bg-bss-black flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-red-400">{error || 'Hati haikupatikana.'}</p>
        <a
          href={meetingId ? `/dashboard/meetings/${meetingId}` : '/dashboard/meetings'}
          className="text-2xs tracking-widest uppercase text-bss-muted hover:text-bss-white transition-colors"
        >
          ← Rudi kwa Kikao
        </a>
      </div>
    )
  }

  return (
    <EpubReader
      directUrl={doc.file_url}
      directTitle={doc.title}
      backHref={`/dashboard/meetings/${meetingId}`}
      backLabel="← Rudi kwa Kikao"
    />
  )
}