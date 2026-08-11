-- ============================================================
-- 081 — Le tre cose che «nella prassi si fanno» e l'app non sapeva fare
--
-- PERCHÉ (Eli, 11 ago 2026): *"per la reverse charge come potremmo fare?
-- idem per ive diverse, come facciamo? idem condomini"*. Sono le tre aree
-- emerse dalla ricerca N7-N13: un idraulico che installa una caldaia, un
-- edile che lavora per un'altra impresa e chiunque fatturi a un condominio
-- oggi dovrebbero correggere l'IVA a mano — cioè sbagliarla.
--
-- Tre colonne, una migration sola: si applica una volta e basta.
--
-- ① document_items.bene_significativo — IVA 10% e BENI SIGNIFICATIVI
--    (L. 488/1999 · DM 29.12.1999 · circ. AdE 15/E/2018). Sui lavori di
--    manutenzione in abitazione l'IVA è al 10%, ma il valore dei sette beni
--    «significativi» (caldaie, infissi, sanitari…) gode del 10% solo FINO A
--    CONCORRENZA del valore della prestazione: l'eccedenza va al 22%.
--    La spunta la mette l'artigiano voce per voce — l'elenco è tassativo
--    nella sostanza, non nel nome commerciale, e nessun riconoscimento
--    automatico dal testo sarebbe affidabile.
--
-- ② documents.ritenuta_causale — RITENUTA del 4% del CONDOMINIO
--    (art. 25-ter DPR 600/1973). Il condominio è sostituto d'imposta: sui
--    corrispettivi per contratti di appalto trattiene il 4% e lo versa lui.
--    Nell'XML serve la CausalePagamento, che per questa ritenuta è ''W''
--    (corrispettivi per contratti d'appalto — la ''A'' è lavoro autonomo,
--    sarebbe sbagliata). Il valore sta sul DOCUMENTO perché è una
--    caratteristica di quella fattura, non dell'artigiano.
--
-- ③ documents.reverse_charge — INVERSIONE CONTABILE in EDILIZIA
--    (art. 17 c.6 lett. a-ter DPR 633/1972). Fra soggetti IVA, per pulizia,
--    demolizione, installazione impianti e completamento su edifici, l'IVA
--    la assolve il committente: la fattura si emette SENZA IVA con natura
--    N6.7 e la dicitura «inversione contabile».
--    ⚠️ Un FORFETTARIO non applica mai il reverse charge in USCITA (resta
--    N2.2): il flag serve a chi è in regime ordinario.
--
-- ⚠️ Nessuna di queste colonne cambia da sola il comportamento dei documenti
-- esistenti: i default sono «no» e i vecchi documenti restano identici.
--
-- Idempotente: si può rilanciare il file intero senza effetti.
-- ============================================================

-- ① Beni significativi ───────────────────────────────────────────────────
ALTER TABLE public.document_items
  ADD COLUMN IF NOT EXISTS bene_significativo BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.document_items.bene_significativo IS
  'IVA 10% (081): la voce è uno dei sette «beni significativi» del DM 29.12.1999. Il 10% vale fino a concorrenza del valore della prestazione, l''eccedenza va al 22%. Marcatura MANUALE dell''artigiano.';

-- ② Ritenuta: la causale di pagamento che finisce nell'XML ────────────────
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS ritenuta_causale TEXT;

COMMENT ON COLUMN public.documents.ritenuta_causale IS
  'CausalePagamento della ritenuta (081), tracciato FatturaPA 2.1.1.5.4. ''W'' = corrispettivi per contratti d''appalto (ritenuta 4% del condominio, art. 25-ter DPR 600/1973). NULL = nessuna ritenuta o causale non specificata.';

-- La causale è una sigla del tracciato: al massimo due caratteri, mai testo
-- libero (uno scarto 00445 si evita qui, non in produzione).
ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_ritenuta_causale_check;
ALTER TABLE public.documents
  ADD CONSTRAINT documents_ritenuta_causale_check
  CHECK (ritenuta_causale IS NULL OR ritenuta_causale ~ '^[A-Z]{1,2}$');

-- ③ Inversione contabile ─────────────────────────────────────────────────
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS reverse_charge BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.documents.reverse_charge IS
  'Inversione contabile in edilizia (081), art. 17 c.6 lett. a-ter DPR 633/1972: fattura senza IVA, natura N6.7, dicitura «inversione contabile». Scelta MANUALE dell''artigiano — la mappatura ATECO ufficiale non è aggiornata al 2025.';
