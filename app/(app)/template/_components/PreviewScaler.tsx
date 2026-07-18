'use client'

import { useEffect, useRef, useState } from 'react'

// ── Anteprima a misura FISSA (feedback Eli 17 lug) ─────────────────────────
// Il documento campione è renderizzato a larghezza "da desktop" (RENDER_W) e
// poi SCALATO al contenitore: niente più testi sovrapposti o tagliati a
// larghezze strette, e con la classe cc-zoom-neutral resta identico anche in
// Testo grande (è una miniatura estetica: non serve leggerla in dettaglio).
// 18 lug: estratto dall'editor perché lo usa anche la lista template
// (l'anteprima nel menu a tendina era "tutta appiccicata").
export const RENDER_W = 560

export function PreviewScaler({ children }: { children: React.ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<{ scale: number; height: number } | null>(null)

  useEffect(() => {
    const measure = () => {
      const o = outerRef.current
      const i = innerRef.current
      if (!o || !i) return
      const scale = o.offsetWidth / RENDER_W
      setBox({ scale, height: Math.ceil(i.offsetHeight * scale) })
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (outerRef.current) ro.observe(outerRef.current)
    if (innerRef.current) ro.observe(innerRef.current)
    return () => ro.disconnect()
  }, [])

  return (
    <div
      ref={outerRef}
      className="cc-zoom-neutral"
      style={{ height: box?.height ?? 420, overflow: 'hidden', visibility: box ? 'visible' : 'hidden' }}
    >
      <div ref={innerRef} style={{ width: RENDER_W, transform: `scale(${box?.scale ?? 0.6})`, transformOrigin: 'top left' }}>
        {children}
      </div>
    </div>
  )
}
