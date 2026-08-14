-- ============================================================
-- 083 — Limite di 8 FATTURE inviate sul piano Free (decisione Eli 12 ago 2026)
--
-- Gemella della 025 (che conta i preventivi): un contatore STORICO degli
-- invii di FATTURE, incrementato al primo invio (o link copiato) e mai
-- decrementato — così il limite non si aggira con invia + cancella.
-- Il limite morde SOLO sull'invio al cliente (email/WhatsApp/copia link),
-- MAI sulla creazione né sulla trasmissione SdI (l'emissione fiscale resta
-- sempre possibile).
--
-- Idempotente: ADD COLUMN IF NOT EXISTS + CREATE OR REPLACE.
-- ============================================================

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS sent_invoice_quota_used INT NOT NULL DEFAULT 0;

-- Inizializza per i workspace esistenti: conta le fatture non-draft attuali
-- (stessa approssimazione della 025 per i preventivi). In beta è ~0.
UPDATE workspaces w
SET sent_invoice_quota_used = (
  SELECT COUNT(*)::INT
  FROM documents d
  WHERE d.workspace_id = w.id
    AND d.doc_type = 'fattura'
    AND d.status != 'draft'
    AND d.deleted_at IS NULL
);

-- Incremento ATOMICO (gemello di increment_sent_quota della 059): evita di
-- perdere incrementi con invii concorrenti.
CREATE OR REPLACE FUNCTION increment_invoice_quota(p_workspace_id UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE workspaces
  SET sent_invoice_quota_used = COALESCE(sent_invoice_quota_used, 0) + 1
  WHERE id = p_workspace_id
    AND is_workspace_member(id);
$$;
