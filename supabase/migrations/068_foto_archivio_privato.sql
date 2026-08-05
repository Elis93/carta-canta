-- ============================================================
-- 068 — Le foto dei lavori in archivio PRIVATO (5 ago 2026)
--
-- PRIMA: il bucket `work-photos` era pubblico e le foto erano protette solo
-- dall'indirizzo casuale ({user_id}/{uuid}.jpg). Non enumerabile, ma
-- PERMANENTE: un indirizzo inoltrato, finito in una cronologia o in un
-- inoltro di posta restava valido per sempre.
--
-- DOPO: bucket privato. Tutte le superfici che mostrano foto (pagina del
-- cliente, rapportino, i due PDF, le anteprime in app) chiedono un indirizzo
-- FIRMATO che scade dopo un'ora — vedi lib/photos/signed-url.ts.
--
-- ⚠️ ORDINE: questa migration si applica DOPO il deploy del codice che firma
-- gli indirizzi.
--
-- ⚠️ CORREZIONE 5 ago (dopo la revisione): due cose scritte qui sotto erano
-- sbagliate e sono state riparate dalla 069.
--   1. Questa migration NON rendeva privato l'archivio: la policy della 041
--      ("Work photos are publicly readable", per TUTTI) non veniva rimossa, e
--      in PostgreSQL le policy permissive si sommano in OR. Vedi la 069.
--   2. Il rimedio "rimetti public = true" NON riporta indietro niente: il
--      codice che costruiva gli indirizzi pubblici è stato rimosso nello
--      stesso deploy, quindi l'applicazione continuerebbe comunque a chiedere
--      indirizzi firmati. La vera via d'uscita è il revert del deploy.
--
-- Idempotente.
-- ============================================================

-- ── 1. Lettura della PROPRIA cartella ───────────────────────────────────
-- Serve alle foto APPENA caricate dall'utente, di cui il browser conosce solo
-- il percorso e deve chiedere l'indirizzo firmato. Le foto già esistenti —
-- che in un team possono essere state caricate da un collaboratore — vengono
-- firmate dal server, che ha già verificato l'accesso al workspace.
-- Le policy di INSERT e DELETE (045) restano invariate.
DROP POLICY IF EXISTS "Authenticated users can read own work photos" ON storage.objects;
CREATE POLICY "Authenticated users can read own work photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'work-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── 2. L'archivio non è più pubblico ────────────────────────────────────
UPDATE storage.buckets SET public = false WHERE id = 'work-photos';

-- ── Come tornare indietro, se servisse ──────────────────────────────────
-- ⚠️ Questa riga da sola NON basta (vedi la correzione in testa al file):
-- l'applicazione non sa più costruire indirizzi pubblici. Serve il revert del
-- deploy del codice; questa riga è solo il pezzo lato database.
-- UPDATE storage.buckets SET public = true WHERE id = 'work-photos';
