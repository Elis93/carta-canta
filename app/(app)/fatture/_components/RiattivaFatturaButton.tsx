'use client'

// ============================================================
// RiattivaFatturaButton — riporta una fattura ANNULLATA in bozza
// (19 lug 2026). Prassi dei gestionali: finché la fattura non è
// stata trasmessa allo SdI è una copia di cortesia, quindi si può
// riattivare mantenendo lo stesso numero. Dopo lo SdI il server
// blocca (serve una nota di credito). Torna in BOZZA: l'artigiano
// la rivede e la reinvia.
// ============================================================

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'

export function RiattivaFatturaButton({ documentId, fullWidth = false }: { documentId: string; fullWidth?: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch(`/api/fatture/${documentId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'draft' }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? 'Impossibile riattivare la fattura. Riprova.', { closeButton: true })
        return
      }
      toast.success('Fattura riattivata: torna in bozza, puoi modificarla e reinviarla.')
      router.refresh()
    } catch {
      toast.error('Errore di rete. Controlla la connessione e riprova.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      style={{
        boxSizing: 'border-box', width: fullWidth ? '100%' : undefined, minWidth: 0, height: 48, borderRadius: 13,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        fontSize: 14, fontWeight: 600, border: '1px solid #1a1a2e',
        background: '#1a1a2e', color: '#fff', cursor: loading ? 'wait' : 'pointer',
        fontFamily: 'inherit', padding: '0 16px',
      }}
    >
      {loading
        ? <Loader2 size={18} className="animate-spin" />
        : <RotateCcw size={17} />}
      Riattiva fattura
    </button>
  )
}
