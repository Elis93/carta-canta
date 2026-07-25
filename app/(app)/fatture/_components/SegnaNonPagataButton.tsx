'use client'

// ============================================================
// SegnaNonPagataButton — annulla il pagamento di una fattura
// segnata "Pagata" per errore (review 25 lug: prima non c'era
// NESSUNA uscita da quello stato). La fattura torna "inviata,
// da incassare" e i campi incasso vengono azzerati dal server.
// È un fatto gestionale interno: nessun effetto fiscale.
// ============================================================

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Undo2 } from 'lucide-react'
import { toast } from 'sonner'

export function SegnaNonPagataButton({ documentId, fullWidth = false }: { documentId: string; fullWidth?: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    const ok = window.confirm('Segnare la fattura come NON pagata? L’incasso registrato viene azzerato e la fattura torna "da incassare".')
    if (!ok) return
    setLoading(true)
    try {
      const res = await fetch(`/api/fatture/${documentId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'sent' }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? 'Operazione non riuscita. Riprova.', { closeButton: true })
        return
      }
      toast.success('Fattura di nuovo "da incassare": l’incasso registrato è stato azzerato.')
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
        : <Undo2 size={17} />}
      Segna come non pagata
    </button>
  )
}
