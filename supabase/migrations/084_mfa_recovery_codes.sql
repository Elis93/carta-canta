-- ============================================================
-- 084 — Codici di recupero del 2FA (15 ago 2026)
--
-- PERCHÉ. La verifica in due passaggi (TOTP) di Supabase non prevede codici di
-- recupero. Senza, chi perde o resetta il telefono con l'app Authenticator
-- resta CHIUSO FUORI dal proprio account — con dentro le sue fatture. I codici
-- di recupero sono la rete di sicurezza decisa con Eli (15 ago): alla
-- configurazione se ne mostrano 10, l'utente li salva, e uno di essi permette
-- di rientrare (disattivando il 2FA, che poi si riconfigura).
--
-- ⚠️ Si salva SOLO l'impronta SHA-256 del codice, mai il codice in chiaro: se
-- il registro trapelasse non deve contenere un secondo fattore utilizzabile.
--
-- RLS attiva SENZA policy: nessun accesso dal client, si passa solo dal server
-- con la chiave di servizio (stessa scelta di security_events / accountant_links).
-- La generazione e la verifica dei codici sono server action che verificano
-- l'identità dell'utente prima di toccare le sue righe.
--
-- Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS mfa_recovery_codes (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL,               -- niente FK ad auth.users: pulizia via server
  code_hash  TEXT NOT NULL,               -- SHA-256 del codice normalizzato
  used_at    TIMESTAMPTZ,                 -- null = ancora valido
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un'impronta è unica per utente (niente due codici identici per la stessa persona).
CREATE UNIQUE INDEX IF NOT EXISTS mfa_recovery_codes_user_hash
  ON mfa_recovery_codes (user_id, code_hash);

-- La verifica cerca "i codici NON usati di questo utente".
CREATE INDEX IF NOT EXISTS mfa_recovery_codes_user_unused
  ON mfa_recovery_codes (user_id) WHERE used_at IS NULL;

ALTER TABLE mfa_recovery_codes ENABLE ROW LEVEL SECURITY;
-- Nessuna policy: accesso esclusivo alla chiave di servizio (vedi testata).
