-- ============================================================
-- Migration 030 — Fix next_invoice_number: SECURITY DEFINER + MAX seq
--
-- Problema 1 (Fix-19): la funzione non era SECURITY DEFINER, quindi
-- veniva eseguita con i permessi del chiamante. Se la Route Handler
-- chiama supabase.rpc() con l'auth dell'utente e le policy RLS su
-- invoice_sequences non permettono INSERT, l'allocazione fallisce.
--
-- Problema 2 (Fix-3): la funzione usava last_number + 1, senza
-- considerare doc_seq già presenti (es. documenti con numero manuale
-- più alto). GREATEST(...) garantisce che il prossimo numero non
-- sia mai inferiore al massimo già usato.
-- ============================================================

CREATE OR REPLACE FUNCTION next_invoice_number(
  p_workspace UUID,
  p_year      SMALLINT,
  p_doc_type  TEXT DEFAULT 'preventivo'
)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_next       INT;
  v_max_seq    INT;
BEGIN
  -- Calcola il MAX già usato tra i documenti non eliminati
  SELECT COALESCE(MAX(doc_seq), 0)
    INTO v_max_seq
    FROM documents
   WHERE workspace_id = p_workspace
     AND doc_year     = p_year
     AND doc_type     = p_doc_type
     AND deleted_at IS NULL;

  -- Inserisce o aggiorna la sequenza, garantendo monotonia
  INSERT INTO invoice_sequences (workspace_id, year, doc_type, last_number)
  VALUES (p_workspace, p_year, p_doc_type, GREATEST(v_max_seq, 0) + 1)
  ON CONFLICT (workspace_id, year, doc_type)
  DO UPDATE
     SET last_number = GREATEST(
           invoice_sequences.last_number + 1,
           EXCLUDED.last_number          -- = v_max_seq + 1
         )
  RETURNING last_number INTO v_next;

  RETURN v_next;
END;
$$ SET search_path = public;

-- Assicura che solo il sistema possa eseguire la funzione via service role.
-- Gli utenti autenticati la chiamano tramite rpc() e la SECURITY DEFINER
-- garantisce i permessi necessari su invoice_sequences indipendentemente
-- dalle policy RLS dell'utente.
REVOKE ALL ON FUNCTION next_invoice_number(UUID, SMALLINT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION next_invoice_number(UUID, SMALLINT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION next_invoice_number(UUID, SMALLINT, TEXT) TO service_role;
