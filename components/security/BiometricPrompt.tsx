'use client'

// ============================================================
// BiometricPrompt — richiesta post-login "Vuoi attivare lo sblocco con
// impronta?". Compare UNA volta per dispositivo (subito dopo il primo login),
// solo se il telefono supporta l'impronta e lo sblocco non è già attivo, così
// l'utente non deve cercarlo nelle Impostazioni. "Più tardi" rimanda là.
// ============================================================

import { useEffect, useState } from 'react'
import { browserSupportsWebAuthn, platformAuthenticatorIsAvailable } from '@simplewebauthn/browser'
import { Fingerprint, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { registerPasskey, guessDeviceLabel } from '@/lib/biometric/register'
import { isBiometricEnabled, setBiometricEnabled, wasBiometricPrompted, setBiometricPrompted } from '@/lib/biometric/local'

export function BiometricPrompt() {
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (wasBiometricPrompted() || isBiometricEnabled()) return
    let alive = true
    ;(async () => {
      const ok = browserSupportsWebAuthn() && (await platformAuthenticatorIsAvailable().catch(() => false))
      // Piccolo ritardo: l'app si mostra prima, poi la richiesta sale dal basso.
      // Non sovrapporsi al tutorial di benvenuto (driver.js): se è attivo,
      // salta per stavolta — ricomparirà alla prossima apertura.
      if (ok && alive) setTimeout(() => {
        if (alive && !document.body.classList.contains('driver-active')) setVisible(true)
      }, 900)
    })()
    return () => { alive = false }
  }, [])

  async function activate() {
    setBusy(true)
    try {
      const res = await registerPasskey(guessDeviceLabel())
      if (!res.ok) { toast.error(res.error ?? 'Registrazione non riuscita. Riprova.'); return }
      setBiometricEnabled(true)
      setBiometricPrompted()
      setVisible(false)
      toast.success('Fatto! La prossima volta entri con l’impronta.', { closeButton: true })
    } catch {
      // Annullato dall'utente al prompt del sistema
      toast.info('Nessun problema: puoi attivarlo quando vuoi da Impostazioni › Generale.')
    } finally {
      setBusy(false)
    }
  }

  function later() {
    setBiometricPrompted()
    setVisible(false)
    toast.info('Puoi attivarlo quando vuoi da Impostazioni › Generale.', { closeButton: true })
  }

  if (!visible) return null

  return (
    <div
      className="cc-zoom-neutral"
      style={{ position: 'fixed', inset: 0, zIndex: 90000, background: 'rgba(20,20,40,.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={later}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Attiva lo sblocco con impronta"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 460, background: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
          padding: '22px 20px calc(22px + env(safe-area-inset-bottom))', boxShadow: '0 -8px 40px -12px rgba(20,20,40,.4)',
        }}
      >
        <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(201,164,76,.15)', border: '1px solid rgba(201,164,76,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <Fingerprint size={30} style={{ color: '#c9a44c' }} />
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#161616', textAlign: 'center', marginBottom: 8 }}>
          Vuoi entrare con l&rsquo;impronta?
        </div>
        <p style={{ fontSize: 14, color: 'var(--cc-muted)', lineHeight: 1.55, textAlign: 'center', margin: '0 0 20px' }}>
          La prossima volta apri l&rsquo;app con l&rsquo;impronta o il volto, senza riscrivere la
          password. L&rsquo;impronta resta sul tuo telefono e la password resta come riserva.
        </p>

        <button
          type="button"
          onClick={activate}
          disabled={busy}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', minHeight: 50, borderRadius: 12, border: 'none', background: '#1a1a2e', color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', cursor: busy ? 'wait' : 'pointer' }}
        >
          {busy ? <Loader2 size={18} className="animate-spin" /> : <Fingerprint size={18} />}
          Sì, attiva
        </button>
        <button
          type="button"
          onClick={later}
          disabled={busy}
          style={{ width: '100%', minHeight: 44, marginTop: 10, borderRadius: 12, border: 'none', background: 'transparent', color: 'var(--cc-muted)', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}
        >
          Più tardi
        </button>
      </div>
    </div>
  )
}
