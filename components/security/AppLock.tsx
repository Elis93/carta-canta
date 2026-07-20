'use client'

// ============================================================
// AppLock — schermata di blocco con impronta (sblocco rapido dopo il login).
// Si sovrappone all'app quando la riapri dopo il tempo scelto in Impostazioni.
// La sessione sotto resta valida: è un blocco di privacy, non un logout. Per
// toglierlo serve l'impronta (verificata sul nostro server con WebAuthn); la
// password resta come riserva ("Usa la password" → login normale).
// Se lo sblocco non è attivo su questo dispositivo, il componente non fa nulla.
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react'
import { startAuthentication } from '@simplewebauthn/browser'
import { Fingerprint, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isBiometricEnabled, getTimeoutMin, markActive, lastActive } from '@/lib/biometric/local'

export function AppLock() {
  const [locked, setLocked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hiddenAt = useRef<number>(0)

  // Valutazione del blocco all'apertura e al ritorno in primo piano.
  useEffect(() => {
    if (!isBiometricEnabled()) return
    const timeout = getTimeoutMin()

    // All'apertura: blocca se è passato più del tempo scelto dall'ultima attività
    // (timeout 0 = ad ogni apertura → sempre).
    const staleOnLoad = timeout === 0 || Date.now() - lastActive() >= timeout * 60_000
    if (staleOnLoad) setLocked(true)

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now()
        markActive()
        return
      }
      // Tornati visibili
      if (!isBiometricEnabled()) return
      setLocked((cur) => {
        if (cur) return cur
        const away = Date.now() - (hiddenAt.current || 0)
        const t = getTimeoutMin()
        return t === 0 ? away > 400 : away >= t * 60_000
      })
    }
    document.addEventListener('visibilitychange', onVisibility)

    // Mentre l'app è in uso e sbloccata, tieni fresca l'ultima attività così un
    // semplice ricaricamento non fa scattare il blocco a metà lavoro.
    const keepAlive = window.setInterval(() => {
      if (document.visibilityState === 'visible') markActive()
    }, 30_000)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.clearInterval(keepAlive)
    }
  }, [])

  const unlock = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const optRes = await fetch('/api/passkey/auth/options', { method: 'POST' })
      if (!optRes.ok) {
        setError('Sblocco non disponibile. Usa la password.')
        setBusy(false)
        return
      }
      const options = await optRes.json()
      const assertion = await startAuthentication({ optionsJSON: options })
      const verRes = await fetch('/api/passkey/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: assertion }),
      })
      if (!verRes.ok) {
        setError('Impronta non riconosciuta. Riprova o usa la password.')
        setBusy(false)
        return
      }
      markActive()
      setLocked(false)
    } catch {
      // L'utente ha annullato il prompt biometrico, o il dispositivo non lo supporta.
      setError('Sblocco annullato. Riprova o usa la password.')
    } finally {
      setBusy(false)
    }
  }, [])

  async function usePassword() {
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
        padding: 24, textAlign: 'center',
      }}
    >
      <div style={{ width: 74, height: 74, borderRadius: '50%', background: 'rgba(201,164,76,.15)', border: '1px solid rgba(201,164,76,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
        <Fingerprint size={38} style={{ color: '#c9a44c' }} />
      </div>
      <div style={{ color: '#f3ede0', fontSize: 19, fontWeight: 700, marginBottom: 6 }}>App bloccata</div>
      <div style={{ color: 'rgba(243,237,224,.75)', fontSize: 14, maxWidth: 300, lineHeight: 1.5, marginBottom: 24 }}>
        Sblocca con l&rsquo;impronta o il riconoscimento del volto per tornare nell&rsquo;app.
      </div>

      <button
        type="button"
        onClick={unlock}
        disabled={busy}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          width: '100%', maxWidth: 320, minHeight: 50, borderRadius: 12, border: 'none',
          background: '#c9a44c', color: '#1a1a2e', fontSize: 15, fontWeight: 700,
          fontFamily: 'inherit', cursor: busy ? 'wait' : 'pointer',
        }}
      >
        {busy ? <Loader2 size={18} className="animate-spin" /> : <Fingerprint size={18} />}
        Sblocca con l&rsquo;impronta
      </button>

      {error && <p style={{ color: '#f0b7b7', fontSize: 13, marginTop: 14, maxWidth: 320 }}>{error}</p>}

      <button
        type="button"
        onClick={usePassword}
        style={{ marginTop: 18, background: 'transparent', border: 'none', color: 'rgba(243,237,224,.8)', fontSize: 13, fontWeight: 600, textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit' }}
      >
        Usa la password
      </button>
    </div>
  )
}
