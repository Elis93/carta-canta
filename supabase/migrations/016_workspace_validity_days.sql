-- ============================================================
-- 016_workspace_validity_days.sql
-- Aggiunge la validità di default dei preventivi ai workspace.
-- Ogni workspace può configurare quanti giorni di validità assegnare
-- ai nuovi preventivi. Il valore viene usato come default nel form
-- e per calcolare expires_at al momento dell'invio.
-- ============================================================

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS validity_days integer NOT NULL DEFAULT 30;

COMMENT ON COLUMN workspaces.validity_days IS 'Validità di default dei preventivi in giorni (default 30)';
