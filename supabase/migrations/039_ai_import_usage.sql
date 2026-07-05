-- 039 — AI IMPORT: registro utilizzi (quote per utente + serbatoio globale)
-- Decisioni Eli 5 lug 2026: Free 1 import a vita (contato al salvataggio),
-- Pro 15/mese, serbatoio gratuito 300 + 100×Pro attivo, kill-switch nel
-- tetto unico €50/mese (sotto-budget AI Import €15 ≈ cap 1500 import Free).

CREATE TABLE IF NOT EXISTS ai_import_usage (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  period       TEXT NOT NULL,                 -- 'YYYY-MM'
  plan_at_use  TEXT NOT NULL DEFAULT 'free',  -- piano al momento dell'import (per il serbatoio)
  items_count  INT NOT NULL DEFAULT 0,        -- voci salvate con questo import
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ai_import_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_import_usage_workspace" ON ai_import_usage
  USING (workspace_id IN (SELECT my_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));

CREATE INDEX IF NOT EXISTS idx_ai_import_usage_ws     ON ai_import_usage(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ai_import_usage_period ON ai_import_usage(period);
