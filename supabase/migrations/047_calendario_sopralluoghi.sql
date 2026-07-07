-- ============================================================
-- 047 — CALENDARIO SOPRALLUOGHI (decisione DECISIONI_E_FEEDBACK:
-- "appuntamenti con indirizzo; dall'appuntamento del giorno, tap
-- sull'icona → apre Google Maps già impostato per la navigazione")
-- Idempotente — sicura da rieseguire.
-- ============================================================

-- Data/ora dell'appuntamento di sopralluogo (facoltativa)
ALTER TABLE sopralluoghi ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

-- Indice per l'agenda (prossimi appuntamenti del workspace)
CREATE INDEX IF NOT EXISTS idx_sopralluoghi_agenda
  ON sopralluoghi(workspace_id, scheduled_at)
  WHERE deleted_at IS NULL AND scheduled_at IS NOT NULL;
