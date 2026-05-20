-- Migration 032: rimuovi il vecchio overload INT di next_invoice_number
--
-- Problema: migration 013 aveva creato next_invoice_number(UUID, INT, TEXT)
-- che usava la colonna seq_type (rinominata in doc_type dalla 028).
-- Migration 028 ha aggiunto next_invoice_number(UUID, SMALLINT, TEXT) ma
-- non ha eliminato il vecchio overload INT.
--
-- Risultato: quando JavaScript passa p_year come integer (2026), PostgreSQL
-- sceglie l'overload INT — quello vecchio — che fallisce perché la colonna
-- seq_type non esiste più. L'overload SMALLINT (corretto) non viene mai usato.
--
-- Fix: elimina l'overload INT e ri-crea la versione SMALLINT con SECURITY DEFINER.

-- 1. Elimina il vecchio overload INT
DROP FUNCTION IF EXISTS next_invoice_number(UUID, INT, TEXT);
DROP FUNCTION IF EXISTS next_invoice_number(UUID, INTEGER, TEXT);

-- 2. Ri-crea l'unica versione corretta con SECURITY DEFINER + GREATEST anti-gap
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
  -- Calcola il MAX già usato tra i documenti non eliminati (anti-gap)
  SELECT COALESCE(MAX(doc_seq), 0)
    INTO v_max_seq
    FROM documents
   WHERE workspace_id = p_workspace
     AND doc_year     = p_year
     AND doc_type     = p_doc_type
     AND deleted_at IS NULL;

  INSERT INTO invoice_sequences (workspace_id, year, doc_type, last_number)
  VALUES (p_workspace, p_year, p_doc_type, GREATEST(v_max_seq, 0) + 1)
  ON CONFLICT (workspace_id, year, doc_type)
  DO UPDATE
     SET last_number = GREATEST(
           invoice_sequences.last_number + 1,
           EXCLUDED.last_number
         )
  RETURNING last_number INTO v_next;

  RETURN v_next;
END;
$$ SET search_path = public;

REVOKE ALL ON FUNCTION next_invoice_number(UUID, SMALLINT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION next_invoice_number(UUID, SMALLINT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION next_invoice_number(UUID, SMALLINT, TEXT) TO service_role;
