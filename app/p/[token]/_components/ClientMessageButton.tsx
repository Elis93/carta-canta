'use client'

// ============================================================
// ClientMessageButton — il cliente scrive all'artigiano DIRETTAMENTE dalla
// pagina del documento, senza aprire la posta (Eli 4 ago: "aggiungerei un
// tasto per le richieste tramite app e non solo email").
// Il messaggio arriva nella cronologia del documento e nella campanella.
// ============================================================

import { useState } from 'react'
import { MessageSquare, Loader2, CheckCircle2, X } from 'lucide-react'

export function ClientMessageButton({ token, workspaceName }: { token: string; workspaceName: string }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send() {
    if (text.trim().length < 3) { setError('Scrivi il tuo messaggio prima di inviarlo.'); return }
    setSending(true); setError(null)
    try {
      const res = await fetch(`/api/p/${token}/messaggio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? 'Invio non riuscito. Riprova.'); return }
      setSent(true)
      setTimeout(() => { setOpen(false) }, 1600)
    } catch {
      setError('Errore di rete. Controlla la connessione e riprova.')
    } finally {
      setSending(false)
    }
  }

  if (sent && !open) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#d4efe2', border: '1px solid #bce3d2', borderRadius: 12, height: 48, fontSize: 14, fontWeight: 600, color: '#2f8a63' }}>
        <CheckCircle2 size={18} /> Messaggio inviato
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setError(null) }}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#fff', border: '1px solid #e7e7ea', borderRadius: 12, height: 48, boxSizing: 'border-box', fontSize: 14, fontWeight: 600, color: '#1a1a2e', cursor: 'pointer', fontFamily: 'inherit' }}
      >
        <MessageSquare size={17} />
        Scrivi un messaggio
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
                  questo documento. Non serve registrarsi.
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
