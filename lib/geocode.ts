// ============================================================
// Geocodifica leggera per il marketplace (19 lug 2026).
// Converte il COMUNE di un professionista in coordinate una volta sola
// (al salvataggio del profilo), così la ricerca "vicino a me" può ordinare
// per distanza. Provider: OpenStreetMap Nominatim (gratuito, senza chiave).
// ⚠️ La posizione del CLIENTE non passa mai da qui: il telefono la dà al
// nostro server, che calcola solo la distanza. Nominatim vede solo i NOMI
// dei comuni dei professionisti, non dati del cliente.
// ============================================================

export interface LatLng {
  lat: number
  lng: number
}

/** Comune italiano → coordinate. null se non trovato o su errore/timeout. */
export async function geocodeCity(city: string): Promise<LatLng | null> {
  const query = city.trim()
  if (!query) return null
  const url =
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=it&q=${encodeURIComponent(`${query}, Italia`)}`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'CartaCanta/1.0 (+https://cartacanta.app)', 'Accept-Language': 'it' },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as Array<{ lat?: string; lon?: string }>
    const first = data?.[0]
    if (!first?.lat || !first?.lon) return null
    const lat = parseFloat(first.lat)
    const lng = parseFloat(first.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    return { lat, lng }
  } catch {
    return null
  }
}

/** Distanza in km tra due punti (formula dell'emisenoverso / Haversine). */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)))
}
