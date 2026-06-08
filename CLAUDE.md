# CLAUDE.md — Memoria permanente del progetto Carta Canta

> **Fonte di verità per Claude Code.**
> Va aggiornato a fine di ogni sessione con: feature implementate, decisioni prese, bug emersi, cose rimandate.
> **Ultima sessione:** 8 giugno 2026 (sessione FIX-04 — email e pagina pubblica cliente: testo "PDF allegato", email personale esposta, scaling documento mobile)

---

## A. HANDOFF — SESSIONE FIX-04 (8 giugno 2026)

### Fix applicati (commit `fix(cliente): email testo link-only + no email personale + documento pubblico responsive`)

**FIX-11 — L'email dice "PDF allegato" ma si invia solo il link**
- **Causa confermata — NON c'è alcun allegato PDF**: per scelta di prodotto (CLAUDE.md B.8, sessione 23) l'email invia SOLO il link pubblico (`/p/[token]`), l'allegato è stato rimosso perché il template dell'allegato non corrispondeva a quello scelto dall'utente. Il testo "PDF allegato" era residuo.
- Trovati 2 punti col testo errato:
  - `components/email/PreventivoEmail.tsx` riga 95: box informativo *"{La fattura/Il preventivo} in formato PDF è allegat{a/o} a questa email…"*
  - `app/(app)/preventivi/_components/ViewHistorySection.tsx` riga 39: tooltip *"queste aperture riguardano il link online, non l'allegato PDF dell'email"* — anche questo presuppone un allegato inesistente.
- `send-email/route.ts` e `SendEmailDialog.tsx` già corretti (default message "Le faccio avere il link…", nessuna menzione PDF) — nessuna modifica necessaria lì.
- Fix:
  - `PreventivoEmail.tsx`: box ora dice *"Puoi visualizzare {il preventivo/la fattura} online tramite il link qui sotto."* + per i preventivi *"Da lì puoi anche **accettarlo o rifiutarlo** direttamente online."* — niente più riferimenti ad allegati, testo parametrizzato preventivo/fattura.
  - `ViewHistorySection.tsx`: tooltip riformulato *"Ogni apertura del **link online** inviato via email viene registrata con data, ora e IP…"* — rimossa la menzione dell'allegato PDF inesistente.

**FIX-12 — Email personale dell'artigiano esposta al cliente**
- Causa confermata: `app/p/[token]/page.tsx` (righe 172-177) recupera `ownerEmail` via `admin.auth.admin.getUserById(workspace.owner_id)` — è l'**email di login dell'account** (es. `elly.4ee@gmail.com`), non un contatto business. Verificato che NON esiste un campo email/contatto business separato in `workspaces` (schema controllato in `types/database.ts`: solo `piva`, `indirizzo`, niente `email`/`pec`/`contact_email`). Verificato anche che `send-email/route.ts` riga 401 usa lo stesso `user.email` come `reply_to` — quindi l'indirizzo è già coerente col canale email, ma **veniva anche stampato in chiaro** come testo cliccabile in `ActionBar.tsx` (riga 61: `{contactEmail}` mostrato per esteso accanto a "Hai domande? Contatta {workspaceName}:").
- Decisione presa: poiché non esiste un'email business alternativa nello schema (allineare al `reply_to` non cambia l'indirizzo, è lo stesso), la soluzione minima e sicura è **non stampare più l'indirizzo in chiaro** — il link `mailto:` resta funzionante (apre il client di posta del cliente), ma il testo del link mostra solo "Contatta {workspaceName}" invece dell'indirizzo email per esteso. Stesso pattern già usato per le fatture (bottone "Contatta {workspaceName}" senza indirizzo visibile).
- Fix: `ActionBar.tsx` — rimossa la stampa di `{contactEmail}` come testo del link; ora il link `mailto:${contactEmail}` mostra solo "Contatta {workspaceName}" (icona Mail + testo). Il numero di telefono (`contactPhone`) resta visibile per esteso (non è un dato dell'account, è un recapito scelto consapevolmente).

**FIX-13 — Il documento pubblico richiede scroll orizzontale e taglia il contenuto su mobile**
- Causa confermata in `components/public/DocumentFrame.tsx`:
  1. Lo scale veniva calcolato in `useEffect` (dopo il paint) → primo render sempre con `scale=1` (iframe 794px fissi): su contenitori stretti (es. 360px) il documento appariva per un istante a piena larghezza, clippato dal contenitore (`overflow-hidden`) — "PREVENTIVO" tagliato in "PREV", totale fuori vista. Su dispositivi/condizioni dove il primo `setScale` non si "agganciava" in tempo al render visibile (font loading, layout shift), il flash diventava persistente.
  2. Il ricalcolo dipendeva SOLO da `window.addEventListener('resize', ...)`: qualunque variazione della larghezza del CONTENITORE non accompagnata da un resize della finestra (caricamento font, comparsa/scomparsa di scrollbar, rotazione su iOS Safari, ecc.) non veniva mai recalcolata — lo scale restava quello (sbagliato) calcolato al mount.
- Fix:
  - Sostituito `useEffect` con **`useLayoutEffect`** → lo scale viene calcolato e applicato PRIMA che il browser dipinga il frame, eliminando il flash di contenuto a piena larghezza/tagliato.
  - Sostituito il listener `window.resize` con un **`ResizeObserver`** sul contenitore (con fallback su `window.resize` se `ResizeObserver` non è disponibile) — segue ogni variazione reale della larghezza, non solo il resize della finestra.
  - `computeScale` ora usa `Math.min(1, containerWidth / A4_WIDTH_PX)` con guardia su `containerWidth` falsy (evita `scale = 0` o `NaN` in casi limite).
  - Aggiunto `overflowX: 'hidden'` esplicito + `max-w-full` sul contenitore come rete di sicurezza contro lo scroll orizzontale residuo.
- Nessuna modifica al layout interno del documento (`buildPdfHtml`/4 preset — INTOCCABILE) — solo al meccanismo di scaling esterno del frame.

**FIX-14 — Footer/diciture documento coerenti col tipo (verifica)**
- Verificato `lib/pdf/template.ts` post-FIX-02 (sessione precedente): `brandingSpan()` già condizionato (`isFattura ? 'Fattura generata' : 'Preventivo generato'`), tutte le occorrenze di "Valido fino al"/"Preventivo valido fino al" già condizionate con `!isFattura &&` (righe 473, 496, 607, 867). Nessuna occorrenza residua non condizionata — **nessuna modifica necessaria**, il fix della sessione FIX-02 copre già questo punto anche lato pagina pubblica (stessa fonte unica `buildPdfHtml`).

### File toccati (sessione FIX-04)
```
components/email/PreventivoEmail.tsx                      [box "PDF allegato" → testo link-only parametrizzato preventivo/fattura]
app/(app)/preventivi/_components/ViewHistorySection.tsx   [tooltip: rimossa menzione allegato PDF inesistente]
app/p/[token]/_components/ActionBar.tsx                   [link contatto: niente più indirizzo email in chiaro, solo "Contatta {workspaceName}"]
components/public/DocumentFrame.tsx                       [useLayoutEffect + ResizeObserver per scaling corretto senza flash; overflow-x:hidden esplicito]
CLAUDE.md                                                 [aggiornato]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde, 35 route generate
- `npm test -- --run` → 176/176 verdi
- Verifica per ispezione codice: grep `PDF allegat\|allegat.*PDF\|in formato PDF` su tutto il progetto → solo commenti di codice residui (non testo utente); grep `Valido fino al\|Preventivo generato` su `lib/pdf/template.ts` → tutte le occorrenze condizionate `isFattura`/`!isFattura`.
- **Non è stato possibile testare in browser reale su 360px** (nessun ambiente locale con dati/token pubblici disponibili in questa sessione — vedi nota CLAUDE.md sessione 24 sul worktree). Il fix di `DocumentFrame.tsx` è stato verificato per LOGICA (timing `useLayoutEffect` pre-paint + `ResizeObserver` per ricalcolo continuo) ma NON con screenshot reale.

### Esito finale
🟡 FIX APPLICATO — cause confermate con citazioni file/riga (in particolare: **confermato che NON esiste alcun allegato PDF** nell'architettura attuale, il testo era residuo di una vecchia funzionalità rimossa), tsc+build+test verdi. Da verificare manualmente: (1) email ricevuta non menziona più "PDF allegato"; (2) pagina pubblica non mostra più l'indirizzo email personale in chiaro (solo bottone "Contatta {azienda}"); (3) su 360px il documento pubblico si scala per intero senza scroll orizzontale né tagli — **richiede screenshot reale da browser/dispositivo mobile, non eseguibile in questa sessione**.

---

## A. HANDOFF — SESSIONE FIX-03 (7 giugno 2026)

### Fix applicati (commit `fix(numerazione): strip prefisso Prev ovunque + bozze coerenti + helper text`)

**FIX-8 — Prefisso "Prev"/"Fatt" grezzo ancora visibile (form, link cliente, CSV)**
- Causa confermata: `formatDocNumber()` (`lib/utils/index.ts`) strippa correttamente il prefisso legacy per la UI in-app, ma diversi punti NON ci passavano attraverso:
  - `PreventivoForm.tsx` riga ~218: lo state iniziale del campo "Numero" veniva popolato con `defaultValues?.doc_number` grezzo → un documento legacy con `doc_number = "Prev009/2026"` mostrava "Prev009/2026" nel form editabile (e lo riproponeva tale e quale al salvataggio).
  - `lib/pdf/template.ts` (`buildPdfHtml`, fonte unica per PDF e link pubblico `/p/[token]` via `<DocumentFrame src=".../pdf?preview=1">`): 11 occorrenze usavano `doc.doc_number` grezzo nell'HTML generato (header documento, `pageTitle`/nome file PDF, ecc.) — nessuna strippava il prefisso legacy. Il documento embeddato nell'iframe del link cliente mostrava quindi "#Prev009/2026" anche se l'header `<span>` della pagina (riga 205, già corretto con `formatDocNumber`) mostrava "009/2026".
  - `app/api/preventivi/export-csv/route.ts` (riga 91) e `app/api/fatture/export-csv/route.ts` (riga 86): scrivevano `doc.doc_number`/`ft.doc_number` grezzo in CSV → righe miste "Prev009/2026" (legacy) e "010/2026" (nuovo formato).
- Fix:
  - `PreventivoForm.tsx`: `useState` iniziale ora fa `defaultValues?.doc_number?.replace(/^[A-Za-z]+/, '') ?? ...` — il campo "Numero" mostra/salva sempre il valore pulito.
  - `lib/pdf/template.ts`: aggiunta variabile `docNumberClean = doc.doc_number ? doc.doc_number.replace(/^[A-Za-z]+/, '') : null` subito dopo `docTypeLabel`; sostituite TUTTE le 11 occorrenze di `doc.doc_number` nell'HTML/`pageTitle` con `docNumberClean` (incluse due righe quasi-duplicate 381/399 per varianti header logo-destra/sinistra del preset Classico — entrambe ora coerenti).
  - `export-csv` (preventivi e fatture): import `formatDocNumber`; valore scritto ora `doc.doc_number ? formatDocNumber(doc.doc_number[, 'fattura']) : ''` — niente più prefisso legacy, fatture mostrano "Fatt. 001/2026" come nel resto dell'app, vuoto per le bozze senza numero (coerente con CSV = export dati, non placeholder UI).

**FIX-9 — Numerazione bozze incoerente ("–" vs numero)**
- Causa confermata: per decisione prodotto sessione 26, `createDocumentAction` assegna SEMPRE un `doc_number` alla creazione (anche per le bozze) — ma i documenti creati PRIMA di questa modifica hanno `doc_number = null` in DB. `formatDocNumber(null)` ritorna `'—'` (em-dash), che appare come un trattino misterioso accanto a bozze più recenti che mostrano regolarmente "008/2026" ecc. Non è un bug di assegnazione (verificato `allocateDocNumber`/`createDocumentAction` — funzionano correttamente per tutti i nuovi documenti), ma una conseguenza visibile del cambio di policy su dati storici.
- Decisione presa (nessuna riassegnazione retroattiva — rischiosa: potrebbe creare conflitti/buchi nella sequenza): sostituito il placeholder ambiguo `'—'` con un'etichetta esplicita **"Bozza senza numero"** (corsivo, muted) nelle liste preventivi e fatture, SOLO quando `doc_number` è effettivamente `null`. Lasciato invariato `formatDocNumber` (usato altrove con pattern `!== '—' ? ... : fallback` — cambiarne il valore di ritorno avrebbe rotto quei controlli in 6+ file).
- File: `app/(app)/preventivi/page.tsx` (riga ~378), `app/(app)/fatture/page.tsx` (riga ~208) — entrambe `{doc.doc_number ? formatDocNumber(...) : <span className="...italic text-muted-foreground">Bozza senza numero</span>}`.

**FIX-10 — Helper text contraddittorio sul campo "Numero"**
- Verificato `PreventivoForm.tsx`: sostituito il blocco ternario che mostrava alternativamente "Numero manuale — verrà usato all'invio." oppure "Le bozze non hanno un numero ufficiale. Il numero definitivo viene assegnato automaticamente all'invio." (falso: dalla sessione 26 le bozze HANNO sempre un numero alla creazione) con un unico messaggio coerente: **"Numero assegnato automaticamente alla creazione — modificabile manualmente."**
- `FatturaForm.tsx`: testo "Modifica la parte numerica se necessario." verificato — non contraddittorio (form di creazione nuova fattura, usa `peekNextInvoiceNumber()` che ritorna sempre formato pulito `NNN/YYYY`), nessuna modifica necessaria.

### File toccati (sessione FIX-03)
```
app/(app)/preventivi/_components/PreventivoForm.tsx    [doc_number iniziale strippato; helper text unico "Numero assegnato automaticamente..."]
lib/pdf/template.ts                                    [docNumberClean: strip prefisso legacy in pageTitle + 11 occorrenze HTML (incl. righe 381/399 duplicate)]
app/api/preventivi/export-csv/route.ts                 [import formatDocNumber; numero CSV pulito, niente prefisso legacy]
app/api/fatture/export-csv/route.ts                    [idem, con marcatore 'fattura' → "Fatt. 001/2026"]
app/(app)/preventivi/page.tsx                          [placeholder "Bozza senza numero" per doc_number null]
app/(app)/fatture/page.tsx                             [idem]
CLAUDE.md                                              [aggiornato]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde (nessun errore)
- `npm run build` → verde, 35 route generate
- `npm test -- --run` → 176/176 verdi (nessuna regressione su `formatDocNumber`/template/export)
- Verifica per ispezione codice (no browser, causa assenza ambiente con dati legacy in locale): grep `doc\.doc_number` su `lib/pdf/template.ts` post-fix → solo la riga di assegnazione `docNumberClean` rimane con riferimento grezzo; nessuna occorrenza display residua. CSV export: entrambe le route ora passano per `formatDocNumber` su valori non-null.

### Esito finale
🟡 FIX APPLICATO — causa confermata con citazioni file/riga, fix coerente con la policy di numerazione (sez. B.3), tsc+build+test verdi. Da verificare manualmente in browser: (1) form preventivo legacy con "Prev..." mostra numero pulito ed editabile; (2) link pubblico cliente di un documento legacy non mostra più "#Prev..."; (3) CSV export non contiene più prefissi misti; (4) lista preventivi/fatture mostra "Bozza senza numero" al posto di "–" per le bozze storiche senza numero.

---

## A. HANDOFF — SESSIONE FIX-02 (7 giugno 2026)

### Fix applicati (commit `fix(fatture): coerenza stati/etichette/grammatica vs preventivo`)

**FIX-4 — Badge "Visto" su fatture**
- Causa confermata: in `StatusBadge.tsx` (riga 65) l'override per `docType='fattura'` impostava solo `overrideDescription` per lo stato `viewed`, lasciando `overrideLabel` indefinito → fallback su `config.label = 'Visto'` (concetto da preventivo).
- Fix: aggiunto `overrideLabel = 'Inviata'` per `viewed` quando `docType === 'fattura'` — la fattura resta "Inviata" anche dopo l'apertura del link da parte del cliente (lo stato interno `viewed` non cambia, cambia solo l'etichetta mostrata).
- `DocumentTimeline.tsx`: l'evento "Prima apertura" è generico (icona Eye), nessuna dicitura "Visto" — nessuna modifica necessaria lì.

**FIX-5 — Diciture "da preventivo" nelle fatture (validità/scadenza)**
- Causa confermata: `lib/pdf/template.ts` aveva diversi punti non condizionati su `isFattura`:
  - riga 344 `brandingSpan()`: footer fisso `"Preventivo generato con Carta Canta · cartacanta.app"` per tutti i preset/doc_type
  - riga 491 (preset Bold, contactParts header): `Valido fino al: ${expiresDateShort}` senza check `isFattura`
  - riga 602 (footer di un preset): `Valido fino al ${expiresDate}` senza check `isFattura`
  - (le righe 411, 468, 805, 862 erano già correttamente condizionate con `!isFattura`)
- Fix (solo testo condizionale, NESSUNA modifica al layout dei 4 preset — verificato build):
  - `brandingSpan()`: footer ora `"Fattura generata con Carta Canta…"` per `isFattura`, `"Preventivo generato…"` altrimenti
  - riga 491 e 602: aggiunta condizione `!isFattura &&` — per le fatture la riga "Valido fino al" non compare (via minima scelta come da nota prodotto: rimuovere la dicitura invece di mostrarla errata; la vera scadenza-pagamento arriverà con la feature Pagamenti #2)
- `DocumentTimeline.tsx` riga 127: l'evento cronologia "Scade il" (icona Clock, stile preventivo/validità) ora condizionato `!isFattura && (status === 'sent' || status === 'viewed') && expiresAt` — non compare più sulle fatture. L'evento "Scaduta"/"Scaduto" (status `expired`, riga 119-126) resta — riflette uno stato reale del documento, non una dicitura di "validità".
- `app/p/[token]/page.tsx`: il banner di stato per `expired` era hardcoded "Preventivo scaduto" senza branch `isPreventivo` (riga 363-369 originale) — aggiunta variante fattura "Fattura scaduta — Questa fattura ha superato la data di scadenza…".
- `FatturaForm.tsx`: header voci "Voci preventivo" → ora parametrizzato (vedi FIX-5/VOCI sotto); campo "Validità (giorni)" → rinominato in **"Scadenza pagamento (giorni)"** (il campo alimenta comunque `validity_days`/`expires_at` lato DB — nessun cambio di logica, solo etichetta coerente col dominio fattura, accanto a "Termini di pagamento" già presente).

**FIX-5bis — Header "VOCI PREVENTIVO" nel form fattura**
- Causa confermata: l'header è hardcoded `"Voci preventivo"` in `VociTable.tsx` riga 121 — componente condiviso tra `PreventivoForm` e `FatturaForm`, senza alcuna prop che lo distinguesse.
- Fix: aggiunta prop opzionale `docType?: 'preventivo' | 'fattura'` (default `'preventivo'`) a `VociTable`; header ora `Voci {docType === 'fattura' ? 'fattura' : 'preventivo'}`. `FatturaForm.tsx` passa `docType="fattura"`.

**FIX-6 — Dialog che dicono "preventivo" su una fattura**
- Causa confermata: `ResendReminderDialog.tsx` aveva titolo/testo hardcoded `"Preventivo aggiornato"` / `"Vuoi reinviare il preventivo adesso?"`, nessuna prop `docType`. `RestoreVersionButton.tsx` aveva già `docType` (fix sessione FIX-01) — nessuna modifica necessaria lì.
- Fix: aggiunta prop opzionale `docType?: 'preventivo' | 'fattura'` (default `'preventivo'`) a `ResendReminderDialog`; titolo e testo ora `"Fattura aggiornata"` / `"Vuoi reinviare la fattura adesso?"` quando `isFattura`. `PreventivoForm.tsx` (componente condiviso, usato anche per le fatture) passa `docType={docType}` (variabile già presente nello scope, riga 131).

**FIX-7 — Grammatica femminile mancante per le fatture**
- Causa confermata:
  - `SendEmailDialog.tsx` riga 605: `"Dopo l'invio lo stato passerà a Inviato"` hardcoded maschile, anche per `docType === 'fattura'`.
  - `app/p/[token]/page.tsx` riga 195: `{docLabelCap} inviato tramite…` — sempre maschile, anche quando `docLabelCap = 'Fattura'`.
- Fix: entrambi ora condizionati su `docType`/`isPreventivo` → `"passerà a Inviata"` e `"Fattura inviata tramite…"` per le fatture; il preventivo resta invariato ("Inviato"/"Preventivo inviato tramite…").

**FIX-7bis — Avviso di trasparenza SdI sulle fatture**
- Aggiunto banner discreto (ambra, icona `AlertTriangle` già importata) in `app/(app)/fatture/[id]/page.tsx`, subito sotto l'intestazione del documento (sopra il blocco "Collegata al preventivo…"): *"Questo documento non sostituisce la fattura elettronica. Ricordati di trasmetterla tramite SdI (cassetto fiscale o commercialista)."* — solo per le fatture, nessuna logica fiscale, nessuna modifica al template PDF (per non rischiare regressioni di layout sui 4 preset INTOCCABILI).

### File toccati (sessione FIX-02)
```
app/(app)/preventivi/_components/StatusBadge.tsx        [overrideLabel='Inviata' per status viewed su fatture]
app/(app)/preventivi/_components/DocumentTimeline.tsx   [evento "Scade il" nascosto per fatture (!isFattura)]
lib/pdf/template.ts                                     [brandingSpan condizionale isFattura; "Valido fino al" condizionato !isFattura in 2 punti — solo testo, layout preset invariato]
app/p/[token]/page.tsx                                  ["inviato"→"inviat{o|a}"; banner stato 'expired' con variante fattura]
app/(app)/fatture/_components/FatturaForm.tsx           [docType="fattura" a VociTable; label "Scadenza pagamento (giorni)"]
app/(app)/preventivi/_components/VociTable.tsx          [prop docType; header "Voci preventivo"/"Voci fattura"]
app/(app)/preventivi/_components/ResendReminderDialog.tsx [prop docType; titolo/testo "Fattura aggiornata"/"reinviare la fattura"]
app/(app)/preventivi/_components/PreventivoForm.tsx     [docType={docType} passato a ResendReminderDialog]
app/(app)/preventivi/_components/SendEmailDialog.tsx    ["passerà a Inviata" per fatture]
app/(app)/fatture/[id]/page.tsx                         [banner trasparenza SdI sotto l'intestazione]
CLAUDE.md                                               [aggiornato]
```

---

## A. HANDOFF — SESSIONE FIX-09 (7 giugno 2026)

### Fix applicato (commit `fix(invio): reinvio email bloccata sul cliente`)

**Bug — "Reinvia al cliente" permetteva di modificare l'email destinatario senza alcun effetto persistente**
- Causa confermata: in `app/api/documents/[id]/send-email/route.ts` la creazione/associazione cliente avviene SOLO quando `!doc.client_id` (branch `if (!doc.client_id && body.clientId)` / `else if (!doc.client_id && body.to)`). Sul reinvio `doc.client_id` è già valorizzato → quei branch vengono saltati: l'email parte verso `body.to` ma cliente/email del documento non cambiano. Inoltre `SendEmailDialog.tsx` reimposta `to = clientEmail` ad ogni apertura del dialog (via `useEffect`), quindi la modifica manuale non persiste mai — comportamento fuorviante (l'utente crede di aver cambiato il destinatario in modo permanente).
- **Decisione di prodotto confermata:** "Reinvia" = rimandare lo STESSO documento allo STESSO cliente. L'email non è modificabile dal dialog di reinvio; per cambiare destinatario bisogna modificare l'email del cliente nella rubrica Clienti.
- Fix in `SendEmailDialog.tsx`:
  - Nuova prop opzionale `clientId?: string | null` (per il link "rubrica Clienti").
  - Campo "Email destinatario": quando `isResend && hasClient && clientEmail` → `<Input readOnly disabled>` con stile `bg-muted/50 text-muted-foreground cursor-default`, valore = email del cliente; sotto, testo di aiuto "Per inviare a un altro indirizzo, modifica l'email del cliente nella rubrica Clienti." con link a `/clienti/[clientId]` quando l'id è disponibile (sempre disponibile nei due punti che aprono il dialog in reinvio).
  - Caso "reinvio ma cliente senza email salvata" (`isResend && hasClient && !clientEmail`): campo resta editabile, mantenuto messaggio esistente "Nessuna email salvata per questo cliente."
  - Primo invio (`!hasClient`): invariato — `ClientSearchInput` editabile con autocomplete.
- `preventivi/[id]/page.tsx` e `fatture/[id]/page.tsx`: aggiunta `clientId={pdfClient?.id ?? null}` al `<SendEmailDialog isResend>`. Per la fattura aggiunti anche `recipientName` e `hasClient` (mancavano, allineati a `preventivi/[id]/page.tsx`; `hasClient` di default era `true` quindi nessuna regressione, ma ora è esplicito e corretto anche per documenti senza cliente).

**Verifica richiesta dal prompt (non-fix, solo controllo):** in entrambe le pagine dettaglio il blocco di reinvio è gated da `(doc.status === 'sent' || doc.status === 'viewed')` e passa sempre `hasClient={!!pdfClient}` + `recipientName`. Quando il documento ha un cliente (`pdfClient` non null), `hasClient` è `true` → la variante "con cliente" (header "A: …" + campo email) è sempre quella mostrata in reinvio, e la X di chiusura del dialog (parte del `<DialogContent>` shadcn, non condizionata da `hasClient`) è sempre presente. Non è stato possibile riprodurre uno stato in cui `hasClient` diventi `false` per un documento con cliente — nessun bug separato da segnalare.

### File toccati (sessione FIX-09)
```
app/(app)/preventivi/_components/SendEmailDialog.tsx   [clientId prop; campo email read-only in reinvio con cliente+email; testo guida con link rubrica]
app/(app)/preventivi/[id]/page.tsx                     [clientId={pdfClient?.id ?? null} a SendEmailDialog isResend]
app/(app)/fatture/[id]/page.tsx                        [clientId, recipientName, hasClient a SendEmailDialog isResend]
CLAUDE.md                                              [aggiornato]
```

---

## A. HANDOFF — SESSIONE FIX-08 (7 giugno 2026)

### Fix applicati (commit `fix(invio): conflitto cliente + cliente dopo invio + badge modificato su voci`)

**CHECK-1 — Falso conflitto "due contatti con la stessa email" selezionando un contatto esistente**
- Causa confermata: in `send-email/route.ts` (riga ~195) il controllo conflitto confrontava `existingClient.name` (solo "Mario") con `body.clientName` ("Mario Rossi" — nome+cognome dal dialog), generando un falso positivo per ogni contatto con cognome valorizzato. Inoltre `handleSelectClient` in `SendEmailDialog.tsx` non comunicava alla route che il contatto era stato scelto esplicitamente dall'autocomplete (non inviava l'id).
- Fix:
  - `SendEmailDialog.tsx`: aggiunto stato `selectedClientId`; `handleSelectClient` lo valorizza con `c.id`; nuovi wrapper `updateFirstName/updateLastName/updateTo` azzerano `selectedClientId` se l'utente modifica manualmente nome/cognome/email dopo la selezione (evita di associare l'id sbagliato); `handleSend` include `clientId` nel body quando presente (e in tal caso NON invia `clientName`).
  - `send-email/route.ts`: nuovo branch `if (!doc.client_id && body.clientId)` — verifica che il cliente appartenga al workspace e lo associa direttamente, **saltando del tutto** il controllo conflitto (scelta esplicita = nessuna ambiguità). Per il path con `clientName` digitato a mano: aggiunto `surname` alla `select` di `existingClient` e il confronto ora usa il nome COMPLETO `[name, surname].join(' ')` invece del solo `name`.

**CHECK-2 — Cliente non visibile nel dettaglio subito dopo l'invio**
- Causa confermata: `send-email/route.ts` salva correttamente `client_id` (verificato, righe ~230-242 prima della modifica). Il bug era lato UI: `PreventivoForm.tsx` riga 142 inizializza `selectedClient` una sola volta con `useState(defaultClient ?? null)` e non si risincronizza quando `defaultClient` cambia dopo `router.refresh()`.
- Fix: aggiunto `useEffect` in `PreventivoForm.tsx` che imposta `selectedClient = defaultClient` quando `defaultClient` diventa valorizzato **e** `selectedClient` è ancora `null` (non sovrascrive una selezione manuale dell'utente).

**CHECK-3 — Badge "Modificato" non compare cambiando solo descrizione/unità di una voce**
- Causa confermata: in `lib/actions/documents.ts`, sia `updateDocumentAction` (~righe 503-513) sia `saveDraftAction` (~righe 799-808) calcolavano `publicFieldsChanged` confrontando solo campi a livello documento + `Math.abs(fiscal.total - existingDoc.total) > 0.001`. Le voci non venivano confrontate riga per riga: cambi di quantità/prezzo alterano il totale (→ badge), ma descrizione/unità no (→ nessun badge).
- Fix: nuova funzione `itemsSignature()` (firma normalizzata `description|unit|quantity|unit_price|discount_pct|vat_rate` per riga, in ordine) + confronto vecchia/nuova lista voci. Estesa `publicFieldsChanged` in ENTRAMBE le action con `|| itemsChanged`.
  - `updateDocumentAction`: le voci originali ora vengono lette PRIMA del delete sempre quando `wasAlreadySent` (non solo quando manca `sent_snapshot` come prima), riusate sia per il confronto sia per l'eventuale `retroSnapshot`.
  - `saveDraftAction`: stessa logica — `originalItemsForCompare` letto sempre quando `wasAlreadySent`, riusato per `snapshotToCreate` e per il confronto. Il confronto è disattivato se `fiscal.itemTotals.length === 0` (in tal caso le voci nel DB restano invariate — comportamento tollerante preesistente — quindi nessun "cambio" da segnalare).

### File toccati (sessione FIX-08)
```
app/(app)/preventivi/_components/SendEmailDialog.tsx   [selectedClientId state + wrapper update*; clientId nel body invio]
app/api/documents/[id]/send-email/route.ts             [branch clientId → associazione diretta; surname in select + confronto nome completo]
app/(app)/preventivi/_components/PreventivoForm.tsx    [useEffect sync selectedClient ← defaultClient]
lib/actions/documents.ts                               [itemsSignature() helper; publicFieldsChanged esteso con itemsChanged in updateDocumentAction e saveDraftAction]
CLAUDE.md                                              [aggiornato]
```

---

## ⚠️ CONFIG STRIPE DA FARE (sessione 26 — cambio fatturazione SOLO mensile→annuale)

> **Decisione prodotto:** consentito SOLO l'upgrade mensile → annuale, MAI il downgrade
> annuale → mensile. Il bottone "Passa alla fatturazione annuale" in `/abbonamento` compare
> solo per gli abbonamenti mensili e usa `switchToAnnualAction` → portale Stripe con flow
> `subscription_update_confirm` e prezzo annuale **pre-selezionato** (l'utente vede solo la conferma).
>
> **Config Stripe Dashboard (1 volta, sia in sandbox/test sia poi in live):**
> Stripe Dashboard → Settings → Billing → **Customer portal** (in italiano: Impostazioni →
> Fatturazione → Portale clienti):
> 1. Sezione **"Subscriptions"** → attivare **"Customers can switch plans"** (necessario perché
>    il flow `subscription_update_confirm` funzioni).
> 2. Aggiungere il prodotto **Pro** con entrambi i prezzi (Mensile + Annuale).
> 3. Proration: **"Create prorations"** (accredita i giorni non usati al cambio).
>
> ⚠️ **Sandbox vs Live:** la config va rifatta anche in modalità LIVE quando si va in produzione
> (le impostazioni sandbox NON si propagano al live).
>
> **Nota one-directional:** la nostra app offre solo l'upgrade. Stripe però, con "switch plans"
> attivo, tecnicamente permetterebbe il downgrade a chi raggiunge il portale generico
> ("Gestisci abbonamento"). Esposizione minima (l'app non offre quel percorso). Se in futuro
> serve blindarlo del tutto: fare lo switch via `stripe.subscriptions.update()` diretto + dialog
> di conferma in-app, e disabilitare lo switch nel portale.
> Il webhook `customer.subscription.updated` sincronizza già `billing_interval` nel DB.

---

## ⏰ TASK IMMINENTI DA FARE NEI PROSSIMI GIORNI (confermati dall'utente — sessione 25)

> **1. DMARC → quarantine** (azione manuale OVH dell'utente)
> L'utente riceve le email. Prima di passare a `p=quarantine`: controllare i report DMARC
> (SPF+DKIM pass) + test reale a Gmail/Outlook (inbox, non spam). Vedi checklist completa sotto.
> Sequenza obbligatoria: `none → quarantine → reject` (mai saltare a reject).
>
> **2. Attivare AI Import**
> Bottone oggi "IN ARRIVO" disabilitato. Per attivare: `NEXT_PUBLIC_AI_IMPORT_ENABLED=true` su Vercel
> + chiavi `OPENAI_API_KEY` / `MISTRAL_API_KEY`. Da fare dopo i test del piano Pro.
>
> **3. Fatturazione elettronica (SDI)** — task grosso pianificato. Richiede provider SDI gestito (~€0.10/fattura).

---

## ⏰ PROMEMORIA DATATO — DA LEGGERE SE LA DATA È INTORNO AL 15 GIUGNO 2026

> **DMARC cartacanta.app — verifica e aggiornamento policy**
>
> Il 15 maggio 2026 è stato configurato DMARC su OVH Cloud con `p=none`.
> Trascorse ~4 settimane → è il momento di controllare i report e aggiornare.
>
> **Checklist:**
> 1. Verifica report DMARC nella casella `rua=` — devono esserci report XML da Gmail/Outlook.
>    Se SPF e DKIM passano → si può procedere.
> 2. Invia preventivo di test a Gmail e Outlook → verifica inbox, non spam.
> 3. Se tutto ok: OVH Cloud → DNS → `_dmarc.cartacanta.app` → cambia da `p=none` a `p=quarantine`
>    Nuovo valore: `v=DMARC1; p=quarantine; rua=mailto:tuaemailpersonale@gmail.com;`
> 4. Se ci sono errori → NON cambiare policy. Segnala e risolvi prima.
>
> **Regola ferrea:** mai saltare da `p=none` a `p=reject`. Sequenza: `none → quarantine → reject`.

---

## A. HANDOFF — SESSIONE FIX-01 (6 giugno 2026)

### Fix applicati (commit `ce3932d`)

**FIX-1 — Stato non aggiornato dopo invio (preventivo e fattura)**
- Causa: `router.refresh()` era chiamato solo nel bottone "Chiudi" del dialog di successo. Chiudendo via X/Escape la pagina non si aggiornava.
- Fix: `SendEmailDialog.tsx` — aggiunto `useEffect` che chiama `router.refresh()` + `toast.success` appena `sent` diventa `true`. Il refresh avviene in background anche se l'utente chiude via X.
- Aggiunta importazione `sonner` (già usata altrove nell'app).

**FIX-2 — "Ripristina versione inviata" su fattura → 404**
- Causa: `RestoreVersionButton.tsx` riga 30 hardcodeva `window.location.href = /preventivi/${documentId}` anche per le fatture.
- Fix: aggiunto prop `docType?: 'preventivo' | 'fattura'` (default `'preventivo'`). Il redirect usa `/${docType === 'fattura' ? 'fatture' : 'preventivi'}/${documentId}`.
- `fatture/[id]/page.tsx`: passato `docType="fattura"` a `RestoreVersionButton`.
- `lib/actions/documents.ts` `restoreToSentVersionAction`: aggiunti `revalidatePath('/fatture')` e `revalidatePath('/fatture/${documentId}')`.
- Testo del dialog ora dice "La fattura/Il preventivo" in base al tipo.

**FIX-3 — Cliente non riportato in conversione preventivo → fattura**
- Causa: `fatture/[id]/page.tsx` non costruiva `formDefaultClient` e non passava `defaultClient` a `PreventivoForm`, al contrario di `preventivi/[id]/page.tsx` che lo fa correttamente.
- Fix: aggiunto `id` e `surname` alla select di `pdfClient`; costruito `formDefaultClient`; passato `defaultClient={formDefaultClient}` a `PreventivoForm`.
- NB: la RPC `convert_preventivo_to_fattura` copiava già `client_id` correttamente — il bug era solo in come la fattura veniva poi visualizzata nel form.

### Rifinitura FIX-3 (commit successivo)
- `formDefaultClient` in `fatture/[id]/page.tsx` non includeva `surname` → il form mostrava solo "Mario" invece di "Mario Rossi".
- Fix: aggiunto `surname: pdfClient.surname ?? null` nell'oggetto. `PreventivoForm` usa già `(c as { surname?: string | null }).surname` nel display name (riga 561).

### File toccati (sessione FIX-01)
```
app/(app)/preventivi/_components/SendEmailDialog.tsx   [useEffect refresh+toast su sent=true; rimosso refresh da Chiudi]
app/(app)/preventivi/_components/RestoreVersionButton.tsx [docType prop; redirect dinamico; testo dialog]
lib/actions/documents.ts                               [restoreToSentVersionAction: revalidatePath fatture]
app/(app)/fatture/[id]/page.tsx                        [formDefaultClient con surname; defaultClient a PreventivoForm; docType a RestoreVersionButton; pdfClient select id+surname]
CLAUDE.md                                              [regola push permanente a fine OGNI task (sez. 0 + 0-B)]
```

---

## A. HANDOFF — SESSIONE 24 — AUDIT + FIX (30 maggio 2026)

### Audit completo dell'app eseguito

È stato fatto un audit read-only completo (UX/testi, flussi, UI, mobile, performance, dati, sicurezza, accessibilità, feature promesse). **Risultato: 0 bug bloccanti, 7 importanti, 12 miglioramenti.**

⚠️ **NOTA TECNICA IMPORTANTE per chi lavora nel worktree:** il tool **Grep senza `path` esplicito cerca nel worktree `.claude/worktrees/sweet-joliot-3c8147`** (codice committato più vecchio), mentre **Read e Edit con path assoluto `C:\Users\Public\carta-canta\...` operano sul repo principale aggiornato**. Durante l'audit i risultati Grep erano stale. **Regola: per ricerche affidabili usare sempre `path: "C:\Users\Public\carta-canta\..."` nel Grep.**

### Fix applicati nell'audit (commit `f89519b` + `5c3f893`)

1. **Link cliente `/p/[token]` — rimosso toggle "Adatta/Dimensione reale"** (`DocumentFrame.tsx`): non funzionava, rimosso. Resta solo lo scaling responsive mobile automatico. (commit `5c3f893`)
2. **Tab Team rimosso da Impostazioni** (`impostazioni/page.tsx`): il tab promuoveva "Passa a Team" con link a `/abbonamento` dove Team è nascosto → vicolo cieco. Rimosso da `NAV_ITEMS` + `TabsContent`. `team.tsx` e `lib/actions/team.ts` restano nel codice per riattivazione futura.
3. **AI Import: feature flag** (`AiImportButton.tsx`): aggiunto `AI_IMPORT_ENABLED = process.env.NEXT_PUBLIC_AI_IMPORT_ENABLED === 'true'`. Finché non è `'true'`, il bottone mostra "IN ARRIVO" disabilitato invece di far fallire l'utente Pro con "AI non disponibile". **Per riattivare: settare `NEXT_PUBLIC_AI_IMPORT_ENABLED=true` su Vercel + configurare `OPENAI_API_KEY`/`MISTRAL_API_KEY`.**
4. **StatusChangeDropdown — feedback + conferma** (`StatusChangeDropdown.tsx`): ora mostra `toast.success` dopo il cambio stato; richiede conferma (dialog) per "Rifiutato" e "Scaduto"; aggiunta transizione `expired → sent` (riapri documento scaduto); accetta prop `docType` per messaggi corretti. Passato `docType="fattura"` nel dettaglio fattura.
5. **Catalogo — azioni su mobile** (`CatalogItemRow.tsx`): i bottoni Mostra/Modifica/Elimina erano `opacity-0 group-hover` (invisibili su touch). Ora `opacity-100 sm:opacity-0 sm:group-hover:opacity-100`. Aggiunto toast su toggle.
6. **Catalogo — dialog conferma custom** (`CatalogItemRow.tsx`): sostituito `confirm()` nativo con `Dialog` custom per l'eliminazione voce.
7. **Messaggi errore più chiari**: `templates.ts` ("Errore." → "Impossibile impostare il template predefinito. Riprova."), `catalogo/actions.ts` (3 messaggi), `documents.ts` (salvataggio preventivo/voci/aggiornamento).
8. **Avatar menu — aria-label** (`AppShell.tsx`): aggiunto `aria-label="Menu account"`.
9. **Codice morto rimosso**: cancellati `KanbanView.tsx`, `ViewToggle.tsx`, `ClientFilter.tsx` (non importati da nessuna parte).
10. **Skeleton loading** (`loading.tsx`): allineati i breakpoint a `lg:grid-cols-4`/`lg:grid-cols-3` come il layout reale dashboard (prima `md:` → salto su tablet). Colonna stretta a sx, larga a dx.

### Problemi emersi dall'audit — stato aggiornato

| Gravità | Problema | Note |
|---|---|---|
| ✅ | **Codice morto PDF rimosso** (sessione 25): cancellati `PreventivoPDF.tsx`, `lib/pdf/generate.ts`, dipendenza `@react-pdf/renderer` (56 pacchetti rimossi via npm), entry `serverExternalPackages` in `next.config.ts`. Il test `generate.test.ts` testava già `buildPdfHtml` (non `generate.ts`) → mantenuto e aggiornato. | Chiuso. |
| ✅ | **GitHub OAuth**: deciso di NON implementarlo. Solo Google (`OAuthButtons.tsx`). Doc corretti. | Chiuso sessione 24. |
| ✅ | **Logo PNG nel PDF**: confermato dall'utente che appare correttamente. | Chiuso. |
| 🟢 | **Route PDF senza fallback membro team** (`api/documents/[id]/pdf/route.ts`): carica workspace solo via `owner_id`. Irrilevante ora (Team nascosto). | Riallineare quando Team riattivato. |

### Sessione 25 — Conferma cliente nel popup invio + test suite (commit `cdd8a30`)

**Task: conferma cliente esistente con stessa email (popup invio).**
- `send-email/route.ts`: quando l'utente digita un nome esplicito nel popup e quell'email appartiene già a un cliente con **nome diverso**, la route ritorna `{ ok: false, clientConflict: { id, name, email } }` (status 200) invece di inviare. Body accetta `confirmClientMatch: boolean`.
- `SendEmailDialog.tsx`: nuovo stato `clientConflict`; `handleSend(confirmMatch?)`. Se arriva un conflitto, mostra una schermata di conferma ("L'email X appartiene già a Mario Rossi. Vuoi inviare a questo contatto?") con bottoni "Sì, invia a {nome}" (richiama con `confirmClientMatch: true` → usa il cliente esistente) e "No, modifica i dati". Non si creano due clienti con la stessa email.

**⚠️ TEST SUITE — era ROTTA, ora RIPARATA (176/176 verdi).**
Durante l'audit è emerso che la suite aveva **35 test rotti** (il `npm build` non esegue i test, quindi i fallimenti erano passati inosservati per più sessioni). Cause e fix:
- `pdf/generate.test.ts` (5): asserzioni su watermark (rimosso sessione 23), colore default (`#374151` da sessione 21), font, "Nessun cliente". Aggiornate al comportamento attuale.
- `signupRollback.test.ts` (12): mancava il mock di `@/lib/auth-rate-limit` (usa `headers()` → "request scope" error); password di default ora deve essere forte (`Password123!`); mock user con `identities` non vuoto; test `workspace_name` rimosso (campo non più validato); successo → `verifica-email` (conferma email attiva).
- `clients.test.ts` (17): `createClientAction`/`updateClientAction` usano `softValidate` LENIENTE (campi invalidi → stripped con warning, non errore) e ritornano `{success:'created'/'updated'}` senza `redirect`. Aggiunto mock `select` per il rilevamento duplicati + `.not()` per il fallback `workspace_members`. Default formData con email valida (contatto obbligatorio).
- `toggleCatalog.test.ts` (1): messaggio errore aggiornato.

**Lezione:** il `npm run build` NON esegue i test. Per verificare la suite usare `npm test`. Eseguire `npm test` prima di chiudere sessioni che toccano validazioni, messaggi o template PDF.

---

## A. HANDOFF — SESSIONI 21p2 + 22 + 23 (30 maggio 2026)

### Commit recenti (ultimi deploy)

```
2497129  fix(fatture): truncate client name to keep date on one line
6c734d3  fix(ux): session 23 — team hidden, PDF text, zoom, expires_at, client required, fattura validation
0f912ee  fix(ux): session 22 batch A+B+C+D+F+G+H+L1
bf5cd21  fix(ux): zoom preview + fattura timeline grammar + resend log
dc4cb30  fix(ux): session 22 part 2 — auth, password, nav, badge, fattura-send
fad983a  fix(ux): session 22 — 13 fixes dashboard, auth, abbonamento, template, fatture, timeline
e40156b  fix(ux): session 21 part 2 — 17 fixes (A1-A3, B1-B9, C1-C3, AI import)
c7c7bd5  fix(nav): always show full 'Nuovo preventivo' text on all screen sizes
```

### Cosa è stato fatto (sessioni 21p2 – 23)

#### Fix bug critici
- **`cognome` → `surname`** in `preventivi/page.tsx` e `dashboard/page.tsx`: la query usava il nome colonna sbagliato rendendo la lista vuota
- **ResendReminderDialog redirect**: ora usa `docType === 'fattura' ? '/fatture' : '/preventivi'` invece di hardcode `/preventivi`
- **Reset password → onboarding**: `/auth/callback` controlla anche `type === 'recovery'`. Il template email Supabase è stato cambiato manualmente da `{{ .ConfirmationURL }}` a `/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`. La `/auth/confirm/route.ts` ora redirige sempre a `/reset-password/confirm` se `type=recovery`.
- **Reset password secondo click**: Se il token è scaduto/usato, redirige a `/reset-password?error=link_scaduto` con banner spiegativo
- **Signup email già registrata**: `signupAction` controlla `authData.user.identities?.length === 0` → ritorna "Esiste già un account" senza tentare workspace creation (evitava crash e potenziale cancellazione utente)
- **AI Import "Errore di connessione"**: `pdf-to-image.ts` importato dinamicamente in `api/ai/extract/route.ts` (fix Vercel Lambda crash da `@sparticuz/chromium`)
- **Fattura "Modificato" badge**: `updateDocumentAction` ora imposta `updated_after_send_at` se cambiano campi pubblici (stessa logica C1 di `saveDraftAction`)
- **Snapshot retroattivo corretto**: In `updateDocumentAction` lo snapshot viene letto PRIMA del delete+insert delle voci
- **Preventivi che si riordinano**: `saveDraftAction` non aggiorna più `updated_at` (solo `updateDocumentAction` lo aggiorna su salvataggio esplicito)
- **`expires_at` non ricalcolata al salvataggio**: Per documenti `sent`/`viewed`, `updateDocumentAction` non ricalcola `expires_at`. La scadenza riparte solo al reinvio.
- **Clienti senza contatto nel sollecito**: `createClientAction` e `QuickCreateClientDialog` richiedono ora email O telefono obbligatori → risolve il bug "Inserisci il cliente" che compariva anche dopo aver aggiunto il cliente (mancava email/telefono)
- **`PendingDocCard` messaggio**: Cambiato da "Inserisci il cliente" a "Inserisci l'email o il telefono del cliente"
- **`send-email/route.ts` cliente senza nome**: crea/associa cliente anche con solo email (fallback: usa email come nome)
- **`sent_at` non sovrascritto al reinvio**: `send-email/route.ts` non sovrascrive più `sent_at` → primo invio resta in cronologia. Aggiunge evento `resent` al `document_log`
- **Dashboard non si aggiornava**: `revalidatePath('/dashboard')` aggiunto a `updateDocumentAction`
- **Fattura vuota submit senza errori**: Validazione aggiunta in `onClick` dei bottoni FatturaForm (React 19 poteva bypassare `onSubmit` con `useActionState`)
- **Nome cliente schiacciava la data in lista fatture**: `truncate min-w-0` sul nome + `shrink-0` sulla data

#### Nuove feature
- **Piano Team nascosto**: rimosso dalle card abbonamento e da tutte le menzioni in referral
- **Password forte obbligatoria**: componente `PasswordStrength.tsx` — maiuscola, minuscola, numero, simbolo; validation in signup e reset password
- **"+ Nuovo preventivo" nel nav**: sempre visibile con testo su tutti i dispositivi
- **Badge "Modificato" sempre visibile**: rimosso `hidden sm:` — ora compare anche su mobile in liste preventivi e fatture
- **Nuova fattura: "Salva bozza" + "Invia al cliente"**: due bottoni distinti; spinner solo sul bottone cliccato (`pendingIntent` state)
- **Fattura `?send=1`**: `createInvoiceAction` con `intent=send` → redirect a `/fatture/[id]?send=1` → `SendEmailDialogController` si apre auto
- **Zoom preview template**: `TemplatePreviewDialog` ha controlli +/-/Ctrl+scroll
- **Link cliente "Adatta/Dimensione reale"**: `DocumentFrame.tsx` ha un toggle che scala il documento per entrare in schermo
- **Errori grammaticali fattura**: `DocumentTimeline` usa `docType` prop → "Inviata/Inviata al cliente/Accettata/Scaduta/Rifiutata" per fatture. `StatusBadge` già corretto. `PreventivoForm.tsx` "diversa" → "diverso" (prezzo)
- **Testo "PDF allegato" rimosso**: messaggio default email e descrizione dialog aggiornati a "link al documento"
- **Avviso reinvio**: nel footer del dialog reinvio → "reinviando, la scadenza ripartirà da oggi"
- **`expires_at` riparte al reinvio**: `send-email/route.ts` ricalcola `expires_at = oggi + validity_days` solo al (re)invio
- **Timeline fattura**: `DocumentTimeline` con `docType="fattura"` + evento `resent` nel log
- **Cronologia completa fattura**: C2 (banner Modificato) + C3 (DocumentTimeline) su `fatture/[id]/page.tsx`
- **Font PDF +20%**: `lib/pdf/template.ts` e `TemplatePreview.tsx` — tutti i font size scalati ×1.2
- **Watermark rimosso (L1)**: il watermark diagonale "Carta Canta" è rimosso per tutti i piani. Rimane solo il footer "Preventivo generato con Carta Canta" (visibile solo Free)
- **Grid `items-end`**: tutti i form a 2 colonne usano `items-end` per allineare gli input quando i label sono di altezze diverse
- **Impostazioni**: P.IVA e Email sempre `grid-cols-2` (non responsive)
- **Sort preventivi**: Non si riordinano più da soli grazie alla rimozione di `updated_at` da `saveDraftAction`
- **Ricerca fatture estesa**: usa query separata su `clients` (come preventivi) invece di `.or()` con tabelle embedded
- **Template dropdown**: filtra "Template predefinito" e pre-seleziona il template attivo (`is_default=true` escludendo "Template predefinito")
- **Template mobile**: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` — 1 colonna su mobile
- **Verifica email**: pagina con form "Rinvia email di verifica" usando `supabase.auth.resend()`
- **Viewport zoom**: `maximumScale: 5, userScalable: true` nel layout — abilitato pinch-to-zoom

### Bug aperti dopo sessione 23

| # | Bug | Stato |
|---|---|---|
| C | Lista preventivi si riordina ancora? | `updated_at` rimosso da `saveDraftAction` — se persiste, potrebbe essere un trigger DB da investigare |
| AI Import | "AI non disponibile" | Le API key (OpenAI/Mistral) non sono configurate in produzione — da attivare dopo test Pro |
| Logo PNG nel PDF | Non testato con logo reale | `fetchLogoBase64()` in `lib/pdf/logo.ts` |
| Google OAuth intermittente | Bug #8 | Intermittente, non confermato risolto |

### Cose da fare (non ancora implementate)

| # | Task | Note |
|---|---|---|
| E | Messaggi errore fattura per "Invia al cliente" | Confermati i messaggi, da applicare con testo "inviare" + validazione cliente obbligatoria prima dell'invio |
| Popup invio | Conferma se email = cliente esistente con nome diverso | Da aggiungere in `SendEmailDialog` (flusso: "Trovato cliente Mario Rossi con questa email — usare quello?") |
| B1 | Documento grande nello schermo | Il pulsante "Adatta" in DocumentFrame è deployato; verificare che funzioni |
| I | Overflow testo | Audit visivo su 320px da fare manualmente — segnalare screenshot specifici |
| Numerazione bozze | "Bozza 001" separata | Decisione prodotto pendente |
| SDI fatturazione elettronica | Provider gestito ~€0.10/fattura | Rimandato |

### Decisioni prese nelle sessioni 21-23

| Decisione | Dettaglio |
|---|---|
| Piano Team nascosto | Nascosto da abbonamento, referral, impostazioni — fino al lancio ufficiale |
| Watermark rimosso | Il watermark diagonale è rimosso per tutti. Footer "Generato con Carta Canta" rimane solo per Free |
| `expires_at` riparte al reinvio | La scadenza si ricalcola SOLO quando il documento viene (re)inviato, non al salvataggio |
| Email/telefono obbligatori | Ogni cliente deve avere almeno email o telefono — bloccante in tutti i form di creazione |
| Password forte | Almeno 1 maiuscola + 1 minuscola + 1 numero + 1 simbolo. Validato sia client-side che server-side |
| Font PDF +20% | `lib/pdf/template.ts` e `TemplatePreview.tsx` scalati — decisione confermata |
| AI Import | Le key OpenAI/Mistral rimangono vuote in prod fino a fine test Pro |

### File chiave toccati (sessioni 21-23)

```
lib/actions/documents.ts                   [saveDraftAction, updateDocumentAction: expires_at, updated_at, snapshot]
lib/actions/clients.ts                     [createClientAction: email/phone required]
lib/pdf/template.ts                        [font +20%, watermark rimosso, footer branding]
lib/stripe/plans.ts                        [Team features, Pro features pulite]
app/api/documents/[id]/send-email/route.ts [sent_at preserved, resent log, client creation]
app/auth/callback/route.ts                 [type=recovery check]
app/auth/confirm/route.ts                  [recovery → reset-password/confirm + error redirect]
app/(auth)/actions.ts                      [identities check, password validation, resendVerificationEmail]
app/(auth)/reset-password/page.tsx         [banner link scaduto]
app/(auth)/reset-password/confirm/page.tsx [PasswordStrength]
app/(auth)/signup/_components/SignupForm.tsx [PasswordStrength]
app/(auth)/verifica-email/page.tsx         [form rinvia email]
app/(app)/abbonamento/_components/PricingSection.tsx [Team hidden]
app/(app)/referral/_components/ReferralPageClient.tsx [Team removed]
app/(app)/dashboard/page.tsx               [KPI href, Prossima Scadenza sort, grid lg, activity feed]
app/(app)/dashboard/_components/PendingDocCard.tsx [messaggio contatto]
app/(app)/fatture/page.tsx                 [search, badge, truncate name]
app/(app)/fatture/[id]/page.tsx            [C2 banner, C3 timeline, SendEmailDialogController, docType]
app/(app)/fatture/_components/FatturaForm.tsx [validation onClick, pendingIntent, items-end, intent=send]
app/(app)/fatture/nuovo/page.tsx           [defaultTemplateId filter]
app/(app)/preventivi/page.tsx              [surname fix, badge Modificato visible]
app/(app)/preventivi/[id]/page.tsx         [defaultTemplateId filter]
app/(app)/preventivi/nuovo/page.tsx        [defaultTemplateId filter]
app/(app)/preventivi/_components/PreventivoForm.tsx [items-end, template filter, bonus edilizio copy]
app/(app)/preventivi/_components/SendEmailDialog.tsx [PDF text removed, resend warning, title tooltip]
app/(app)/preventivi/_components/DocumentTimeline.tsx [docType, resent event, grammar]
app/(app)/template/page.tsx                [grid-cols-1 sm, legalNotice, defaultLegalNotice]
app/(app)/template/_components/DefaultTemplateCard.tsx [w-full, legalNotice prop]
app/(app)/template/_components/CustomTemplateCard.tsx [w-full]
app/(app)/template/_components/TemplatePreview.tsx [font +20%]
app/(app)/template/_components/TemplatePreviewDialog.tsx [zoom controls]
app/(app)/impostazioni/tabs/generali.tsx   [grid-cols-2 items-end]
app/(app)/impostazioni/tabs/piano.tsx      [features Pro pulite]
app/(app)/_components/AppShell.tsx         [nav button testo completo]
app/api/ai/extract/route.ts                [dynamic import pdf-to-image]
components/public/DocumentFrame.tsx        [Adatta/Dimensione reale toggle]
components/shared/PasswordStrength.tsx     [NUOVO]
components/shared/ZoomControls.tsx         [NUOVO — non più usato direttamente]
components/shared/QuickCreateClientDialog.tsx [email/phone required]
```

---

## A. HANDOFF — SESSIONE 21 (27 maggio 2026)

### Cosa è stato fatto

**Template:**
- `LegalNoticeField.tsx`: dropdown adiacente al label (`flex items-center gap-2`, rimosso `justify-between`)
- Colore classico default: `#1a1a2e` → `#374151` (grigio scuro Tailwind gray-700) in: `lib/actions/templates.ts` (schema, PRESET_DEFAULTS, fallback x2, insert), `lib/actions/documents.ts` (resolveTemplateSnapshot), `app/api/documents/[id]/pdf/route.ts`, `app/api/documents/[id]/send-email/route.ts`, `app/api/p/[token]/pdf/route.ts`, `lib/pdf/template.ts` (fallback), `DefaultTemplateCard.tsx` (x2), `PresetSelector.tsx`, `TemplateEditor.tsx`
  - NB: i `safeAccentColor` fallback rimangono `#1a1a2e` (sono safety override, non default)
  - NB: gli header email del brand rimangono `#1a1a2e`
  - NB: colori elegante-specific (numero doc italic) rimangono `#1a1a2e`
- Fix `saveDefaultSettingsAction` duplicato template: cerca per `is_default=true` OR `name='Template predefinito'`; se trovato aggiorna invece di creare; rimette `is_default=true` sull'aggiornato
- `template/page.tsx`: "Template predefinito" escluso dai custom template card; `isDefaultActive` = true se nessun custom ha `is_default=true`; fallback colore custom `#374151`

**Dashboard:**
- Rimossa KPI card "In attesa di risposta"
- Rimossa sezione "Azioni rapide"
- Activity feed: `slice(0, 5)` invece di 10; badge viola "Modificato" + cognome cliente + troncatura ellissi
- "Prossima scadenza" posizionata PRIMA di "Attività recente"
- KPI "Preventivi accettati" → `href="/preventivi?status=accepted"`
- KPI "Valore preventivi" → `href="/preventivi?status=accepted"`
- Grafico: barra chiara = fatturato (fatture accepted per mese) invece di preventivi creati; legenda e tooltip aggiornati
- Copy "nessun watermark" → "watermark rimovibile" nei banner Free

**Invio manuale:**
- `RegisterManualSendButton.tsx`: aggiunto `<input type="date">` con default oggi e max=oggi; campo con hint
- `registerManualSendAction`: accetta `sentAtParam?: string` (YYYY-MM-DD); se omesso usa oggi

**Copy piano Pro:**
- `lib/stripe/plans.ts`: `'PDF senza watermark'` → `'Watermark Carta Canta rimovibile'`
- `preventivi/page.tsx` (2x): "nessun watermark" → "watermark rimovibile"
- `abbonamento/page.tsx`: `value='Rimosso'` → `value='Rimovibile'`

**Impostazioni:**
- `impostazioni/page.tsx`: tab label `hidden sm:inline` (solo icona su xs); `title={label}` per tooltip hover

**Pagina preventivi:**
- Rimosso sottotitolo "X inviati · Y accettati · Z bozze"
- Query aggiornata con `clients(id, name, cognome, email)` — mostra nome+cognome sotto ogni riga
- Troncatura `max-w-[120px] sm:max-w-[200px]` sul nome cliente per evitare compressione data
- Tooltip `title="Esporta CSV"` su bottone icon-only

**Preventivi in attesa (scadenze + PendingDocCard):**
- `scadenze/page.tsx`: query aggiunge `updated_after_send_at`; passa a `PendingDocCard`
- `PendingDocCard.tsx`:
  - Nessun contatto (email né phone) → mostra "Inserisci il cliente nel preventivo per poter inviare un sollecito" (con link al preventivo)
  - Badge viola quando `updatedAfterSendAt` set
  - Testo composito: "Inviato il X. Modificato il Y. Non ancora rinviato."
  - Import `UserRound` da lucide-react

**Pagina fatture:**
- Usa `StatusBadge` con `docType='fattura'` (labels: Inviata/Aperta/Pagata/Annullata/Scaduta) invece di custom Badge
- Query aggiunge `updated_after_send_at`; badge viola "Modificato" sulle righe
- Ricerca per stato con matching parziale: "pag"→Pagata, "inv"→Inviata, "boz"→Bozza ecc. (min 2 caratteri)
- `title` su bottoni icon-only (Da preventivo, Nuova fattura, Esporta CSV)
- Placeholder search aggiornato: "Cerca fattura o stato (pagata, bozza…)"

**Azioni e redirect:**
- `createInvoiceAction`: redirect a `/fatture` invece di `/fatture/${doc.id}`
- `ClientForm.tsx`: `useEffect` aggiunto per redirect a `/clienti` dopo `success='updated'` (senza warnings)

**Dashboard query:**
- `allDocs` select aggiornata con `updated_after_send_at, clients(name, cognome)` per activity feed

### Commit sessione 21

```
9868a67  feat(ux): 27-point batch — dashboard, fatture, preventivi, template, clienti
```

### File toccati (sessione 21)

```
app/(app)/template/_components/LegalNoticeField.tsx           [dropdown adiacente al label]
app/(app)/template/_components/DefaultTemplateCard.tsx        [colore #374151]
app/(app)/template/_components/PresetSelector.tsx             [defaultColor #374151]
app/(app)/template/_components/TemplateEditor.tsx             [useState default #374151]
app/(app)/template/page.tsx                                   [esclude 'Template predefinito' dai custom; isDefaultActive fix]
lib/actions/templates.ts                                      [schema default #374151; PRESET_DEFAULTS classico; fallback x2; insert #374151; fix saveDefaultSettingsAction duplicato]
lib/actions/documents.ts                                      [resolveTemplateSnapshot #374151; registerManualSendAction sentAtParam; createInvoiceAction redirect /fatture]
lib/pdf/template.ts                                           [fallback color #374151]
lib/stripe/plans.ts                                           [copy watermark rimovibile]
app/api/documents/[id]/pdf/route.ts                           [fallback #374151]
app/api/documents/[id]/send-email/route.ts                    [fallback #374151]
app/api/p/[token]/pdf/route.ts                                [fallback #374151]
app/(app)/dashboard/page.tsx                                  [KPI rimozione, layout, chart fatturato, feed slice(5), badge viola, cognome, redirect href]
app/(app)/dashboard/_components/PendingDocCard.tsx            [no-contact msg, badge viola, testo composito modificato]
components/dashboard/RevenueChart.tsx                         [legenda e tooltip fatturato]
app/(app)/preventivi/page.tsx                                 [rimozione sottotitolo, cognome, troncatura, tooltip, copy watermark]
app/(app)/preventivi/scadenze/page.tsx                        [updated_after_send_at in query + DocWithClient type + PendingDocCard prop]
app/(app)/preventivi/_components/RegisterManualSendButton.tsx [input date + sentDate state]
app/(app)/fatture/page.tsx                                    [StatusBadge, updated_after_send_at, ricerca stato, tooltip bottoni]
app/(app)/abbonamento/page.tsx                                [copy Rimovibile]
app/(app)/impostazioni/page.tsx                               [tab label hidden sm:inline + title]
app/(app)/clienti/_components/ClientForm.tsx                  [redirect /clienti dopo update]
CLAUDE.md                                                     [aggiornato]
```

### Bug risolti in sessione 21

| # | Bug / Richiesta | Stato |
|---|---|---|
| LegalNoticeField dropdown a destra invece che adiacente | Fix layout `flex items-center gap-2` | ✅ RISOLTO |
| Colore classico "grigio scuro" era nero (#1a1a2e) | Cambiato in #374151 ovunque | ✅ RISOLTO |
| saveDefaultSettingsAction crea duplicato "Template predefinito" | Cerca per is_default OR nome prima di creare | ✅ RISOLTO |
| "Template predefinito" appare come card custom | Escluso dalla lista custom in template/page.tsx | ✅ RISOLTO |
| Dashboard: KPI "In attesa di risposta" | Rimossa | ✅ RISOLTO |
| Dashboard: sezione "Azioni rapide" | Rimossa | ✅ RISOLTO |
| Dashboard: activity feed ultime 10 | Ridotto a ultime 5 | ✅ RISOLTO |
| Dashboard: "Prossima scadenza" dopo "Attività recente" | Spostata prima | ✅ RISOLTO |
| KPI non cliccabili | href aggiunto a Preventivi accettati e Valore preventivi | ✅ RISOLTO |
| Grafico mostra "preventivi creati" | Sostituito con fatturato (fatture accepted) | ✅ RISOLTO |
| Invio manuale senza scelta data | Input date con default oggi aggiunto | ✅ RISOLTO |
| Copy "nessun watermark" invece di "rimovibile" | Fix ovunque | ✅ RISOLTO |
| Tab impostazioni su 2 righe su mobile | Solo icona su xs (hidden sm:inline) | ✅ RISOLTO |
| Sottotitolo preventivi con contatori | Rimosso | ✅ RISOLTO |
| Cognome non mostrato in lista preventivi | Aggiunto con troncatura ellissi | ✅ RISOLTO |
| Data compressa da nome lungo in lista preventivi | Troncatura max-w e shrink-0 sulla data | ✅ RISOLTO |
| PendingDocCard senza suggerimento se manca contatto | Aggiunto suggerimento con link | ✅ RISOLTO |
| Badge viola "Modificato" mancante in PendingDocCard | Aggiunto | ✅ RISOLTO |
| Pagina fatture usa Badge custom invece di StatusBadge | Usa StatusBadge con docType=fattura | ✅ RISOLTO |
| Fatture non mostrano badge "Modificato" | Aggiunto badge viola | ✅ RISOLTO |
| Ricerca fatture non filtra per stato | Aggiunta ricerca per stato con prefisso | ✅ RISOLTO |
| Dopo creazione fattura → pagina dettaglio invece che lista | Redirect a /fatture | ✅ RISOLTO |
| Dopo salvataggio cliente → rimane nella pagina | Redirect a /clienti | ✅ RISOLTO |
| Cognome mancante in activity feed dashboard | Aggiunto con troncatura | ✅ RISOLTO |

### Cose aperte dopo sessione 21

1. Test manuali: template default → colore picker mostra #374151 (grigio scuro)
2. Test manuali: template/default → salva → non crea duplicato "Template predefinito"
3. Test manuali: invio manuale preventivo → campo data con default oggi modificabile
4. Test manuali: dashboard grafico → barra chiara = fatture pagate (non preventivi creati)
5. Test manuali: ricerca fatture "pag" → mostra solo paginate; "inv" → solo inviata
6. Test manuali: lista preventivi → cognome mostrato + data non compressa su mobile
7. Test manuali: PendingDocCard senza cliente → messaggio "Inserisci il cliente..."
8. Numerazione bozze separata — decisione prodotto pendente
9. Bug #8: Google OAuth intermittente
10. Bug #9: Logo PNG nel PDF — da testare con logo reale

---

## A. HANDOFF — SESSIONE 20 (24 maggio 2026)

### Cosa è stato fatto

**Rimozione prefisso Prev/Fatt dai numeri di documento:**
- `lib/utils/index.ts`: `formatDocNumber()` ora restituisce il numero senza prefisso letterale (es. "001/2026" invece di "Prev001/2026") — via `replace(/^[A-Za-z]+/, '')`.
- Fix applicato in 9 file: `preventivi/page.tsx`, `preventivi/[id]/page.tsx`, `fatture/[id]/page.tsx`, `DocumentTimeline.tsx`, `DocumentRowActions.tsx`, `LinkToPreventivoButton.tsx` (era aggiunto "Prev " esplicitamente!), `p/[token]/page.tsx`, `preventivi/scadenze/page.tsx`, `lib/actions/documents.ts` (email/solleciti), `app/api/documents/[id]/send-email/route.ts`.

**Migration `convert_preventivo_to_fattura` applicata dall'utente su Supabase SQL Editor.**

**Quota banner su dashboard spostato in cima:**
- `dashboard/page.tsx`: banner trial/quota ora in cima alla pagina (prima dell'header), sempre visibile per Free (rimossa soglia 75%), stile rosso/ambra.

**Fix watermark "NON ANCORA INVIATO" (regressione sessione 19):**
- `lib/pdf/template.ts`: il watermark era diventato "BOZZA" per tutti i preventivi non inviati — a causa della rimozione di `pdf_downloaded_at` in sessione 19 che lasciava la vecchia logica conditionals sempre su "BOZZA".
- Fix: semplificato a `if (doc.status === 'draft') { statusWatermarkText = 'NON ANCORA INVIATO' }`.

**Pagina Template — rimozione sezione Layout:**
- `app/(app)/template/page.tsx`: rimossa intera sezione "Layout" con i 4 preset card. La sezione Personalizzazione ora include:
  - `DefaultTemplateCard` sempre visibile come prima opzione (Default Classico, grigio scuro)
  - Template personalizzati dell'utente selezionabili accanto ad esso
  - `isDefaultActive = !templates?.some(t => t.is_default)` — Default attivo quando nessun custom template ha `is_default = true`
- `lib/actions/templates.ts`: aggiunta `clearDefaultTemplateAction` — toglie `is_default` da tutti i template del workspace (torna al Classico di sistema).
- `app/(app)/template/_components/DefaultTemplateCard.tsx`: NUOVO componente client — mostra preview Classico, chiama `clearDefaultTemplateAction()` al click, badge ✓ quando attivo.

**Audit mobile completo — fix applicati:**
- `app/(app)/preventivi/page.tsx`: icone fattura (FileCheck2 + Eye) e badge "Modificato" ora `hidden sm:flex`/`hidden sm:inline-flex` — elimina overflow testo su 320-375px.
- `app/(app)/preventivi/_components/VociTable.tsx`: riga 2 voci (Unità/Quantità/Prezzo/Sconto/IVA) cambiata da `grid-cols-5` a `grid-cols-4 sm:grid-cols-5` — su mobile IVA va a capo naturalmente, evita colonne da 40px.
- `app/(app)/impostazioni/tabs/generali.tsx`: `grid-cols-2` → `grid-cols-1 sm:grid-cols-2` per la riga P.IVA + Email.
- `app/(app)/catalogo/_components/CatalogItemForm.tsx`: `grid-cols-3` → `grid-cols-2 sm:grid-cols-3` per Unità/Prezzo/IVA.
- `app/(app)/preventivi/_components/SendEmailDialog.tsx`: `grid-cols-2` → `grid-cols-1 sm:grid-cols-2` per Nome/Cognome nel form invio senza cliente.

### Commit sessione 20

```
74b3feb  fix(ux): remove Prev/Fatt prefix from doc numbers + quota banner on dashboard
182cc11  fix(ux): strip Prev/Fatt prefix from all display locations
faa12b6  fix(ux): watermark + template page + mobile audit fixes
```

### File toccati (sessione 20)

```
lib/utils/index.ts                                        [formatDocNumber: strip prefix]
lib/actions/documents.ts                                  [email/solleciti: strip prefix]
app/api/documents/[id]/send-email/route.ts                [strip prefix da docNumber]
app/(app)/preventivi/page.tsx                             [formatDocNumber + hide fattura icons + Modificato badge on mobile]
app/(app)/preventivi/[id]/page.tsx                        [formatDocNumber breadcrumb/h1/fattura]
app/(app)/preventivi/_components/DocumentTimeline.tsx     [strip prefix da numero fattura]
app/(app)/preventivi/_components/DocumentRowActions.tsx   [formatDocNumber nel dialog delete]
app/(app)/preventivi/_components/VociTable.tsx            [grid-cols-4 sm:grid-cols-5 per riga voci mobile]
app/(app)/preventivi/_components/SendEmailDialog.tsx      [grid-cols-1 sm:grid-cols-2 per Nome/Cognome]
app/(app)/fatture/[id]/page.tsx                           [formatDocNumber]
app/(app)/fatture/_components/LinkToPreventivoButton.tsx  [rimosso "Prev " hardcoded]
app/(app)/preventivi/scadenze/page.tsx                    [strip prefix da docNumber]
app/(app)/dashboard/page.tsx                              [banner quota in cima, sempre visibile Free]
app/(app)/impostazioni/tabs/generali.tsx                  [grid-cols-1 sm:grid-cols-2 P.IVA+Email]
app/(app)/catalogo/_components/CatalogItemForm.tsx        [grid-cols-2 sm:grid-cols-3]
app/(app)/template/page.tsx                               [rimossa sezione Layout, DefaultTemplateCard]
app/(app)/template/_components/DefaultTemplateCard.tsx    [NUOVO]
app/p/[token]/page.tsx                                    [formatDocNumber header]
lib/actions/templates.ts                                  [clearDefaultTemplateAction NUOVO]
lib/pdf/template.ts                                       [fix watermark NON ANCORA INVIATO]
CLAUDE.md                                                 [aggiornato]
```

### Bug risolti in sessione 20

| # | Bug / Richiesta | Stato |
|---|---|---|
| Prefisso "Prev"/"Fatt" visibile in UI | Rimosso da tutti i punti di visualizzazione | ✅ RISOLTO |
| Watermark "BOZZA" invece di "NON ANCORA INVIATO" | Fix regressione sessione 19 | ✅ RISOLTO |
| Sezione "Layout" template — 4 card preset | Rimossa, sostituita con Default card | ✅ RISOLTO |
| Lista preventivi mobile — overflow/testo sovrapposto | Icone fattura + badge nascosti su mobile | ✅ RISOLTO |
| VociTable mobile — colonne IVA troppo strette | grid-cols-4 sm:grid-cols-5 | ✅ RISOLTO |
| Impostazioni P.IVA + Email — 2 col su 320px | grid-cols-1 sm:grid-cols-2 | ✅ RISOLTO |
| CatalogItemForm — 3 col su 320px | grid-cols-2 sm:grid-cols-3 | ✅ RISOLTO |
| SendEmailDialog Nome/Cognome — 2 col su 320px | grid-cols-1 sm:grid-cols-2 | ✅ RISOLTO |

### Cose aperte dopo sessione 20

1. Test manuali: lista preventivi su 375px → verificare che nomi non si sovrappongano più
2. Test manuali: VociTable mobile → IVA va a capo, non troppo stretta
3. Test manuali: pagina template → Default card e custom template selezionabili
4. Test manuali: watermark PDF su bozza → "NON ANCORA INVIATO"
5. Numerazione bozze separata — decisione prodotto pendente
6. Bug #8: Google OAuth intermittente
7. Bug #9: Logo PNG nel PDF — da testare con logo reale

---

## A. HANDOFF — SESSIONE 19 (24 maggio 2026)

### Cosa è stato fatto

**Fix messaggi di errore voci — specifici invece di "Voci non valide":**
- `lib/actions/documents.ts`: tutte e 3 le occorrenze `return { error: 'Voci non valide' }` sostituite con `return { error: voceList.error.issues[0]?.message ?? 'Dati voce non validi' }`.
  - In `createDocumentAction` (preventivi), `saveDraftAction`, `createInvoiceAction` (fatture)
  - Ora il server restituisce messaggi come "Descrizione obbligatoria", "Quantità non valida", "Prezzo non valido" — esattamente i messaggi definiti in `VoceSchema` (Zod).

**Rimosso "Lo stato del documento non cambierà." da SendEmailDialog:**
- `SendEmailDialog.tsx`: rimossa la riga `{isResend && (<> Lo stato del documento non cambierà.</>)}` dalla didascalia sotto il campo messaggi.

**Nome file PDF automatico:**
- `lib/pdf/template.ts`: funzione `wrap()` ora accetta `pageTitle?: string` come 4° parametro e lo inserisce come `<title>` nel `<head>` dell'HTML.
- `buildPdfHtml()`: calcola `pageTitle` = `"Preventivo 001/2026 - Carta Canta"` (o "Fattura ...") usando `doc.doc_number`. Se bozza senza numero → `"Preventivo - Carta Canta"`.
- Tutti e 4 i `return wrap(font, ..., fontName)` aggiornati in `return wrap(font, ..., fontName, pageTitle)`.
- Quando l'utente salva il PDF dal dialogo di stampa del browser, il nome file suggerito è automaticamente `"Preventivo 001/2026 - Carta Canta.pdf"`.

**Rimozione logica "PDF scaricato" (pdf_downloaded_at):**
- La logica di tracciamento `pdf_downloaded_at` è stata rimossa in quanto creava confusione nell'UX. Non viene più segnato il primo download del PDF.
- `StatusBadge.tsx`: rimosso prop `pdfDownloaded?: boolean`, rimossa label "Bozza · PDF scaricato" e relativo tooltip.
- `preventivi/page.tsx`: rimosso `pdf_downloaded_at` dalla select query; rimosso `pdfDownloaded={...}` da `<StatusBadge>`.
- `preventivi/[id]/page.tsx`: rimosso `hasPdfDownloaded`, rimosso `pdfDownloaded` da `<StatusBadge>`, rimosso banner ambra "PDF scaricato — numero non ancora assegnato". Condizione `!hasPdfDownloaded` rimossa dal banner trial Free.
- `api/documents/[id]/pdf/route.ts`: rimossa logica `isFirstDraftView`, rimosso `UPDATE pdf_downloaded_at`. Il blocco Free ora si attiva su qualsiasi apertura bozza (non solo la prima).

**Bottone "Registra invio manuale" sempre visibile nelle bozze:**
- `preventivi/[id]/page.tsx`: rimosso il vecchio banner condizionale (`isDraft && hasPdfDownloaded`). Sostituito con un banner sottile sempre visibile quando `isDraft` che mostra `<RegisterManualSendButton>` inline.
- Copy del banner: "Hai inviato il preventivo al cliente fuori dall'app? Registra l'invio per assegnare il numero progressivo e aggiornare lo stato."
- `RegisterManualSendButton.tsx` già esisteva e funzionava — nessuna modifica necessaria.

### Commit sessione 19

```
b5c74d1  fix(validation): replace generic 'Voci non valide' with specific Zod field messages
[commit corrente]  fix(ux): PDF filename + remove pdf_downloaded logic + manual send always visible
```

### File toccati (sessione 19)

```
lib/actions/documents.ts                                  [Voci non valide → messaggi Zod specifici]
app/(app)/preventivi/_components/SendEmailDialog.tsx      [rimosso "Lo stato del documento non cambierà."]
lib/pdf/template.ts                                       [pageTitle in wrap() → nome file PDF automatico]
app/(app)/preventivi/_components/StatusBadge.tsx          [rimosso pdfDownloaded prop]
app/(app)/preventivi/page.tsx                             [rimosso pdf_downloaded_at da query + StatusBadge prop]
app/(app)/preventivi/[id]/page.tsx                        [rimosso banner PDF scaricato, hasPdfDownloaded; aggiunto banner invio manuale sempre visibile]
app/api/documents/[id]/pdf/route.ts                       [rimosso tracking pdf_downloaded_at]
CLAUDE.md                                                 [aggiornato]
```

### Bug risolti in sessione 19

| # | Bug / Richiesta | Stato |
|---|---|---|
| "Voci non valide" generico su submit | Sostituito con messaggio Zod specifico | ✅ RISOLTO |
| "Lo stato del documento non cambierà." nel reinvio | Rimosso | ✅ RISOLTO |
| Nome file PDF non impostato | `<title>` in HTML → browser usa "Preventivo 001/2026 - Carta Canta" | ✅ RISOLTO |
| Badge "Bozza · PDF scaricato" nella lista | Logica pdf_downloaded rimossa | ✅ RISOLTO |
| Banner "PDF scaricato" nella pagina dettaglio | Rimosso | ✅ RISOLTO |
| Bottone invio manuale solo dopo download PDF | Ora visibile sempre nella bozza | ✅ RISOLTO |

### Cose aperte dopo sessione 19

1. Test manuali: salva PDF da preventivo con numero → verifica nome file "Preventivo 001/2026 - Carta Canta.pdf"
2. Test manuali: bozza → click "Registra invio manuale" → stato diventa Inviato + numero assegnato
3. Numerazione bozze separata — decisione prodotto pendente
4. Bug #8: Google OAuth intermittente
5. Bug #9: Logo PNG nel PDF — da testare con logo reale

---

## A. HANDOFF — SESSIONE 18 (22 maggio 2026)

### Cosa è stato fatto

**Fix colori e layout `DocumentTimeline`:**
- `DocumentTimeline.tsx`: evento `viewed` aveva `text-violet-700 bg-violet-100` → cambiato in `text-yellow-700 bg-yellow-100` per allinearlo al colore del `StatusBadge` "Visto"
- `preventivi/[id]/page.tsx`: aggiunto `<Separator>` + `mt-8` tra `DocumentTimeline` e `ViewHistorySection` — eliminato il collasso visivo tra le due sezioni

**Fix race condition `document_log` (eventi non comparivano subito):**
- `saveDraftAction`: la seconda query separata per leggere `document_log` è stata eliminata. Il campo viene ora incluso nel `select` iniziale e usato direttamente. Stesso fix applicato a `restoreToSentVersionAction`.
- Causa: la seconda lettura avveniva dopo un `UPDATE` nel DB e poteva restituire dati stale, causando la mancata visualizzazione dell'evento "Ripristinato" subito dopo il ripristino.

**Fix `RestoreVersionButton` scomparso dal banner "Preventivo modificato":**
- `preventivi/[id]/page.tsx`: il bottone era condizionato a `{(doc as any).sent_snapshot && <RestoreVersionButton>}`. Documenti inviati prima dell'introduzione di `sent_snapshot` (migration 033) avevano `sent_snapshot = null` → bottone nascosto.
- Fix: rimossa la condizione `sent_snapshot &&`. Il bottone ora è sempre visibile quando `updated_after_send_at` è set. La Server Action stessa gestisce il caso di snapshot assente restituendo un messaggio di errore.
- Aggiunto `space-y-2` al div interno del banner per separare visivamente testo e bottone.
- Cambiato `toLocaleDateString` → `toLocaleString` per mostrare anche l'ora nel banner.

**Fix "Nessuno snapshot disponibile per il ripristino" (legacy docs):**
- `saveDraftAction`: prima di sovrascrivere i dati di un documento `sent`/`viewed` già inviato, se `sent_snapshot` è `null`, viene creato retroattivamente uno snapshot dai campi+voci correnti.
- Lo snapshot viene scritto nella stessa update che imposta `updated_after_send_at`, prima che le voci vengano cancellate e riscritte.
- Questo garantisce che qualsiasi preventivo inviato prima di migration 033 acquisisca uno snapshot alla prima modifica — `RestoreVersionButton` funzionerà correttamente anche per questi documenti.

**Fix numero preventivo non assegnato al primo invio (da Nuovo Preventivo):**
- Causa: `createDocumentAction` creava il documento con `doc_number: null` e si aspettava che `send-email/route.ts` lo assegnasse. Se `router.refresh()` non rimontava `PreventivoForm` (React `useState` mantiene il valore iniziale `null`), il numero non compariva nell'UI.
- Fix: `createDocumentAction` ora, quando `intent === 'send'`, chiama `allocateDocNumber()` immediatamente, prima di fare l'INSERT. Il documento viene creato già con il numero assegnato. Il fallback nella route `send-email` rimane per retrocompatibilità.

**Fix lista preventivi — regressioni multiple ripristinate:**
Una sessione agente precedente aveva reintrodotto feature che erano state deliberatamente rimosse. Tutte ripristinate:
- Rimossi tab "Inviati" e "Visti" da `STATUS_TABS` — inglobati in "In attesa"
- Rimossa `ClientFilter` e la query `clientsForFilter` associata — sostituita da ricerca testuale unica
- Rimosso import di `ClientFilter`

**Fix ordinamento lista preventivi:**
- Sort default ("Più recenti") usava `doc_year DESC, doc_seq DESC, created_at DESC` → le bozze (con `doc_year`/`doc_seq` null) finivano sempre in fondo anche se appena modificate.
- Fix: sort default cambiato in `updated_at DESC` per tutti i sort che non hanno logica specifica.
- Stessa logica per `oldest`: ora `updated_at ASC`.
- `expiry`: `expires_at ASC NULLS LAST, updated_at DESC` (secondario: ultima modifica).
- Opzione rinominata "Più recenti" → "Ultima modifica".

**localStorage sort persistence:**
- `SortSelect.tsx`: completamente riscritto con `useEffect` + `usePathname`.
- Al cambio sort: salva in `localStorage` (key: `preventivi_sort_v1`). Se sort è `'recent'`, rimuove la chiave.
- Al mount: se non c'è `?sort=` nell'URL, legge `localStorage` e fa `router.replace(pathname?sort=...)` per ripristinare la preferenza salvata.

### B.3 AGGIORNATO — Numerazione documenti

> ⚠️ La regola B.3 nella sezione B è parzialmente obsoleta: il numero viene assegnato **sia al momento del primo invio** (via `send-email/route.ts`) **sia immediatamente alla creazione** se `intent === 'send'` in `createDocumentAction`. Vedi sezione B.3 per il testo aggiornato.

### Commit sessione 18

```
6495cbb  fix(timeline): yellow for viewed + storico spacing + fix document_log race condition
c7646bc  fix(preventivi): always show RestoreVersionButton in modified banner
383572c  fix(preventivi): create sent_snapshot retroactively on first edit of legacy sent docs
bc15e77  fix(preventivi): assign doc_number immediately when intent=send on create form
10ee491  fix(preventivi): remove Inviati/Visti tabs + fix sort + remove ClientFilter + localStorage
```

### File toccati (sessione 18)

```
app/(app)/preventivi/_components/DocumentTimeline.tsx     [viewed event color: violet → yellow]
app/(app)/preventivi/_components/SortSelect.tsx           [riscritto: localStorage + pathname + sort fix]
app/(app)/preventivi/[id]/page.tsx                        [Separator spacing + RestoreVersionButton unconditional + banner toLocaleString]
app/(app)/preventivi/page.tsx                             [rimosse Inviati/Visti tabs + ClientFilter + sort updated_at]
lib/actions/documents.ts                                  [saveDraftAction: retroactive snapshot + no second DB read; restoreToSentVersionAction: no second DB read; createDocumentAction: allocate number when intent=send]
CLAUDE.md                                                 [aggiornato]
```

### Bug risolti in sessione 18

| # | Bug | Stato |
|---|---|---|
| Timeline `viewed` viola invece di giallo | Fix `DocumentTimeline.tsx` colore event | ✅ RISOLTO |
| Evento "Ripristinato" non compariva subito | Eliminata seconda query DB per `document_log` | ✅ RISOLTO |
| `RestoreVersionButton` scomparso per legacy docs | Rimossa condizione `sent_snapshot &&` | ✅ RISOLTO |
| "Nessuno snapshot disponibile" su legacy docs | Snapshot creato retroattivamente alla prima modifica | ✅ RISOLTO |
| Numero non assegnato da Nuovo Preventivo + send | `createDocumentAction` chiama `allocateDocNumber` se `intent=send` | ✅ RISOLTO |
| Tab "Inviati" e "Visti" ricomparse | Rimossi da `STATUS_TABS` | ✅ RISOLTO |
| `ClientFilter` ricomparso nella toolbar | Rimosso import e JSX | ✅ RISOLTO |
| Sort "Ultima modifica" e "Scadenza vicina" non funzionavano | Sort default ora `updated_at DESC`, expiry con fallback `updated_at` | ✅ RISOLTO |
| Preferenza sort non salvata tra sessioni | `localStorage` con chiave `preventivi_sort_v1` | ✅ RISOLTO |

### Cose aperte dopo sessione 18

1. Test manuali: banner "Preventivo modificato" → bottone Ripristina → funziona per doc legacy (prima modifica crea snapshot)
2. Test manuali: nuovo preventivo → compila voci → invia direttamente → numero assegnato
3. Numerazione bozze separata — decisione prodotto pendente
4. Bug #8: Google OAuth intermittente
5. Bug #9: Logo PNG nel PDF — da testare con logo reale

---

## A. HANDOFF — SESSIONE 17 (21 maggio 2026)

### Cosa è stato fatto

**Font Google nei template PDF (fix `wrap()`):**
- `lib/pdf/template.ts`: aggiunto `GOOGLE_FONTS_URL` map e `googleFontsTag(fontName)` helper
- Tutti e 4 i `return wrap(font, ...)` ora passano `fontName` come terzo argomento
- Font coerenti su tutti i dispositivi, inclusi iOS/Android che non hanno Inter/GeistSans

**Pagina pubblica `/p/[token]` (font + UX bottoni):**
- `DocumentFrame.tsx`: accetta `src=` (URL reale) invece di `srcDoc` — risolve null-origin che bloccava Google Fonts nelle iframe
- Mobile scaling: `scale = containerWidth / 794` quando la viewport è più stretta del foglio A4
- `app/p/[token]/page.tsx`: rimossa la generazione HTML server-side, usa `<DocumentFrame src="/api/p/[token]/pdf?preview=1">` direttamente
- `ActionBar.tsx`: rimosso bottone "Scarica PDF" e icona `Download`; aggiunto un solo bottone "Visualizza preventivo" (`?preview=1` → no dialog stampa)
- `next.config.ts`: aggiunto rule `X-Frame-Options: SAMEORIGIN` per `/api/:path*/pdf` (serve per iframe embedding)
- `api/p/[token]/pdf/route.ts`: aggiunto parametro `preview` → `preparePrintHtml(html, !preview)`

**Rinomina bottone app:**
- `PdfActions.tsx`: "Salva come PDF" → "Salva o stampa il PDF"

**Fix bug "Prev Prev XXX/XXXX":**
- `lib/utils/index.ts`: `formatDocNumber()` restituisce direttamente `docNumber` (già include il prefisso); rimosso l'aggiunta manuale del prefisso

**Feature "Modificato dopo invio" (migration 033):**
- `supabase/migrations/033_updated_after_send.sql`: aggiunge `updated_after_send_at TIMESTAMPTZ` e `sent_snapshot JSONB` a `documents` — ✅ applicata manualmente
- `types/database.ts`: aggiornato con i nuovi campi
- `saveDraftAction`: imposta `updated_after_send_at = NOW()` quando il documento era già `sent`/`viewed`; ritorna `wasAlreadySent: boolean`
- `sendDocumentAction` + route `send-email`: salvano `sent_snapshot` al momento dell'invio, azzerano `updated_after_send_at`
- `restoreToSentVersionAction`: ripristina doc al `sent_snapshot` (campi + voci), azzera `updated_after_send_at`
- `ResendReminderDialog.tsx` (NUOVO): dialog "Vuoi reinviare al cliente?" → `?send=1`
- `RestoreVersionButton.tsx` (NUOVO): bottone + confirm dialog che chiama `restoreToSentVersionAction`
- `PreventivoForm.tsx`: dopo salvataggio di un doc già inviato → mostra `ResendReminderDialog`
- `preventivi/[id]/page.tsx`: banner ambra "Preventivo modificato — non ancora reinviato" + `RestoreVersionButton`
- `preventivi/page.tsx`: badge "Modificato" ambra su righe con `updated_after_send_at` non null
- `DocumentTimeline.tsx`: evento "Preventivo aggiornato" con icona Edit e colore ambra
- `PendingDocCard.tsx` + `dashboard/page.tsx`: indicatore "Modificato — cliente non aggiornato"

**Fix email senza allegato PDF:**
- Route `send-email`: rimosso `generatePdfBuffer`, `pdfBuffer`, `fileSlug`, `attachments`; l'email invia solo il link pubblico tramite `buildPdfHtml`/`/p/[token]`

**Fix TypeScript (lavoro agente precedente):**
- `PdfActions` in `preventivi/[id]/page.tsx`: ripristinati i props corretti (`documentId` + `docNumberSlug`)
- `restoreDocumentAction`: aggiunto `numberConflict?: boolean` al tipo di ritorno
- `linkDocumentAction` (NUOVO): collega/scollega manualmente una fattura a un preventivo via `origin_document_id`

### Migration 033 — applicata ✅

```sql
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS updated_after_send_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_snapshot JSONB;
```

### Commit sessione 17

```
6c1e287  feat(preventivi): track modifications after send + fix send-email route
bded5f4  fix(utils): formatDocNumber was prepending prefix to already-prefixed doc_number
a32f75c  fix(ux): rename 'Salva come PDF' to 'Salva o stampa il PDF'
3fb9834  fix(public-pdf): respect ?preview=1 to skip print dialog
e67d3b0  fix(public): remove Scarica PDF button + use iframe src= for Google Fonts
[altri commit sessione 17 precedenti alla compressione del contesto]
```

### File toccati (sessione 17)

```
lib/pdf/template.ts                                        [Google Fonts fix in wrap()]
lib/pdf/logo.ts                                            [preparePrintHtml()]
lib/utils/index.ts                                         [formatDocNumber fix]
lib/actions/documents.ts                                   [saveDraftAction, restoreToSentVersionAction, linkDocumentAction]
app/api/documents/[id]/send-email/route.ts                 [rimosso PDF attachment, aggiunto sent_snapshot]
app/api/documents/[id]/pdf/route.ts                        [restituisce HTML con print script]
app/api/p/[token]/pdf/route.ts                             [preview param, restituisce HTML]
app/(app)/preventivi/_components/PdfActions.tsx            [label + props fix]
app/(app)/preventivi/_components/PreventivoForm.tsx        [ResendReminderDialog dopo salvataggio]
app/(app)/preventivi/_components/ResendReminderDialog.tsx  [NUOVO]
app/(app)/preventivi/_components/RestoreVersionButton.tsx  [NUOVO]
app/(app)/preventivi/_components/DocumentTimeline.tsx      [evento "aggiornato"]
app/(app)/preventivi/[id]/page.tsx                         [banner + RestoreVersionButton + PdfActions fix]
app/(app)/preventivi/page.tsx                              [badge "Modificato"]
app/(app)/dashboard/page.tsx                               [updated_after_send_at in query]
app/(app)/dashboard/_components/PendingDocCard.tsx         [indicatore "Modificato"]
app/p/[token]/page.tsx                                     [DocumentFrame src= invece di srcDoc]
app/p/[token]/_components/ActionBar.tsx                    [rimosso "Scarica PDF"]
components/public/DocumentFrame.tsx                        [mobile scaling + src= support]
next.config.ts                                             [X-Frame-Options SAMEORIGIN per /pdf routes]
supabase/migrations/033_updated_after_send.sql             [NUOVO — applicata]
types/database.ts                                          [updated_after_send_at + sent_snapshot]
tests/unit/pdf/generate.test.ts                            [mock aggiornato]
CLAUDE.md                                                  [aggiornato]
```

### Bug risolti in sessione 17

| # | Bug | Stato |
|---|---|---|
| Font diverso nel link cliente vs app | `src=` URL invece di `srcDoc` → Google Fonts caricano | ✅ RISOLTO |
| "Scarica PDF" visibile nel link cliente | Rimosso `ActionBar.tsx` | ✅ RISOLTO |
| "Connessione negata" nell'iframe | `X-Frame-Options: SAMEORIGIN` per route PDF | ✅ RISOLTO |
| `?preview=1` apriva comunque dialog stampa | `preparePrintHtml(html, !preview)` | ✅ RISOLTO |
| "Prev Prev001/2026" doppio prefisso | `formatDocNumber` restituisce docNumber as-is | ✅ RISOLTO |

### Test manuali consigliati

| Check | Come |
|---|---|
| Font coerente link vs app | Apri un preventivo inviato → link cliente → font deve essere identico al template nell'app |
| "Modificato" badge | Modifica un preventivo inviato → salva bozza → deve apparire badge ambra nella lista |
| Dialog reinvio | Salva bozza su preventivo inviato → deve uscire dialog "Vuoi reinviare?" |
| Ripristina versione | Dal dettaglio preventivo modificato → bottone "Ripristina" → riporta ai dati dell'ultimo invio |
| Banner ambra | Preventivo modificato non reinviato → pagina dettaglio → banner ambra visibile |
| Email senza allegato PDF | Invia preventivo → email ricevuta NON deve avere PDF allegato |

### Cose aperte dopo sessione 17

1. Test manuali nella tabella sopra
2. Numerazione bozze separata — decisione prodotto pendente
3. Bug #8: Google OAuth intermittente
4. Bug #9: Logo PNG nel PDF — da testare con logo reale

---

## A-16. HANDOFF — SESSIONE 16 (21 maggio 2026)

### Stato attuale

Sessione 16 ha risolto definitivamente la generazione PDF rotta post-sessione 15. Il PDF server-side con Chromium headless non funziona su Vercel Lambda (nessuna versione di `@sparticuz/chromium` funziona — manca `libnss3` nell'ambiente serverless). La soluzione adottata è **browser print** via HTML: i route PDF ora restituiscono l'HTML di `buildPdfHtml()` con script di stampa iniettato. Template sempre coerente, zero costi extra.

### Architettura PDF definitiva (post-sessione 16)

```
buildPdfHtml(data) → HTML
  → /api/documents/[id]/pdf?preview=1  → mostra documento senza dialog stampa
  → /api/documents/[id]/pdf            → mostra documento + window.print() automatico
  → /api/p/[token]/pdf                 → idem (pagina pubblica)
  → send-email/route.ts → generatePdfBuffer() → @react-pdf/renderer → allegato email
```

**`@sparticuz/chromium` e `puppeteer-core` sono ancora in package.json ma NON vengono usati.** Possono essere rimossi in un future cleanup.

**Salva come PDF:** utente clicca → nuova tab → document HTML con dialogo di stampa Chrome → "Salva come PDF" → un click → PDF salvato. Identico al template.

**Perché non un download diretto:** richiederebbe server-side PDF generation (impossibile su Vercel Lambda) o servizio esterno a pagamento. Decisione confermata: soluzione attuale è il compromesso ottimale qualità/costo.

### Bug #6 stato aggiornato

| # | Bug | Stato |
|---|---|---|
| 6 | **PDF preview/download** | ✅ RISOLTO (sessione 16) — browser print, template identico |

### File toccati (sessione 16)

```
lib/pdf/generate.ts                            [riscritto più volte — finale: @react-pdf/renderer per email]
lib/pdf/logo.ts                                [aggiunto preparePrintHtml()]
app/api/documents/[id]/pdf/route.ts            [riscritto — restituisce HTML con print script]
app/api/p/[token]/pdf/route.ts                 [riscritto — restituisce HTML con print script]
app/(app)/preventivi/_components/PdfActions.tsx [aggiornato — ?preview=1 vs default]
next.config.ts                                 [serverExternalPackages aggiornato]
package.json                                   [puppeteer-core aggiunto, @sparticuz/chromium downgradato a v119, engines.node >=20]
.nvmrc                                         [aggiunto: 20]
CLAUDE.md                                      [aggiornato]
```

### Commit sessione 16

```
c7c7841  fix(pdf): detect environment for Chrome launch
3748bc2  fix(pdf): switch playwright-core → puppeteer-core
5b51110  fix(pdf): add puppeteer-core to serverExternalPackages
272ed5e  fix(pdf): require Node 20 for @sparticuz/chromium v131
bd24f9e  fix(pdf): downgrade @sparticuz/chromium to v119
6767ba8  fix(pdf): revert to @react-pdf/renderer (email only)
69089c2  feat(pdf): replace server-side PDF with browser print
d358851  fix(pdf): force background colors + differentiate preview vs save
```

---

## A-15. HANDOFF — SESSIONE 15 (21 maggio 2026)

### Stato attuale

Questa sessione ha completato l'architettura "fonte unica di verità" per i template: `buildPdfHtml()` in `lib/pdf/template.ts` ora è l'unico sistema che genera il layout di documenti su tutte e 4 le superfici. Vedi sezione H.

La sessione precedente (14, 20 maggio) aveva risolto la discordanza template a livello di snapshot/dati. Ora la discordanza è risolta anche a livello di RENDERING: tutte le superfici chiamano la stessa funzione.

### Migration pendenti

Nessuna. Tutte le migration 001–032 risultano applicate.

### Migration da applicare

**Tutte le migration 001–031 risultano applicate** (029: `last_reminder_at`, 030: `deleted_at`/soft-delete, 031: `next_invoice_number` SECURITY DEFINER+GREATEST — applicate manualmente il 20 maggio 2026). Non ci sono migration pendenti.

### Bug aperti — stato onesto dopo sessione 14

| # | Bug | Stato | Note |
|---|---|---|---|
| 1 | **Email finiscono nello spam** | ⚠️ PARZIALE | Fix codice: plain-text aggiunto, emoji rimosso. DNS non verificato. Richiede test manuale. |
| 2 | **Verifica email → reindirizza a login** | 🟡 FIX APPLICATO — da verificare | `proxy.ts`: `/verifica-email` aggiunto a `PUBLIC_PATHS`. Non testato in browser. |
| 3 | **Rate limit scatta su login riusciti** | 🟡 FIX APPLICATO — da verificare | `loginAction`: rate limit ora conta solo fallimenti. Non testato con login reali. |
| 4 | **Numero preventivo non assegnato all'invio** | ✅ CHIUSO | Causa: doppio overload `next_invoice_number(INT)` vs `(SMALLINT)`. Fix: migration 032. Verificato in browser. |
| 5 | **Numerazione non incrementa (sempre 001/2026)** | 🟡 FIX APPLICATO — da verificare | `peekNextDocNumber/InvoiceNumber`: `seq_type` → `doc_type`. Non testato con sequenza reale. |
| 6 | **PDF preview/download non funzionano** | 🟡 FIX APPLICATO — da verificare | `PdfActions`: ora server-side links (`/api/documents/[id]/pdf`). Non testato in browser. |
| 7 | **Mobile — IVA invisibile** | 🟡 FIX APPLICATO — da verificare | `VociTable`: rimosso `hidden sm:block`, `grid-cols-5` fisso, label corrette. Da verificare su device reale. |
| 8 | **Google OAuth → a volte chiede credenziali di nuovo** | ❌ APERTO | Intermittente. OAuth bfcache fix applicato in sessione 12 (225c949). Non confermato risolto. |
| 9 | **Logo PNG non visibile nel PDF** | ❌ APERTO | `fetchLogoBase64` implementato ma non testato con logo reale nei 4 preset. |
| 10 | **Warning "già inviato" su bozza vergine** | ✅ CHIUSO | Fix (`e603a48`): `handleSend()` ora naviga a `?send=1` senza chiamare `sendDocumentAction` prima. |
| 11 | **Template PDF/anteprima/link cliente discordanti** | ✅ CHIUSO (sessioni 14–15) | Dati: sezione G. Rendering: sezione H. |

### Email deliverability — cosa resta da fare fuori dal codice

1. Resend Dashboard → Domains → verifica **Status: Verified** per `send.cartacanta.app`
2. Verifica record SPF su `send.cartacanta.app` (deve includere Resend)
3. Bounce/complaint rate in Resend dashboard: < 5% / < 0.1%
4. Test diretto: invia preventivo a Gmail → verifica inbox (non spam)

### Da verificare manualmente prima del prossimo task

| Check | Come |
|---|---|
| Bug #2: link verifica email | Signup nuovo account → clicca "Vai alla pagina di verifica" → deve aprire /verifica-email |
| Bug #3: rate limit | 3 login riusciti consecutivi → nessun blocco |
| Bug #4: numero assegnato | Crea bozza senza numero → invia → doc_number nel DB deve essere Prev001/2026 |
| Bug #5: numerazione | Crea 3 preventivi → numeri devono essere Prev001, Prev002, Prev003 |
| Bug #6: PDF | Apri preventivo inviato → clicca Anteprima PDF → PDF si apre in nuova scheda |
| Bug #7: mobile IVA | Apri preventivo su telefono → IVA visibile nella griglia voci |

### Decisioni di prodotto pendenti — NON implementare senza conferma

| Decisione | Proposta | Stato |
|---|---|---|
| **Numerazione bozze** | "Bozza 001" senza anno finché non inviato, poi "Prev001/2026" al primo invio | ⏳ Attende conferma |
| **TASK 13 — Template preview consistency** | ✅ CHIUSO (sessione 14) — la discordanza tra preset scelto e PDF/link cliente è stata risolta. Se il task intendeva altro, specificare. |

---

## B. REGOLE DI COMPORTAMENTO

### B.1 Regole TypeScript / codice

1. MAI `any` senza commento ESLint esplicito
2. MAI chiavi API nel client — tutto passa da Server Actions o API Routes
3. MAI skipare i test sui calcoli fiscali — coverage 100% obbligatoria su `lib/fiscal/`
4. Commit atomici con conventional commits: `feat/fix/chore/docs/test`
5. Ogni modifica: `npx tsc --noEmit` + `npm run build` devono essere verdi prima del commit
6. `types/database.ts` va rigenerato dopo ogni migration (`npx supabase gen types typescript --project-id ivbzuhgwszkdnlsybsao > types/database.ts`). Non editare manualmente salvo aggiunta urgente documentata.

### B.2 Regole UX/UI permanenti

- **Mobile-first è non negoziabile.** Ogni funzionalità deve funzionare perfettamente su telefono prima che su desktop.
- `ClientAutocomplete`, `AtecoMultiSelect`, `CatalogPicker`: usano `<PopoverContent>` Radix (portal su `document.body`) — NON rimuovere, evita clipping da `Card overflow-hidden`.
- Dropdown bot `KanbanView` e `ViewToggle` sono stati rimossi definitivamente (session 12). Non re-aggiungere.
- `StatusBadge` con prop `docType` per distinguere fatture da preventivi (accepted→"Pagata", rejected→"Annullata").
- IVA visibile su mobile per regime ordinario (grid-cols-5 nel VociTable mobile).
- `safeAccentColor` obbligatorio in `TemplatePreview.tsx` e `template.ts` per evitare testo chiaro su sfondo bianco.
- **Ordinamento lista preventivi (aggiornato sessione 26):** default = **`oldest` ("Meno recenti", `updated_at ASC`)** — NON più `recent`. La preferenza utente è in **sessionStorage** (chiave `preventivi_sort_v2`), vale solo per la sessione. Questo elimina il "flip" all'apertura della pagina (prima il default server `recent` + localStorage `oldest` causava un `router.replace` visibile). NB: supera le note della sessione 18 che descrivevano localStorage + default `recent`.

### B.3 Regole numerazione documenti

**⚠️ AGGIORNATO sessione 25: NON ci sono più prefissi Prev/Fatt.**
I numeri sono nel formato `{NNN}/{YYYY}` (es. `001/2026`) per **entrambi** preventivi e fatture.
In `lib/actions/documents.ts`:
- `allocateDocNumber()` → `{NNN}/{YYYY}` (es. "001/2026") — sequenza `doc_type = 'preventivo'`
- `allocateInvoiceNumber()` → `{NNN}/{YYYY}` (es. "001/2026") — sequenza `doc_type = 'fattura'`
- `peekNextDocNumber()` / `peekNextInvoiceNumber()` → preview (usano colonna `doc_type` su `invoice_sequences`, NON `seq_type`)
- `formatDocNumber()` in `lib/utils/index.ts` rimuove eventuali prefissi letterali legacy (`replace(/^[A-Za-z]+/, '')`) per i documenti vecchi che avevano "Prev"/"Fatt".

**Differenziazione fattura (sessione 25):** il numero salvato nel DB è identico per entrambi
("001/2026"), MA in **visualizzazione in-app** `formatDocNumber(num, 'fattura')` antepone il
marcatore **"Fatt."** → le fatture appaiono come **"Fatt. 001/2026"**, i preventivi come "001/2026".
Questo evita confusione senza migration. Email e PDF usano il numero grezzo (il PDF ha già la
testata "FATTURA"/"PREVENTIVO"). I punti che mostrano una fattura collegata DENTRO un testo già
prefissato (es. "Fattura {numero}") NON passano 'fattura' per evitare "Fattura Fatt. ..." ridondante.

**Non c'è più una card "Numerazione documenti" in impostazioni** (rimossa in session 13 — 3d671d3). Il formato non è configurabile dall'utente.

**⚠️ AGGIORNATO sessione 26 — il numero viene assegnato SUBITO alla creazione (anche per le bozze).**
`createDocumentAction` chiama `allocateDocNumber()` prima dell'INSERT per OGNI nuovo documento
(sia "Salva bozza" sia "Invia al cliente"), a meno che non sia stato passato un numero manuale valido.
Quindi **una bozza ha già un `doc_number` dal momento della creazione** (non più `null`).
Motivo: l'utente vuole vedere il numero progressivo subito.
Conseguenza nota: le bozze cancellate lasciano "buchi" nella sequenza (la RPC non li riempie). Accettato.

**`intent` nel form:** valori usati = `'save_draft'` | `'send'` (preventivo), `'save'` | `'send'` (FatturaForm),
`'create'` (preventivo→fattura). Nello schema Zod `DocumentFormSchema.intent` è `z.string().optional()`
(NON un enum ristretto: un enum `['save','send']` rompeva il salvataggio bozza con
"Invalid option: expected one of save|send"). Ogni action interpreta i valori che le servono.

**`send-email/route.ts`** mantiene il fallback: se per qualche motivo `doc_number` è ancora null al primo invio, lo assegna lì.

**La RPC usa INSERT ... ON CONFLICT DO UPDATE incrementando `last_number`** — non riempie i buchi. Se l'ultimo allocato è 5, il prossimo è 6 anche se 3 e 4 sono stati cancellati.

### B.4 Regole preventivi / fatture / collegamenti

**Soft delete:** i documenti vengono spostati nel cestino (`deleted_at = now()`), non cancellati. Il cestino è a `/cestino`, recupero entro 15 giorni, poi purge automatico via cron. Tutte le query lista **devono filtrare `deleted_at IS NULL`** — se aggiungi una query sui documenti, controlla.

**Preventivo accettato — re-edit:** un preventivo `accepted` può essere ri-editato (saveDraftAction lo resetta a `draft`) **a meno che non abbia una fattura collegata con status accepted**. In quel caso è locked.

**Preventivo → fattura:** 
- Entry point 1: dal dettaglio preventivo accettato → "Converti in fattura"
- Entry point 2: `/fatture/nuovo` → `CreateFromPreventivoButton` — mostra tutti i preventivi non-bozza/non-scaduti con status badge; se non-accepted, chiede conferma prima di convertire
- La funzione `convert_preventivo_to_fattura` SQL è idempotente: se la fattura esiste già la restituisce
- Collegamento bidirezionale: la fattura ha `origin_document_id`; sul dettaglio fattura c'è `LinkToPreventivoButton` per agganciare/sganciare manualmente

**Fattura → preventivo:** su `/fatture/[id]` c'è il banner collegato o il pulsante "Collega a preventivo" se `origin_document_id = null`.

**DocumentTimeline:** presente su tutti i preventivi (bozze incluse). Mostra eventi created/sent/viewed/accepted/rejected/expired + eventuale "Fattura collegata". Non c'è una colonna `rejection_at` — usa `sent_at` come fallback per l'evento Rifiutato.

### B.5 Regole autenticazione / rate limiting

**Login rate limit** (post-fix sessione 13): il rate limit viene chiamato SOLO su autenticazione fallita. I login riusciti non consumano token. Limite: 10 fallimenti / 15 min per IP. Key: `auth:login-fail:{ip}`.

**Verifica email:** `/verifica-email` è in `PUBLIC_PATHS` del proxy. Gli utenti non autenticati (appena registrati con email non confermata) possono accedere a questa pagina senza essere rimandati al login.

**OAuth bfcache:** `OAuthButtons.tsx` ha listener `pageshow` che resetta lo stato loading quando `e.persisted === true` (tornare dalla pagina Google su mobile).

### B.6 Regole email / deliverability

**`sendEmail`** in `lib/email/send.ts` invia sia HTML che plain-text (generato automaticamente strippando i tag HTML). NON aggiungere emoji nei subject o nel body — peggiorano lo spam score.

**FROM:** `Carta Canta <noreply@send.cartacanta.app>` — non modificare il dominio mittente senza aggiornare anche DKIM/SPF.

**replyTo:** le email di invio preventivo al cliente usano l'email dell'owner come `reply_to` — se il cliente risponde, arriva all'artigiano.

### B.7 Regola migration — COME COMUNICARLE ALL'UTENTE

**OGNI VOLTA che il codice richiede una nuova migration SQL, incollare il testo della migration in fondo al messaggio inviato all'utente**, in un blocco SQL ben visibile con titolo "⚠️ Migration da applicare". L'utente la copia direttamente su Supabase SQL Editor.

Formato obbligatorio da usare alla fine del messaggio:

```
---
### ⚠️ Migration da applicare su Supabase SQL Editor

\```sql
-- testo della migration qui
\```
```

**Non inviare il messaggio senza questo blocco se c'è una migration.** L'utente non deve cercarla nel codice.

### B.8 Regole PDF — ARCHITETTURA POST-SESSIONE 16 (aggiornata sessione 23)

**`buildPdfHtml()` in `lib/pdf/template.ts` è LA FONTE UNICA DI VERITÀ.**
Tutte le superfici visive usano questa funzione. Non creare layout alternativi.

**Watermark (sessione 23):** Il watermark diagonale "Carta Canta" è stato RIMOSSO per tutti i piani.
Rimane solo il footer `"Preventivo generato con Carta Canta · cartacanta.app"` (10px, visibile solo se `showWatermark=true` = Free).
Pro può disabilitare anche il footer impostando `show_watermark=false`.

**Font size (sessione 23):** tutti i font size in `lib/pdf/template.ts` sono stati scalati ×1.2 (es. 11px→13px, 14px→17px, 26px→31px).
Anche `TemplatePreview.tsx` è stato allineato con le stesse proporzioni.

**Email non allega PDF:** Il documento viene inviato come LINK pubblico (`/p/[token]`). Nessun allegato PDF.
Il testo default del messaggio email è "Le faccio avere il link a ${ref} come da nostra intesa."

**⚠️ Chromium headless NON funziona su Vercel Lambda** — nessuna versione di `@sparticuz/chromium` funziona (manca `libnss3` nel runtime serverless). Non tentare di reintrodurlo senza un piano alternativo (microservizio separato su Render/Railway).

**Architettura definitiva:**

```
buildPdfHtml(data: PdfDocumentData) → HTML string
  → /api/documents/[id]/pdf?preview=1  → tab solo visualizzazione (no stampa)
  → /api/documents/[id]/pdf            → tab con window.print() automatico → utente salva come PDF
  → /api/p/[token]/pdf                 → idem (pagina pubblica cliente)
  → lib/pdf/generate.ts → generatePdfBuffer() → @react-pdf/renderer → Buffer
      → /api/documents/[id]/send-email  (allegato email — visivamente diverso ma funzionale)

buildPdfHtml(data) → HTML string
  → app/p/[token]/page.tsx → <DocumentFrame html={html} />  → <iframe srcDoc> 
  → app/(app)/preventivi/[id]/page.tsx → <DocumentFrame> (anteprima in-app)
```

**`preparePrintHtml(html, triggerPrint)`** in `lib/pdf/logo.ts`:
- Inietta `@media print { print-color-adjust: exact }` — forzare colori/sfondi senza che l'utente spunti "Grafica in background"
- Se `triggerPrint=true`: inietta `window.onload=()=>window.print()`

**PdfActions** (`app/(app)/preventivi/_components/PdfActions.tsx`):
- "Anteprima": `/api/documents/[id]/pdf?preview=1` → solo visualizzazione
- "Salva come PDF": `/api/documents/[id]/pdf` → apre dialogo stampa automaticamente

**Logo:** `fetchLogoBase64()` in `lib/pdf/logo.ts` — URL → data-URI base64 (timeout 5s).

**`template_snapshot`** congela il template al momento dell'invio.
- `saveDraftAction` salva lo snapshot se viene cambiato `template_id`
- `send-email/route.ts` sovrascrive sempre lo snapshot al primo invio

**Fallback chain per il template** (identica in tutti i route e pagine):
1. `doc.template_snapshot` (congelato all'invio)
2. Template default del workspace (`is_default = true`)
3. Qualsiasi template del workspace (`limit 1`)
4. `null` → `buildPdfHtml()` usa stili hardcoded di default

**Performance:** `maxDuration = 60` sulle route PDF (Vercel Pro). Chromium startup ~5-15s. Cold start può richiedere fino a 20s al primo invio.

**`PreventivoPDF.tsx`** — NON più in uso nella chain di produzione. Candidato alla rimozione.

---

## C. FORMATO RISPOSTA OBBLIGATORIO PER OGNI TASK

Quando chiudi (o aggiorni) un task, la risposta **deve** contenere:

```
1. Bug/problema trovato
   - Causa reale confermata (dove nel codice, quale riga)

2. Fix implementato
   - Cosa esattamente è cambiato

3. File toccati
   - Lista con motivo della modifica

4. Migration necessarie
   - Sì / No — se sì, specifica SQL e se applicata

5. Test eseguiti
   - Cosa è stato verificato e COME (codice tracciato / browser reale / nessun test)

6. Esito finale
   - ✅ CHIUSO — verificato end-to-end nel browser
   - ⚠️ PARZIALE — fix codice ok, ma parte del fix richiede azione esterna o test non ancora fatto
   - 🟡 FIX APPLICATO — codice corretto per logica, da verificare manualmente
   - ❌ APERTO — causa identificata ma fix non ancora implementato
```

**Regola assoluta:** non scrivere "✅ CHIUSO" se non è stato verificato end-to-end nel browser reale o in un test automatico che riproduce il flusso.

---

## D. STATO PROGETTO — FEATURE COMPLETE (aggiornato sessione 23)

| Area | Stato | Note |
|---|---|---|
| Auth (email + OAuth) | ✅ Stabile | bfcache fix; rate limit fallimenti; reset password via /auth/confirm |
| Onboarding multi-step | ✅ Stabile | |
| Password sicura | ✅ Implementato | `PasswordStrength.tsx` — 4 requisiti validati client+server |
| Rinvia email verifica | ✅ Implementato | `/verifica-email` ha form resend via `supabase.auth.resend()` |
| Preventivi CRUD | ✅ Stabile | soft delete, re-edit, timeline, scadenze, Modificato banner |
| Fatture CRUD | ✅ Stabile | doppio entry point, Invia al cliente, timeline, Modificato banner |
| Clienti rubrica | ✅ Stabile | email/telefono obbligatori, full-text search, CF dedup |
| Catalogo CRUD | ✅ Stabile | |
| Template PDF — 4 preset | ✅ Stabile | font +20%, watermark diagonale rimosso, footer solo Free |
| Template — personalizzazioni Pro | ✅ Stabile | logo, font, legal notice |
| DocumentTimeline | ✅ Stabile | preventivi + fatture; eventi: sent/resent/modified/restored/accepted/rejected |
| Piano Free — quota storica | ✅ Stabile | `FREE_DOC_LIMIT = 8` |
| Soft delete + cestino | ✅ Stabile | `/cestino`, 15gg, cron purge |
| Dashboard KPI | ✅ Stabile | 4 card (accettati, valore prev, valore fatt, bozze); KPI fatturato → `/fatture?q=Pagata`; Prossima Scadenza → expires_at ASC |
| RevenueChart | ✅ Stabile | dual-bar accettati + fatturato |
| Referral system | ✅ Stabile | Team rimosso dall'UI referral |
| Piano Team | ⏸️ Nascosto | Card nascosta da abbonamento + referral fino al lancio |
| Stripe webhook | ✅ Stabile | |
| Voice input | ✅ Implementato | AssemblyAI SDK v4 |
| Export CSV preventivi | ✅ Implementato | |
| Cron scadenze + reminder | ✅ Stabile | |
| AI import | ⏸️ Disabilitato via flag | Bottone "IN ARRIVO" (flag `NEXT_PUBLIC_AI_IMPORT_ENABLED`). Per attivare: flag=true + chiavi OpenAI/Mistral |
| PostHog / Flagsmith / Sentry | ⏸️ Non configurati | |

---

## E. DECISIONI DI PRODOTTO CONFERMATE

| Decisione | Stato |
|---|---|
| Piano Team nascosto | ✅ Sessione 23 — nascosto da abbonamento + referral fino al lancio |
| Piano Team ⊇ Piano Pro | ✅ Confermato — nella logica interna Team include Pro |
| Limite Free: 8 preventivi storici (sent_quota_used) | ✅ Confermato — `FREE_DOC_LIMIT = 8` |
| Consumo Free: conta al primo invio | ✅ Implementato — non si decrementa alla cancellazione |
| Soft delete + cestino 15gg | ✅ Implementato |
| Numerazione: formato {NNN}/{YYYY} senza prefissi (no Prev/Fatt) | ✅ Confermato sessione 25 |
| Watermark diagonale rimosso | ✅ Sessione 23 — rimosso per tutti; solo footer Free |
| Font PDF +20% | ✅ Sessione 23 — confermato definitivo |
| `expires_at` riparte SOLO al (re)invio | ✅ Sessione 23 — salvataggio manuale non cambia scadenza |
| Email/telefono obbligatori per ogni cliente | ✅ Sessione 23 — bloccante in tutti i form creazione |
| Password: 4 requisiti obbligatori | ✅ Sessione 23 — maiuscola, minuscola, numero, simbolo |
| Email invio: link (no PDF allegato) | ✅ Confermato — testo default aggiornato |
| Template Free: preset non resetta colore | ✅ Confermato |
| Template Elegante: doc number NO brand color | ✅ Confermato — usa `safeAccentColor` |
| Preventivo accepted re-editabile se no fattura | ✅ Implementato |
| Kanban view rimosso | ✅ Definitivamente rimosso |
| AI import: attivare dopo test Pro | ✅ Confermato — key mancanti in prod |

---

## F. COSA NON TOCCARE SENZA SCREENSHOT/TEST

| Area | Motivo | Regola |
|---|---|---|
| `lib/fiscal/calcoli.ts` | Motore fiscale — 100% test coverage | Non toccare senza test. Nessuna eccezione. |
| `lib/pdf/template.ts` | 4 layout PDF su design di riferimento | Non modificare senza screenshot aggiornati |
| `TemplatePreview.tsx` | 4 layout React distinti, safeAccentColor | Non modificare senza screenshot |
| Stripe webhook handler | Funziona in produzione | Testare sempre in Stripe test mode prima |
| `template_snapshot` formato | I PDF vecchi usano snapshot congelato | Non cambiare formato senza considerare retrocompatibilità |

---

## G. SESSIONE 14 — 20 MAGGIO 2026 — RIEPILOGO

### Problema segnalato

L'utente aveva impostato un template personalizzato, ma il PDF scaricato, l'anteprima e la pagina pubblica `/p/[token]` mostravano tutti template diversi tra loro e diversi da quello scelto.

### Cause radice identificate (3 bug distinti in cascata)

**Bug 1 — `PreventivoPDF.tsx` aveva un solo layout hardcoded**

`PreventivoPDF.tsx` non usava `preset_key` — la funzione `makeStyles()` non esisteva e il layout era unico (assomigliava al Bold) per tutti e 4 i preset. Il template selezionato era irrilevante.

Fix: riscrittura di `PreventivoPDF.tsx` con `makeStyles(primary, preset)` che differenzia:
- Font: Elegante → Times-Roman/Bold/Italic; tutti gli altri → Helvetica (font built-in, nessun download)
- Header: Bold → `backgroundColor: primary`; Tecnico → bordo inferiore 3px; Classico/Elegante → linea sottile
- Table header: Elegante → no fill + bordo grigio; Bold → tint 18% + testo colorato; Classico/Tecnico → fill pieno + testo bianco
- Footer: Bold → sfondo tinto; altri → grigio chiaro con border-top

**Bug 2 — `mapToPdfData` in `generate.ts` scartava `preset_key` e `font_family`**

La funzione di mapping non passava `preset_key` né `font_family` al componente `PreventivoPDF`. Anche dopo il fix al componente, il preset sarebbe rimasto ignoto.

Fix: aggiunto passaggio esplicito in `mapToPdfData`:
```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
preset_key:  (template as Record<string, unknown>).preset_key  as string | null ?? null,
font_family: (template as Record<string, unknown>).font_family as string | null ?? null,
```
(Cast `any` necessario perché Supabase `Json` non accetta `Record<string, unknown>`)

**Bug 3 — `saveDraftAction` non salvava mai i cambiamenti di template**

`saveDraftAction` parsava `template_id` dal form ma non lo scriveva mai nel DB (né nel documento, né in `template_snapshot`). Ogni cambio di template su una bozza veniva silenziosamente ignorato.

Fix: `saveDraftAction` ora:
1. Se `template_id` è presente nel form → fetch del template da Supabase
2. Salva `template_snapshot` sul documento
3. Azzera `pdf_url = null` per invalidare la cache

**Bug 4 — Pagina pubblica `/p/[token]` senza fallback template**

La pagina pubblica leggeva solo `doc.template_snapshot` e usava colori hardcoded se null. Per i documenti inviati prima dei fix, lo snapshot era null → la pagina mostrava preset di default.

Fix: implementata fallback chain a 4 livelli (snapshot → default workspace → qualsiasi template workspace → nessuno).

**Bug 5 (strutturale) — Layout card HTML diverso dal PDF**

Anche con il template corretto, la pagina pubblica aveva struttura visiva diversa dal PDF: date nel header invece che nella sezione info, colonna UM mancante, doc type label in maiuscolo/minuscolo diverso.

Fix: ristrutturata la card in `/p/[token]/page.tsx`:
- Header: logo+azienda a sinistra | tipo documento+numero a destra (date spostate)
- Bold: header card con `backgroundColor: colorPrimary`
- Tecnico: bordo sinistro 3px brand color
- Sezione 2 colonne: DESTINATARIO (sinistra) + DATA EMISSIONE+date (destra)
- Table header: rispetta il preset (Elegante → no fill; Bold → tint; Classico/Tecnico → fill pieno)
- Colonna UM aggiunta (`hidden sm:table-cell`)
- Doc type label: uppercase per tutti tranne Elegante (italic)

### File toccati (sessione 14)

```
components/pdf/PreventivoPDF.tsx        [RISCRITTURA PARZIALE — makeStyles() + 4 preset]
lib/pdf/generate.ts                     [mapToPdfData: aggiunto preset_key + font_family]
lib/actions/documents.ts                [saveDraftAction: salva template_snapshot + azzera pdf_url]
app/api/documents/[id]/send-email/route.ts  [sempre sovrascrive template_snapshot al primo invio]
app/p/[token]/page.tsx                  [fallback chain template + ristrutturazione card layout]
```

### Commit sessione 14

```
19188ae  fix(pdf): implement 4-preset rendering in PreventivoPDF + pass preset_key in mapToPdfData
24d5d3e  fix(draft): saveDraftAction now saves template_snapshot and invalidates pdf_url
fda7cbb  fix(public): 4-level template fallback chain in /p/[token]
9ebd1ef  fix(public): restructure /p/[token] card layout to match PDF structure
```

### Note tecniche importanti emerse

- `lib/pdf/template.ts` è **codice morto** — l'approccio Playwright/HTML non è mai usato. Il PDF reale è generato da `@react-pdf/renderer` via `PreventivoPDF.tsx`.
- I font di `@react-pdf/renderer` devono essere **built-in** (Helvetica, Times-Roman, Courier) o registrati esplicitamente con `Font.register()`. Non si possono usare font Google/system senza download.
- Supabase `Json` type non è assegnabile da `Record<string, unknown>` — serve cast `as any` con commento ESLint `// eslint-disable-next-line @typescript-eslint/no-explicit-any`.
- Il campo `PdfData.template` deve avere `preset_key?: string | null` e `font_family?: string | null` — aggiornare l'interfaccia se si aggiungono altri campi al template.

### Cose aperte dopo sessione 14

1. Test manuale: verificare PDF generato (session 14 fix) — ora sostituito dalla sessione 15 che usa playwright
2. Bug #5 numerazione (sempre 001/2026) — da verificare con sequenza reale
3. Bug #6 PDF preview/download — da verificare in browser
4. Bug #7 mobile IVA — da verificare su device reale
5. Logo PNG nel PDF — ora gestito da `fetchLogoBase64()` in `lib/pdf/logo.ts`; testare con logo reale

---

## H. SESSIONE 15 — 21 MAGGIO 2026 — RIEPILOGO

### Problema segnalato

Discordanza visiva tra le 4 superfici di rendering. La sessione 14 aveva allineato i DATI (snapshot, preset_key), ma non il RENDERING: ogni superficie aveva il proprio codice di layout separato e poteva divergere a qualsiasi modifica futura.

### Soluzione implementata: `buildPdfHtml()` come fonte unica di verità

La funzione `buildPdfHtml()` in `lib/pdf/template.ts` genera HTML completo (4 preset, watermark, logo, note legali, tutti gli stili inline). Tutte e 4 le superfici ora la usano:

| Superficie | Prima | Dopo |
|---|---|---|
| PDF scaricabile (e anteprima) | `@react-pdf/renderer` + `PreventivoPDF.tsx` (layout parallelo) | `playwright-core` + `@sparticuz/chromium` → `buildPdfHtml()` HTML → PDF |
| PDF allegato email | stessa chain di sopra | auto-corretto (chiama `generatePdfBuffer`) |
| Pagina pubblica `/p/[token]` | JSX custom con Tailwind (~200 righe) | `buildPdfHtml()` via `<DocumentFrame>` (iframe srcDoc) |
| Template preview settings | rimane `TemplatePreview.tsx` (fuori scope, dati campione) | invariato per ora |

### File creati / modificati

```
lib/pdf/logo.ts                         [NUOVO] fetchLogoBase64() — URL → data-URI base64
lib/pdf/generate.ts                     [RISCRITTURA] playwright-core + chromium + buildPdfHtml()
components/public/DocumentFrame.tsx     [NUOVO] <iframe srcDoc> auto-sizing per /p/[token]
app/p/[token]/page.tsx                  [SEMPLIFICATO] ~430 → ~270 righe; usa buildPdfHtml()
app/api/documents/[id]/pdf/route.ts     [+] export const maxDuration = 60 (Vercel Pro)
app/api/documents/[id]/send-email/route.ts [+] export const maxDuration = 60 (Vercel Pro)
```

### Architettura post-sessione 15

```
buildPdfHtml(data: PdfDocumentData): string
    ↓ chiamato da
    ├── lib/pdf/generate.ts → generatePdfBuffer() → playwright → PDF buffer
    │       ↓ chiamato da
    │       ├── /api/documents/[id]/pdf (download + anteprima)
    │       └── /api/documents/[id]/send-email (allegato email)
    └── app/p/[token]/page.tsx → <DocumentFrame html={...} />
                                     ↓
                                 <iframe srcDoc={html}> (browser)
```

### Note tecniche

- `@sparticuz/chromium` + `playwright-core` sono già in `package.json` — nessuna nuova dipendenza
- La precedente nota "Playwright/Chromium è codice morto" era riferita a `playwright-chromium` (con browser bundled). `playwright-core` + `@sparticuz/chromium` è l'approccio corretto per Vercel serverless.
- `maxDuration = 60` sulle due route PDF per Vercel Pro (Chromium startup ~5-15s)
- `fetchLogoBase64()` in `lib/pdf/logo.ts` scarica il logo workspace e lo converte in base64 (timeout 5s). Se fallisce, `buildPdfHtml()` usa il placeholder SVG.
- `DocumentFrame` usa `<iframe srcDoc={html}>` con auto-resize via `onLoad`. Su mobile l'A4 (210mm) richiede scroll orizzontale — questo è intenzionale (il documento è identico al PDF).
- `lib/pdf/template.ts` è ora LA fonte unica. Non toccarla senza screenshot aggiornati dei 4 preset.
- `PreventivoPDF.tsx` NON è più usato dalla chain di produzione. Può essere eliminato in una sessione di pulizia futura.

### Commit

```
c31aafc  feat(template): buildPdfHtml() as single source of truth for all PDF surfaces
```

### Cose aperte dopo sessione 15

1. Test manuale: aprire link pubblico di un preventivo inviato → deve mostrare esattamente lo stesso layout del PDF scaricabile
2. Test manuale: scaricare PDF → confrontare con link pubblico — devono essere identici
3. Performance: il primo PDF dopo cold start può richiedere 10-20s (Chromium download). Valutare se ottimizzare con caching del browser in `/tmp`.
4. `PreventivoPDF.tsx` + `@react-pdf/renderer` — ora inutilizzati. Rimuovere in una sessione di pulizia (richiede aggiornare tests/unit/pdf/generate.test.ts).
5. Bug #5 numerazione — da verificare
6. Bug #6 PDF preview — ora usa playwright, da verificare
7. Bug #7 mobile IVA — da verificare

---

## 0. REGOLE BASE PER CLAUDE CODE

1. Leggi TUTTO questo file prima di scrivere codice
2. Un task alla volta — output sempre: file toccati + commit hash + tsc verde + build verde
3. Sequenza: capire → implementare → `npx tsc --noEmit` → `npm run build` → verificare → commit
4. Mai interpretare arbitrariamente una decisione di prodotto — se non è documentata qui, chiedi
5. Non reimplementare da zero senza prima trovare la causa precisa del problema
6. **A fine di OGNI task** (non solo a fine sessione): aggiornare CLAUDE.md + `git push nas master` + `git push` (origin → Vercel). Confermare all'utente che il push è andato a buon fine.
7. `types/database.ts` va rigenerato dopo ogni migration
8. **Non dichiarare risolto un bug solo perché hai trovato la causa nel codice.** Usa il formato sezione C.

---

## 0-B. BACKUP NAS

```
NAS path:    Z:\CARTA CANTA
Remote git:  nas   (già configurato)
Comando:     git push nas master

File da ESCLUDERE sempre: node_modules/ .next/ dist/ build/ .claude/worktrees/ supabase/.temp/

⚠️ REGOLA PERMANENTE — push a fine di OGNI task, non solo a fine sessione:
  1. Aggiorna CLAUDE.md
  2. git add <file specifici> && git commit -m "..."
  3. git push nas master   (backup NAS — se il drive Z: non è montato, segnalarlo all'utente)
  4. git push              (origin → Vercel Production, deploy automatico entro 1-3 min)
  5. Confermare all'utente: "Push origin riuscito — deploy Vercel partito. URL: https://cartacanta.app"

Nota: il drive Z: (NAS) è montato solo con l'utente 'moian'. Con l'utente 'elisa'
git push nas master fallisce con "does not appear to be a git repository".
In quel caso: eseguire solo git push origin, segnalare il fallimento NAS all'utente.
```

---

## 1. IDENTITÀ E POSIZIONAMENTO

**Carta Canta** è una SaaS italiana per preventivi e fatture, rivolta ad artigiani, freelance e piccole imprese.

- **Target primario:** Artigiani italiani (idraulici, elettricisti, falegnami, imbianchini, installatori) — usano prevalentemente il telefono, spesso in cantiere
- **Target secondario:** Freelance/professionisti in regime forfettario o ordinario
- **Target terziario:** Piccole realtà 2-5 persone (imprese edili, studi tecnici)

**Promessa:** *"Preventivi professionali in 60 secondi. Senza Excel, senza carta."*

UX mobile-first è **non negoziabile**: ogni funzionalità deve funzionare perfettamente dal telefono prima che dal computer.

---

## 2. TECH STACK

| Componente | Tecnologia | Versione / Note |
|---|---|---|
| Framework | Next.js App Router | **16.2.3** — NON 15 |
| Runtime UI | React | 19.2.4 |
| Database | Supabase (PostgreSQL 16) | `@supabase/supabase-js` 2.103 |
| Auth | Supabase Auth (PKCE flow) | Route Handler `/auth/callback`, NON Server Action |
| Hosting | Vercel Pro | Frankfurt fra1 — EU data residency |
| Pagamenti | Stripe | SDK 22.x |
| Email | Resend + React Email | HTML + plain-text (generato da strip HTML) |
| AI import | Mistral (primario) + OpenAI (fallback) | Disabilitato in prod (chiavi vuote) |
| Voice input | AssemblyAI SDK | 4.32.1 — `speech_models: ['universal']` (array, NON singolare) |
| Rate limiting | Upstash Redis + `@upstash/ratelimit` | sliding window |
| CSS | Tailwind CSS v4 | |
| Componenti UI | shadcn/ui (Radix UI) | `radix-ui` 1.4.x |
| PDF | `playwright-core` + `@sparticuz/chromium` | `buildPdfHtml()` → HTML → Chromium headless → PDF. `@react-pdf/renderer` / `PreventivoPDF.tsx` non più usati in produzione. |
| Analytics | PostHog EU | Non configurato in prod |
| Feature flags | Flagsmith | Non configurato in prod |
| Error tracking | Sentry | Non configurato in prod |
| Testing | Vitest (unit) + Playwright (E2E) | |
| Linguaggio | TypeScript 5.x strict mode | |

---

## 3. INFO OPERATIVE

```
Repo:           github.com/Elis93/carta-canta
Dev locale:     C:\Users\Public\carta-canta   (⚠️ spostato da C:\progetti\carta-canta — giugno 2026)
Backup NAS:     Z:\CARTA CANTA  (remote git "nas")
Hosting:        Vercel Pro fra1
DB:             Supabase — project ID ivbzuhgwszkdnlsybsao
URL prod:       https://cartacanta.app
Deploy:         push su master → Vercel Production automatico entro 1-3 min
```

---

## 4. STRUTTURA PROGETTO (rilevante)

```
app/
├── (app)/
│   ├── dashboard/                  # KPI, attività recente, PendingDocCard
│   ├── preventivi/
│   │   ├── page.tsx                # Lista con search unificata, filtri, tab status
│   │   ├── [id]/page.tsx           # Dettaglio con timeline, PDF, send
│   │   ├── scadenze/page.tsx       # Preventivi in scadenza entro 3gg
│   │   └── _components/           # PreventivoForm, VociTable, CatalogPicker,
│   │                               # DocumentTimeline, PdfActions, StatusBadge...
│   ├── fatture/
│   │   ├── page.tsx
│   │   ├── [id]/page.tsx           # Con LinkToPreventivoButton
│   │   └── _components/           # CreateFromPreventivoButton, LinkToPreventivoButton
│   ├── cestino/page.tsx            # Soft delete — recupero/purge (15gg)
│   ├── clienti/[id]/page.tsx
│   ├── template/                   # 4 preset, PresetSelector, TemplateEditor, Preview
│   ├── catalogo/                   # CRUD + AtecoCatalogSuggestion
│   ├── impostazioni/tabs/          # generali, fiscali (senza card Numerazione), piano, notifiche
│   ├── abbonamento/page.tsx        # Quota bar free, piano explanation
│   └── referral/
├── (auth)/
│   ├── login/page.tsx
│   ├── signup/
│   ├── verifica-email/page.tsx     # Accessibile senza auth (in PUBLIC_PATHS)
│   └── actions.ts                  # loginAction, signupAction, ecc.
├── p/[token]/                      # Pagina pubblica preventivo
├── api/
│   ├── documents/[id]/pdf/         # GET — genera/serve PDF (inline o attachment)
│   ├── documents/[id]/send-email/  # POST — invia email con PDF allegato
│   ├── preventivi/[id]/status/     # PATCH — cambio stato manuale
│   ├── p/[token]/accept|decline|view/
│   ├── cron/expire-documents/
│   ├── cron/referral/
│   └── webhooks/stripe/
lib/
├── actions/documents.ts            # Server Actions: create, saveDraft, send, duplicate,
│                                   # restore, purge, linkDocument, peekNextDoc/Invoice
├── actions/templates.ts            # CRUD template + selectPresetAction
├── fiscal/calcoli.ts               # INTOCCABILE — 100% coverage
├── pdf/template.ts                 # buildPdfHtml — 4 layout — INTOCCABILE senza screenshot
├── pdf/generate.ts                 # Playwright HTML→PDF + cache Supabase Storage
├── email/send.ts                   # sendEmail — HTML + plain-text generato
├── free-trial.ts                   # checkFreeBlock — FREE_DOC_LIMIT = 8
└── auth-rate-limit.ts              # isAuthRateLimited — Upstash Redis
proxy.ts                            # Middleware Next.js — PUBLIC_PATHS include /verifica-email
types/database.ts                   # GENERATO — non modificare manualmente
```

---

## 5. VARIABILI D'AMBIENTE

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_PRO_MONTHLY=
STRIPE_PRICE_PRO_YEARLY=
STRIPE_PRICE_TEAM_MONTHLY=
STRIPE_PRICE_TEAM_YEARLY=
STRIPE_PRICE_LIFETIME=
OPENAI_API_KEY=           # Fallback AI (vuota in prod)
MISTRAL_API_KEY=          # Primario AI (vuota in prod)
ASSEMBLYAI_API_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@send.cartacanta.app
RESEND_FROM_NAME=Carta Canta
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
CRON_SECRET=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://eu.posthog.com
NEXT_PUBLIC_FLAGSMITH_KEY=
SENTRY_DSN=
NEXT_PUBLIC_APP_URL=https://cartacanta.app
NEXT_PUBLIC_APP_NAME=Carta Canta
NEXT_PUBLIC_AI_IMPORT_ENABLED=    # 'true' per mostrare il bottone AI Import (richiede anche OPENAI/MISTRAL key)
```

---

## 6. PIANI E FEATURE GATING

```typescript
// lib/stripe/plans.ts — valori effettivi in produzione
Piano Free:         limit = 8 preventivi storici (sent_quota_used in lib/free-trial.ts)
                    1 template, watermark visibile, voice 300s/mese
Piano Pro:          preventivi illimitati, template illimitati, no watermark, voice 3600s/mese
Piano Team:         tutto Pro + 5 collaboratori + approval workflow
Piano Lifetime:     tutto Pro, pagamento one-time
```

**Prezzi Stripe:**
```
Free:           €0
Pro Mensile:    €19.00/mese
Pro Annuale:    €182.00/anno
Team Mensile:   €49.00/mese
Team Annuale:   €470.00/anno
Lifetime:       €299.00 one-time
```

**Template gating:**
- Free: scelta 4 preset base, 1 template max, nessuna personalizzazione avanzata
- Pro/Team: colore, font, logo position, watermark, legal notice, header/footer HTML, template illimitati

---

## 7. DATABASE SCHEMA

### Enums
```sql
plan_type:     free | pro | team | lifetime
fiscal_regime: forfettario | ordinario | minimi
doc_status:    draft | sent | viewed | accepted | rejected | expired
```

### Tabelle principali

**`workspaces`**: `owner_id`, `plan`, `stripe_customer_id`, `stripe_subscription_id`, `billing_interval`, `fiscal_regime`, `ateco_codes TEXT[]`, `validity_days`, `logo_url`, `bollo_auto`, `ritenuta_auto`, `sent_quota_used INT`.

**`documents`**: `doc_type` ('preventivo'|'fattura'), `status`, `public_token`, `doc_number`, `doc_year`, `doc_seq`, `template_snapshot JSONB`, `signature_image`, `rejection_reason`, `bonus_edilizio`, `origin_document_id UUID` (per fatture da preventivo), `last_reminder_at TIMESTAMPTZ`, `deleted_at TIMESTAMPTZ` (null = attivo, non-null = nel cestino), `accepted_at`, `accepted_ip`, `accepted_ua`, `signer_name`.

**`document_items`**: `sort_order`, `description`, `unit`, `quantity`, `unit_price`, `discount_pct`, `vat_rate`, `total`, `bonus_tipo`.

**`invoice_sequences`**: PK `(workspace_id, year, doc_type)`. Colonne: `doc_type TEXT`, `seq_type TEXT` (legacy), `last_number INT`, `year`, `workspace_id`. Funzione RPC `next_invoice_number(p_workspace, p_year, p_doc_type)` — atomica, usa INSERT ON CONFLICT DO UPDATE.

**`templates`**: `preset_key TEXT CHECK('classico'|'bold'|'tecnico'|'elegante')`, `color_primary`, `font_family`, `show_logo`, `show_watermark`, `legal_notice`, `header_html`, `footer_html`, `logo_position TEXT('left'|'right')`, `is_default`.

**`catalog_items`**: `workspace_id`, `name`, `description`, `unit`, `unit_price`, `vat_rate`, `category`, `is_active`.

**`document_views`**: `document_id`, `viewed_at`, `user_agent`, `ip_address`.

**`referral_codes`**, **`referral_uses`**, **`referral_rewards`**: vedi sezione 13.

**`voice_usage`**: `workspace_id`, `period TEXT` (YYYY-MM), `seconds_used`. UNIQUE su `(workspace_id, period)`.

### Migration applicate (001–031)

| # | Contenuto |
|---|---|
| 001 | Schema completo: workspaces, clients, templates, documents, RLS |
| 002 | `doc_year`, `doc_seq` generated columns |
| 003–010 | signer_name, viewed_status, document_views, notification_prefs, catalog_items, fatture, signature_image, rejection_reason |
| 011 | rate_limit_events |
| 012–013 | invoice_sequences per doctype, next_invoice_number unificata |
| 014–017 | ateco_codes array, bonus_edilizio, workspace_validity_days, storage logos |
| 018 | Referral system + trigger + RLS + my_workspace_ids() |
| 019 | voice_usage |
| 020 | billing_interval su workspaces + reward_month su referral_rewards |
| 021 | template preset_key CHECK |
| 022 | template logo_position + number_format |
| 023 | pdf_downloaded_at |
| 024 | free_trial_expires_at |
| 025 | sent_quota_used su workspaces |
| 026 | origin_document_id su documents |
| 027 | fix doc_seq prefix per prefissi non-numerici |
| 028 | repair invoice_sequences (aggiunge doc_type, ricrea PK, aggiorna RPC) |
| 029 | last_reminder_at TIMESTAMPTZ su documents |
| 030 | deleted_at TIMESTAMPTZ su documents + indici parziali (soft delete) |
| 031 | next_invoice_number: SECURITY DEFINER + GREATEST anti-gap (applicata 20 mag 2026) |

---

## 8. MOTORE FISCALE — REGOLE INVIOLABILI

```typescript
// lib/fiscal/calcoli.ts — NON TOCCARE senza test

// ARROTONDAMENTO: sempre round half up — MAI toFixed() — MAI banker's rounding
function roundFiscale(v: number) { return Math.round((v + Number.EPSILON) * 100) / 100 }

// ORDINE CALCOLO OBBLIGATORIO:
// 1. totale per voce (qty × price × (1 - discount%))
// 2. subtotale
// 3. sconto globale
// 4. IVA PER VOCE (non sul totale — obbligatorio per legge IT)
// 5. ritenuta d'acconto
// 6. marca da bollo (forfettari con afterDiscount > 77.47 → €2.00)
// 7. totale finale
```

---

## 9. FLOWS UTENTE

### Creazione preventivo
1. Nuovo → seleziona cliente → aggiunge voci (con microfono) → salva bozza
2. Invia al cliente → email con PDF → public_token generato → status 'sent'
3. Cliente apre `/p/[token]` → accetta/rifiuta → notifica email all'artigiano
4. Accettazione: salva IP + UA + timestamp → status 'accepted'
5. Opzionale: converte in fattura (doppio entry point)

### Link pubblico cliente
- URL: `/p/[token]` — MAI `/preventivi/[id]`
- No auth, mostra preventivo nel template
- Email `reply_to` impostata sull'email dell'owner

### Re-edit preventivo accepted
- Disponibile se non ha fattura collegata con status accepted
- `saveDraftAction` resetta status a 'draft', azzera `accepted_at`
- Se ha fattura collegata accepted → locked, solo lettura

### Soft delete
- `deleteDocumentAction` imposta `deleted_at = now()`
- `/cestino` mostra i documenti nel cestino con countdown 15gg
- `restoreDocumentAction` azzera `deleted_at`
- `purgeDeletedDocumentAction` cancella definitivamente
- Cron auto-purge documenti con `deleted_at > 15gg`

---

## 10. RATE LIMITING

```typescript
// lib/auth-rate-limit.ts
// Auth login: 10 fallimenti / 15min per IP — conta solo errori, non login riusciti
// Key: auth:login-fail:{ip}

// lib/rate-limit.ts (in-memory fallback)
// send-email: 10/ora per user
// accept/decline: 5/ora per token
// AI extract: 5/min
// PDF: 10/min
```

---

## 11. FEATURE FLAGS (Flagsmith — non configurato in prod)

```typescript
FEATURE_AI_IMPORT: true (ma chiavi vuote)
FEATURE_VOICE_INPUT: true
FEATURE_REFERRAL: true
FEATURE_SDI_INTEGRATION: false
FEATURE_MARKETPLACE: false
FEATURE_PUBLIC_API: false
```

---

## 12. FUNZIONALITÀ IMPLEMENTATE (sintesi)

- Auth: email/password + OAuth Google (solo Google — GitHub non implementato) + bfcache fix mobile
- Onboarding multi-step (fiscali, ATECO, logo)
- Preventivi CRUD + status workflow + DocumentTimeline + re-edit accepted
- Soft delete + cestino + recupero 15gg
- Pagina scadenze `/preventivi/scadenze`
- Fatture CRUD + conversione da preventivo (doppio entry point + idempotenza)
- Collegamento bidirezionale preventivo ↔ fattura
- Clienti: rubrica + full-text search + StatusBadge + CF dedup
- Catalogo: CRUD + suggerimento ATECO verificato in produzione
- Template PDF: 4 preset (Classico, Bold, Tecnico, Elegante)
- Template: personalizzazioni Free/Pro + safeAccentColor + logo position
- PdfActions: server-side links (non più client-side)
- Dashboard: 5 KPI + RevenueChart dual-bar + PendingDocCard solleciti
- Referral: codici, cron premi mensili, pagina piano-specifica
- Stripe: webhook + billing_interval + subscription lifecycle
- Voice input: AssemblyAI SDK v4, quota mensile per piano
- AI import: endpoint pronto, disabilitato in prod (chiavi vuote)
- Export CSV preventivi
- Cron: scadenze + last_reminder_at + referral premi
- Email: HTML + plain-text, replyTo owner, no emoji nei subject/body

---

## 13. LOGICA REFERRAL

La logica viene calcolata il **1° di ogni mese** dal cron `/api/cron/referral`. Premio quando il referrer ha **3+ referee con abbonamento attivo**.

| Piano referrer | Tipo referee | Beneficio |
|---|---|---|
| Free | Qualsiasi abbonamento | 1 mese Pro gratis |
| Pro mensile | Qualsiasi abbonamento | Rinnovo €19 non addebitato |
| Pro annuale | Qualsiasi abbonamento | Scadenza +1 mese |
| Team mensile | 3+ Piano Team | Rinnovo €49 non addebitato |
| Team mensile | 3+ Piano Pro (non Team) | 50% sconto rinnovo (€24,50) |
| Team annuale | 3+ Piano Team | Scadenza +1 mese |
| Team annuale | 3+ Piano Pro (non Team) | Scadenza +2 settimane |

---

## 14. 4 TEMPLATE PDF — SPECIFICHE VISIVE

**NON modificare senza screenshot di riferimento aggiornati.**

| Preset | Font | Target | Caratteristica chiave |
|---|---|---|---|
| **Classico** | Inter | Artigiani, imprese | Header bianco, "PREVENTIVO" 26px a destra, table header scuro |
| **Bold** | Helvetica | Imprese, ristrutturazioni | Header dark full-width, badge pillola doc number, box "TOTALE DA PAGARE" |
| **Tecnico** | GeistSans | Elettricisti, idraulici, geometri | Strip 4 celle, colonna COD, totale sulla seconda riga voce |
| **Elegante** | Georgia | Consulenti, creativi, architetti | Logo bordato (non riempito), serif, doc number grande italic, no fill header table |

`safeAccentColor` è obbligatorio: se il colore brand è chiaro (luminosità > soglia), usa `#1a1a2e` per il testo — mai testo chiaro su sfondo bianco.

---

## 15. DEBITO TECNICO

| Voce | Priorità | Stato |
|---|---|---|
| AI import attivazione | Media | Chiavi vuote in prod — attivare quando pronto |
| PostHog / Flagsmith / Sentry | Bassa | Configurare chiavi in prod |
| INET → TEXT per `ip_address` | Bassa | Opzionale, non urgente |
| `referee_workspace_id` nullable | Bassa | Decisione aperta |
| Logo PNG nel PDF | Alta | Non testato con logo reale — da verificare |
| Email spam | Alta | Fix codice applicato (plain-text + no emoji). DNS da verificare. |

---

## 16. ROADMAP — DECISO MA RIMANDATO

| Feature | Note |
|---|---|
| Numerazione bozze separata | "Bozza 001" vs "Prev001/2026" — proposta non confermata. Migration + logica separata. |
| TASK 13 — Template preview consistency | Descrizione vaga. Non procedere. |
| SDI / fatturazione elettronica | Provider gestito, ~€0.10/fattura. Rimandato. |
| Team collaboration UI | DB pronto, manca UX inviti. |
| Portale cliente avanzato | Diverso da p/[token]. |
| Notifiche push mobile | — |
| Multi-lingua PDF | Fase 2. |
| Marketplace ATECO | Fase 3. |

---

## 17. COMMIT RECENTI RILEVANTI

```
83f1b89  fix(bugs): 7 bug fix — auth, PDF, numerazione, email, mobile         ← SESSIONE 13
a9ea4fe  fix(ux): tasks 29-45 — doc number prefix, template fields, CF dedup  ← pre-sessione 13
53b2c61  fix(ux): mobile fixes, auth email URL, fattura-da-preventivo          ← pre-sessione 13
58438b1  feat(preventivi): timeline always visible, link fattura, quota fix    ← pre-sessione 13
741ee8c  feat(preventivi): accepted→draft re-edit, DocumentTimeline            ← pre-sessione 13
d4dbddf  fix(ux): doc number prefixes, segna accettato, status dropdown        ← pre-sessione 13
92670ce  fix(ux): sollecito ripetibile, login hints, VociTable lg, dual-bar    ← SESSIONE 12
225c949  fix(ux): OAuth bfcache, login error hints, VociTable mobile, no kanban← SESSIONE 12
7ec389b  feat(ux): soft delete cestino + dashboard KPI fatturato               ← pre-sessione 12
3d671d3  fix(ux): hardcode prefixes + scadenze page + update overlay           ← pre-sessione 12
066dee1  feat(solleciti): last_reminder_at + email deliverability fixes        ← SESSIONE 11
356b9f3  fix(dashboard): split draft KPI preventivi + fatture                  ← SESSIONE 11
```

---

## 18. COMANDI UTILI

```bash
# Sviluppo
npm run dev

# Type check (OBBLIGATORIO prima di ogni commit)
npx tsc --noEmit

# Rigenerare tipi Supabase (dopo ogni migration)
npx supabase gen types typescript --project-id ivbzuhgwszkdnlsybsao > types/database.ts

# Build
npm run build

# Test
npm test

# Backup NAS
git push nas master

# Forzare rigenerazione PDF
GET /api/documents/[id]/pdf?force=1
```

---

## 19. CHECKLIST PER RIPRENDERE IL LAVORO

- [ ] Leggi questo file per intero (almeno sezioni A, B, C, D)
- [ ] `git log --oneline -5` — capire l'ultimo stato
- [ ] Verifica bug aperti in sezione A prima di iniziare nuovi task
- [ ] Prima di ogni modifica: capire la causa reale nel codice
- [ ] Dopo ogni modifica: `npx tsc --noEmit` + `npm run build` — entrambi verdi
- [ ] Aggiorna CLAUDE.md a fine sessione con formato sezione C
- [ ] Backup NAS + push origin prima di chiudere
