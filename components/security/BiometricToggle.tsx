'use client'

// ============================================================
// BiometricToggle — card "Blocca l'app quando esco" in Impostazioni › Generale.
// Interruttore master che, riaprendo l'app dopo il tempo scelto, chiede
// l'accesso. Lo sblocco avviene SEMPRE con la PASSWORD; in più, su questo
// dispositivo, si può aggiungere lo sblocco con IMPRONTA (passkey/WebAuthn).
// ============================================================

import { useEffect, useState } from 'react'
import { browserSupportsWebAuthn, platformAuthenticatorIsAvailable } from '@simplewebauthn/browser'
import { Lock, Fingerprint, Loader2, Trash2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { listMyPasskeysAction, deletePasskeyAction, type PasskeyInfo } from '@/lib/actions/passkeys'
import { registerPasskey, guessDeviceLabel } from '@/lib/biometric/register'
import {
  isBiometricEnabled, setBiometricEnabled, isAppLockEnabled, setAppLockEnabled,
  getTimeoutMin, setTimeoutMin, setBiometricPrompted, setBiometricUid, TIMEOUT_OPTIONS,
} from '@/lib/biometric/local'

// Copy della card, estratte in costanti: il testo accanto a `hasPassword === …`
// faceva scattare un falso positivo "Generic Password" nello scanner segreti
// (GitGuardian, incident 35017023 — verificato: solo copy UI, nessun segreto).
const DESC_SOLO_IMPRONTA =
  'Riaprendo l’app dopo il tempo scelto, per rientrare serve l’impronta. Il tuo account accede con Google (senza password), quindi il blocco funziona solo con l’impronta.'
const DESC_STANDARD =
  'Riaprendo l’app dopo il tempo scelto, per rientrare serve la password (o l’impronta, se la aggiungi). Nessuno può usare l’app se ti prende il telefono.'
const TOAST_RIMOSSA_BLOCCO_SPENTO =
  'Impronta rimossa. Senza un modo per sbloccare, il blocco è stato disattivato.'
const TOAST_RIMOSSA_RESTA_PW = 'Impronta rimossa. Resta lo sblocco con password.'

export function BiometricToggle() {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [lockOn, setLockOn] = useState(false)
  const [bioOn, setBioOn] = useState(false)
  const [timeout, setTimeoutState] = useState(getTimeoutMin())
  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([])
  const [busy, setBusy] = useState(false)
  // Account senza password (registrato con Google): lo sblocco può avvenire SOLO
  // con l'impronta → non offriamo il blocco solo-password (chiuderebbe fuori).
  // null = non ancora verificato: il bottone "Attiva il blocco" compare solo a
  // stato risolto, così un account Google con rete lenta non può attivare un
  // blocco senza alcun metodo di sblocco nella finestra di caricamento.
  const [hasPassword, setHasPassword] = useState<boolean | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const ok = browserSupportsWebAuthn() && (await platformAuthenticatorIsAvailable().catch(() => false))
      if (!alive) return
      setSupported(ok)
      setLockOn(isAppLockEnabled())
      setBioOn(isBiometricEnabled())
      setTimeoutState(getTimeoutMin())
      try {
        const { data } = await createClient().auth.getUser()
        const ids = data.user?.identities
        if (alive) setHasPassword(!ids || ids.length === 0 || ids.some((i) => i.provider === 'email'))
      } catch { /* teniamo il default true */ }
      const res = await listMyPasskeysAction()
      if (alive) setPasskeys(res.passkeys)
    })()
    return () => { alive = false }
  }, [])

  function enableLock() {
    setAppLockEnabled(true)
    setLockOn(true)
    setBiometricPrompted() // non ri-chiedere col prompt post-login
    toast.success('Blocco attivato: al rientro l’app chiederà l’accesso.', { closeButton: true })
  }

  async function disableLock() {
    setBusy(true)
    try {
      // Spegnere il blocco rende inutile l'impronta → rimuovi anche le passkey.
      // ⚠️ Gli esiti si LEGGONO (audit 17 ago): prima un {error} veniva
      // ignorato — i flag locali si azzeravano, il toast diceva «disattivato»,
      // ma le righe restavano sul server come dispositivi fantasma. Il blocco
      // locale si spegne comunque (è la volontà dell'utente), ma se qualche
      // impronta non si è tolta dal server lo si dice.
      let falliti = 0
      for (const p of passkeys) {
        try {
          const res = await deletePasskeyAction(p.id)
          if (res?.error) falliti += 1
        } catch { falliti += 1 }
      }
      setBiometricEnabled(false)
      setAppLockEnabled(false)
      setBioOn(false)
      setLockOn(false)
      if (falliti === 0) {
        setPasskeys([])
        toast.success('Blocco disattivato.', { closeButton: true })
      } else {
        const list = await listMyPasskeysAction().catch(() => ({ passkeys }))
        setPasskeys(list.passkeys)
        toast.error('Blocco disattivato, ma un’impronta non si è tolta dal server: riprova a rimuoverla dall’elenco.', { closeButton: true })
      }
    } finally {
      setBusy(false)
    }
  }

  async function addBiometric() {
    setBusy(true)
    try {
      const res = await registerPasskey(guessDeviceLabel())
      if (!res.ok) { toast.error(res.error ?? 'Registrazione non riuscita. Riprova.'); return }
      setBiometricEnabled(true) // attiva anche il blocco
      // Lega l'impronta all'utente per cui è stata registrata: se un domani su
      // questo dispositivo entrasse un altro account, AppLock capirà che questa
      // passkey non vale per lui e non intrappolerà nel lucchetto.
      try {
        const { data } = await createClient().auth.getUser()
        if (data.user?.id) setBiometricUid(data.user.id)
      } catch { /* best effort: senza uid resta la via d'uscita a runtime */ }
      setBioOn(true)
      setLockOn(true)
      const list = await listMyPasskeysAction()
      setPasskeys(list.passkeys)
      toast.success('Sblocco con impronta aggiunto su questo dispositivo.', { closeButton: true })
    } catch {
      toast.info('Registrazione annullata.')
    } finally {
      setBusy(false)
    }
  }

  async function removeBiometric(id: string) {
    const res = await deletePasskeyAction(id)
    if (res?.error) { toast.error(res.error); return }
    const next = passkeys.filter((p) => p.id !== id)
    setPasskeys(next)
    if (next.length === 0) {
      setBiometricEnabled(false)
      setBioOn(false)
      // Account Google (senza password): tolta l'ultima impronta NON resta alcun
      // modo di sbloccare → spegniamo anche il blocco, altrimenti alla prossima
      // riapertura l'unica uscita sarebbe il logout.
      // ⚠️ `hasPassword !== true`, non `=== false`: se getUser non ha ancora
      // risolto (null) e l'utente fa in tempo a rimuovere l'ultima impronta,
      // nel dubbio si va nella direzione SICURA — blocco spento, mai un blocco
      // senza alcun modo di sbloccare (audit 17 ago).
      if (hasPassword !== true) { setAppLockEnabled(false); setLockOn(false) }
    }
    toast.success(
      hasPassword !== true && next.length === 0 ? TOAST_RIMOSSA_BLOCCO_SPENTO : TOAST_RIMOSSA_RESTA_PW,
      { closeButton: true }
    )
  }

  function changeTimeout(min: number) {
    setTimeoutMin(min)
    setTimeoutState(min)
  }

  const card: React.CSSProperties = { background: '#fff', borderRadius: 14, boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)', padding: '15px 16px' }

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
        <Lock size={17} style={{ color: '#c9a44c' }} />
        <span style={{ fontSize: 15, fontWeight: 700, color: '#161616' }}>Blocca l&rsquo;app quando esco</span>
      </div>
      <p style={{ fontSize: 13, color: 'var(--cc-muted)', lineHeight: 1.55, margin: '0 0 12px' }}>
        {hasPassword === false ? DESC_SOLO_IMPRONTA : DESC_STANDARD}
      </p>

      {!lockOn && hasPassword === true && (
        <button
          type="button"
          onClick={enableLock}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', minHeight: 46, borderRadius: 11, border: 'none', background: '#1a1a2e', color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}
        >
          <Lock size={16} /> Attiva il blocco
        </button>
      )}

      {/* Account Google (senza password): il blocco si attiva SOLO aggiungendo l'impronta. */}
      {!lockOn && hasPassword === false && supported && (
        <button
          type="button"
          onClick={addBiometric}
          disabled={busy}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', minHeight: 46, borderRadius: 11, border: 'none', background: '#1a1a2e', color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: busy ? 'wait' : 'pointer' }}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Fingerprint size={16} />}
          Aggiungi l&rsquo;impronta e blocca
        </button>
      )}
      {!lockOn && hasPassword === false && supported === false && (
        <p style={{ fontSize: 12.5, color: 'var(--cc-muted)', margin: 0, lineHeight: 1.5 }}>
          Il blocco non è disponibile: il tuo account accede con Google (senza password) e questo
          dispositivo non supporta l&rsquo;impronta.
        </p>
      )}

      {lockOn && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, color: '#2f8a63', marginBottom: 12 }}>
            <ShieldCheck size={16} /> Blocco attivo
          </div>

          <div style={{ fontSize: 13, fontWeight: 600, color: '#161616', marginBottom: 7 }}>Chiedi l&rsquo;accesso</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 14 }}>
            {TIMEOUT_OPTIONS.map((o) => {
              const on = timeout === o.value
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => changeTimeout(o.value)}
                  style={{ padding: '7px 12px', borderRadius: 999, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', border: on ? '1px solid #1a1a2e' : '1px solid #e3e3e6', background: on ? '#1a1a2e' : '#fff', color: on ? '#fff' : '#161616' }}
                >
                  {o.label}
                </button>
              )
            })}
          </div>

          {/* Sblocco con impronta — opzionale, in aggiunta alla password */}
          <div style={{ borderTop: '1px solid #eee', paddingTop: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, color: '#161616', marginBottom: 4 }}>
              <Fingerprint size={15} style={{ color: '#c9a44c' }} /> Sblocco con impronta
            </div>
            {supported === false && (
              <p style={{ fontSize: 12.5, color: 'var(--cc-muted)', margin: 0 }}>
                Non disponibile su questo dispositivo. Resta lo sblocco con password.
              </p>
            )}
            {supported && !bioOn && (
              <button
                type="button"
                onClick={addBiometric}
                disabled={busy}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', minHeight: 42, borderRadius: 11, border: '1px solid #e3e3e6', background: '#fff', color: '#1a1a2e', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: busy ? 'wait' : 'pointer', marginTop: 6 }}
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Fingerprint size={16} />}
                Aggiungi l&rsquo;impronta su questo dispositivo
              </button>
            )}
            {supported && bioOn && passkeys.map((p) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 0' }}>
                <span style={{ fontSize: 13, color: '#2f8a63', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShieldCheck size={15} /> {p.device_label ?? 'Dispositivo'}
                </span>
                <button type="button" onClick={() => removeBiometric(p.id)} aria-label="Rimuovi impronta" style={{ border: 'none', background: 'transparent', color: '#b05656', cursor: 'pointer', display: 'flex', padding: 4 }}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={disableLock}
            disabled={busy}
            style={{ width: '100%', minHeight: 42, borderRadius: 11, border: '1px solid #e3e3e6', background: '#fff', color: '#b05656', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: busy ? 'wait' : 'pointer' }}
          >
            {busy ? 'Attendere…' : 'Disattiva il blocco'}
          </button>
        </>
      )}
    </div>
  )
}
