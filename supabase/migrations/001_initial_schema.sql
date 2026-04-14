-- ============================================================
-- CARTA CANTA — Migration 001: Initial Schema
-- ============================================================

-- ENUMS
CREATE TYPE plan_type      AS ENUM ('free','pro','team','lifetime');
CREATE TYPE fiscal_regime  AS ENUM ('forfettario','ordinario','minimi');
CREATE TYPE doc_status     AS ENUM ('draft','sent','accepted','rejected','expired');
CREATE TYPE user_role      AS ENUM ('admin','operator','viewer');
CREATE TYPE currency_code  AS ENUM ('EUR','GBP','CHF','PLN','USD');

-- ============================================================
-- WORKSPACES
-- ============================================================
CREATE TABLE workspaces (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    TEXT NOT NULL,
  slug                    TEXT UNIQUE NOT NULL,
  owner_id                UUID NOT NULL REFERENCES auth.users(id),
  plan                    plan_type NOT NULL DEFAULT 'free',
  stripe_customer_id      TEXT,
  stripe_subscription_id  TEXT,
  subscription_ends_at    TIMESTAMPTZ,
  fiscal_regime           fiscal_regime NOT NULL DEFAULT 'forfettario',
  ateco_code              TEXT,
  piva                    TEXT,
  ragione_sociale         TEXT,
  indirizzo               TEXT,
  cap                     TEXT,
  citta                   TEXT,
  provincia               CHAR(2),
  logo_url                TEXT,
  ui_language             CHAR(5)  NOT NULL DEFAULT 'it-IT',
  default_currency        currency_code NOT NULL DEFAULT 'EUR',
  invoice_prefix          TEXT     NOT NULL DEFAULT '',
  invoice_counter         INT      NOT NULL DEFAULT 0,
  bollo_auto              BOOLEAN  NOT NULL DEFAULT true,
  ritenuta_auto           BOOLEAN  NOT NULL DEFAULT false,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- WORKSPACE MEMBERS
-- ============================================================
CREATE TABLE workspace_members (
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role          user_role NOT NULL DEFAULT 'operator',
  invited_by    UUID REFERENCES auth.users(id),
  invited_at    TIMESTAMPTZ DEFAULT now(),
  accepted_at   TIMESTAMPTZ,
  PRIMARY KEY   (workspace_id, user_id)
);

-- ============================================================
-- CLIENTS
-- ============================================================
CREATE TABLE clients (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  email          TEXT,
  phone          TEXT,
  piva           TEXT,
  codice_fiscale TEXT,
  indirizzo      TEXT,
  cap            TEXT,
  citta          TEXT,
  provincia      CHAR(2),
  paese          CHAR(2) NOT NULL DEFAULT 'IT',
  notes          TEXT,
  tags           TEXT[],
  search_vector  tsvector GENERATED ALWAYS AS (
    to_tsvector('italian', coalesce(name,'')||' '||coalesce(email,'')||' '||coalesce(phone,''))
  ) STORED,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TEMPLATES
-- ============================================================
CREATE TABLE templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  header_html     TEXT,
  footer_html     TEXT,
  color_primary   CHAR(7)  DEFAULT '#1a1a2e',
  font_family     TEXT     DEFAULT 'Inter',
  show_logo       BOOLEAN  DEFAULT true,
  show_watermark  BOOLEAN  DEFAULT false,
  legal_notice    TEXT,
  is_default      BOOLEAN  DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- DOCUMENTS (preventivi + fatture)
-- ============================================================
CREATE TABLE documents (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id           UUID REFERENCES clients(id) ON DELETE SET NULL,
  template_snapshot   JSONB,
  doc_type            TEXT       NOT NULL DEFAULT 'preventivo',
  status              doc_status NOT NULL DEFAULT 'draft',
  doc_number          TEXT,
  title               TEXT       NOT NULL,
  notes               TEXT,
  internal_notes      TEXT,
  document_language   CHAR(5)    NOT NULL DEFAULT 'it-IT',
  validity_days       INT        DEFAULT 30,
  payment_terms       TEXT       DEFAULT '30 giorni',
  currency            currency_code NOT NULL DEFAULT 'EUR',
  exchange_rate       DECIMAL(10,6) NOT NULL DEFAULT 1.0,
  subtotal            DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_pct        DECIMAL(5,2)  DEFAULT 0,
  discount_fixed      DECIMAL(10,2) DEFAULT 0,
  tax_amount          DECIMAL(10,2) NOT NULL DEFAULT 0,
  bollo_amount        DECIMAL(10,2) NOT NULL DEFAULT 0,
  total               DECIMAL(10,2) NOT NULL DEFAULT 0,
  vat_rate_default    DECIMAL(5,2),
  ritenuta_pct        DECIMAL(5,2),
  public_token        TEXT UNIQUE DEFAULT encode(gen_random_bytes(16),'hex'),
  accepted_at         TIMESTAMPTZ,
  accepted_ip         INET,
  accepted_ua         TEXT,
  sent_at             TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ,
  pdf_url             TEXT,
  ai_generated        BOOLEAN DEFAULT false,
  ai_confidence       DECIMAL(3,2),
  created_by          UUID REFERENCES auth.users(id),
  search_vector       tsvector GENERATED ALWAYS AS (
    to_tsvector('italian', coalesce(title,'')||' '||coalesce(notes,''))
  ) STORED,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- DOCUMENT ITEMS
-- ============================================================
CREATE TABLE document_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  sort_order    INT  NOT NULL DEFAULT 0,
  description   TEXT NOT NULL,
  unit          TEXT DEFAULT 'pz',
  quantity      DECIMAL(10,3) NOT NULL DEFAULT 1,
  unit_price    DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_pct  DECIMAL(5,2)  DEFAULT 0,
  vat_rate      DECIMAL(5,2),
  total         DECIMAL(10,2) NOT NULL DEFAULT 0,
  ai_generated  BOOLEAN DEFAULT false,
  ai_confidence DECIMAL(3,2)
);

-- ============================================================
-- INVOICE SEQUENCES
-- ============================================================
CREATE TABLE invoice_sequences (
  workspace_id  UUID     NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  year          SMALLINT NOT NULL,
  last_number   INT      NOT NULL DEFAULT 0,
  PRIMARY KEY   (workspace_id, year)
);

-- ============================================================
-- FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION next_invoice_number(p_workspace UUID, p_year SMALLINT)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE v_next INT;
BEGIN
  INSERT INTO invoice_sequences(workspace_id, year, last_number)
  VALUES (p_workspace, p_year, 1)
  ON CONFLICT (workspace_id, year)
  DO UPDATE SET last_number = invoice_sequences.last_number + 1
  RETURNING last_number INTO v_next;
  RETURN v_next;
END;
$$;

-- Trigger updated_at automatico
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_workspaces_updated_at
  BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_templates_updated_at
  BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- INDICI
-- ============================================================
CREATE UNIQUE INDEX idx_doc_number_unique
  ON documents(workspace_id, doc_number)
  WHERE doc_number IS NOT NULL;

CREATE INDEX idx_documents_workspace_status
  ON documents(workspace_id, status);

CREATE INDEX idx_documents_workspace_created
  ON documents(workspace_id, created_at DESC);

CREATE INDEX idx_documents_public_token
  ON documents(public_token)
  WHERE public_token IS NOT NULL;

CREATE INDEX idx_documents_search
  ON documents USING GIN(search_vector);

CREATE INDEX idx_clients_workspace
  ON clients(workspace_id);

CREATE INDEX idx_clients_search
  ON clients USING GIN(search_vector);

CREATE INDEX idx_workspace_members_user
  ON workspace_members(user_id);

CREATE INDEX idx_templates_workspace
  ON templates(workspace_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE workspaces        ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients           ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates         ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_sequences ENABLE ROW LEVEL SECURITY;

-- Helper function: verifica appartenenza al workspace
CREATE OR REPLACE FUNCTION is_workspace_member(p_workspace_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspaces
    WHERE id = p_workspace_id
      AND (
        owner_id = auth.uid()
        OR id IN (
          SELECT workspace_id FROM workspace_members
          WHERE user_id = auth.uid()
            AND accepted_at IS NOT NULL
        )
      )
  );
$$;

-- WORKSPACES: visibili solo ai propri membri
CREATE POLICY ws_select ON workspaces FOR SELECT USING (is_workspace_member(id));
CREATE POLICY ws_insert ON workspaces FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY ws_update ON workspaces FOR UPDATE USING (is_workspace_member(id));
CREATE POLICY ws_delete ON workspaces FOR DELETE USING (owner_id = auth.uid());

-- WORKSPACE MEMBERS
CREATE POLICY wm_select ON workspace_members FOR SELECT
  USING (is_workspace_member(workspace_id));
CREATE POLICY wm_insert ON workspace_members FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY wm_delete ON workspace_members FOR DELETE
  USING (is_workspace_member(workspace_id));

-- CLIENTS: ereditano dal workspace
CREATE POLICY clients_select ON clients FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY clients_insert ON clients FOR INSERT WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY clients_update ON clients FOR UPDATE USING (is_workspace_member(workspace_id));
CREATE POLICY clients_delete ON clients FOR DELETE USING (is_workspace_member(workspace_id));

-- TEMPLATES
CREATE POLICY templates_select ON templates FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY templates_insert ON templates FOR INSERT WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY templates_update ON templates FOR UPDATE USING (is_workspace_member(workspace_id));
CREATE POLICY templates_delete ON templates FOR DELETE USING (is_workspace_member(workspace_id));

-- DOCUMENTS: accesso normale via workspace
CREATE POLICY docs_select ON documents FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY docs_insert ON documents FOR INSERT WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY docs_update ON documents FOR UPDATE USING (is_workspace_member(workspace_id));
CREATE POLICY docs_delete ON documents FOR DELETE USING (is_workspace_member(workspace_id));

-- DOCUMENTS: accesso pubblico via token (link cliente)
CREATE POLICY docs_public ON documents FOR SELECT USING (
  public_token IS NOT NULL
  AND status IN ('sent', 'accepted')
);

-- DOCUMENT ITEMS: accesso tramite documento
CREATE POLICY items_select ON document_items FOR SELECT
  USING (document_id IN (SELECT id FROM documents WHERE is_workspace_member(workspace_id)));
CREATE POLICY items_insert ON document_items FOR INSERT
  WITH CHECK (document_id IN (SELECT id FROM documents WHERE is_workspace_member(workspace_id)));
CREATE POLICY items_update ON document_items FOR UPDATE
  USING (document_id IN (SELECT id FROM documents WHERE is_workspace_member(workspace_id)));
CREATE POLICY items_delete ON document_items FOR DELETE
  USING (document_id IN (SELECT id FROM documents WHERE is_workspace_member(workspace_id)));

-- INVOICE SEQUENCES
CREATE POLICY seq_access ON invoice_sequences FOR ALL
  USING (is_workspace_member(workspace_id));
