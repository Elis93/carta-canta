'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle2, X, AlertCircle } from 'lucide-react'

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
      <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-800">
        <CheckCircle2 className="size-5 shrink-0 text-green-600" />
        <div className="flex-1">
          <p className="font-semibold text-sm">🎉 Benvenuto nel nuovo piano!</p>
          <p className="text-xs opacity-80 mt-0.5">
            Il tuo piano è stato attivato. Tutte le nuove funzionalità sono ora disponibili.
          </p>
        </div>
        <button onClick={() => setVisible(false)} className="shrink-0 opacity-60 hover:opacity-100">
          <X className="size-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
      <AlertCircle className="size-5 shrink-0 text-amber-600" />
      <div className="flex-1">
        <p className="text-sm">Pagamento annullato. Nessun addebito è stato effettuato.</p>
      </div>
      <button onClick={() => setVisible(false)} className="shrink-0 opacity-60 hover:opacity-100">
        <X className="size-4" />
      </button>
    </div>
  )
}
