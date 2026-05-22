-- 034_client_surname.sql
-- Aggiunge il cognome separato alla tabella clients.
-- Il campo `name` rimane "Nome / Ragione sociale" (obbligatorio).
-- Il campo `surname` è "Cognome" (opzionale — vuoto per aziende/liberi professionisti).
--
-- search_vector viene ricreata per includere surname nella ricerca full-text.

-- 1. Aggiungi colonna surname
ALTER TABLE clients ADD COLUMN IF NOT EXISTS surname TEXT;

-- 2. Ricrea la colonna search_vector per includere surname
--    (GENERATED ALWAYS AS STORED non si può alterare inline: va eliminata e ricreata)
ALTER TABLE clients DROP COLUMN IF EXISTS search_vector;

ALTER TABLE clients ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('italian',
      coalesce(name,    '') || ' ' ||
      coalesce(surname, '') || ' ' ||
      coalesce(email,   '') || ' ' ||
      coalesce(phone,   '')
    )
  ) STORED;

-- 3. Ricrea indice GIN (era già presente, DROP COLUMN lo ha rimosso automaticamente)
CREATE INDEX IF NOT EXISTS idx_clients_search ON clients USING GIN(search_vector);
