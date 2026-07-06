-- ============================================================
-- 045 — FIX SICUREZZA (audit completo app, 6 lug 2026)
--
-- 1. Storage work-photos: upload e cancellazione SOLO nella propria
--    cartella ({user_id}/...) — prima qualsiasi utente autenticato
--    poteva caricare/cancellare file di chiunque nel bucket.
-- 2. reviews: l'artigiano può aggiornare SOLO reported_at/report_reason
--    (segnalazione) — prima la policy UPDATE permetteva di modificare
--    anche le stelle e il nome del recensore.
-- 3. marketplace_profiles: enabled/published_at/vies_checked_at non sono
--    più scrivibili dal client — la pubblicazione passa SOLO dal server
--    dopo i controlli automatici (VIES + email + profilo completo).
-- 4. marketplace_requests: dal client si aggiorna solo lo stato
--    (Nuova/Letta/Risposta) — inserimenti solo server-side.
-- ============================================================

-- ── 1. Storage work-photos: scope alla cartella dell'utente ────────────
DROP POLICY IF EXISTS "Authenticated users can upload work photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload work photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'work-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Authenticated users can delete work photos" ON storage.objects;
CREATE POLICY "Authenticated users can delete work photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'work-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── 2. reviews: grant a livello di colonna ──────────────────────────────
-- Le RLS di 042 restano (visibilità per workspace); qui si limita COSA
-- si può scrivere. INSERT/DELETE restano solo al service role.
REVOKE INSERT, UPDATE, DELETE ON reviews FROM authenticated;
GRANT UPDATE (reported_at, report_reason) ON reviews TO authenticated;

-- ── 3. marketplace_profiles: colonne privilegiate solo service-role ────
-- Il client salva la bozza del profilo (upsert dei campi descrittivi);
-- enabled/published_at/vies_checked_at si scrivono solo dal server.
REVOKE INSERT, UPDATE, DELETE ON marketplace_profiles FROM authenticated;
GRANT INSERT (workspace_id, public_name, trade, city, radius_km, phone, bio, updated_at)
  ON marketplace_profiles TO authenticated;
GRANT UPDATE (workspace_id, public_name, trade, city, radius_km, phone, bio, updated_at)
  ON marketplace_profiles TO authenticated;

-- ── 4. marketplace_requests: dal client solo il cambio stato ───────────
REVOKE INSERT, UPDATE, DELETE ON marketplace_requests FROM authenticated;
GRANT UPDATE (status) ON marketplace_requests TO authenticated;
