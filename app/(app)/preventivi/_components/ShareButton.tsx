'use client'

import { useState, useEffect } from 'react'
import { runAction } from '@/lib/run-action'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Share2, Send, Mail, Copy, Loader2, Link2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { registerManualSendAction, registerManualResendAction, resendExpiredAction } from '@/lib/actions/documents'

interface ShareButtonProps {
  documentId: string
  /** public_token del documento (sempre valorizzato — generato dal DB al momento della creazione) */
  publicToken: string
  docNumber: string | null
  docType?: 'preventivo' | 'fattura'
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
  isDraft,
  hasVoci,
  triggerStyle,
  triggerLabel,
  triggerIcon,
  clientName,
  isExpired,
  defaultValidityDays,
  initialOpen = false,
  isModified = false,
  listenOpenEvent = false,
}: ShareButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(initialOpen)
  const [error, setError] = useState<string | null>(null)
  const [channelPending, setChannelPending] = useState<'whatsapp' | 'email' | 'altre' | null>(null)
  // Dopo "Copia link" su una bozza: chiede conferma per segnare il documento come Inviato
  const [confirmSent, setConfirmSent] = useState(false)
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
  const docLabel = docType === 'fattura' ? 'fattura' : 'preventivo'
  const displayUrl = url.replace(/^https?:\/\//, '')
  const shareTextWithUrl = buildShareTextWithUrl(docType, docNumber, url)
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareTextWithUrl)}`

  function handleTriggerClick() {
    if (!hasVociLocal) {
      const art = docType === 'fattura' ? 'la' : 'il'
      toast.error(`Aggiungi almeno una voce prima di inviare ${art} ${docLabel}`)
      return
    }
    setError(null)
    setConfirmSent(false)
    setConfirmResent(false)
    setConfirmResend(false)
    setOpen(true)
  }

  async function copyLink() {
    // Copia il link negli appunti
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      toast.error('Impossibile copiare il link')
      return
    }

    toast.success('Link copiato negli appunti')

    // Preventivo scaduto: chiedi conferma PRIMA di far ripartire la validità
    // (i giorni si scelgono nel select "Nuova scadenza" del pop-up)
    if (isExpired) {
      setConfirmResend(true)
      return
    }

    // Bozza: dopo aver copiato il link, chiedi conferma per segnarlo come Inviato
    if (isDraft) {
      setConfirmSent(true)
      return
    }

    // ⚠️ Documento GIÀ inviato e poi MODIFICATO: copiando il link l'app non sa
    // che è ripartito, quindi il badge «Modificato» resterebbe lì per sempre
    // (Eli, 8 ago: "ho fatto invia al cliente copiando il link… ma non è
    // scomparso il badge modificato"). Glielo chiediamo.
    if (isModified) {
      setConfirmResent(true)
    }
  }

  // Conferma rinvio dopo la copia del link (preventivi scaduti): riparte la validità
  async function confirmResendExpired() {
    if (resending) return
    setResending(true)
    setError(null)
    try {
      const result = await runAction(() => resendExpiredAction(documentId, validityDays), 'rinviare il documento')
      if (result.error) {
        setError(result.error)
        return
      }
      router.refresh()
      setConfirmResend(false)
      setOpen(false)
      toast.success(`La validità riparte: scade tra ${validityDays} giorni.`)
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
      toast.success('Segnato come reinviato al cliente')
    } finally {
      setMarkingResent(false)
    }
  }

  // Conferma "Segna come Inviato" dopo la copia del link (bozze)
  async function confirmMarkSent() {
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
      setConfirmSent(false)
      setOpen(false)
      toast.success(`${docType === 'fattura' ? 'Fattura' : 'Preventivo'} segnato come Inviato`)
    } finally {
      setMarkingSent(false)
    }
  }

  async function openChannel(channel: 'whatsapp' | 'email' | 'altre') {
    if (channelPending) return

    // Email = INVIO UFFICIALE dall'app: chiude questo pop-up e apre il dialog
    // email (oggetto / destinatario / testo) montato nella pagina di dettaglio.
    // È il dialog stesso a gestire salvataggio, stato e scadenza — qui non si
    // segna nulla come inviato.
    if (channel === 'email') {
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
      }

      // Per i preventivi scaduti: rinvia → reimposta la scadenza (giorni scelti) + stato Inviato
      if (isExpired) {
        const result = await runAction(() => resendExpiredAction(documentId, validityDays), 'rinviare il documento')
        if (result.error) {
          setError(result.error)
          return
        }
        router.refresh()
      }

      // ⚠️ Documento già inviato e poi MODIFICATO: il pop-up RESTA APERTO, così
      // tornando da WhatsApp (o dal foglio di condivisione) si trova la domanda
      // «l'hai mandato?». Chiudendolo, come si faceva prima, il badge
      // «Modificato» sarebbe rimasto lì senza che nessuno lo chiedesse.
      const chiediReinvio = !isDraft && !isExpired && isModified
      if (chiediReinvio) setConfirmResent(true)
      else setOpen(false)

      if (channel === 'whatsapp') {
        window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
      } else {
        if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
          toast.info('Condivisione nativa non disponibile su questo browser')
          return
        }
        const shareTitle = docType === 'fattura'
          ? `Fattura${numClean ? ` ${numClean}` : ''}`
          : `Preventivo${numClean ? ` ${numClean}` : ''}`
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

            {/* Nuova scadenza (solo per i preventivi scaduti) */}
            {isExpired && (
              <div style={{ marginTop: 14 }}>
                <label htmlFor="rinvia-validity" style={{ display: 'block', fontSize: 12, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--cc-muted)', marginBottom: 6 }}>
                  Nuova scadenza
                </label>
                <select
                  id="rinvia-validity"
                  value={validityDays}
                  onChange={(e) => setValidityDays(Number(e.target.value))}
                  style={{ width: '100%', border: '1px solid #e3e3e6', borderRadius: 10, padding: '11px 12px', fontSize: 14, color: '#161616', background: '#fff', fontFamily: 'inherit' }}
                >
                  {dayOptions.map((d) => (
                    <option key={d} value={d}>Scade tra {d} giorni</option>
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
                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, color: '#1a1a2e', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, padding: '2px 0' }}
              >
                <Copy size={17} /> Copia
              </button>
            </div>

            {/* Conferma rinvio dopo la copia del link (preventivi scaduti) */}
            {confirmResend && (
              <div style={{ marginTop: 14, background: '#f7f7f8', border: '1px solid #e6e6e6', borderRadius: 12, padding: '13px 14px' }}>
                <p style={{ fontSize: 14, color: '#161616', lineHeight: 1.45, margin: 0 }}>
                  Questo preventivo è <strong style={{ fontWeight: 600 }}>scaduto</strong>. Vuoi far ripartire
                  la validità? Scadrà tra <strong style={{ fontWeight: 600 }}>{validityDays} giorni</strong>{' '}
                  (modificabile qui sopra) e lo stato tornerà a <strong style={{ fontWeight: 600 }}>Inviato</strong>.
                </p>
                <p style={{ fontSize: 12, color: '#767676', lineHeight: 1.45, margin: '6px 0 0' }}>
                  Se non lo rinvii, il link copiato mostrerà il preventivo come scaduto.
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
                    Fai ripartire
                  </button>
                </div>
              </div>
            )}

            {/* Conferma "Segna come Inviato" dopo la copia del link (bozze) */}
            {confirmSent && (
              <div style={{ marginTop: 14, background: '#f7f7f8', border: '1px solid #e6e6e6', borderRadius: 12, padding: '13px 14px' }}>
                <p style={{ fontSize: 14, color: '#161616', lineHeight: 1.45, margin: 0 }}>
                  {/* 18 lug (Eli): via "Riceverà il numero progressivo" — il numero
                      viene già assegnato alla creazione (regola B.3). */}
                  Vuoi segnare questo {docLabel} come{' '}
                  <strong style={{ fontWeight: 600 }}>Inviato</strong>?
                  {docType !== 'fattura' && (
                    <>{' '}La scadenza ripartirà da oggi ({validityDays} giorni).</>
                  )}
                </p>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button
                    type="button"
                    onClick={() => setConfirmSent(false)}
                    disabled={markingSent}
                    style={{ flex: 1, height: 42, borderRadius: 11, border: '1px solid #e3e3e6', background: '#fff', color: '#55534b', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Non ora
                  </button>
                  <button
                    type="button"
                    onClick={confirmMarkSent}
                    disabled={markingSent}
                    style={{ flex: 1, height: 42, borderRadius: 11, border: 'none', background: '#1a1a2e', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    {markingSent && <Loader2 size={16} className="animate-spin" />}
                    Segna come inviato
                  </button>
                </div>
              </div>
            )}

            {/* Conferma reinvio su un documento già inviato e poi MODIFICATO */}
            {confirmResent && (
              <div style={{ marginTop: 14, background: '#f6f2fc', border: '1px solid #e2d7f4', borderRadius: 12, padding: '13px 14px' }}>
                <p style={{ fontSize: 14, color: '#161616', lineHeight: 1.45, margin: 0 }}>
                  Hai mandato tu {docType === 'fattura' ? 'la fattura' : 'il preventivo'} al cliente?
                  Lo segno come <strong style={{ fontWeight: 600 }}>reinviato</strong>{' '}e tolgo
                  l&rsquo;avviso &laquo;Modificat{docType === 'fattura' ? 'a' : 'o'}&raquo;.
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
                    Non ancora
                  </button>
                  <button
                    type="button"
                    onClick={confirmMarkResent}
                    disabled={markingResent}
                    style={{ flex: 1, height: 42, borderRadius: 11, border: 'none', background: '#1a1a2e', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    {markingResent && <Loader2 size={16} className="animate-spin" />}
                    Sì, l&rsquo;ho mandato
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
                Via WhatsApp o Altre app il {docLabel} viene segnato come{' '}
                <strong style={{ fontWeight: 600 }}>Inviato</strong>; con Copia link succede solo se confermi.
              </p>
            )}
            {/* Info per i preventivi scaduti */}
            {isExpired && !isDraft && (
              <p style={{ fontSize: 12, color: '#767676', textAlign: 'center', lineHeight: 1.5, marginTop: 14 }}>
                Rinviando, la validità riparte da oggi (
                <strong style={{ fontWeight: 600 }}>scade tra {validityDays} giorni</strong>
                ) e lo stato torna a <strong style={{ fontWeight: 600 }}>Inviato</strong>.
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
