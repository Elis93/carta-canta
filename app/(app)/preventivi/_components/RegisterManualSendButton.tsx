'use client'

import { useState, useTransition } from 'react'
import { CheckCircle, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { registerManualSendAction } from '@/lib/actions/documents'

interface Props {
  documentId: string
}

export function RegisterManualSendButton({ documentId }: Props) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      const result = await registerManualSendAction(documentId)
      if (result.error) {
        setError(result.error)
        return
      }
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm" className="gap-1.5">
          <Send className="size-3.5" />
          Registra invio manuale
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registra invio manuale</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed pt-1">
            Usa questa funzione se hai già inviato il preventivo al cliente fuori
            dall&apos;app — via WhatsApp, email personale o di persona.
            <br /><br />
            Il sistema assegnerà automaticamente il numero ufficiale e cambierà
            lo stato a <strong>Inviato</strong>.
            <br /><br />
            Non verrà inviata nessuna email al cliente da Carta Canta.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Annulla
          </Button>
          <Button onClick={handleConfirm} disabled={isPending} className="gap-1.5">
            <CheckCircle className="size-4" />
            {isPending ? 'Registrazione…' : 'Conferma invio manuale'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
