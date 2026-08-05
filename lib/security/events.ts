// ============================================================
// Registro degli eventi di sicurezza (server only).
//
// PERCHÉ: fino al 5 agosto 2026 non esisteva alcuna traccia di cosa succede
// sugli account. Se qualcuno provasse cinquecento password al minuto, o
// scaricasse l'intero archivio di un artigiano, non lo sapremmo — né sul
// momento né dopo. E un allarme costruito senza storico non si sa
// interpretare: prima si registra, poi si decidono le soglie.
//
// ⚠️ DUE REGOLE perché questa tabella sia una difesa e non un nuovo bersaglio:
//
//  1. L'INDIRIZZO IP NON SI SCRIVE MAI IN CHIARO. Serve a rispondere a "è
//     sempre lo stesso?", non a "chi è": quindi si salva l'impronta (SHA-256
//     con un sale del server). Senza il sale configurato NON si salva affatto —
//     lo spazio degli indirizzi IPv4 è così piccolo che un'impronta senza sale
//     si inverte con una tabella precalcolata, cioè sarebbe l'IP in chiaro
//     travestito.
//  2. In `meta` vanno SOLO conteggi ed etichette nostre. Mai testi scritti
//     dall'utente, mai nomi, email, IBAN o numeri di documento: altrimenti
//     ricreiamo qui l'archivio di dati personali che stiamo proteggendo
//     altrove.
//
// È SEMPRE best-effort: se la scrittura fallisce, l'operazione dell'utente
// prosegue. Un registro che blocca l'app è peggio di un registro assente.
//
// Tollerante: finché la migration 071 non è applicata la tabella non esiste,
// e la funzione non fa nulla (in silenzio, senza rumore nei log).
// ============================================================

import { createHash } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'

export type SecurityEventKind =
  | 'export'            // scaricamento massivo di dati
  | 'login_failed'
  | 'password_changed'
  | 'payment_changed'   // IBAN / intestatario / link / note
  | 'sessions_revoked'
  | 'sdi_sent'
  | 'studio_access'     // accesso del commercialista ai dati di un cliente

/**
 * Impronta dell'indirizzo IP. Restituisce null se non c'è il sale: meglio
 * nessun dato che un dato reversibile (vedi regola 1 in testa al file).
 */
function ipFingerprint(ip: string | null): string | null {
  const salt = process.env.SECURITY_EVENT_SALT
  if (!ip || !salt) return null
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32)
}

export async function logSecurityEvent(opts: {
  kind: SecurityEventKind
  userId?: string | null
  workspaceId?: string | null
  ip?: string | null
  /** solo etichette e numeri nostri — MAI testo dell'utente */
  meta?: Record<string, string | number | boolean | null>
}): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 071 non ancora in types/database.ts
    const admin = createAdminClient() as any
    const { error } = await admin.from('security_events').insert({
      kind: opts.kind,
      user_id: opts.userId ?? null,
      workspace_id: opts.workspaceId ?? null,
      ip_hash: ipFingerprint(opts.ip ?? null),
      meta: opts.meta ?? {},
    })
    // 42P01 = tabella assente (migration 071 non applicata): atteso, silenzio.
    if (error && error.code !== '42P01' && error.code !== 'PGRST205') {
      console.warn('[security-events] evento non registrato:', opts.kind, error.code)
    }
  } catch {
    /* mai bloccante: l'operazione dell'utente vale più del registro */
  }
}
