'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'

interface ZoomControlsProps {
  /** Contenuto da zoomare */
  children: React.ReactNode
  /** Stile del container esterno */
  className?: string
  /** Zoom iniziale (default 1) */
  initialZoom?: number
  minZoom?: number
  maxZoom?: number
}

/**
 * Wrapper che aggiunge controlli di zoom (+/-/reset) al contenuto.
 * Supporta anche Ctrl+scroll (PC) e mostra il livello corrente.
 */
export function ZoomControls({
  children,
  className = '',
  initialZoom = 1,
  minZoom = 0.5,
  maxZoom = 3,
}: ZoomControlsProps) {
  const [zoom, setZoom] = useState(initialZoom)
  const containerRef = useRef<HTMLDivElement>(null)

  const adjust = useCallback((delta: number) => {
    setZoom(prev => Math.min(maxZoom, Math.max(minZoom, Math.round((prev + delta) * 10) / 10)))
  }, [minZoom, maxZoom])

  // Ctrl+scroll per zoom da PC
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      adjust(e.deltaY < 0 ? 0.1 : -0.1)
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [adjust])

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Contenuto zoomato */}
      <div
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: 'top center',
          transition: 'transform 0.15s ease',
          // Crea spazio verticale proporzionale allo zoom
          marginBottom: zoom > 1 ? `${(zoom - 1) * 100}%` : undefined,
        }}
      >
        {children}
      </div>

      {/* Barra controlli zoom */}
      <div className="sticky bottom-3 flex justify-center pointer-events-none">
        <div className="pointer-events-auto inline-flex items-center gap-1 bg-black/60 backdrop-blur-sm text-white rounded-full px-3 py-1.5 shadow-lg select-none">
          <button
            type="button"
            onClick={() => adjust(-0.25)}
            disabled={zoom <= minZoom}
            className="p-1 rounded-full hover:bg-white/20 disabled:opacity-40 transition-colors"
            title="Riduci (Ctrl+scroll)"
          >
            <ZoomOut className="size-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setZoom(1)}
            className="px-2 text-xs font-mono min-w-[3rem] text-center hover:bg-white/20 rounded-full py-0.5 transition-colors"
            title="Reset zoom"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button
            type="button"
            onClick={() => adjust(0.25)}
            disabled={zoom >= maxZoom}
            className="p-1 rounded-full hover:bg-white/20 disabled:opacity-40 transition-colors"
            title="Ingrandisci (Ctrl+scroll)"
          >
            <ZoomIn className="size-3.5" />
          </button>

          {zoom !== 1 && (
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="p-1 rounded-full hover:bg-white/20 transition-colors"
              title="Reimposta zoom"
            >
              <RotateCcw className="size-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
