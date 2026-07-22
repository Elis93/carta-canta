'use client'

// ============================================================
// AppLock — schermata di blocco dell'app. Si sovrappone quando riapri l'app
// dopo il tempo scelto (incluso "ad ogni apertura"). Per rientrare serve la
// PASSWORD o, se attiva, l'IMPRONTA. La sessione sotto resta valida: è un blocco
// di privacy, non un logout → nessuna perdita di dati.
// Si mostra solo se "Blocca l'app quando esco" è attivo su questo dispositivo.
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react'
import { startAuthentication } from '@simplewebauthn/browser'
import { Fingerprint, Loader2, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isAppLockEnabled, isBiometricEnabled, getTimeoutMin, markActive, lastActive, setAppLockEnabled, setBiometricEnabled } from '@/lib/biometric/local'

export function AppLock({ userEmail }: { userEmail: string }) {
  const [locked, setLocked] = useState(false)
  const [hasBio, setHasBio] = useState(false)
  // Se l'account NON ha una password (registrato con Google/OAuth) lo sblocco con
  // password è impossibile → non mostriamo il campo password. Default true finché
  // non sappiamo (la maggioranza usa email+password): evita di nascondere il campo
  // per un attimo agli utenti email durante il caricamento.
  const [hasPassword, setHasPassword] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Sblocco con password
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [pwBusy, setPwBusy] = useState(false)
  const hiddenAt = useRef<number>(0)

  // Rileva se l'account ha una password (identità 'email'). Gli account solo-Google
  // non ce l'hanno → l'unico sblocco possibile è l'impronta.
  useEffect(() => {
    let alive = true
    createClient().auth.getUser().then(({ data }) => {
      if (!alive) return
      const ids = data.user?.identities
      // Nessuna identità nota → assumiamo password (comportamento storico).
      setHasPassword(!ids || ids.length === 0 || ids.some((i) => i.provider === 'email'))
    }).catch(() => { /* offline / errore: teniamo il default true */ })
    return () => { alive = false }
  }, [])

  // ⚠️ I listener vanno SEMPRE registrati: AppLock è montato una volta nel layout
  // (app) che persiste tra le navigazioni. Se uscissimo in early-return quando il
  // blocco è OFF al mount, attivandolo dopo da Impostazioni non si aggancerebbe
  // nulla fino al reload → l'app non si bloccherebbe (bug). Valutiamo quindi
  // isAppLockEnabled() DENTRO gli handler, non prima.
  // Specchio di `locked` leggibile dagli handler/timer (che vivono in closure).
  const lockedRef = useRef(false)
  useEffect(() => { lockedRef.current = locked }, [locked])

  useEffect(() => {
    setHasBio(isBiometricEnabled())
    if (isAppLockEnabled()) {
      const timeout = getTimeoutMin()
      if (timeout === 0 || Date.now() - lastActive() >= timeout * 60_000) setLocked(true)
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now()
        // ⚠️ MAI segnare attività mentre l'app è BLOCCATA: chiudere e riaprire
        // entro il timeout risulterebbe "attiva da poco" → Home senza sblocco
        // (bug reale trovato da Eli il 22 lug). Il lock, una volta mostrato,
        // deve restare finché non si sblocca davvero.
        if (isAppLockEnabled() && !lockedRef.current) markActive()
        return
      }
      if (!isAppLockEnabled()) return
      setHasBio(isBiometricEnabled())
      setLocked((cur) => {
        if (cur) return cur
        const away = Date.now() - (hiddenAt.current || 0)
        const t = getTimeoutMin()
        return t === 0 ? away > 400 : away >= t * 60_000
      })
    }
    document.addEventListener('visibilitychange', onVisibility)
    const keepAlive = window.setInterval(() => {
      // Stessa guardia anti-bug: col lock a schermo niente keep-alive.
      if (document.visibilityState === 'visible' && isAppLockEnabled() && !lockedRef.current) markActive()
    }, 30_000)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.clearInterval(keepAlive)
    }
  }, [])

  const unlockBiometric = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const optRes = await fetch('/api/passkey/auth/options', { method: 'POST' })
      if (!optRes.ok) { setError('Impronta non disponibile. Usa la password.'); setBusy(false); return }
      const options = await optRes.json()
      const assertion = await startAuthentication({ optionsJSON: options })
      const verRes = await fetch('/api/passkey/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: assertion }),
      })
      if (!verRes.ok) { setError('Impronta non riconosciuta. Riprova o usa la password.'); setBusy(false); return }
      markActive()
      setLocked(false)
    } catch {
      setError('Sblocco annullato. Riprova o usa la password.')
    } finally {
      setBusy(false)
    }
  }, [])

  async function unlockPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!password) return
    setPwBusy(true)
    setError(null)
    try {
      // Ri-verifica la password dello STESSO utente. Login riuscito = stessa
      // sessione confermata; il blocco si toglie senza perdere dati.
      const { error: err } = await createClient().auth.signInWithPassword({ email: userEmail, password })
      if (err) {
        setError('Password non corretta.')
        setPwBusy(false)
        return
      }
      setPassword('')
      markActive()
      setLocked(false)
    } catch {
      setError('Non riesco a verificare la password. Riprova.')
    } finally {
      setPwBusy(false)
    }
  }

  async function fullLogout() {
    // Rete di sicurezza anti-lockout: se questo account non ha modo di sbloccare
    // (nessuna password E nessuna impronta), disattiviamo il blocco all'uscita così
    // che al ri-login non resti intrappolato nello stesso schermo (loop). Non riduce
    // la sicurezza: per rientrare serve comunque autenticarsi al login.
    if (!hasPassword && !isBiometricEnabled()) {
      try { setBiometricEnabled(false); setAppLockEnabled(false) } catch { /* storage bloccato */ }
    }
    try { await createClient().auth.signOut() } catch { /* best effort */ }
    window.location.href = '/login'
  }

  if (!locked) return null

  // Account senza password e senza impronta: non c'è modo di sbloccare in-app.
  // Non lo intrappoliamo con un campo password inutile → messaggio chiaro + uscita.
  const noUnlockAvailable = !hasPassword && !hasBio

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="App bloccata"
      className="cc-zoom-neutral"
      style={{
        position: 'fixed', inset: 0, zIndex: 100000, background: '#1a1a2e',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 24, textAlign: 'center', overflowY: 'auto',
      }}
    >
      <div style={{ width: 70, height: 70, borderRadius: '50%', background: 'rgba(201,164,76,.15)', border: '1px solid rgba(201,164,76,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <Fingerprint size={34} style={{ color: '#c9a44c' }} />
      </div>
      <div style={{ color: '#f3ede0', fontSize: 19, fontWeight: 700, marginBottom: 6 }}>App bloccata</div>
      <div style={{ color: 'rgba(243,237,224,.75)', fontSize: 14, maxWidth: 320, lineHeight: 1.5, marginBottom: 22 }}>
        {noUnlockAvailable
          ? 'Per rientrare esci e accedi di nuovo con il tuo account.'
          : hasPassword
            ? `Per rientrare inserisci la password${hasBio ? ' o usa l’impronta' : ''}.`
            : 'Per rientrare usa l’impronta.'}
      </div>

      {hasBio && (
        <button
          type="button"
          onClick={unlockBiometric}
          disabled={busy}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            width: '100%', maxWidth: 320, minHeight: 50, borderRadius: 12, border: 'none',
            background: '#c9a44c', color: '#1a1a2e', fontSize: 15, fontWeight: 700,
            fontFamily: 'inherit', cursor: busy ? 'wait' : 'pointer', marginBottom: 14,
          }}
        >
          {busy ? <Loader2 size={18} className="animate-spin" /> : <Fingerprint size={18} />}
          Sblocca con l&rsquo;impronta
        </button>
      )}

      {hasPassword && (
      <form onSubmit={unlockPassword} style={{ width: '100%', maxWidth: 320 }}>
        {hasBio && (
          <div style={{ color: 'rgba(243,237,224,.55)', fontSize: 12, margin: '2px 0 10px' }}>oppure con la password</div>
        )}
        <div style={{ position: 'relative' }}>
          <input
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            aria-label="Password"
            style={{ width: '100%', minHeight: 48, borderRadius: 12, border: '1px solid rgba(243,237,224,.25)', background: 'rgba(255,255,255,.06)', color: '#fff', fontSize: 16, padding: '0 44px 0 14px', fontFamily: 'inherit', outline: 'none' }}
          />
          <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Nascondi password' : 'Mostra password'} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'rgba(243,237,224,.7)', cursor: 'pointer', display: 'flex', padding: 4 }}>
            {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <button
          type="submit"
          disabled={pwBusy || !password}
          style={{ width: '100%', minHeight: 50, borderRadius: 12, border: 'none', marginTop: 10, background: password ? '#f3ede0' : 'rgba(243,237,224,.3)', color: '#1a1a2e', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', cursor: pwBusy ? 'wait' : 'pointer' }}
        >
          {pwBusy ? <Loader2 size={18} className="animate-spin" /> : 'Entra'}
        </button>
      </form>
      )}

      {error && <p style={{ color: '#f0b7b7', fontSize: 13, marginTop: 14, maxWidth: 320 }}>{error}</p>}

      <button
        type="button"
        onClick={fullLogout}
        style={{ marginTop: 18, background: 'transparent', border: 'none', color: 'rgba(243,237,224,.7)', fontSize: 13, fontWeight: 600, textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit' }}
      >
        Esci dall&rsquo;account
      </button>
    </div>
  )
}
