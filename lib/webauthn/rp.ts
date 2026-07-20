import { headers } from 'next/headers'

// ============================================================
// Parametri Relying Party per WebAuthn (sblocco con impronta).
// Ricavati dall'host della richiesta → funzionano in locale (localhost),
// nei preview Vercel e in produzione (cartacanta.app) senza configurazione.
// rpID = dominio senza porta; origin = schema://host completo.
// ============================================================
export async function getRp(): Promise<{ rpID: string; origin: string; rpName: string }> {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  const rpID = host.split(':')[0]
  const origin = `${proto}://${host}`
  return { rpID, origin, rpName: 'Carta Canta' }
}
