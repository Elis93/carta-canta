# Carta Canta — Decisione: Fatturazione elettronica SDI

**Data:** 14 giugno 2026 · **Tipo:** documento di ricerca e decisione (nessun codice).
**File collegati:** `provider-comparativa.md` (confronto provider) · `fonti.md` (link ufficiali + data consultazione).
**Regola seguita:** ogni affermazione è verificata; dove un dato è incerto o da preventivo, è dichiarato apertamente.

---

## 0. In due righe (TL;DR)

Per i forfettari la e-fattura via SDI è **obbligatoria dal 1° gennaio 2024, senza soglie**. Conviene **comprare** (provider SDI accreditato via API), non colloquiare direttamente con SDI. Rosa finale **A-Cube** (primario) e **OpenAPI** (alternativa/benchmark); decisione finale dopo preventivo A-Cube vs listino OpenAPI sui volumi attesi.

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

**Raccomandazione netta: BUY (provider accreditato).** Il colloquio diretto con SDI è sproporzionato per una SaaS piccola.

**Cosa richiederebbe il BUILD (canale proprio su SID):** accreditare un canale **SdICoop (web-service)** o **SdIFtp**; **certificato di firma qualificata** del titolare; scambio via PEC e **installazione di certificati digitali** SDI; ambiente di test; gestione continua di firma XAdES, ricevute, ritrasmissioni, aggiornamenti del tracciato FatturaPA e **conservazione a norma 10 anni** (servizio certificato a sé).

**Perché comprare conviene:** il provider è **già accreditato** (Carta Canta non accredita nulla); firma/invio/ricezione/ricevute/conservazione via API; time-to-market in settimane; manutenzione normativa a carico del provider; costo marginale per fattura bassissimo.

**Unico contro:** si introduce un **sub-responsabile** (DPA da firmare, §5) e una dipendenza dal fornitore → mitigabile con un **layer di astrazione** lato codice.

---

## 3. Confronto provider (sintesi)

> Dettaglio completo e schede in `provider-comparativa.md`. Prezzi: OpenAPI/Aruba da listino pubblico; A-Cube da preventivo (solo prezzo app Stripe pubblico); Fatture in Cloud per-utente.

| Criterio | **A-Cube** | **OpenAPI** | **Aruba** | **Fatture in Cloud** |
|---|---|---|---|---|
| Accreditato SDI | ✅ | ✅ | ✅ | ✅ |
| Modello | API multi-tenant per software house | API pay-as-you-go | Prodotto a canone + API | Gestionale + API (concorrente) |
| API REST + sandbox | ✅ JSON/XML | ✅ JSON | ✅ (più XML) | ✅ OAuth2 |
| Webhook stati SDI | ✅ +retry | ✅ | 🟡 | ✅ |
| Conservazione 10 anni | ✅ | ✅ a consumo | ✅ inclusa | ✅ inclusa |
| Costo invio/fattura | da preventivo (app Stripe: €19,90/mese ≤50 + €0,90 extra) | **da €0,015** a €0,07 | ~€29,90/anno/P.IVA | ~€48/anno per-utente |
| Fit per SaaS multi-tenant | ✅✅ | ✅ | 🟡 mono-P.IVA | 🟠 concorrente |

**Letture chiave:** A-Cube = miglior fit architetturale (multi-tenant, JSON o XML); OpenAPI = prezzo più basso e trasparente, ottimo per partire/benchmark; Aruba = economica ma poco adatta al multi-tenant; Fatture in Cloud = sconsigliata (concorrente + prezzo per-utente).

---

## 4. Requisiti lato Carta Canta

**A) Dati anagrafici (oggi probabilmente incompleti):**
- **Cedente (artigiano):** P.IVA, codice fiscale, **regime fiscale RF19**, indirizzo completo. *(Carta Canta ha già P.IVA/indirizzo; manca il regime fiscale formalizzato.)*
- **Cessionario (cliente):** denominazione, **P.IVA o CF**, indirizzo, e **uno tra** **Codice Destinatario (7 caratteri)** **o PEC**; se privato senza canale → Codice Destinatario **`0000000`** + copia PDF. → *Aggiungere ai `clients` i campi codice destinatario / PEC.*

**B) XML forfettario (FatturaPA 1.2.x):**
- **RegimeFiscale = RF19**.
- Righe **senza IVA**: **Natura = N2.2**, aliquota 0.
- **Dicitura di legge obbligatoria:** *"Operazione senza applicazione dell'IVA, ai sensi dell'art. 1, commi da 54 a 89, L. 190/2014 ..."*.
- **Bollo €2,00** se importo non soggetto **> 77,47 €** (logica bollo già presente nel motore fiscale → riportare in `DatiBollo`).
- **Numerazione progressiva** univoca per anno (già presente come {NNN}/{YYYY}; attenzione ai "buchi" da bozze cancellate — accettabile, ma da segnalare al commercialista).

**C) Nuovi stati (macchina a stati SDI), oltre a quelli attuali:**
- `da_inviare → inviata_a_sdi → consegnata` / `mancata_consegna` (valida comunque, cliente senza canale) / `scartata` (errore → correggere e re-inviare) / (PA: `accettata`/`rifiutata`).
- Mappare i **webhook** del provider su questi stati; mostrarli nella **timeline** esistente; gestire lo **scarto** con messaggio leggibile + re-invio.

**D) Funzioni di sistema:**
- Generazione **XML** (o invio JSON e XML prodotto dal provider — con A-Cube si può → meno codice).
- **Firma digitale** delegata al provider.
- **Conservazione 10 anni** (attivare servizio; può servire una *nomina/accordo* del cliente verso il conservatore).
- **Ricezione passive** (opzionale, fase 2).

---

## 5. Costi realistici e privacy/GDPR

**Costi (ordini di grandezza, da confermare con preventivi):**
- **Per fattura inviata:** da ~€0,015–0,07 (OpenAPI) fino a fasce più alte/a canone (A-Cube). Su volumi bassi: qualche decina di €/mese.
- **Conservazione:** inclusa nel canone (Aruba) o a consumo ~€0,10/doc (OpenAPI) o nel piano (A-Cube).
- **Firma:** ~€0,02–0,09/doc se non inclusa. **No setup fee** su OpenAPI; A-Cube **gratis ≤10 doc/mese** (utile per test).
- **Da decidere:** assorbire il costo nel piano Pro o ribaltarlo sul cliente.

**GDPR / privacy (avete data residency UE — Supabase Francoforte, Vercel fra1):**
- Il provider diventa **nuovo sub-responsabile (sub-processor)** → **firmare DPA** (art. 28 GDPR) e **aggiornare l'elenco sub-responsabili** nella privacy policy / DPA verso i clienti.
- Verificare trattamento **dati in UE** (OpenAPI: cloud UE + ISO 27001; A-Cube: società IT con DPO).
- Dati fattura = dati fiscali di terzi (clienti dell'artigiano): documentare base giuridica (obbligo legale) nel **registro dei trattamenti**.
- **Conservazione:** il conservatore tratta i documenti 10 anni → nel DPA; definire fine rapporto (con vincolo legale di conservazione decennale).

---

## 6. Passi di integrazione (alto livello)

1. **Scegliere provider** (§7) + firmare contratto e **DPA**.
2. **Estendere lo schema dati:** regime RF19 sul cedente, `codice_destinatario`/`pec` sui `clients`, campi XML mancanti.
3. **Sandbox:** 5–10 fatture forfettario di prova (con/senza bollo; B2B con codice destinatario; B2C con `0000000`).
4. **Mappare stati SDI** sui webhook → timeline/UI; gestire **scarto** e re-invio.
5. **Attivare conservazione** a norma (+ eventuale nomina conservatore).
6. **Pricing & gating:** e-fattura come feature Pro? Copertura del costo per-fattura?
7. **Privacy:** aggiornare privacy policy, elenco sub-responsabili, registro trattamenti.
8. **Go-live graduale:** prima invio attivo, poi (fase 2) ricezione passive.

---

## 7. Raccomandazione motivata

**Restringere a A-Cube e OpenAPI** (entrambi accreditati, REST, sandbox, webhook, conservazione, UE).

- **Primario: A-Cube** — nato per *software house che incorporano la e-fattura* (multi-tenant per-P.IVA, JSON o XML, onboarding con supporto, prospettiva multi-Paese UE / ViDA 2028). Miglior fit architetturale per Carta Canta.
- **Alternativa/benchmark: OpenAPI** — **listino pubblico, trasparente, costo unitario più basso**, pay-as-you-go senza minimi né setup. Ideale per partire con volumi piccoli e certezza di prezzo.

**Operativo:** chiedere **preventivo ad A-Cube** (scaglioni 100 / 500 / 2.000 fatture/mese) e confrontarlo col **listino OpenAPI** a parità di volumi. Se A-Cube è competitivo entro ~2× il costo OpenAPI → sceglierlo per il fit; altrimenti partire con OpenAPI. **Sconsigliati come motore:** Fatture in Cloud (concorrente) e Aruba (poco adatta al multi-tenant). Progettare un **layer di astrazione "provider SDI"** per ridurre il lock-in.

---

## 8. Domande aperte (da chiudere prima del go-live)

1. **Prezzo reale A-Cube** per uso multi-tenant (serve quote; OpenAPI già noto).
2. **Conservazione:** serve nomina firmata dal singolo cliente o basta l'accordo Carta Canta↔provider? (dipende dal provider).
3. **Volumi attesi** dei clienti (per lo scaglione di prezzo).
4. **Ricezione fatture passive** in scope subito o fase 2?
5. **Numerazione:** i "buchi" da bozze cancellate sono un problema per il commercialista? (probabilmente no, da confermare).

---

## ✅ Cosa serve decidere da Eli

1. **Confermi il modello "BUY"** (provider accreditato) invece del colloquio diretto con SDI? *(consigliato: sì)*
2. **Chiediamo un preventivo ad A-Cube** e lo confrontiamo con OpenAPI prima di scegliere? *(consigliato: sì)*
3. **La e-fattura sarà feature a pagamento** (piano Pro) o inclusa per tutti? Il costo per-fattura lo assorbe Carta Canta o lo ribalta sul cliente?
4. **In scope subito anche la ricezione delle fatture passive**, o solo l'invio in fase 1?
