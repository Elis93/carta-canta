'use client'

// ============================================================
// CorreggiIncassoButton — azzera un ACCONTO registrato per errore
// (feedback Eli 27 lug: "se un artigiano avesse sbagliato a inserire
// l'acconto come fa a cambiarlo?"). Prima l'unica uscita era "Segna
// come non pagata", che esiste solo sulle fatture SALDATE: un acconto
// sbagliato su una fattura ancora da incassare era inchiodato.
// L'azzeramento resta scritto in cronologia; si registra poi
// l'incasso di nuovo con l'importo giusto.
// ============================================================

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Eraser } from 'lucide-react'
import { toast } from 'sonner'

export function CorreggiIncassoButton({ documentId, amount }: { documentId: string; amount: number }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    const fmt = amount.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const ok = window.confirm(
      `Azzerare l’acconto registrato di ${fmt} €? L’operazione resta scritta in cronologia: potrai poi registrare di nuovo l’incasso con l’importo giusto da “Segna pagata”.`
    )
    if (!ok) return
    setLoading(true)
    try {
      const res = await fetch(`/api/fatture/${documentId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset_payment: true }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? 'Operazione non riuscita. Riprova.', { closeButton: true })
        return
      }
      toast.success('Acconto azzerato. Registra di nuovo l’incasso con l’importo giusto da “Segna pagata”.')
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
      aria-label="Azzera l’acconto registrato"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: 'none', border: 'none', padding: '6px 0 2px',
        fontSize: 13, fontWeight: 600, color: 'var(--cc-muted)',
        textDecoration: 'underline', textUnderlineOffset: 3,
        cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit',
      }}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <Eraser size={14} />}
      Acconto sbagliato? Azzera e reinserisci
    </button>
  )
}
