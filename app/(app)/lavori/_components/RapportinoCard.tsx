'use client'

// ============================================================
// RapportinoCard — rapportino di fine lavoro (colonne 049)
// L'artigiano scrive cosa è stato fatto → link pubblico /r/[token]
// → il cliente firma dal telefono (stessa FES dei preventivi).
// Dopo la firma il testo non è più modificabile.
// ============================================================

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Copy, Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { VoiceInput } from '@/components/shared/VoiceInput'
import { saveRapportoAction } from '@/lib/actions/lavori'

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
}

export function RapportinoCard({ data }: { data: RapportinoData }) {
  const router = useRouter()
  const [text, setText] = useState(data.text ?? '')
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
      const result = await saveRapportoAction(fd)
      if (result?.error) { setError(result.error); return }
      if (result?.url) setUrl(result.url)
      toast.success('Rapportino pronto: manda il link al cliente per la firma', { duration: 10_000, closeButton: true })
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

  const waHref = url
    ? `https://wa.me/${(data.clientPhone ?? '').replace(/\D/g, '')}?text=${encodeURIComponent(
        `Buongiorno, il lavoro è concluso. Qui trova il rapportino di fine lavoro da firmare: ${url}`
      )}`
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
            {url ? 'Aggiorna rapportino' : 'Crea link per la firma'}
          </button>
        </>
      )}

      {url && (
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
          {!signed && waHref && data.clientPhone && (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 13, fontWeight: 600, color: '#1a7f4f', textDecoration: 'none' }}
            >
              <Send size={13} /> Manda su WhatsApp per la firma
            </a>
          )}
        </div>
      )}
    </div>
  )
}
