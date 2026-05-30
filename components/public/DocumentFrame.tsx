'use client'

// ============================================================
// CARTA CANTA — DocumentFrame
// Renderizza il documento in un <iframe> isolato dal CSS della pagina.
// ============================================================

import { useRef, useState, useEffect } from 'react'
import { Minimize2, Maximize2 } from 'lucide-react'

interface DocumentFrameProps {
  src?: string
  html?: string
  title?: string
}

const A4_WIDTH_PX = 794 // 210 mm @ 96 dpi

export function DocumentFrame({ src, html, title = 'Documento' }: DocumentFrameProps) {
  const iframeRef    = useRef<HTMLIFrameElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale]     = useState(1)
  const [iframeH, setIframeH] = useState(A4_WIDTH_PX * 1.414)
  // fitMode: riduce lo zoom per far entrare l'intera pagina nello schermo
  const [fitMode, setFitMode] = useState(false)

  function computeScale() {
    const containerWidth = containerRef.current?.clientWidth ?? window.innerWidth
    return containerWidth < A4_WIDTH_PX ? containerWidth / A4_WIDTH_PX : 1
  }

  useEffect(() => {
    function update() { setScale(computeScale()) }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  function handleLoad() {
    const iframe = iframeRef.current
    if (!iframe) return
    try {
      const scrollH = iframe.contentDocument?.documentElement?.scrollHeight
      if (scrollH && scrollH > 0) {
        iframe.style.height = `${scrollH}px`
        setIframeH(scrollH)
      }
    } catch {
      iframe.style.height = '1200px'
      setIframeH(1200)
    }
    setScale(computeScale())
  }

  // fitScale: scala che fa entrare tutta l'altezza del documento nella viewport
  const viewportH    = typeof window !== 'undefined' ? window.innerHeight * 0.88 : 800
  const fitScale     = Math.min(computeScale(), viewportH / iframeH)
  const effectiveScale = fitMode ? fitScale : scale
  const wrapperHeight  = iframeH * effectiveScale

  return (
    <div ref={containerRef} className="w-full rounded-xl border shadow-sm overflow-hidden relative">
      <div style={{
        height:   `${wrapperHeight}px`,
        overflow: 'hidden',
      }}>
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

      {/* Pulsante Adatta / Dimensione reale */}
      <div className="sticky bottom-3 flex justify-center pointer-events-none">
        <button
          type="button"
          onClick={() => setFitMode(f => !f)}
          className="pointer-events-auto inline-flex items-center gap-1.5 bg-black/60 backdrop-blur-sm text-white text-xs rounded-full px-3 py-1.5 shadow-lg select-none hover:bg-black/75 transition-colors"
        >
          {fitMode
            ? <><Maximize2 className="size-3.5" /> Dimensione reale</>
            : <><Minimize2 className="size-3.5" /> Adatta alla pagina</>}
        </button>
      </div>
    </div>
  )
}
