'use client'

// ============================================================
// RapportinoCard — rapportino di fine lavoro (colonne 049)
// L'artigiano scrive cosa è stato fatto → link pubblico /r/[token]
// → il cliente firma dal telefono (stessa FES dei preventivi).
// Dopo la firma il testo non è più modificabile.
// ============================================================

import { useState, useTransition } from 'react'
import { runAction } from '@/lib/run-action'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Copy, FileText, Loader2, Mail, Send } from 'lucide-react'
import { toast } from 'sonner'
import { VoiceInput } from '@/components/shared/VoiceInput'
import { saveRapportoAction } from '@/lib/actions/lavori'
import { normalizePhoneForWhatsApp } from '@/lib/whatsapp'

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'
const secLabel: React.CSSProperties = { fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64', marginBottom: 10 }

export interface RapportinoData {
  lavoroId: string
  text: string | null
  /** URL pubblico /r/[token] — presente se il rapportino è già stato creato */
  url: string | null
  signedAt: string | null
  signerName: string | null
  /** Telefono del cliente (per il bottone WhatsApp) */
  clientPhone: string | null
  /** Email del cliente (per il bottone Email — mailto:, parte dalla posta dell'artigiano) */
  clientEmail: string | null
  /** 086: mostrare le ore al cliente nel rapportino (default false = nascoste) */
  showLabor: boolean
  /** true se ci sono ore tracciate su questo lavoro (altrimenti la spunta è inutile) */
  hasLaborHours: boolean
}

export function RapportinoCard({ data }: { data: RapportinoData }) {
  const router = useRouter()
  const [text, setText] = useState(data.text ?? '')
  const [showLabor, setShowLabor] = useState(data.showLabor)
  const [url, setUrl] = useState<string | null>(data.url)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const signed = Boolean(data.signedAt)

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('id', data.lavoroId)
      fd.set('report_text', text)
      if (showLabor) fd.set('show_labor_to_client', 'on')
      const result = await runAction(() => saveRapportoAction(fd), 'salvare il rapportino')
      if (result?.error) { setError(result.error); return }
      if (result?.url) setUrl(result.url)
      toast.success('Rapportino pronto: manda il link al cliente per la firma', { closeButton: true })
      router.refresh()
    })
  }

  async function handleCopy() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copiato')
    } catch {
      toast.error('Copia non riuscita — tieni premuto sul link per copiarlo')
    }
  }

  const inviteText = `Buongiorno, il lavoro è concluso. Qui trova il rapportino di fine lavoro da firmare: ${url ?? ''}`
  // Normalizza il telefono UNA volta: se non produce cifre valide (numero fisso/
  // garbage) NON mostriamo WhatsApp — altrimenti wa.me/ aprirebbe la chat senza
  // destinatario (stessa guardia della pagina Agenda).
  const waDigits = normalizePhoneForWhatsApp(data.clientPhone ?? '')
  const waHref = url && waDigits
    ? `https://wa.me/${waDigits}?text=${encodeURIComponent(inviteText)}`
    : null
  // Email dal client di posta dell'artigiano (mailto:) — niente invii automatici
  // La @ resta LETTERALE (RFC 6068): encodare tutto produceva nome%40dominio,
  // che qualche client di posta non decodifica. Si encodano solo ?&#.
  const mailTo = data.clientEmail ? encodeURIComponent(data.clientEmail).replace(/%40/g, '@') : null
  const mailHref = url && mailTo
    ? `mailto:${mailTo}?subject=${encodeURIComponent('Rapportino di fine lavoro da firmare')}&body=${encodeURIComponent(inviteText)}`
    : null

  return (
    <div style={{ background: '#fff', borderRadius: 14, boxShadow: SH, padding: '14px 15px' }}>
      <div style={secLabel}>Rapportino di fine lavoro</div>

      {signed ? (
        <>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, background: '#d4efe2', borderRadius: 11, padding: '11px 13px' }}>
            <CheckCircle2 size={17} style={{ color: '#2f8a63', flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 13, color: '#1d5c41', lineHeight: 1.5 }}>
              Firmato da <strong>{data.signerName ?? 'cliente'}</strong>
              {data.signedAt && (
                <> il {new Date(data.signedAt).toLocaleString('it-IT', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })}</>
              )}
            </span>
          </div>
          {data.text && (
            <p style={{ fontSize: 13, color: '#55534b', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginTop: 10 }}>{data.text}</p>
          )}
        </>
      ) : (
        <>
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              e.currentTarget.style.height = 'auto'
              e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'
            }}
            ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = Math.max(96, el.scrollHeight) + 'px' } }}
            placeholder={'Cosa è stato fatto, materiali installati, raccomandazioni…\n(questo testo lo vede e lo firma il cliente)'}
            maxLength={4000}
            style={{
              width: '100%', border: '1px solid #e3e3e6', borderRadius: 10, padding: '11px 12px',
              fontSize: 13, fontFamily: 'inherit', color: '#161616', background: '#fff', boxSizing: 'border-box',
              outline: 'none', minHeight: 96, resize: 'none', overflow: 'hidden', lineHeight: 1.6,
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <VoiceInput
              compact
              className="flex-none text-[#55534b]"
              onTranscript={(t) => setText((prev) => (prev ? `${prev}\n${t}` : t))}
            />
            <span style={{ fontSize: 12, color: '#767676' }}>Il cliente lo firma dal telefono, come il preventivo</span>
          </div>
          <p style={{ fontSize: 12, color: '#767676', lineHeight: 1.5, margin: '8px 0 0' }}>
            Nel rapportino il cliente vede le <b>foto rese visibili</b>{' '}con l&rsquo;occhio nella
            card Foto lavoro.
          </p>

          {/* 086: le ore sono un dato interno → nascoste al cliente di default;
              la spunta compare solo se ci sono ore da mostrare. */}
          {data.hasLaborHours && (
            <label htmlFor="show-labor" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: '#fafafa', borderRadius: 10, padding: '11px 12px', marginTop: 8, cursor: 'pointer' }}>
              <input
                id="show-labor"
                type="checkbox"
                checked={showLabor}
                onChange={(e) => setShowLabor(e.target.checked)}
                style={{ width: 18, height: 18, marginTop: 1, accentColor: '#1a1a2e', flexShrink: 0 }}
              />
              <span style={{ fontSize: 13, color: '#161616', lineHeight: 1.45 }}>
                <b>Mostra le ore al cliente</b>
                <span style={{ display: 'block', fontSize: 12, color: '#767676', marginTop: 2 }}>
                  Le ore segnate su questo lavoro restano tue: compaiono nel rapportino del
                  cliente solo se attivi questa spunta.
                </span>
              </span>
            </label>
          )}

          {error && <p style={{ fontSize: 13, color: '#dc2626', fontWeight: 500, marginTop: 8 }}>{error}</p>}

          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            style={{
              width: '100%', height: 44, marginTop: 10, border: 'none', borderRadius: 12, background: '#1a1a2e',
              color: '#fff', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 8, cursor: 'pointer', fontFamily: 'inherit', opacity: pending ? 0.7 : 1,
            }}
          >
            {pending ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
            {/* F19: "Crea link per la firma" faceva pensare a un invio automatico */}
            {url ? 'Aggiorna rapportino' : 'Crea rapportino da inviare'}
          </button>

          {/* F19: creato il rapportino, i 3 canali dei solleciti — Email,
              WhatsApp, Copia — in una riga compatta. L'email parte dalla
              posta dell'artigiano (mailto:), nessun invio automatico. */}
          {url && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, color: '#767676', marginBottom: 6 }}>
                Invialo al cliente per la firma:
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {data.clientEmail && (
                  <a href={mailHref ?? undefined} style={channelBtn}>
                    <Mail size={15} /> Email
                  </a>
                )}
                {waHref && (
                  <a href={waHref} target="_blank" rel="noopener noreferrer" style={channelBtn}>
                    <Send size={15} /> WhatsApp
                  </a>
                )}
                <button type="button" onClick={handleCopy} style={{ ...channelBtn, cursor: 'pointer' }}>
                  <Copy size={15} /> Copia link
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* 2 ago sera (Eli): prima l'ANTEPRIMA in HTML — dal documento aperto
          c'è il bottone "Scarica in PDF" (route autenticata, stessa vista del cliente). */}
      {url && (
        <a
          href={`/api/lavori/${data.lavoroId}/rapportino-pdf?preview=1`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            marginTop: 10, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 7, background: '#fff', border: '0.5px solid #dcdbd7', borderRadius: 11,
            color: '#1a1a2e', fontSize: 13, fontWeight: 600, textDecoration: 'none',
          }}
        >
          <FileText size={15} /> Anteprima del rapportino
        </a>
      )}

      {/* A rapportino FIRMATO resta solo il link con la copia (il documento
          non si rimanda: è già firmato) */}
      {url && signed && (
        <div style={{ marginTop: 10, background: '#f7f7f8', border: '0.5px solid #e6e6e6', borderRadius: 11, padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: '#55534b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {url.replace(/^https?:\/\//, '')}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', background: 'none', padding: 0, fontSize: 12, fontWeight: 600, color: '#1a1a2e', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
            >
              <Copy size={13} /> Copia
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// F19: bottone-canale compatto (stessa famiglia dei solleciti in Home)
const channelBtn: React.CSSProperties = {
  flex: 1,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  border: '0.5px solid #dcdbd7',
  borderRadius: 10,
  padding: '10px 4px',
  background: '#fff',
  color: '#1a1a2e',
  fontSize: 13,
  fontWeight: 600,
  textDecoration: 'none',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
}
