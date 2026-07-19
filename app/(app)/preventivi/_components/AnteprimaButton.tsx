'use client'

// ============================================================
// AnteprimaButton — anteprima documento in OVERLAY (19 lug, Eli:
// "quando apro le anteprime deve permettermi di ritornare allo
// stesso punto"). Su telefono la navigazione verso la route PDF
// faceva perdere la posizione al ritorno; l'overlay non naviga:
// si chiude con la X e la pagina sotto è rimasta com'era.
// Usato dai dettagli preventivo e fattura (mobile).
// ============================================================

import { useEffect, useState } from 'react'
import { Eye, Loader2, X } from 'lucide-react'

export function AnteprimaButton({ src, style, label = 'Anteprima' }: {
  src: string
  style?: React.CSSProperties
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // Scroll lock del body + chiusura con Escape mentre l'overlay è aperto
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => { setLoaded(false); setOpen(true) }}
        style={{ cursor: 'pointer', fontFamily: 'inherit', ...style }}
      >
        <Eye size={18} style={{ color: '#55534b' }} /> {label}
      </button>
      {open && (
        // width/height divise per --cc-zoom: col Testo grande il body è
        // zoomato e un semplice inset-0 non coprirebbe tutto il viewport.
        <div style={{ position: 'fixed', top: 0, left: 0, width: 'calc(100vw / var(--cc-zoom, 1))', height: 'calc(100dvh / var(--cc-zoom, 1))', zIndex: 9000, background: '#3a3a44', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 14px', background: '#1a1a2e', color: '#fff', flexShrink: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Anteprima documento</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Chiudi anteprima"
              style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid rgba(255,255,255,.4)', background: 'transparent', color: '#fff', borderRadius: 999, padding: '6px 13px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <X size={15} /> Chiudi
            </button>
          </div>
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            {!loaded && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Loader2 size={26} className="animate-spin" style={{ color: '#fff' }} />
              </div>
            )}
            <iframe
              src={src}
              title="Anteprima documento"
              onLoad={() => setLoaded(true)}
              style={{ width: '100%', height: '100%', border: 'none', background: '#fff', display: 'block' }}
            />
          </div>
        </div>
      )}
    </>
  )
}
