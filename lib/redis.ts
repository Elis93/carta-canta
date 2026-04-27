import { Redis } from '@upstash/redis'

// Singleton null-safe: restituisce null se le env vars non sono configurate.
// I caller devono gestire il caso null con un fallback (in-memory o fail-open).
let _client: Redis | null = null

export function getRedis(): Redis | null {
  if (_client) return _client
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  _client = new Redis({ url, token })
  return _client
}
