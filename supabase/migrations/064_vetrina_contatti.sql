-- ============================================================
-- 064 — CONTATTI IN VETRINA, scelta dell'artigiano (decisione Eli
-- 2 ago 2026: due interruttori, SPENTI di default).
-- - show_phone: se true, il profilo pubblico mostra il bottone
--   "Chiama" col telefono già presente nel profilo.
-- - public_email: email PUBBLICA dedicata (separata da quella di
--   login, che non va mai esposta); null = non mostrata.
-- Il modulo richiesta resta sempre il canale di base.
-- ⚠️ GRANT PER COLONNA (lezione 045×055): marketplace_profiles ha i
-- permessi colonna per colonna — senza i GRANT qui sotto l'upsert
-- dell'utente fallirebbe con permission denied sull'INTERA scrittura.
-- Idempotente — sicura da rieseguire.
-- ============================================================

ALTER TABLE marketplace_profiles
  ADD COLUMN IF NOT EXISTS show_phone BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE marketplace_profiles
  ADD COLUMN IF NOT EXISTS public_email TEXT;

GRANT INSERT (show_phone, public_email) ON marketplace_profiles TO authenticated;
GRANT UPDATE (show_phone, public_email) ON marketplace_profiles TO authenticated;
