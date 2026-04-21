-- ============================================================
-- Migration 011: rate_limit_events
-- ============================================================
-- Persistent sliding-window rate-limit counter for scenarios
-- where in-memory state is insufficient:
--   • Serverless / edge environments (multiple cold-start instances)
--   • Public endpoints that must survive process restarts
--
-- NOTE: This table is NOT yet active in production.
-- The app currently uses the in-memory limiter in lib/rate-limit.ts,
-- which is sufficient for single-instance deployments.
-- Apply this migration when scaling to multiple instances.
--
-- Usage pattern (in a Route Handler):
--   INSERT INTO rate_limit_events (key) VALUES ($1)
--   SELECT COUNT(*) FROM rate_limit_events
--     WHERE key = $1 AND created_at > NOW() - INTERVAL '$windowMs ms'
--   If count > limit → reject with 429, else allow.
-- ============================================================

CREATE TABLE IF NOT EXISTS rate_limit_events (
  id         BIGSERIAL    PRIMARY KEY,
  key        TEXT         NOT NULL,         -- e.g. 'accept:{token}', 'ai:{workspace_id}'
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Fast range query: key + time window
CREATE INDEX IF NOT EXISTS rate_limit_events_key_created_at
  ON rate_limit_events (key, created_at DESC);

-- RLS: deny all direct client access — only service role (admin client) may write
ALTER TABLE rate_limit_events ENABLE ROW LEVEL SECURITY;
-- No POLICY = deny all for authenticated/anon roles; service_role bypasses RLS.

-- ── Auto-purge via pg_cron (uncomment when pg_cron extension is enabled) ──
-- Keeps the table lean by removing events older than 24 hours every night at 3:00 AM.
--
-- SELECT cron.schedule(
--   'rate-limit-cleanup',
--   '0 3 * * *',
--   $$DELETE FROM rate_limit_events WHERE created_at < now() - INTERVAL '24 hours'$$
-- );
