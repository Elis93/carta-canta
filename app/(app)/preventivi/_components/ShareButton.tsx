'use client'

import { useState, useEffect } from 'react'
import { runAction } from '@/lib/run-action'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Share2, Send, Mail, Copy, Loader2, Link2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { registerManualSendAction, registerManualResendAction, resendExpiredAction, riapriRifiutatoAction } from '@/lib/actions/documents'
import { stripPrefissoLegacy } from '@/lib/utils'

interface ShareButtonProps {
  documentId: string
  /** public_token del documento (sempre valorizzato — generato dal DB al momento della creazione) */
  publicToken: string
  docNumber: string | null
  /** 'preventivo' | 'fattura' | 'nota_credito' */
  docType?: string
  /** Avviso dei 12 giorni SdI da mostrare al PRIMO invio (solo fatture/note,
   *  solo con SdI attivo — lo compone il server): 'auto' = pilota in
   *  programma · 'manuale' = trasmissione a mano. Null = niente avviso. */
  avvisoSdi?: 'auto' | 'manuale' | null
  isDraft: boolean
  /** true se il documento ha almeno una voce (total > 0) */
  hasVoci: boolean
  /** Stile inline applicato al bottone trigger (utile per chip-style su mobile) */
  triggerStyle?: React.CSSProperties
  /** Etichetta del bottone trigger (default "Condividi") */
  triggerLabel?: string
  /** Icona del bottone trigger (default Share2) */
  triggerIcon?: React.ReactNode
  /** Nome del cliente destinatario — mostrato nel sottotitolo del dialog */
  clientName?: string | null
  /** true se il preventivo è scaduto → mostra il menu "Nuova scadenza" e fa ripartire la validità al rinvio */
  isExpired?: boolean
  /** true se il preventivo è stato RIFIUTATO dal cliente → il rinvio lo
      riporta «Inviato» (il link torna accettabile) e la validità riparte.
      Solo preventivi: una fattura rifiutata è annullata, non si rinvia. */
  isRejected?: boolean
  /** Giorni di validità predefiniti (per il menu Nuova scadenza) */
  defaultValidityDays?: number
  /** true → apre il pop-up al mount (arrivo da "Invia al cliente" in creazione, ?send=1) */
  initialOpen?: boolean
  /** true se il documento è stato MODIFICATO dopo l'invio (badge «Modificato»):
      dopo aver usato WhatsApp o il link si chiede se registrare il reinvio. */
  isModified?: boolean
  /** true → ascolta l'evento "cartacanta:open-share-dialog". Va attivato su UNA
      sola istanza per pagina (la toolbar desktop, sempre montata) — altrimenti
      con due istanze si aprirebbero due pop-up sovrapposti. */
  listenOpenEvent?: boolean
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cartacanta.app'

function buildPublicUrl(token: string): string {
  return `${APP_URL}/p/${token}`
}

/** Rimuove prefissi letterali legacy (Prev, Fatt, ecc.) dal numero documento. */
function cleanDocNumber(docNumber: string | null): string | null {
  if (!docNumber) return null
  return stripPrefissoLegacy(docNumber) || null
}

/** Testo per wa.me/mailto (include URL nella stringa). */
function buildShareTextWithUrl(
  docType: string,
  docNumber: string | null,
  url: string,
): string {
  const label = docType === 'preventivo' ? 'preventivo' : docType === 'nota_credito' ? 'nota di credito' : 'fattura'
  const num = cleanDocNumber(docNumber)
  const numPart = num ? ` n. ${num}` : ''
  return `Le faccio avere il link per visualizzare il ${label}${numPart} come da nostra intesa: ${url}`
}

/** Testo per navigator.share (senza URL — viene passato come campo `url` separato). */
function buildShareTextWithoutUrl(
  docType: string,
  docNumber: string | null,
): string {
  const label = docType === 'preventivo' ? 'preventivo' : docType === 'nota_credito' ? 'nota di credito' : 'fattura'
  const num = cleanDocNumber(docNumber)
  const numPart = num ? ` n. ${num}` : ''
  return `Le faccio avere il link per visualizzare il ${label}${numPart} come da nostra intesa.`
}

// SVG path ufficiale WhatsApp
function WhatsAppSvg({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

export function ShareButton({
  documentId,
  publicToken,
  docNumber,
  docType = 'preventivo',
  avvisoSdi = null,
  isDraft,
  hasVoci,
  triggerStyle,
  triggerLabel,
  triggerIcon,
  clientName,
  isExpired,
  isRejected,
  defaultValidityDays,
  initialOpen = false,
  isModified = false,
  listenOpenEvent = false,
}: ShareButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(initialOpen)
  const [error, setError] = useState<string | null>(null)
  const [channelPending, setChannelPending] = useState<'whatsapp' | 'email' | 'altre' | null>(null)
  const [confirmResent, setConfirmResent] = useState(false)
  const [markingResent, setMarkingResent] = useState(false)
  const [markingSent, setMarkingSent] = useState(false)
  // Dopo "Copia link" su un preventivo scaduto: chiede conferma per far ripartire la validità
  const [confirmResend, setConfirmResend] = useState(false)
  const [resending, setResending] = useState(false)
  const [validityDays, setValidityDays] = useState<number>(defaultValidityDays && defaultValidityDays > 0 ? defaultValidityDays : 30)
  const dayOptions = Array.from(new Set([15, 30, 45, 60, 90, validityDays])).filter((d) => d > 0).sort((a, b) => a - b)

  // Riflette lo stato CORRENTE delle voci nel form (non la prop server-side stale).
  // PreventivoForm dispatcha 'cartacanta:voci-changed' ad ogni modifica alle voci.
  const [hasVociLocal, setHasVociLocal] = useState(hasVoci)
  useEffect(() => {
    function handler(e: Event) {
      setHasVociLocal((e as CustomEvent<{ hasVoci: boolean }>).detail.hasVoci)
    }
    window.addEventListener('cartacanta:voci-changed', handler)
    return () => window.removeEventListener('cartacanta:voci-changed', handler)
  }, [])

  // Apertura via evento globale — usata dal footer del form ("Invia al cliente"
  // in modifica bozza): il pop-up si apre anche se il trigger visibile è in un
  // blocco display:none (l'overlay è renderizzato in portal su document.body).
  // Nessun array deps: closure sempre fresca su handleTriggerClick.
  useEffect(() => {
    if (!listenOpenEvent) return
    function onOpenRequest(e: Event) {
      const detail = (e as CustomEvent<{ documentId?: string }>).detail
      if (detail?.documentId && detail.documentId !== documentId) return
      handleTriggerClick()
    }
    window.addEventListener('cartacanta:open-share-dialog', onOpenRequest)
    return () => window.removeEventListener('cartacanta:open-share-dialog', onOpenRequest)
  })

  // Arrivo da "Invia al cliente" in creazione (?send=1): il pop-up è già aperto
  // (initialOpen) — togli il param dall'URL così un reload non lo riapre (come T-19).
  useEffect(() => {
    if (!initialOpen || typeof window === 'undefined') return
    const u = new URL(window.location.href)
    if (u.searchParams.has('send')) {
      u.searchParams.delete('send')
      window.history.replaceState({}, '', u.pathname + (u.search ? u.search : '') + u.hash)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const url = buildPublicUrl(publicToken)
  const numClean = cleanDocNumber(docNumber)
  const docLabel = docType === 'preventivo' ? 'preventivo' : docType === 'nota_credito' ? 'nota di credito' : 'fattura'
  const displayUrl = url.replace(/^https?:\/\//, '')
  const shareTextWithUrl = buildShareTextWithUrl(docType, docNumber, url)

  // ── L'avviso dei 12 giorni, al PRIMO invio (Eli, 11 ago): «quando si
  // invia fattura al cliente ci deve essere un avviso che dice che da ora
  // ha 12 giorni…». Un avviso può restare più dei 4 secondi dei successi.
  function avvisoDodiciGiorni() {
    if (!avvisoSdi) return
    toast.info('Da oggi hai 12 giorni per trasmetterla allo SdI', {
      // ⚠️ «card SdI» e non «card Fattura elettronica»: sulla nota di
      // credito la card si intitola «Nota di credito elettronica (SdI)».
      description: avvisoSdi === 'auto'
        ? 'Trasmissione automatica attiva: parte da sola tra 24 ore, non devi fare niente. La gestisci (o la annulli) dalla card SdI del documento.'
        : 'La trasmetti tu dalla card SdI del documento: il conto alla rovescia è lì a ricordartelo.',
      duration: 10000,
      closeButton: true,
    })
  }
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareTextWithUrl)}`

  // ⚠️ Su un PREVENTIVO la scadenza è la VALIDITÀ dell'offerta; su una
  // FATTURA è il termine di PAGAMENTO — due cose diverse, e il testo diceva
  // «preventivo» anche dentro una fattura (Eli, 11 ago, foto alla mano).
  // Nessuna delle due ha a che vedere col termine dei 12 giorni per lo SdI,
  // che corre dalla data del documento: prorogare il pagamento non sposta
  // di un giorno l'obbligo di trasmettere (e la scadenza di pagamento non
  // entra nell'XML, quindi non diverge da ciò che è stato trasmesso).
  const isFatturaLike = docType === 'fattura' || docType === 'nota_credito'

  function handleTriggerClick() {
    if (!hasVociLocal) {
      const art = docType === 'preventivo' ? 'il' : 'la'
      toast.error(`Aggiungi almeno una voce prima di inviare ${art} ${docLabel}`)
      return
    }
    setError(null)
    setConfirmResent(false)
    setConfirmResend(false)
    setOpen(true)
  }

  async function copyLink() {
    // Copia il link negli appunti — PRIMA di qualsiasi await lungo: la
    // scrittura negli appunti richiede il gesto dell'utente ancora "fresco".
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      toast.error('Impossibile copiare il link')
      return
    }

    // Preventivo scaduto o RIFIUTATO: chiedi conferma PRIMA di riattivarlo
    // (i giorni si scelgono nel select "Nuova scadenza" del pop-up). Sul
    // rifiutato il rinvio è ciò che rende il link di nuovo accettabile.
    if (isExpired || isRejected) {
      toast.success('Link copiato negli appunti')
      setConfirmResend(true)
      return
    }

    // ⚠️ BOZZA: la pagina pubblica /p/[token] ESCLUDE le bozze, quindi il link
    // copiato porta a «pagina non trovata» finché il documento non risulta
    // Inviato. Prendere il link È l'invio: si salva e si segna Inviato subito,
    // come già fanno WhatsApp e Altre app. Prima si copiava e si chiedeva DOPO
    // («Segna come inviato?»): chi non confermava — o apriva il link prima di
    // confermare — consegnava al cliente un link morto (Eli, 12 ago: «ho
    // provato ad aprire il link… mi dice che la pagina non è trovata»).
    if (isDraft) {
      if (markingSent) return
      setMarkingSent(true)
      setError(null)
      try {
        // Auto-salva le eventuali modifiche non salvate nel form
        type SaveFn = () => Promise<{ ok: boolean; error?: string }>
        const saveFn = (window as typeof window & { __cc_doSave?: SaveFn }).__cc_doSave
        if (saveFn) {
          const saved = await saveFn()
          if (!saved.ok) {
            setError(`${saved.error ?? 'Salvataggio non riuscito.'} Il link copiato non funziona finché il documento resta in bozza: riprova con «Copia».`)
            return
          }
        }
        const result = await runAction(() => registerManualSendAction(documentId, undefined, docType), 'registrare l’invio')
        if (result.error) {
          setError(`${result.error} Il link copiato non funziona finché il documento resta in bozza: risolvi e riprova con «Copia».`)
          return
        }
        router.refresh()
        setOpen(false)
        // La registrazione fa RIPARTIRE la scadenza da oggi (expires_at =
        // oggi + validità, registerManualSendAction): va detto — «non mi
        // chiede se la scadenza riparte da lì» (Eli, 20 ago sera).
        toast.success(docType === 'preventivo'
          ? 'Link copiato: preventivo segnato come Inviato'
          : `Link copiato: ${docLabel} segnata come Inviata`, {
          description: docType === 'preventivo'
            ? `La validità riparte da oggi: scade tra ${validityDays} giorni.`
            : docType === 'fattura'
              ? `Termine di pagamento: entro ${validityDays} giorni da oggi.`
              : undefined,
        })
        avvisoDodiciGiorni()
      } finally {
        setMarkingSent(false)
      }
      return
    }

    toast.success('Link copiato negli appunti')

    // ⚠️ Documento GIÀ inviato e poi MODIFICATO: copiando il link l'app non sa
    // che è ripartito, quindi il badge «Modificato» resterebbe lì per sempre
    // (Eli, 8 ago: "ho fatto invia al cliente copiando il link… ma non è
    // scomparso il badge modificato"). Glielo chiediamo.
    if (isModified) {
      setConfirmResent(true)
    }
  }

  // Conferma rinvio dopo la copia del link (scaduti e rifiutati): il
  // documento torna «Inviato» e la validità riparte.
  async function confirmResendExpired() {
    if (resending) return
    setResending(true)
    setError(null)
    try {
      const result = await runAction(
        () => isRejected
          ? riapriRifiutatoAction(documentId, validityDays)
          : resendExpiredAction(documentId, validityDays),
        'rinviare il documento',
      )
      if (result.error) {
        setError(result.error)
        return
      }
      router.refresh()
      setConfirmResend(false)
      setOpen(false)
      toast.success(isRejected
        ? `Il preventivo è di nuovo Inviato: il cliente può accettarlo. Scade tra ${validityDays} giorni.`
        : isFatturaLike
          ? `Nuovo termine di pagamento: fra ${validityDays} giorni.`
          : `La validità riparte: scade tra ${validityDays} giorni.`)
    } finally {
      setResending(false)
    }
  }

  // Conferma "l'ho mandato io" su un documento già inviato e poi modificato:
  // registra il reinvio (stessa cosa che fa l'invio via email, meno l'email)
  // e fa sparire il badge «Modificato».
  async function confirmMarkResent() {
    if (markingResent) return
    setMarkingResent(true)
    setError(null)
    try {
      const result = await runAction(() => registerManualResendAction(documentId), 'registrare l’invio')
      if (result.error) {
        setError(result.error)
        return
      }
      router.refresh()
      setConfirmResent(false)
      setOpen(false)
      toast.success(docType === 'preventivo' ? 'Preventivo segnato come Inviato' : `${docType === 'nota_credito' ? 'Nota di credito' : 'Fattura'} segnata come Inviata`)
      // ⚠️ QUI niente avviso dei 12 giorni: questo è il REINVIO di un
      // documento già confermato — la data fiscale non riparte e nessuna
      // trasmissione viene riprogrammata; l'avviso direbbe due bugie.
    } finally {
      setMarkingResent(false)
    }
  }

  async function openChannel(channel: 'whatsapp' | 'email' | 'altre') {
    if (channelPending) return

    // Email = INVIO UFFICIALE dall'app: chiude questo pop-up e apre il dialog
    // email (oggetto / destinatario / testo) montato nella pagina di dettaglio.
    // È il dialog stesso a gestire salvataggio, stato e scadenza — qui non si
    // segna nulla come inviato.
    if (channel === 'email') {
      // Scaduto o rifiutato: il documento va PRIMA riportato «Inviato» — la
      // route email rifiuta gli stati chiusi dei preventivi, e il dialog si
      // sarebbe aperto solo per fallire all'invio (buco pre-esistente sugli
      // scaduti, chiuso col giro dei rifiutati).
      if (isExpired || isRejected) {
        setChannelPending('email')
        setError(null)
        try {
          const result = await runAction(
            () => isRejected
              ? riapriRifiutatoAction(documentId, validityDays)
              : resendExpiredAction(documentId, validityDays),
            'rinviare il documento',
          )
          if (result.error) { setError(result.error); return }
          router.refresh()
        } finally {
          setChannelPending(null)
        }
      }
      setOpen(false)
      window.dispatchEvent(new CustomEvent('cartacanta:open-send-dialog', { detail: { documentId } }))
      return
    }

    setChannelPending(channel)
    setError(null)
    try {
      // Per i documenti in bozza: auto-salva + registra invio prima di condividere
      if (isDraft) {
        type SaveFn = () => Promise<{ ok: boolean; error?: string }>
        const saveFn = (window as typeof window & { __cc_doSave?: SaveFn }).__cc_doSave
        if (saveFn) {
          const saved = await saveFn()
          if (!saved.ok) {
            setError(saved.error ?? 'Errore durante il salvataggio. Riprova.')
            return
          }
        }
        const result = await runAction(() => registerManualSendAction(documentId, undefined, docType), 'registrare l’invio')
        if (result.error) {
          setError(result.error)
          return
        }
        router.refresh()
        // Stessa conferma di «Copia» (Eli, 20 ago): senza, condividendo via
        // WhatsApp/Altre app il documento veniva segnato Inviato in silenzio.
        toast.success(docType === 'preventivo'
          ? 'Preventivo segnato come Inviato'
          : `${docLabel.charAt(0).toUpperCase()}${docLabel.slice(1)} segnata come Inviata`, {
          description: docType === 'preventivo'
            ? `La validità riparte da oggi: scade tra ${validityDays} giorni.`
            : docType === 'fattura'
              ? `Termine di pagamento: entro ${validityDays} giorni da oggi.`
              : undefined,
        })
        avvisoDodiciGiorni()
      }

      // Scaduti e rifiutati: rinvia → stato Inviato + scadenza dai giorni scelti
      if (isExpired || isRejected) {
        const result = await runAction(
          () => isRejected
            ? riapriRifiutatoAction(documentId, validityDays)
            : resendExpiredAction(documentId, validityDays),
          'rinviare il documento',
        )
        if (result.error) {
          setError(result.error)
          return
        }
        router.refresh()
        // Stessa conferma che dà «Copia» dopo il rinvio (Eli, 20 ago)
        toast.success(isRejected
          ? `Il preventivo è di nuovo Inviato: il cliente può accettarlo. Scade tra ${validityDays} giorni.`
          : isFatturaLike
            ? `Nuovo termine di pagamento: fra ${validityDays} giorni.`
            : `La validità riparte: scade tra ${validityDays} giorni.`)
      }

      // ⚠️ Documento già inviato e poi MODIFICATO: il pop-up RESTA APERTO, così
      // tornando da WhatsApp (o dal foglio di condivisione) si trova la domanda
      // «l'hai mandato?». Chiudendolo, come si faceva prima, il badge
      // «Modificato» sarebbe rimasto lì senza che nessuno lo chiedesse.
      const chiediReinvio = !isDraft && !isExpired && !isRejected && isModified
      if (chiediReinvio) setConfirmResent(true)
      else setOpen(false)

      if (channel === 'whatsapp') {
        window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
      } else {
        if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
          toast.info('Condivisione nativa non disponibile su questo browser')
          return
        }
        const shareTitle = `${docType === 'preventivo' ? 'Preventivo' : docType === 'nota_credito' ? 'Nota di credito' : 'Fattura'}${numClean ? ` ${numClean}` : ''}`
        await navigator.share({
          title: shareTitle,
          text: buildShareTextWithoutUrl(docType, docNumber),
          url,
        }).catch(() => {})
      }
    } finally {
      setChannelPending(null)
    }
  }

  const circleBase: React.CSSProperties = {
    width: 46, height: 46, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#f4f4f5',
    cursor: 'pointer', flexShrink: 0,
    color: 'var(--cc-navy)',
  }

  return (
    <>
      {/* ── Trigger — un solo nome ovunque: "Invia al cliente" (decisione Eli 5 lug) ── */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleTriggerClick}
        className="gap-1.5"
        style={triggerStyle}
      >
        {triggerIcon ?? <Send className="size-4" />}
        <span>{triggerLabel ?? 'Invia al cliente'}</span>
      </Button>

      {/* ── Pop-up "Invia al cliente" — in PORTAL su document.body, così si apre
          anche quando il trigger vive in un blocco display:none (es. toolbar
          desktop mentre si è su mobile in modalità modifica) ── */}
      {open && typeof document !== 'undefined' && createPortal(
        <div
          onClick={() => { if (!channelPending) setOpen(false) }}
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(18,18,28,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Invia ${docLabel}`}
            style={{ width: '100%', maxWidth: 440, maxHeight: 'calc((100dvh - 32px) / var(--cc-zoom, 1))', overflowY: 'auto', background: '#fff', borderRadius: 18, padding: '18px 18px 20px', boxShadow: '0 24px 60px -12px rgba(0,0,0,.4)' }}
          >
            {/* Header con X di chiusura */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#161616' }}>
                  Invia {docLabel}{numClean ? ` ${numClean}` : ''}
                </div>
                <div style={{ fontSize: 13, color: 'var(--cc-muted)', marginTop: 4, lineHeight: 1.4 }}>
                  Scegli come inviarlo{clientName ? ` a ${clientName}` : ''}.
                </div>
              </div>
              <button
                type="button"
                onClick={() => { if (!channelPending) setOpen(false) }}
                aria-label="Chiudi"
                style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 2, marginTop: -2, color: '#55534b', lineHeight: 0 }}
              >
                <X size={22} />
              </button>
            </div>

            {/* Nuova scadenza (preventivi scaduti e rifiutati) */}
            {(isExpired || isRejected) && (
              <div style={{ marginTop: 14 }}>
                <label htmlFor="rinvia-validity" style={{ display: 'block', fontSize: 12, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--cc-muted)', marginBottom: 6 }}>
                  {isFatturaLike ? 'Nuovo termine di pagamento' : 'Nuova scadenza'}
                </label>
                <select
                  id="rinvia-validity"
                  value={validityDays}
                  onChange={(e) => setValidityDays(Number(e.target.value))}
                  style={{ width: '100%', border: '1px solid #e3e3e6', borderRadius: 10, padding: '11px 12px', fontSize: 14, color: '#161616', background: '#fff', fontFamily: 'inherit' }}
                >
                  {dayOptions.map((d) => (
                    <option key={d} value={d}>{isFatturaLike ? `Da pagare entro ${d} giorni` : `Scade tra ${d} giorni`}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Link pubblico */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#f7f7f8', border: '1px solid #e6e6e6', borderRadius: 11, padding: '11px 13px', marginTop: 14 }}>
              <Link2 size={18} style={{ color: 'var(--cc-muted)', flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 14, color: '#55534b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {displayUrl}
              </span>
              <button
                type="button"
                onClick={copyLink}
                disabled={markingSent}
                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, color: '#1a1a2e', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, padding: '2px 0' }}
              >
                {markingSent ? <Loader2 size={17} className="animate-spin" /> : <Copy size={17} />} Copia
              </button>
            </div>

            {/* Conferma rinvio dopo la copia del link (preventivi scaduti) */}
            {confirmResend && (
              <div style={{ marginTop: 14, background: '#f7f7f8', border: '1px solid #e6e6e6', borderRadius: 12, padding: '13px 14px' }}>
                <p style={{ fontSize: 14, color: '#161616', lineHeight: 1.45, margin: 0 }}>
                  {isRejected ? (
                    <>
                      Questo preventivo è stato <strong style={{ fontWeight: 600 }}>rifiutato</strong>.
                      Rinviandolo torna <strong style={{ fontWeight: 600 }}>Inviato</strong>: il cliente
                      può accettarlo di nuovo e la validità riparte —{' '}
                      <strong style={{ fontWeight: 600 }}>{validityDays} giorni</strong>{' '}
                      (modificabile qui sopra).
                    </>
                  ) : isFatturaLike ? (
                    <>
                      Il <strong style={{ fontWeight: 600 }}>termine di pagamento</strong>{' '}di questa
                      fattura è passato. Vuoi dare al cliente un nuovo termine? Sarà{' '}
                      <strong style={{ fontWeight: 600 }}>fra {validityDays} giorni</strong>{' '}
                      (modificabile qui sopra) e lo stato tornerà a{' '}
                      <strong style={{ fontWeight: 600 }}>Inviata</strong>.
                    </>
                  ) : (
                    <>
                      Questo preventivo è <strong style={{ fontWeight: 600 }}>scaduto</strong>. Vuoi far ripartire
                      la validità? Scadrà tra <strong style={{ fontWeight: 600 }}>{validityDays} giorni</strong>{' '}
                      (modificabile qui sopra) e lo stato tornerà a <strong style={{ fontWeight: 600 }}>Inviato</strong>.
                    </>
                  )}
                </p>
                <p style={{ fontSize: 12, color: '#767676', lineHeight: 1.45, margin: '6px 0 0' }}>
                  {isRejected
                    ? 'Se non lo rinvii, il link copiato mostrerà il preventivo come rifiutato e il cliente non potrà accettarlo.'
                    : isFatturaLike
                      ? 'È solo una proroga commerciale: la data della fattura non cambia, e nemmeno il termine per trasmetterla allo SdI.'
                      : 'Se non lo rinvii, il link copiato mostrerà il preventivo come scaduto.'}
                </p>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button
                    type="button"
                    onClick={() => setConfirmResend(false)}
                    disabled={resending}
                    style={{ flex: 1, height: 42, borderRadius: 11, border: '1px solid #e3e3e6', background: '#fff', color: '#55534b', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Non ora
                  </button>
                  <button
                    type="button"
                    onClick={confirmResendExpired}
                    disabled={resending}
                    style={{ flex: 1, height: 42, borderRadius: 11, border: 'none', background: '#1a1a2e', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    {resending && <Loader2 size={16} className="animate-spin" />}
                    {isRejected ? 'Rinvia al cliente' : 'Fai ripartire'}
                  </button>
                </div>
              </div>
            )}

            {/* Conferma «Segna come Inviato» — documento già inviato e poi
                MODIFICATO (Eli, 8 ago: "abbiamo già una cosa del genere che
                chiede se segnarlo come Inviato, teniamo la stessa linea").
                ⚠️ Per le BOZZE la domanda non c'è più (12 ago): copiare il
                link segna Inviato da sé — la pagina pubblica esclude le bozze
                e un link copiato senza conferma era un link morto. */}
            {confirmResent && (
              <div style={{ marginTop: 14, background: '#f7f7f8', border: '1px solid #e6e6e6', borderRadius: 12, padding: '13px 14px' }}>
                <p style={{ fontSize: 14, color: '#161616', lineHeight: 1.45, margin: 0 }}>
                  Vuoi segnare di nuovo questo {docLabel} come{' '}
                  <strong style={{ fontWeight: 600 }}>Inviato</strong>?
                  {' '}Sparirà l&rsquo;avviso &laquo;Modificat{docType === 'preventivo' ? 'o' : 'a'}&raquo;.
                  {docType !== 'fattura' && (
                    <>{' '}La scadenza ripartirà da oggi ({validityDays} giorni).</>
                  )}
                </p>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button
                    type="button"
                    onClick={() => setConfirmResent(false)}
                    disabled={markingResent}
                    style={{ flex: 1, height: 42, borderRadius: 11, border: '1px solid #e3e3e6', background: '#fff', color: '#55534b', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Non ora
                  </button>
                  <button
                    type="button"
                    onClick={confirmMarkResent}
                    disabled={markingResent}
                    style={{ flex: 1, height: 42, borderRadius: 11, border: 'none', background: '#1a1a2e', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    {markingResent && <Loader2 size={16} className="animate-spin" />}
                    Segna come inviato
                  </button>
                </div>
              </div>
            )}

            {/* Canali */}
            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              {/* WhatsApp */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
                <button
                  type="button"
                  onClick={() => openChannel('whatsapp')}
                  disabled={channelPending !== null}
                  style={circleBase}
                  aria-label="Invia su WhatsApp"
                >
                  {channelPending === 'whatsapp'
                    ? <Loader2 size={20} className="animate-spin" />
                    : <WhatsAppSvg size={20} color="var(--cc-navy)" />}
                </button>
                <span style={{ fontSize: 12, color: '#55534b' }}>WhatsApp</span>
              </div>

              {/* Email */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
                <button
                  type="button"
                  onClick={() => openChannel('email')}
                  disabled={channelPending !== null}
                  style={circleBase}
                  aria-label="Invia via Email"
                >
                  {channelPending === 'email'
                    ? <Loader2 size={20} className="animate-spin" />
                    : <Mail size={20} />}
                </button>
                <span style={{ fontSize: 12, color: '#55534b' }}>Email</span>
              </div>

              {/* Altre app */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
                <button
                  type="button"
                  onClick={() => openChannel('altre')}
                  disabled={channelPending !== null}
                  style={circleBase}
                  aria-label="Altre app"
                >
                  {channelPending === 'altre'
                    ? <Loader2 size={20} className="animate-spin" />
                    : <Share2 size={20} />}
                </button>
                <span style={{ fontSize: 12, color: '#55534b' }}>Altre app</span>
              </div>
            </div>

            {/* Info per le bozze */}
            {isDraft && (
              <p style={{ fontSize: 12, color: '#767676', textAlign: 'center', lineHeight: 1.5, marginTop: 14 }}>
                Con <strong style={{ fontWeight: 600 }}>Email</strong>{' '}scegli oggetto e testo prima dell&apos;invio.
                Con WhatsApp, Altre app o Copia il {docLabel} viene segnato come{' '}
                <strong style={{ fontWeight: 600 }}>Inviato</strong>{' '}e il link diventa apribile dal cliente.
              </p>
            )}
            {/* Info per i documenti scaduti/rifiutati */}
            {(isExpired || isRejected) && !isDraft && (
              <p style={{ fontSize: 12, color: '#767676', textAlign: 'center', lineHeight: 1.5, marginTop: 14 }}>
                {isRejected ? (
                  <>
                    Rinviando, il preventivo torna <strong style={{ fontWeight: 600 }}>Inviato</strong>{' '}
                    e il cliente può <strong style={{ fontWeight: 600 }}>accettarlo di nuovo</strong>{' '}
                    (scade tra <strong style={{ fontWeight: 600 }}>{validityDays} giorni</strong>).
                  </>
                ) : isFatturaLike ? (
                  <>
                    Rinviando, il termine di pagamento riparte da oggi (
                    <strong style={{ fontWeight: 600 }}>fra {validityDays} giorni</strong>
                    ) e lo stato torna a <strong style={{ fontWeight: 600 }}>Inviata</strong>.
                  </>
                ) : (
                  <>
                    Rinviando, la validità riparte da oggi (
                    <strong style={{ fontWeight: 600 }}>scade tra {validityDays} giorni</strong>
                    ) e lo stato torna a <strong style={{ fontWeight: 600 }}>Inviato</strong>.
                  </>
                )}
              </p>
            )}

            {/* Errore */}
            {error && (
              <div style={{ borderRadius: 7, border: '1px solid #fecaca', background: '#fef2f2', padding: '9px 13px', fontSize: 13, color: '#b91c1c', marginTop: 12 }}>
                {error}
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
