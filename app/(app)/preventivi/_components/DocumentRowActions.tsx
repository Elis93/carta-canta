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
import { MoreHorizontal, Copy, Send, Trash2, Loader2, Archive, ArchiveRestore } from 'lucide-react'
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
import { duplicateDocumentAction, deleteDocumentAction, archiviaDocumentoAction, disarchiviaDocumentoAction } from '@/lib/actions/documents'
import { SendEmailDialog } from './SendEmailDialog'
import { docTypeLabel, formatDocNumber, stripPrefissoLegacy } from '@/lib/utils'

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
  /** 'preventivo' | 'fattura' | 'nota_credito' */
  docType?: string
  /** true = il documento è archiviato (075): il comando giusto è l'opposto */
  archived?: boolean
  /** true = fattura già trasmessa allo SdI (esito ≠ scartata): è emessa */
  sdiTransmitted?: boolean
  /** true = sulla fattura c'è un incasso registrato (acconto o saldo):
   *  eliminarla toglierebbe quei soldi dalle Entrate del Bilancio
   *  (decisione Eli, 11 ago: spento e spiegato) */
  hasIncasso?: boolean
  /** Avviso dei 12 giorni alla PRIMA conferma via email dalla lista (080) */
  avvisoSdi?: 'auto' | 'manuale' | null
  /** true = documento in SOLA LETTURA su Free (oltre gli 8 inviati): la
   *  duplica è una funzione bloccata (crea una nuova bozza da un doc Pro). */
  locked?: boolean
}

export function DocumentRowActions({ doc, senderName, docType = 'preventivo', archived = false, sdiTransmitted = false, hasIncasso = false, avvisoSdi = null, locked = false }: DocumentRowActionsProps) {
  const [duplicating, setDuplicating]       = useState(false)
  const [duplicateError, setDuplicateError] = useState<string | null>(null)
  const [sendDialogOpen, setSendDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting]             = useState(false)
  const [deleteError, setDeleteError]       = useState<string | null>(null)
  const [archiving, setArchiving]           = useState(false)

  // Archivia / Togli dall'archivio. ⚠️ NON è una cancellazione: il documento
  // resta intero, col suo numero, e resta nel Bilancio e negli export — cambia
  // solo dove lo vedi. Per questo non sta nella zona rossa del menu.
  async function handleArchive(e: React.MouseEvent) {
    e.stopPropagation()
    setArchiving(true)
    const result = await runAction(
      () => (archived ? disarchiviaDocumentoAction(doc.id) : archiviaDocumentoAction(doc.id)),
      archived ? 'togliere il documento dall\u2019archivio' : 'archiviare il documento',
    )
    if (result?.error) toast.error(result.error)
    else toast.success(archived ? 'Tolto dall\u2019archivio' : 'Archiviato')
    setArchiving(false)
  }

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

          {/* Su Free, un documento bloccato (oltre gli 8) non si duplica: il
              tasto c'è ma è SPENTO e spiegato (stessa linea delle trasmesse
              SdI), non un toast d'errore a cose fatte. */}
          <DropdownMenuItem
            onClick={handleUseAsTemplate}
            disabled={duplicating || locked}
          >
            <Copy className="size-4" />
            Usa come modello
          </DropdownMenuItem>
          {locked && (
            <p className="px-2 pb-1.5 pt-0.5 text-xs text-muted-foreground" style={{ maxWidth: 230, lineHeight: 1.4 }}>
              Documento bloccato (oltre gli 8 del piano gratuito): torna a Pro per duplicarlo.
            </p>
          )}

          {/* "Invia" disponibile solo per bozze */}
          {doc.status === 'draft' && (
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSendDialogOpen(true) }}>
              <Send className="size-4" />
              Invia al cliente
            </DropdownMenuItem>
          )}

          <DropdownMenuItem onClick={handleArchive} disabled={archiving}>
            {archived
              ? <ArchiveRestore className="size-4" />
              : <Archive className="size-4" />
            }
            {archived ? 'Togli dall\u2019archivio' : 'Archivia'}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* ⚠️ Fattura trasmessa allo SdI: il tasto c'è ma è SPENTO (Eli, 8 ago:
              *"se non si dovrebbe fare allora non permettiamo"*). Prima il
              server rifiutava, ma solo DOPO la conferma: si scopriva il divieto
              a cose fatte. Spento e spiegato è più onesto che assente — dice
              che quel comando esiste e perché oggi non si può usare. */}
          {sdiTransmitted || hasIncasso ? (
            <>
              <DropdownMenuItem disabled>
                <Trash2 className="size-4" />
                Elimina
              </DropdownMenuItem>
              <p className="px-2 pb-1.5 pt-0.5 text-xs text-muted-foreground" style={{ maxWidth: 230, lineHeight: 1.4 }}>
                {sdiTransmitted
                  ? (docType === 'nota_credito'
                      ? 'Nota di credito non eliminabile: è stata trasmessa allo SdI, quindi risulta emessa.'
                      : 'Fattura non eliminabile: è stata trasmessa allo SdI, quindi risulta emessa. Per annullarne gli effetti, crea una nota di credito.')
                  /* Incasso registrato: quei soldi sono nelle Entrate del
                     Bilancio, e cancellarli farebbe sbagliare i conti del
                     mese senza che nulla lo dica. Prima si azzera l'incasso. */
                  : 'Fattura non eliminabile: l’incasso registrato è nelle Entrate del Bilancio. Se è errato, seleziona «Segna come non pagata».'}
              </p>
            </>
          ) : (
            <DropdownMenuItem
              variant="destructive"
              onClick={(e) => { e.stopPropagation(); setDeleteDialogOpen(true) }}
            >
              <Trash2 className="size-4" />
              Elimina
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialog conferma eliminazione */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina {docTypeLabel(docType).toLowerCase()}</DialogTitle>
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
        // Il dialog email conosce due tipi: la nota di credito viaggia come
        // «fattura» (stesse rotte; il residuo delle parole è annotato).
        docType={docType === 'preventivo' ? 'preventivo' : 'fattura'}
        docNumber={doc.doc_number ? stripPrefissoLegacy(doc.doc_number) : null}
        clientEmail={doc.client_email}
        senderName={senderName}
        avvisoSdi={avvisoSdi}
      />
    </>
  )
}
