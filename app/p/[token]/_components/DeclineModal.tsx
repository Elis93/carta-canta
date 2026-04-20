'use client'

import { useState } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

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
  const [reason, setReason] = useState('')

  async function handleDecline() {
    setError(null)
    setLoading(true)

    try {
      const res = await fetch(`/api/p/${token}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
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

        {/* Motivo opzionale */}
        <div className="space-y-1.5">
          <Label htmlFor="decline-reason" className="text-sm">
            Motivo <span className="text-muted-foreground font-normal">(facoltativo)</span>
          </Label>
          <Textarea
            id="decline-reason"
            placeholder="Es. il prezzo è fuori budget, abbiamo scelto un altro fornitore…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={loading}
            rows={3}
            maxLength={500}
            className="resize-none text-sm"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex gap-2 pt-1">
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
