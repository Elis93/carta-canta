// ============================================================
// Freno e traccia sugli export massivi (server only).
//
// PERCHÉ (audit del 5 agosto 2026, §2): gli otto endpoint di esportazione
// scaricano l'intero archivio di un account — tutte le fatture, tutti i
// clienti, tutto il listino coi costi, il pacchetto GDPR completo. Sono
// autenticati e filtrati per workspace, quindi non c'è modo di leggere i dati
// di un altro; ma chi entra in un account (password riusata, sessione rubata)
// poteva scaricare tutto in tre secondi e ripetere all'infinito, senza che
// nulla lo rallentasse né ne restasse traccia. È il passo "esfiltrazione"
// della catena descritta in SICUREZZA.md §1-bis, e costava zero.
//
// COSA FA: un tetto di 10 export l'ora e una riga nel registro di sicurezza.
//
// ⚠️ NON tocca la logica di esportazione: si mette prima, e o lascia passare
// o risponde 429. Va chiamato DOPO aver risolto l'utente (la chiave dev'essere
// vera) e PRIMA di leggere il database (un export bloccato non deve costare).
// ============================================================

import { headers } from 'next/headers'
import { checkPublicRateLimit, rateLimitResponse } from '@/lib/public-rate-limit'
import { clientIpFrom } from '@/lib/client-ip'
import { logSecurityEvent } from '@/lib/security/events'

/** Dieci l'ora: un export è un gesto raro e deliberato (si scarica un file e
 *  lo si apre), quindi non dà fastidio a nessun artigiano — ma trasforma
 *  "scarico tutto l'archivio a ripetizione" in qualcosa di lento e visibile. */
const EXPORT_LIMIT = 10

export async function guardExport(opts: {
  /** id dell'utente della sessione: è la chiave del tetto */
  userId: string
  /** workspace da cui si stanno estraendo i dati (per il registro) */
  workspaceId: string | null
  /** quale export, per il registro: 'fatture', 'catalogo', 'account'… */
  what: string
  /**
   * Area commercialista: il tetto vale per COPPIA commercialista+cliente.
   * Un commercialista con dieci artigiani deve poterli servire tutti nello
   * stesso pomeriggio — quello che non deve poter fare è svuotare l'archivio
   * di UNO di loro a ripetizione.
   * ⚠️ Residuo accettato: chi avesse molti clienti collegati può comunque
   * scaricare molto in totale. Non è aggirabile con un tetto senza rompere
   * l'uso legittimo; è per questo che l'evento finisce nel registro.
   */
  perWorkspace?: boolean
  /**
   * Tetto diverso dai 10/h di default. Serve ai download PER-DOCUMENTO
   * (l'XML di una fattura alla volta): lì 10/h strozzerebbe l'uso legittimo
   * di un commercialista che scarica le fatture del mese, ma NESSUN tetto
   * riaprirebbe l'esfiltrazione dalla porta accanto — uno script che itera
   * gli id scarica l'intero archivio un documento alla volta senza mai
   * toccare il freno degli export né lasciare traccia (trovato in revisione).
   */
  limit?: number
  /** Contatore separato (default 'export'): un tetto diverso non deve
   *  condividere il conteggio con gli export completi, o si strozzerebbero
   *  a vicenda con limiti diversi sulla stessa chiave. */
  keyPrefix?: string
  // Ritorna la risposta 429 da inoltrare così com'è, oppure null se si può
  // procedere. È una `Response` semplice e non una `NextResponse` perché la
  // costruisce `rateLimitResponse`: i route handler di Next accettano entrambe.
}): Promise<Response | null> {
  const prefix = opts.keyPrefix ?? 'export'
  const key = opts.perWorkspace && opts.workspaceId
    ? `${prefix}:${opts.userId}:${opts.workspaceId}`
    : `${prefix}:${opts.userId}`

  const rl = await checkPublicRateLimit({
    key, limit: opts.limit ?? EXPORT_LIMIT, window: '1 h', windowMs: 3_600_000,
  })

  const ip = clientIpFrom(await headers())

  if (rl.blocked) {
    await logSecurityEvent({
      kind: 'export',
      userId: opts.userId,
      workspaceId: opts.workspaceId,
      ip,
      meta: { what: opts.what, bloccato: true },
    })
    return rateLimitResponse(
      rl.resetAt,
      'Hai scaricato molti file uno dopo l\'altro. Riprova tra un\'ora.',
    )
  }

  // Si registra il TENTATIVO, non l'esito: quello che conta per accorgersi di
  // un abuso è quante volte è stato chiesto, non quante sono andate a buon fine.
  await logSecurityEvent({
    kind: 'export',
    userId: opts.userId,
    workspaceId: opts.workspaceId,
    ip,
    meta: { what: opts.what },
  })
  return null
}
