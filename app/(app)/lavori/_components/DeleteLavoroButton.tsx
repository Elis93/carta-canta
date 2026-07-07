'use client'

import { useState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { deleteLavoroAction } from '@/lib/actions/lavori'

export function DeleteLavoroButton({ lavoroId }: { lavoroId: string }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      // Il redirect a /lavori avviene nella server action (NEXT_REDIRECT)
      const result = await deleteLavoroAction(lavoroId)
      if (result?.error) {
        toast.error(result.error, { duration: 10_000, closeButton: true })
      }
    })
  }

  return (
    <>
      <button
        type="button"
        aria-label="Elimina lavoro"
        onClick={() => setOpen(true)}
        style={{ width: 32, height: 32, borderRadius: '50%', background: '#f4f4f5', border: 'none', color: '#55534b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
      >
        <Trash2 size={16} />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ fontSize: 17, fontWeight: 600 }}>Elimina lavoro</DialogTitle>
            <DialogDescription style={{ fontSize: 14 }}>
              Il lavoro e le sue note verranno eliminati. Preventivo, fattura e foto NON vengono toccati.
            </DialogDescription>
          </DialogHeader>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <Button variant="outline" style={{ flex: 1, height: 44 }} onClick={() => setOpen(false)}>
              Annulla
            </Button>
            <Button variant="destructive" style={{ flex: 1, height: 44 }} disabled={pending} onClick={handleDelete}>
              {pending ? 'Eliminazione…' : 'Elimina'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
