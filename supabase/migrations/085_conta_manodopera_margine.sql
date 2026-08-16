-- ============================================================
-- 085 — Interruttore «conta la manodopera nel margine dei lavori» (15 ago 2026)
--
-- PERCHÉ. Nella scheda Lavoro l'«Economia del lavoro» sottrae SEMPRE dal
-- margine il costo della manodopera (ore del timer × costo orario del
-- workspace, colonna 052). Per un artigiano FORFETTARIO le sue ore non sono
-- però soldi usciti dal conto: contarle fa apparire il margine più basso del
-- guadagno reale in cassa (stesso doppio-binario del Bilancio). Serve poter
-- ESCLUDERE la manodopera dal margine.
--
-- Default TRUE: non cambia il comportamento attuale (chi ha impostato un costo
-- orario lo ha fatto per contarlo); l'interruttore in Impostazioni › Fiscale
-- permette di spegnerlo. Chi non ha un costo orario non è toccato (laborCost
-- è già 0).
--
-- Idempotente.
-- ============================================================

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS count_labor_in_margin BOOLEAN NOT NULL DEFAULT true;
