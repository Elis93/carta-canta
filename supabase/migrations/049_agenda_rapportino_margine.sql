-- ============================================================
-- 049 — AGENDA LAVORI + RAPPORTINO + MARGINE (lista Eli #4/#5/#6)
-- Una sola migration per i tre blocchi:
--   #4 appuntamento sul Lavoro (agenda settimanale)
--   #5 rapportino di fine lavoro firmato dal cliente (colonne pronte)
--   #6 spese collegate al Lavoro (margine preventivato vs speso)
-- Idempotente — sicura da rieseguire.
-- ============================================================

-- #4 — Appuntamento/prossimo intervento sul lavoro
ALTER TABLE lavori ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_lavori_agenda
  ON lavori(workspace_id, scheduled_at)
  WHERE deleted_at IS NULL AND scheduled_at IS NOT NULL;

-- #5 — Rapportino di fine lavoro (firma click-through del cliente, come i preventivi)
ALTER TABLE lavori ADD COLUMN IF NOT EXISTS report_token        UUID;
ALTER TABLE lavori ADD COLUMN IF NOT EXISTS report_text         TEXT;
ALTER TABLE lavori ADD COLUMN IF NOT EXISTS report_sent_at      TIMESTAMPTZ;
ALTER TABLE lavori ADD COLUMN IF NOT EXISTS report_signed_at    TIMESTAMPTZ;
ALTER TABLE lavori ADD COLUMN IF NOT EXISTS report_signer_name  TEXT;
ALTER TABLE lavori ADD COLUMN IF NOT EXISTS report_signed_ip    TEXT;
ALTER TABLE lavori ADD COLUMN IF NOT EXISTS report_signed_ua    TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lavori_report_token
  ON lavori(report_token) WHERE report_token IS NOT NULL;

-- #6 — Spese collegate al lavoro (margine)
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS lavoro_id UUID REFERENCES lavori(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_lavoro
  ON expenses(lavoro_id) WHERE lavoro_id IS NOT NULL;
