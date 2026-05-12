-- Migration 027: fix doc_seq generated column per invoice_prefix non-numerico
--
-- Problema: doc_seq usa split_part(doc_number, '/', 1)::INT.
-- Se il workspace ha invoice_prefix='Doc', doc_number diventa 'Doc001/2026'
-- e il cast 'Doc001'::INT fallisce con:
--   "invalid input syntax for type integer: Doc001"
--
-- Fix: prima di castare a INT, si rimuovono i caratteri non numerici
-- con regexp_replace. Risultato: 'Doc001' → '001' → 1.
-- Compatibile con il formato standard '001/2026' (nessun prefisso).
--
-- PostgreSQL non permette ALTER su colonne generate → DROP + ADD.
-- Va anche ricreato l'indice che dipende dalla colonna.

-- 1. Rimuovi indice che usa doc_seq
DROP INDEX IF EXISTS idx_documents_year_seq;

-- 2. Rimuovi colonna generata
ALTER TABLE documents DROP COLUMN IF EXISTS doc_seq;

-- 3. Ricrea con espressione robusta ai prefissi
ALTER TABLE documents
  ADD COLUMN doc_seq INT
  GENERATED ALWAYS AS (
    CASE
      WHEN doc_number IS NOT NULL AND doc_number LIKE '%/%'
      THEN NULLIF(
        regexp_replace(split_part(doc_number, '/', 1), '[^0-9]', '', 'g'),
        ''
      )::INT
      ELSE NULL
    END
  ) STORED;

-- 4. Ricrea indice
CREATE INDEX idx_documents_year_seq
  ON documents(workspace_id, doc_year DESC NULLS LAST, doc_seq DESC NULLS LAST);
