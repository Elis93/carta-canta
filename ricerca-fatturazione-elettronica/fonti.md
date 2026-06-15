# Fonti — Ricerca fatturazione elettronica SDI

**Data di consultazione di tutte le fonti: 14 giugno 2026.**
Metodo: ricerca web + lettura diretta delle pagine ufficiali/provider. Dove il dato è da listino pubblico è indicato; dove serve un preventivo commerciale è dichiarato esplicitamente.

---

## 1. Obbligo e-fattura forfettari (normativa)

| Fonte | Cosa verifica | URL | Tipo |
|---|---|---|---|
| Agenzia delle Entrate — FAQ Esoneri (professionisti) | Esclusione prestazioni sanitarie verso privati via SDI fino al 2025 | https://www.agenziaentrate.gov.it/portale/web/guest/schede/comunicazioni/fatture-e-corrispettivi/faq-fe/risposte-alle-domande-piu-frequenti-categoria/esoneri-professionisti | Ufficiale (AdE) |
| Agenzia delle Entrate — FAQ Esoneri (categoria) | Quadro esoneri (sanitari, soggetti esenti) | https://www.agenziaentrate.gov.it/portale/schede/comunicazioni/fatture-e-corrispettivi/faq-fe/risposte-alle-domande-piu-frequenti-categoria/esoneri | Ufficiale (AdE) |
| InfoCert — Regime forfettario e fattura elettronica 2024 | Obbligo per tutti i forfettari dal 1/1/2024 | https://futurodigitale.infocert.it/pillole-normative/fatturazione-elettronica/regime-forfettario-e-fattura-elettronica-obbligatoria-2024/ | Secondaria (provider) |
| BibLus / ACCA | Obbligo dal 1° gennaio 2024, fine deroga 25.000 € | https://biblus.acca.it/fatturazione-elettronica-forfettari/ | Secondaria (editore tecnico) |
| Commercialista Telematico | Forfettari: obbligo per tutti dal 1/1/2024; riferimento DL 36/2022 | https://www.commercialistatelematico.com/articoli/2023/12/contribuenti-forfettari-da-1-gennaio-2024-obbligo-fatturazione-elettronica.html | Secondaria (professionale) |
| Fatture in Cloud — Obbligo e-fattura forfettari | Riepilogo obbligo + scaglioni storici (25.000 €) | https://www.fattureincloud.it/guida-fatturazione-elettronica-forfettario/obbligo-fattura-elettronica/ | Secondaria (provider) |

> **Nota di sincerità:** la data 1/1/2024 e lo scaglione storico dei 25.000 € (dal 1/7/2022) sono concordi su tutte le fonti e riconducibili all'**art. 18 del DL 36/2022 ("Decreto PNRR 2")**. La pagina AdE consultata conferma direttamente solo gli *esoneri* (sanitari); l'obbligo generale è confermato dalle fonti tecniche/professionali sopra. Per blindarlo al 100% in fase legale, leggere il testo dell'art. 18 DL 36/2022 su Normattiva/Gazzetta Ufficiale.

---

## 2. Build vs Buy — accreditamento diretto SDI

| Fonte | Cosa verifica | URL | Tipo |
|---|---|---|---|
| Agenzia delle Entrate — "Accreditare un canale" (PDF) | Procedura accreditamento canale, certificati, codici destinatario | https://www.agenziaentrate.gov.it/portale/documents/20143/289347/Accreditamento+e+richiesta+codici+destinatario_Accreditamento+e+richiesta+codici+destinatario_v1.0.pdf/8333539f-f864-ac00-3ab0-74ce8a47db69 | Ufficiale (AdE) |
| FatturaPA.gov.it — Sistema di Accreditamento | Canali SdICoop (web-service) / SdIFtp; requisiti tecnici | https://www.fatturapa.gov.it/it/SistemaAccreditamento/ | Ufficiale (MEF/SOGEI) |

> Verificato: il colloquio con SDI può avvenire via PEC, canale web "Fatture e corrispettivi", **SdICoop (web-service)** o **SdIFtp**; l'accreditamento del canale richiede certificato di firma qualificata, scambio via PEC e installazione di certificati digitali rilasciati da SDI + ambiente di test.

---

## 3. Provider SDI

| Fonte | Cosa verifica | URL | Tipo |
|---|---|---|---|
| **OpenAPI — Electronic Invoicing Italy** ✅ scelto | Listino pubblico (invio da €0,015/0,07, firma €0,09, conservazione €0,105), stati SDI, codice destinatario `PIC7CPS`, sandbox, webhook | https://openapi.com/products/italian-electronic-invoicing | Provider (listino pubblico) |
| OpenAPI — Documentazione SDI | Endpoint, FAQ, stati notifica | https://console.openapi.com/apis/sdi/documentation | Provider |
| A-Cube — API E-Invoicing Italia | Accreditato SDI, REST JSON/XML FatturaPA, sandbox gratuita, webhook+retry, OAuth2/API key, conservazione, DPO | https://www.acubeapi.com/prodotti/api-e-invoicing-italia | Provider |
| A-Cube — App Stripe (dato di prezzo) | Esempio prezzo: €19,90/mese fino a 50 doc + €0,90/doc extra; gratis fino a 10 doc/mese | https://www.acubeapi.com/en/products/app-stripe-e-invoicing | Provider |
| **Invoicetronic — Pricing** | Prezzi prepagati €0,10→€0,02/transazione (invio/ricezione/validazione), firma €0,02, sandbox gratis sempre. **Nessuna menzione di conservazione** | https://invoicetronic.com/en/pricing/ | Provider (listino pubblico) |
| Invoicetronic — Features / SDK | Partner ufficiale SDI, SDK open-source MIT multi-lingua, CLI, MCP, webhook; doc "switching providers" | https://invoicetronic.com/en/features/ | Provider |
| **Fattura Elettronica API (ITALA)** | Accreditata SDI, ISO 9001 + 27001, multi-azienda, abbonamento o ricarica, REST 2.0, richiesta massiva storico | https://www.fattura-elettronica-api.it/ | Provider |
| WT-Tech — FE-HUB-WS | API white-label multi-operatore per gestionali | https://www.wt-tech.it/fattura-elettronica-tramite-api-web-services-per-software-gestionale | Provider |
| Aruba — Recensione/prezzi 2026 | €29,90/anno, conservazione 10 anni inclusa, invio/ricezione SDI | https://centrofiscale.com/aruba-fatturazione-elettronica-recensione-2026/ | Secondaria |
| Aruba — API Docs v2 | Esistenza API/web-service per invio XML | https://fatturazioneelettronica.aruba.it/apidoc/v2/docs.html | Provider |
| Fatture in Cloud / TeamSystem — prezzi | Piano forfettari ~€48/anno; suite gestionale con API | https://www.teamsystem.com/store/fatture-in-cloud/prezzi/ | Provider |

> **Sincerità sui prezzi:** OpenAPI, Aruba e Invoicetronic hanno **listino pubblico verificato**. Per **A-Cube** l'unico prezzo pubblico è quello dell'app Stripe; il prezzo "software house / multi-P.IVA via API" **richiede preventivo**. **Fattura Elettronica API** ha prezzi su pagina dedicata (abbonamento/ricarica). **Fatture in Cloud** ha prezzo per-utente sul gestionale.
> **Discriminante conservazione:** verificato che **Invoicetronic non offre la conservazione a norma 10 anni** (assente dal listino e dalle features) — motivo dell'esclusione per la fase 1. OpenAPI e Aruba la includono/offrono esplicitamente.

---

## 4. Ricezione fatture passive + cosa fare con l'Agenzia delle Entrate

| Fonte | Cosa verifica | URL | Tipo |
|---|---|---|---|
| Agenzia delle Entrate — Come si riceve una fattura dallo SDI | Recapito fatture passive, indirizzo telematico, cassetto fiscale | https://www.agenziaentrate.gov.it/portale/aree-tematiche/fatturazione-elettronica/guida-fatturazione-elettronica/come-predisporre-inviare-ricevere-fe/come-si-riceve-fe-da-sistema-interscambio | Ufficiale (AdE) |
| Guide Aruba PEC — Registrazione codice destinatario | Procedura registrazione indirizzo telematico su "Fatture e Corrispettivi" (SPID/CNS) | https://guide.pec.it/fatturazione-elettronica/fatture-corrispettivi-ade/registrazione-codice-destinatario-agenzia-entrate.aspx | Secondaria |

> Verificato (rilevante per la decisione "solo invio"): **per l'invio non serve nulla con l'Agenzia**. Per la **ricezione**, va registrato un indirizzo telematico sul portale AdE con SPID/CNS del titolare di P.IVA; una volta registrato, **SDI recapita TUTTE le fatture passive a quell'indirizzo**, ignorando ciò che scrive il fornitore → registrarne uno proprio **dirotterebbe le passive via dal commercialista**. Da qui la scelta di **non** implementare la ricezione in fase 1.

---

## 5. Requisiti XML forfettario

| Fonte | Cosa verifica | URL | Tipo |
|---|---|---|---|
| Fatture in Cloud — Emissione e-fattura forfettario (esempio) | Dicitura di legge obbligatoria, assenza IVA, esempio compilazione | https://www.fattureincloud.it/guida-fatturazione-elettronica-forfettario/emissione-esempio/ | Secondaria (provider) |
| Regime Forfettario — checklist XML/SdI | Campi obbligatori, codice destinatario, natura IVA | https://www.regime-forfettario.it/fattura-elettronica-regime-forfettario-2/ | Secondaria |

> **Sincerità:** i codici tecnici **RF19** (regime forfettario) e **N2.2** (natura "non soggette - altri casi") e il bollo €2 sopra 77,47 € sono prassi consolidata e coerente tra le fonti; le pagine consultate confermano la **dicitura di legge** e l'assenza di IVA. Per i valori esatti dei campi del tracciato, la fonte normativa primaria è la **guida e le specifiche tecniche FatturaPA dell'Agenzia delle Entrate** (provvedimento tracciato 1.2.x) — da consultare in fase implementativa.

---

## 6. Conservazione a norma 10 anni

| Fonte | Cosa verifica | URL | Tipo |
|---|---|---|---|
| Fatture in Cloud — Conservazione sostitutiva | Obbligo 10 anni, regole CAD, immodificabilità/integrità/autenticità | https://www.fattureincloud.it/guida-fatturazione-elettronica/conservazione-sostitutiva/ | Secondaria (provider) |
| Informazione Fiscale — Conservazione 2026 (anche forfettari) | Obbligo conservazione per forfettari, scadenze | https://www.informazionefiscale.it/conservazione-fatture-elettroniche-scadenza-2026-forfettari | Secondaria |

> Riferimento normativo citato dalle fonti: **art. 2220 c.c.** (10 anni), **CAD** e **DM MEF 17 giugno 2014**. Da verificare sui testi ufficiali in fase legale.

---

## 7. Mercato (per la stima volumi)

| Fonte | Cosa verifica | URL | Tipo |
|---|---|---|---|
| Unimpresa — Nuove partite IVA 2025 | ~1,8 mln forfettari attivi; 7 su 10 nuove P.IVA individuali scelgono il forfettario | https://www.unimpresa.it/nuove-partite-iva/72596 | Secondaria (associazione) |
| Fisco Oggi (Agenzia Entrate) — Osservatorio partite IVA 2025 | Dati ufficiali aperture partite IVA e quota forfettario | https://www.fiscooggi.it/portale/-/osservatorio-partite-iva-online-la-sintesi-del-2025 | Ufficiale (AdE) |
| Startupbusiness / CNA — Imprese artigiane 2025 | ~1,23 mln imprese artigiane registrate in Italia nel 2025 | https://www.startupbusiness.it/imprese-artigiane-123-milioni-attivita-registrate-nel-2025/149939/ | Secondaria (elaborazione CNA) |

> Uso onesto del dato: questi numeri servono solo a dimensionare il **mercato potenziale**, non i volumi reali di Carta Canta. La stima volumi in `DECISIONE_SDI.md` §7-bis è **bottom-up** (su ipotesi di utenti Pro), dichiarata come tale.
