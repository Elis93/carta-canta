import { Redis } from '@upstash/redis'

// Singleton null-safe: restituisce null se le env vars non sono configurate.
// I caller devono gestire il caso null con un fallback (in-memory o fail-open).
let _client: Redis | null = null
let _warned = false

export function getRedis(): Redis | null {
  if (_client) return _client
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    // In produzione i rate-limit (login, endpoint pubblici) dipendono da Redis:
    // senza, degradano al contatore in-memory per-processo e la protezione
    // brute-force/abuso è debole. Avvisa UNA volta così non passa inosservato
    // (audit sicurezza 20 lug). In sviluppo è normale e non avvisa.
    if (!_warned && process.env.NODE_ENV === 'production') {
      _warned = true
      console.error('[redis] ⚠️ UPSTASH_REDIS_REST_URL/TOKEN non configurate in produzione: i rate-limit sono degradati (in-memory per-istanza). Configurare Upstash su Vercel.')
    }
    return null
  }
  _client = new Redis({ url, token })
  return _client
}
