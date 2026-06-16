# Carta Canta ↔ OpenAPI — Implementazione pratica e testi legali (bozze)

**Data:** 14 giugno 2026 · **Ambito:** fase 1 = **solo invio** (no ricezione). Collegato a `DECISIONE_SDI.md`.
**Provider scelto:** OpenAPI (pay-as-you-go all'inizio).

> ⚠️ **Precondizione bloccante:** prima di iniziare e di accedere a OpenAPI in produzione, Eli mostra a Claude lo **screenshot del contratto/DPA OpenAPI** per revisione (vedi `DECISIONE_SDI.md` §9).

---

## 1. Cosa fa Code — e ogni quanto

Ci sono **tre livelli** diversi. Questo è il punto che spesso confonde: il grosso del lavoro si fa **una volta sola**; solo una piccola parte è ricorrente.

### 1.1 UNA TANTUM — fatto una volta in tutto il progetto
Lavoro di setup, non si ripete:
- Costruire il **layer di astrazione "provider SDI"** (`lib/sdi/`) che parla con OpenAPI.
- **Migration schema:** regime fiscale **RF19** sul workspace; `codice_destinatario`/`pec` sui `clients`; nuovi **stati** documento; **contatori** e-fattura (per-utente + globale mensile).
- Scrivere la **logica di costruzione XML** FatturaPA (RF19, Natura N2.2, dicitura, bollo).
- Creare l'**endpoint webhook** che riceve gli esiti SDI da OpenAPI.
- Salvare la **chiave API OpenAPI** come variabile d'ambiente lato server (mai nel client).
- Aggiungere i **testi legali** (sezione 3) nelle pagine giuste.

### 1.2 UNA VOLTA PER CLIENTE — per ogni artigiano (workspace)
Si fa **la prima volta** che un cliente attiva la fatturazione (es. quando completa i suoi dati fiscali o invia la prima e-fattura), poi **non si ripete** per quel cliente:
- Creare su OpenAPI la sua **configurazione anagrafica** (`business_registry_configuration`) con i dati fiscali dell'artigiano e il flag **conservazione attiva** (`apply_legal_storage`).
- Registrare i **callback** (webhook) per quella configurazione.

→ Questo è **automatico**: lo fa il codice, Eli non tocca nulla per ogni nuovo cliente.

### 1.3 OGNI VOLTA — per ogni singola fattura inviata
Questo è l'unico flusso davvero ricorrente:
- Costruire l'**XML** della fattura dai dati del documento.
- Chiamare **`POST /invoices_legal_storage`** → OpenAPI firma (se serve), **trasmette allo SdI** e **manda in conservazione** in un'unica richiesta.
- Ricevere via **webhook** l'esito (`consegnata` / `mancata_consegna` / `scartata`) e aggiornare lo **stato** + la **timeline**.
- Aggiornare i **contatori** (per-utente; e quello globale mensile per il tetto €30).

**In una frase:** Code costruisce tutto **una volta**; per ogni nuovo cliente fa **una** configurazione automatica; e poi per ogni fattura fa **una** chiamata di invio + ne segue l'esito.

---

## 2. Cosa viene inviato a OpenAPI

### 2.1 Al setup del cliente (configurazione anagrafica — una volta per cliente)
I dati identificativi/fiscali dell'**artigiano** (cedente):
- Denominazione / nome e cognome
- **Partita IVA** e **codice fiscale**
- Indirizzo completo (via, CAP, città, provincia, nazione)
- Email
- Flag dei servizi attivi: invio fatture **sì**, firma (no, non serve per il forfettario B2B), **conservazione sì**
- URL dei **callback** (webhook) per gli esiti

### 2.2 A ogni invio fattura (ricorrente)
Il contenuto della **singola fattura**, cioè:
- Dati del **cedente** (l'artigiano) — già configurati
- Dati del **cliente finale** (cessionario): nome/denominazione, **P.IVA o CF**, indirizzo, e **Codice Destinatario** (7 caratteri) **oppure PEC** — se privato senza canale, `0000000`
- **Righe/voci** del documento (descrizione, quantità, prezzo, ecc.)
- Importi, **Natura N2.2** (operazione senza IVA), **dicitura di legge**, eventuale **bollo €2**
- **Numero** e **data** documento

OpenAPI riceve questi dati (come XML o come struttura dati), li trasmette allo SdI e li conserva.

### 2.3 Cosa NON serve / nota privacy
- **Non** serve registrare alcun codice destinatario all'Agenzia (confermato dalle FAQ OpenAPI: serve solo se si **ricevono** fatture, e noi non lo facciamo).
- ⚠️ **Privacy:** la fattura contiene i dati personali/fiscali del **cliente finale dell'artigiano** (un terzo). Per questo OpenAPI è un **sub-responsabile** (vedi testo 3.1) e i dati vanno trattati in UE.

---

## 3. Testi legali (BOZZE)

> ⚠️ **Non sono un avvocato né un commercialista.** Questi sono **testi di bozza** da far **validare** da un professionista prima della pubblicazione. I dati di Openapi (ragione sociale, sede, P.IVA) sono presi dal sito ufficiale e vanno riconfermati al momento della firma del contratto.

### 3.1 Sub-responsabile del trattamento (privacy policy / elenco sub-responsabili)
> Per la trasmissione delle fatture elettroniche al Sistema di Interscambio (SdI) e per la loro conservazione a norma, Carta Canta si avvale di **Openapi S.p.A.** (Viale Filippo Tommaso Marinetti 221, 00143 Roma — P.IVA IT12485671007), in qualità di **sub-responsabile del trattamento** ai sensi dell'art. 28 del Regolamento (UE) 2016/679 (GDPR). Openapi tratta, per conto di Carta Canta, i dati necessari all'emissione, trasmissione e conservazione dei documenti fiscali (dati anagrafici e fiscali del cedente/prestatore e del cessionario/committente e dati dei documenti), su sistemi situati nell'Unione Europea. Openapi è certificata ISO/IEC 27001. L'elenco aggiornato dei sub-responsabili è disponibile su richiesta a [indirizzo email/privacy].

### 3.2 Designazione/consenso conservazione (click-through in onboarding)
> **Conservazione a norma delle fatture elettroniche.** Attivando l'emissione di fatture elettroniche, l'utente — titolare di partita IVA e responsabile della conservazione dei propri documenti fiscali — **incarica Carta Canta e il suo fornitore accreditato Openapi S.p.A. di svolgere la conservazione a norma** dei documenti emessi tramite il servizio, ai sensi del Codice dell'Amministrazione Digitale (CAD) e delle regole tecniche vigenti, per la durata prevista dalla legge (10 anni). L'utente resta titolare dei dati e dei documenti e può richiederne in qualsiasi momento l'esportazione.
> ☐ Ho letto e accetto.

### 3.3 Dicitura di legge in fattura (regime forfettario)
Da riportare nel corpo della fattura (e nell'XML):
> «Operazione effettuata ai sensi dell'art. 1, commi da 54 a 89, della Legge n. 190/2014 e successive modificazioni — regime forfettario. Operazione senza applicazione dell'IVA.»

Se compenso soggetto, aggiungere:
> «Compenso non soggetto a ritenuta d'acconto ai sensi dell'art. 1, comma 67, della Legge n. 190/2014.»

Quando dovuta la marca da bollo (importo non soggetto **> 77,47 €** → **€2,00**), riportare e valorizzare nell'XML il campo bollo:
> «Imposta di bollo assolta in modo virtuale ai sensi del DM 17 giugno 2014.»

### 3.4 Disclaimer di responsabilità
> Carta Canta è uno strumento per la creazione, l'invio e la conservazione di preventivi e fatture. **Non fornisce consulenza fiscale, contabile o legale e non sostituisce il commercialista.** La correttezza e la completezza dei dati inseriti (dati fiscali, importi, aliquote, codici destinatario) e la verifica della normativa applicabile restano responsabilità esclusiva dell'utente.

### 3.5 Termini di servizio (riga da aggiungere)
> Le fatture elettroniche sono trasmesse al Sistema di Interscambio (SdI) tramite l'intermediario accreditato **Openapi S.p.A.**; la conservazione a norma è erogata tramite il medesimo fornitore.

---

## 4. Riepilogo azioni (chi fa cosa)

| | Eli | Code |
|---|---|---|
| Setup (1.1) | dà chiavi API + credito | tutto il resto, una volta |
| Per cliente (1.2) | nulla | automatico via codice |
| Per fattura (1.3) | nulla | automatico via codice |
| Testi legali (sez. 3) | far validare da commercialista/legale | inserirli nelle pagine |

> Le bozze dei testi legali sono pronte qui sopra (sezione 3); Eli le fa validare, Code le mette nelle pagine giuste.
