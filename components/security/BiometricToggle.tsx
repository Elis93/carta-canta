'use client'

// ============================================================
// BiometricToggle — card "Sblocco con impronta" in Impostazioni › Generale.
// Attiva la registrazione della passkey (impronta/Face ID) su QUESTO
// dispositivo, sceglie ogni quanto richiederla, ed elenca i dispositivi
// registrati con la possibilità di rimuoverli. La password resta la riserva.
// ============================================================

import { useEffect, useState } from 'react'
import {
  startRegistration,
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
} from '@simplewebauthn/browser'
import { Fingerprint, Loader2, Trash2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { listMyPasskeysAction, deletePasskeyAction, type PasskeyInfo } from '@/lib/actions/passkeys'
import {
  isBiometricEnabled, setBiometricEnabled, getTimeoutMin, setTimeoutMin,
  TIMEOUT_OPTIONS,
} from '@/lib/biometric/local'

export function BiometricToggle() {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [timeout, setTimeoutState] = useState(getTimeoutMin())
  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const ok = browserSupportsWebAuthn() && (await platformAuthenticatorIsAvailable().catch(() => false))
      if (!alive) return
      setSupported(ok)
      setEnabled(isBiometricEnabled())
      setTimeoutState(getTimeoutMin())
      const res = await listMyPasskeysAction()
      if (alive) setPasskeys(res.passkeys)
    })()
    return () => { alive = false }
  }, [])

  async function enable() {
    setBusy(true)
    try {
      const optRes = await fetch('/api/passkey/register/options', { method: 'POST' })
      if (!optRes.ok) { toast.error('Non riesco ad avviare la registrazione. Riprova.'); return }
      const options = await optRes.json()
      const reg = await startRegistration({ optionsJSON: options })
      const verRes = await fetch('/api/passkey/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: reg, deviceLabel: guessDeviceLabel() }),
      })
      if (!verRes.ok) {
        const j = await verRes.json().catch(() => ({}))
        toast.error(j.error ?? 'Registrazione non riuscita. Riprova.')
        return
      }
      setBiometricEnabled(true)
      setEnabled(true)
      const res = await listMyPasskeysAction()
      setPasskeys(res.passkeys)
      toast.success('Sblocco con impronta attivato su questo dispositivo.', { closeButton: true })
    } catch {
      // Annullato dall'utente o non supportato
      toast.info('Registrazione annullata.')
    } finally {
      setBusy(false)
    }
  }

  async function disableAll() {
    setBusy(true)
    try {
      // Rimuove le passkey di QUESTO account (tutte: l'MVP non distingue i
      // singoli dispositivi in fase di registrazione).
      for (const p of passkeys) {
        await deletePasskeyAction(p.id)
      }
      setBiometricEnabled(false)
      setEnabled(false)
      setPasskeys([])
      toast.success('Sblocco con impronta disattivato.', { closeButton: true })
    } finally {
      setBusy(false)
    }
  }

  async function removeOne(id: string) {
    const res = await deletePasskeyAction(id)
    if (res?.error) { toast.error(res.error); return }
    const next = passkeys.filter((p) => p.id !== id)
    setPasskeys(next)
    if (next.length === 0) { setBiometricEnabled(false); setEnabled(false) }
    toast.success('Dispositivo rimosso.', { closeButton: true })
  }

  function changeTimeout(min: number) {
    setTimeoutMin(min)
    setTimeoutState(min)
  }

  const card: React.CSSProperties = { background: '#fff', borderRadius: 14, boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)', padding: '15px 16px' }

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
        <Fingerprint size={18} style={{ color: '#c9a44c' }} />
        <span style={{ fontSize: 15, fontWeight: 700, color: '#161616' }}>Sblocco con impronta</span>
      </div>
      <p style={{ fontSize: 13, color: 'var(--cc-muted)', lineHeight: 1.55, margin: '0 0 12px' }}>
        Entra nell&rsquo;app con l&rsquo;impronta o il volto invece della password. L&rsquo;impronta
        resta sul tuo telefono, non arriva a noi. La password resta come riserva.
      </p>

      {supported === false && (
        <p style={{ fontSize: 13, color: '#8a6c33', background: '#faf7f0', border: '1px solid #eee3cc', borderRadius: 10, padding: '9px 12px', margin: 0 }}>
          Questo dispositivo non permette lo sblocco con impronta per le app web. Provalo dal tuo telefono.
        </p>
      )}

      {supported && !enabled && (
        <button
          type="button"
          onClick={enable}
          disabled={busy}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', minHeight: 46, borderRadius: 11, border: 'none', background: '#1a1a2e', color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: busy ? 'wait' : 'pointer' }}
        >
          {busy ? <Loader2 size={17} className="animate-spin" /> : <Fingerprint size={17} />}
          Attiva su questo dispositivo
        </button>
      )}

      {supported && enabled && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, color: '#2f8a63', marginBottom: 12 }}>
            <ShieldCheck size={16} /> Attivo su questo dispositivo
          </div>

          <div style={{ fontSize: 13, fontWeight: 600, color: '#161616', marginBottom: 7 }}>Chiedi l&rsquo;impronta</div>
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

          {passkeys.length > 0 && (
            <div style={{ borderTop: '1px solid #eee', paddingTop: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--cc-muted)', marginBottom: 8 }}>Dispositivi registrati</div>
              {passkeys.map((p) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 0' }}>
                  <span style={{ fontSize: 13, color: '#161616' }}>{p.device_label ?? 'Dispositivo'}</span>
                  <button type="button" onClick={() => removeOne(p.id)} aria-label="Rimuovi dispositivo" style={{ border: 'none', background: 'transparent', color: '#b05656', cursor: 'pointer', display: 'flex', padding: 4 }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={disableAll}
            disabled={busy}
            style={{ width: '100%', minHeight: 42, borderRadius: 11, border: '1px solid #e3e3e6', background: '#fff', color: '#b05656', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: busy ? 'wait' : 'pointer' }}
          >
            {busy ? 'Attendere…' : 'Disattiva lo sblocco con impronta'}
          </button>
        </>
      )}
    </div>
  )
}

function guessDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Questo dispositivo'
  const ua = navigator.userAgent
  if (/iPhone/i.test(ua)) return 'iPhone'
  if (/iPad/i.test(ua)) return 'iPad'
  if (/Android/i.test(ua)) return 'Telefono Android'
  if (/Windows/i.test(ua)) return 'PC Windows'
  if (/Mac/i.test(ua)) return 'Mac'
  return 'Questo dispositivo'
}
