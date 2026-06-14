# Provider SDI con API — Comparativa dettagliata

**Data consultazione: 14 giugno 2026.** Fonti e link in `fonti.md`.
**Trasparenza prezzi:** OpenAPI e Aruba = listino pubblico verificato. A-Cube = solo prezzo app Stripe pubblico, resto **da preventivo**. Fatture in Cloud = prezzo per-utente sul gestionale, uso "motore SDI" da verificare commercialmente.

---

## Tabella comparativa

| Criterio | **A-Cube** | **OpenAPI** | **Aruba** Fatturazione Elettronica | **Fatture in Cloud** (TeamSystem) |
|---|---|---|---|---|
| Accreditato SDI (intermediario) | ✅ Sì | ✅ Sì | ✅ Sì | ✅ Sì |
| Posizionamento | API-first per **software house / multi-tenant** | API a consumo (**pay-as-you-go**) | Prodotto a canone con API | Gestionale SaaS completo + API |
| API | REST, **JSON o XML FatturaPA nativo**; anche FTP | REST (JSON), webhook | Web-service/API (più orientata a XML) | REST + **OAuth2** per app terze |
| Autenticazione | API key o **OAuth 2.0** | API key | Credenziali servizio | OAuth2 |
| Sandbox gratuita | ✅ Sì | ✅ Sì | ✅ Ambiente di test | ✅ Ambiente dev |
| Webhook stati real-time | ✅ Sì, con **retry automatico** | ✅ Sì | 🟡 Notifiche stato | ✅ Sì |
| Stati SDI gestiti | inviata / consegnata / mancata consegna / scarto / (PA: accettata/rifiutata) | NEW/SENT/RECEIVED/DONE/ERROR + sdi_status (Delivered/Not_Delivered/Rejected/Error/Accepted/Rejected PA) | invio/consegna/scarto | invio/consegna/scarto |
| Ricezione fatture passive | ✅ (codice destinatario provider) | ✅ (registrare cod. destinatario `PIC7CPS`) | ✅ | ✅ |
| Conservazione a norma 10 anni | ✅ Inclusa/attivabile | ✅ Attivabile a consumo (~€0,105/doc) | ✅ **Inclusa nel canone** (su DocFly) | ✅ Inclusa nei piani |
| Firma digitale | ✅ (delegata) | ✅ (~€0,09/doc) | ✅ inclusa | ✅ inclusa |
| **Costo invio / fattura** | App Stripe: €19,90/mese fino a 50 doc + €0,90/extra; gratis ≤10 doc/mese. **API multi-tenant: da preventivo** | **da €0,015** (abbonamento volumi) a **€0,049–0,07** (singola/PAYG); **no setup fee** | **~€29,90/anno per P.IVA** (conservazione inclusa) | **~€48/anno** piano forfettari (per-utente) |
| Multi-Paese / ViDA 2028 | ✅ Molti Paesi UE (Peppol, KSeF, ecc.) | 🟡 Focus Italia | 🟡 Focus Italia | 🟡 Focus Italia |
| Adatto a **embedding** in SaaS terza | ✅✅ Nato per questo | ✅ Sì | 🟡 Più "prodotto finale" mono-P.IVA | 🟠 **È un concorrente** di Carta Canta |
| Dati / compliance | Società IT (Milano), **DPO** dedicato | ISO 27001/9001/25012, cloud UE, GDPR doc pubblico, società IT (Roma) | Società IT, conservazione DocFly | TeamSystem (gruppo IT) |
| Privacy/GDPR (sub-responsabile) | DPA da firmare | DPA + doc GDPR pubblico | DPA da firmare | DPA da firmare |

---

## Schede sintetiche

### A-Cube — *consigliato come primario*
- **Perché:** è l'unico che si presenta esplicitamente come API per *software house che incorporano la e-fattura* (multi-tenant, una dashboard per-P.IVA). Accetta **JSON o XML FatturaPA** indistintamente → meno codice lato Carta Canta (può produrre lui l'XML dal JSON). Webhook con retry, OAuth2, sandbox gratuita, onboarding con supporto/integration manager. Prospettiva **multi-Paese** (utile per ViDA 2028).
- **Contro:** prezzo per uso API multi-tenant **non pubblico** → serve preventivo. L'unico dato pubblico (app Stripe) suggerisce un modello a canone + extra per doc.

### OpenAPI — *alternativa forte e benchmark di prezzo*
- **Perché:** **listino pubblico, trasparente e il più basso** (invio da €0,015 con volumi, €0,049–0,07 PAYG; **nessun setup fee**; consultazione gratuita). REST/JSON, webhook, stati SDI ben documentati, sandbox, conservazione e firma a consumo. Cloud UE + ISO 27001. Ideale per partire con volumi bassi e costi certi.
- **Contro:** focalizzato Italia; modello a "mattoncini" (invio, firma, conservazione voci separate) da sommare per il costo pieno per-fattura.

### Aruba — *economica ma poco adatta al multi-tenant*
- **Perché può attrarre:** **€29,90/anno** con **conservazione 10 anni inclusa**, invio/ricezione SDI; brand noto e affidabile.
- **Contro:** API più orientata all'uso **mono-azienda**; integrarla come backend multi-tenant di una SaaS è meno naturale (gestione per-P.IVA, onboarding programmatico). Meglio per il singolo artigiano che per la piattaforma.

### Fatture in Cloud (TeamSystem) — *sconsigliato come motore SDI*
- **Perché tecnicamente possibile:** ha API REST + OAuth2 e conservazione inclusa.
- **Contro strategico decisivo:** **è un prodotto concorrente** di Carta Canta (stesso target: forfettari/artigiani). Costruirci sopra il proprio motore SDI crea dipendenza da un concorrente e un modello di prezzo **per-utente** poco adatto a una rivendita white-label.

---

## Lettura d'insieme

Per una SaaS multi-tenant che deve emettere fatture **per conto di molti utenti**, i due candidati naturali sono **A-Cube** (fit architetturale migliore) e **OpenAPI** (trasparenza e costo unitario migliori). Aruba e Fatture in Cloud restano fuori dalla rosa come *motore*: la prima per inadeguatezza al multi-tenant, la seconda per conflitto competitivo.

**Azione consigliata:** chiedere **preventivo ad A-Cube** per scaglioni realistici (es. 100 / 500 / 2.000 fatture/mese) e confrontarlo col **listino OpenAPI** agli stessi volumi. Progettare comunque un **layer di astrazione "provider SDI"** lato codice per evitare lock-in.
