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
import { isAppLockEnabled, isBiometricEnabled, getTimeoutMin, markActive, lastActive } from '@/lib/biometric/local'

export function AppLock({ userEmail }: { userEmail: string }) {
  const [locked, setLocked] = useState(false)
  const [hasBio, setHasBio] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Sblocco con password
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [pwBusy, setPwBusy] = useState(false)
  const hiddenAt = useRef<number>(0)

  useEffect(() => {
    if (!isAppLockEnabled()) return
    setHasBio(isBiometricEnabled())
    const timeout = getTimeoutMin()
    const staleOnLoad = timeout === 0 || Date.now() - lastActive() >= timeout * 60_000
    if (staleOnLoad) setLocked(true)

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now()
        markActive()
        return
      }
      if (!isAppLockEnabled()) return
      setLocked((cur) => {
        if (cur) return cur
        const away = Date.now() - (hiddenAt.current || 0)
        const t = getTimeoutMin()
        return t === 0 ? away > 400 : away >= t * 60_000
      })
    }
    document.addEventListener('visibilitychange', onVisibility)
    const keepAlive = window.setInterval(() => {
      if (document.visibilityState === 'visible') markActive()
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
    try { await createClient().auth.signOut() } catch { /* best effort */ }
    window.location.href = '/login'
  }

  if (!locked) return null

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
        Per rientrare inserisci la password{hasBio ? ' o usa l’impronta' : ''}.
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
