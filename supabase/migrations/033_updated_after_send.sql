-- Migration 033: track when a sent document is modified after send
-- updated_after_send_at: set to NOW() when a sent/viewed doc is saved
-- sent_snapshot: frozen copy of fields+items at the moment of last send
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS updated_after_send_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_snapshot JSONB;
