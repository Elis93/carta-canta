-- Migration 029: traccia ultimo sollecito inviato manualmente
-- Aggiunge last_reminder_at a documents per mostrarlo nella dashboard.

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ;
