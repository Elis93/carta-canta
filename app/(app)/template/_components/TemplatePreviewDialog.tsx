'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { TemplatePreview } from './TemplatePreview'

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {/* Preview scalata al 60% — mostra la parte alta del documento */}
        <div
          className="relative overflow-hidden rounded-lg border bg-white"
          style={{ height: 460 }}
        >
          <div
            style={{
              width: '167%',
              height: '167%',
              transform: 'scale(0.6)',
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
      </DialogContent>
    </Dialog>
  )
}
