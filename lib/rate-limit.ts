/**
 * lib/rate-limit.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * In-memory sliding-window rate limiter.
 *
 * Strategy: per-key Map of sorted timestamp arrays, pruned on each check.
 * Fail-open: unexpected errors let the request through (never block legitimate
 * users due to a limiter bug).
 * Scoped to the current Node.js process — resets on cold start / deploy.
 * Good enough for hobby/SMB workloads. For multi-instance production use the
 * Supabase-backed approach described in supabase/migrations/011_rate_limit_events.sql.
 *
 * Usage:
 *   const result = checkRateLimit(`send-email:${workspaceId}`, { limit: 10, windowMs: 3_600_000 })
 *   if (!result.success) return rateLimitResponse(result.resetAt)
 */

export interface RateLimitOptions {
  /** Max requests allowed within the window */
  limit: number
  /** Window duration in milliseconds */
  windowMs: number
}

export interface RateLimitResult {
  /** true = request is within quota and was recorded */
  success: boolean
  /** Requests remaining before the quota is exhausted */
  remaining: number
  /** Unix timestamp (ms) when the oldest in-window request will expire */
  resetAt: number
}

// ── Singleton store ────────────────────────────────────────────────────────
// Timestamps are kept sorted ascending; pruning happens on every read.
const store = new Map<string, number[]>()

// Periodic cleanup: remove stale keys every 10 minutes to prevent unbounded growth.
// `.unref()` so this timer never prevents the process from exiting.
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const horizon = Date.now() - 7_200_000 // 2 h max TTL
    for (const [key, ts] of store) {
      const pruned = ts.filter((t) => t > horizon)
      if (pruned.length === 0) store.delete(key)
      else store.set(key, pruned)
    }
  }, 10 * 60 * 1000).unref?.()
}

// ── Core check ─────────────────────────────────────────────────────────────

export function checkRateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  try {
    const now = Date.now()
    const windowStart = now - opts.windowMs

    // Prune timestamps that have fallen outside the window
    const raw = store.get(key) ?? []
    const timestamps = raw.filter((t) => t > windowStart)

    if (timestamps.length >= opts.limit) {
      // Over quota — tell the caller when the oldest entry will expire
      const oldest = timestamps[0]! // sorted ascending
      store.set(key, timestamps)    // persist the pruned (but not extended) list
      return {
        success: false,
        remaining: 0,
        resetAt: oldest + opts.windowMs,
      }
    }

    // Within quota — record this request
    timestamps.push(now)
    store.set(key, timestamps)

    return {
      success: true,
      remaining: opts.limit - timestamps.length,
      resetAt: now + opts.windowMs,
    }
  } catch {
    // Fail-open: limiter bug must never block legitimate users
    return { success: true, remaining: 1, resetAt: Date.now() + opts.windowMs }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Build a standard 429 Response with Retry-After and X-RateLimit-Reset headers.
 * Compatible with both Next.js Route Handlers (NextResponse) and plain Response.
 */
export function rateLimitResponse(resetAt: number, message?: string): Response {
  const retryAfterSec = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
  return new Response(
    JSON.stringify({
      error: message ?? 'Troppo veloce. Riprova tra qualche istante.',
      retry_after: retryAfterSec,
    }),
    {
      status: 429,
      headers: {
        'Content-Type':      'application/json',
        'Retry-After':       String(retryAfterSec),
        'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
      },
    }
  )
}
