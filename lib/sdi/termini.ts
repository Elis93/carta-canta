// ── Termini di trasmissione allo SdI (11 ago 2026, ricerca su fonti) ────────
//
// COSA DICE LA LEGGE, in breve:
//   · una fattura elettronica «si ha per emessa» SOLO quando è TRASMESSA
//     allo SdI (art. 21 c.1 DPR 633/1972). Una bozza non è emessa; il PDF o
//     il link mandati al cliente sono una «copia di cortesia», senza valore
//     fiscale finché l'elettronica non parte;
//   · la trasmissione deve avvenire ENTRO 12 GIORNI dalla data di
//     effettuazione dell'operazione (art. 21 c.4). Per i servizi
//     l'effettuazione è l'INCASSO — oppure la DATA DELLA FATTURA stessa, se
//     viene prima (principio di anticipazione, art. 6 c.4);
//   · oltre il termine la fattura vale comunque, ma è un'emissione TARDIVA
//     sanzionabile (riducibile col ravvedimento operoso).
//
// Per l'app: il campo Data dell'XML è la data del documento (created_at), e
// il primo incasso può anticipare l'effettuazione → il riferimento del
// countdown è LA PIÙ VECCHIA delle due. Meglio un giorno di margine in meno
// che un avviso che arriva quando la sanzione è già maturata.
//
// Modulo PURO: date dentro, numeri fuori. Il conteggio è per GIORNI DI
// CALENDARIO nel fuso italiano (Europe/Rome): una fattura creata alle 23:50
// ha già consumato il suo primo giorno dieci minuti dopo.

export const GIORNI_TRASMISSIONE = 12

/** 'YYYY-MM-DD' del momento dato, nel fuso italiano. */
export function giornoItaliano(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' })
}

function utcMs(giorno: string): number {
  const [y, m, g] = giorno.split('-').map(Number)
  return Date.UTC(y!, (m ?? 1) - 1, g ?? 1)
}

/** Differenza in giorni interi di calendario fra due 'YYYY-MM-DD'. */
function diffGiorni(a: string, b: string): number {
  return Math.round((utcMs(a) - utcMs(b)) / 86_400_000)
}

/**
 * Il riferimento da cui partono i 12 giorni: la più vecchia fra la data del
 * documento e il primo incasso registrato. Null se manca la data (documento
 * malformato: meglio nessun countdown di un countdown inventato).
 */
export function riferimentoTrasmissione(
  createdAt: string | null | undefined,
  paidAt?: string | null,
): string | null {
  const date: string[] = []
  if (createdAt) {
    const d = new Date(createdAt)
    if (!Number.isNaN(d.getTime())) date.push(giornoItaliano(d))
  }
  if (paidAt) {
    const d = new Date(paidAt)
    if (!Number.isNaN(d.getTime())) date.push(giornoItaliano(d))
  }
  if (date.length === 0) return null
  return date.sort()[0]!
}

export interface TermineTrasmissione {
  /** Ultimo giorno utile per trasmettere, 'YYYY-MM-DD' (riferimento + 12) */
  scadenza: string
  /** Giorni di calendario che restano: 0 = scade oggi, negativo = superato */
  giorniRimasti: number
  fuoriTermine: boolean
}

/**
 * Quanto tempo resta per trasmettere. `oggi` è iniettabile per i test;
 * di default è adesso.
 */
export function termineTrasmissione(
  riferimento: string,
  oggi: Date = new Date(),
): TermineTrasmissione {
  const rif = utcMs(riferimento)
  const scadenza = new Date(rif + GIORNI_TRASMISSIONE * 86_400_000)
    .toISOString()
    .slice(0, 10)
  const giorniRimasti = diffGiorni(scadenza, giornoItaliano(oggi))
  return { scadenza, giorniRimasti, fuoriTermine: giorniRimasti < 0 }
}

/** La scadenza in parole: «entro il 23 agosto». */
export function scadenzaLabel(scadenza: string): string {
  const [y, m, g] = scadenza.split('-').map(Number)
  return new Date(Date.UTC(y!, (m ?? 1) - 1, g ?? 1)).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
}
