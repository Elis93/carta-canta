# PROGETTO — Listino fornitore, costi e margine

> Design approvato da Eli il 2 ago 2026 (mockup 5 schermate + pilastri + gestione sconto).
> Nasce da un feedback diretto di un artigiano: "preparo il preventivo in base al margine
> che ho sul fornitore, e il listino del fornitore dura 10 giorni".
> Questo file è la MAPPA COMPLETA di cosa va modificato e cosa va costruito.
> Stato: ✅ FASE 1 IMPLEMENTATA (2 ago, migration 062 applicata) ·
> ✅ FASE 2 IMPLEMENTATA (2 ago sera — ⚠️ migration 063 DA APPLICARE) · Fase 3 da fare.

## ✅ FASE 2 — IMPLEMENTATA (2 ago 2026 sera)

- **⚠️ Migration 063** (`063_listini_fornitori.sql`, VALIDATA su PG16 reale: idempotenza,
  CHECK costo ≥0, trigger updated_at, delete listino → voci in CASCADE e
  `document_items.supplier_list_id` a NULL col costo che resta congelato):
  `supplier_lists` (nome, markup_pct, valid_until, RLS my_workspace_ids) +
  `supplier_list_items` (code, description, unit, unit_cost) +
  `document_items.supplier_list_id` (FK SET NULL).
- **`lib/fornitori/listino.ts`** (puro, 9 test): `prezzoProposto` (costo+ricarico%,
  null senza ricarico → voce "da prezzare", mai un prezzo inventato),
  `matchRinnovo` (abbina per codice poi descrizione normalizzata, ogni voce max
  una volta; stats rincari con media % solo sulle aumentate), `riepilogoRinnovo`,
  `giorniAllaScadenza`.
- **`lib/actions/fornitori.ts`**: CRUD listini+voci (Pro-gated `plan==='free'`,
  UUID re, tolleranti 42P01/PGRST205 → messaggio migration) +
  `importSupplierItemsAction` = import AI E RINNOVO (se il listino ha già voci
  abbina/aggiorna/aggiunge; consuma la stessa quota AI dell'import catalogo al
  salvataggio; aggiorna valid_until se indicata).
- **"Catalogo e listini"** (decisione congelata: UNA pagina): /catalogo con due
  linguette (Il mio catalogo | Listini fornitori 🔒 per i Free → upsell); lista
  listini con conteggi/ricarico/scadenza/badge SCADUTO; `NuovoListinoForm`
  (ricarico default 25%). Dettaglio `/catalogo/fornitori/[id]` (+loading):
  `ListinoDetail` = info inline (modifica/elimina), import/RINNOVA con l'AI
  (riusa `/api/ai/extract` — il numero letto è il COSTO), voci con
  "costo X →vendi a Y" e CRUD manuale. Voce Altro: "Catalogo e listini".
- **CatalogPicker a 2 linguette**: "Il mio catalogo | Listini fornitori" (plan
  letto client-side col fetch già esistente; Free → lucchetto+upsell). Dalla
  linguetta fornitori la voce entra con unit_cost + prezzo proposto +
  supplier_list_id. `VoceItem.supplier_list_id` end-to-end: Zod, serializzazione,
  5 insert mapping (`sanitizeSupplierListId`), re-edit, duplica;
  `insertDocumentItemsTollerante` a CASCATA (senza supplier_list_id su
  42703/23503 → senza unit_cost pre-062).
- **Aggancio scadenza (pilastro D)**: campo validità CONTROLLATO in
  PreventivoForm + banner ambra sopra il MargineBox quando un listino usato
  scade prima della validità ("[Allinea: preventivo valido N giorni]" a un
  tocco; listino già scaduto → avviso di ricontrollare i prezzi). I listini
  arrivano alle pagine nuovo/[id] con fetch tollerante nel Promise.all.
- **Foto-AI**: il match catalogo ora porta anche `unit_cost` nella voce
  proposta (limite F1 chiuso) — select tollerante pre-062.
- Verifica visiva Chromium 390px su ListinoDetail reale (harness esbuild, stub
  actions): 0 overflow, prezzi proposti giusti (2,50+25% = 3,13). Privacy B.2:
  grep pulito su lib/pdf, app/p, app/r, email (nessun unit_cost/supplier/margine).
- **Restano in FASE 3**: campanella `listino_scaduto`, interruttore manodopera,
  avviso su duplica da listino scaduto.

## ✅ FASE 1 — IMPLEMENTATA (2 ago 2026)

- **Migration 062** (`062_costi_margine.sql`, validata su PG16 reale: idempotenza,
  scrittura, convert che copia il costo): `unit_cost` su catalog_items e
  document_items + `convert_preventivo_to_fattura` che trasporta il costo.
- **`lib/margine/calcolo.ts`** (puro, 11 test): margineVoce (sconto voce incluso,
  sotto-costo negativo mai mascherato) + margineDocumento (sconto documento
  sottratto UNA volta dal totale; % solo se TUTTE le voci hanno un costo, alla
  Quotient).
- **Catalogo**: campo "Costo (quanto la paghi) — facoltativo" in CatalogItemForm
  (+ actions con retry tollerante pre-062); riga mobile mostra "costo X €".
- **VociTable**: link "🔒 Costo e margine (solo per te)" per voce → campo costo +
  riga privata "ricarico X% · margine +Y €" (rossa "sotto costo" se negativo).
  CatalogPicker porta unit_cost nella voce scelta.
- **MargineBox** (PreventivoForm, sopra il riepilogo): tendina chiusa di default
  "🔒 MARGINE · SOLO TU LO VEDI +X €"; aperta = margine voci / sconto documento /
  voci senza costo / margine finale. GRATIS per tutti (decisione gating).
- **documents.ts**: VoceSchema + unit_cost; congelato sulle voci del documento in
  create/update/saveDraft/duplicate/createInvoice via `insertDocumentItemsTollerante`
  (pre-062: retry senza colonna, il salvataggio non si rompe mai).
- **🔒 Test privacy** (`tests/unit/margine/privacy-pdf.test.ts`): i 4 preset di
  buildPdfHtml NON contengono il costo sentinella né "margine"/"ricarico".
  Verificato anche che /p/[token] seleziona le colonne ESPLICITAMENTE (il costo
  non può entrare nel payload RSC del cliente).
- Verifica visiva Chromium 390px (bundle esbuild): riga privata, link, tendina
  chiusa/aperta con la matematica giusta (195 − 50 sconto = 145).
- **Limiti noti (minori, interni)**: "Ripristina versione inviata" non ripristina
  i costi (la select del confronto non li legge — persi solo lì); FatturaForm in
  CREAZIONE non mostra il MargineBox (compare dal primo salvataggio, il form di
  modifica è PreventivoForm); il flusso foto-AI non valorizza il costo dal match
  catalogo (da aggiungere in F2).

## ✅ DECISIONI CONGELATE (Eli, 2 ago 2026 — "ok a tutto")

1. **Gating**: margine GRATIS per tutti (campo costo + riga privata + riquadro);
   listini fornitori = PRO (import AI, ricarico automatico, scadenza agganciata,
   guardiano, rinnovo con confronto rincari).
2. **Riorganizzazione**: NESSUNA pagina in più in Altro — "Catalogo" diventa
   **"Catalogo e listini"**, una pagina con due linguette (Il mio catalogo |
   Listini fornitori 🔒PRO). Stesso pattern nel picker voci del preventivo.
3. **Margine a tendina**: riga singola chiusa di default ("🔒 Margine · solo tu lo
   vedi — +X € · Y%"), dettaglio all'apertura (pattern Cronologia). La pagina del
   preventivo non si allunga.
4. Micro-scelte delegate: ricarico predefinito proposto al primo import = 25%
   (standard materiali 15-25%); niente arrotondamento automatico del prezzo
   proposto (si può aggiungere dopo se richiesto).

---

## 🔒 REGOLA PERMANENTE (Eli, 2 ago 2026) — PRIVACY DEL MARGINE

**Costo d'acquisto, ricarico e margine NON devono MAI comparire al cliente. Mai.**

Superfici VIETATE (elenco da ricontrollare a ogni fase e a ogni feature futura):
- PDF (`lib/pdf/template.ts`, tutti e 4 i preset) e `TemplatePreview.tsx`
- Pagina pubblica `/p/[token]` (e relativa route PDF pubblica)
- Pagina rapportino `/r/[token]`
- TUTTE le email al cliente finale (template in `lib/email/templates/`)
- `template_snapshot` e qualsiasi HTML serializzato che possa finire al cliente
- Export/documenti condivisi col commercialista SOLO se Eli lo decide esplicitamente
  (default: nemmeno lì)

Regole tecniche conseguenti:
1. Le colonne dei costi (`unit_cost` ecc.) NON vanno mai aggiunte alle select delle
   route pubbliche, né passate come prop a componenti renderizzati in pagine pubbliche.
2. `buildPdfHtml` e le route `/api/p/**` non devono MAI ricevere i campi costo:
   il filtro va fatto alla FONTE (select esplicite, niente `select('*')` verso
   superfici pubbliche per le tabelle con costi).
3. Ogni PR delle fasi sotto chiude con un GREP di verifica: `unit_cost`/`ricarico`/
   `margine` non devono comparire in `lib/pdf/`, `app/p/`, `app/r/`,
   `lib/email/templates/` (salvo commenti).
4. Un test automatico congela la regola appena esistono le colonne (vedi Fase 1).

---

## I 4 PILASTRI (design approvato)

- **A · Due prezzi per voce**: costo (quanto la paghi) e vendita (quanto la metti in
  preventivo). Il costo è SEMPRE facoltativo: chi non lo usa ha l'app identica a oggi.
- **B · Ricarico tuo**: per fornitore si imposta un ricarico % predefinito; l'app
  PROPONE il prezzo di vendita (costo + ricarico), sempre modificabile. UN SOLO
  concetto per gli artigiani: il ricarico (mai chiedere il "margine %" come input —
  il margine si mostra come risultato).
- **C · Margine privato**: riquadro "Margine stimato — lo vedi solo tu" in € e %,
  live mentre si prepara il preventivo. Riga privata sottile sotto ogni voce con
  costo noto ("costo X · ricarico Y% · margine +Z €"), rossa se sotto costo.
- **D · Scadenza agganciata**: il listino ha "valido fino al [data]". All'invio, se il
  listino scade prima della validità del preventivo → dialog "Allinea: valido N
  giorni" (un tocco). Dopo l'invio, listino scaduto con preventivi in attesa →
  avviso in campanella.

## GESTIONE SCONTO (decisione chiusa, 2 ago)

**Ogni sconto si vede al livello dove è applicato, mai spalmato altrove.**
- Sconto sulla SINGOLA voce (`discount_pct`): la riga privata della voce usa il prezzo
  già scontato (ricarico effettivo).
- Sconto GLOBALE documento: NON si ridistribuisce sulle voci. Vive solo nel riquadro
  totale, con la matematica in chiaro:
  `Margine sulle voci +342 € · Sconto documento −50 € · Margine finale +292 € (31%)`.
- Mentre si ritocca lo sconto il margine finale si aggiorna live (strumento di
  trattativa); sotto zero → rosso "stai lavorando sotto costo".
- ⚠️ Il motore fiscale (`lib/fiscal/calcoli.ts`) NON si tocca: il margine è SOLO
  visualizzazione privata, zero effetti su totali/IVA/PDF.

## I FLUSSI (tutte le strade convergono sugli stessi due prezzi)

- **A. Voce dal listino fornitore** → costo dal listino, prezzo proposto = costo +
  ricarico fornitore.
- **B. Voce dal catalogo proprio con costo** → prezzo = quello del catalogo (come
  oggi); ricarico mostrato = derivato. Nessun automatismo sui prezzi del catalogo.
- **C. Voce a mano / catalogo senza costo** → come oggi; campo facoltativo "Costo"
  nelle Altre opzioni della voce; se compilato entra nel margine.
- **D. Voce dalle foto (AI)** → prezzo già solo dal catalogo (regola anti-invenzione):
  se la voce di catalogo ha il costo, margine gratis. Flusso foto INVARIATO.
- **E. Manodopera** → interruttore OPZIONALE "Conta anche la manodopera nel margine"
  usando `workspaces.hourly_cost` (già esistente) sulle voci a ore. Default OFF.
- **F. Rinnovo listino** → reimport: abbina le voci (codice/nome), aggiorna i costi,
  riepilogo "12 voci rincarate, media +6%", nuova scadenza; il guardiano ricontrolla
  i preventivi aperti.
- **G. Conversione in fattura / duplica** → costi e margine viaggiano dietro le
  quinte; duplica da listino scaduto → avviso.

---

## FASE 1 — Costo sulle voci + margine nel preventivo (parte subito)

Valore immediato senza toccare i fornitori. Tutto facoltativo.

**Migration (1 nuova):**
- `catalog_items.unit_cost DECIMAL(10,2) NULL` — costo d'acquisto facoltativo.
- `document_items.unit_cost DECIMAL(10,2) NULL` — il costo si CONGELA sulla voce del
  documento (il margine di un preventivo non deve cambiare se poi aggiorno il
  catalogo). ⚠️ REGOLA 29 lug: verificare GRANT per colonna su queste tabelle
  (documents/document_items sono da migration 001, GRANT non per colonna → ok, ma
  ricontrollare prima di scrivere).

**Codice:**
- `lib/margine/calcolo.ts` (NUOVO, puro + test): margine per voce (costo × qtà vs
  totale riga scontato), margine documento (somma voci con costo − sconto globale),
  conteggio voci senza costo. Coverage 100% come i calcoli fiscali (B.1.3 per
  analogia: sono numeri che guidano decisioni di prezzo).
- `CatalogoForm`/`catalogo/actions.ts`: campo "Costo (quanto la paghi) — facoltativo".
- `CatalogPicker`: mostra il costo (solo qui, è UI interna) e lo porta nella voce.
- `VociTable` (`PreventivoForm`/fatture): campo "Costo" nelle Altre opzioni della
  voce + RIGA PRIVATA sotto la voce (lucchetto, "costo · ricarico · margine", rossa
  se negativo). Solo form di modifica, mai in render pubblici.
- `PreventivoForm`: riquadro "MARGINE STIMATO — LO VEDI SOLO TU" sotto le voci
  (stile mockup: box violaceo, € e %, dettaglio materiali, nota voci senza costo,
  riga sconto documento quando presente).
- Server actions documenti: persistere `unit_cost` per voce (create/update/saveDraft/
  duplicate/convert). Zod: `unit_cost` opzionale nonnegative.
- **Test regola privacy**: test che monta `buildPdfHtml` con voci con costo e
  verifica che l'HTML NON contenga il valore del costo/parola "margine"; idem
  select delle route pubbliche (grep automatico o unit sulle colonne selezionate).

**Domanda aperta per Eli:** gating — proposta: campo costo per TUTTI, riquadro
margine live = Pro. (Eli non ha ancora risposto esplicitamente.)

## FASE 2 — Listini fornitori con scadenza

**Migration (1 nuova):**
- `supplier_lists`: id, workspace_id, nome fornitore, ricarico_pct predefinito,
  valid_until DATE NULL, created_at/updated_at. RLS per workspace (pattern 043).
- `supplier_list_items`: id, list_id, workspace_id, code, description, unit,
  unit_cost, created_at. RLS idem.
- ⚠️ GRANT: se si usano GRANT per colonna, estenderli SUBITO a tutte le colonne
  (lezione 045×055).

**Codice:**
- Sezione **"Listini fornitori"** — pagina nuova `app/(app)/fornitori/` raggiungibile
  da Altro › Soldi (accanto al Catalogo) + `loading.tsx` + BackButton fallback.
- **Import AI del listino**: riuso del motore di `catalogo/importa` (foto/PDF/testo)
  con destinazione supplier_list_items (costi, non prezzi di vendita). Stessa quota
  AI/kill-switch esistenti.
- **CatalogPicker con 2 linguette**: "Il mio catalogo | Listini fornitori". Dalla
  linguetta fornitori: voce → costo + prezzo proposto (costo + ricarico fornitore)
  + margine della voce (schermata 2 del mockup).
- **Aggancio scadenza all'invio**: nei punti d'invio del preventivo (ShareButton /
  SendEmailDialog / registerManualSendAction) se il documento usa voci di un listino
  con `valid_until` < scadenza preventivo → dialog "I prezzi del fornitore scadono
  prima" con [Allinea: valido N giorni] / [Lascia X giorni]. Il cliente vede solo
  "Valido fino al…". Per sapere "quali voci vengono da quale listino":
  `document_items.supplier_list_id UUID NULL` (stessa migration).
- **Rinnovo listino** (flusso F): reimport sullo stesso fornitore → match per
  code/description, aggiorna unit_cost, riepilogo differenze, nuova valid_until.

## FASE 3 — Guardiano + rifiniture

- **Campanella**: nuovo tipo notifica `listino_scaduto` in `lib/notifications.ts`
  (listini con valid_until superata + preventivi sent/viewed che usano quelle voci)
  + toggle in Impostazioni › Notifiche + icona. Pattern identico a `richiesta`
  (29 lug): schema Zod, mapping impostazioni/page, TYPE_ICON.
- **Interruttore manodopera nel margine** (flusso E): `hourly_cost` × ore sulle voci
  a ore. Default OFF.
- **Avviso su duplica** da listino scaduto (flusso G).

---

## COSA NON FACCIAMO (di proposito)

- ❌ Clausola automatica di "revisione prezzi" sul preventivo: verso i privati è
  terreno scivoloso (clausole vessatorie). Lo strumento pulito è la data di
  scadenza. Se un giorno servirà → domanda per l'avvocato PRIMA (B.0).
- ❌ Chiedere il "margine %" come input (solo ricarico; il margine si mostra).
- ❌ Colonne in più nella tabella voci (la riga privata è sotto la voce, non a lato).
- ❌ Automatismi che cambiano i prezzi del catalogo dell'utente.

## ALTRE DUE MOSSE APPROVATE DA ELI (2 ago, fuori da questo progetto)

1. **"Promessa prezzi" + supporto umano come posizionamento** (landing/abbonamento):
   copy da validare con l'AVVOCATO prima (claim AGCM, niente promesse assolute).
   → aggiungere al dossier unico avvocato alla prossima occasione.
2. **Solleciti automatici sulle fatture scadute**: email automatiche ai CLIENTI
   FINALI → regola B.0: design OPT-IN + validazione avvocato PRIMA di implementare.
3. ~~Riconciliazione bancaria~~ → decisione Eli: NON ora (post-lancio, nuovo
   fornitore Open Banking/GDPR).

## RIFERIMENTI

- Mockup approvato: 5 schermate + pilastri (inviato in chat il 2 ago, screenshot
  `mock-0…6` — flusso: listini → voce col costo → margine privato → dialog invio →
  campanella).
- Ricerca competitor: Tolteck (import listini fornitori + margine per voce, la
  funzione più apprezzata), Quotient (costo+ricarico → prezzo auto; margine con
  sconto sul totale = strumento di trattativa), Jobber (ricarichi predefiniti; NB
  il loro margine ignora gli sconti → lamentele: è l'errore da non ripetere).
