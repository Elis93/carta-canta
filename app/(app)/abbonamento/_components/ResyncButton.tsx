'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { resyncSubscriptionAction } from '@/lib/actions/subscription'

/**
 * "Sincronizza con Stripe" — ripristina i dati dell'abbonamento dal vivo di Stripe
 * quando i campi nel DB non sono popolati (es. abbonamento creato prima del webhook).
 */
export function ResyncButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const res = await resyncSubscriptionAction()
      if (res.error) toast.error(res.error)
      else {
        toast.success(res.message ?? 'Abbonamento sincronizzato.')
        router.refresh()
      }
    } catch {
      toast.error('Errore durante la sincronizzazione. Riprova.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      style={{ width: '100%', border: '1px solid #e7e7ea', color: '#1a1a2e', borderRadius: 12, height: 48, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, fontWeight: 500, background: '#fff', cursor: loading ? 'wait' : 'pointer' }}
    >
      {loading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
      Sincronizza con Stripe
    </button>
  )
}
