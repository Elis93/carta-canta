'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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
import { deleteSopralluogoAction } from '@/lib/actions/sopralluoghi'

export function DeleteSopralluogoButton({ sopralluogoId }: { sopralluogoId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteSopralluogoAction(sopralluogoId)
      if (result?.error) {
        toast.error(result.error, { duration: 10_000, closeButton: true })
        return
      }
      toast.success('Sopralluogo eliminato', { closeButton: true })
      router.push('/sopralluoghi')
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button"
        aria-label="Elimina sopralluogo"
        onClick={() => setOpen(true)}
        style={{ width: 32, height: 32, borderRadius: '50%', background: '#f4f4f5', border: 'none', color: '#55534b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
      >
        <Trash2 size={16} />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ fontSize: 17, fontWeight: 600 }}>Elimina sopralluogo</DialogTitle>
            <DialogDescription style={{ fontSize: 14 }}>
              Il sopralluogo sparisce dalla lista con i suoi appunti. Le foto già collegate a un preventivo restano sul preventivo; quello eventualmente creato NON viene toccato.
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
