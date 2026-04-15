'use client'

import { useState } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface DeclineModalProps {
  open: boolean
  onClose: () => void
  token: string
  documentTitle: string
  workspaceName: string
}

export function DeclineModal({
  open,
  onClose,
  token,
  documentTitle,
  workspaceName,
}: DeclineModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDecline() {
    setError(null)
    setLoading(true)

    try {
      const res = await fetch(`/api/p/${token}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Errore durante il rifiuto')
      }

      // Ricarica la pagina per mostrare lo stato aggiornato
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore imprevisto')
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!loading && !v) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Conferma rifiuto</DialogTitle>
          <DialogDescription>
            Stai per rifiutare il preventivo{' '}
            <strong className="text-foreground">&ldquo;{documentTitle}&rdquo;</strong>{' '}
            di <strong className="text-foreground">{workspaceName}</strong>.
            <br /><br />
            L&apos;artigiano verrà notificato. Questa azione non è reversibile.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={loading}
          >
            Annulla
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={handleDecline}
            disabled={loading}
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            Rifiuta preventivo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
