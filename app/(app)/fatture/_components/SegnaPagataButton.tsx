'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Banknote } from 'lucide-react'
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
        boxSizing: 'border-box', width: '100%', height: 48, borderRadius: 13,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        fontSize: 14, fontWeight: 600, border: 'none',
        background: '#1a1a2e', color: '#fff', cursor: loading ? 'wait' : 'pointer',
        boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)', whiteSpace: 'nowrap',
      }}
    >
      {loading ? <Loader2 size={18} className="animate-spin" /> : <Banknote size={18} />}
      Segna pagata
    </button>
  )
}
