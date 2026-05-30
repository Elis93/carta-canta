'use client'

// ============================================================
// CARTA CANTA — DocumentFrame
// Renderizza il documento in un <iframe> isolato dal CSS della pagina.
//
// Modalità preferita: src={url} → iframe carica da URL reale,
//   i font Google e le risorse esterne si caricano correttamente.
//
// Modalità fallback: html={...} → iframe usa srcDoc (origine null),
//   le risorse esterne possono non caricare in alcuni browser.
//
// Su mobile il documento A4 (210 mm ≈ 794 px) viene scalato
// via CSS transform per adattarsi alla larghezza dello schermo.
//
// Usato da /p/[token]/page.tsx per mostrare il documento
// con lo stesso identico layout del PDF scaricabile.
// ============================================================

import { useRef, useState, useEffect, useCallback } from 'react'
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'

interface DocumentFrameProps {
  /** URL della route che serve l'HTML del documento (preferito — nessun problema di origine) */
  src?: string
  /** Output di buildPdfHtml() — usato solo se src non è fornito */
  html?: string
  /** Titolo accessibile per l'iframe */
  title?: string
}

const A4_WIDTH_PX = 794 // 210 mm @ 96 dpi

export function DocumentFrame({ src, html, title = 'Documento' }: DocumentFrameProps) {
  const iframeRef    = useRef<HTMLIFrameElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale]       = useState(1)
  const [iframeH, setIframeH]   = useState(A4_WIDTH_PX * 1.414) // altezza A4 iniziale
  const [userZoom, setUserZoom] = useState(1) // zoom utente (Ctrl+scroll o bottoni)

  // Calcola lo scale factor in base alla larghezza del container
  useEffect(() => {
    function computeScale() {
      const containerWidth = containerRef.current?.clientWidth ?? window.innerWidth
      setScale(containerWidth < A4_WIDTH_PX ? containerWidth / A4_WIDTH_PX : 1)
    }
    computeScale()
    window.addEventListener('resize', computeScale)
    return () => window.removeEventListener('resize', computeScale)
  }, [])

  function handleLoad() {
    const iframe = iframeRef.current
    if (!iframe) return
    try {
      // Funziona con srcdoc (stessa origine) e con src della stessa origine
      const scrollH = iframe.contentDocument?.documentElement?.scrollHeight
      if (scrollH && scrollH > 0) {
        iframe.style.height = `${scrollH}px`
        setIframeH(scrollH)
      }
    } catch {
      iframe.style.height = '1200px'
      setIframeH(1200)
    }
    // Ricalcola lo scale dopo il ridimensionamento
    const containerWidth = containerRef.current?.clientWidth ?? window.innerWidth
    setScale(containerWidth < A4_WIDTH_PX ? containerWidth / A4_WIDTH_PX : 1)
  }

  const adjustZoom = useCallback((delta: number) => {
    setUserZoom(prev => Math.min(3, Math.max(0.5, Math.round((prev + delta) * 10) / 10)))
  }, [])

  // Ctrl+scroll per zoom da PC (intercetta sul container, non sull'iframe)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      adjustZoom(e.deltaY < 0 ? 0.1 : -0.1)
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [adjustZoom])

  // Altezza del wrapper = altezza reale dell'iframe × scale × userZoom
  const effectiveScale = scale * userZoom
  const wrapperHeight = iframeH * effectiveScale

  return (
    <div ref={containerRef} className="w-full rounded-xl border shadow-sm overflow-hidden relative">
      <div style={{ height: effectiveScale < 1 || userZoom > 1 ? `${wrapperHeight}px` : 'auto', overflow: userZoom > 1 ? 'auto' : 'hidden' }}>
        <iframe
          ref={iframeRef}
          {...(src ? { src } : { srcDoc: html ?? '' })}
          title={title}
          onLoad={handleLoad}
          style={{
            width:           `${A4_WIDTH_PX}px`,
            minHeight:       '297mm',
            height:          '297mm',
            border:          'none',
            display:         'block',
            transformOrigin: 'top left',
            transform:       effectiveScale !== 1 ? `scale(${effectiveScale})` : 'none',
          }}
        />
      </div>

      {/* Controlli zoom — visibili su PC, su mobile usa pinch */}
      <div className="sticky bottom-3 flex justify-center pointer-events-none">
        <div className="pointer-events-auto inline-flex items-center gap-1 bg-black/60 backdrop-blur-sm text-white rounded-full px-3 py-1.5 shadow-lg select-none">
          <button type="button" onClick={() => adjustZoom(-0.25)} disabled={userZoom <= 0.5}
            className="p-1 rounded-full hover:bg-white/20 disabled:opacity-40 transition-colors" title="Riduci (Ctrl+scroll)">
            <ZoomOut className="size-3.5" />
          </button>
          <button type="button" onClick={() => setUserZoom(1)}
            className="px-2 text-xs font-mono min-w-[3.5rem] text-center hover:bg-white/20 rounded-full py-0.5 transition-colors" title="Reset">
            {Math.round(userZoom * 100)}%
          </button>
          <button type="button" onClick={() => adjustZoom(0.25)} disabled={userZoom >= 3}
            className="p-1 rounded-full hover:bg-white/20 disabled:opacity-40 transition-colors" title="Ingrandisci (Ctrl+scroll)">
            <ZoomIn className="size-3.5" />
          </button>
          {userZoom !== 1 && (
            <button type="button" onClick={() => setUserZoom(1)}
              className="p-1 rounded-full hover:bg-white/20 transition-colors" title="Reimposta">
              <RotateCcw className="size-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
