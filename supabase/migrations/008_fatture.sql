-- ============================================================
-- CARTA CANTA — Migration 008: Fatture (doc_type, convert fn)
-- ============================================================

-- Aggiungi enum doc_type se non esiste già (il campo è TEXT nel 001)
-- doc_type è già TEXT NOT NULL DEFAULT 'preventivo' — lasciamo TEXT per flessibilità

-- Indice per filtrare per tipo
CREATE INDEX IF NOT EXISTS idx_documents_workspace_doctype
  ON documents(workspace_id, doc_type, status);

-- Funzione: converti preventivo accettato → fattura
-- Clona il documento con doc_type='fattura' e assegna numero fattura
CREATE OR REPLACE FUNCTION convert_preventivo_to_fattura(p_doc_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_workspace_id UUID;
  v_year         SMALLINT;
  v_seq          INT;
  v_prefix       TEXT;
  v_ft_number    TEXT;
  v_new_doc_id   UUID;
BEGIN
  -- Verifica che il documento esista, sia un preventivo accettato e appartenga al workspace
  SELECT workspace_id INTO v_workspace_id
  FROM documents
  WHERE id = p_doc_id
    AND doc_type = 'preventivo'
    AND status = 'accepted'
    AND is_workspace_member(workspace_id);

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Documento non trovato o non convertibile';
  END IF;

  -- Anno corrente e prefisso
  v_year := EXTRACT(YEAR FROM now())::SMALLINT;

  SELECT COALESCE(invoice_prefix, '') INTO v_prefix
  FROM workspaces WHERE id = v_workspace_id;

  -- Prossimo numero fattura
  INSERT INTO invoice_sequences(workspace_id, year, last_number)
  VALUES (v_workspace_id, v_year, 1)
  ON CONFLICT (workspace_id, year)
  DO UPDATE SET last_number = invoice_sequences.last_number + 1
  RETURNING last_number INTO v_seq;

  v_ft_number := v_prefix || LPAD(v_seq::TEXT, 3, '0') || '/' || v_year::TEXT;

  -- Clona documento
  INSERT INTO documents (
    workspace_id, client_id, template_snapshot, doc_type, status,
    doc_number, title, notes, internal_notes, document_language,
    validity_days, payment_terms, currency, exchange_rate,
    subtotal, discount_pct, discount_fixed, tax_amount, bollo_amount, total,
    vat_rate_default, ritenuta_pct, created_by
  )
  SELECT
    workspace_id, client_id, template_snapshot, 'fattura', 'draft',
    v_ft_number,
    COALESCE(title, ''), notes, internal_notes, document_language,
    validity_days, payment_terms, currency, exchange_rate,
    subtotal, discount_pct, discount_fixed, tax_amount, bollo_amount, total,
    vat_rate_default, ritenuta_pct, created_by
  FROM documents
  WHERE id = p_doc_id
  RETURNING id INTO v_new_doc_id;

  -- Clona voci
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
