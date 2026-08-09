// ============================================================
// Corpo della richiesta di cambio stato di un preventivo.
//
// ⚠️ VIVE QUI, FUORI DALLA ROUTE, PER POTERLO COLLAUDARE.
// Il 9 agosto lo schema stava dentro la route e non dichiarava `tier`: Zod
// scarta in silenzio le chiavi che non conosce, quindi la proposta scelta
// dall'artigiano ("Base" / "Premium") spariva PRIMA che il codice la
// leggesse. Il server rispondeva sempre «dimmi quale proposta», il pannello
// si riapriva identico, e toccando «Base» **non succedeva nulla** — che è
// esattamente come Eli l'ha descritto, due volte.
//
// Il difetto era invisibile perché la route leggeva il campo con un cast
// (`body as unknown as { tier?: unknown }`): il cast zittisce TypeScript
// proprio sul punto in cui avrebbe detto che quel campo non esiste.
//
// ⚠️ REGOLA: un campo che arriva dal client va DICHIARATO nello schema.
// Se serve un cast per leggerlo, quasi sempre vuol dire che è stato scartato.
// ============================================================

import { z } from 'zod/v4'

export const StatusBodySchema = z.object({
  status: z.enum(['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired']),
  /**
   * Proposta accettata dal cliente, quando il preventivo ne ha più d'una.
   * I valori validi si verificano contro le proposte VERE del documento:
   * qui basta che sia una stringa breve.
   */
  tier: z.string().min(1).max(40).optional(),
})

export type StatusBody = z.infer<typeof StatusBodySchema>
