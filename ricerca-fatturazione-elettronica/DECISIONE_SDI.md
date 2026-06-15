# Carta Canta — Decisione: Fatturazione elettronica SDI

**Data:** 14 giugno 2026 · **Tipo:** documento di ricerca e decisione (nessun codice).
**File collegati:** `provider-comparativa.md` (confronto provider) · `fonti.md` (link ufficiali + data consultazione).
**Regola seguita:** ogni affermazione è verificata; dove un dato è incerto o da preventivo, è dichiarato apertamente.

---

## 0. In due righe (TL;DR)

Per i forfettari la e-fattura via SDI è **obbligatoria dal 1° gennaio 2024, senza soglie**. Si **compra** (provider SDI accreditato via API), non si colloquia direttamente con SDI. **Scelte fatte da Eli (14/6/2026): si parte con OpenAPI e SOLO INVIO** (niente ricezione delle passive); A-Cube resta alternativa se i volumi crescono. E-fattura nel **Free con tetto di 5 a utente** (contatore separato) + **tetto di spesa globale €30/mese**, **illimitata nel Pro**.

---

## ✅ Decisioni prese (14 giugno 2026)

Decise da Eli in questa sessione di ricerca:

**1. Modello = BUY** (provider SDI accreditato via API), non colloquio diretto con SDI.
- *Motivo:* accreditarsi su SDI (certificati, firma, conservazione, manutenzione del tracciato) è sproporzionato per il team; il provider fa tutto il lavoro pesante e Carta Canta non deve accreditare nulla.

**2. Fase 1 = SOLO INVIO (fatture attive). Niente ricezione delle fatture passive.**
- *Motivo:* la ricezione è una funzione contabile di norma **già gestita dal commercialista** dell'artigiano; Carta Canta non vuole sostituirlo. Inoltre l'indirizzo telematico registrato all'Agenzia è **uno solo** e cattura *tutte* le fatture passive: registrando il proprio, Carta Canta le **dirotterebbe via dal commercialista** — da evitare.
- *Vantaggio operativo:* con il solo invio **non c'è nulla da fare con l'Agenzia delle Entrate** e il flusso è interamente automatizzabile per centinaia di clienti.
- *Conseguenza:* la ricezione resta un'eventuale **fase 2**, solo se i clienti la chiederanno espressamente.

**3. Provider di partenza = OpenAPI.**
- *Motivi:* (a) **self-service** — registrazione autonoma, niente trattativa commerciale; (b) **prezzi pubblici, trasparenti e bassi** (pay-as-you-go da ~€0,015 a ~€0,07/fattura, nessun costo di attivazione); (c) **include la conservazione a norma 10 anni** (obbligatoria) — discriminante che ha escluso Invoicetronic, che NON la offre; (d) società italiana, **cloud UE + ISO 27001**.
- *Alternativa futura:* **A-Cube**, se i volumi crescono (nato per software house multi-tenant), accettando che richiede un preventivo commerciale.
- *Scartati:* **Invoicetronic** (non fa conservazione), **Aruba** (poco adatta al multi-tenant), **Fatture in Cloud** (è un concorrente).

**4. Anti lock-in:** lato codice prevedere un piccolo **layer di astrazione "provider SDI"**, così cambiare provider in futuro non richiede di riscrivere la logica fatture.

**5. Gating Free/Pro della e-fattura + controllo budget.**
- **Free — tetto per-utente:** **5 e-fatture una tantum** per utente (di prova, NON al mese), con **contatore SEPARATO** da quello degli 8 preventivi; conteggiate **all'invio** e **non** restituite se la fattura viene cancellata.
- **Free — tetto di spesa globale:** **massimo €30/mese** di e-fatture gratuite in totale (≈ **170–250 e-fatture/mese** a €0,12–0,18 l'una). Raggiunto il tetto, le e-fatture free **vanno in pausa fino al mese successivo** e all'utente viene mostrato un **messaggio** (es. "tetto mensile raggiunto — passa a Pro per continuare").
- **Pro:** e-fattura **illimitata**.
- *Motivo:* le e-fatture hanno un **costo reale** (~€0,12–0,18 l'una: invio + conservazione), i preventivi no. Il tetto per-utente fa da prova/gancio all'upgrade; il **tetto globale €30/mese garantisce che l'uscita non superi mai il budget**, qualunque sia il numero di iscritti free.
- *Costo:* **assorbito da Carta Canta**, mai ribaltato per-fattura sul cliente.
- **Finanziamento via Pro (logica da definire ALTROVE):** parte dell'incasso di ogni utente Pro servirà a coprire i costi delle e-fatture e parte a far provare l'**AI import**. La **ripartizione esatta sarà decisa in un'altra chat** — qui resta solo annotata.

> Resta da decidere: i **volumi attesi** per scegliere lo scaglione di prezzo OpenAPI (§8). Da verificare con OpenAPI: la conservazione richiede una nomina firmata dal singolo cliente?

---

## 1. Obbligo: i forfettari devono emettere e-fattura via SDI?

**Sì — dal 1° gennaio 2024, per TUTTI i forfettari, indipendentemente da ricavi/compensi.**

- **Riferimento normativo:** art. 18 del **DL 36/2022 ("Decreto PNRR 2")**. Tappe: dal **1/7/2022** obbligo per forfettari con ricavi/compensi 2021 **> 25.000 €**; dal **1/1/2024** obbligo per **tutti**, eliminata ogni soglia.
- **Cosa comporta dal 2024:** emettere fattura **solo** in XML via SDI; saper **ricevere** le fatture passive; rispettare la **conservazione a norma** (CAD).

### Eccezioni / casi particolari
- **Prestazioni sanitarie verso privati:** **escluse** dall'invio via SDI (collegamento Sistema Tessera Sanitaria), confermato fino al **2025**. Non è il target di Carta Canta (artigiani).
- **Esonero sotto 25.000 €:** **decaduto** dal 1/1/2024.
- **Operazioni con l'estero:** gestite via SDI con i tipi documento dedicati (TD17/18/19) — tema separato, non prioritario per artigiani locali.

**Conseguenza per Carta Canta:** oggi l'app genera solo PDF + link pubblico → **non è sufficiente** per un forfettario che fattura B2B/PA. La e-fattura SDI è una funzione **necessaria**, non opzionale.

> Onestà sulle fonti: la pagina AdE consultata conferma direttamente gli *esoneri*; la data 1/1/2024 e lo scaglione 25.000 € sono concordi su tutte le fonti tecniche/professionali e riconducibili all'art. 18 DL 36/2022. Per blindatura legale, leggere il testo dell'articolo su Normattiva.

---

## 2. Build vs Buy

**Deciso: BUY (provider accreditato).** Il colloquio diretto con SDI è sproporzionato per una SaaS piccola.

**Cosa richiederebbe il BUILD (canale proprio su SID):** accreditare un canale **SdICoop (web-service)** o **SdIFtp**; **certificato di firma qualificata** del titolare; scambio via PEC e **installazione di certificati digitali** SDI; ambiente di test; gestione continua di firma XAdES, ricevute, ritrasmissioni, aggiornamenti del tracciato FatturaPA e **conservazione a norma 10 anni** (servizio certificato a sé).

**Perché comprare conviene:** il provider è **già accreditato**; firma/invio/ricevute/conservazione via API; time-to-market in settimane; manutenzione normativa a carico del provider; costo marginale per fattura bassissimo.

**Unico contro:** si introduce un **sub-responsabile** (DPA da firmare, §5) e una dipendenza dal fornitore → mitigabile con un **layer di astrazione** lato codice.

---

## 3. Confronto provider (sintesi)

> Dettaglio completo e schede in `provider-comparativa.md`. Prezzi: OpenAPI/Aruba/Invoicetronic da listino pubblico; A-Cube da preventivo; Fatture in Cloud per-utente.

| Criterio | **OpenAPI** ✅ scelto | **A-Cube** (alt. futura) | **Invoicetronic** | **Aruba** | **Fatture in Cloud** |
|---|---|---|---|---|---|
| Accreditato SDI | ✅ | ✅ | ✅ (partner ufficiale) | ✅ | ✅ |
| Self-service (no trattativa) | ✅ | 🟠 serve preventivo | ✅ | ✅ | ✅ |
| **Conservazione 10 anni** | ✅ a consumo | ✅ | ❌ **non offerta** | ✅ inclusa | ✅ inclusa |
| API REST + sandbox | ✅ JSON | ✅ JSON/XML | ✅ + SDK open-source | ✅ | ✅ OAuth2 |
| Costo invio/fattura | **da €0,015 a €0,07** | da preventivo | €0,10 → €0,02 (prepagato) | ~€29,90/anno/P.IVA | ~€48/anno per-utente |
| Fit SaaS multi-tenant | ✅ | ✅✅ | ✅ | 🟡 | 🟠 concorrente |

**Perché OpenAPI vince per la partenza:** è self-service, ha i prezzi più trasparenti e bassi **e include la conservazione obbligatoria**. Invoicetronic, pur ottimo come developer experience, è escluso perché **non fa conservazione**.

---

## 4. Requisiti lato Carta Canta (solo invio)

**A) Dati anagrafici (oggi probabilmente incompleti):**
- **Cedente (artigiano):** P.IVA, codice fiscale, **regime fiscale RF19**, indirizzo completo. *(Carta Canta ha già P.IVA/indirizzo; manca il regime fiscale formalizzato.)*
- **Cessionario (cliente):** denominazione, **P.IVA o CF**, indirizzo, e **uno tra** **Codice Destinatario (7 caratteri)** **o PEC**; se privato senza canale → Codice Destinatario **`0000000`** + copia PDF. → *Aggiungere ai `clients` i campi codice destinatario / PEC.*

**B) XML forfettario (FatturaPA 1.2.x):**
- **RegimeFiscale = RF19**.
- Righe **senza IVA**: **Natura = N2.2**, aliquota 0.
- **Dicitura di legge obbligatoria:** *"Operazione senza applicazione dell'IVA, ai sensi dell'art. 1, commi da 54 a 89, L. 190/2014 ..."*.
- **Bollo €2,00** se importo non soggetto **> 77,47 €** (logica bollo già presente nel motore fiscale → riportare in `DatiBollo`).
- **Numerazione progressiva** univoca per anno (già presente come {NNN}/{YYYY}).

**C) Nuovi stati (macchina a stati SDI), solo lato invio:**
- `da_inviare → inviata_a_sdi → consegnata` / `mancata_consegna` (valida comunque, cliente senza canale) / `scartata` (errore → correggere e re-inviare).
- Mappare i **webhook** del provider su questi stati; mostrarli nella **timeline** esistente; gestire lo **scarto** con messaggio leggibile + re-invio.

**D) Funzioni di sistema:**
- Generazione **XML** (o invio JSON e XML prodotto dal provider).
- **Firma digitale** delegata al provider (per il B2B/forfettario è opzionale; obbligatoria solo verso PA).
- **Conservazione 10 anni** (attivare il servizio OpenAPI; eventuale *nomina/accordo* del cliente verso il conservatore, da incastrare nell'onboarding come click-through).
- ~~Ricezione passive~~ → **fuori scope fase 1** (decisione 2).

---

## 5. Costi realistici e privacy/GDPR

**Costi (da confermare sui volumi reali):**
- **Per fattura inviata:** OpenAPI da ~€0,015 (con volumi annuali) a ~€0,07 (pay-as-you-go singolo). Su volumi bassi: qualche decina di €/mese.
- **Conservazione:** ~€0,10/doc a consumo su OpenAPI.
- **Firma:** non necessaria per il forfettario B2B (solo PA) → costo evitabile in fase 1.
- **No setup fee** su OpenAPI.
- **Da decidere:** assorbire il costo nel piano Pro o ribaltarlo sul cliente (§8).

**GDPR / privacy (data residency UE — Supabase Francoforte, Vercel fra1):**
- OpenAPI diventa **nuovo sub-responsabile (sub-processor)** → **firmare DPA** (art. 28 GDPR) e **aggiornare l'elenco sub-responsabili** nella privacy policy / DPA verso i clienti.
- OpenAPI dichiara **cloud UE + ISO 27001** e ha documentazione GDPR pubblica → coerente con la vostra impostazione UE.
- Dati fattura = dati fiscali di terzi (clienti dell'artigiano): documentare base giuridica (obbligo legale) nel **registro dei trattamenti**.
- **Conservazione:** il conservatore tratta i documenti 10 anni → nel DPA; definire fine rapporto (con vincolo legale di conservazione decennale).

---

## 6. Passi di integrazione (alto livello, solo invio)

1. **Registrarsi su OpenAPI** (self-service), ottenere chiavi sandbox + firmare **DPA**.
2. **Estendere lo schema dati:** regime RF19 sul cedente, `codice_destinatario`/`pec` sui `clients`, campi XML mancanti.
3. **Sandbox:** 5–10 fatture forfettario di prova (con/senza bollo; B2B con codice destinatario; B2C con `0000000`).
4. **Mappare stati SDI** sui webhook → timeline/UI; gestire **scarto** e re-invio.
5. **Attivare conservazione** a norma OpenAPI (+ eventuale nomina conservatore come click-through nell'onboarding).
6. **Pricing & gating:** decidere se e-fattura è feature Pro e come si copre il costo per-fattura.
7. **Privacy:** aggiornare privacy policy, elenco sub-responsabili, registro trattamenti.
8. **Go-live** dell'invio. (Ricezione = eventuale fase 2.)
9. **Layer di astrazione "provider SDI"** lato codice per non legarsi a OpenAPI.

---

## 7. Raccomandazione → decisione presa

**Scelto: OpenAPI per la partenza, solo invio.** Motivazione completa nella sezione "Decisioni prese" a inizio documento: è l'unico self-service che unisce prezzi bassi e trasparenti **e** conservazione 10 anni inclusa, con cloud UE + ISO 27001.

**Da rivalutare se i volumi crescono:** **A-Cube** (nato per software house multi-tenant, JSON o XML, onboarding con supporto), accettando il preventivo commerciale. Il **layer di astrazione** lato codice serve proprio a rendere indolore questo eventuale passaggio.

---

## 7-bis. Analisi di mercato — volumi attesi e quando passare all'annuale

**Mercato (dati 2025, fonti in `fonti.md`):** in Italia ~**1,8 milioni** di forfettari attivi e ~**1,23 milioni** di imprese artigiane; il **70%** delle nuove P.IVA individuali sceglie il forfettario. Bacino enorme, ma quota catturabile nel primo anno piccola → stima dei volumi **bottom-up** (sui clienti reali), non sul mercato totale.

**Ipotesi (dichiarate):** ~10–15 e-fatture/mese per utente Pro; gli utenti free sono già limitati dal tetto €30/mese (~170–250 e-fatture/mese in totale).

| Scenario (6–12 mesi) | Utenti Pro | E-fatture/mese | Costo OpenAPI (PAYG ~€0,175/doc) | % sui ricavi Pro |
|---|---|---|---|---|
| Prudente | ~30 | ~500 | ~€88/mese | ~15% |
| Base | ~80 | ~1.150 | ~€200/mese | ~13% |
| Ottimistico | ~200 | ~2.600 | ~€455/mese | ~12% |

In tutti gli scenari il costo e-fatture resta **~12–15% dei ricavi Pro** → sostenibile.

**Quando passare da pay-as-you-go all'annuale:**
- **Parti in pay-as-you-go** (nessun impegno; ~€0,07 invio + ~€0,105 conservazione a fattura).
- **Passa al primo scaglione annuale** quando i volumi sono **stabili sopra ~250–400 e-fatture/mese per 2–3 mesi** (≈ 20–30 utenti Pro attivi): sotto questa soglia il risparmio è minimo e non vale l'impegno prepagato.
- **Sali di scaglione** (20k, 50k/anno…) man mano che cresci; il risparmio diventa **significativo solo a volumi alti** (migliaia/mese), dove il prezzo unitario scende verso ~€0,022.
- *Caveat onesto:* i prezzi a scaglione OpenAPI sono per "API call/anno" e ogni e-fattura con conservazione ≈ **2 chiamate**; la soglia esatta va **confermata sul consumo reale** una volta live.

---

## 8. Cosa resta da decidere

| # | Punto | Stato |
|---|---|---|
| 1 | Modello BUY (provider) vs SDI diretto | ✅ **Deciso: BUY** |
| 2 | Provider di partenza | ✅ **Deciso: OpenAPI** |
| 3 | Scope fase 1 (invio vs anche ricezione) | ✅ **Deciso: SOLO INVIO** |
| 4 | Gating e-fattura Free/Pro | ✅ **Deciso: Free 5/utente una tantum + tetto globale €30/mese (poi pausa + messaggio), Pro illimitata** |
| 5 | Costo per-fattura: lo assorbe Carta Canta o lo **ribalta** sul cliente? | ✅ **Deciso: assorbito (free con tetto €30/mese, Pro via canone)** |
| 6 | Volumi attesi + soglia annuale | ✅ **Stimato (§7-bis): parti PAYG, passa all'annuale sopra ~250–400 e-fatture/mese stabili** |
| 7 | Conservazione: serve nomina firmata dal singolo cliente o basta l'accordo Carta Canta↔OpenAPI? | ⏳ Da verificare con OpenAPI |
| 8 | Ripartizione incasso Pro tra costi e-fatture e prova AI import | ⏳ Rimandato — sarà deciso in un'altra chat |

**Prossimo passo suggerito:** fissare i **volumi attesi** (punto 6) e **verificare con OpenAPI** la questione conservazione (punto 7), poi passare la palla alla chat "Code" per l'implementazione.
