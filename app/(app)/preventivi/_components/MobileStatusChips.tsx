'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface MobileStatusChipsProps {
  documentId: string
  chipBase: React.CSSProperties
}

export function MobileStatusChips({ documentId, chipBase }: MobileStatusChipsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<'accepted' | 'rejected' | null>(null)

  async function changeStatus(status: 'accepted' | 'rejected') {
    setLoading(status)
    try {
      const res = await fetch(`/api/preventivi/${documentId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? 'Errore aggiornamento stato')
      }
      toast.success(status === 'accepted' ? 'Preventivo segnato come accettato.' : 'Preventivo segnato come rifiutato.')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    } finally {
      setLoading(null)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => changeStatus('accepted')}
        disabled={loading !== null}
        style={{ ...chipBase }}
      >
        {loading === 'accepted'
          ? <Loader2 size={16} className="animate-spin" style={{ color: '#2f8a63' }} />
          : <CheckCircle2 size={16} style={{ color: '#2f8a63' }} />}
        Accettato
      </button>
      <button
        type="button"
        onClick={() => changeStatus('rejected')}
        disabled={loading !== null}
        style={{ ...chipBase }}
      >
        {loading === 'rejected'
          ? <Loader2 size={16} className="animate-spin" style={{ color: '#b05656' }} />
          : <XCircle size={16} style={{ color: '#b05656' }} />}
        Rifiutato
      </button>
    </>
  )
}
