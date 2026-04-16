'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[AppError]', error)
  }, [error])

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-7 w-7 text-destructive" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Qualcosa è andato storto</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Si è verificato un errore nel caricamento della pagina.
          {error.digest && (
            <span className="block mt-1 font-mono text-xs opacity-60">
              ID: {error.digest}
            </span>
          )}
        </p>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={reset}>
          Riprova
        </Button>
        <Button asChild>
          <Link href="/dashboard">Vai alla dashboard</Link>
        </Button>
      </div>
    </div>
  )
}
