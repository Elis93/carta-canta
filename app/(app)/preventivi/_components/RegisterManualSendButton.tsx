'use client'

import { useState, useTransition } from 'react'
import { CheckCircle, Check, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
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
  asRow?: boolean
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0]!
}

export function RegisterManualSendButton({ documentId, asRow }: Props) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [sentDate, setSentDate] = useState(todayStr)

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      const result = await registerManualSendAction(documentId, sentDate)
      if (result.error) {
        setError(result.error)
        return
      }
      setOpen(false)
    })
  }

  function handleOpenChange(v: boolean) {
    setOpen(v)
    if (v) setSentDate(todayStr())
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {asRow ? (
          <button type="button" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 0', fontSize: 14, width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: '#161616' }}>
            <Check size={18} style={{ color: '#55534b' }} /> Segna come inviato
          </button>
        ) : (
          <Button variant="default" size="sm" className="gap-1.5">
            <Send className="size-3.5" />
            Registra invio manuale
          </Button>
        )}
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

        {/* Data invio */}
        <div className="space-y-1.5">
          <Label htmlFor="manual-sent-date">Data di invio</Label>
          <input
            id="manual-sent-date"
            type="date"
            value={sentDate}
            max={todayStr()}
            onChange={(e) => setSentDate(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <p className="text-xs text-muted-foreground">
            Lascia oggi se lo hai inviato oggi. Puoi modificare la data se lo hai inviato in un giorno precedente.
          </p>
        </div>

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
