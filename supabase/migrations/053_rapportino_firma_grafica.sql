-- ============================================================
-- 053 — Firma GRAFICA sul rapportino di fine lavoro (F20)
-- Il cliente ora disegna la firma a mano (canvas) come per il
-- preventivo: il PNG (data URI, max 64KB lato API) si salva qui.
-- Idempotente. Il codice è tollerante pre-migration: senza la
-- colonna la firma si registra comunque (senza immagine).
-- ============================================================

ALTER TABLE lavori ADD COLUMN IF NOT EXISTS report_signature_image TEXT;

COMMENT ON COLUMN lavori.report_signature_image IS
  'Firma disegnata dal cliente sul rapportino (data URI PNG, F20 — 16 lug 2026). Stessa FES del preventivo.';
