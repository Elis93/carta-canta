'use client'

// ============================================================
// AppLock — schermata di blocco dell'app. Si sovrappone quando riapri l'app
// dopo il tempo scelto (incluso "ad ogni apertura"). Per rientrare serve la
// PASSWORD o, se attiva, l'IMPRONTA. La sessione sotto resta valida: è un blocco
// di privacy, non un logout → nessuna perdita di dati.
// Si mostra solo se "Blocca l'app quando esco" è attivo su questo dispositivo.
// ============================================================

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { startAuthentication } from '@simplewebauthn/browser'
import { Fingerprint, Loader2, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isAppLockEnabled, isBiometricEnabled, getTimeoutMin, markActive, lastActive, setAppLockEnabled, setBiometricEnabled } from '@/lib/biometric/local'

export function AppLock({ userEmail }: { userEmail: string }) {
  const [locked, setLocked] = useState(false)
  const [hasBio, setHasBio] = useState(false)
  // Se l'account NON ha una password (registrato con Google/OAuth) lo sblocco con
  // password è impossibile → non mostriamo il campo password. Il valore vero
  // arriva da una verifica ASINCRONA: al primo disegno usiamo l'ultimo esito
  // MEMORIZZATO sul dispositivo (cc_has_pw) — senza, gli account Google
  // vedevano per un attimo la variante con password e poi la pagina cambiava
  // faccia (Eli 4 ago: "due pagine di accesso una dopo l'altra").
  // Default true solo al primissimo avvio (la maggioranza usa email+password).
  const [hasPassword, setHasPassword] = useState(() => {
    if (typeof window === 'undefined') return true
    try {
      const v = localStorage.getItem('cc_has_pw')
      return v === null ? true : v === '1'
    } catch { return true }
  })
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
      // GUARDIA SESSIONE (15 ago, collaudo Eli): se l'account non esiste più
      // (es. cancellato), il lucchetto non ha senso e intrappolerebbe l'utente
      // in uno schermo da cui non si sblocca. Puliamo i flag locali del blocco
      // e andiamo al login. Un `user` null qui = sessione davvero non valida
      // (offline → la promise viene rifiutata e cade nel .catch, non qui).
      if (!data.user) {
        try { setBiometricEnabled(false); setAppLockEnabled(false) } catch { /* storage bloccato */ }
        try { void createClient().auth.signOut() } catch { /* best effort */ }
        window.location.href = '/login'
        return
      }
      const ids = data.user.identities
      // Nessuna identità nota → assumiamo password (comportamento storico).
      const v = !ids || ids.length === 0 || ids.some((i) => i.provider === 'email')
      setHasPassword(v)
      // Memorizza per i prossimi blocchi: la lock screen nasce già con la
      // faccia giusta, niente più cambio di pagina a metà.
      try { localStorage.setItem('cc_has_pw', v ? '1' : '0') } catch { /* storage bloccato */ }
    }).catch(() => { /* offline / errore: teniamo il valore memorizzato */ })
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

  // ── Blocco iniziale PRIMA del primo paint (2 ago, Eli: "si vede la Home
  // per un secondo e poi torna l'impronta") ─────────────────────────────
  // Con useEffect la decisione arrivava DOPO il primo disegno: la Home
  // lampeggiava a ogni apertura bloccata (e a ogni reload, es. VersionGuard).
  // useLayoutEffect gira in modo sincrono prima che il browser disegni →
  // il lucchetto è a schermo dal PRIMO frame, la Home non si vede mai.
  // (Il componente è client-only: sul server questo effect non gira.)
  useLayoutEffect(() => {
    setHasBio(isBiometricEnabled())
    if (isAppLockEnabled()) {
      const timeout = getTimeoutMin()
      // Navigazione IN-TAB verso una pagina pubblica (es. vetrina
      // /professionisti) e ritorno: questo componente si smonta e rimonta,
      // ma NON è una "apertura" dell'app — senza questa grazia il rientro
      // dalla vetrina chiedeva di nuovo l'impronta (Eli, 29 lug). Il marker
      // vive in sessionStorage: a app chiusa davvero sparisce, quindi la
      // vera riapertura resta bloccata come prima.
      let recentNav = false
      try {
        const nav = Number(sessionStorage.getItem('cc_lock_nav'))
        recentNav = Number.isFinite(nav) && nav > 0 && Date.now() - nav < 5 * 60_000
      } catch { /* storage bloccato */ }
      // lockedRef aggiornato SUBITO (non solo via effect): un visibilitychange
      // 'hidden' nello stesso tick non deve vedere il mirror stantio e fare
      // markActive col blocco logicamente attivo (cintura, review 22 lug).
      if (!recentNav && (timeout === 0 || Date.now() - lastActive() >= timeout * 60_000)) {
        lockedRef.current = true
        setLocked(true)
      }
    }
    // Il velo anti-lampo (LockVeil, script inline) ha già coperto la pagina
    // col navy: ora c'è il vero lucchetto (o non serve bloccare) → si toglie.
    // Stesso colore di fondo, quindi il passaggio è invisibile.
    // ⚠️ Va tolto anche l'avviso "Connessione lenta" che il velo può aver
    // aggiunto dopo 10s: senza, resterebbe sopra il lucchetto appena montato.
    try {
      document.documentElement.classList.remove('cc-locked')
      document.getElementById('cc-lock-fallback')?.remove()
    } catch { /* SSR/edge */ }
  }, [])

  useEffect(() => {
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
      // Decisione presa FUORI dal functional updater così il mirror lockedRef
      // si aggiorna nello stesso tick (niente finestra di lag tra due
      // visibilitychange ravvicinati — cintura, review 22 lug).
      if (!lockedRef.current) {
        const away = Date.now() - (hiddenAt.current || 0)
        const t = getTimeoutMin()
        if (t === 0 ? away > 400 : away >= t * 60_000) {
          lockedRef.current = true
          setLocked(true)
        }
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    const keepAlive = window.setInterval(() => {
      // Stessa guardia anti-bug: col lock a schermo niente keep-alive.
      if (document.visibilityState === 'visible' && isAppLockEnabled() && !lockedRef.current) markActive()
    }, 30_000)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.clearInterval(keepAlive)
      // Smontaggio = si sta navigando verso una pagina FUORI dal layout (app)
      // nella stessa scheda: registra il momento per la grazia qui sopra.
      // Mai col lock a schermo (uscire e rientrare non deve sbloccare).
      try {
        if (!lockedRef.current) sessionStorage.setItem('cc_lock_nav', String(Date.now()))
      } catch { /* storage bloccato */ }
    }
  }, [])

  // `auto` = cerimonia partita DA SOLA all'apparire del lucchetto (Eli 4 ago:
  // "l'impronta appare solo come pop-up, la pagina non cambia"): in quel caso
  // un annullamento o un'indisponibilità restano SILENZIOSI — il bottone è lì,
  // l'utente ritenta col tocco. I messaggi d'errore restano per il tocco manuale.
  const unlockBiometric = useCallback(async (auto = false) => {
    setBusy(true)
    setError(null)
    // ⚠️ Copy coerente (15 ago): a un account GOOGLE non si dice mai «usa la
    // password» — non ce l'ha. La via è uscire e rientrare con Google. Era il
    // difetto della prima foto di Eli («Usa la password» senza campo password).
    const fallback = hasPassword ? 'usa la password' : 'esci e rientra con Google'
    try {
      const optRes = await fetch('/api/passkey/auth/options', { method: 'POST' })
      if (!optRes.ok) { if (!auto) setError(`Impronta non disponibile. ${hasPassword ? 'Usa la password.' : 'Esci e rientra con Google.'}`); setBusy(false); return }
      const options = await optRes.json()
      const assertion = await startAuthentication({ optionsJSON: options })
      const verRes = await fetch('/api/passkey/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: assertion }),
      })
      if (!verRes.ok) { setError(`Impronta non riconosciuta. Riprova o ${fallback}.`); setBusy(false); return }
      // ⚠️ RACE della cerimonia (bug Eli 2 ago: "metto l'impronta e me la
      // richiede altre due volte"): la tendina di sistema dell'impronta manda
      // l'app in 'hidden'; se il 'visible' arriva DOPO questo sblocco, il
      // handler calcola come "assenza" tutta la durata della cerimonia
      // (>400ms: il tempo di mettere il dito) e con "Ad ogni apertura"
      // ri-blocca all'istante. Azzerando il cronometro qui, quel 'visible'
      // in ritardo vede un'assenza di pochi ms → nessun ri-blocco.
      hiddenAt.current = Date.now()
      lockedRef.current = false
      markActive()
      setLocked(false)
    } catch {
      if (!auto) setError(`Sblocco annullato. Riprova o ${fallback}.`)
    } finally {
      setBusy(false)
    }
  }, [hasPassword])

  // ── Impronta come POP-UP automatico (Eli 4 ago) ─────────────────────────
  // Appena il lucchetto compare, la tendina di sistema dell'impronta parte da
  // sola SOPRA la pagina (che resta ferma): una sola volta per blocco, solo
  // con l'app in primo piano. Annullata o non disponibile → resta il bottone.
  const autoBioTried = useRef(false)
  useEffect(() => {
    if (!locked) { autoBioTried.current = false; return }
    if (hasBio && !autoBioTried.current && document.visibilityState === 'visible') {
      autoBioTried.current = true
      void unlockBiometric(true)
    }
  }, [locked, hasBio, unlockBiometric])

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
      // Stessa protezione della cerimonia impronta: la tendina di autofill di
      // Chrome (protetta da impronta) può mandare l'app in 'hidden' — un
      // 'visible' in ritardo non deve contare l'attesa come assenza.
      hiddenAt.current = Date.now()
      lockedRef.current = false
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
          onClick={() => unlockBiometric()}
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
        {/* Per un account Google «esci» significa rientrare con Google: lo diciamo
            (era il vicolo cieco della prima foto di Eli). */}
        {hasPassword ? <>Esci dall&rsquo;account</> : <>Esci e rientra con Google</>}
      </button>
    </div>
  )
}
