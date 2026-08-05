'use client'

// ============================================================
// ClientMessages — la CONVERSAZIONE col cliente sulla pagina del documento
// (Eli 5 ago: "se mando un messaggio dal link voglio che sotto ci sia la
// conversazione, apribile con un menu a tendina").
//
// Il cliente scrive, l'artigiano risponde dall'app, e qui si legge tutto lo
// scambio. I messaggi vivono nel registro del documento: nessuna tabella
// nuova, nessuna registrazione richiesta al cliente.
//
// ⚠️ La tendina è APERTA di default quando l'ultimo messaggio è
// dell'artigiano: è il solo modo che il cliente ha di accorgersi, tornando
// sul link, che gli è stato risposto (oltre all'email che gli inviamo).
// ============================================================

import { useState } from 'react'
import { MessageSquare, Loader2, CheckCircle2, X, ChevronDown } from 'lucide-react'
import type { ConversationMessage } from '@/lib/documents/messaggi'

function when(at: string): string {
  const d = new Date(at)
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }).replace('.', '')
    + ' · ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })
}

export function ClientMessages({
  token,
  workspaceName,
  messages: initialMessages,
}: {
  token: string
  workspaceName: string
  messages: ConversationMessage[]
}) {
  const [messages, setMessages] = useState<ConversationMessage[]>(initialMessages)
  const last = messages[messages.length - 1]
  const [listOpen, setListOpen] = useState(last?.from === 'owner')
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasMessages = messages.length > 0

  async function send() {
    const body = text.trim()
    if (body.length < 3) { setError('Scrivi il tuo messaggio prima di inviarlo.'); return }
    setSending(true); setError(null)
    try {
      const res = await fetch(`/api/p/${token}/messaggio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: body }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? 'Invio non riuscito. Riprova.'); return }
      // Il messaggio appena inviato compare subito nella conversazione: senza,
      // il cliente non avrebbe alcuna conferma visiva di dove è finito.
      setMessages((prev) => [...prev, { from: 'client', at: new Date().toISOString(), text: body }])
      setListOpen(true)
      setText('')
      setSent(true)
      setTimeout(() => { setOpen(false); setSent(false) }, 1500)
    } catch {
      setError('Errore di rete. Controlla la connessione e riprova.')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      {hasMessages && (
        <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)', padding: '4px 14px 10px', marginBottom: 9 }}>
          <button
            type="button"
            onClick={() => setListOpen((v) => !v)}
            aria-expanded={listOpen}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', padding: '12px 0 10px', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <span style={{ flex: 1, textAlign: 'left', fontSize: 12, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: '#8a887f' }}>
              Conversazione · {messages.length} {messages.length === 1 ? 'messaggio' : 'messaggi'}
            </span>
            <ChevronDown
              size={19}
              style={{ color: '#1a1a2e', flexShrink: 0, transform: listOpen ? 'rotate(180deg)' : 'none', transition: 'transform .18s' }}
            />
          </button>

          {listOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {messages.map((m, i) => (
                <div key={`${m.at}-${i}`} style={{ display: 'flex', flexDirection: 'column', alignItems: m.from === 'client' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ fontSize: 11, color: '#8a887f', marginBottom: 3 }}>
                    {m.from === 'client' ? 'Tu' : workspaceName} · {when(m.at)}
                  </div>
                  <div
                    style={{
                      maxWidth: '88%',
                      background: m.from === 'client' ? '#eceae4' : '#f5f0e2',
                      border: m.from === 'client' ? '1px solid #e0ded7' : '1px solid #ead9b4',
                      borderRadius: 12,
                      padding: '9px 12px',
                      fontSize: 14,
                      lineHeight: 1.5,
                      color: '#161616',
                      whiteSpace: 'pre-wrap',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => { setOpen(true); setError(null) }}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#fff', border: '1px solid #e7e7ea', borderRadius: 12, height: 48, boxSizing: 'border-box', fontSize: 14, fontWeight: 600, color: '#1a1a2e', cursor: 'pointer', fontFamily: 'inherit' }}
      >
        <MessageSquare size={17} />
        {hasMessages ? 'Scrivi un altro messaggio' : 'Scrivi un messaggio'}
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 70 }}>
          <div
            onClick={() => { if (!sending) setOpen(false) }}
            style={{ position: 'absolute', inset: 0, background: 'rgba(18,18,28,.5)' }}
          />
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: '#fff', borderRadius: '20px 20px 0 0', padding: '18px 16px 22px', boxShadow: '0 -10px 34px rgba(0,0,0,.22)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ flex: 1, fontSize: 16, fontWeight: 700, color: '#161616' }}>
                Scrivi a {workspaceName}
              </span>
              <button type="button" onClick={() => { if (!sending) setOpen(false) }} aria-label="Chiudi" style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4 }}>
                <X size={20} style={{ color: '#8a887f' }} />
              </button>
            </div>

            {sent ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '18px 0 8px', color: '#2f8a63' }}>
                <CheckCircle2 size={22} />
                <span style={{ fontSize: 15, fontWeight: 600 }}>Messaggio inviato!</span>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 13, color: '#767676', margin: '0 0 12px', lineHeight: 1.5 }}>
                  Il messaggio arriva direttamente nell&rsquo;app dell&rsquo;artigiano, insieme a
                  questo documento. Non serve registrarsi: la risposta comparirà qui sotto e, se hai
                  lasciato la tua email, ti avvisiamo anche per email.
                </p>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Es. Buongiorno, quando potrebbe iniziare i lavori?"
                  rows={4}
                  maxLength={1000}
                  autoFocus
                  style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e3e3e6', borderRadius: 12, padding: '11px 12px', fontSize: 16, fontFamily: 'inherit', color: '#161616', resize: 'none', outline: 'none' }}
                />
                {error && <p style={{ fontSize: 13, color: '#dc2626', fontWeight: 500, marginTop: 8 }}>{error}</p>}
                <button
                  type="button"
                  onClick={send}
                  disabled={sending}
                  style={{ width: '100%', marginTop: 12, background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 12, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 15, fontWeight: 600, cursor: sending ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: sending ? 0.7 : 1 }}
                >
                  {sending ? <Loader2 size={18} className="animate-spin" /> : <MessageSquare size={18} />}
                  Invia il messaggio
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
