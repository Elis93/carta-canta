-- ============================================================
-- Migration 012: Sequenze numerazione separate per doc_type
-- ============================================================
-- Problema: preventivi e fatture condividevano la stessa
-- sequenza numerica → la prima fattura riceveva il numero
-- successivo ai preventivi invece di partire da 001.
--
-- Soluzione: aggiunta colonna doc_type alla PK di
-- invoice_sequences → sequenze indipendenti per tipo.
-- La funzione next_invoice_number accetta ora p_doc_type.
-- convert_preventivo_to_fattura usa la sequenza 'fattura'.
-- ============================================================

-- 1. Aggiungi colonna doc_type (default 'preventivo' → migrazione dati trasparente)
ALTER TABLE invoice_sequences
  ADD COLUMN IF NOT EXISTS doc_type TEXT NOT NULL DEFAULT 'preventivo';

-- 2. Rimuovi la vecchia PK (workspace_id, year)
ALTER TABLE invoice_sequences DROP CONSTRAINT IF EXISTS invoice_sequences_pkey;

-- 3. Crea la nuova PK che include doc_type
ALTER TABLE invoice_sequences
  ADD PRIMARY KEY (workspace_id, year, doc_type);

-- 4. Aggiorna la funzione next_invoice_number
--    Parametro opzionale p_doc_type (default 'preventivo') per retrocompatibilità.
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

-- 5. Aggiorna convert_preventivo_to_fattura per usare la sequenza 'fattura'
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
  SELECT workspace_id INTO v_workspace_id
  FROM documents
  WHERE id = p_doc_id
    AND doc_type = 'preventivo'
    AND status = 'accepted'
    AND is_workspace_member(workspace_id);

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Documento non trovato o non convertibile';
  END IF;

  v_year := EXTRACT(YEAR FROM now())::SMALLINT;

  SELECT COALESCE(invoice_prefix, '') INTO v_prefix
  FROM workspaces WHERE id = v_workspace_id;

  -- Usa la sequenza dedicata alle fatture (separata dai preventivi)
  INSERT INTO invoice_sequences(workspace_id, year, doc_type, last_number)
  VALUES (v_workspace_id, v_year, 'fattura', 1)
  ON CONFLICT (workspace_id, year, doc_type)
  DO UPDATE SET last_number = invoice_sequences.last_number + 1
  RETURNING last_number INTO v_seq;

  -- Formato: {prefix}NNN/YYYY  (es. "001/2026" o "FT-001/2026")
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
