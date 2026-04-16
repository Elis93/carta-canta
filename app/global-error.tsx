'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[GlobalError]', error)
  }, [error])

  return (
    <html lang="it">
      <body className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center font-sans">
        <h2 className="text-xl font-semibold">Errore critico</h2>
        <p className="text-sm text-gray-500 max-w-sm">
          Si è verificato un errore imprevisto. Prova a ricaricare la pagina.
          {error.digest && (
            <span className="block mt-1 font-mono text-xs opacity-60">
              ID: {error.digest}
            </span>
          )}
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-md border text-sm hover:bg-gray-50 transition-colors"
        >
          Ricarica
        </button>
      </body>
    </html>
  )
}
