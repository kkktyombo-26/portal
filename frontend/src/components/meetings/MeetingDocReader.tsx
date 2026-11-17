'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import '../../lib/polyfills/uint8array'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface Props {
  id?: string         // portfolio doc id  — used when directUrl is NOT provided
  directUrl?: string  // bypass portfolio fetch — load this URL straight into pdfjs
  directTitle?: string// display title when using directUrl
  backHref?: string   // override the back link destination (default: /portfolio)
  backLabel?: string  // override the back link label   (default: ← Back)
}

export default function EpubReader({
  id,
  directUrl,
  directTitle,
  backHref  = '/portfolio',
  backLabel = '← Back',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pdfRef       = useRef<any>(null)

  const [title,      setTitle]      = useState(directTitle || '')
  const [totalPages, setTotalPages] = useState(0)
  const [currentPage,setCurrentPage]= useState(1)
  const [scale,      setScale]      = useState(1.4)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [tocOpen,    setTocOpen]    = useState(false)
  const [toc,        setToc]        = useState<{ title: string; pageNumber: number }[]>([])
  const [rendering,  setRendering]  = useState(false)

  const renderAll = useCallback(async (pdf: any, sc: number) => {
    const container = containerRef.current
    if (!container) return
    setRendering(true)
    container.innerHTML = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      const page     = await pdf.getPage(i)
      const viewport = page.getViewport({ scale: sc })
      const wrapper = document.createElement('div')
      wrapper.dataset.page = String(i)
      wrapper.style.cssText = `
        margin: 0 auto 2px;
        width: ${viewport.width}px;
        max-width: 100%;
        background: #0c0c0c;
        display: flex;
        justify-content: center;
      `
      const canvas  = document.createElement('canvas')
      canvas.width  = viewport.width
      canvas.height = viewport.height
      canvas.style.cssText = `display: block; max-width: 100%; height: auto;`
      wrapper.appendChild(canvas)
      container.appendChild(wrapper)
      const ctx = canvas.getContext('2d')!
      await page.render({ canvasContext: ctx, viewport }).promise
    }
    setRendering(false)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        // ── Resolve the PDF URL ───────────────────────────────
        let url: string

        if (directUrl) {
          // Caller supplied the URL directly — skip the portfolio fetch
          url = directUrl
        } else {
          // Original portfolio path — fetch signed URL from server
          if (!id) throw new Error('No document id provided.')
          const res = await fetch(`${API_URL}/api/portfolio/${id}/epub-url`)
          if (!res.ok) throw new Error(`Could not load document (${res.status}).`)
          const json = await res.json()
          url = json?.url ?? json?.data?.url ?? undefined
          if (!url) {
            console.error('epub-url response shape:', json)
            throw new Error('No URL returned from server.')
          }
        }

        if (cancelled) return

        // @ts-ignore pdfjs-dist is provided by the runtime dependency.
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

        const pdf = await pdfjs.getDocument({ url }).promise
        if (cancelled) return

        pdfRef.current = pdf
        setTotalPages(pdf.numPages)

        const meta = await pdf.getMetadata().catch(() => null)
        if (!cancelled && meta?.info) {
          // Only override title from metadata when not given via prop
          if (!directTitle) setTitle((meta.info as any).Title || '')
        }

        const outline = await pdf.getOutline().catch(() => null)
        if (!cancelled && outline?.length) {
          const entries = await Promise.all(
            outline.slice(0, 40).map(async (item: any) => {
              let pageNumber = 1
              try {
                const dest = typeof item.dest === 'string'
                  ? await pdf.getDestination(item.dest)
                  : item.dest
                if (dest) {
                  const ref = dest[0]
                  pageNumber = await pdf.getPageIndex(ref) + 1
                }
              } catch { /* skip */ }
              return { title: item.title, pageNumber }
            })
          )
          if (!cancelled) setToc(entries)
        }

        await renderAll(pdf, scale)
        if (!cancelled) setLoading(false)

      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Failed to open document.')
          setLoading(false)
        }
      }
    }

    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, directUrl])

  useEffect(() => {
    if (!pdfRef.current || loading) return
    renderAll(pdfRef.current, scale)
  }, [scale, loading, renderAll])

  useEffect(() => {
    const viewport = containerRef.current?.parentElement
    if (!viewport) return
    function onScroll() {
      const container = containerRef.current
      if (!container) return
      const wrappers = container.querySelectorAll<HTMLElement>('[data-page]')
      const viewportTop = viewport!.scrollTop + 80
      let current = 1
      wrappers.forEach((el) => {
        if (el.offsetTop <= viewportTop) {
          current = Number(el.dataset.page)
        }
      })
      setCurrentPage(current)
    }
    viewport.addEventListener('scroll', onScroll, { passive: true })
    return () => viewport.removeEventListener('scroll', onScroll)
  }, [loading])

  function jumpToPage(pageNumber: number) {
    const container = containerRef.current
    const viewport  = container?.parentElement
    if (!container || !viewport) return
    const target = container.querySelector<HTMLElement>(`[data-page="${pageNumber}"]`)
    if (target) {
      viewport.scrollTo({ top: target.offsetTop - 16, behavior: 'smooth' })
    }
    setTocOpen(false)
  }

  const progress = totalPages ? Math.round((currentPage / totalPages) * 100) : 0

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setTocOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="min-h-screen bg-bss-black flex flex-col">
      <header className="h-14 flex items-center justify-between px-6 border-b border-bss-border flex-shrink-0 z-20 sticky top-0 bg-bss-black">
        <div className="flex items-center gap-6 min-w-0">
          <Link
            href={backHref}
            className="text-2xs tracking-widest uppercase text-bss-muted hover:text-bss-white transition-colors whitespace-nowrap"
          >
            {backLabel}
          </Link>
          {title && (
            <span className="font-display text-sm text-bss-white truncate hidden sm:block">
              {title}
            </span>
          )}
        </div>

        <div className="flex items-center gap-5">
          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={() => setScale(s => Math.max(0.6, +(s - 0.2).toFixed(1)))}
              className="text-bss-muted hover:text-bss-white transition-colors text-lg leading-none px-1"
              aria-label="Zoom out"
            >
              −
            </button>
            <span className="text-2xs tracking-wider text-bss-muted tabular-nums w-10 text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale(s => Math.min(3, +(s + 0.2).toFixed(1)))}
              className="text-bss-muted hover:text-bss-white transition-colors text-lg leading-none px-1"
              aria-label="Zoom in"
            >
              +
            </button>
          </div>

          {totalPages > 0 && (
            <span className="text-2xs tracking-wider text-bss-muted tabular-nums">
              {currentPage} / {totalPages}
            </span>
          )}

          {toc.length > 0 && (
            <button
              onClick={() => setTocOpen(o => !o)}
              className="text-2xs tracking-widest uppercase text-bss-muted hover:text-bss-white transition-colors"
            >
              Contents
            </button>
          )}
        </div>
      </header>

      <div className="h-px bg-bss-border flex-shrink-0 sticky top-14 z-20">
        <div
          className="h-full bg-bss-white transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {tocOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setTocOpen(false)} />
            <aside className="fixed left-0 top-14 bottom-0 w-72 bg-bss-surface border-r border-bss-border z-40 flex flex-col">
              <div className="px-6 py-5 border-b border-bss-border">
                <p className="eyebrow mb-0">Contents</p>
              </div>
              <nav className="flex-1 overflow-y-auto py-2">
                {toc.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => jumpToPage(item.pageNumber)}
                    className="w-full text-left px-6 py-3 text-sm font-body font-light text-bss-subtle
                               hover:text-bss-white hover:bg-bss-card transition-colors duration-150"
                  >
                    <span className="block truncate">{item.title}</span>
                    <span className="text-2xs text-bss-muted mt-0.5 block">p. {item.pageNumber}</span>
                  </button>
                ))}
              </nav>
            </aside>
          </>
        )}

        <div className="flex-1 overflow-y-auto bg-[#111111]">
          {loading && !error && (
            <div className="flex items-center justify-center h-64">
              <p className="text-2xs tracking-widest uppercase text-bss-muted animate-pulse">
                Opening document…
              </p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <p className="text-sm text-red-400">{error}</p>
              <Link href={backHref} className="btn-ghost text-xs">{backLabel}</Link>
            </div>
          )}

          <div
            ref={containerRef}
            className="py-6 flex flex-col items-center gap-0"
            style={{ display: loading || error ? 'none' : 'flex' }}
          />

          {rendering && (
            <div className="text-center py-4">
              <p className="text-2xs tracking-widest uppercase text-bss-muted animate-pulse">
                Re-rendering…
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}