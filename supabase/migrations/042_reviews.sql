-- ============================================================
-- 042 — RECENSIONI cliente → artigiano (mockup crescita §2, approvato)
-- SOLO domande chiuse (scudo legale — mai testo libero del cliente).
-- Sblocco AUTOMATICO quando la fattura è pagata per intero.
-- Il nome del recensore è salvato già "puntato" (es. "Mario R.") —
-- minimizzazione dei dati. Una recensione per fattura.
-- ============================================================

CREATE TABLE IF NOT EXISTS reviews (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  document_id        UUID NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
  rating_puntualita  INT NOT NULL CHECK (rating_puntualita BETWEEN 1 AND 5),
  rating_qualita     INT NOT NULL CHECK (rating_qualita BETWEEN 1 AND 5),
  rating_preventivo  INT NOT NULL CHECK (rating_preventivo BETWEEN 1 AND 5),
  rating_pulizia     INT NOT NULL CHECK (rating_pulizia BETWEEN 1 AND 5),
  recommends         BOOLEAN NOT NULL,
  reviewer_name      TEXT,            -- già puntato: "Mario R."
  reviewer_city      TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  reported_at        TIMESTAMPTZ,     -- segnalata dall'artigiano (in verifica)
  report_reason      TEXT,
  removed_at         TIMESTAMPTZ      -- rimossa dopo verifica (moderazione)
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- L'artigiano LEGGE le recensioni del suo workspace e può SEGNALARLE
-- (update di reported_at/report_reason). L'inserimento avviene SOLO
-- server-side (API pubblica con service role via public_token).
DROP POLICY IF EXISTS "reviews_select_own" ON reviews;
CREATE POLICY "reviews_select_own" ON reviews
  FOR SELECT USING (workspace_id IN (SELECT my_workspace_ids()));

DROP POLICY IF EXISTS "reviews_update_own" ON reviews;
CREATE POLICY "reviews_update_own" ON reviews
  FOR UPDATE USING (workspace_id IN (SELECT my_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));

CREATE INDEX IF NOT EXISTS idx_reviews_ws ON reviews(workspace_id, created_at DESC);
