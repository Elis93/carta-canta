'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Share2, MessageCircle, Mail, Copy, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { registerManualSendAction } from '@/lib/actions/documents'

interface ShareButtonProps {
  documentId: string
  /** public_token del documento (sempre valorizzato — generato dal DB al momento della creazione) */
  publicToken: string
  docNumber: string | null
  docType?: 'preventivo' | 'fattura'
  isDraft: boolean
  /** true se il documento ha almeno una voce (total > 0) */
  hasVoci: boolean
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cartacanta.app'

function buildPublicUrl(token: string): string {
  return `${APP_URL}/p/${token}`
}

/** Rimuove prefissi letterali legacy (Prev, Fatt, ecc.) dal numero documento. */
function cleanDocNumber(docNumber: string | null): string | null {
  if (!docNumber) return null
  return docNumber.replace(/^[A-Za-z]+/, '') || null
}

/** Testo per wa.me/mailto (include URL nella stringa). */
function buildShareTextWithUrl(
  docType: 'preventivo' | 'fattura',
  docNumber: string | null,
  url: string,
): string {
  const label = docType === 'fattura' ? 'fattura' : 'preventivo'
  const num = cleanDocNumber(docNumber)
  const numPart = num ? ` n. ${num}` : ''
  return `Le faccio avere il link per visualizzare il ${label}${numPart} come da nostra intesa: ${url}`
}

/** Testo per navigator.share (senza URL — viene passato come campo `url` separato). */
function buildShareTextWithoutUrl(
  docType: 'preventivo' | 'fattura',
  docNumber: string | null,
): string {
  const label = docType === 'fattura' ? 'fattura' : 'preventivo'
  const num = cleanDocNumber(docNumber)
  const numPart = num ? ` n. ${num}` : ''
  return `Le faccio avere il link per visualizzare il ${label}${numPart} come da nostra intesa.`
}

export function ShareButton({
  documentId,
  publicToken,
  docNumber,
  docType = 'preventivo',
  isDraft,
  hasVoci,
}: ShareButtonProps) {
  const router = useRouter()
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const url = buildPublicUrl(publicToken)
  const docLabel = docType === 'fattura' ? 'fattura' : 'preventivo'

  function doShare() {
    const numClean = cleanDocNumber(docNumber)
    const title =
      docType === 'fattura'
        ? `Fattura${numClean ? ` ${numClean}` : ''}`
        : `Preventivo${numClean ? ` ${numClean}` : ''}`

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      // Web Share API — testo SENZA url (l'url viene passato come campo separato,
      // così WhatsApp lo mostra una volta sola e non duplicato nel testo).
      const textWithoutUrl = buildShareTextWithoutUrl(docType, docNumber)
      navigator.share({ title, text: textWithoutUrl, url }).catch(() => {
        // Utente ha annullato o API non supportata → apri popover fallback
        setPopoverOpen(true)
      })
    } else {
      // Fallback desktop: popover con WhatsApp / Email / Copia link
      setPopoverOpen(true)
    }
  }

  function handleShareClick() {
    if (popoverOpen) {
      setPopoverOpen(false)
      return
    }
    if (!hasVoci) {
      const art = docType === 'fattura' ? 'la' : 'il'
      toast.error(`Aggiungi almeno una voce prima di condividere ${art} ${docLabel}`)
      return
    }
    if (isDraft) {
      setError(null)
      setConfirmOpen(true)
    } else {
      doShare()
    }
  }

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      const result = await registerManualSendAction(documentId, undefined, docType)
      if (result.error) {
        setError(result.error)
        return
      }
      setConfirmOpen(false)
      // Aggiorna la pagina per mostrare il nuovo stato "Inviato" + numero assegnato
      router.refresh()
      doShare()
    })
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copiato negli appunti')
      setPopoverOpen(false)
    } catch {
      toast.error('Impossibile copiare il link')
    }
  }

  // Fallback wa.me/mailto: l'URL è dentro il testo (non c'è campo `url` separato)
  const shareTextWithUrl = buildShareTextWithUrl(docType, docNumber, url)
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareTextWithUrl)}`
  const mailtoUrl = `mailto:?subject=${encodeURIComponent(
    docType === 'fattura' ? 'Fattura' : 'Preventivo',
  )}&body=${encodeURIComponent(shareTextWithUrl)}`

  return (
    <>
      {/* ── Dialog di conferma (solo per le bozze) ── */}
      <Dialog
        open={confirmOpen}
        onOpenChange={(v) => {
          if (!isPending) setConfirmOpen(v)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Condividi {docLabel}</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed pt-1">
              Condividendo, questo {docLabel} verrà segnato come{' '}
              <strong>Inviato</strong> e gli verrà assegnato il numero progressivo.
              <br />
              <br />
              Nessuna email verrà inviata al cliente da Carta Canta — il link lo
              condividi tu (WhatsApp, SMS, ecc.).
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={isPending}
            >
              Annulla
            </Button>
            <Button onClick={handleConfirm} disabled={isPending} className="gap-1.5">
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Registrazione…
                </>
              ) : (
                <>
                  <Share2 className="size-4" />
                  Segna come inviato e condividi
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bottone + Popover fallback (desktop / navigator.share non disponibile) ──
          PopoverAnchor permette di ancorare il PopoverContent al bottone senza
          che il bottone stesso sia il trigger (open/close controllato manualmente). */}
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverAnchor asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={handleShareClick}
            className="gap-1.5"
          >
            <Share2 className="size-4" />
            <span className="hidden sm:inline">Condividi</span>
          </Button>
        </PopoverAnchor>
        <PopoverContent align="end" className="w-44 p-1.5">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted w-full text-left transition-colors"
            onClick={() => setPopoverOpen(false)}
          >
            <MessageCircle className="size-4 text-green-600 shrink-0" />
            WhatsApp
          </a>
          <a
            href={mailtoUrl}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted w-full text-left transition-colors"
            onClick={() => setPopoverOpen(false)}
          >
            <Mail className="size-4 shrink-0" />
            Email
          </a>
          <button
            onClick={copyLink}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted w-full text-left transition-colors"
          >
            <Copy className="size-4 shrink-0" />
            Copia link
          </button>
        </PopoverContent>
      </Popover>
    </>
  )
}
