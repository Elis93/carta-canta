-- ============================================================
-- 067 — Congelamento FOTO del rapportino firmato a livello DATABASE
-- (gemello mancante della 057, chiude l'ultimo buco delle prove FES).
--
-- Il blocco app-level (documentHasSignedReport in lib/actions/sopralluoghi.ts)
-- impedisce già di aggiungere/cambiare/scollegare foto dalla UI quando il
-- rapportino è firmato; ma un titolare con una chiamata PostgREST diretta e
-- il proprio JWT poteva ancora alterare le foto che il cliente ha visto e
-- firmato. Questo trigger lo impedisce anche lì.
--
-- FILOSOFIA (identica alla 057): si blocca l'ALTERAZIONE IN LOCO e l'AGGIUNTA
-- delle prove, NON la cancellazione. Motivi:
--   • la cancellazione è azione visibile/recuperabile (come per i documenti
--     accettati nella 057, non bloccata);
--   • il purge del cestino (`purgeDeletedDocumentAction`) gira col CLIENT
--     UTENTE e cancella esplicitamente le foto orfane del documento — un
--     blocco sul DELETE lo romperebbe;
--   • la FK `document_id ON DELETE SET NULL` scatta durante il purge: quella
--     UPDATE cambia SOLO document_id → la lasciamo passare (non è
--     un'alterazione del contenuto visto dal cliente).
--
-- Il service_role bypassa (route di sistema, cancellazione account via admin).
-- Tollerante pre-053: senza la colonna report_signed_at il trigger non si crea.
-- Idempotente.
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lavori' AND column_name = 'report_signed_at'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'work_photos'
  ) THEN

    CREATE OR REPLACE FUNCTION protect_signed_report_photos()
    RETURNS TRIGGER AS $body$
    DECLARE
      v_doc uuid;
      v_signed timestamptz;
    BEGIN
      -- Route di sistema (service role): sempre consentite.
      IF current_user = 'service_role' THEN
        RETURN COALESCE(NEW, OLD);
      END IF;

      -- La cancellazione resta libera (purge del cestino + filosofia 057).
      IF TG_OP = 'DELETE' THEN
        RETURN OLD;
      END IF;

      -- Documento di riferimento della foto (per l'UPDATE che azzera
      -- document_id via FK, l'origine è in OLD).
      v_doc := COALESCE(NEW.document_id, OLD.document_id);
      IF v_doc IS NULL THEN
        RETURN NEW;
      END IF;

      SELECT report_signed_at INTO v_signed
        FROM lavori
        WHERE document_id = v_doc
          AND deleted_at IS NULL
          AND report_signed_at IS NOT NULL
        LIMIT 1;

      -- Rapportino non firmato → nessun blocco (uso normale del cantiere).
      IF v_signed IS NULL THEN
        RETURN NEW;
      END IF;

      IF TG_OP = 'INSERT' THEN
        RAISE EXCEPTION 'Il rapportino collegato è firmato: non si possono aggiungere foto.';
      END IF;

      -- UPDATE: si blocca SOLO se cambia ciò che il cliente ha visto/firmato
      -- (visibilità, etichetta, immagine). Il solo azzeramento di document_id
      -- (FK SET NULL durante il purge) NON è un'alterazione → consentito.
      IF NEW.visible_to_client IS DISTINCT FROM OLD.visible_to_client
         OR NEW.label IS DISTINCT FROM OLD.label
         OR NEW.storage_path IS DISTINCT FROM OLD.storage_path THEN
        RAISE EXCEPTION 'Il rapportino collegato è firmato: le foto non sono modificabili.';
      END IF;

      RETURN NEW;
    END;
    $body$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_protect_signed_report_photos ON work_photos;
    CREATE TRIGGER trg_protect_signed_report_photos
      BEFORE INSERT OR UPDATE OR DELETE ON work_photos
      FOR EACH ROW EXECUTE FUNCTION protect_signed_report_photos();

  END IF;
END $$;
