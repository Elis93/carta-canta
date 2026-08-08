-- ============================================================
-- 076 — La richiesta della vetrina ricorda il preventivo che ne è nato
--
-- PERCHÉ (Eli, 8 ago 2026): *"se da una richiesta che ho avuto dal marketplace
-- clicco su crea preventivo e lo trasformo in preventivo, in alto a destra
-- voglio che sia segnata come preventivo fatto"*. Senza, tornando in Richieste
-- non si distingue una richiesta ancora da lavorare da una già preventivata.
--
-- ⚠️ Il collegamento si scrive quando il preventivo viene CREATO davvero, non
-- quando si apre il form: aprire e poi cambiare idea non deve lasciare una
-- richiesta segnata come fatta.
--
-- `ON DELETE SET NULL`: se il preventivo finisce nel cestino e poi viene
-- cancellato per sempre, la richiesta resta — torna semplicemente "da fare",
-- che è la verità.
--
-- Idempotente: si può rilanciare il file intero senza effetti.
-- ============================================================

ALTER TABLE public.marketplace_requests
  ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.marketplace_requests.document_id IS
  'Preventivo nato da questa richiesta (076). NULL = nessun preventivo ancora. Scritto alla creazione del documento, non all''apertura del form.';

CREATE INDEX IF NOT EXISTS marketplace_requests_document_id_idx
  ON public.marketplace_requests (document_id)
  WHERE document_id IS NOT NULL;

-- ⚠️ GRANT PER COLONNA: `marketplace_requests` ha i GRANT elencati colonna per
-- colonna (045). Una colonna nuova NON è compresa, e senza questo blocco
-- l'UPDATE fallirebbe con 42501 — facendo fallire l'INTERA scrittura, non solo
-- questo campo. È il bug rimasto latente un mese a giugno: qui non si ripete.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.column_privileges
    WHERE table_schema = 'public' AND table_name = 'marketplace_requests' AND grantee = 'authenticated'
  ) THEN
    EXECUTE 'GRANT UPDATE (document_id) ON public.marketplace_requests TO authenticated';
    EXECUTE 'GRANT SELECT (document_id) ON public.marketplace_requests TO authenticated';
  END IF;
END $$;
