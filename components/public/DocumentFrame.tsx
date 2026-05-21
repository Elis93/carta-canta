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

import { useRef, useState, useEffect } from 'react'

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

  // Altezza del wrapper = altezza reale dell'iframe × scale (evita spazio vuoto)
  const wrapperHeight = iframeH * scale

  return (
    <div ref={containerRef} className="w-full rounded-xl border shadow-sm overflow-hidden">
      <div style={{ height: scale < 1 ? `${wrapperHeight}px` : 'auto', overflow: 'hidden' }}>
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
            transform:       scale < 1 ? `scale(${scale})` : 'none',
          }}
        />
      </div>
    </div>
  )
}
