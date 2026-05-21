'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Send, X } from 'lucide-react'

interface ResendReminderDialogProps {
  open: boolean
  onClose: () => void
  onResend: () => void
}

export function ResendReminderDialog({ open, onClose, onResend }: ResendReminderDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Preventivo aggiornato</DialogTitle>
          <DialogDescription>
            Le modifiche sono state salvate. Il cliente non è ancora stato informato degli aggiornamenti.
            Vuoi reinviare il preventivo adesso?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="gap-2">
            <X className="size-4" />
            Non ora
          </Button>
          <Button onClick={onResend} className="gap-2">
            <Send className="size-4" />
            Invia al cliente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
