-- ============================================================
-- CARTA CANTA — Migration 019: Voice Usage Tracking
--
-- Traccia i secondi di audio trascritti per workspace/mese.
-- Limiti: Free → 300 sec (5 min), Pro/Team/Lifetime → 3600 sec (60 min).
-- ============================================================

CREATE TABLE voice_usage (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  period        TEXT        NOT NULL,         -- formato 'YYYY-MM'
  seconds_used  INT         NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, period)
);

CREATE INDEX idx_voice_usage_workspace_period ON voice_usage (workspace_id, period);

-- RLS: l'owner/membro vede il proprio utilizzo
-- (dipende da my_workspace_ids() definita in migration 018)
ALTER TABLE voice_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "voice_usage_select"
  ON voice_usage FOR SELECT
  USING (workspace_id IN (SELECT my_workspace_ids()));
