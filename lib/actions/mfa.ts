'use server'

// ============================================================
// Verifica in due passaggi (2FA / TOTP) + codici di recupero.
//
// Decisione di Eli (15 ago): TOTP (app Authenticator) con CODICI DI RECUPERO,
// proposta al passaggio a Pro. Solo artigiani.
//
// ⚠️ PREREQUISITI MANUALI prima che funzioni in produzione:
//  1. Migration 084 applicata (tabella mfa_recovery_codes).
//  2. MFA/TOTP ABILITATO nel progetto Supabase (Auth → Multi-Factor). Senza,
//     `enroll` fallisce e l'attivazione mostra un errore chiaro.
//
// I codici di recupero sono la rete anti-lockout: se l'utente perde il telefono
// con l'app Authenticator, un codice di recupero DISATTIVA il 2FA (rimuovendo il
// fattore) così può rientrare, e poi lo riconfigura. Per rimuovere il fattore
// mentre l'utente è ancora a AAL1 (non ha potuto fare il TOTP) serve l'API
// ADMIN (`auth.admin.mfa.deleteFactor`), che non richiede AAL2.
//
// ⚠️ LIMITE NOTO — enforcement solo a livello di PAGINA (ricontrollo 15 ago).
// L'obbligo AAL2 vive solo nel layout `(app)` (redirect a /mfa). Le SERVER
// ACTION e le API route autenticate NON controllano l'AAL: un attaccante con la
// SOLA password di un account 2FA (sessione aal1) è bloccato dall'interfaccia ma
// potrebbe invocare direttamente le action/route e leggere/scrivere i dati. È il
// limite noto di Supabase MFA. Chiuderlo per davvero richiede un controllo
// `currentLevel==='aal2'` nel middleware per i path `(app)` (copre anche i POST
// delle server action) — un cambio SICUREZZA-critico al proxy, da fare in un
// giro dedicato prima di considerare il 2FA una barriera dura. Oggi il 2FA alza
// comunque l'asticella per l'accesso all'app, e il fail-open non chiude fuori
// nessuno.
// ============================================================

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateRecoveryCodes, hashRecoveryCode } from '@/lib/mfa/recovery-codes'
import { logSecurityEvent } from '@/lib/security/events'
import { getLoginFailureCount, recordLoginFailure } from '@/lib/auth-rate-limit'

/** Traduce gli errori tecnici dell'MFA in messaggi per l'artigiano. */
function mapMfaError(msg: string | undefined): string {
  const m = (msg ?? '').toLowerCase()
  if (m.includes('not enabled') || m.includes('disabled') || m.includes('unsupported')) {
    return 'La verifica in due passaggi non è ancora attiva sul server. Riprova più tardi.'
  }
  if (m.includes('already') || m.includes('exists')) {
    return 'Hai già la verifica in due passaggi attiva.'
  }
  return 'Qualcosa è andato storto. Riprova.'
}

export async function getMfaStatus(): Promise<{ enabled: boolean; remainingCodes: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { enabled: false, remainingCodes: 0 }

  const { data } = await supabase.auth.mfa.listFactors()
  const enabled = (data?.totp ?? []).some((f) => f.status === 'verified')
  if (!enabled) return { enabled: false, remainingCodes: 0 }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 084 non in types/database.ts
  const admin = createAdminClient() as any
  const { count } = await admin
    .from('mfa_recovery_codes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('used_at', null)
  return { enabled: true, remainingCodes: count ?? 0 }
}

/** Passo 1 dell'attivazione: crea il fattore TOTP e torna QR + segreto. */
export async function startTotpEnroll(): Promise<{ error?: string; factorId?: string; qrCode?: string; secret?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }

  const { data: factors } = await supabase.auth.mfa.listFactors()
  // Già attiva? Non ri-attivare.
  if ((factors?.totp ?? []).some((f) => f.status === 'verified')) {
    return { error: 'Hai già la verifica in due passaggi attiva.' }
  }
  // Ripulisci eventuali fattori NON verificati rimasti da un tentativo a metà.
  for (const f of factors?.all ?? []) {
    if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id })
  }

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
  if (error || !data) return { error: mapMfaError(error?.message) }
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret }
}

/** Passo 2: verifica il codice a 6 cifre e genera i codici di recupero (mostrati una volta). */
export async function confirmTotpEnroll(factorId: string, code: string): Promise<{ error?: string; recoveryCodes?: string[] }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }

  const cleaned = (code ?? '').replace(/\D/g, '')
  if (cleaned.length !== 6) return { error: 'Inserisci il codice a 6 cifre dell’app.' }

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: cleaned })
  if (error) return { error: 'Codice non valido. Controlla l’ora del telefono e riprova.' }

  // Genera e salva le IMPRONTE dei codici di recupero (i codici in chiaro
  // tornano al client una volta sola). Sostituisce eventuali codici vecchi.
  const codes = generateRecoveryCodes(10)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 084
  const admin = createAdminClient() as any
  await admin.from('mfa_recovery_codes').delete().eq('user_id', user.id)
  const { error: insErr } = await admin
    .from('mfa_recovery_codes')
    .insert(codes.map((c) => ({ user_id: user.id, code_hash: hashRecoveryCode(c) })))
  if (insErr) {
    // ⚠️ ATTIVAZIONE ATOMICA (ricontrollo 15 ago): challengeAndVerify ha già
    // reso VERIFICATO il fattore (2FA acceso sul server). Se i codici non si
    // salvano e lasciassimo il fattore attivo, l'utente resterebbe con 2FA ON e
    // ZERO codici di recupero → lockout se perde il telefono. Rollback: togliamo
    // il fattore, così è «tutto o niente» (TOTP + codici, oppure niente).
    try {
      const { data: factors } = await admin.auth.admin.mfa.listFactors({ userId: user.id })
      for (const f of factors?.factors ?? []) {
        await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId: user.id })
      }
    } catch { /* best effort: se il rollback fallisce, l'utente può disattivare da capo */ }
    return { error: 'Non riesco a salvare i codici di recupero: la verifica non è stata attivata. Riprova.' }
  }
  return { recoveryCodes: codes }
}

/** Rigenera i codici di recupero (serve aver completato la verifica in questa sessione). */
export async function regenerateRecoveryCodes(): Promise<{ error?: string; recoveryCodes?: string[] }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (aal?.currentLevel !== 'aal2') {
    return { error: 'Per rigenerare i codici completa prima la verifica in due passaggi.' }
  }
  const codes = generateRecoveryCodes(10)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 084
  const admin = createAdminClient() as any
  await admin.from('mfa_recovery_codes').delete().eq('user_id', user.id)
  const { error: insErr } = await admin
    .from('mfa_recovery_codes')
    .insert(codes.map((c) => ({ user_id: user.id, code_hash: hashRecoveryCode(c) })))
  // ⚠️ Se l'insert fallisce dopo il delete, l'utente resta SENZA codici validi
  // (i vecchi cancellati, i nuovi mai salvati): non gli restituiamo codici che
  // non esistono nel DB — glielo diciamo, i vecchi non valgono più ma il 2FA è
  // ancora attivo (può ritentare la rigenerazione).
  if (insErr) return { error: 'Non riesco a rigenerare i codici di recupero. Riprova.' }
  return { recoveryCodes: codes }
}

/** Disattiva il 2FA (richiede la verifica completata in questa sessione). */
export async function disableTotp(): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (aal?.currentLevel !== 'aal2') {
    return { error: 'Per disattivare la verifica in due passaggi devi prima completarla.' }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- API admin MFA
  const admin = createAdminClient() as any
  const { data: factors } = await admin.auth.admin.mfa.listFactors({ userId: user.id })
  for (const f of factors?.factors ?? []) {
    await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId: user.id })
  }
  await admin.from('mfa_recovery_codes').delete().eq('user_id', user.id)
  return { success: true }
}

/**
 * Usa un codice di recupero durante il login (sessione a AAL1, TOTP non
 * disponibile). Se valido: lo marca usato e RIMUOVE i fattori con l'API admin
 * (che non richiede AAL2) → il 2FA si disattiva, la sessione esce dallo stato
 * «in attesa di verifica» e l'utente rientra. Dovrà riconfigurarlo.
 */
export async function useRecoveryCode(code: string): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }

  // Freno sui tentativi (audit 17 ago): 40 bit rendono il brute force
  // infattibile, ma senza limite i tentativi falliti non avevano né freno né
  // traccia. Stesso contatore del login (finestra 15 min per IP).
  if ((await getLoginFailureCount()) >= 10) {
    return { error: 'Troppi tentativi: aspetta qualche minuto e riprova.' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 084 + API admin MFA
  const admin = createAdminClient() as any
  const hash = hashRecoveryCode(code)
  const { data: match } = await admin
    .from('mfa_recovery_codes')
    .select('id')
    .eq('user_id', user.id)
    .eq('code_hash', hash)
    .is('used_at', null)
    .maybeSingle()
  if (!match) {
    await recordLoginFailure()
    return { error: 'Codice di recupero non valido o già usato.' }
  }

  await admin.from('mfa_recovery_codes').update({ used_at: new Date().toISOString() }).eq('id', match.id)
  // Disattiva il 2FA: rimuovi i fattori (admin → funziona a AAL1).
  const { data: factors } = await admin.auth.admin.mfa.listFactors({ userId: user.id })
  for (const f of factors?.factors ?? []) {
    await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId: user.id })
  }
  // I codici restanti non servono più (2FA off; la riconfigurazione ne farà di nuovi).
  await admin.from('mfa_recovery_codes').delete().eq('user_id', user.id)
  // Traccia di sicurezza (ricontrollo 15 ago): usare un codice di recupero
  // DISATTIVA il 2FA a AAL1 — è un evento rilevante (se non sei stato tu, qualcuno
  // con la tua password è entrato aggirando il secondo fattore). Best-effort.
  await logSecurityEvent({ kind: 'mfa_recovery_used', userId: user.id })
  return { success: true }
}
