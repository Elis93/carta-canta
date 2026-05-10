-- ============================================================
-- Migration 021: preset_key su templates
-- Aggiunge colonna preset_key ('classico' | 'bold' | 'tecnico' | 'elegante')
-- e migra i valori esistenti dalla colonna font_family.
-- ============================================================

ALTER TABLE templates
ADD COLUMN preset_key TEXT
  CHECK (preset_key IN ('classico', 'bold', 'tecnico', 'elegante'))
  DEFAULT 'classico';

-- Migra i template esistenti: mappa font_family → preset_key
UPDATE templates SET preset_key = CASE
  WHEN font_family = 'Georgia'   THEN 'elegante'
  WHEN font_family = 'GeistSans' THEN 'tecnico'
  ELSE 'classico'
END
WHERE preset_key IS NULL OR preset_key = 'classico';
