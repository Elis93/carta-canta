'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { isChunkLoadError, recoverFromChunkError } from '@/lib/chunk-error'
import { UnlockVeil } from '@/components/security/UnlockVeil'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // Chunk vecchio dopo un deploy → ricarica la versione nuova invece di
  // mostrare l'errore (vedi lib/chunk-error.ts).
  const chunk = isChunkLoadError(error)
  const [showError, setShowError] = useState(!chunk)

  useEffect(() => {
    console.error('[app/error]', error)
    if (chunk && !recoverFromChunkError()) setShowError(true)
  }, [error, chunk])

  if (!showError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 px-4 text-center">
        <UnlockVeil />
        <Loader2 className="size-7 animate-spin text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground">Aggiorno l&rsquo;app…</p>
      </div>
    )
  }

  // ⚠️ È QUESTO il boundary che riceve un errore lanciato dal LAYOUT (app)
  // (es. «Sessione non disponibile» da getUser fallita): un error.tsx non
  // cattura gli errori del layout del proprio segmento, li cattura il padre.
  // Il velo anti-lampo (cc-locked) scritto da LockVeil va tolto anche qui,
  // altrimenti la pagina d'errore resta coperta dal navy (revisione 24 ago).
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 px-4 text-center">
      <UnlockVeil />
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
