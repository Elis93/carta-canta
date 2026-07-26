'use client'

import { useState } from 'react'
import { runAction } from '@/lib/run-action'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { RotateCcw } from 'lucide-react'
import { restoreToSentVersionAction } from '@/lib/actions/documents'

interface RestoreVersionButtonProps {
  documentId: string
  docType?: 'preventivo' | 'fattura'
}

export function RestoreVersionButton({ documentId, docType = 'preventivo' }: RestoreVersionButtonProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRestore() {
    setLoading(true)
    setError(null)
    const result = await runAction(() => restoreToSentVersionAction(documentId), 'ripristinare la versione inviata')
    setLoading(false)
    if (result?.error) {
      setError(result.error)
      return
    }
    setOpen(false)
    // Hard navigation: forza remount completo del form in modo che
    // React scarti lo stato interno (voci, campi) e li ricarichi dal DB.
    window.location.href = `/${docType === 'fattura' ? 'fatture' : 'preventivi'}/${documentId}`
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-2 text-muted-foreground">
        <RotateCcw className="size-4" />
        Ripristina versione inviata
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ripristina versione inviata</DialogTitle>
            <DialogDescription>
              Verranno annullate tutte le modifiche fatte dopo l&apos;ultimo invio.{' '}
              {docType === 'fattura' ? 'La fattura' : 'Il preventivo'} tornerà
              alla versione che il cliente ha ricevuto. Questa azione non può essere annullata.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Annulla
            </Button>
            <Button variant="destructive" onClick={handleRestore} disabled={loading}>
              {loading ? 'Ripristino…' : 'Ripristina'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
