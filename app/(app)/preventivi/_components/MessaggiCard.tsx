'use client'

// ============================================================
// MessaggiCard — la conversazione col cliente vista dall'ARTIGIANO, con il
// campo per rispondere (Eli 5 ago: "l'artigiano riesce a rispondere e far
// comparire al cliente il messaggio?").
//
// Compare SOLO se il cliente ha già scritto almeno una volta: non è un canale
// per iniziare a scrivere ai clienti (per quello ci sono email e WhatsApp,
// che il cliente legge davvero), è il posto dove si risponde a chi ha scritto.
//
// ⚠️ Il cliente non ha l'app: l'unico avviso possibile è l'email, e solo se
// ce l'ha in rubrica. Quando manca, la card lo dice prima che l'artigiano
// scriva, invece di lasciarlo credere che il messaggio "arrivi" da solo.
// ============================================================

import { useEffect, useState, useTransition } from 'react'
import { MessageSquare, Loader2, Send, Mail, AlertTriangle, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { runAction } from '@/lib/run-action'
import { sendOwnerMessageAction } from '@/lib/actions/messaggi'
import type { ConversationMessage } from '@/lib/documents/messaggi'

function when(at: string): string {
  const d = new Date(at)
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }).replace('.', '')
    + ' · ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })
}

export function MessaggiCard({
  documentId,
  messages: initialMessages,
  clientHasEmail,
  clientName,
  anchorId,
}: {
  documentId: string
  messages: ConversationMessage[]
  /** il cliente ha un'email in rubrica → può ricevere l'avviso della risposta */
  clientHasEmail: boolean
  clientName: string | null
  /** Ancora per i deep-link (#messaggi dalla campanella e dall'email).
      ⚠️ Da passare a UN solo mount per pagina: con due istanze (mobile +
      desktop) l'id duplicato farebbe puntare lo scroll a quella nascosta. */
  anchorId?: string
}) {
  const [messages, setMessages] = useState<ConversationMessage[]>(initialMessages)
  const [text, setText] = useState('')
  const [pending, start] = useTransition()

  const last = messages[messages.length - 1]
  const attesa = last?.from === 'client'
  // Tendina come sulla pagina del cliente (Eli 5 ago). ⚠️ Aperta di default
  // SOLO quando c'è da rispondere: se hai già risposto, la conversazione è
  // storia e non deve occupare spazio nel documento.
  const [open, setOpen] = useState(attesa)

  // Arrivo dal deep-link #messaggi (campanella / email): la tendina si apre
  // da sola — atterrare sulla sezione giusta ma CHIUSA obbligava a un secondo
  // tocco (collaudo Eli 25 ago). Dopo il mount (window non esiste sul server).
  useEffect(() => {
    if (anchorId && window.location.hash === `#${anchorId}`) setOpen(true)
  }, [anchorId])

  function invia() {
    const body = text.trim()
    if (body.length < 2) { toast.error('Scrivi la risposta prima di inviarla.'); return }
    start(async () => {
      const res = await runAction(() => sendOwnerMessageAction(documentId, body), 'inviare la risposta')
      if (res.error) { toast.error(res.error); return }
      setMessages((prev) => [...prev, { from: 'owner', at: new Date().toISOString(), text: body }])
      setText('')
      if (res.warning) toast.warning(res.warning)
      else if (res.emailed) toast.success('Risposta inviata: il cliente la riceve anche all’email registrata in rubrica.')
      else toast.success('Risposta inviata.')
    })
  }

  return (
    <div id={anchorId} style={anchorId ? { scrollMarginTop: 80 } : undefined}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="cc-section-label"
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', padding: 0, marginBottom: open ? 8 : 0, cursor: 'pointer', fontFamily: 'inherit', minHeight: 32 }}
      >
        <MessageSquare className="size-3.5" style={{ color: '#6a44b5', flexShrink: 0 }} />
        <span style={{ flex: 1, textAlign: 'left' }}>
          Messaggi{clientName ? ` con ${clientName}` : ' col cliente'} · {messages.length}
        </span>
        {attesa && (
          <span style={{ fontSize: 11, fontWeight: 700, color: '#b0863e', background: '#f5e9d0', borderRadius: 7, padding: '2px 7px', letterSpacing: 0 }}>
            da rispondere
          </span>
        )}
        <ChevronDown
          size={19}
          style={{ color: '#1a1a2e', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .18s' }}
        />
      </button>

      {open && (
      <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {messages.map((m, i) => (
          <div key={`${m.at}-${i}`} style={{ display: 'flex', flexDirection: 'column', alignItems: m.from === 'owner' ? 'flex-end' : 'flex-start' }}>
            <div style={{ fontSize: 11, color: 'var(--cc-muted)', marginBottom: 3 }}>
              {m.from === 'owner' ? 'Tu' : (clientName || 'Cliente')} · {when(m.at)}
            </div>
            <div
              style={{
                maxWidth: '88%',
                background: m.from === 'owner' ? '#f5f0e2' : '#f2f2f5',
                border: m.from === 'owner' ? '1px solid #ead9b4' : '1px solid #e6e6ea',
                borderRadius: 12, padding: '9px 12px', fontSize: 14, lineHeight: 1.5,
                color: '#161616', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
              }}
            >
              {m.text}
            </div>
          </div>
        ))}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Scrivi la risposta al cliente…"
        rows={3}
        maxLength={1000}
        style={{ width: '100%', boxSizing: 'border-box', marginTop: 11, border: '1px solid #e3e3e6', borderRadius: 12, padding: '10px 12px', fontSize: 16, fontFamily: 'inherit', color: '#161616', resize: 'none', outline: 'none', background: '#fff' }}
      />

      <button
        type="button"
        onClick={invia}
        disabled={pending}
        style={{ width: '100%', marginTop: 9, background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 12, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, fontWeight: 600, cursor: pending ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: pending ? 0.7 : 1 }}
      >
        {pending ? <Loader2 size={17} className="animate-spin" /> : <Send size={16} />}
        Rispondi al cliente
      </button>

      {clientHasEmail ? (
        <p style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 13, color: 'var(--cc-muted)', lineHeight: 1.45, marginTop: 8 }}>
          <Mail size={14} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>La risposta compare nella pagina del documento; il cliente la riceve anche all&rsquo;email registrata in rubrica.</span>
        </p>
      ) : (
        <p style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 13, color: '#b0863e', lineHeight: 1.45, marginTop: 8 }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            Questo cliente non ha un&rsquo;email in rubrica: vedrà la risposta solo riaprendo il link,
            quindi conviene avvisarlo tu con un messaggio o una chiamata.
          </span>
        </p>
      )}
      </>
      )}
    </div>
  )
}
