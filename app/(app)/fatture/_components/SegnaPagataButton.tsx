'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export function SegnaPagataButton({ documentId }: { documentId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch(`/api/fatture/${documentId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'accepted' }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? 'Impossibile aggiornare lo stato. Riprova.')
        return
      }
      toast.success('Fattura segnata come pagata.')
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
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 5, flex: 1, borderRadius: 9, padding: '10px 6px',
        fontSize: 13, fontWeight: 500,
        border: '0.5px solid var(--cc-border-color)',
        background: 'white', color: 'var(--cc-navy)', cursor: loading ? 'wait' : 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : null}
      Segna pagata
    </button>
  )
}
