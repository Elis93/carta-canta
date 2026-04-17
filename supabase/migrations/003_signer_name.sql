-- ============================================================
-- Migration 003: Aggiungi signer_name a documents
-- ============================================================

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS signer_name TEXT;
