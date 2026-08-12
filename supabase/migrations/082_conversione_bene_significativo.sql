-- ============================================================
-- 082 — La conversione preventivo→fattura perdeva «bene significativo»
--
-- TROVATO al ricontrollo del 12 ago 2026: `convert_preventivo_to_fattura`
-- (ultima definizione nella 062) copia le voci COLONNA PER COLONNA, e la
-- colonna `bene_significativo` (081) non è nell'elenco. Un preventivo con la
-- caldaia marcata diventava una fattura SENZA la marcatura: niente split
-- 10/22, niente dicitura dell'art. 1 c.19 L. 205/2017 — e siccome la
-- conversione ricalcola i totali sulle voci copiate, la fattura nasceva con
-- MENO IVA del dovuto. Proprio sul documento fiscale, quello che conta.
--
-- Il resto della funzione è IDENTICO alla 062 (che a sua volta aveva
-- aggiunto unit_cost per lo stesso motivo): cambia solo l'elenco colonne
-- dell'INSERT delle voci.
--
-- Idempotente: CREATE OR REPLACE, si può rilanciare il file intero.
-- ⚠️ Richiede la 081 già applicata (la colonna deve esistere).
-- ============================================================

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

  -- ⚠️ `bene_significativo` DEVE viaggiare con la voce: è ciò che fa
  -- scattare lo split 10/22 e la dicitura di legge sulla fattura.
  INSERT INTO document_items (
    document_id, sort_order, description, unit,
    quantity, unit_price, discount_pct, vat_rate, bonus_tipo, option_tier,
    unit_cost, bene_significativo, total
  )
  SELECT
    v_new_doc_id, sort_order, description, unit,
    quantity, unit_price, discount_pct, vat_rate, bonus_tipo, option_tier,
    unit_cost, bene_significativo, total
  FROM document_items
  WHERE document_id = p_doc_id;

  RETURN v_new_doc_id;
END;
$$;
