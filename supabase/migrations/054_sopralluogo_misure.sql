-- ============================================================
-- 054 — MISURE CALCOLATE nel sopralluogo (richiesta Eli 18 lug 2026)
-- La calcolatrice di cantiere dentro gli Appunti del sopralluogo:
-- ogni misura confermata resta salvata CON i suoi input (JSONB),
-- così in app si può toccare e rimodificare. Al "Trasforma in
-- preventivo" le misure vengono riportate nelle Note interne.
-- Idempotente — sicura da rieseguire.
-- ============================================================

ALTER TABLE sopralluoghi ADD COLUMN IF NOT EXISTS measurements JSONB;
