'use client'

// ============================================================
// CARTA CANTA — DocumentFrame
// Renderizza il documento in un <iframe> isolato dal CSS della pagina.
// Su mobile il documento A4 viene scalato per adattarsi alla larghezza.
//
// FIX-13 (sessione FIX-04): su viewport stretti il documento poteva apparire
// "tagliato" (es. "PREVENTIVO" → "PREV", totale fuori vista) con scroll
// orizzontale indesiderato. Causa: lo scale veniva calcolato solo al mount
// (via window resize) e con `useEffect` — un primo paint con `scale=1`
// (794px fissi) restava visibile finché l'effect non si applicava, e
// qualunque variazione di layout della larghezza del contenitore (non
// accompagnata da un resize della finestra: caricamento font, scrollbar,
// ecc.) non veniva mai recalcolata. Fix: `useLayoutEffect` per calcolare lo
// scale PRIMA del paint (niente flash) + `ResizeObserver` sul contenitore
// per seguire ogni variazione reale di larghezza, non solo il resize della
// finestra. Aggiunto anche `overflow-x: hidden` esplicito come rete di
// sicurezza contro lo scroll orizzontale.
// ============================================================

import { useRef, useState, useLayoutEffect } from 'react'

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

  function computeScale(containerWidth: number) {
    if (!containerWidth) return 1
    return Math.min(1, containerWidth / A4_WIDTH_PX)
  }

  // useLayoutEffect: calcola lo scale PRIMA del paint del browser, così il
  // documento non appare mai per un istante a piena larghezza (794px) su
  // contenitori stretti — niente "flash" di contenuto tagliato.
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return

    function update(width: number) { setScale(computeScale(width)) }
    update(el.clientWidth)

    // ResizeObserver segue ogni variazione reale della larghezza del
    // contenitore (non solo il resize della finestra: cambi di layout,
    // caricamento font, comparsa/scomparsa di scrollbar, rotazione mobile…)
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver((entries) => {
        const width = entries[0]?.contentRect?.width
        if (width) update(width)
      })
      ro.observe(el)
      return () => ro.disconnect()
    }

    // Fallback per ambienti senza ResizeObserver
    function onWindowResize() { if (containerRef.current) update(containerRef.current.clientWidth) }
    window.addEventListener('resize', onWindowResize)
    return () => window.removeEventListener('resize', onWindowResize)
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
    if (containerRef.current) setScale(computeScale(containerRef.current.clientWidth))
  }

  const wrapperHeight = iframeH * scale

  return (
    <div
      ref={containerRef}
      className="w-full max-w-full rounded-xl border shadow-sm overflow-hidden relative"
      style={{ overflowX: 'hidden' }}
    >
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
            transform:       scale !== 1 ? `scale(${scale})` : 'none',
          }}
        />
      </div>
    </div>
  )
}
