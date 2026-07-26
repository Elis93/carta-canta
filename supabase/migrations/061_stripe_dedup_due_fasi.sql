-- ============================================================
-- 061 — Deduplica Stripe a DUE FASI (review 25 lug, finding S1)
--
-- PROBLEMA della 060: l'event.id veniva registrato PRIMA di elaborare
-- l'evento. Se l'elaborazione non arrivava in fondo, la riga restava e il
-- retry di Stripe veniva scambiato per un doppione → evento perso PER
-- SEMPRE (un utente che ha pagato resta su Free: il webhook è l'UNICA via
-- che scrive il piano, non c'è riconciliazione).
-- Il `delete` nel catch copre solo gli errori GESTITI: un timeout della
-- lambda, un OOM o un kill del processo lasciano la riga orfana.
--
-- SOLUZIONE (standard per i webhook): due fasi.
--   · INSERT con status='processing' → prenota l'evento
--   · UPDATE a status='done' SOLO a elaborazione completata
--   · un retry trova 'done'      → è un vero doppione, si ignora
--   · un retry trova 'processing' VECCHIO (>5 min = la lambda è morta)
--     → si riprova davvero, l'evento non si perde
--   · un retry trova 'processing' RECENTE → 409, Stripe ritenta più tardi
--     (nessuna elaborazione in parallelo dello stesso evento)
--
-- Idempotente: rieseguibile senza danni.
-- ============================================================

ALTER TABLE stripe_webhook_events
  ADD COLUMN IF NOT EXISTS status     TEXT NOT NULL DEFAULT 'done'
    CHECK (status IN ('processing', 'done')),
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

COMMENT ON COLUMN stripe_webhook_events.status IS
  'processing = preso in carico; done = elaborato davvero. Solo i done sono doppioni.';

-- Le righe già presenti (create dalla 060) sono di eventi andati a buon
-- fine: restano 'done' grazie al DEFAULT.

-- Purge: aggiunto SET search_path (hardening, come 030/031/032) e pulizia
-- anche delle prenotazioni rimaste appese.
CREATE OR REPLACE FUNCTION purge_old_stripe_events()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM stripe_webhook_events
  WHERE (status = 'done'       AND processed_at < NOW() - INTERVAL '30 days')
     OR (status = 'processing' AND started_at   < NOW() - INTERVAL '1 day');
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
