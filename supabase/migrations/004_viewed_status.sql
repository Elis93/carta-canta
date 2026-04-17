-- ============================================================
-- Migration 004: Stato "viewed" + funzione scadenza automatica
-- ============================================================

-- 1. Aggiunge il valore 'viewed' all'enum doc_status
ALTER TYPE doc_status ADD VALUE IF NOT EXISTS 'viewed' AFTER 'sent';

-- 2. Funzione che scade i documenti con expires_at superato
--    Usata dal cron job /api/cron/expire-documents
CREATE OR REPLACE FUNCTION expire_overdue_documents()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  updated_count INT;
BEGIN
  UPDATE documents
  SET status = 'expired'
  WHERE status IN ('sent', 'viewed')
    AND expires_at IS NOT NULL
    AND expires_at < NOW();
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- 3. (Opzionale) Se pg_cron è abilitato sul progetto Supabase,
--    decommenta per eseguire automaticamente ogni notte alle 02:00 UTC:
-- SELECT cron.schedule(
--   'expire-overdue-documents',
--   '0 2 * * *',
--   $$ SELECT expire_overdue_documents() $$
-- );
