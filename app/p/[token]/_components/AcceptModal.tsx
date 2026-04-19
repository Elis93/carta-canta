'use client'

import { useRef, useState } from 'react'
import { Loader2, CheckCircle2, AlertCircle, RotateCcw } from 'lucide-react'
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

// ── Firma canvas ──────────────────────────────────────────────────────────────

function SignatureCanvas({
  onHasSignatureChange,
  canvasRef,
}: {
  onHasSignatureChange: (v: boolean) => void
  canvasRef: React.RefObject<HTMLCanvasElement | null>
}) {
  const isDrawingRef = useRef(false)
  const lastPosRef = useRef<{ x: number; y: number } | null>(null)
  const [hasStrokes, setHasStrokes] = useState(false)

  function getCtx() {
    const canvas = canvasRef.current
    if (!canvas) return null
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#111827'
    return ctx
  }

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    isDrawingRef.current = true
    const pos = getPos(e)
    lastPosRef.current = pos
    // Punto singolo (tap)
    const ctx = getCtx()
    if (ctx) {
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, 1, 0, Math.PI * 2)
      ctx.fillStyle = '#111827'
      ctx.fill()
    }
    if (!hasStrokes) {
      setHasStrokes(true)
      onHasSignatureChange(true)
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current) return
    const pos = getPos(e)
    const ctx = getCtx()
    if (!ctx || !lastPosRef.current) return
    ctx.beginPath()
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastPosRef.current = pos
  }

  function handlePointerUp() {
    isDrawingRef.current = false
    lastPosRef.current = null
  }

  function clearCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasStrokes(false)
    onHasSignatureChange(false)
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>
          Firma grafica <span className="text-destructive">*</span>
        </Label>
        {hasStrokes && (
          <button
            type="button"
            onClick={clearCanvas}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="size-3" />
            Cancella
          </button>
        )}
      </div>

      <div className="relative rounded-lg border bg-white overflow-hidden">
        {/* Placeholder — sparisce non appena l'utente disegna */}
        {!hasStrokes && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
            <p className="text-sm text-gray-300">Disegna qui la tua firma</p>
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={560}
          height={100}
          className="w-full h-[100px] cursor-crosshair touch-none block"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Usa mouse, dito o stilo per firmare.
      </p>
    </div>
  )
}

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
        <DialogContent className="max-w-sm text-center">
          <CheckCircle2 className="mx-auto size-12 text-green-500" />
          <DialogTitle className="text-lg font-semibold mt-2">Accettazione confermata!</DialogTitle>
          <p className="text-sm text-muted-foreground">Reindirizzamento in corso…</p>
        </DialogContent>
      </Dialog>
    )
  }

  const canSubmit = signerName.trim().length >= 2 && hasSignature && agreed && !loading

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!loading) onClose(); if (!v) onClose() }}>
      <DialogContent className="max-w-lg">
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
            La firma grafica, il nome, l&apos;indirizzo IP e la data e ora vengono registrati
            come prova di accettazione.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
