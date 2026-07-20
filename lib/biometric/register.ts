// ============================================================
// Registrazione passkey (sblocco con impronta) — logica condivisa tra la card
// in Impostazioni e la richiesta post-login. Chiama le API register/*; la
// cerimonia WebAuthn (startRegistration) può lanciare se l'utente annulla:
// il chiamante racchiude in try/catch.
// ============================================================

import { startRegistration } from '@simplewebauthn/browser'

export async function registerPasskey(deviceLabel: string): Promise<{ ok: boolean; error?: string }> {
  const optRes = await fetch('/api/passkey/register/options', { method: 'POST' })
  if (!optRes.ok) return { ok: false, error: 'Non riesco ad avviare la registrazione. Riprova.' }
  const options = await optRes.json()
  const reg = await startRegistration({ optionsJSON: options })
  const verRes = await fetch('/api/passkey/register/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ response: reg, deviceLabel }),
  })
  if (!verRes.ok) {
    const j = await verRes.json().catch(() => ({}))
    return { ok: false, error: j.error ?? 'Registrazione non riuscita. Riprova.' }
  }
  return { ok: true }
}

export function guessDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Questo dispositivo'
  const ua = navigator.userAgent
  if (/iPhone/i.test(ua)) return 'iPhone'
  if (/iPad/i.test(ua)) return 'iPad'
  if (/Android/i.test(ua)) return 'Telefono Android'
  if (/Windows/i.test(ua)) return 'PC Windows'
  if (/Mac/i.test(ua)) return 'Mac'
  return 'Questo dispositivo'
}
