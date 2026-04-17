-- ============================================================
-- Migration 005: Tabella document_views per tracking aperture
-- ============================================================

CREATE TABLE document_views (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  viewed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address   INET,
  user_agent   TEXT,
  country      CHAR(2)
);

-- Indice primario per query per documento
CREATE INDEX idx_document_views_document_id
  ON document_views(document_id, viewed_at DESC);

-- RLS: solo i membri del workspace vedono le aperture dei loro documenti.
-- Gli insert avvengono via service role (admin client) — nessuna policy INSERT necessaria.
ALTER TABLE document_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY dv_select ON document_views FOR SELECT
  USING (
    document_id IN (
      SELECT id FROM documents WHERE is_workspace_member(workspace_id)
    )
  );
