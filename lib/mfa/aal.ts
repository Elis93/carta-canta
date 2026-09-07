// ============================================================
// Verifica in due passaggi — decisione «va chiesto il codice?»
//
// PURO (niente Supabase, niente rete): testabile.
//
// Perché esiste (7 set 2026, collaudo di Eli): dopo «Esci» e un nuovo login
// il codice NON veniva chiesto. Il cancello si fidava di
// `supabase.auth.mfa.getAuthenticatorAssuranceLevel()`, che senza JWT esplicito
// legge i fattori dalla SESSIONE SALVATA NEI COOKIE (`session.user.factors`):
// se in quella copia i fattori mancano o sono stantii, `nextLevel` resta
// `aal1` e il 2FA non viene mai imposto — è la issue #589 di supabase/auth-js
// («Verified MFA doesn't set AAL to aal2»), esattamente il sintomo visto.
//
// Da qui in poi la decisione si prende su DUE dati freschi e indipendenti:
//   · i fattori dell'utente letti dal server (`getUser()` → `/user`, che
//     GoTrue carica con le associazioni: è la stessa fonte che auth-js usa
//     nel ramo «jwt» di getAuthenticatorAssuranceLevel);
//   · il claim `aal` del token di accesso CORRENTE (sta nel JWT, non nella
//     copia dell'utente: è quello che dice se in QUESTA sessione il codice è
//     già stato dato).
// Regola: fattore TOTP verificato + token non a `aal2` → si chiede il codice.
// FAIL-OPEN conservato: dato mancante o illeggibile → non si blocca nessuno
// (un bug qui non deve chiudere fuori dall'app; al massimo il 2FA non viene
// imposto, come prima).
// ============================================================

export type Aal = 'aal1' | 'aal2'

/** Il minimo che ci serve di un fattore MFA (forma di `User.factors`). */
export type FattoreMinimo = { factor_type?: string | null; status?: string | null }

/** true se fra i fattori c'è almeno un TOTP VERIFICATO (uno in corso di
 *  attivazione, `unverified`, non conta: l'utente non ha ancora dato il codice). */
export function haTotpVerificato(factors: readonly FattoreMinimo[] | null | undefined): boolean {
  if (!Array.isArray(factors)) return false
  return factors.some((f) => f && f.factor_type === 'totp' && f.status === 'verified')
}

/** Legge il claim `aal` dal payload di un JWT SENZA verificarne la firma.
 *  Va bene qui perché non decide chi è l'utente (lo fa `getUser()`, verificato
 *  dal server): serve solo a sapere se il codice è già stato dato in questa
 *  sessione. Qualsiasi cosa non leggibile → null (fail-open a valle). */
export function aalDalToken(accessToken: string | null | undefined): Aal | null {
  if (!accessToken || typeof accessToken !== 'string') return null
  const parti = accessToken.split('.')
  if (parti.length < 2) return null
  try {
    const b64 = parti[1].replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const json =
      typeof atob === 'function'
        ? decodeURIComponent(
            Array.from(atob(pad), (c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''),
          )
        : Buffer.from(pad, 'base64').toString('utf8')
    const payload = JSON.parse(json) as { aal?: unknown }
    return payload.aal === 'aal1' || payload.aal === 'aal2' ? payload.aal : null
  } catch {
    return null
  }
}

/** La decisione: va mostrata la schermata del codice?
 *  · nessun TOTP verificato → no (2FA non attivo, o attivazione a metà)
 *  · token già `aal2` → no (codice già dato in questa sessione)
 *  · token `aal1` → SÌ
 *  · claim illeggibile → no (fail-open, dichiarato). */
export function mfaDaChiedere(input: {
  factors: readonly FattoreMinimo[] | null | undefined
  aal: Aal | null
}): boolean {
  if (!haTotpVerificato(input.factors)) return false
  return input.aal === 'aal1'
}
