-- ============================================================
-- 048 — GESTIONE LAVORI (commesse) — decisione Eli 7 lug 2026 (opzione A)
-- Dal preventivo accettato nasce un "Lavoro" con stati:
-- da_iniziare → in_corso → finito → fatturato.
-- Idempotente — sicura da rieseguire.
-- ============================================================

CREATE TABLE IF NOT EXISTS lavori (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id    UUID REFERENCES clients(id) ON DELETE SET NULL,
  -- Preventivo di origine (se il lavoro nasce da un preventivo accettato)
  document_id  UUID REFERENCES documents(id) ON DELETE SET NULL,
  title        TEXT NOT NULL DEFAULT '',
  address      TEXT,
  status       TEXT NOT NULL DEFAULT 'da_iniziare'
               CHECK (status IN ('da_iniziare', 'in_corso', 'finito', 'fatturato')),
  notes        TEXT,
  started_at   TIMESTAMPTZ,
  finished_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ
);

ALTER TABLE lavori ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lavori_workspace" ON lavori;
CREATE POLICY "lavori_workspace" ON lavori
  USING (workspace_id IN (SELECT my_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));

CREATE INDEX IF NOT EXISTS idx_lavori_ws
  ON lavori(workspace_id, status, updated_at DESC) WHERE deleted_at IS NULL;

-- Un preventivo genera al massimo UN lavoro ("Apri lavoro" idempotente)
CREATE UNIQUE INDEX IF NOT EXISTS idx_lavori_document
  ON lavori(document_id) WHERE document_id IS NOT NULL AND deleted_at IS NULL;
