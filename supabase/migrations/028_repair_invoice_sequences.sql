-- Migration 028: repair invoice_sequences + fix convert_preventivo_to_fattura
--
-- Problema: migration 012 (doc_type su invoice_sequences) non era stata
-- applicata in produzione. La colonna doc_type mancante causava:
--   "column doc_type of relation invoice_sequences does not exist"
-- al momento della chiamata di convert_preventivo_to_fattura.
--
-- Questo script è idempotente: sicuro da applicare indipendentemente da
-- quali migration 012/013 siano già state eseguite o meno.

-- 1. Aggiungi doc_type se non esiste
--    I record esistenti ricevono il DEFAULT 'preventivo' (retrocompatibile).
ALTER TABLE invoice_sequences
  ADD COLUMN IF NOT EXISTS doc_type TEXT NOT NULL DEFAULT 'preventivo';

-- 2. Ricrea la PK includendo doc_type.
--    Se la vecchia PK era (workspace_id, year): la sostituisce.
--    Se era già (workspace_id, year, doc_type): drop + re-add è un no-op.
ALTER TABLE invoice_sequences DROP CONSTRAINT IF EXISTS invoice_sequences_pkey;
ALTER TABLE invoice_sequences ADD PRIMARY KEY (workspace_id, year, doc_type);

-- 3. Aggiorna next_invoice_number per sequenze separate per tipo documento.
--    Parametro p_doc_type con DEFAULT 'preventivo' per retrocompatibilità.
CREATE OR REPLACE FUNCTION next_invoice_number(
  p_workspace UUID,
  p_year      SMALLINT,
  p_doc_type  TEXT DEFAULT 'preventivo'
)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE v_next INT;
BEGIN
  INSERT INTO invoice_sequences(workspace_id, year, doc_type, last_number)
  VALUES (p_workspace, p_year, p_doc_type, 1)
  ON CONFLICT (workspace_id, year, doc_type)
  DO UPDATE SET last_number = invoice_sequences.last_number + 1
  RETURNING last_number INTO v_next;
  RETURN v_next;
END;
$$;

-- 4. Aggiorna convert_preventivo_to_fattura.
--    Usa next_invoice_number() invece dell'INSERT diretto su invoice_sequences:
--    in questo modo non ha dipendenze dirette dallo schema della tabella.
CREATE OR REPLACE FUNCTION convert_preventivo_to_fattura(p_doc_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_workspace_id UUID;
  v_existing_id  UUID;
  v_year         SMALLINT;
  v_seq          INT;
  v_prefix       TEXT;
  v_ft_number    TEXT;
  v_new_doc_id   UUID;
BEGIN
  SELECT workspace_id INTO v_workspace_id
  FROM documents
  WHERE id = p_doc_id
    AND doc_type = 'preventivo'
    AND status = 'accepted'
    AND is_workspace_member(workspace_id);

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Documento non trovato o non convertibile';
  END IF;

  -- Idempotenza: se fattura già creata, restituiscila direttamente.
  SELECT id INTO v_existing_id
  FROM documents
  WHERE origin_document_id = p_doc_id
    AND doc_type = 'fattura'
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  v_year := EXTRACT(YEAR FROM now())::SMALLINT;

  SELECT COALESCE(invoice_prefix, '') INTO v_prefix
  FROM workspaces WHERE id = v_workspace_id;

  -- Alloca numero fattura dalla sequenza separata
  v_seq := next_invoice_number(v_workspace_id, v_year, 'fattura');

  v_ft_number := v_prefix || LPAD(v_seq::TEXT, 3, '0') || '/' || v_year::TEXT;

  INSERT INTO documents (
    workspace_id, client_id, template_snapshot, doc_type, status,
    doc_number, title, notes, internal_notes, document_language,
    validity_days, payment_terms, currency, exchange_rate,
    subtotal, discount_pct, discount_fixed, tax_amount, bollo_amount, total,
    vat_rate_default, ritenuta_pct, created_by,
    origin_document_id
  )
  SELECT
    workspace_id, client_id, template_snapshot, 'fattura', 'draft',
    v_ft_number,
    COALESCE(title, ''), notes, internal_notes, document_language,
    validity_days, payment_terms, currency, exchange_rate,
    subtotal, discount_pct, discount_fixed, tax_amount, bollo_amount, total,
    vat_rate_default, ritenuta_pct, created_by,
    p_doc_id
  FROM documents
  WHERE id = p_doc_id
  RETURNING id INTO v_new_doc_id;

  INSERT INTO document_items (
    document_id, sort_order, description, unit,
    quantity, unit_price, discount_pct, vat_rate, total
  )
  SELECT
    v_new_doc_id, sort_order, description, unit,
    quantity, unit_price, discount_pct, vat_rate, total
  FROM document_items
  WHERE document_id = p_doc_id;

  RETURN v_new_doc_id;
END;
$$;
