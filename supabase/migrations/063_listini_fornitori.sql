-- ============================================================
-- 063 — LISTINI FORNITORI (Fase 2 del progetto listino/costi/margine,
-- design approvato da Eli il 2 ago 2026 — PROGETTO_LISTINO_FORNITORE.md)
-- I listini dei fornitori vivono accanto al catalogo ("Catalogo e listini",
-- funzione Pro): voci con COSTO d'acquisto, ricarico predefinito per
-- fornitore e scadenza del listino ("valido fino al…") che si aggancia
-- alla validità del preventivo.
-- 🔒 B.2: i costi non arrivano MAI al cliente — queste tabelle non sono
-- lette da nessuna superficie pubblica.
-- Idempotente — sicura da rieseguire.
-- ============================================================

-- ── Listini (uno per fornitore, più listini per workspace) ─────────────
CREATE TABLE IF NOT EXISTS supplier_lists (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,                -- nome del fornitore
  markup_pct   NUMERIC(6,2),                 -- ricarico % predefinito (proposta prezzo di vendita)
  valid_until  DATE,                         -- scadenza del listino (null = senza scadenza)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE supplier_lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supplier_lists_workspace" ON supplier_lists;
CREATE POLICY "supplier_lists_workspace" ON supplier_lists
  USING (workspace_id IN (SELECT my_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));

CREATE INDEX IF NOT EXISTS idx_supplier_lists_ws
  ON supplier_lists(workspace_id, updated_at DESC);

DROP TRIGGER IF EXISTS trg_supplier_lists_updated_at ON supplier_lists;
CREATE TRIGGER trg_supplier_lists_updated_at
  BEFORE UPDATE ON supplier_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Voci del listino (COSTI d'acquisto, non prezzi di vendita) ─────────
CREATE TABLE IF NOT EXISTS supplier_list_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id      UUID NOT NULL REFERENCES supplier_lists(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  code         TEXT,                          -- codice articolo del fornitore (per il rinnovo)
  description  TEXT NOT NULL,
  unit         TEXT NOT NULL DEFAULT 'pz',
  unit_cost    NUMERIC(10,2) NOT NULL CHECK (unit_cost >= 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE supplier_list_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supplier_list_items_workspace" ON supplier_list_items;
CREATE POLICY "supplier_list_items_workspace" ON supplier_list_items
  USING (workspace_id IN (SELECT my_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));

CREATE INDEX IF NOT EXISTS idx_supplier_list_items_list
  ON supplier_list_items(list_id, description);
CREATE INDEX IF NOT EXISTS idx_supplier_list_items_ws
  ON supplier_list_items(workspace_id);

-- ── Traccia del listino sulla voce del DOCUMENTO ───────────────────────
-- Serve all'aggancio scadenza: "questo preventivo usa prezzi del listino X
-- che scade il …". Il costo resta CONGELATO in document_items.unit_cost
-- (062): cancellare o rinnovare il listino non tocca i documenti.
ALTER TABLE document_items
  ADD COLUMN IF NOT EXISTS supplier_list_id UUID REFERENCES supplier_lists(id) ON DELETE SET NULL;
