-- ============================================================
-- 089 — Copia di cortesia: flag PER CLIENTE «Invia sempre la copia»
-- (Fase 2 di PROGETTO_COPIA_CORTESIA.md — standard FiC/Aruba: il flag
-- vive in anagrafica cliente).
--
-- true  (default) = comportamento di serie della Fase 1: all'esito
--                   positivo dello SdI la copia parte da sola, se il
--                   cliente ha un'email in rubrica.
-- false           = la copia automatica NON parte per questo cliente
--                   (rinuncia espressa del B2C, art. 1 c.3 D.Lgs
--                   127/2015, o preferenza dell'artigiano di mandarla
--                   a mano): resta l'invito manuale sulla fattura.
--
-- Idempotente. Nessun backfill necessario (il default copre le righe
-- esistenti). Il codice è tollerante pre-089: la colonna si scrive con
-- un update separato best-effort e si legge con `=== false` (assente →
-- comportamento di serie).
-- ============================================================

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS copia_cortesia_auto BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN clients.copia_cortesia_auto IS
  'Fase 2 copia di cortesia (set 2026): false = niente copia automatica all''esito positivo SdI per questo cliente (rinuncia espressa B2C); resta l''invito manuale.';
