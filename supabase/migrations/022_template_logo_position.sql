-- 022_template_logo_position.sql
-- Aggiunge posizione logo (left|right) e formato numerazione custom ai template.

ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS logo_position TEXT DEFAULT 'left'
    CHECK (logo_position IN ('left', 'right')),
  ADD COLUMN IF NOT EXISTS number_format TEXT;

COMMENT ON COLUMN templates.logo_position IS 'Posizione del logo nell''header del PDF: left | right';
COMMENT ON COLUMN templates.number_format IS 'Formato personalizzato numero documento (prossimamente)';
