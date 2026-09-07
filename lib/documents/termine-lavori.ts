// ── Termine dei lavori sul preventivo (088, Eli 6 set 2026) ─────────────────
//
// «Inserire in preventivo quando è previsto il termine dei lavori (tipo 30
// giorni da conferma preventivo)». Scelta di Eli: GIORNI dalla conferma, non
// una data fissa — una data scritta prima che il cliente accetti invecchia
// da sola. Giorni di CALENDARIO: è ciò che un cliente capisce leggendo
// «entro 30 giorni» (chi vuole sei settimane scrive 42).
//
// ⚠️ B.0 — è una clausola contrattuale (art. 1183 c.c. e ss.): sforare un
// termine scritto sul preventivo che il cliente ha accettato espone a
// contestazioni. Per questo il campo è VUOTO di default (chi non lo compila
// non promette nulla) e la dicitura porta «indicativamente» e «salvo
// imprevisti o cause non dipendenti dall'impresa». La frase è UNA, qui:
// PDF, pagina del cliente e foglio interno la prendono da questo modulo.
//
// Modulo PURO: niente Supabase, niente React. Testato.

export const WORK_DAYS_MIN = 1
export const WORK_DAYS_MAX = 365

/** Normalizza un valore libero (form, DB) in giorni validi, oppure null. */
export function normalizzaWorkDays(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.'))
  if (!Number.isFinite(n)) return null
  const giorni = Math.trunc(n)
  if (giorni < WORK_DAYS_MIN || giorni > WORK_DAYS_MAX) return null
  return giorni
}

/**
 * Data di fine lavori = conferma + N giorni di calendario.
 * Senza conferma (preventivo non ancora accettato) o senza giorni → null.
 * Il conto è sui millisecondi (+N×24h): nessuna sorpresa sui cambi d'ora,
 * la formattazione in Europe/Rome la fa chi mostra la data.
 */
export function dataFineLavori(acceptedAt: string | Date | null | undefined, workDays: unknown): Date | null {
  const giorni = normalizzaWorkDays(workDays)
  if (giorni == null || !acceptedAt) return null
  const base = acceptedAt instanceof Date ? acceptedAt : new Date(acceptedAt)
  if (Number.isNaN(base.getTime())) return null
  return new Date(base.getTime() + giorni * 24 * 60 * 60 * 1000)
}

/** Vero se la data di fine è passata rispetto a `now` (default: adesso). */
export function termineSuperato(dataFine: Date | null, now: Date = new Date()): boolean {
  return !!dataFine && dataFine.getTime() < now.getTime()
}

/**
 * La dicitura contrattuale, prima dell'accettazione (una sola per tutta
 * l'app — PDF, pagina cliente, foglio interno). `giorni` già validato.
 * SENZA l'etichetta «Tempi di esecuzione»: la mette chi la mostra (nel PDF
 * è il titolo della sezione, e ripeterla nella frase la faceva uscire due volte).
 */
export function fraseTermineLavori(giorni: number): string {
  return `Indicativamente entro ${giorni} ${giorni === 1 ? 'giorno' : 'giorni'} dalla conferma del preventivo, salvo imprevisti o cause non dipendenti dall'impresa.`
}

const FMT_LONG: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Rome' }

/** Dopo l'accettazione: «Lavori entro il 7 ottobre 2026». */
export function fraseLavoriEntro(dataFine: Date): string {
  return `Lavori entro il ${dataFine.toLocaleDateString('it-IT', FMT_LONG)}`
}

/**
 * Riepilogo per chi deve mostrare il termine: null se il documento non ne ha
 * uno; altrimenti giorni + (se accettato) la data concreta e la frase giusta.
 */
export function terminePrevisto(doc: {
  work_days?: number | null
  accepted_at?: string | null
}): { giorni: number; dataFine: Date | null; testo: string } | null {
  const giorni = normalizzaWorkDays(doc.work_days)
  if (giorni == null) return null
  const dataFine = dataFineLavori(doc.accepted_at ?? null, giorni)
  return {
    giorni,
    dataFine,
    testo: dataFine ? fraseLavoriEntro(dataFine) : fraseTermineLavori(giorni),
  }
}
