'use client'

// ============================================================
// /mfa — schermata di verifica in due passaggi al login.
//
// Ci arriva chi ha il 2FA attivo ma non l'ha ancora completato in questa
// sessione (il layout (app) reindirizza qui quando currentLevel=aal1 &
// nextLevel=aal2). Sta FUORI dal gruppo (app) così il controllo del layout non
// crea un loop. Due strade per rientrare: il codice a 6 cifre dell'app
// Authenticator, oppure un codice di recupero (che disattiva il 2FA).
// ============================================================

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRecoveryCode } from '@/lib/actions/mfa'

export default function MfaChallengePage() {
  const router = useRouter()
  const [factorId, setFactorId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [useRecovery, setUseRecovery] = useState(false)
  const [recovery, setRecovery] = useState('')
  const codeRef = useRef<HTMLInputElement>(null)

  // Al montaggio: trova il fattore TOTP verificato. Se non c'è (o la sessione è
  // già a aal2), qui non c'è niente da fare → torna alla dashboard.
  useEffect(() => {
    let alive = true
    ;(async () => {
      const supabase = createClient()
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (!alive) return
      if (!aal || aal.currentLevel === 'aal2' || aal.nextLevel !== 'aal2') {
        router.replace('/dashboard')
        return
      }
      const { data } = await supabase.auth.mfa.listFactors()
      const totp = (data?.totp ?? []).find((f) => f.status === 'verified')
      if (!totp) { router.replace('/dashboard'); return }
      setFactorId(totp.id)
      setReady(true)
      setTimeout(() => codeRef.current?.focus(), 100)
    })()
    return () => { alive = false }
  }, [router])

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault()
    if (!factorId) return
    const cleaned = code.replace(/\D/g, '')
    if (cleaned.length !== 6) { setError('Inserisci il codice a 6 cifre.'); return }
    setBusy(true); setError(null)
    try {
      const { error: err } = await createClient().auth.mfa.challengeAndVerify({ factorId, code: cleaned })
      if (err) { setError('Codice non valido. Controlla l’ora del telefono e riprova.'); setBusy(false); return }
      router.replace('/dashboard')
      router.refresh()
    } catch {
      setError('Non riesco a verificare il codice. Riprova.')
      setBusy(false)
    }
  }

  async function submitRecovery(e: React.FormEvent) {
    e.preventDefault()
    if (!recovery.trim()) return
    setBusy(true); setError(null)
    const res = await useRecoveryCode(recovery)
    if (res?.error) { setError(res.error); setBusy(false); return }
    // Il codice di recupero ha disattivato il 2FA: ora la sessione non è più in
    // attesa → si entra. L'utente riconfigurerà il 2FA dalle impostazioni.
    router.replace('/dashboard')
    router.refresh()
  }

  async function esci() {
    try { await createClient().auth.signOut() } catch { /* best effort */ }
    router.replace('/login')
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#1a1a2e', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', overflowY: 'auto' }}>
      <div style={{ width: 70, height: 70, borderRadius: '50%', background: 'rgba(201,164,76,.15)', border: '1px solid rgba(201,164,76,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <ShieldCheck size={34} style={{ color: '#c9a44c' }} />
      </div>
      <div style={{ color: '#f3ede0', fontSize: 19, fontWeight: 700, marginBottom: 6 }}>Verifica in due passaggi</div>

      {!ready ? (
        <Loader2 size={22} className="animate-spin" style={{ color: 'rgba(243,237,224,.7)', marginTop: 12 }} />
      ) : !useRecovery ? (
        <>
          <div style={{ color: 'rgba(243,237,224,.75)', fontSize: 14, maxWidth: 320, lineHeight: 1.5, marginBottom: 22 }}>
            Apri l&rsquo;app Authenticator e inserisci il codice a 6 cifre.
          </div>
          <form onSubmit={verifyCode} style={{ width: '100%', maxWidth: 320 }}>
            <input
              ref={codeRef}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              aria-label="Codice a 6 cifre"
              style={{ width: '100%', minHeight: 52, borderRadius: 12, border: '1px solid rgba(243,237,224,.25)', background: 'rgba(255,255,255,.06)', color: '#fff', fontSize: 24, letterSpacing: 8, textAlign: 'center', padding: '0 14px', fontFamily: 'inherit', outline: 'none' }}
            />
            <button type="submit" disabled={busy || code.length !== 6} style={{ width: '100%', minHeight: 50, borderRadius: 12, border: 'none', marginTop: 12, background: code.length === 6 ? '#c9a44c' : 'rgba(201,164,76,.35)', color: '#1a1a2e', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', cursor: busy ? 'wait' : 'pointer' }}>
              {busy ? <Loader2 size={18} className="animate-spin" /> : 'Verifica'}
            </button>
          </form>
          <button type="button" onClick={() => { setUseRecovery(true); setError(null) }} style={{ marginTop: 16, background: 'transparent', border: 'none', color: 'rgba(243,237,224,.7)', fontSize: 13, fontWeight: 600, textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit' }}>
            Non ho il telefono: usa un codice di recupero
          </button>
        </>
      ) : (
        <>
          <div style={{ color: 'rgba(243,237,224,.75)', fontSize: 14, maxWidth: 320, lineHeight: 1.5, marginBottom: 22 }}>
            Inserisci uno dei codici di recupero che hai salvato. ⚠️ Entrando così la verifica in due passaggi si disattiva: riconfigurala dalle impostazioni.
          </div>
          <form onSubmit={submitRecovery} style={{ width: '100%', maxWidth: 320 }}>
            <input
              value={recovery}
              onChange={(e) => setRecovery(e.target.value)}
              autoComplete="off"
              placeholder="XXXX-XXXX"
              aria-label="Codice di recupero"
              style={{ width: '100%', minHeight: 52, borderRadius: 12, border: '1px solid rgba(243,237,224,.25)', background: 'rgba(255,255,255,.06)', color: '#fff', fontSize: 18, letterSpacing: 2, textAlign: 'center', padding: '0 14px', fontFamily: 'inherit', outline: 'none', textTransform: 'uppercase' }}
            />
            <button type="submit" disabled={busy || !recovery.trim()} style={{ width: '100%', minHeight: 50, borderRadius: 12, border: 'none', marginTop: 12, background: recovery.trim() ? '#f3ede0' : 'rgba(243,237,224,.3)', color: '#1a1a2e', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', cursor: busy ? 'wait' : 'pointer' }}>
              {busy ? <Loader2 size={18} className="animate-spin" /> : 'Entra'}
            </button>
          </form>
          <button type="button" onClick={() => { setUseRecovery(false); setError(null) }} style={{ marginTop: 16, background: 'transparent', border: 'none', color: 'rgba(243,237,224,.7)', fontSize: 13, fontWeight: 600, textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit' }}>
            Torna al codice dell&rsquo;app
          </button>
        </>
      )}

      {error && <p style={{ color: '#f0b7b7', fontSize: 13, marginTop: 14, maxWidth: 320 }}>{error}</p>}

      <button type="button" onClick={esci} style={{ marginTop: 22, background: 'transparent', border: 'none', color: 'rgba(243,237,224,.55)', fontSize: 13, textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit' }}>
        Esci dall&rsquo;account
      </button>
    </div>
  )
}
