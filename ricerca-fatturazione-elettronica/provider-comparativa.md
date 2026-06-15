# Provider SDI con API — Comparativa dettagliata

**Data consultazione: 14 giugno 2026.** Fonti e link in `fonti.md`.
**Esito (vedi `DECISIONE_SDI.md`):** scelto **OpenAPI** per la partenza (solo invio). **A-Cube** alternativa futura per volumi grandi.
**Trasparenza prezzi:** OpenAPI / Aruba / Invoicetronic = listino pubblico verificato. A-Cube = da preventivo (solo prezzo app Stripe pubblico). Fatture in Cloud = prezzo per-utente. Fattura Elettronica API = listino su pagina dedicata (abbonamento o ricarica).

---

## Tabella comparativa

| Criterio | **OpenAPI** ✅ | **A-Cube** | **Invoicetronic** | **Aruba** | **Fatture in Cloud** | **Fattura Elettronica API** |
|---|---|---|---|---|---|---|
| Accreditato SDI | ✅ | ✅ | ✅ partner ufficiale | ✅ | ✅ | ✅ (ITALA) |
| Posizionamento | API a consumo | API multi-tenant per software house | API per sviluppatori, SDK open-source | Prodotto a canone + API | Gestionale + API (concorrente) | API multi-azienda per software house |
| Self-service (no trattativa) | ✅ | 🟠 serve preventivo | ✅ | ✅ | ✅ | ✅ |
| **Conservazione 10 anni** | ✅ a consumo (~€0,105/doc) | ✅ inclusa/attivabile | ❌ **non offerta** | ✅ **inclusa** nel canone | ✅ inclusa | 🟡 da verificare |
| API REST + sandbox | ✅ JSON, webhook | ✅ JSON/XML, webhook+retry | ✅ + SDK MIT multi-lingua, CLI, MCP, sandbox sempre gratis | ✅ (più orientata XML) | ✅ REST + OAuth2 | ✅ REST 2.0, webhook |
| Stati/ricevute SDI | ✅ (Delivered/Not_Delivered/Rejected/Error) | ✅ +retry | ✅ | ✅ | ✅ | ✅ (esiti, consegna) |
| Ricezione passive | ✅ (cod. dest. `PIC7CPS`) | ✅ | ✅ | ✅ | ✅ | ✅ (+ richiesta massiva storico) |
| **Costo invio/fattura** | **da €0,015** (volumi) a €0,049–0,07 (singola); no setup | da preventivo (app Stripe: €19,90/mese ≤50 + €0,90 extra) | **€0,10 → €0,02** a scaglioni prepagati (firma €0,02) | ~€29,90/anno/P.IVA | ~€48/anno per-utente | abbonamento o a ricarica (da pagina prezzi) |
| Firma digitale | ✅ ~€0,09 | ✅ | ✅ €0,02 (opz. B2B, obbl. PA) | ✅ inclusa | ✅ inclusa | ✅ |
| Multi-Paese / ViDA 2028 | 🟡 Italia | ✅ molti Paesi UE | 🟡 Italia | 🟡 Italia | 🟡 Italia | 🟡 Italia |
| Fit **embedding** in SaaS terza | ✅ | ✅✅ nato per questo | ✅ ottima DX | 🟡 mono-P.IVA | 🟠 concorrente | ✅ |
| Compliance / dati | ISO 27001/9001/25012, cloud UE, GDPR pubblico (Roma) | società IT (Milano), DPO | privacy/TOS/GDPR pubblici | società IT, conservazione DocFly | TeamSystem (IT) | **ISO 9001 + 27001** (ITALA) |

---

## Schede sintetiche

### OpenAPI — *scelto per la partenza*
- **Perché vince:** unico che mette insieme **self-service + prezzi pubblici bassi + conservazione 10 anni inclusa**. REST/JSON, webhook, stati SDI documentati, sandbox, cloud UE + ISO 27001, nessun costo di attivazione. Per partire con volumi piccoli e costi certi è l'opzione a minor attrito.
- **Contro:** focus Italia; modello a "mattoncini" (invio, firma, conservazione = voci separate da sommare).

### A-Cube — *alternativa futura per volumi grandi*
- **Perché:** nato per *software house che incorporano la e-fattura* (multi-tenant per-P.IVA, JSON o XML, onboarding con supporto, prospettiva multi-Paese UE / ViDA 2028).
- **Contro:** prezzo per uso API multi-tenant **non pubblico** → serve preventivo (va contro il criterio "niente trattativa" della fase iniziale).

### Invoicetronic — *escluso: niente conservazione*
- **Pro:** miglior developer experience: partner ufficiale SDI, **SDK open-source (MIT) in molti linguaggi**, CLI, server MCP, **sandbox gratis per sempre**, prezzi prepagati trasparenti (€0,10→€0,02), pagina dedicata su "come cambiare provider" (basso lock-in).
- **Contro decisivo:** **non offre la conservazione a norma 10 anni** (obbligatoria). Utilizzabile solo abbinando un servizio di conservazione esterno → complessità in più. Per questo è fuori per la fase 1.

### Aruba — *poco adatta al multi-tenant*
- **Pro:** €29,90/anno con **conservazione inclusa**, brand affidabile.
- **Contro:** API orientata all'uso **mono-azienda**; integrarla come backend multi-tenant di una SaaS è meno naturale.

### Fatture in Cloud (TeamSystem) — *sconsigliato: concorrente*
- **Pro:** API REST + OAuth2, conservazione inclusa.
- **Contro:** **è un prodotto concorrente** di Carta Canta (stesso target); modello di prezzo per-utente poco adatto a una rivendita white-label.

### Fattura Elettronica API (ITALA) — *alternativa valida, da tenere d'occhio*
- **Pro:** accreditata, **ISO 9001 + 27001**, pensata per scenari multi-azienda/software house, self-service, abbonamento o a ricarica, REST 2.0 + webhook, download massivo dello storico (richiesta massiva).
- **Contro:** conservazione da verificare; prezzi su pagina dedicata (meno immediati del listino OpenAPI); brand più piccolo.

---

## Lettura d'insieme

Per i criteri di Eli (self-service, niente trattativa, automazione totale, conservazione inclusa, fase 1 di solo invio) il vincitore è **OpenAPI**. **Invoicetronic** sarebbe il migliore come developer experience ma è escluso perché **non fa la conservazione** obbligatoria. **A-Cube** resta la rotta di crescita per i volumi grandi. Progettare comunque un **layer di astrazione "provider SDI"** lato codice per evitare lock-in.
