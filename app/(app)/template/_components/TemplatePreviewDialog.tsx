'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { TemplatePreview } from './TemplatePreview'
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'

interface TemplatePreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  presetKey: string
  color: string
  font: string
  showLogo: boolean
  showWatermark: boolean
  logoPosition: 'left' | 'right'
  legalNotice: string
  workspaceName: string
  logoUrl?: string | null
}

export function TemplatePreviewDialog({
  open,
  onOpenChange,
  title,
  presetKey,
  color,
  font,
  showLogo,
  showWatermark,
  logoPosition,
  legalNotice,
  workspaceName,
  logoUrl,
}: TemplatePreviewDialogProps) {
  const [zoom, setZoom] = useState(1)
  const containerRef = useRef<HTMLDivElement>(null)

  // Reset zoom quando si chiude il dialog
  useEffect(() => { if (!open) setZoom(1) }, [open])

  const adjust = useCallback((delta: number) => {
    setZoom(prev => Math.min(3, Math.max(0.5, Math.round((prev + delta) * 10) / 10)))
  }, [])

  // Ctrl+scroll
  useEffect(() => {
    const el = containerRef.current
    if (!el || !open) return
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      adjust(e.deltaY < 0 ? 0.1 : -0.1)
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [open, adjust])

  // Base scale 60% — lo zoom utente si moltiplica sopra
  const baseScale = 0.6
  const effectiveScale = baseScale * zoom

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {/* Contenitore scrollabile con zoom */}
        <div
          ref={containerRef}
          className="relative rounded-lg border bg-white overflow-auto"
          style={{ height: 460 }}
        >
          <div
            style={{
              width:  `${Math.round(100 / effectiveScale)}%`,
              height: `${Math.round(100 / effectiveScale)}%`,
              transform: `scale(${effectiveScale})`,
              transformOrigin: 'top left',
              pointerEvents: 'none',
            }}
          >
            <TemplatePreview
              presetKey={presetKey}
              color={color}
              font={font}
              showLogo={showLogo}
              showWatermark={showWatermark}
              logoPosition={logoPosition}
              legalNotice={legalNotice}
              workspaceName={workspaceName}
              logoUrl={logoUrl}
            />
          </div>
        </div>

        {/* Controlli zoom */}
        <div className="flex items-center justify-center gap-2 pt-1">
          <div className="inline-flex items-center gap-1 bg-muted rounded-full px-3 py-1.5 select-none">
            <button type="button" onClick={() => adjust(-0.25)} disabled={zoom <= 0.5}
              className="p-1 rounded-full hover:bg-background disabled:opacity-40 transition-colors" title="Riduci">
              <ZoomOut className="size-3.5" />
            </button>
            <button type="button" onClick={() => setZoom(1)}
              className="px-2 text-xs font-mono min-w-[3.5rem] text-center hover:bg-background rounded-full py-0.5 transition-colors">
              {Math.round(zoom * 100)}%
            </button>
            <button type="button" onClick={() => adjust(0.25)} disabled={zoom >= 3}
              className="p-1 rounded-full hover:bg-background disabled:opacity-40 transition-colors" title="Ingrandisci">
              <ZoomIn className="size-3.5" />
            </button>
            {zoom !== 1 && (
              <button type="button" onClick={() => setZoom(1)}
                className="p-1 rounded-full hover:bg-background transition-colors" title="Reimposta">
                <RotateCcw className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
