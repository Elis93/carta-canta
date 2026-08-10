-- Migration 078: UNA SOLA nota di credito attiva per fattura.
--
-- Il vincolo esisteva solo a livello applicativo (maybeSingle prima
-- dell'insert): due submit concorrenti — un doppio tap prima del redirect —
-- passavano entrambi il controllo e creavano DUE note sulla stessa fattura,
-- cioè il DOPPIO STORNO dello stesso importo (revisione 10 ago 2026).
--
-- Indice unico PARZIALE: vale solo per le note di credito NON cestinate.
-- Conseguenza voluta: se esiste già una nota attiva, il ripristino dal
-- cestino di una seconda nota sulla stessa fattura FALLISCE — ed è giusto
-- così, due note attive stornerebbero due volte.
--
-- Idempotente: IF NOT EXISTS.

CREATE UNIQUE INDEX IF NOT EXISTS uniq_nota_credito_per_fattura
  ON documents (origin_document_id)
  WHERE doc_type = 'nota_credito' AND deleted_at IS NULL;
