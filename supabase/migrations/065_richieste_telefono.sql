-- ============================================================
-- 065 — CELLULARE nel form richiesta della vetrina (Eli 3 ago:
-- "il cliente non ha una sezione dove può lasciare il numero").
-- Il form ora ha DUE campi: email (consigliata) e cellulare
-- (facoltativo) — almeno uno obbligatorio. customer_contact resta
-- il recapito PRIMARIO (email se c'è, altrimenti telefono) per
-- retro-compatibilità; customer_phone è il telefono aggiuntivo
-- quando il cliente li lascia entrambi.
-- GRANT: non servono — l'INSERT è solo server-side (service role,
-- migration 045) e il SELECT dell'artigiano è a tutta tabella.
-- Idempotente — sicura da rieseguire.
-- ============================================================

ALTER TABLE marketplace_requests
  ADD COLUMN IF NOT EXISTS customer_phone TEXT;
