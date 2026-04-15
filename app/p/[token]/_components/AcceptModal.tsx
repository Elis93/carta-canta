'use client'

import { useState } from 'react'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

interface AcceptModalProps {
  open: boolean
  onClose: () => void
  token: string
  documentTitle: string
  workspaceName: string
}

export function AcceptModal({
  open,
  onClose,
  token,
  documentTitle,
  workspaceName,
}: AcceptModalProps) {
  const [signerName, setSignerName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit() {
    if (!signerName.trim() || signerName.trim().length < 2) {
      setError('Inserisci il tuo nome completo (min. 2 caratteri)')
      return
    }
    if (!agreed) {
      setError('Devi accettare i termini del preventivo per procedere')
      return
    }

    setError(null)
    setLoading(true)

    try {
      const res = await fetch(`/api/p/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signer_name: signerName.trim() }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Errore durante la conferma')
      }

      setDone(true)
      // Redirect dopo breve attesa per mostrare il messaggio di successo
      setTimeout(() => {
        window.location.href = `/p/${token}/grazie`
      }, 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore imprevisto')
      setLoading(false)
    }
  }

  if (done) {
    return (
      <Dialog open={open} onOpenChange={() => undefined}>
        <DialogContent className="max-w-sm text-center">
          <CheckCircle2 className="mx-auto size-12 text-green-500" />
          <DialogTitle className="text-lg font-semibold mt-2">Accettazione confermata!</DialogTitle>
          <p className="text-sm text-muted-foreground">Reindirizzamento in corso…</p>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!loading) onClose(); if (!v) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Conferma accettazione</DialogTitle>
          <DialogDescription>
            Stai per accettare il preventivo{' '}
            <strong className="text-foreground">&ldquo;{documentTitle}&rdquo;</strong>{' '}
            di <strong className="text-foreground">{workspaceName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Nome firmante */}
          <div className="space-y-1.5">
            <Label htmlFor="signer-name">Il tuo nome e cognome *</Label>
            <Input
              id="signer-name"
              placeholder="Mario Rossi"
              value={signerName}
              onChange={(e) => { setSignerName(e.target.value); setError(null) }}
              disabled={loading}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Usato come firma digitale per questa accettazione.
            </p>
          </div>

          {/* Checkbox ToS */}
          <div className="flex items-start gap-3">
            <Checkbox
              id="agree"
              checked={agreed}
              onCheckedChange={(v: boolean | 'indeterminate') => { setAgreed(v === true); setError(null) }}
              disabled={loading}
              className="mt-0.5"
            />
            <Label htmlFor="agree" className="text-sm font-normal leading-snug cursor-pointer">
              Dichiaro di aver letto il preventivo e di accettarne i termini e le condizioni.
            </Label>
          </div>

          {/* Errore */}
          {error && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Azioni */}
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
              className="flex-1"
              onClick={handleSubmit}
              disabled={loading || !signerName.trim() || !agreed}
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              Accetto il preventivo
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
