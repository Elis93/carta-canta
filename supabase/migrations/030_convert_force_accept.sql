-- Migration 030: convert_preventivo_to_fattura — aggiunge p_force_accept
--
-- Problema: la conversione da preventivo non-accettato falliva con
-- "Il preventivo deve essere accettato" anche quando l'utente aveva
-- cliccato "Procedi comunque".
--
-- Causa radice: la route HTTP tentava un UPDATE separato su documents
-- prima di chiamare l'RPC, ma questo UPDATE poteva essere bloccato da RLS
-- o causare race condition. Ora l'aggiornamento dello status avviene
-- DENTRO la funzione SECURITY DEFINER — atomico e senza RLS.
--
-- Questa migration è idempotente (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION convert_preventivo_to_fattura(
  p_doc_id       UUID,
  p_force_accept BOOLEAN DEFAULT FALSE
)
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
  -- Se force_accept=true, aggiorna lo status ad 'accepted' prima del check.
  -- La funzione è SECURITY DEFINER → non soggetta a RLS, ma il WHERE
  -- con is_workspace_member() garantisce che solo documenti del workspace
  -- dell'utente chiamante vengano modificati.
  IF p_force_accept THEN
    UPDATE documents
    SET    status      = 'accepted',
           accepted_at = NOW()
    WHERE  id           = p_doc_id
      AND  doc_type     = 'preventivo'
      AND  status       IN ('draft', 'sent', 'viewed', 'rejected', 'expired')
      AND  is_workspace_member(workspace_id);
  END IF;

  -- Verifica che il documento esista, sia del workspace e sia accepted
  SELECT workspace_id INTO v_workspace_id
  FROM documents
  WHERE id = p_doc_id
    AND doc_type = 'preventivo'
    AND status   = 'accepted'
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
