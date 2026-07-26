'use client'

// ============================================================
// DocumentRowActions — menu ⋮ per ogni riga della lista preventivi
//
// Azioni disponibili:
//   • "Usa come modello" — duplica il documento senza aggiungere "(copia)",
//     apre la nuova bozza pronta da modificare
//   • "Invia al cliente" (solo bozze) — apre SendEmailDialog senza navigare
//   • "Elimina" — chiede conferma prima di eliminare
//
// Visibilità: sempre visibile su mobile, al hover su desktop (classe group
// sul div padre gestita dal componente chiamante).
// ============================================================

import { useState } from 'react'
import { runAction } from '@/lib/run-action'
import { toast } from 'sonner'
import { MoreHorizontal, Copy, Send, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { duplicateDocumentAction, deleteDocumentAction } from '@/lib/actions/documents'
import { SendEmailDialog } from './SendEmailDialog'
import { formatDocNumber } from '@/lib/utils'

interface DocumentRowActionsProps {
  doc: {
    id: string
    doc_number: string | null
    title: string | null
    /** Stato reale del documento (non il computed "expired") */
    status: string
    client_email: string | null
    /** true = il cliente l'ha accettato e firmato dalla pagina pubblica (prova FES) */
    signedProof?: boolean
  }
  senderName: string
  docType?: 'preventivo' | 'fattura'
}

export function DocumentRowActions({ doc, senderName, docType = 'preventivo' }: DocumentRowActionsProps) {
  const [duplicating, setDuplicating]       = useState(false)
  const [duplicateError, setDuplicateError] = useState<string | null>(null)
  const [sendDialogOpen, setSendDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting]             = useState(false)
  const [deleteError, setDeleteError]       = useState<string | null>(null)

  async function handleUseAsTemplate(e: React.MouseEvent) {
    e.stopPropagation()
    setDuplicating(true)
    setDuplicateError(null)
    const result = await runAction(() => duplicateDocumentAction(doc.id, { keepTitle: true }), 'duplicare il documento')
    if (result?.error) {
      setDuplicateError(result.error)
      // Il menu si è già chiuso al click: senza toast l'errore resterebbe
      // invisibile (comparirebbe solo riaprendo il menu).
      toast.error(result.error)
      setDuplicating(false)
    }
    // In caso di successo: l'action fa redirect() server-side
  }

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)
    const result = await runAction(() => deleteDocumentAction(doc.id), 'eliminare il documento')
    if (result?.error) {
      setDeleteError(result.error)
      setDeleting(false)
    }
    // In caso di successo: revalidatePath nella action aggiorna la lista
  }

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="size-8 p-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity focus-visible:opacity-100"
            aria-label={docType === 'fattura' ? 'Azioni fattura' : 'Azioni preventivo'}
          >
            {duplicating
              ? <Loader2 className="size-4 animate-spin" />
              : <MoreHorizontal className="size-4 text-muted-foreground" />
            }
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="min-w-44">
          {duplicateError && (
            <p className="px-2 py-1 text-xs text-destructive">{duplicateError}</p>
          )}

          <DropdownMenuItem
            onClick={handleUseAsTemplate}
            disabled={duplicating}
          >
            <Copy className="size-4" />
            Usa come modello
          </DropdownMenuItem>

          {/* "Invia" disponibile solo per bozze */}
          {doc.status === 'draft' && (
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSendDialogOpen(true) }}>
              <Send className="size-4" />
              Invia al cliente
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            variant="destructive"
            onClick={(e) => { e.stopPropagation(); setDeleteDialogOpen(true) }}
          >
            <Trash2 className="size-4" />
            Elimina
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialog conferma eliminazione */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina {docType === 'fattura' ? 'fattura' : 'preventivo'}</DialogTitle>
            <DialogDescription>
              Stai per spostare{' '}
              <strong>{formatDocNumber(doc.doc_number) !== '—' ? formatDocNumber(doc.doc_number) : (doc.title ?? `questo ${docType === 'fattura' ? 'fattura' : 'preventivo'}`)}</strong>{' '}
              nel cestino. Potrai recuperarlo entro 15 giorni.
            </DialogDescription>
          </DialogHeader>
          {doc.signedProof && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <strong>Attenzione:</strong>{' '}
              {docType === 'fattura' ? 'questa fattura è firmata' : 'questo preventivo è firmato'} dal
              cliente: è la tua prova dell&apos;accordo. Se resta nel cestino 15 giorni
              viene cancellato per sempre e la prova va persa. Elimina solo se sei sicuro.
            </div>
          )}
          {deleteError && (
            <p className="text-sm text-destructive">{deleteError}</p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Annulla
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting
                ? <Loader2 className="size-4 animate-spin" />
                : <Trash2 className="size-4" />
              }
              Sposta nel cestino
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog invio email — in modalità controlled (senza trigger) */}
      <SendEmailDialog
        open={sendDialogOpen}
        onOpenChange={setSendDialogOpen}
        documentId={doc.id}
        docType={docType}
        docNumber={doc.doc_number ? doc.doc_number.replace(/^[A-Za-z]+/, '') : null}
        clientEmail={doc.client_email}
        senderName={senderName}
      />
    </>
  )
}
