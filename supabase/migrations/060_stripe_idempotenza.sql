-- ============================================================
-- 060 — Idempotenza e ordine degli eventi Stripe (audit 25 lug 2026)
--
-- PROBLEMA (ricerca web: "billing webhooks che falliscono in silenzio" è
-- il difetto post-lancio più citato per i SaaS):
--   · Stripe RITENTA gli eventi (fino a 3 giorni) e NON garantisce l'ordine.
--   · Senza deduplica, il retry di `checkout.session.completed` rimanda
--     l'email "Piano attivato" e riscrive lo stato.
--   · Senza guardia d'ordine, un `subscription.updated` consegnato in
--     RITARDO dopo un `subscription.deleted` RIATTIVA un piano cancellato
--     (l'utente torna Pro senza pagare, o resta Free pur pagando).
--
-- SOLUZIONE:
--   1. `stripe_webhook_events`: registro degli event.id già elaborati.
--      L'INSERT con PK fa da lock: se la riga esiste, l'evento è un retry
--      e viene ignorato (200, così Stripe smette di ritentare).
--   2. `workspaces.stripe_event_at`: timestamp dell'ultimo evento Stripe
--      APPLICATO a quel workspace. Un evento con `created` più vecchio
--      viene scartato (arrivo fuori ordine).
--
-- Idempotente: rieseguibile senza danni.
-- ============================================================

-- ── 1. Registro eventi elaborati ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id     TEXT PRIMARY KEY,
  event_type   TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Nessun accesso dagli utenti: solo il service role (webhook) scrive/legge.
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stripe_webhook_events_no_access ON stripe_webhook_events;
CREATE POLICY stripe_webhook_events_no_access
  ON stripe_webhook_events FOR SELECT USING (false);

-- Pulizia: gli eventi più vecchi di 30 giorni non servono più (Stripe
-- ritenta al massimo per 3 giorni). Il cron del cestino può chiamarla.
CREATE OR REPLACE FUNCTION purge_old_stripe_events()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM stripe_webhook_events WHERE processed_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- ── 2. Timestamp dell'ultimo evento applicato al workspace ──────────────
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS stripe_event_at TIMESTAMPTZ;

COMMENT ON COLUMN workspaces.stripe_event_at IS
  'Timestamp (event.created) dell''ultimo evento Stripe applicato: gli eventi più vecchi vengono ignorati (consegna fuori ordine).';
