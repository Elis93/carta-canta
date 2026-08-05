-- ============================================================
-- 069 — L'archivio foto era rimasto APERTO (5 ago 2026)
--
-- ⚠️ CORREZIONE DELLA 068. La 068 ha reso privato il bucket `work-photos` e
-- ha aggiunto la policy "leggi solo la tua cartella", ma NON ha rimosso quella
-- della 041:
--
--   CREATE POLICY "Work photos are publicly readable"
--     ON storage.objects FOR SELECT TO public
--     USING (bucket_id = 'work-photos');
--
-- In PostgreSQL le policy permissive si sommano in OR: finché quella resta,
-- la nuova non restringe NULLA. Il flag `public = false` del bucket chiude
-- solo l'indirizzo /object/public (ed è la parte che si vede subito, per
-- questo il collaudo sembrava a posto); gli altri canali dello storage
-- autorizzano invece con la RLS e il JWT di chi chiama. Siccome la chiave
-- anon è pubblica per costruzione (sta nel JavaScript del sito), con quella
-- chiave chiunque poteva:
--   • /object/list/work-photos      → sfogliare l'elenco di TUTTE le cartelle
--   • /object/sign/work-photos/...  → farsi firmare da sé qualsiasi foto
--   • /object/authenticated/...     → scaricarla
-- Cioè le foto di cantiere di tutti gli artigiani, senza nemmeno un account.
-- E rispetto a prima era peggio: prima serviva indovinare l'indirizzo
-- casuale, dopo la 068 l'elenco si poteva chiedere.
--
-- Qui si toglie la policy della 041. Verificato che nessun percorso
-- dell'applicazione ha bisogno di leggere le foto ALTRUI dal browser:
--   • le pagine che le mostrano ricevono gli indirizzi già firmati dal
--     server con la chiave di servizio (che non passa dalla RLS);
--   • il browser firma solo le foto che l'utente ha appena caricato, che
--     stanno nella sua cartella → basta la policy della 068;
--   • caricamento e cancellazione passano dalle policy INSERT/DELETE della
--     045, che questa migration non tocca.
--
-- Idempotente.
-- ============================================================

DROP POLICY IF EXISTS "Work photos are publicly readable" ON storage.objects;

-- Rete di sicurezza: se la 068 non fosse stata applicata, senza la policy
-- qui sotto nessuno potrebbe più firmare nemmeno le proprie foto.
DROP POLICY IF EXISTS "Authenticated users can read own work photos" ON storage.objects;
CREATE POLICY "Authenticated users can read own work photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'work-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Il bucket resta privato (la 068 lo ha già impostato; qui è idempotenza).
UPDATE storage.buckets SET public = false WHERE id = 'work-photos';
