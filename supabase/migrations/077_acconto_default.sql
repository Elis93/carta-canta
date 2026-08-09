-- ============================================================
-- 077 — Acconto richiesto: valore di DEFAULT per i nuovi preventivi
--
-- PERCHÉ (Eli, 9 ago 2026): *"vorrei che la richiesta di acconto e la
-- percentuale siano settate anche di default nelle impostazioni così ogni
-- preventivo che viene creato ha quelle impostazioni di default che poi
-- possono essere modificate manualmente per ogni preventivo"*.
--
-- Chi lavora con l'acconto lo chiede quasi sempre alla stessa condizione
-- (il classico 30%): rimetterlo a mano su ogni preventivo è una tassa
-- quotidiana su una scelta che cambia una volta l'anno.
--
-- ⚠️ SOLO un default per i documenti NUOVI. I preventivi già esistenti non
-- si toccano: `documents.deposit_type` / `deposit_value` (038) restano la
-- verità del singolo documento, e cambiare qui non deve riscrivere nulla di
-- ciò che è già stato mandato a un cliente.
--
-- NULL = nessun acconto richiesto per default (comportamento di oggi).
--
-- Idempotente: si può rilanciare il file intero senza effetti.
-- ============================================================

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS deposit_default_type TEXT,
  ADD COLUMN IF NOT EXISTS deposit_default_value NUMERIC(12,2);

COMMENT ON COLUMN public.workspaces.deposit_default_type IS
  'Acconto proposto sui NUOVI preventivi (077): ''percent'' | ''fixed'' | NULL = nessuno. Non tocca i documenti esistenti.';
COMMENT ON COLUMN public.workspaces.deposit_default_value IS
  'Valore dell''acconto di default (077): percentuale 1-100 se type=percent, importo in euro se type=fixed.';

-- ⚠️ DROP + ADD invece di "crea solo se non c'è": così rilanciare il file
-- CORREGGE un vincolo scritto male, invece di lasciare in piedi quello vecchio.
ALTER TABLE public.workspaces
  DROP CONSTRAINT IF EXISTS workspaces_deposit_default_type_check;
ALTER TABLE public.workspaces
  ADD CONSTRAINT workspaces_deposit_default_type_check
  CHECK (deposit_default_type IS NULL OR deposit_default_type IN ('percent', 'fixed'));

-- Coerenza fra i due campi: un tipo senza valore (o un valore senza tipo)
-- produrrebbe un acconto a zero, o un acconto "fantasma" nel form.
-- La percentuale sta fra 1 e 100; l'importo fisso dev'essere positivo.
--
-- ⚠️ I due `IS NOT NULL` espliciti NON sono ridondanti, e sono costati due
-- giri di collaudo. In SQL un CHECK passa quando l'espressione è TRUE
-- **oppure NULL** (logica a tre valori):
--   · senza `value IS NOT NULL` → `type='fixed' AND value > 0` con valore NULL
--     vale NULL, non FALSE → passava un TIPO SENZA VALORE;
--   · senza `type IS NOT NULL`  → `NULL = 'percent'` vale NULL → passava un
--     VALORE SENZA TIPO.
-- Trovati collaudando la migration su PG16, non rileggendola.
ALTER TABLE public.workspaces
  DROP CONSTRAINT IF EXISTS workspaces_deposit_default_coerente_check;
ALTER TABLE public.workspaces
  ADD CONSTRAINT workspaces_deposit_default_coerente_check
  CHECK (
    (deposit_default_type IS NULL AND deposit_default_value IS NULL)
    OR (deposit_default_type IS NOT NULL AND deposit_default_value IS NOT NULL
        AND deposit_default_type = 'percent'
        AND deposit_default_value > 0 AND deposit_default_value <= 100)
    OR (deposit_default_type IS NOT NULL AND deposit_default_value IS NOT NULL
        AND deposit_default_type = 'fixed'
        AND deposit_default_value > 0)
  );
