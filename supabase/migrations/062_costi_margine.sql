-- ============================================================
-- 062 — Costi e margine (PROGETTO_LISTINO_FORNITORE.md, Fase 1)
-- 1. catalog_items.unit_cost: quanto l'artigiano PAGA la voce
--    (facoltativo — chi non lo usa non cambia nulla).
-- 2. document_items.unit_cost: il costo si CONGELA sulla voce
--    del documento (il margine di un preventivo non deve
--    cambiare se poi si aggiorna il catalogo).
-- 3. convert_preventivo_to_fattura: trasporta anche unit_cost
--    (senza, la fattura convertita perdeva il margine).
-- 🔒 REGOLA (CLAUDE.md B.2): unit_cost NON deve MAI arrivare a
--    superfici viste dal cliente (PDF, /p, /r, email, snapshot).
--    Le route pubbliche non selezionano questa colonna.
-- Idempotente: rieseguibile senza danni.
-- ============================================================

ALTER TABLE catalog_items  ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(10,2);
ALTER TABLE document_items ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(10,2);

-- ── Conversione preventivo→fattura: copia anche il costo ────────────────
-- Identica alla 059 + unit_cost nella copia delle voci.
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
  v_ft_number    TEXT;
  v_new_doc_id   UUID;
BEGIN
  IF p_force_accept THEN
    UPDATE documents
    SET    status      = 'accepted',
           accepted_at = NOW()
    WHERE  id           = p_doc_id
      AND  doc_type     = 'preventivo'
      AND  status       IN ('draft', 'sent', 'viewed', 'rejected', 'expired')
      AND  deleted_at   IS NULL
      AND  is_workspace_member(workspace_id);
  END IF;

  SELECT workspace_id INTO v_workspace_id
  FROM documents
  WHERE id = p_doc_id
    AND doc_type = 'preventivo'
    AND status   = 'accepted'
    AND deleted_at IS NULL
    AND is_workspace_member(workspace_id);

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Documento non trovato o non convertibile';
  END IF;

  SELECT id INTO v_existing_id
  FROM documents
  WHERE origin_document_id = p_doc_id
    AND doc_type = 'fattura'
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  v_year := EXTRACT(YEAR FROM now())::SMALLINT;

  v_seq := next_invoice_number(v_workspace_id, v_year, 'fattura');

  v_ft_number := LPAD(v_seq::TEXT, 3, '0') || '/' || v_year::TEXT;

  INSERT INTO documents (
    workspace_id, client_id, template_snapshot, doc_type, status,
    doc_number, title, notes, internal_notes, document_language,
    validity_days, payment_terms, currency, exchange_rate,
    subtotal, discount_pct, discount_fixed, tax_amount, bollo_amount, total,
    vat_rate_default, ritenuta_pct, created_by,
    bonus_edilizio, deposit_type, deposit_value,
    origin_document_id
  )
  SELECT
    workspace_id, client_id, template_snapshot, 'fattura', 'draft',
    v_ft_number,
    COALESCE(title, ''), notes, internal_notes, document_language,
    validity_days, payment_terms, currency, exchange_rate,
    subtotal, discount_pct, discount_fixed, tax_amount, bollo_amount, total,
    vat_rate_default, ritenuta_pct, created_by,
    bonus_edilizio, deposit_type, deposit_value,
    p_doc_id
  FROM documents
  WHERE id = p_doc_id
  RETURNING id INTO v_new_doc_id;

  INSERT INTO document_items (
    document_id, sort_order, description, unit,
    quantity, unit_price, discount_pct, vat_rate, bonus_tipo, option_tier,
    unit_cost, total
  )
  SELECT
    v_new_doc_id, sort_order, description, unit,
    quantity, unit_price, discount_pct, vat_rate, bonus_tipo, option_tier,
    unit_cost, total
  FROM document_items
  WHERE document_id = p_doc_id;

  RETURN v_new_doc_id;
END;
$$;
