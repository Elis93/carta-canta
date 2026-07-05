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
import { deleteExpenseAction } from '@/lib/actions/expenses'

export function DeleteExpenseButton({ expenseId, description }: { expenseId: string; description: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteExpenseAction(expenseId)
      if (result?.error) {
        toast.error(result.error, { duration: 10_000, closeButton: true })
        return
      }
      toast.success('Spesa eliminata', { duration: 10_000, closeButton: true })
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button"
        aria-label={`Elimina spesa ${description}`}
        onClick={() => setOpen(true)}
        style={{ background: 'none', border: 'none', padding: 6, cursor: 'pointer', color: '#a5a39b', display: 'flex', flexShrink: 0 }}
      >
        <Trash2 size={16} />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ fontSize: 17, fontWeight: 600 }}>Elimina spesa</DialogTitle>
            <DialogDescription style={{ fontSize: 14 }}>
              Vuoi eliminare &ldquo;{description}&rdquo; dal Bilancio?
            </DialogDescription>
          </DialogHeader>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <Button variant="outline" style={{ flex: 1, height: 44 }} onClick={() => setOpen(false)}>
              Annulla
            </Button>
            <Button
              variant="destructive"
              style={{ flex: 1, height: 44 }}
              disabled={pending}
              onClick={handleDelete}
            >
              {pending ? 'Eliminazione…' : 'Elimina'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
