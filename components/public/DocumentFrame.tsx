'use client'

// ============================================================
// CARTA CANTA — DocumentFrame
// Renderizza il documento in un <iframe> isolato dal CSS della pagina.
// Su mobile il documento A4 viene scalato per adattarsi alla larghezza.
// ============================================================

import { useRef, useState, useEffect } from 'react'

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

  const wrapperHeight = iframeH * scale

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
            transform:       scale !== 1 ? `scale(${scale})` : 'none',
          }}
        />
      </div>
    </div>
  )
}
