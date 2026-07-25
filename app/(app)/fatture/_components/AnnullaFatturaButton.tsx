'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, X } from 'lucide-react'
import { toast } from 'sonner'

/**
 * Chip "Annulla fattura" — bianco, X rossa. Stessa dimensione/formato di "Segna pagata"
 * (e delle chip "Segna accettato/rifiutato" del preventivo). Segna la fattura come annullata.
 */
export function AnnullaFatturaButton({ documentId }: { documentId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    // Conferma esplicita (review 25 lug B3): annullare con un tap secco è
    // troppo facile per un'azione che azzera anche gli incassi registrati.
    const ok = window.confirm('Annullare questa fattura? Gli eventuali incassi registrati vengono azzerati. Potrai riattivarla finché non è trasmessa allo SDI.')
    if (!ok) return
    setLoading(true)
    try {
      const res = await fetch(`/api/fatture/${documentId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? 'Impossibile aggiornare lo stato. Riprova.')
        return
      }
      toast.success('Fattura segnata come annullata.')
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
        boxSizing: 'border-box', flex: 1, minWidth: 0, height: 48, borderRadius: 13,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        fontSize: 14, fontWeight: 600, border: '1px solid #e7e7ea',
        background: '#fff', color: '#1a1a2e', cursor: loading ? 'wait' : 'pointer',
        boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)',
        whiteSpace: 'nowrap',
      }}
    >
      {loading
        ? <Loader2 size={18} className="animate-spin" style={{ color: '#b05656' }} />
        : <X size={18} style={{ color: '#b05656' }} />}
      Annulla fattura
    </button>
  )
}
