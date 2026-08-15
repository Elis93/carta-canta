// ============================================================
// Stato LOCALE dello sblocco con impronta (per-dispositivo).
// La passkey vive sul telefono e sul nostro server; qui teniamo solo le
// preferenze del dispositivo: se è attivo, ogni quanto richiedere l'impronta,
// e quando è stata l'ultima attività. Nessun dato sensibile.
// Usato solo da componenti client (guardie typeof window per sicurezza).
// ============================================================

const K_ENABLED = 'cc_biometric'   // impronta registrata su questo dispositivo
const K_LOCK = 'cc_lock'           // "blocca l'app all'uscita" (vale anche senza impronta)
const K_TIMEOUT = 'cc_biometric_timeout'
const K_ACTIVE = 'cc_biometric_active'
const K_PROMPTED = 'cc_biometric_prompted'
const K_UID = 'cc_biometric_uid'   // id dell'utente per cui l'impronta è stata registrata

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
    if (on) {
      localStorage.setItem(K_ENABLED, '1')
      localStorage.setItem(K_LOCK, '1') // attivare l'impronta implica bloccare l'app
      markActive()
    } else {
      localStorage.removeItem(K_ENABLED) // toglie l'impronta; il blocco resta se attivo (sblocco con password)
      localStorage.removeItem(K_UID)     // l'impronta non è più legata a nessun utente
    }
  } catch { /* storage bloccato */ }
}

// "Blocca l'app quando esco": vale ANCHE senza impronta (sblocco con password).
// È l'interruttore master che decide se AppLock si attiva.
// Retrocompatibilità: le build precedenti scrivevano SOLO cc_biometric (il lock
// era implicito nell'impronta) → chi ha l'impronta attiva è considerato bloccato
// anche senza cc_lock, altrimenti al deploy perderebbe il blocco in silenzio.
export function isAppLockEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(K_LOCK) === '1' || localStorage.getItem(K_ENABLED) === '1'
  } catch { return false }
}

export function setAppLockEnabled(on: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (on) { localStorage.setItem(K_LOCK, '1'); markActive() }
    else { localStorage.removeItem(K_LOCK) }
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

// ⚠️ L'impronta (passkey) è registrata sul SERVER contro un utente preciso. Se
// su questo dispositivo si cambia account — o si cancella e ricrea l'account —
// il flag locale «impronta attiva» sopravvive ma la passkey non vale più per il
// nuovo utente: il lucchetto apparirebbe e non si sbloccherebbe mai (loop
// segnalato da Eli, 15 ago). Leghiamo quindi il flag all'id dell'utente: se non
// combacia, AppLock sa che l'impronta è stantia e toglie il blocco invece di
// intrappolare. I flag legacy (senza uid) restano gestiti dalla via d'uscita a
// runtime nel lucchetto.
export function setBiometricUid(uid: string): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(K_UID, uid) } catch { /* storage bloccato */ }
}

export function getBiometricUid(): string | null {
  if (typeof window === 'undefined') return null
  try { return localStorage.getItem(K_UID) } catch { return null }
}

// La richiesta post-login "vuoi attivare lo sblocco?" si mostra una volta sola
// per dispositivo: sia "Sì" sia "Più tardi" segnano questo flag.
export function wasBiometricPrompted(): boolean {
  if (typeof window === 'undefined') return true
  try { return localStorage.getItem(K_PROMPTED) === '1' } catch { return true }
}

export function setBiometricPrompted(): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(K_PROMPTED, '1') } catch { /* storage bloccato */ }
}
