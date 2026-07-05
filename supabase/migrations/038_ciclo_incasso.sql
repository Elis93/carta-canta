-- 038 — CICLO INCASSO: Bilancio (spese) + Pagamenti Fase 1 + Acconti
-- Spec: SPEC_NUOVE_FEATURE.md §1 (Bilancio), §2 (Pagamenti F1), §A.3 (Acconti)
-- Decisioni Eli 5 lug 2026 (DECISIONI_E_FEEDBACK.md — "Ciclo incasso")

-- ── Bilancio: tabella spese ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  date           DATE NOT NULL,
  description    TEXT NOT NULL,
  amount         NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  category       TEXT,                          -- preset ('Materiali','Carburante',...) o personalizzata
  is_recurring   BOOLEAN NOT NULL DEFAULT false, -- riservato V3 (spese ricorrenti)
  recurrence     TEXT,                           -- null | 'monthly' | 'yearly' (V3)
  vat_deductible BOOLEAN NOT NULL DEFAULT false, -- riservato V3
  receipt_url    TEXT,                           -- riservato V3 (foto scontrino)
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ                     -- soft delete come documents
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expenses_workspace" ON expenses
  USING (workspace_id IN (SELECT my_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));

CREATE INDEX IF NOT EXISTS idx_expenses_ws_date
  ON expenses(workspace_id, date) WHERE deleted_at IS NULL;

-- ── Pagamenti Fase 1: stato pagamento sul documento ────────────────────
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid','partial','paid')),
  ADD COLUMN IF NOT EXISTS paid_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS due_date    DATE;

-- Canali di incasso "bring your own" dell'artigiano
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS payment_iban         TEXT,
  ADD COLUMN IF NOT EXISTS payment_iban_holder  TEXT,
  ADD COLUMN IF NOT EXISTS payment_paypal_url   TEXT,
  ADD COLUMN IF NOT EXISTS payment_satispay_url TEXT,
  ADD COLUMN IF NOT EXISTS payment_notes        TEXT;

-- ── Acconti: richiesta acconto sul preventivo ───────────────────────────
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS deposit_type  TEXT CHECK (deposit_type IN ('percent','amount')),
  ADD COLUMN IF NOT EXISTS deposit_value NUMERIC(12,2);

-- ── Retro-compat: fatture già segnate "Pagata" entrano nel Bilancio ────
UPDATE documents
   SET payment_status = 'paid',
       paid_at = COALESCE(accepted_at, updated_at)
 WHERE doc_type = 'fattura'
   AND status = 'accepted'
   AND payment_status = 'unpaid';
