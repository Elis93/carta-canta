-- ============================================================
-- 014_ateco_codes_array
-- Aggiunge il campo ateco_codes TEXT[] per supportare più codici ATECO.
-- Il vecchio ateco_code TEXT rimane per retrocompatibilità (verrà rimosso
-- in una migrazione futura una volta che la nuova colonna è stabile).
-- ============================================================

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS ateco_codes TEXT[] NOT NULL DEFAULT '{}';

-- Migra i dati esistenti: chi aveva un codice singolo lo porta nell'array
UPDATE workspaces
  SET ateco_codes = ARRAY[ateco_code]
  WHERE ateco_code IS NOT NULL
    AND ateco_code <> ''
    AND (ateco_codes IS NULL OR ateco_codes = '{}');
