-- Migration 023: traccia il primo download PDF di una bozza
--
-- pdf_downloaded_at: timestamp del primo download PDF (NULL = mai scaricato).
-- Usato per:
--   1. Determinare lo stato del watermark (BOZZA vs NON ANCORA INVIATO).
--   2. Conteggio utilizzi mensili piano Free (5/mese):
--      - primo download PDF → consuma 1 utilizzo
--      - invio diretto (senza download prev.) → consuma 1 utilizzo al momento dell'invio
--      - invio dopo download → non consuma un secondo utilizzo

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS pdf_downloaded_at TIMESTAMPTZ;

COMMENT ON COLUMN documents.pdf_downloaded_at IS
  'Timestamp del primo download PDF della bozza. NULL = mai scaricata. '
  'Usato per il watermark e il conteggio utilizzi mensili Free.';
