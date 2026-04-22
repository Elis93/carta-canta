'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[app/error]', error)
  }, [error])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 px-4 text-center">
      <div className="size-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-6">
        <AlertTriangle className="size-8 text-destructive" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight mb-2">Qualcosa è andato storto</h1>
      <p className="text-muted-foreground mb-8 max-w-sm">
        Si è verificato un errore imprevisto. Riprova o contatta il supporto se il problema persiste.
      </p>
      <Button onClick={reset}>Riprova</Button>
    </div>
  )
}
