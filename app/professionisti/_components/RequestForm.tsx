'use client'

// Form "Richiedi un preventivo" — contatto senza account (mockup crescita §3).

import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'

const fieldLabel: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, letterSpacing: '.05em',
  textTransform: 'uppercase', color: 'var(--cc-muted)', marginBottom: 6,
}
const fieldStyle: React.CSSProperties = {
  width: '100%', border: '1px solid #e3e3e6', borderRadius: 10, padding: '11px 12px',
  fontSize: 14, fontFamily: 'inherit', color: '#161616', background: '#fff',
  boxSizing: 'border-box', outline: 'none',
}

export function RequestForm({ workspaceId, publicName }: { workspaceId: string; publicName: string }) {
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [city, setCity] = useState('')
  const [message, setMessage] = useState('')
  const [hp, setHp] = useState('') // honeypot
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (name.trim().length < 2 || contact.trim().length < 5 || message.trim().length < 5) {
      setError('Compila nome, contatto e descrizione del lavoro.')
      return
    }
    // Il contatto è l'unico modo per farsi ricontattare: deve somigliare a
    // un'email o a un numero di telefono, non a un testo qualsiasi.
    const c = contact.trim()
    const looksEmail = /^\S+@\S+\.\S+$/.test(c)
    const looksPhone = /^\+?[\d\s\-./()]{6,20}$/.test(c) && (c.match(/\d/g)?.length ?? 0) >= 6
    if (!looksEmail && !looksPhone) {
      setError('Il contatto non sembra un telefono né un’email: controlla e riprova.')
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/marketplace/richiesta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          name: name.trim(),
          contact: contact.trim(),
          city: city.trim() || undefined,
          message: message.trim(),
          website: hp || undefined, // honeypot: gli umani non lo vedono
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Invio non riuscito. Riprova.')
        return
      }
      setSent(true)
    } catch {
      setError('Errore di rete. Controlla la connessione e riprova.')
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    const wasEmail = /^\S+@\S+\.\S+$/.test(contact.trim())
    return (
      <div style={{ textAlign: 'center', padding: '10px 0 4px' }}>
        <CheckCircle2 size={26} style={{ color: '#2f8a63', display: 'inline-block' }} />
        <div style={{ fontSize: 14, fontWeight: 700, color: '#161616', marginTop: 6 }}>Richiesta inviata!</div>
        <p style={{ fontSize: 12, color: '#767676', marginTop: 4, lineHeight: 1.5 }}>
          {publicName}{' '}ha ricevuto la tua richiesta e ti ricontatterà al recapito che hai
          indicato.{wasEmail ? ' Ti abbiamo inviato un riepilogo via email.' : ''}
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64', marginBottom: 10 }}>
        La tua richiesta a {publicName}
      </div>

      {/* Honeypot invisibile: i bot lo compilano, gli umani no */}
      <input type="text" name="website" value={hp} onChange={(e) => setHp(e.target.value)} autoComplete="off" tabIndex={-1} aria-hidden="true" style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }} />
      <label style={fieldLabel} htmlFor="rq-name">Nome <span style={{ color: '#b08d3e' }}>*</span></label>
      <input id="rq-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Il tuo nome" maxLength={80} style={fieldStyle} />

      <label style={{ ...fieldLabel, marginTop: 12 }} htmlFor="rq-contact">Telefono o email <span style={{ color: '#b08d3e' }}>*</span></label>
      <input id="rq-contact" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Per farti ricontattare" maxLength={120} style={fieldStyle} />

      <label style={{ ...fieldLabel, marginTop: 12 }} htmlFor="rq-city">Comune</label>
      <input id="rq-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Es. Verona" maxLength={80} style={fieldStyle} />

      <label style={{ ...fieldLabel, marginTop: 12 }} htmlFor="rq-message">Che lavoro ti serve? <span style={{ color: '#b08d3e' }}>*</span></label>
      <textarea id="rq-message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Es. sostituzione caldaia, perdita in bagno…" rows={4} maxLength={2000} style={{ ...fieldStyle, resize: 'none' }} />

      {error && <p style={{ fontSize: 13, color: '#dc2626', fontWeight: 500, marginTop: 10 }}>{error}</p>}

      <button
        type="submit"
        disabled={sending}
        style={{
          width: '100%', height: 46, border: 'none', borderRadius: 12, background: '#1a1a2e', color: '#fff',
          fontSize: 14, fontWeight: 600, boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)', marginTop: 13,
          cursor: sending ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: sending ? 0.7 : 1,
        }}
      >
        {sending ? 'Invio…' : 'Invia richiesta'}
      </button>
      {/* {' '} espliciti attorno alle espressioni: il compilatore mangiava lo
          spazio dopo {publicName} → "Eli Impiantinell'app" (bug Turbopack B.2,
          segnalato da Eli il 29 lug). */}
      <p style={{ fontSize: 12, color: '#767676', lineHeight: 1.5, marginTop: 10 }}>
        La richiesta arriva direttamente a{' '}{publicName}{' '}dentro l&rsquo;app: non serve
        registrarsi. I dati che inserisci servono solo a trasmettere la richiesta al
        professionista, che ti ricontatterà al recapito indicato. Leggi
        l&rsquo;<a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#1a1a2e', fontWeight: 600 }}>informativa privacy</a>.
        Carta Canta non è parte del rapporto tra te e il professionista.
      </p>
    </form>
  )
}
