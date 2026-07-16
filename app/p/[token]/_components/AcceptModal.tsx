'use client'

import { useRef, useState } from 'react'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { SignatureCanvas } from '@/components/public/SignatureCanvas'

interface AcceptModalProps {
  open: boolean
  onClose: () => void
  token: string
  documentTitle: string
  workspaceName: string
}

// ── Firma canvas: estratta in components/public/SignatureCanvas (F20) ─────────
// La usa anche la firma del rapportino (/r/[token]) — stessa firma del preventivo.

// ── Modal principale ──────────────────────────────────────────────────────────

export function AcceptModal({
  open,
  onClose,
  token,
  documentTitle,
  workspaceName,
}: AcceptModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const [signerName, setSignerName] = useState('')
  const [hasSignature, setHasSignature] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit() {
    if (!signerName.trim() || signerName.trim().length < 2) {
      setError('Inserisci il tuo nome completo (min. 2 caratteri)')
      return
    }
    if (!hasSignature) {
      setError('Disegna la tua firma nel riquadro apposito')
      return
    }
    if (!agreed) {
      setError('Devi accettare i termini del preventivo per procedere')
      return
    }

    const signatureImage = canvasRef.current?.toDataURL('image/png') ?? null

    setError(null)
    setLoading(true)

    try {
      const res = await fetch(`/api/p/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signer_name: signerName.trim(),
          signature_image: signatureImage,
          // Opzioni a livelli: proposta scelta nel TierPicker (se presente)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- canale col TierPicker
          tier: (window as unknown as { __cc_tier?: string }).__cc_tier ?? undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Errore durante la conferma')
      }

      setDone(true)
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
        <DialogContent className="sm:max-w-sm text-center">
          <CheckCircle2 className="mx-auto size-12 text-green-500" />
          <DialogTitle className="text-lg font-semibold mt-2">Accettazione confermata!</DialogTitle>
          <p className="text-sm text-muted-foreground">Reindirizzamento in corso…</p>
        </DialogContent>
      </Dialog>
    )
  }

  const canSubmit = signerName.trim().length >= 2 && hasSignature && agreed && !loading

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !loading) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Conferma accettazione</DialogTitle>
          <DialogDescription>
            Stai per accettare{' '}
            <strong className="text-foreground">&ldquo;{documentTitle}&rdquo;</strong>{' '}
            di <strong className="text-foreground">{workspaceName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Nome firmante */}
          <div className="space-y-1.5">
            <Label htmlFor="signer-name">
              Nome e cognome <span className="text-destructive">*</span>
            </Label>
            <Input
              id="signer-name"
              placeholder="Mario Rossi"
              value={signerName}
              onChange={(e) => { setSignerName(e.target.value); setError(null) }}
              disabled={loading}
              autoFocus
            />
          </div>

          {/* Canvas firma */}
          <SignatureCanvas
            canvasRef={canvasRef}
            onHasSignatureChange={(v) => { setHasSignature(v); setError(null) }}
          />

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
              disabled={!canSubmit}
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              Accetto il preventivo
            </Button>
          </div>

          {/* Legal note */}
          <p className="text-[11px] text-muted-foreground text-center">
            Cliccando &ldquo;Accetto il preventivo&rdquo; concludi un accordo vincolante alle condizioni di questo
            preventivo. Per prova registriamo nome, data e ora, indirizzo IP, dispositivo/browser
            ed eventuale firma grafica. Il titolare del trattamento è il professionista che ti ha
            inviato il preventivo; vedi l&apos;
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline">informativa privacy</a>.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
