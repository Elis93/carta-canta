-- ============================================================
-- 059 — Fix dominio FATTURE (audit 25 lug 2026, 4 revisori)
-- 1. Indice unico numeri documento CON doc_type: preventivi e
--    fatture hanno sequenze separate ma condividevano l'unicità
--    su (workspace_id, doc_number) → alla prima sovrapposizione
--    di numeri (fattura 014/2026 con preventivo 014/2026) la
--    creazione della fattura falliva con 23505 senza uscita.
-- 2. convert_preventivo_to_fattura: trasporta anche
--    bonus_edilizio e l'acconto impostato (deposit_type/value),
--    e NON usa più invoice_prefix (allocateInvoiceNumber non lo
--    usa: due formati nella stessa serie, e il form lo perdeva
--    al primo salvataggio).
-- 3. increment_sent_quota: incremento ATOMICO del contatore
--    "8 preventivi Free" (il read-modify-write applicativo
--    perdeva incrementi con invii concorrenti).
-- Idempotente: rieseguibile senza danni.
-- ============================================================

-- ── 1. Unicità numeri per TIPO documento ────────────────────────────────
DROP INDEX IF EXISTS idx_doc_number_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_doc_number_type_unique
  ON documents(workspace_id, doc_type, doc_number)
  WHERE doc_number IS NOT NULL;

-- ── 2. Conversione: bonus/acconto trasportati, niente prefisso ──────────
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

  -- Idempotenza: solo fatture ATTIVE (una fattura nel cestino non deve
  -- bloccare per sempre la riconversione del preventivo)
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

  -- Formato identico ad allocateInvoiceNumber ({NNN}/{YYYY}, B.3):
  -- l'invoice_prefix generava un secondo formato nella stessa serie
  -- e il form lo spogliava al primo salvataggio.
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
    quantity, unit_price, discount_pct, vat_rate, bonus_tipo, option_tier, total
  )
  SELECT
    v_new_doc_id, sort_order, description, unit,
    quantity, unit_price, discount_pct, vat_rate, bonus_tipo, option_tier, total
  FROM document_items
  WHERE document_id = p_doc_id;

  RETURN v_new_doc_id;
END;
$$;

-- ── 3. Contatore Free atomico ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_sent_quota(p_workspace_id UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE workspaces
  SET sent_quota_used = COALESCE(sent_quota_used, 0) + 1
  WHERE id = p_workspace_id
    AND is_workspace_member(id);
$$;
