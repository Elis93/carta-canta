'use server'

// ============================================================
// Sblocco con password del blocco app (AppLock) — LATO SERVER.
//
// Perché esiste (audit auth 17 ago, due finding in uno):
//
// 1) [ALTA] AppLock chiamava `signInWithPassword` dal client del BROWSER: il
//    client SSR condivide i cookie di sessione col server, quindi lo sblocco
//    SOSTITUIVA la sessione con una nuova, nata aal1. Un account con 2FA
//    veniva rimandato a /mfa alla prima navigazione dopo lo sblocco — il
//    codice TOTP «chiesto a caso» che confonde. Qui la password si verifica
//    su un client USA-E-GETTA senza cookie: la sessione vera (e il suo AAL2)
//    non si tocca.
//
// 2) [MEDIA] La lock screen era un oracolo per indovinare la password: la
//    chiamata diretta dal client saltava rate limit e registro di sicurezza.
//    Qui i tentativi passano dallo STESSO contatore del login (così i
//    fallimenti sul lucchetto alimentano anche la soglia captcha del login
//    da quell'IP) e ogni esito finisce in `security_events`.
// ============================================================

import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createClient as createBareClient } from '@supabase/supabase-js'
import { clientIpFrom } from '@/lib/client-ip'
import { getLoginFailureCount, recordLoginFailure, clearLoginFailures } from '@/lib/auth-rate-limit'
import { logSecurityEvent } from '@/lib/security/events'

const MAX_FALLIMENTI = 10 // stessa soglia dura del login (15 minuti di finestra)

export async function unlockWithPasswordAction(
  password: string
): Promise<{ ok?: true; error?: string }> {
  if (!password) return { error: 'Password non corretta.' }

  // L'email NON arriva dal client: si legge dalla sessione già autenticata
  // sotto il lucchetto. Niente sessione → niente sblocco.
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user?.email) return { error: 'La sessione non è più valida: esci e rientra dal login.' }

  const ip = clientIpFrom(await headers())

  // Freno PRIMA di verificare: oltre la soglia non si interroga nemmeno Auth,
  // altrimenti il limite non limiterebbe la verifica ma solo il messaggio.
  if ((await getLoginFailureCount()) >= MAX_FALLIMENTI) {
    return { error: 'Troppi tentativi: aspetta qualche minuto e riprova.' }
  }

  // Client usa-e-getta: nessun cookie, nessuna persistenza — la verifica non
  // può toccare la sessione del browser.
  const bare = createBareClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
  const { error } = await bare.auth.signInWithPassword({ email: user.email, password })

  if (error) {
    await recordLoginFailure()
    void logSecurityEvent({ kind: 'login_failed', userId: user.id, ip, meta: { contesto: 'sblocco' } })
    return { error: 'Password non corretta.' }
  }

  // Igiene: la sessione usa-e-getta creata dalla verifica si revoca subito.
  // ⚠️ scope 'local' — SOLO quella: 'global' revocherebbe le sessioni vere.
  try { await bare.auth.signOut({ scope: 'local' }) } catch { /* best effort */ }
  void clearLoginFailures()
  void logSecurityEvent({ kind: 'login_ok', userId: user.id, ip, meta: { contesto: 'sblocco' } })
  return { ok: true }
}
