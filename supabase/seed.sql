-- ============================================================
-- CARTA CANTA — Seed data per test locale
-- ============================================================
-- NOTA: questo seed usa un UUID fittizio per owner_id.
-- In un ambiente reale, sostituire con l'UUID dell'utente auth creato.

DO $$
DECLARE
  v_workspace_id  UUID := '11111111-1111-1111-1111-111111111111';
  v_owner_id      UUID := '00000000-0000-0000-0000-000000000001'; -- utente test
  v_client1_id    UUID := '22222222-2222-2222-2222-222222222201';
  v_client2_id    UUID := '22222222-2222-2222-2222-222222222202';
  v_client3_id    UUID := '22222222-2222-2222-2222-222222222203';
  v_template_id   UUID := '33333333-3333-3333-3333-333333333301';
  v_doc1_id       UUID := '44444444-4444-4444-4444-444444444401';
  v_doc2_id       UUID := '44444444-4444-4444-4444-444444444402';
BEGIN

-- ============================================================
-- WORKSPACE: Studio Test (piano pro)
-- ============================================================
INSERT INTO workspaces (
  id, name, slug, owner_id, plan,
  fiscal_regime, piva, ragione_sociale,
  indirizzo, cap, citta, provincia,
  ui_language, default_currency,
  invoice_prefix, bollo_auto, ritenuta_auto
) VALUES (
  v_workspace_id,
  'Studio Test',
  'studio-test',
  v_owner_id,
  'pro',
  'forfettario',
  'IT01234567890',
  'Studio Test di Mario Test',
  'Via Roma 1',
  '20121',
  'Milano',
  'MI',
  'it-IT',
  'EUR',
  '2026/',
  true,
  false
);

-- ============================================================
-- CLIENTI
-- ============================================================
INSERT INTO clients (id, workspace_id, name, email, phone, piva, indirizzo, cap, citta, provincia)
VALUES
  (v_client1_id, v_workspace_id,
   'Mario Rossi', 'mario.rossi@example.com', '+39 333 1234567',
   NULL, 'Via Garibaldi 10', '20100', 'Milano', 'MI'),

  (v_client2_id, v_workspace_id,
   'Giulia Bianchi', 'giulia.bianchi@example.com', '+39 347 9876543',
   'IT09876543210', 'Corso Italia 50', '10100', 'Torino', 'TO'),

  (v_client3_id, v_workspace_id,
   'Luca Verdi', 'luca.verdi@example.com', '+39 320 5556677',
   NULL, 'Piazza Duomo 3', '50100', 'Firenze', 'FI');

-- ============================================================
-- TEMPLATE: Preventivo Standard
-- ============================================================
INSERT INTO templates (
  id, workspace_id, name, description,
  color_primary, font_family, show_logo, show_watermark,
  legal_notice, is_default
) VALUES (
  v_template_id,
  v_workspace_id,
  'Preventivo Standard',
  'Template professionale per preventivi forfettari',
  '#1a1a2e',
  'Inter',
  true,
  false,
  'Operazione effettuata ai sensi dell''art. 1, commi 54-89, L. 190/2014 (Regime Forfettario) – Operazione fuori campo IVA ai sensi del comma 58, lettera a), del medesimo articolo',
  true
);

-- ============================================================
-- DOCUMENTO 1: Bozza (Mario Rossi)
-- ============================================================
INSERT INTO documents (
  id, workspace_id, client_id,
  doc_type, status, title, notes,
  validity_days, payment_terms, currency,
  subtotal, tax_amount, bollo_amount, total,
  created_by
) VALUES (
  v_doc1_id,
  v_workspace_id,
  v_client1_id,
  'preventivo',
  'draft',
  'Lavori di idraulica appartamento',
  'Preventivo per sostituzione impianto idraulico completo.',
  30,
  '30 giorni',
  'EUR',
  850.00,
  0.00,
  2.00,
  852.00,
  v_owner_id
);

INSERT INTO document_items (document_id, sort_order, description, unit, quantity, unit_price, total)
VALUES
  (v_doc1_id, 0, 'Sostituzione rubinetteria bagno', 'pz', 1, 250.00, 250.00),
  (v_doc1_id, 1, 'Posa nuove tubature', 'ml', 15, 30.00, 450.00),
  (v_doc1_id, 2, 'Manodopera', 'ore', 5, 30.00, 150.00);

-- ============================================================
-- DOCUMENTO 2: Inviato con public_token (Giulia Bianchi)
-- ============================================================
INSERT INTO documents (
  id, workspace_id, client_id,
  doc_type, status, doc_number, title, notes,
  validity_days, payment_terms, currency,
  subtotal, tax_amount, bollo_amount, total,
  public_token, sent_at, expires_at,
  created_by
) VALUES (
  v_doc2_id,
  v_workspace_id,
  v_client2_id,
  'preventivo',
  'sent',
  '2026/001',
  'Impianto elettrico ristrutturazione',
  'Preventivo per rifacimento impianto elettrico conforme CEI.',
  30,
  '30 giorni',
  'EUR',
  1200.00,
  0.00,
  2.00,
  1202.00,
  'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
  now() - interval '2 days',
  now() + interval '28 days',
  v_owner_id
);

INSERT INTO document_items (document_id, sort_order, description, unit, quantity, unit_price, total)
VALUES
  (v_doc2_id, 0, 'Quadro elettrico 16 circuiti', 'pz', 1, 450.00, 450.00),
  (v_doc2_id, 1, 'Cavi elettrici e pose', 'ml', 50, 8.00, 400.00),
  (v_doc2_id, 2, 'Prese e interruttori', 'pz', 20, 12.00, 240.00),
  (v_doc2_id, 3, 'Manodopera specializzata', 'ore', 3, 36.67, 110.01);

END $$;
