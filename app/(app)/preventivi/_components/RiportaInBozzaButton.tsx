'use client'

// ============================================================
// RiportaInBozzaButton — annulla un "Segna accettato" fatto per
// ERRORE riportando il preventivo in bozza (22 lug 2026, gemello
// del "Riattiva fattura"). Compare SOLO per accettazioni MANUALI:
// se il cliente ha accettato/firmato dalla pagina pubblica
// (signer_name/accepted_ip = prova FES) o c'è una fattura
// collegata, il server rifiuta e il bottone non viene mostrato.
// ============================================================

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'

export function RiportaInBozzaButton({ documentId, fullWidth = false }: { documentId: string; fullWidth?: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch(`/api/preventivi/${documentId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'draft' }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? 'Impossibile riportare il preventivo in bozza. Riprova.', { closeButton: true })
        return
      }
      toast.success('Preventivo riportato in bozza: puoi modificarlo e reinviarlo.')
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
        fontSize: 14, fontWeight: 600, border: '1px solid #e3e3e6',
        background: '#fff', color: '#1a1a2e', cursor: loading ? 'wait' : 'pointer',
        fontFamily: 'inherit', padding: '0 16px',
      }}
    >
      {loading
        ? <Loader2 size={18} className="animate-spin" />
        : <RotateCcw size={17} />}
      Riporta in bozza
    </button>
  )
}
