'use client'

// ============================================================
// EliminaDocumentoButton — «Elimina fattura/preventivo» in fondo alla
// pagina (sotto un filetto, mockup A) e come riga del menu «⋯».
// Stesse guardie della lista (DocumentRowActions): una fattura TRASMESSA
// allo SdI non si elimina (è emessa: nota di credito), una fattura con un
// INCASSO registrato nemmeno (i soldi sono nelle Entrate del Bilancio:
// prima «Segna come non pagata»). Spento e spiegato, non nascosto.
// ============================================================

import { useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Avviso } from '@/components/shared/Avviso'
import { runAction } from '@/lib/run-action'
import { deleteDocumentAction } from '@/lib/actions/documents'
import { docTypeLabel, formatDocNumber } from '@/lib/utils'
import { btnDanger, rigaMenuDanger } from './stili'

export function EliminaDocumentoButton({ documentId, docType, docNumber, signedProof, sdiTransmitted, hasIncasso, menu }: {
  documentId: string
  docType: string
  docNumber: string | null
  signedProof?: boolean
  sdiTransmitted?: boolean
  hasIncasso?: boolean
  /** Riga del menu «⋯» invece del bottone in fondo. */
  menu?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const femm = docType !== 'preventivo'
  const label = `Elimina ${docTypeLabel(docType).toLowerCase()}`
  const bloccato = sdiTransmitted
    ? (docType === 'nota_credito'
      ? 'Nota di credito non eliminabile: è stata trasmessa allo SdI, quindi risulta emessa.'
      : 'Fattura non eliminabile: è stata trasmessa allo SdI, quindi risulta emessa. Per annullarne gli effetti, crea una nota di credito.')
    : hasIncasso
      ? 'Fattura non eliminabile: l’incasso registrato è nelle Entrate del Bilancio. Se è errato, seleziona «Segna come non pagata».'
      : null

  async function elimina() {
    setBusy(true); setError(null)
    const res = await runAction(() => deleteDocumentAction(documentId), 'eliminare il documento')
    if (res?.error) { setError(res.error); setBusy(false) }
    // Successo: l'action reindirizza alla lista.
  }

  if (bloccato) {
    return (
      <div style={menu ? { padding: '12px 2px' } : undefined}>
        <button type="button" disabled style={{ ...(menu ? rigaMenuDanger : btnDanger), opacity: .45, cursor: 'default', padding: menu ? 0 : undefined, minHeight: menu ? 0 : undefined }}>
          <Trash2 size={18} /> {label}
        </button>
        <p style={{ fontSize: 12, color: 'var(--cc-muted)', lineHeight: 1.45, margin: '6px 0 0', textAlign: menu ? 'left' : 'center' }}>{bloccato}</p>
      </div>
    )
  }

  return (
    <div data-keep-open>
      <button type="button" onClick={() => setOpen(true)} style={menu ? rigaMenuDanger : btnDanger}>
        <Trash2 size={18} /> {label}
      </button>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setError(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription>
              Stai per spostare{' '}
              <strong>{formatDocNumber(docNumber) !== '—' ? formatDocNumber(docNumber) : (femm ? 'questa bozza' : 'questa bozza')}</strong>{' '}
              nel cestino. {femm ? 'Potrai recuperarla' : 'Potrai recuperarlo'} entro 15 giorni.
            </DialogDescription>
          </DialogHeader>
          {signedProof && (
            <Avviso gravita="attenzione" dentro sotto="Se resta nel cestino 15 giorni viene cancellato per sempre e la prova va persa. Elimina solo se sei sicuro.">
              <b>{femm ? 'Questa fattura è firmata' : 'Questo preventivo è firmato'} dal cliente</b>: è la tua prova dell&apos;accordo.
            </Avviso>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Annulla</Button>
            <Button variant="destructive" onClick={elimina} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Sposta nel cestino
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
