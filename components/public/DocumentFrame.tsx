'use client'

// ============================================================
// CARTA CANTA — DocumentFrame
// Renderizza l'HTML di buildPdfHtml() in un <iframe srcDoc>
// isolato dal CSS della pagina. Auto-ridimensiona l'altezza
// al contenuto dell'iframe al caricamento.
//
// Usato da /p/[token]/page.tsx per mostrare il documento
// con lo stesso identico layout del PDF scaricabile.
// ============================================================

import { useRef } from 'react'

interface DocumentFrameProps {
  /** Output di buildPdfHtml() — documento HTML completo */
  html: string
  /** Titolo accessibile per l'iframe */
  title?: string
}

export function DocumentFrame({ html, title = 'Documento' }: DocumentFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  function handleLoad() {
    const iframe = iframeRef.current
    if (!iframe) return
    try {
      // srcdoc iframe: il contentDocument è accessibile (stesso navigation origin)
      const scrollH = iframe.contentDocument?.documentElement?.scrollHeight
      if (scrollH && scrollH > 0) {
        iframe.style.height = `${scrollH}px`
      }
    } catch {
      // Fallback: altezza fissa se l'accesso al contentDocument è bloccato
      iframe.style.height = '1200px'
    }
  }

  return (
    // overflow-x-auto: il documento A4 (210 mm ≈ 793 px) è più largo degli
    // schermi mobile. L'utente può scorrere orizzontalmente o usare pinch-zoom.
    <div className="overflow-x-auto rounded-xl border shadow-sm">
      <iframe
        ref={iframeRef}
        srcDoc={html}
        title={title}
        onLoad={handleLoad}
        style={{
          width: '210mm',
          minHeight: '297mm',
          height: '297mm', // aggiornato da handleLoad dopo il caricamento
          border: 'none',
          display: 'block',
        }}
      />
    </div>
  )
}
