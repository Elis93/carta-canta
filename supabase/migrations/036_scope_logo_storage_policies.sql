-- ============================================================
-- CARTA CANTA — Migration 036: restringe le policy di scrittura sui loghi
-- Gravità: BASSA — integrità (un utente poteva sovrascrivere/cancellare il
--          logo di un altro artigiano). I loghi non sono dati personali.
-- ============================================================
--
-- PROBLEMA
-- Le policy INSERT/UPDATE/DELETE sul bucket "logos" (migration 017)
-- controllavano solo `bucket_id = 'logos'`: QUALSIASI utente autenticato
-- poteva quindi modificare o eliminare il file di un altro workspace.
--
-- FIX
-- I loghi sono salvati in `${workspace_id}/logo.ext` (vedi
-- lib/actions/workspace.ts). Le policy di scrittura ora richiedono che la
-- prima cartella del path corrisponda a un workspace di cui l'utente è
-- proprietario o membro accettato. La lettura resta pubblica (i loghi
-- compaiono nei PDF e nei link cliente).
-- ============================================================

DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete logos" ON storage.objects;

-- Helper: prima cartella del path == workspace dell'utente
-- (proprietario OPPURE membro con invito accettato)
CREATE POLICY "Logo write: own workspace - insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM workspaces WHERE owner_id = auth.uid()
      UNION
      SELECT workspace_id::text FROM workspace_members
        WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
  );

CREATE POLICY "Logo write: own workspace - update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM workspaces WHERE owner_id = auth.uid()
      UNION
      SELECT workspace_id::text FROM workspace_members
        WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
  );

CREATE POLICY "Logo write: own workspace - delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM workspaces WHERE owner_id = auth.uid()
      UNION
      SELECT workspace_id::text FROM workspace_members
        WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
  );
