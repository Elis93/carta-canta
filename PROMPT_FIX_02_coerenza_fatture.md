# PROMPT CODE — FIX 02: coerenza delle FATTURE (non devono "parlare da preventivo")

> Incolla in Claude Code. Autocontenuto. **Leggi prima `CLAUDE.md` e `MAPPA_APP.md`.** Rispetta le regole CLAUDE.md.
> Tema: in più punti le fatture usano stati, etichette e grammatica dei preventivi. Vanno rese coerenti col fatto che sono fatture.
> ⚠️ `lib/pdf/template.ts` e `TemplatePreview.tsx` sono INTOCCABILI senza screenshot a riferimento: qui le modifiche sono solo testuali/condizionali per `doc_type='fattura'`. Non cambiare i layout dei 4 preset.

## Problemi da risolvere

### FIX-4 — Stati da preventivo sulle fatture ("Visto")
**Sintomo:** in lista e in dettaglio, alcune fatture mostrano il badge **"Visto"** (concetto da preventivo). Per le fatture gli stati corretti sono: **Bozza, Inviata, Pagata, Scaduta, Annullata** (l'apertura del link da parte del cliente non deve diventare uno stato "Visto" per la fattura).
**Fix atteso:** in `StatusBadge.tsx` (prop `docType`), per `docType='fattura'` mappare lo stato `viewed` in modo che NON mostri "Visto" (es. resta "Inviata"). Verificare la stessa cosa in `DocumentTimeline.tsx` e ovunque si renderizzi lo stato fattura.
**File:** `app/(app)/preventivi/_components/StatusBadge.tsx`, `DocumentTimeline.tsx`, liste `fatture/page.tsx`.

### FIX-5 — Etichette "da preventivo" dentro le fatture
**Sintomi (tutti su fattura):**
- Intestazione documento/PDF: **"Valido fino al GG/MM/AAAA"** e footer **"Preventivo generato con Carta Canta"** → per una fattura non ha senso "valido fino al"; il footer dice "Preventivo".
- Cronologia: evento **"Scade il …"** su una fattura.
- Form fattura: header sezione **"VOCI PREVENTIVO"** e campo **"Validità (giorni)"**.
**Fix atteso:** tutte le diciture devono dipendere da `doc_type`:
- PDF/documento (in `buildPdfHtml` e nella pagina pubblica): per fattura non mostrare "Valido fino al"; il footer dice "Documento/Fattura generata con Carta Canta" (non "Preventivo"). Per preventivo resta com'è.
- Cronologia: per fattura l'evento di scadenza, se mantenuto, va etichettato come **scadenza di pagamento** (vedi nota sotto), non "Scade il" stile preventivo.
- Form fattura (`FatturaForm.tsx`): header **"VOCI FATTURA"**; rinominare/ripensare **"Validità (giorni)"** in **"Scadenza pagamento"** coerente coi "Termini di pagamento" già presenti.
**File:** `lib/pdf/template.ts` (solo testo condizionale, NON layout), `app/p/[token]/page.tsx`, `app/(app)/fatture/_components/FatturaForm.tsx`, `DocumentTimeline.tsx`.
**Nota prodotto:** una fattura non "scade" come un preventivo. Se non vuoi introdurre subito la scadenza di pagamento (è parte della feature Pagamenti #2), **rimuovi** dalle fatture le diciture di validità/scadenza-da-preventivo invece di mostrarle errate. Scegli la via minima ora; la scadenza pagamento vera arriverà con #2.

### FIX-6 — Dialog e messaggi che dicono "preventivo" anche per le fatture
**Sintomi:** aggiornando una fattura → dialog **"Preventivo aggiornato … Vuoi reinviare il preventivo adesso?"**; dialog di ripristino → **"Il preventivo tornerà alla versione…"**.
**Fix atteso:** testi parametrizzati su `doc_type` ("Fattura aggiornata… reinviare la fattura?", "La fattura tornerà…").
**File:** `app/(app)/preventivi/_components/ResendReminderDialog.tsx`, `RestoreVersionButton.tsx` (passare/usare `docType`).

### FIX-7 — Grammatica femminile per le fatture
**Sintomi:** "Lo stato passerà a **Inviato**", badge **"Inviato"**, "Fattura **inviato** tramite Carta Canta".
**Fix atteso:** per le fatture usare il femminile: **Inviata**. Verificare: `SendEmailDialog` (testo "passerà a Inviato"), `StatusBadge`, intestazione pagina pubblica (`app/p/[token]/page.tsx` "Fattura inviato tramite…").
**File:** `SendEmailDialog.tsx`, `StatusBadge.tsx`, `app/p/[token]/page.tsx`.

### FIX-7bis — Avviso di trasparenza SdI sulle fatture (tutela legale, micro-task)
**Contesto:** la fattura PDF/link generata da Carta Canta **non è** la fattura elettronica valida via SdI (oggi non integrato). Non bisogna indurre l'artigiano a credere di essere in regola.
**Fix atteso:** mostrare un **avviso discreto ma chiaro** nell'area fattura (dettaglio fattura e/o vicino ai pulsanti di invio/condivisione), testo tipo: *"Questo documento non sostituisce la fattura elettronica. Ricordati di trasmetterla tramite SdI (cassetto fiscale o commercialista)."* Solo per le **fatture** (non per i preventivi). Nessuna logica fiscale, solo l'avviso. È una tutela: evita di promettere una conformità che non c'è.
**File:** `app/(app)/fatture/[id]/page.tsx` (e, se utile, sul template fattura come nota a piè di documento — ma senza toccare il layout dei preset).

## Criteri di accettazione
1. Nessuna fattura mostra "Visto" (né in lista, né in timeline).
2. Su una fattura non compaiono "Valido fino al" né footer "Preventivo generato…"; il preventivo resta invariato.
3. Form fattura: "VOCI FATTURA" e niente campo "Validità (giorni)" stile preventivo.
4. Dialog di aggiornamento/ripristino su fattura dicono "fattura".
5. Diciture femminili corrette ("Inviata") ovunque per le fatture.
6. I 4 preset PDF restano visivamente identici (nessuna regressione di layout). `tsc` + `build` verdi.

## Definition of Done
- Causa confermata; file/riga citati. Test (anche visivi: confronta un preventivo e una fattura) descritti sez. C. CLAUDE.md aggiornato.
- Commit `fix(fatture): coerenza stati/etichette/grammatica vs preventivo`.
