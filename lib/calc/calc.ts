// ============================================================
// Calcoli di cantiere — funzioni PURE (niente UI, niente stato).
// Estratte per essere testabili in isolamento. I numeri arrivano già
// convertiti (il parsing del formato italiano lo fa il componente con
// parseImportoIt). Tutte tolleranti: input non validi → 0.
// ============================================================

export function roundTo(n: number, decimals = 2): number {
  const f = 10 ** decimals
  return Math.round((n + Number.EPSILON) * f) / f
}

/** Applica una percentuale di scarto (>=0) a un valore base. */
export function applicaScarto(base: number, scartoPct: number): number {
  const s = Number.isFinite(scartoPct) && scartoPct > 0 ? scartoPct : 0
  return base * (1 + s / 100)
}

/** Superficie in m² = lunghezza × larghezza (+ scarto opzionale). */
export function areaMq(lungh: number, largh: number, scartoPct = 0): number {
  if (!(lungh > 0) || !(largh > 0)) return 0
  return roundTo(applicaScarto(lungh * largh, scartoPct), 2)
}

/** Volume in m³ = lunghezza × larghezza × altezza (+ scarto opzionale). */
export function volumeMc(lungh: number, largh: number, alt: number, scartoPct = 0): number {
  if (!(lungh > 0) || !(largh > 0) || !(alt > 0)) return 0
  return roundTo(applicaScarto(lungh * largh * alt, scartoPct), 3)
}

/**
 * Piastrelle: da una superficie e dal formato della piastrella (lati in cm)
 * calcola i PEZZI necessari (arrotondati per eccesso) e la superficie con scarto.
 */
export interface PiastrelleResult { mq: number; pezzi: number }
export function piastrelle(areaBase: number, latoCm1: number, latoCm2: number, scartoPct = 0): PiastrelleResult {
  const mq = roundTo(applicaScarto(areaBase > 0 ? areaBase : 0, scartoPct), 2)
  const areaPiastrella = (latoCm1 / 100) * (latoCm2 / 100) // m² per piastrella
  const pezzi = mq > 0 && areaPiastrella > 0 ? Math.ceil(mq / areaPiastrella) : 0
  return { mq, pezzi }
}

/**
 * Vernice: litri = (superficie × numero di mani) / resa (m² per litro).
 * Resa tipica 10 m²/litro per mano.
 */
export function verniceLitri(areaBase: number, mani: number, resaMqL: number): number {
  if (!(areaBase > 0) || !(mani > 0) || !(resaMqL > 0)) return 0
  return roundTo((areaBase * mani) / resaMqL, 1)
}
