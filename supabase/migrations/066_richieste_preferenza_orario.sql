-- ============================================================
-- 066 — PREFERENZA di appuntamento nel form richiesta della vetrina
-- (Eli 4 ago: "prenotazione dalla vetrina"). Il cliente può indicare
-- quando preferirebbe il sopralluogo (giorno facoltativo + fascia
-- oraria: mattina/pomeriggio/sera). È solo una PREFERENZA: l'artigiano
-- conferma contattando il cliente — nessun impegno automatico.
-- Un solo campo TEXT leggibile (es. "12/03/2027 · pomeriggio").
-- GRANT: non servono — l'INSERT è solo server-side (service role,
-- migration 045) e il SELECT dell'artigiano è a tutta tabella.
-- Idempotente — sicura da rieseguire.
-- ============================================================

ALTER TABLE marketplace_requests
  ADD COLUMN IF NOT EXISTS preferred_slot TEXT;
