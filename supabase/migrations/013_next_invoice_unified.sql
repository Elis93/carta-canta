-- ============================================================
-- Migration 013: Funzione next_invoice_number unificata
-- ============================================================
-- Consolida i tre overload separati (preventivo/fattura) in un'unica
-- funzione parametrica. Richiede migration 012 già applicata.
-- ============================================================

-- ── Rimuovi tutti gli overload esistenti ──────────────────────
DROP FUNCTION IF EXISTS next_invoice_number(UUID, SMALLINT);
DROP FUNCTION IF EXISTS next_invoice_number(UUID, INT);
DROP FUNCTION IF EXISTS next_fattura_number(UUID, INT);

-- ── Funzione unificata ────────────────────────────────────────
-- p_doc_type: 'preventivo' | 'fattura' (o qualsiasi seq_type futuro)
CREATE OR REPLACE FUNCTION next_invoice_number(
  p_workspace UUID,
  p_year      INT,
  p_doc_type  TEXT
)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_next INT;
BEGIN
  INSERT INTO invoice_sequences(workspace_id, year, last_number, seq_type)
  VALUES (p_workspace, p_year::SMALLINT, 1, p_doc_type)
  ON CONFLICT (workspace_id, year, seq_type)
  DO UPDATE SET last_number = invoice_sequences.last_number + 1
  RETURNING last_number INTO v_next;
  RETURN v_next;
END;
$$;
