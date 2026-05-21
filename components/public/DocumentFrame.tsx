'use client'

// ============================================================
// CARTA CANTA — DocumentFrame
// Renderizza l'HTML di buildPdfHtml() in un <iframe srcDoc>
// isolato dal CSS della pagina. Auto-ridimensiona l'altezza
// al contenuto dell'iframe al caricamento.
//
// Su mobile il documento A4 (210 mm ≈ 794 px) viene scalato
// via CSS transform per adattarsi alla larghezza dello schermo,
// evitando scroll orizzontale.
//
// Usato da /p/[token]/page.tsx per mostrare il documento
// con lo stesso identico layout del PDF scaricabile.
// ============================================================

import { useRef, useState, useEffect } from 'react'

interface DocumentFrameProps {
  /** Output di buildPdfHtml() — documento HTML completo */
  html: string
  /** Titolo accessibile per l'iframe */
  title?: string
}

const A4_WIDTH_PX = 794 // 210 mm @ 96 dpi

export function DocumentFrame({ html, title = 'Documento' }: DocumentFrameProps) {
  const iframeRef    = useRef<HTMLIFrameElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  // Calcola lo scale factor in base alla larghezza del container
  useEffect(() => {
    function computeScale() {
      const containerWidth = containerRef.current?.clientWidth ?? window.innerWidth
      if (containerWidth < A4_WIDTH_PX) {
        setScale(containerWidth / A4_WIDTH_PX)
      } else {
        setScale(1)
      }
    }
    computeScale()
    window.addEventListener('resize', computeScale)
    return () => window.removeEventListener('resize', computeScale)
  }, [])

  function handleLoad() {
    const iframe = iframeRef.current
    if (!iframe) return
    try {
      const scrollH = iframe.contentDocument?.documentElement?.scrollHeight
      if (scrollH && scrollH > 0) {
        iframe.style.height = `${scrollH}px`
      }
    } catch {
      iframe.style.height = '1200px'
    }
    // Ricalcola lo scale dopo che l'iframe ha ridimensionato la sua altezza
    const containerWidth = containerRef.current?.clientWidth ?? window.innerWidth
    if (containerWidth < A4_WIDTH_PX) {
      setScale(containerWidth / A4_WIDTH_PX)
    }
  }

  // Altezza del wrapper = altezza reale dell'iframe × scale
  // (evita che il div wrapper resti alto come l'iframe non scalato)
  const iframeHeight = iframeRef.current?.clientHeight ?? A4_WIDTH_PX * 1.414
  const wrapperHeight = iframeHeight * scale

  return (
    <div ref={containerRef} className="w-full rounded-xl border shadow-sm overflow-hidden">
      {/* Wrapper con altezza scalata per non lasciare spazio vuoto */}
      <div style={{ height: scale < 1 ? `${wrapperHeight}px` : 'auto', overflow: 'hidden' }}>
        <iframe
          ref={iframeRef}
          srcDoc={html}
          title={title}
          onLoad={handleLoad}
          style={{
            width:      `${A4_WIDTH_PX}px`,
            minHeight:  '297mm',
            height:     '297mm', // aggiornato da handleLoad
            border:     'none',
            display:    'block',
            transformOrigin: 'top left',
            transform:  scale < 1 ? `scale(${scale})` : 'none',
          }}
        />
      </div>
    </div>
  )
}
