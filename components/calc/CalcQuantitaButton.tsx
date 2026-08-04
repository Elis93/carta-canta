'use client'

// ============================================================
// CalcQuantitaButton — pulsantino "📐 Calcola quantità" da mettere accanto
// a una voce del preventivo/sopralluogo. Apre la Calcolatrice in una tendina
// dal basso; "Usa" riempie la quantità della voce e chiude.
// ============================================================

import { useState, useEffect } from 'react'
import { Ruler, X } from 'lucide-react'
import { Calcolatrice } from './Calcolatrice'

export function CalcQuantitaButton({ onResult, iconOnly = false }: {
  onResult: (value: number, unit?: string) => void
  /** Solo l'icona 📐 (per stare DENTRO il campo Quantità — card Voci compatta, 3 ago) */
  iconOnly?: boolean
}) {
  const [open, setOpen] = useState(false)

  // Blocca lo scroll di fondo quando la tendina è aperta
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  return (
    <>
      {iconOnly ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Calcola quantità (metri quadri, piastrelle…)"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', padding: 4, cursor: 'pointer', color: '#b0863e' }}
        >
          <Ruler size={15} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: '#b0863e' }}
        >
          <Ruler size={14} /> Calcola quantità
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
          /* F13: CENTRATO nella pagina (era una tendina ancorata in basso che
             con la tastiera aperta finiva coperta/tagliata) */
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(20,20,40,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 12px' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 440, maxHeight: 'calc(82dvh / var(--cc-zoom, 1))', overflowY: 'auto', background: '#fff', borderRadius: 18, padding: '16px 16px 18px', boxShadow: '0 18px 50px rgba(20,20,40,.35)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ flex: 1, fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 18, fontWeight: 600, color: '#1a1a2e' }}>
                Calcola quantità
              </span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Chiudi" style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4 }}>
                <X size={20} style={{ color: 'var(--cc-muted)' }} />
              </button>
            </div>
            <Calcolatrice onUse={(v, u) => { onResult(v, u); setOpen(false) }} />
          </div>
        </div>
      )}
    </>
  )
}
