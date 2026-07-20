// ============================================================
// Stato LOCALE dello sblocco con impronta (per-dispositivo).
// La passkey vive sul telefono e sul nostro server; qui teniamo solo le
// preferenze del dispositivo: se è attivo, ogni quanto richiedere l'impronta,
// e quando è stata l'ultima attività. Nessun dato sensibile.
// Usato solo da componenti client (guardie typeof window per sicurezza).
// ============================================================

const K_ENABLED = 'cc_biometric'
const K_TIMEOUT = 'cc_biometric_timeout'
const K_ACTIVE = 'cc_biometric_active'

// Minuti dopo i quali riscattare l'impronta. 0 = ad ogni apertura.
export const TIMEOUT_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'Ad ogni apertura' },
  { value: 15, label: 'Dopo 15 minuti' },
  { value: 60, label: 'Dopo 1 ora' },
  { value: 1440, label: 'Dopo un giorno' },
]
export const DEFAULT_TIMEOUT = 15

export function isBiometricEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try { return localStorage.getItem(K_ENABLED) === '1' } catch { return false }
}

export function setBiometricEnabled(on: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (on) { localStorage.setItem(K_ENABLED, '1'); markActive() }
    else { localStorage.removeItem(K_ENABLED) }
  } catch { /* storage bloccato */ }
}

export function getTimeoutMin(): number {
  if (typeof window === 'undefined') return DEFAULT_TIMEOUT
  try {
    const raw = localStorage.getItem(K_TIMEOUT)
    if (raw == null) return DEFAULT_TIMEOUT
    const n = Number(raw)
    return TIMEOUT_OPTIONS.some((o) => o.value === n) ? n : DEFAULT_TIMEOUT
  } catch { return DEFAULT_TIMEOUT }
}

export function setTimeoutMin(min: number): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(K_TIMEOUT, String(min)) } catch { /* storage bloccato */ }
}

export function markActive(): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(K_ACTIVE, String(Date.now())) } catch { /* storage bloccato */ }
}

export function lastActive(): number {
  if (typeof window === 'undefined') return 0
  try { return Number(localStorage.getItem(K_ACTIVE) ?? 0) || 0 } catch { return 0 }
}
