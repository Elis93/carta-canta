-- ============================================================
-- 046 — CESTINO: le funzioni SQL ignorano i documenti cestinati
-- (audit QA 6 lug 2026 — simulazione percorsi). Idempotente.
--
-- 1. expire_overdue_documents: non marcare 'expired' i documenti nel
--    cestino (il cron li transizionava e partivano promemoria).
-- 2. convert_preventivo_to_fattura: un preventivo cestinato non è
--    convertibile; l'idempotenza non deve restituire una fattura
--    cestinata (bloccava per sempre la riconversione). In più le voci
--    copiate portano con sé option_tier (041) e bonus_tipo.
-- Basata testualmente sulla definizione della 030 + filtri deleted_at.
-- ============================================================

-- ── 1. Scadenze: solo documenti attivi ──────────────────────────────────
CREATE OR REPLACE FUNCTION expire_overdue_documents()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  updated_count INT;
BEGIN
  UPDATE documents
  SET status = 'expired'
  WHERE status IN ('sent', 'viewed')
    AND expires_at IS NOT NULL
    AND expires_at < NOW()
    AND deleted_at IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- ── 2. Conversione: mai da/verso il cestino ─────────────────────────────
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

  SELECT COALESCE(invoice_prefix, '') INTO v_prefix
  FROM workspaces WHERE id = v_workspace_id;

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
