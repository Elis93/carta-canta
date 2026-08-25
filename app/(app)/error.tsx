'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { isChunkLoadError, recoverFromChunkError, isTransientNetworkError, canAutoRetryNetworkError } from '@/lib/chunk-error'
import { UnlockVeil } from '@/components/security/UnlockVeil'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // App aperta da giorni + nuovo deploy = chunk vecchio che dà 404 al primo
  // spostamento (Eli 15 ago: "a volte quando esco e rientro esce «Qualcosa è
  // andato storto»"). Non è un vero errore: si recupera ricaricando la versione
  // nuova. Mostriamo «Aggiorno…» invece del testo d'errore per non spaventare.
  const chunk = isChunkLoadError(error)
  // Fetch UCCISO dalla sospensione dell'app (25 ago, Eli: l'errore usciva a
  // OGNI rientro): si ritenta da soli UNA volta — reset() rifà la richiesta
  // della pagina — invece di mostrare l'errore per un blip che è già passato.
  const transient = isTransientNetworkError(error)
  const [showError, setShowError] = useState(!chunk && !transient)

  useEffect(() => {
    console.error('[AppError]', error)
    if (chunk) {
      // Se il reload è appena avvenuto e l'errore torna, NON è un chunk vecchio:
      // esci dal ciclo e mostra l'errore vero.
      if (!recoverFromChunkError()) setShowError(true)
      return
    }
    if (transient) {
      if (canAutoRetryNetworkError()) {
        // Piccola attesa: al resume la rete impiega un attimo a tornare viva.
        const t = setTimeout(() => reset(), 600)
        return () => clearTimeout(t)
      }
      setShowError(true)
    }
  }, [error, chunk, transient, reset])

  if (!showError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{chunk ? 'Aggiorno l’app…' : 'Riprovo…'}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      {/* Il velo del blocco app non deve coprire questa pagina (revisione 24 ago) */}
      <UnlockVeil />
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
          {/* Errore lato CLIENT (niente digest): il messaggio tecnico è
              l'unica diagnosi possibile da una schermata fotografata. */}
          {!error.digest && error.message && (
            <span className="block mt-1 font-mono text-xs opacity-60">
              {String(error.message).slice(0, 140)}
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
