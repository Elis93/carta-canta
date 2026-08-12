'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, X } from 'lucide-react'
import { toast } from 'sonner'

/**
 * Chip "Annulla fattura" — bianco, X rossa. Stessa dimensione/formato di "Segna pagata"
 * (e delle chip "Segna accettato/rifiutato" del preventivo). Segna la fattura come annullata.
 */
export function AnnullaFatturaButton({
  documentId,
  alreadyPaid = 0,
  isNotaCredito = false,
}: { documentId: string; alreadyPaid?: number; isNotaCredito?: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const nomeDoc = isNotaCredito ? 'nota di credito' : 'fattura'

  async function handleClick() {
    // Conferma esplicita (review 25 lug B3): annullare con un tap secco è
    // troppo facile per un'azione che azzera anche gli incassi registrati.
    // Feedback Eli 26 lug: "l'annullamento non nomina gli acconti". Il testo
    // generico ("gli eventuali incassi") non faceva capire che c'erano soldi
    // registrati: ora l'importo vero è dentro la domanda.
    const soldi = alreadyPaid > 0
      ? `Hai già registrato un incasso di ${alreadyPaid.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}: annullando viene azzerato (resta scritto nella cronologia della fattura). `
      : 'Gli eventuali incassi registrati vengono azzerati. '
    const ok = window.confirm(
      isNotaCredito
        ? 'Annullare la nota di credito? Puoi riattivarla finché non è stata trasmessa allo SdI. Dopo la trasmissione non è più annullabile: lo storno è già avvenuto.'
        : `Annullare questa fattura? ${soldi}Potrai riattivarla finché non è trasmessa allo SdI.`
    )
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
      toast.success(isNotaCredito ? 'Nota di credito annullata.' : 'Fattura segnata come annullata.')
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
      {isNotaCredito ? 'Annulla la nota' : 'Annulla fattura'}
    </button>
  )
}
