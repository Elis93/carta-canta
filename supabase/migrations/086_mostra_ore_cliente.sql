-- ============================================================
-- 086 — «Mostra le ore al cliente nel rapportino» (15 ago 2026)
--
-- PERCHÉ (Eli). Le ore effettive di lavoro sono un dato INTERNO dell'artigiano
-- (come costo/ricarico/margine, regola §B.2): il cliente potrebbe contestare il
-- prezzo o dedurre quanto sei veloce. Finora il rapportino le mostrava SEMPRE al
-- cliente (pagina /r e PDF). Ora si nascondono di default; l'artigiano sceglie
-- con una spunta se mostrarle su quel singolo rapportino.
--
-- Le ore restano SEMPRE visibili all'artigiano nella scheda Lavoro
-- («Economia del lavoro»): questo flag governa solo ciò che vede il CLIENTE.
--
-- Default FALSE = nascoste (il dato resta per l'artigiano). Idempotente.
-- ============================================================

ALTER TABLE lavori
  ADD COLUMN IF NOT EXISTS show_labor_to_client BOOLEAN NOT NULL DEFAULT false;
