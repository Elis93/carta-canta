-- ============================================================
-- 057 — Irrobustimento SICUREZZA a livello DATABASE (audit 24 lug 2026)
-- Due lucchetti che il blocco solo-app non garantisce:
--   1) sdi_usage: l'utente non può più manomettere i propri contatori
--      (limite Free 8-a-vita, kill-switch di spesa) → solo lettura.
--   2) colonne-PROVA (FES) di documenti e rapportini: scrivibili SOLO dal
--      service role (le route pubbliche /p/[token]/accept e /r/[token]/sign).
--      Un titolare, con una chiamata PostgREST diretta e il proprio JWT, NON
--      può più FABBRICARE né ALTERARE la firma/accettazione del cliente, né
--      le voci di un documento già accettato.
-- Idempotente. Nessuna colonna nuova.
-- ============================================================

-- ── 1) sdi_usage: sola lettura per gli utenti; scritture via service role ──
-- Le scritture reali passano già da createAdminClient() (lib/sdi/quota.ts:
-- recordSdiUse + il conteggio), che bypassa la RLS. La vecchia policy FOR ALL
-- lasciava però l'utente libero di DELETE/INSERT le proprie righe.
DROP POLICY IF EXISTS "sdi_usage_workspace" ON sdi_usage;
CREATE POLICY "sdi_usage_select" ON sdi_usage
  FOR SELECT
  USING (workspace_id IN (SELECT my_workspace_ids()));
-- Nessuna policy INSERT/UPDATE/DELETE per authenticated → solo service role.

-- ── 2a) Colonne-prova FES sui DOCUMENTI ─────────────────────
-- signer_name / accepted_ip / accepted_ua / signature_image sono scritte
-- SOLO da app/api/p/[token]/accept (service role). Un utente non le scrive
-- mai legittimamente: l'accettazione MANUALE tocca solo status/accepted_at
-- (non incluse qui → "Riporta in bozza" e "Segna accettato" restano liberi).
CREATE OR REPLACE FUNCTION protect_document_evidence()
RETURNS TRIGGER AS $$
BEGIN
  IF current_user = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NEW.signer_name     IS DISTINCT FROM OLD.signer_name
     OR NEW.accepted_ip  IS DISTINCT FROM OLD.accepted_ip
     OR NEW.accepted_ua  IS DISTINCT FROM OLD.accepted_ua
     OR NEW.signature_image IS DISTINCT FROM OLD.signature_image THEN
    RAISE EXCEPTION 'Le prove di accettazione del cliente (firma/IP) non sono modificabili.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_document_evidence ON documents;
CREATE TRIGGER trg_protect_document_evidence
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION protect_document_evidence();

-- ── 2b) Voci di un documento ACCETTATO ──────────────────────
-- Bloccate a livello DB per gli utenti quando il documento è 'accepted'
-- (la pulizia dei tier non scelti in fase di accettazione passa dal service
-- role → bypassata; l'editing normale avviene su 'draft'/'sent'/'viewed').
CREATE OR REPLACE FUNCTION protect_accepted_document_items()
RETURNS TRIGGER AS $$
DECLARE
  v_status text;
BEGIN
  IF current_user = 'service_role' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  SELECT status INTO v_status FROM documents
    WHERE id = COALESCE(NEW.document_id, OLD.document_id);
  IF v_status = 'accepted' THEN
    RAISE EXCEPTION 'Le voci di un documento accettato non sono modificabili.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_accepted_items ON document_items;
CREATE TRIGGER trg_protect_accepted_items
  BEFORE INSERT OR UPDATE OR DELETE ON document_items
  FOR EACH ROW EXECUTE FUNCTION protect_accepted_document_items();

-- ── 2c) Colonne-prova del RAPPORTINO firmato (lavori) ───────
-- report_signed_at / report_signer_name / report_signature_image scritte
-- SOLO da app/api/r/[token]/sign (service role). Tollerante pre-053: se le
-- colonne non esistono, il trigger si salta.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lavori' AND column_name = 'report_signed_at'
  ) THEN
    CREATE OR REPLACE FUNCTION protect_report_evidence()
    RETURNS TRIGGER AS $body$
    BEGIN
      IF current_user = 'service_role' THEN
        RETURN NEW;
      END IF;
      IF NEW.report_signed_at        IS DISTINCT FROM OLD.report_signed_at
         OR NEW.report_signer_name   IS DISTINCT FROM OLD.report_signer_name
         OR NEW.report_signature_image IS DISTINCT FROM OLD.report_signature_image THEN
        RAISE EXCEPTION 'La firma del rapportino non è modificabile.';
      END IF;
      RETURN NEW;
    END;
    $body$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_protect_report_evidence ON lavori;
    CREATE TRIGGER trg_protect_report_evidence
      BEFORE UPDATE ON lavori
      FOR EACH ROW EXECUTE FUNCTION protect_report_evidence();
  END IF;
END $$;
