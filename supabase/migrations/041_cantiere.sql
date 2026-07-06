-- ============================================================
-- 041 — CANTIERE: Sopralluoghi + Foto prima/dopo + Opzioni a livelli
-- Mockup mockup_feature_cantiere.html v2 (approvato Eli 5 lug 2026).
-- Idempotente — sicuro da rieseguire.
-- ============================================================

-- ── Sopralluoghi (appunti di cantiere, privati dell'artigiano) ─────────
CREATE TABLE IF NOT EXISTS sopralluoghi (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id    UUID REFERENCES clients(id) ON DELETE SET NULL,
  title        TEXT NOT NULL DEFAULT '',      -- es. "Bagno — Mario Rossi"
  address      TEXT,                          -- indirizzo cantiere (per il futuro calendario/Maps)
  notes        TEXT,                          -- appunti liberi (dettatura inclusa)
  document_id  UUID REFERENCES documents(id) ON DELETE SET NULL, -- preventivo creato
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ
);

ALTER TABLE sopralluoghi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sopralluoghi_workspace" ON sopralluoghi;
CREATE POLICY "sopralluoghi_workspace" ON sopralluoghi
  USING (workspace_id IN (SELECT my_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));

CREATE INDEX IF NOT EXISTS idx_sopralluoghi_ws
  ON sopralluoghi(workspace_id, updated_at DESC) WHERE deleted_at IS NULL;

-- ── Foto lavoro (sopralluogo e/o documento) ─────────────────────────────
CREATE TABLE IF NOT EXISTS work_photos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  sopralluogo_id   UUID REFERENCES sopralluoghi(id) ON DELETE SET NULL,
  document_id      UUID REFERENCES documents(id) ON DELETE SET NULL,
  storage_path     TEXT NOT NULL,             -- path nel bucket work-photos
  label            TEXT CHECK (label IN ('prima','dopo')),
  visible_to_client BOOLEAN NOT NULL DEFAULT false,  -- default: il cliente NON vede
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE work_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "work_photos_workspace" ON work_photos;
CREATE POLICY "work_photos_workspace" ON work_photos
  USING (workspace_id IN (SELECT my_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));

CREATE INDEX IF NOT EXISTS idx_work_photos_sopralluogo ON work_photos(sopralluogo_id);
CREATE INDEX IF NOT EXISTS idx_work_photos_document    ON work_photos(document_id);

-- ── Storage bucket per le foto ──────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'work-photos',
  'work-photos',
  true,
  5242880,  -- 5 MB (le foto vengono ridimensionate client-side prima dell'upload)
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public             = true,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Work photos are publicly readable"          ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload work photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete work photos" ON storage.objects;

CREATE POLICY "Work photos are publicly readable"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'work-photos');

CREATE POLICY "Authenticated users can upload work photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'work-photos');

CREATE POLICY "Authenticated users can delete work photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'work-photos');

-- ── Opzioni a livelli (Base / Consigliata / Premium — solo Pro) ─────────
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS options_enabled  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recommended_tier TEXT CHECK (recommended_tier IN ('base','consigliata','premium')),
  ADD COLUMN IF NOT EXISTS accepted_tier    TEXT CHECK (accepted_tier IN ('base','consigliata','premium'));

ALTER TABLE document_items
  ADD COLUMN IF NOT EXISTS option_tier TEXT CHECK (option_tier IN ('base','consigliata','premium'));
