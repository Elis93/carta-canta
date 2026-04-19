-- ============================================================
-- CARTA CANTA — Migration 007: Catalogo voci
-- ============================================================

CREATE TABLE catalog_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  unit         TEXT NOT NULL DEFAULT 'pz',
  unit_price   DECIMAL(10,2) NOT NULL DEFAULT 0,
  vat_rate     DECIMAL(5,2),
  category     TEXT,
  sort_order   INT NOT NULL DEFAULT 0,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER trg_catalog_items_updated_at
  BEFORE UPDATE ON catalog_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_catalog_items_workspace
  ON catalog_items(workspace_id, is_active, sort_order);

ALTER TABLE catalog_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY catalog_select ON catalog_items FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY catalog_insert ON catalog_items FOR INSERT WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY catalog_update ON catalog_items FOR UPDATE USING (is_workspace_member(workspace_id));
CREATE POLICY catalog_delete ON catalog_items FOR DELETE USING (is_workspace_member(workspace_id));
