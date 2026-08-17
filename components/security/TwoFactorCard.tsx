'use client'

// ============================================================
// Verifica in due passaggi (2FA / TOTP) — attivazione e gestione.
//
// Sta in Account › Sicurezza. Flusso: Attiva → QR da scansionare con l'app
// Authenticator → codice a 6 cifre → CODICI DI RECUPERO mostrati una volta.
// Poi si possono rigenerare i codici o disattivare.
// ============================================================

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ShieldCheck, Loader2, Copy, Check } from 'lucide-react'
import {
  getMfaStatus, startTotpEnroll, confirmTotpEnroll,
  regenerateRecoveryCodes, disableTotp,
} from '@/lib/actions/mfa'

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 14, boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)',
  padding: '15px 15px', marginTop: 13,
}
const btnPrimary: React.CSSProperties = {
  width: '100%', minHeight: 46, borderRadius: 12, border: 'none', background: '#1a1a2e', color: '#fff',
  fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', marginTop: 12,
}
const btnGhost: React.CSSProperties = {
  width: '100%', minHeight: 44, borderRadius: 12, border: '1px solid #e7e7ea', background: '#fff', color: '#1a1a2e',
  fontSize: 14, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', marginTop: 10,
}

type Phase = 'loading' | 'off' | 'enrolling' | 'codes' | 'on'

export function TwoFactorCard() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [remaining, setRemaining] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Enrolling
  const [factorId, setFactorId] = useState<string | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [code, setCode] = useState('')
  // Recovery codes shown once
  const [codes, setCodes] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  // Da dove arrivano i codici a schermo: decide il toast di chiusura («attiva»
  // solo alla PRIMA attivazione — dopo «Rigenera» il 2FA era già attivo).
  const [origineCodici, setOrigineCodici] = useState<'attiva' | 'rigenera'>('attiva')

  useEffect(() => {
    getMfaStatus().then((s) => { setRemaining(s.remainingCodes); setPhase(s.enabled ? 'on' : 'off') }).catch(() => setPhase('off'))
  }, [])

  // Grazia per il blocco impronta durante la configurazione (audit 17 ago):
  // per inquadrare il QR e leggere il codice si DEVE passare all'app
  // Authenticator — AppLock legge questo marker e non fa scattare il lucchetto
  // in mezzo alla configurazione. Validità 10 min, si toglie appena si esce
  // dalle fasi di enroll (e all'unmount).
  useEffect(() => {
    const attivo = phase === 'enrolling' || phase === 'codes'
    try {
      if (attivo) sessionStorage.setItem('cc_2fa_flow', String(Date.now()))
      else sessionStorage.removeItem('cc_2fa_flow')
    } catch { /* storage bloccato */ }
    return () => { try { sessionStorage.removeItem('cc_2fa_flow') } catch { /* noop */ } }
  }, [phase])

  // ⚠️ CINTURA su ogni chiamata al server (bug Eli 17 ago sera: «Ho salvato i
  // codici» non faceva NULLA). Una server action può anche LANCIARE, non solo
  // tornare {error} — per esempio quando la pagina è rimasta aperta attraverso
  // un deploy e gli id delle action sono ruotati. Senza catch la promise
  // rifiutata moriva in silenzio: nessun errore, nessun cambio di schermata.
  const ERRORE_RETE = 'Connessione al server non riuscita: riprova. Se non cambia, ricarica la pagina.'

  async function attiva() {
    setBusy(true); setError(null)
    try {
      const res = await startTotpEnroll()
      if (res.error || !res.qrCode) { setError(res.error ?? 'Non riesco ad avviare l’attivazione.'); return }
      setFactorId(res.factorId!); setQr(res.qrCode); setSecret(res.secret ?? null); setCode('')
      setPhase('enrolling')
    } catch { setError(ERRORE_RETE) } finally { setBusy(false) }
  }

  async function conferma() {
    if (!factorId) return
    setBusy(true); setError(null)
    try {
      const res = await confirmTotpEnroll(factorId, code)
      if (res.error || !res.recoveryCodes) { setError(res.error ?? 'Codice non valido.'); return }
      setOrigineCodici('attiva')
      setCodes(res.recoveryCodes); setPhase('codes')
    } catch { setError(ERRORE_RETE) } finally { setBusy(false) }
  }

  function fatto() {
    // NIENTE giro dal server: lo stato lo conosciamo già — si arriva qui solo
    // dopo un'attivazione o una rigenerazione riuscite (il 2FA è attivo e i
    // codici a schermo sono il conteggio fresco). Il vecchio `await
    // getMfaStatus()` era l'anello fragile: se la chiamata falliva, il tasto
    // sembrava morto. Ora chiude SEMPRE, all'istante — e chiudendo la fase
    // «codes» si spegne anche la grazia cc_2fa_flow del blocco impronta.
    setRemaining(codes.length); setCodes([]); setPhase('on')
    // Dopo «Rigenera» il 2FA era GIÀ attivo: dire «attiva» lì era un messaggio
    // sbagliato (audit 17 ago).
    toast.success(
      origineCodici === 'attiva' ? 'Verifica in due passaggi attiva' : 'Codici di recupero aggiornati',
      { closeButton: true }
    )
  }

  async function rigenera() {
    setBusy(true); setError(null)
    try {
      const res = await regenerateRecoveryCodes()
      if (res.error || !res.recoveryCodes) { setError(res.error ?? 'Non riesco a rigenerare i codici.'); return }
      setOrigineCodici('rigenera')
      setCodes(res.recoveryCodes); setPhase('codes')
    } catch { setError(ERRORE_RETE) } finally { setBusy(false) }
  }

  async function disattiva() {
    if (!confirm('Vuoi disattivare la verifica in due passaggi? Il tuo account tornerà a un solo passaggio.')) return
    setBusy(true); setError(null)
    try {
      const res = await disableTotp()
      if (res.error) { setError(res.error); return }
      setPhase('off'); setRemaining(0)
      toast.success('Verifica in due passaggi disattivata', { closeButton: true })
    } catch { setError(ERRORE_RETE) } finally { setBusy(false) }
  }

  function copiaCodici() {
    navigator.clipboard?.writeText(codes.join('\n')).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }).catch(() => {})
  }

  const title = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
      <ShieldCheck size={17} style={{ color: '#c9a44c' }} />
      <span style={{ fontSize: 15, fontWeight: 600, color: '#161616' }}>Verifica in due passaggi</span>
      {phase === 'on' && <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: '#2f8a63' }}>Attiva</span>}
    </div>
  )

  if (phase === 'loading') {
    // Rotella CENTRATA (Eli, 17 ago: «ha lo spinner a sinistra» — nuda
    // sotto il titolo sembrava un elemento fuori posto, non un caricamento).
    return (
      <div style={card}>
        {title}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 6px' }}>
          <Loader2 size={18} className="animate-spin" style={{ color: 'var(--cc-muted)' }} />
        </div>
      </div>
    )
  }

  return (
    <div style={card}>
      {title}

      {phase === 'off' && (
        <>
          <p style={{ fontSize: 13, color: 'var(--cc-muted)', lineHeight: 1.5, margin: '2px 0 0' }}>
            Aggiunge un secondo passaggio quando fai il <b>login</b>: oltre alla password, un codice dall&rsquo;app Authenticator del telefono. Così, anche se qualcuno scoprisse la tua password, non entrerebbe. Non viene chiesto a ogni apertura dell&rsquo;app: per quella c&rsquo;è il blocco con impronta.
          </p>
          <button type="button" onClick={attiva} disabled={busy} style={btnPrimary}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : 'Attiva'}
          </button>
        </>
      )}

      {phase === 'enrolling' && (
        <>
          <p style={{ fontSize: 13, color: 'var(--cc-muted)', lineHeight: 1.5, margin: '2px 0 10px' }}>
            Apri un&rsquo;app Authenticator (Google Authenticator, Authy…) e inquadra questo codice. Poi scrivi qui il codice a 6 cifre che ti mostra.
          </p>
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element -- QR SVG data-URI generato da Supabase
            <img src={qr} alt="QR per l'app Authenticator" style={{ width: 180, height: 180, display: 'block', margin: '0 auto', borderRadius: 8, background: '#fff' }} />
          )}
          {secret && (
            <p style={{ fontSize: 11.5, color: 'var(--cc-muted)', textAlign: 'center', margin: '8px 0 0', wordBreak: 'break-all' }}>
              Non puoi inquadrare? Inserisci a mano: <b style={{ color: '#55534b' }}>{secret}</b>
            </p>
          )}
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            aria-label="Codice a 6 cifre"
            style={{ width: '100%', minHeight: 48, borderRadius: 12, border: '1px solid #e3e3e6', background: '#fff', color: '#161616', fontSize: 22, letterSpacing: 6, textAlign: 'center', marginTop: 12, fontFamily: 'inherit', outline: 'none' }}
          />
          <button type="button" onClick={conferma} disabled={busy || code.length !== 6} style={{ ...btnPrimary, opacity: code.length === 6 ? 1 : 0.5 }}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : 'Conferma'}
          </button>
          <button type="button" onClick={() => { setPhase('off'); setError(null) }} style={btnGhost}>Annulla</button>
        </>
      )}

      {phase === 'codes' && (
        <>
          <p style={{ fontSize: 13, color: '#161616', lineHeight: 1.5, margin: '2px 0 10px', fontWeight: 500 }}>
            Salva questi <b>codici di recupero</b> in un posto sicuro. Se perdi il telefono, uno di questi ti fa rientrare (e disattiva la verifica, che poi riattivi). Si vedono <b>solo ora</b>.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, background: '#f7f6f2', border: '1px solid #ece9e0', borderRadius: 10, padding: 12 }}>
            {codes.map((c) => (
              <div key={c} style={{ fontFamily: 'ui-monospace, monospace', fontSize: 14, letterSpacing: 1, color: '#1a1a2e', textAlign: 'center' }}>{c}</div>
            ))}
          </div>
          <button type="button" onClick={copiaCodici} style={btnGhost}>
            {copied ? <><Check size={15} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />Copiati</> : <><Copy size={15} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />Copia i codici</>}
          </button>
          <button type="button" onClick={fatto} style={btnPrimary}>Ho salvato i codici</button>
        </>
      )}

      {phase === 'on' && (
        <>
          <p style={{ fontSize: 13, color: 'var(--cc-muted)', lineHeight: 1.5, margin: '2px 0 0' }}>
            {/* ⚠️ {' '} esplicito dopo </b>: Turbopack ha mangiato lo spazio
                («loginti verrà» sul telefono di Eli, 17 ago) — regola §B.2.
                Lo scan del build guarda solo i chunk SSR: i componenti client
                come questo non li copre, quindi qui serve la cintura. */}
            Al prossimo <b>login</b>{' '}ti verrà chiesto il codice dell&rsquo;app (non a ogni
            apertura). Ti restano <b style={{ color: '#55534b' }}>{remaining} codici di recupero</b>.
          </p>
          <button type="button" onClick={rigenera} disabled={busy} style={btnGhost}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : 'Rigenera i codici di recupero'}
          </button>
          <button type="button" onClick={disattiva} disabled={busy} style={{ ...btnGhost, color: '#b05656', borderColor: '#ecc9c9' }}>
            Disattiva la verifica in due passaggi
          </button>
        </>
      )}

      {error && <p style={{ fontSize: 13, color: '#dc2626', fontWeight: 500, marginTop: 10 }}>{error}</p>}
    </div>
  )
}
