# Progetto — Note di credito (TD04) via SdI

> Stato: **PROGETTO / predisposizione**. Non ancora implementato in app.
> Domanda Eli (19 lug 2026): "non possiamo già creare la struttura per gestire le note di credito?".
> Risposta breve: la struttura DATI in gran parte **c'è già**; la parte fiscale (numerazione + trasmissione TD04)
> va costruita nella **fase SdI** e sblocca con 1-2 risposte del commercialista (dossier unico, punto 6).

---

## 1. Cos'è una nota di credito (ricap fiscale)

Documento elettronico che **storna** (in tutto o in parte) una fattura **già trasmessa allo SdI**.
- Tipo documento **TD04** nel tracciato FatturaPA.
- Ha un **numero progressivo proprio** e una **data**.
- Contiene il **riferimento alla fattura originale** (`DatiFattureCollegate`: numero + data).
- Storno **totale** (annulla tutta la fattura) o **parziale** (riduce l'importo).
- Si **trasmette allo SdI** come una fattura; si segue l'**esito** (consegnata/scartata).
- È l'**unico** strumento per annullare/correggere una fattura emessa (prima della trasmissione basta "Riattiva fattura", già implementato il 19 lug).

---

## 2. La buona notizia: cosa c'è GIÀ nel nostro impianto

Quasi tutta l'ossatura esiste — la nota di credito è "una fattura al contrario" e riusa i mattoni già presenti:

| Mattone | Dove | Serve alla nota di credito? |
|---|---|---|
| Collegamento tra documenti | `documents.origin_document_id` (migration 026) | ✅ la NC punta alla fattura di origine |
| Sequenze separate per tipo | `invoice_sequences (workspace_id, year, doc_type)` + RPC `next_invoice_number(ws, year, doc_type)` | ✅ basta un `doc_type` dedicato (o riuso 'fattura' per stessa serie) |
| Allocazione numero | `allocateInvoiceNumber()` in `lib/actions/documents.ts` | ✅ si clona con `p_doc_type` scelto |
| Motore fiscale | `lib/fiscal/calcoli.ts` | ✅ i conti dello storno sono gli stessi (importi positivi; la "natura credito" sta nel tipo doc / XML) |
| XML FatturaPA | `lib/sdi/xml.ts` → `buildFatturaPaXml` (oggi `<TipoDocumento>TD01</TipoDocumento>` fisso) | 🔧 va reso parametrico (TD01/TD04) + blocco `DatiFattureCollegate` |
| Provider SdI + trasmissione | `lib/sdi/providers`, route `/api/fatture/[id]/sdi` | ✅ stesso canale (OpenAPI) |
| Esito SdI | webhook `/api/webhooks/sdi` | ✅ stesso meccanismo (consegnata/scartata) |
| Guardia "già trasmessa" | `sdi_status` non null e ≠ 'scartata' (status route + sdi route) | ✅ è proprio la condizione che fa comparire "Emetti nota di credito" invece di "Riattiva" |

**Conclusione:** a livello DATABASE serve pochissimo (forse zero migration, o una minima). Il grosso è **codice applicativo** e **la parte SdI/TD04**.

---

## 3. Cosa manca (da costruire)

1. **Tipo documento 'nota_credito'** — decisione di modellazione: un terzo `doc_type` ('preventivo' | 'fattura' | 'nota_credito') **oppure** un flag su `documents` (es. `is_nota_credito` + `origin_document_id`). ⚠️ Un terzo `doc_type` "tocca" molte query/liste/filtri/PDF che oggi assumono solo preventivo/fattura → va fatto con cura (audit di tutti i punti che filtrano `doc_type`).
2. **Generazione** — dalla fattura trasmessa: bottone "Emetti nota di credito" → scelta totale/parziale → si crea il documento NC con numero proprio, riferimento, voci (tutte o sottoinsieme).
3. **PDF** — intestazione "NOTA DI CREDITO" + riga "a storno della fattura N/AAAA del gg/mm/aaaa". ⚠️ `lib/pdf/template.ts` (4 preset) è INTOCCABILE senza screenshot: aggiunta contenuta ma da verificare con Chromium sui 4 layout.
4. **XML TD04** — `buildFatturaPaXml` parametrico su `tipoDocumento` + blocco `DatiFattureCollegate` (IdDocumento + Data della fattura originale).
5. **Trasmissione + esito** — riuso della route SdI e del webhook; la NC ha il suo `sdi_status`.
6. **Registro/Bilancio** — la NC entra nel registro fatture come storno (importo negativo nei totali del periodo); l'export CSV va esteso.
7. **UI stato** — badge/etichette per la NC nelle liste e nel dettaglio.

---

## 4. Cosa BLOCCA la struttura definitiva (domande commercialista — dossier unico §6)

Queste risposte determinano il modello, quindi conviene averle **prima** di scrivere la migration/definire la numerazione:
- **Numerazione**: la NC usa la **stessa serie** delle fatture o un **sezionale separato**? → determina il `doc_type`/serie passati a `next_invoice_number`.
- **TD04**: conferma che è l'unico strumento e che vale anche per i **forfettari** (senza IVA, con Natura N2.2 come le fatture).
- **Termini / casi particolari** (es. limiti temporali) da prevedere.

---

## 5. Fasi — cosa è sicuro fare ORA vs dopo

**Sicuro ORA (nessun effetto fiscale, nessun rischio):**
- Questo progetto (fatto).
- Eventuale **audit** dei punti che filtrano `doc_type` in tutta l'app, per sapere l'impatto del terzo tipo (documentazione, zero codice a rischio).

**Da fare nella FASE SdI (quando lo SdI è live) + dopo le risposte del commercialista:**
- Migration/modello NC, generazione, PDF TD04, XML TD04, trasmissione, registro.
- Motivo per non anticiparlo: la nota di credito **esiste solo per stornare una fattura trasmessa allo SdI**. Senza SdI live non è collaudabile end-to-end e rischieremmo di lasciare in app un documento fiscalmente "monco". La numerazione (serie/sezionale) va decisa col commercialista, altrimenti si rifà.

⚖️ **Regola B.0**: area fiscale/SdI → si costruisce solo con ok di Eli **e** parametri confermati dal commercialista. Eli ha dato l'ok a "preparare la struttura": la preparazione sicura è questo progetto + l'audit; il codice fiscale parte con lo SdI.

---

## 6. Stima (indicativa, fase SdI)

Feature **contenuta** perché riusa l'infrastruttura SdI: ~la generazione + PDF + XML TD04 + trasmissione sono estensioni, non cose nuove da zero. Il costo maggiore è l'**audit `doc_type`** (il terzo tipo che tocca liste/filtri) e la **verifica PDF sui 4 preset**.
