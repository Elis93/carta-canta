-- Migration 034: document change log
-- Traccia ogni modifica significativa al documento in un array JSONB.
-- Ogni entry: { "type": "modified" | "restored", "at": "<ISO timestamp>" }
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS document_log JSONB NOT NULL DEFAULT '[]';
