'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'

export function DraftSavedBanner() {
  const router = useRouter()
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false)
      // Rimuovi ?bozza=1 dall'URL sostituendo la history entry
      router.replace('/preventivi')
    }, 2000)
    return () => clearTimeout(t)
  }, [router])

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl px-10 py-8 flex flex-col items-center gap-3 max-w-xs w-full mx-4">
        <CheckCircle2 className="size-12 text-green-500" />
        <p className="text-lg font-semibold text-center">Bozza salvata</p>
        <p className="text-sm text-muted-foreground text-center">
          Il preventivo è stato salvato come bozza.
        </p>
      </div>
    </div>
  )
}
