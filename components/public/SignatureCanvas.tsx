'use client'

// ============================================================
// SignatureCanvas — riquadro firma a mano (mouse/dito/stilo).
// Estratto dall'AcceptModal del preventivo (F20): ora lo usa
// anche la firma del rapportino (/r/[token]). Il chiamante tiene
// il ref del <canvas> e ne estrae il PNG con toDataURL().
// ============================================================

import { useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Label } from '@/components/ui/label'

export function SignatureCanvas({
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
