-- Migration 026: collegamento bidirezionale preventivo → fattura
-- origin_document_id: sulla fattura punta al preventivo di origine.
-- Permette di:
--   1. Risalire dal preventivo alla fattura già creata (no doppie conversioni).
--   2. Mostrare il link "Generata dal preventivo #X" nella fattura.
-- ON DELETE SET NULL: se il preventivo viene eliminato, la fattura rimane ma perde il link.

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS origin_document_id UUID REFERENCES documents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documents_origin
  ON documents(origin_document_id)
  WHERE origin_document_id IS NOT NULL;

-- Aggiorna convert_preventivo_to_fattura:
-- 1. Idempotente: se la fattura esiste già (non eliminata), la restituisce senza creare duplicati.
-- 2. Imposta origin_document_id sulla nuova fattura.
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

  -- Idempotenza: se esiste già una fattura collegata, restituiscila direttamente.
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

  INSERT INTO invoice_sequences(workspace_id, year, doc_type, last_number)
  VALUES (v_workspace_id, v_year, 'fattura', 1)
  ON CONFLICT (workspace_id, year, doc_type)
  DO UPDATE SET last_number = invoice_sequences.last_number + 1
  RETURNING last_number INTO v_seq;

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
