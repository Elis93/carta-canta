-- Migration 052: promemoria manutenzioni + ore di lavoro (decisione Eli 13 lug 2026)
-- 1. lavori.recall_at / recall_note — "richiama il cliente" (manutenzioni ricorrenti):
--    alla data, notifica in campanella (lib/notifications.ts, tipo 'richiamo').
-- 2. lavori.labor_minutes / timer_started_at — ore di manodopera (timer + manuale).
-- 3. workspaces.hourly_cost — costo orario: le ore entrano nello "Speso"
--    dell'Economia del lavoro (margine reale).
-- Idempotente: rilanciabile senza effetti collaterali.

ALTER TABLE lavori ADD COLUMN IF NOT EXISTS recall_at TIMESTAMPTZ;
ALTER TABLE lavori ADD COLUMN IF NOT EXISTS recall_note TEXT;
ALTER TABLE lavori ADD COLUMN IF NOT EXISTS labor_minutes INT NOT NULL DEFAULT 0;
ALTER TABLE lavori ADD COLUMN IF NOT EXISTS timer_started_at TIMESTAMPTZ;

ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS hourly_cost NUMERIC(8,2);

-- Ricerca dei richiami maturati (campanella): parziale sui soli lavori attivi con richiamo
CREATE INDEX IF NOT EXISTS idx_lavori_recall
  ON lavori (workspace_id, recall_at)
  WHERE recall_at IS NOT NULL AND deleted_at IS NULL;
