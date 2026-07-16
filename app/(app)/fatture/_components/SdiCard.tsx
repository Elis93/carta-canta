'use client'

// ============================================================
// SdiCard — fatturazione elettronica sul dettaglio fattura
// (mockup crescita §1). Il COSTO non viene MAI mostrato: per i Pro
// la dicitura è "Incluso nel piano Pro · Conservazione a norma inclusa";
// i Free hanno 8 invii di prova. Stati: Inviata / Consegnata /
// Mancata consegna (valida) / Scartata (+motivo e reinvio).
// ============================================================

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Loader2, CheckCircle2, AlertTriangle, Clock, Crown } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

const fieldLabel: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, letterSpacing: '.05em',
  textTransform: 'uppercase', color: 'var(--cc-muted)', marginBottom: 6,
}
const fieldStyle: React.CSSProperties = {
  width: '100%', border: '1px solid #e3e3e6', borderRadius: 10, padding: '11px 12px',
  fontSize: 14, fontFamily: 'inherit', color: '#161616', background: '#fff',
  boxSizing: 'border-box', outline: 'none',
}

export interface SdiCardProps {
  documentId: string
  sdiStatus: 'inviata' | 'consegnata' | 'mancata_consegna' | 'scartata' | null
  sdiError: string | null
  sdiSentAt: string | null
  isPro: boolean
  /** Invii di prova rimasti (solo Free; null = illimitato) */
  freeRemaining: number | null
  freeTotal: number
  /** Canale telematico già in rubrica */
  clientDestinatario: string | null
  clientPec: string | null
  isMockProvider: boolean
}

export function SdiCard({
  documentId,
  sdiStatus,
  sdiError,
  sdiSentAt,
  isPro,
  freeRemaining,
  freeTotal,
  clientDestinatario,
  clientPec,
  isMockProvider,
}: SdiCardProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [dest, setDest] = useState(clientDestinatario ?? '')
  const [pec, setPec] = useState(clientPec ?? '')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSend() {
    setError(null)
    setSending(true)
    try {
      const res = await fetch(`/api/fatture/${documentId}/sdi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codice_destinatario: dest.trim() || undefined,
          pec: pec.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Invio non riuscito. Riprova.')
        return
      }
      toast.success(data.mock ? 'Fattura inviata allo SDI (PROVA)' : 'Fattura inviata allo SDI', {
        description: data.mock
          ? 'Provider di prova: nessuna trasmissione reale.'
          : 'Riceverai l’esito del Sistema di Interscambio qui sulla fattura.',
        duration: 10_000,
        closeButton: true,
      })
      setOpen(false)
      router.refresh()
    } catch {
      setError('Errore di rete. Controlla la connessione e riprova.')
    } finally {
      setSending(false)
    }
  }

  const statusView = (() => {
    switch (sdiStatus) {
      case 'inviata':
        return { bg: '#d8e8fb', color: '#3f6fb0', icon: <Clock size={15} />, label: 'Inviata allo SDI', sub: 'In attesa dell’esito del Sistema di Interscambio.' }
      case 'consegnata':
        return { bg: '#d4efe2', color: '#2f8a63', icon: <CheckCircle2 size={15} />, label: 'Consegnata', sub: 'La fattura elettronica è stata consegnata al destinatario.' }
      case 'mancata_consegna':
        return { bg: '#f5e9d0', color: '#b0863e', icon: <AlertTriangle size={15} />, label: 'Mancata consegna (valida)', sub: 'Il destinatario non ha un canale attivo: la fattura è comunque valida, il cliente la trova nel suo cassetto fiscale.' }
      case 'scartata':
        return { bg: '#f5dede', color: '#b05656', icon: <AlertTriangle size={15} />, label: 'Scartata dallo SDI', sub: sdiError ?? 'Correggi i dati e reinvia.' }
      default:
        return null
    }
  })()

  const quotaExhausted = !isPro && freeRemaining !== null && freeRemaining <= 0
  const canSend = !sdiStatus || sdiStatus === 'scartata'

  return (
    <div style={{ background: '#fff', borderRadius: 14, boxShadow: SH, padding: '14px 15px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64' }}>
          Fattura elettronica (SDI)
        </span>
        {isMockProvider && (
          <span style={{ border: '1px solid #e8d6ad', color: '#b0863e', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
            PROVA
          </span>
        )}
      </div>

      {statusView && (
        <div style={{ background: statusView.bg, borderRadius: 10, padding: '10px 12px', display: 'flex', gap: 9, alignItems: 'flex-start', marginBottom: canSend ? 11 : 0 }}>
          <span style={{ color: statusView.color, flexShrink: 0, marginTop: 1 }}>{statusView.icon}</span>
          <span>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#2b2b2b' }}>
              {statusView.label}
              {sdiSentAt && sdiStatus === 'inviata' && (
                <span style={{ fontWeight: 400, color: '#55534b' }}> · {new Date(sdiSentAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }).replace('.', '')}</span>
              )}
            </span>
            <span style={{ display: 'block', fontSize: 12, color: '#55534b', marginTop: 2, lineHeight: 1.45 }}>{statusView.sub}</span>
          </span>
        </div>
      )}

      {canSend && (
        quotaExhausted ? (
          <>
            <p style={{ fontSize: 12, color: '#767676', lineHeight: 1.5, margin: '0 0 11px' }}>
              Hai usato le {freeTotal} e-fatture di prova del piano Free. <b>Con Pro le e-fatture sono illimitate</b>, con conservazione a norma inclusa.
            </p>
            <Link
              href="/abbonamento"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, height: 44, borderRadius: 12, background: '#1a1a2e', color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none', boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)' }}
            >
              <Crown size={15} style={{ color: 'var(--cc-gold)' }} /> Passa a Pro
            </Link>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => { setError(null); setOpen(true) }}
              style={{ width: '100%', height: 46, border: 'none', borderRadius: 12, background: '#1a1a2e', color: '#fff', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <Send size={16} /> {sdiStatus === 'scartata' ? 'Reinvia allo SDI' : 'Invia allo SDI'}
            </button>
            <p style={{ fontSize: 12, color: '#767676', lineHeight: 1.5, marginTop: 9 }}>
              {isPro
                ? 'Incluso nel piano Pro · Conservazione a norma inclusa.'
                : `${freeRemaining} di ${freeTotal} e-fatture di prova disponibili · Conservazione a norma inclusa.`}
            </p>
          </>
        )
      )}

      <p style={{ fontSize: 12, color: '#767676', lineHeight: 1.5, marginTop: 9, borderTop: '0.5px solid #f0f0f0', paddingTop: 9 }}>
        Carta Canta non fornisce consulenza fiscale e non sostituisce il commercialista:
        la correttezza dei dati resta responsabilità dell&rsquo;utente.
      </p>

      {/* Dialog invio: canale telematico del cliente */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ fontSize: 17, fontWeight: 600 }}>Invia allo SDI</DialogTitle>
            <DialogDescription style={{ fontSize: 13 }}>
              Serve il canale telematico del cliente. Se è un privato senza canale, lascia vuoto: useremo <b>0000000</b> (la fattura finisce nel suo cassetto fiscale).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label style={fieldLabel} htmlFor="sdi-dest">Codice destinatario (7 caratteri)</label>
              <input
                id="sdi-dest"
                value={dest}
                onChange={(e) => setDest(e.target.value.toUpperCase())}
                placeholder="Es. M5UXCR1"
                maxLength={7}
                autoComplete="off"
                spellCheck={false}
                style={{ ...fieldStyle, textTransform: 'uppercase' }}
              />
            </div>
            <div>
              <label style={fieldLabel} htmlFor="sdi-pec">oppure PEC del cliente</label>
              <input
                id="sdi-pec"
                value={pec}
                onChange={(e) => setPec(e.target.value)}
                placeholder="Es. cliente@pec.it"
                autoComplete="off"
                spellCheck={false}
                style={fieldStyle}
              />
            </div>
            {error && <p style={{ fontSize: 13, color: '#dc2626', fontWeight: 500 }}>{error}</p>}
            <button
              type="button"
              onClick={handleSend}
              disabled={sending}
              style={{ width: '100%', height: 48, border: 'none', borderRadius: 12, background: '#1a1a2e', color: '#fff', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)', cursor: sending ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: sending ? 0.7 : 1 }}
            >
              {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={16} />}
              Trasmetti
            </button>
            <p style={{ fontSize: 12, color: '#767676', lineHeight: 1.5 }}>
              Il canale viene salvato in rubrica per le prossime fatture a questo cliente.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
