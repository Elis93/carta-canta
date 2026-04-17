-- ============================================================
-- CARTA CANTA — Migration 002: Numerazione progressiva preventivi
-- ============================================================
-- Obiettivi:
--   1. Rende il campo `title` opzionale (NULL consentito)
--   2. Aggiunge colonne generate `doc_year` e `doc_seq` per ordinamento
--      corretto di numeri nel formato NNN/YYYY (es. 001/2026)
--   3. Aggiunge indice composito per list-query ottimizzata

-- ── 1. Title diventa nullable ────────────────────────────────────────────────
-- Il titolo libero è ora secondario; il numero progressivo è l'identificatore
-- principale del documento.
ALTER TABLE documents
  ALTER COLUMN title DROP NOT NULL;

ALTER TABLE documents
  ALTER COLUMN title SET DEFAULT NULL;

-- ── 2. Colonna generata: anno del documento ──────────────────────────────────
-- Estrae la parte YYYY da doc_number nel formato NNN/YYYY.
-- Restituisce NULL per righe senza doc_number o con formato non riconosciuto.
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS doc_year SMALLINT
  GENERATED ALWAYS AS (
    CASE
      WHEN doc_number IS NOT NULL AND doc_number LIKE '%/%'
      THEN NULLIF(split_part(doc_number, '/', 2), '')::SMALLINT
      ELSE NULL
    END
  ) STORED;

-- ── 3. Colonna generata: numero progressivo del documento ────────────────────
-- Estrae la parte NNN da doc_number nel formato NNN/YYYY.
-- Casting a INT permette ordinamento numerico (001 < 2 < 10 < 100).
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS doc_seq INT
  GENERATED ALWAYS AS (
    CASE
      WHEN doc_number IS NOT NULL AND doc_number LIKE '%/%'
      THEN NULLIF(split_part(doc_number, '/', 1), '')::INT
      ELSE NULL
    END
  ) STORED;

-- ── 4. Indice per ordinamento anno+numero ────────────────────────────────────
-- Usato dalla query lista preventivi: ORDER BY doc_year DESC, doc_seq DESC
-- NULLS LAST spinge i documenti senza numero in fondo.
CREATE INDEX IF NOT EXISTS idx_documents_year_seq
  ON documents(workspace_id, doc_year DESC NULLS LAST, doc_seq DESC NULLS LAST);
