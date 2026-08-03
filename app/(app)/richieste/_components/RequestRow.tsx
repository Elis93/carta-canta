'use client'

// Riga richiesta marketplace: tocca per aprire i dettagli (→ segna Letta).
// I bottoni Contatta (chiama/WhatsApp/email col recapito lasciato dal
// cliente) segnano DA SOLI la richiesta come "Risposta" al tocco — il
// bottone manuale "Segna come risposta" è stato tolto (Eli 3 ago).

import { useState, useTransition } from 'react'
import { runAction } from '@/lib/run-action'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, Phone, Mail, MessageCircle } from 'lucide-react'
import { markRequestStatusAction } from '@/lib/actions/marketplace'
import { normalizePhoneForWhatsApp } from '@/lib/whatsapp'
import { toast } from 'sonner'

export interface RequestData {
  id: string
  customer_name: string
  customer_contact: string
  /** Cellulare aggiuntivo (065): presente quando il cliente ha lasciato
      sia email (→ customer_contact) sia telefono. */
  customer_phone?: string | null
  customer_city: string | null
  message: string
  status: 'new' | 'read' | 'replied'
  created_at: string
}

function fmtWhen(iso: string): string {
  const d = new Date(iso)
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  const time = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  if (days <= 0) return `oggi, ${time}`
  if (days === 1) return `ieri, ${time}`
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }).replace('.', '')
}

const STATUS_PILL: Record<RequestData['status'], { label: string; border: string; color: string }> = {
  new: { label: 'Nuova', border: '#b9c2e2', color: '#1a1a2e' },
  read: { label: 'Letta', border: '#e3e3e6', color: 'var(--cc-muted)' },
  replied: { label: 'Risposta', border: '#bce3d2', color: '#2f8a63' },
}

export function RequestRow({ request, last }: { request: RequestData; last: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState(request.status)
  const [, startTransition] = useTransition()

  function toggle() {
    const next = !open
    setOpen(next)
    if (next && status === 'new') {
      setStatus('read')
      // Ottimistico ma con rollback: se il server fallisce, al reload la
      // richiesta tornerebbe "Nuova" e lo stato mostrato sarebbe una bugia.
      startTransition(async () => {
        const res = await runAction(() => markRequestStatusAction(request.id, 'read'), 'aggiornare la richiesta')
        if (res?.error) setStatus('new')
      })
    }
  }

  // Al tocco di un canale di contatto la richiesta diventa "Risposta" da
  // sola: best-effort SILENZIOSO (sta partendo tel:/wa.me/mailto — un toast
  // d'errore qui non si vedrebbe e non deve bloccare il contatto).
  function markRepliedOnContact() {
    if (status === 'replied') return
    const prev = status
    setStatus('replied')
    startTransition(async () => {
      const res = await runAction(() => markRequestStatusAction(request.id, 'replied'), 'aggiornare la richiesta')
      if (res?.error) { setStatus(prev); return }
      router.refresh()
    })
  }

  // Marcata "Risposta" per errore → si torna a "Letta" (qui il feedback
  // d'errore serve: nessuna navigazione in corso, il toast si vede).
  function unmarkReplied() {
    const prev = status
    setStatus('read')
    startTransition(async () => {
      const res = await runAction(() => markRequestStatusAction(request.id, 'read'), 'aggiornare la richiesta')
      if (res?.error) {
        setStatus(prev)
        toast.error('Aggiornamento non riuscito. Riprova.')
        return
      }
      router.refresh()
    })
  }

  const pill = STATUS_PILL[status]
  const initials = request.customer_name.split(/\s+/).slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase() || '?'
  // Telefono anche con . e / ("045.8123456"): email solo se contiene @
  const isPhone = !request.customer_contact.includes('@') && (request.customer_contact.replace(/\D/g, '').length >= 6)
  // I due recapiti possibili (065): email in customer_contact e cellulare
  // in customer_phone — o uno solo dei due nei dati storici.
  const emailContact = request.customer_contact.includes('@') ? request.customer_contact : null
  const phoneContact = request.customer_phone?.trim() || (isPhone ? request.customer_contact : null)

  return (
    <div style={{ borderBottom: last ? 'none' : '0.5px solid #eee' }}>
      <button
        type="button"
        onClick={toggle}
        style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
      >
        <span style={{ width: 36, height: 36, borderRadius: '50%', background: '#f2f2f5', color: '#55534b', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {initials}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#161616' }}>{request.customer_name}</span>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--cc-muted)', marginTop: 1 }}>
            {[request.customer_city, fmtWhen(request.created_at)].filter(Boolean).join(' · ')}
          </span>
        </span>
        <span style={{ border: `1px solid ${pill.border}`, color: pill.color, borderRadius: 999, padding: '3px 9px', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
          {pill.label}
        </span>
        <ChevronDown size={16} style={{ color: '#c2c1bd', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
      </button>

      {open && (
        <div style={{ padding: '0 0 13px 47px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--cc-muted)' }}>Che lavoro serve</div>
          <p style={{ fontSize: 13, color: '#161616', lineHeight: 1.55, margin: '5px 0 0', whiteSpace: 'pre-wrap' }}>{request.message}</p>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--cc-muted)', marginTop: 11 }}>
            {emailContact && phoneContact ? 'Contatti' : 'Contatto'}
          </div>
          {/* overflowWrap: un'email lunghissima senza spazi sbordava dalla
              card e finiva tagliata dal bordo schermo (review 3 ago) */}
          {emailContact && (
            <p style={{ fontSize: 13, margin: '5px 0 0', overflowWrap: 'anywhere' }}>
              <a href={`mailto:${emailContact}`} onClick={markRepliedOnContact} style={{ color: '#1a1a2e', fontWeight: 600, textDecoration: 'none' }}>
                {emailContact}
              </a>
            </p>
          )}
          {phoneContact && (
            <p style={{ fontSize: 13, margin: '5px 0 0', overflowWrap: 'anywhere' }}>
              <a href={`tel:${phoneContact.replace(/\s/g, '')}`} onClick={markRepliedOnContact} style={{ color: '#1a1a2e', fontWeight: 600, textDecoration: 'none' }}>
                {phoneContact}
              </a>
            </p>
          )}
          {/* Contatta il cliente coi recapiti che ha lasciato: telefono →
              Chiama + WhatsApp, email → Scrivi un'email. Al tocco la
              richiesta si segna "Risposta" da sola. */}
          {(() => {
            const contactBtn: React.CSSProperties = {
              flex: 1, minWidth: 92, height: 40, borderRadius: 11, border: '1px solid #e7e7ea',
              background: '#fff', color: '#1a1a2e', fontSize: 13, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              textDecoration: 'none', whiteSpace: 'nowrap',
            }
            const waNum = phoneContact ? normalizePhoneForWhatsApp(phoneContact) : ''
            // WhatsApp solo con un numero che wa.me sa interpretare:
            // internazionale esplicito (+/00) o mobile italiano (39 3xx…).
            // Un FISSO "045 812345" uscirebbe come internazionale invalido →
            // pagina d'errore WhatsApp; per i fissi resta Chiama.
            const waOk = !!phoneContact && /^\d{8,15}$/.test(waNum)
              && (/^\s*(\+|00)/.test(phoneContact) || /^393\d{9}$/.test(waNum))
            return (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginTop: 12 }}>
                {phoneContact && (
                  <a href={`tel:${phoneContact.replace(/\s/g, '')}`} onClick={markRepliedOnContact} style={contactBtn}>
                    <Phone size={15} /> Chiama
                  </a>
                )}
                {waOk && (
                  <a
                    href={`https://wa.me/${waNum}?text=${encodeURIComponent(`Buongiorno${request.customer_name ? ` ${request.customer_name}` : ''}, ho ricevuto la sua richiesta su Carta Canta.`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={markRepliedOnContact}
                    style={contactBtn}
                  >
                    <MessageCircle size={15} /> WhatsApp
                  </a>
                )}
                {emailContact && (
                  <a
                    href={`mailto:${emailContact}?subject=${encodeURIComponent('La sua richiesta di preventivo')}`}
                    onClick={markRepliedOnContact}
                    style={contactBtn}
                  >
                    <Mail size={15} /> {phoneContact ? 'Email' : 'Scrivi un’email'}
                  </a>
                )}
              </div>
            )
          })()}
          {/* Niente più ?titolo= (usciva troncato in testata — Eli 3 ago
              sera): il cliente della richiesta viene registrato in RUBRICA e
              arriva già selezionato nel riquadro Cliente (param ?richiesta=,
              gestito da /preventivi/nuovo). La nota tiene messaggio e
              recapiti come rete di sicurezza. */}
          <div style={{ marginTop: 9 }}>
            <Link
              href={`/preventivi/nuovo?richiesta=${request.id}&nota=${encodeURIComponent(
                `Richiesta dal marketplace:\n${request.message}\n\nContatto: ${request.customer_contact}${request.customer_phone ? `\nCellulare: ${request.customer_phone}` : ''}${request.customer_city ? `\nZona: ${request.customer_city}` : ''}`
              )}`}
              style={{ height: 40, borderRadius: 11, background: '#1a1a2e', color: '#fff', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)' }}
            >
              Crea preventivo
            </Link>
          </div>
          {/* Segnata "Risposta" per errore (o tocco a vuoto): si torna
              indietro (richiesta Eli 3 ago) — lo stato torna "Letta". */}
          {status === 'replied' && (
            <button
              type="button"
              onClick={unmarkReplied}
              style={{ marginTop: 8, background: 'none', border: 'none', padding: 0, fontSize: 12, fontWeight: 600, color: 'var(--cc-muted)', textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Non hai risposto? Segna come non risposta
            </button>
          )}
        </div>
      )}
    </div>
  )
}
