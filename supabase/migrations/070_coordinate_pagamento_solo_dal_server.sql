-- ============================================================
-- 070 — Le coordinate di pagamento si cambiano SOLO passando dall'app
--       (5 ago 2026)
--
-- PERCHÉ. Dalla ricerca del 5 agosto: per un gestionale di fatture il danno
-- peggiore non è "i dati rubati", è UN BONIFICO DIROTTATO (frode BEC: entrano,
-- cambiano l'IBAN su una fattura vera e aspettano). La contromisura che
-- abbiamo messo oggi è l'email di avviso a ogni cambio — ma vive dentro la
-- Server Action, e la Server Action non è l'unica strada per scrivere:
-- la policy `ws_update` (001) permette l'UPDATE su TUTTE le colonne a
-- chiunque sia membro del workspace. Con un access token rubato — cioè
-- esattamente lo scenario contro cui l'avviso esiste — bastava una chiamata
-- diretta a PostgREST per cambiare l'IBAN senza far partire nulla.
-- Aggiuntivo: un COLLABORATORE poteva cambiare le coordinate del titolare,
-- cosa che l'applicazione già gli vieta.
--
-- COSA FA. Un trigger (stesso schema della 057 per le colonne-prova) blocca
-- la modifica delle cinque colonne del riquadro "Come pagare" a chiunque non
-- sia il service role. L'unica strada resta `updateWorkspacePayments`, che
-- verifica di essere il TITOLARE, valida l'IBAN e manda l'avviso.
--
-- ⚠️ ORDINE: si applica DOPO il deploy del codice che scrive quelle colonne
-- con l'admin client. Applicata prima, il salvataggio dei pagamenti
-- risponderebbe "non riuscito" (nessun dato perso, ma l'artigiano non salva).
--
-- Idempotente. Nessuna colonna nuova. Tollerante pre-038: se le colonne dei
-- pagamenti non esistono, il trigger non viene creato.
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workspaces' AND column_name = 'payment_iban'
  ) THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION protect_payment_details()
      RETURNS TRIGGER AS $body$
      BEGIN
        IF current_user = 'service_role' THEN
          RETURN NEW;
        END IF;
        IF NEW.payment_iban          IS DISTINCT FROM OLD.payment_iban
           OR NEW.payment_iban_holder   IS DISTINCT FROM OLD.payment_iban_holder
           OR NEW.payment_paypal_url    IS DISTINCT FROM OLD.payment_paypal_url
           OR NEW.payment_satispay_url  IS DISTINCT FROM OLD.payment_satispay_url
           OR NEW.payment_notes         IS DISTINCT FROM OLD.payment_notes THEN
          RAISE EXCEPTION 'Le coordinate di pagamento si cambiano solo da Impostazioni.';
        END IF;
        RETURN NEW;
      END;
      $body$ LANGUAGE plpgsql;
    $fn$;

    DROP TRIGGER IF EXISTS trg_protect_payment_details ON workspaces;
    CREATE TRIGGER trg_protect_payment_details
      BEFORE UPDATE ON workspaces
      FOR EACH ROW EXECUTE FUNCTION protect_payment_details();
  END IF;
END $$;
