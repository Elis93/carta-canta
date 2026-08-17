'use client'

import { useState } from 'react'
import { runAction } from '@/lib/run-action'
import { Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { deleteTemplateAction } from '@/lib/actions/templates'

export function DeleteTemplateButton({
  templateId,
  templateName,
}: {
  templateId: string
  templateName: string
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setLoading(true)
    setError(null)
    const result = await runAction(() => deleteTemplateAction(templateId), 'eliminare il template')
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
          <DialogTitle>Elimina template</DialogTitle>
          {/* ⚠️ Copy verificata sul codice (17 ago): la garanzia assoluta «non
              verranno modificati» era FALSA per le bozze — updateDocumentAction
              e saveDraftAction ri-risolvono lo snapshot a ogni salvataggio, e
              su un template_id cancellato resolveTemplateSnapshot ricade sul
              Classico. Vero solo per i documenti già inviati (snapshot
              congelato). */}
          <DialogDescription>
            Stai per eliminare <strong>{templateName}</strong>.
            I documenti già inviati — preventivi e fatture — non cambiano aspetto;
            le bozze che lo usavano passeranno al template predefinito.
            Questa azione non è reversibile.
          </DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Annulla
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            Elimina
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
