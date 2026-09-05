'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle2, X, AlertCircle } from 'lucide-react'
import { Avviso } from '@/components/shared/Avviso'

export function SuccessBanner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [visible, setVisible] = useState(false)
  const [type, setType] = useState<'success' | 'cancelled' | null>(null)

  useEffect(() => {
    if (searchParams.get('success') === '1') {
      setType('success')
      setVisible(true)
      // Rimuove il query param senza reload
      const url = new URL(window.location.href)
      url.searchParams.delete('success')
      router.replace(url.pathname, { scroll: false })
      // Auto-dismiss dopo 8s
      const t = setTimeout(() => setVisible(false), 8000)
      return () => clearTimeout(t)
    }
    if (searchParams.get('cancelled') === '1') {
      setType('cancelled')
      setVisible(true)
      const url = new URL(window.location.href)
      url.searchParams.delete('cancelled')
      router.replace(url.pathname, { scroll: false })
      const t = setTimeout(() => setVisible(false), 5000)
      return () => clearTimeout(t)
    }
  }, [searchParams, router])

  if (!visible || !type) return null

  if (type === 'success') {
    return (
      <div style={{ position: 'relative' }}>
        <Avviso gravita="ok" icon={<CheckCircle2 size={16} />} sotto="Il tuo piano è stato attivato. Tutte le nuove funzionalità sono ora disponibili." style={{ paddingRight: 40 }}>
          <b>Benvenuto nel nuovo piano!</b>
        </Avviso>
        <button onClick={() => setVisible(false)} aria-label="Chiudi" className="opacity-60 hover:opacity-100" style={{ position: 'absolute', top: 10, right: 12 }}>
          <X className="size-4" />
        </button>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      <Avviso gravita="info" icon={<AlertCircle size={16} />} style={{ paddingRight: 40 }}>
        <b>Pagamento annullato.</b>{' '}Nessun addebito è stato effettuato.
      </Avviso>
      <button onClick={() => setVisible(false)} aria-label="Chiudi" className="opacity-60 hover:opacity-100" style={{ position: 'absolute', top: 10, right: 12 }}>
        <X className="size-4" />
      </button>
    </div>
  )
}
