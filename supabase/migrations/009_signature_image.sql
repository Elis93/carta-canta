-- Migration 009: Aggiungi signature_image a documents
-- Salva la firma grafica del cliente come PNG base64 (typically 3-15 KB).

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS signature_image TEXT;
