'use client'

import { useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { deleteDocumentAction } from '@/lib/actions/documents'

export function DeleteDocumentButton({
  documentId,
  documentTitle,
  docType = 'preventivo',
}: {
  documentId: string
  documentTitle: string
  docType?: 'preventivo' | 'fattura'
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setLoading(true)
    setError(null)
    const result = await deleteDocumentAction(documentId)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="size-4" /> Elimina
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{docType === 'fattura' ? 'Elimina fattura' : 'Elimina preventivo'}</DialogTitle>
          <DialogDescription>
            Stai per spostare <strong>{documentTitle}</strong> nel cestino.
            Potrai recuperarlo entro 15 giorni dalla sezione Cestino.
          </DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Annulla
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            Sposta nel cestino
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
