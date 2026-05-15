-- Migration 030: soft delete su documents
-- Aggiunge deleted_at per supportare il cestino (recupero entro 15 giorni).
-- Il campo è NULL per i documenti attivi; non-NULL per i documenti nel cestino.

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Indice parziale per velocizzare le query di purge (cron notturno)
CREATE INDEX IF NOT EXISTS idx_documents_deleted_at
  ON documents (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- Indice parziale per velocizzare le query di lista (i più frequenti)
CREATE INDEX IF NOT EXISTS idx_documents_active
  ON documents (workspace_id, doc_type, updated_at DESC)
  WHERE deleted_at IS NULL;
