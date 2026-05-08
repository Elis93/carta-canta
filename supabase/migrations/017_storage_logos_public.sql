-- ============================================================
-- CARTA CANTA — Migration 017: Storage bucket "logos" pubblico
-- ============================================================
-- Rende il bucket "logos" pubblico (lettura libera per tutti)
-- e imposta le policy per scrittura degli utenti autenticati.
-- Idempotente — sicuro da rieseguire.
-- ============================================================

-- Crea il bucket se non esiste, oppure aggiorna public=true
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logos',
  'logos',
  true,
  2097152,  -- 2 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
  SET public            = true,
      file_size_limit   = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Rimuove le policy precedenti (safe DROP IF EXISTS)
DROP POLICY IF EXISTS "Logos are publicly readable"          ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete logos" ON storage.objects;

-- Lettura pubblica (belt-and-suspenders rispetto a bucket public=true)
CREATE POLICY "Logos are publicly readable"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'logos');

-- Scrittura: solo utenti autenticati
CREATE POLICY "Authenticated users can upload logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'logos');

CREATE POLICY "Authenticated users can update logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'logos');

CREATE POLICY "Authenticated users can delete logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'logos');
