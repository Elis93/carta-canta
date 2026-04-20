-- Migration 010: aggiunge il motivo di rifiuto al documento
-- Applicare su Supabase via SQL Editor o CLI.

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
