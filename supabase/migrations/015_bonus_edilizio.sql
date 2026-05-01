-- ============================================================
-- CARTA CANTA — Migration 015: Bonus Edilizio (Ecobonus/Sismabonus)
-- Aggiunge:
--   documents.bonus_edilizio TEXT  — tipo di bonus sul documento
--   document_items.bonus_tipo TEXT — classificazione voce (trainante/trainato)
-- Nessuna modifica alle colonne esistenti; dati storici invariati.
-- ============================================================

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS bonus_edilizio TEXT;
  -- valori: NULL | 'ecobonus' | 'sismabonus' | 'bonus_casa'

ALTER TABLE document_items
  ADD COLUMN IF NOT EXISTS bonus_tipo TEXT;
  -- valori: NULL | 'trainante' | 'trainato'
