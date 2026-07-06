-- ============================================================
-- 044 — SDI Fase 1: SOLO INVIO (DECISIONE_SDI.md §9, mockup crescita §1)
-- Provider: OpenAPI (layer di astrazione lib/sdi/ — anti lock-in).
-- Gating: Pro illimitato · Free 8 trasmissioni di prova A VITA
-- (contate all'invio, NON restituite se la fattura viene cancellata)
-- · kill-switch globale nel sotto-budget €15/mese (tetto unico €50).
-- ============================================================

-- ── Canale telematico del cliente finale (cessionario) ──────────────────
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS codice_destinatario TEXT,  -- 7 caratteri ('0000000' = privato senza canale)
  ADD COLUMN IF NOT EXISTS pec TEXT;

-- ── Stati SDI sulla fattura (macchina a stati, solo invio) ──────────────
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS sdi_status TEXT
    CHECK (sdi_status IN ('inviata','consegnata','mancata_consegna','scartata')),
  ADD COLUMN IF NOT EXISTS sdi_sent_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sdi_updated_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sdi_error       TEXT,   -- motivo scarto leggibile
  ADD COLUMN IF NOT EXISTS sdi_provider_id TEXT;   -- id della fattura presso il provider

-- ── Configurazione anagrafica creata sul provider (una volta per cliente) ─
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS sdi_config_done_at TIMESTAMPTZ;

-- ── Registro trasmissioni (contatori per-utente + kill-switch globale) ───
-- Una riga per trasmissione. Il conteggio NON viene restituito se la
-- fattura viene cancellata (per questo NON c'è ON DELETE CASCADE sul doc).
CREATE TABLE IF NOT EXISTS sdi_usage (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  document_id  UUID,             -- riferimento informativo, senza FK
  period       TEXT NOT NULL,    -- 'YYYY-MM'
  plan_at_use  TEXT NOT NULL DEFAULT 'free',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sdi_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sdi_usage_workspace" ON sdi_usage;
CREATE POLICY "sdi_usage_workspace" ON sdi_usage
  USING (workspace_id IN (SELECT my_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));

CREATE INDEX IF NOT EXISTS idx_sdi_usage_ws     ON sdi_usage(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sdi_usage_period ON sdi_usage(period);
