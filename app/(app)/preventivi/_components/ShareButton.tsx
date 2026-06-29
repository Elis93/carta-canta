'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Share2, Mail, Copy, Loader2, Link2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { registerManualSendAction, resendExpiredAction } from '@/lib/actions/documents'

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
}: ShareButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [channelPending, setChannelPending] = useState<'whatsapp' | 'email' | 'altre' | null>(null)
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

  const url = buildPublicUrl(publicToken)
  const numClean = cleanDocNumber(docNumber)
  const docLabel = docType === 'fattura' ? 'fattura' : 'preventivo'
  const displayUrl = url.replace(/^https?:\/\//, '')
  const shareTextWithUrl = buildShareTextWithUrl(docType, docNumber, url)
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareTextWithUrl)}`
  const mailtoUrl = `mailto:?subject=${encodeURIComponent(
    docType === 'fattura' ? 'Fattura' : 'Preventivo',
  )}&body=${encodeURIComponent(shareTextWithUrl)}`

  function handleTriggerClick() {
    if (!hasVociLocal) {
      const art = docType === 'fattura' ? 'la' : 'il'
      toast.error(`Aggiungi almeno una voce prima di condividere ${art} ${docLabel}`)
      return
    }
    setError(null)
    setOpen(true)
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copiato negli appunti')
    } catch {
      toast.error('Impossibile copiare il link')
    }
  }

  async function openChannel(channel: 'whatsapp' | 'email' | 'altre') {
    if (channelPending) return
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
        const result = await registerManualSendAction(documentId, undefined, docType)
        if (result.error) {
          setError(result.error)
          return
        }
        router.refresh()
      }

      // Per i preventivi scaduti: rinvia → reimposta la scadenza (giorni scelti) + stato Inviato
      if (isExpired) {
        const result = await resendExpiredAction(documentId, validityDays)
        if (result.error) {
          setError(result.error)
          return
        }
        router.refresh()
      }

      // Apri canale scelto
      setOpen(false)
      if (channel === 'whatsapp') {
        window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
      } else if (channel === 'email') {
        window.location.href = mailtoUrl
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
      {/* ── Trigger ── */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleTriggerClick}
        className="gap-1.5"
        style={triggerStyle}
      >
        {triggerIcon ?? <Share2 className="size-4" />}
        <span>{triggerLabel ?? 'Condividi'}</span>
      </Button>

      {/* ── Bottom-sheet (mockup "Pop-up — Invia / Condividi") ── */}
      {open && (
        <>
          {/* Overlay */}
          <div
            onClick={() => { if (!channelPending) setOpen(false) }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(18,18,28,.45)', zIndex: 60 }}
          />
          {/* Sheet */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Invia ${docLabel}`}
            style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 61, maxWidth: 480, margin: '0 auto', background: '#fff', borderRadius: '22px 22px 0 0', padding: '18px 18px 22px', boxShadow: '0 -12px 40px -8px rgba(0,0,0,.32)' }}
          >
            {/* Header con X di chiusura */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#161616' }}>
                  Invia {docLabel}{numClean ? ` ${numClean}` : ''}
                </div>
                <div style={{ fontSize: 13, color: '#8a887f', marginTop: 4, lineHeight: 1.4 }}>
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
                <label htmlFor="rinvia-validity" style={{ display: 'block', fontSize: 12, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: '#8a887f', marginBottom: 6 }}>
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
              <Link2 size={18} style={{ color: '#8a887f', flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 13.5, color: '#55534b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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

            {/* Canali */}
            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              {/* WhatsApp */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
                <button
                  type="button"
                  onClick={() => openChannel('whatsapp')}
                  disabled={channelPending !== null}
                  style={circleBase}
                  aria-label="Condividi su WhatsApp"
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
                  aria-label="Condividi via Email"
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
                Condividendo, questo {docLabel} verrà segnato come{' '}
                <strong style={{ fontWeight: 600 }}>Inviato</strong>{' '}
                e riceverà il numero progressivo.
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
        </>
      )}
    </>
  )
}
