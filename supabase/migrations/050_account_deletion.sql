-- ============================================================
-- 050 — CANCELLAZIONE ACCOUNT self-service (Opzione A)
-- Marcatori sul workspace per la cancellazione dell'account:
--   deleted_at    = account cancellato dall'utente (workspace "congelato")
--   anonymized_at = dati personali non-fiscali rimossi
-- Le FATTURE restano (obbligo di conservazione 10 anni, art. 2220 c.c.):
-- un cron potrà fare il purge definitivo del workspace dopo 10 anni da deleted_at.
-- Idempotente — sicura da rieseguire.
-- ============================================================

ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS deleted_at    TIMESTAMPTZ;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMPTZ;

-- Indice per il futuro cron di purge (workspace cancellati oltre i 10 anni)
CREATE INDEX IF NOT EXISTS idx_workspaces_deleted
  ON workspaces(deleted_at)
  WHERE deleted_at IS NOT NULL;
