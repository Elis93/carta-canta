# CLAUDE.md — Memoria permanente del progetto Carta Canta

> **Fonte di verità per Claude Code.**
> Va aggiornato a fine di ogni sessione con: feature implementate, decisioni prese, bug emersi, cose rimandate.
> Storico sessioni precedenti spostato in `STORICO_SESSIONI.md` (consolidamenti doc: 14 giu · 15 lug 2026 — qui restano solo gli handoff dal 13 lug in poi).
> **Ultima sessione:** 7 luglio 2026 (COMPLIANCE + CYBERSECURITY — irrobustimento sicurezza, informative legali, 3 PDF per professionisti). Changelog operativo recente in `REGISTRO_AGGIORNAMENTI.md`.

---

## A0. HANDOFF — SESSIONE 7 lug (parte 2): export GDPR, fisco frontaliera, foto scontrino, Play Store

### ✅ 29 lug (4) — INDIETRO MUTO sulla vetrina /professionisti (Eli: "clicco indietro e non succede nulla")
Stessa classe della freccia in-app: `BackChip` faceva `history.back()` cieco — dopo ricerche col form (GET = un entry a testa) e "Vicino a me" (router.push) la cronologia era una pila di varianti della STESSA pagina → ogni tap ne ripercorreva una e sembrava morto. Fix: ① `NearMeButton` push→**replace** (stato della stessa pagina, non una nuova); ② `NavTracker` ora registra anche **`cc_last_path`** (pagina in-app CORRENTE — all'uscita dall'app il componente si smonta e `cc_prev_path` resterebbe un passo indietro); ③ `BackChip` riscritto: chi arriva dall'app → `router.push(cc_last_path)` (es. dritto a Fatti trovare), chi arriva da fuori → back del browser, senza cronologia → home. tsc+build+377/377 verdi.

### ✅ 29 lug (3) — VETRINA MAI VUOTA + selettore "Ordina" + checksum P.IVA in Impostazioni (richieste Eli)
- **/professionisti mai vuota** (regola Eli, già chiesta in passato): se la ricerca per parola/comune non trova nulla, la pagina RIPIEGA su tutti i profili pubblicati (ordinati per distanza se c'è la posizione) con nota ambra "Nessun professionista trovato per la tua ricerca: ecco tutti gli altri…". "Nessun risultato" secco resta solo a vetrina completamente vuota.
- **Selettore "Ordina"** (`OrdinaSelect`, client, URL-driven ?sort=): Consigliati (default storico: distanza con geo, Pro+recensioni senza) · Più vicini (solo con posizione) · Recensioni · Nome A-Z. Compare con ≥2 risultati.
- **Checksum P.IVA/CF in Impostazioni › Fiscale**: il campo ora avvisa SUBITO (ambra, non bloccante) se la cifra di controllo della P.IVA non torna (`isValidPivaFormat`, la stessa dei pre-check SdI) o se un CF a 16 caratteri non rispetta il formato (omocodia ammessa). "Puoi salvare comunque" — un typo scoperto qui costa zero, scoperto dallo SdI costa uno scarto.
- tsc+build+377/377 verdi.

### ✅ 29 lug (2) — VERIFICA P.IVA anche sul REGISTRO IMPRESE (decisione Eli "opzione 1")
Dal collaudo Fatti trovare: il VIES contiene SOLO le P.IVA registrate per operazioni con l'estero → molti artigiani/forfettari italiani con P.IVA valida non ci sono e non potrebbero MAI pubblicarsi in vetrina. Scelta Eli: verifica sul Registro Imprese via OpenAPI ("se non ci mette in difficoltà").
- **`lib/marketplace/company-check.ts`** (nuovo): `GET company.openapi.com/IT-start/{piva}` con Bearer `OPENAPI_COMPANY_API_KEY` — chiamato SOLO se il VIES non conferma (il VIES resta primo: è gratis). 404→invalid · 401/403→unavailable con log "attiva l'API in console" (mai un giudizio sulla P.IVA) · senza chiave→'unconfigured' = comportamento identico a prima (solo VIES, rollout sicuro).
- `publishMarketplaceProfileAction`: catena VIES→Registro; copy "Riscontro automatico sul Registro Imprese" / "P.IVA non trovata nei registri". **+7 test** (`company-check.test.ts`: no chiamate senza chiave o con formato invalido = niente costi inutili; Bearer corretto; 404/401/500 mappati). **377/377 verdi.**
- ⏭️ **AZIONE ELI per attivarla**: console.openapi.com → attivare API **"Company"** (produzione) → token con scope `GET company.openapi.com/IT-start` → su Vercel `OPENAPI_COMPANY_API_KEY` (prezzo per chiamata visibile in console all'attivazione; si paga solo quando il VIES non conferma). Finché manca la chiave: tutto come prima.

### ✅ 29 lug — "SALVATAGGIO NON RIUSCITO" al Pubblica del profilo marketplace (collaudo Fatti trovare)
Causa reale: conflitto 045×055 — la migration 045 dà ad `authenticated` i permessi su marketplace_profiles COLONNA PER COLONNA (workspace_id, public_name, trade, city, radius_km, phone, bio, updated_at); la 055 ha aggiunto lat/lng DOPO, senza estendere i GRANT. `saveMarketplaceProfileAction` upsertava lat/lng col client utente → **42501 permission denied sull'INTERA scrittura** ogni volta che la geocodifica del comune riusciva (comune valido = fallimento certo; il retry tollerante scattava solo su 42703/PGRST204, non su 42501). Latente dal 19 lug: nessuno aveva più ri-salvato un profilo.
Fix SENZA migration (coerente con la filosofia 045): l'upsert utente tocca SOLO le colonne concesse; le coordinate — dato DERIVATO dal comune, non dell'utente — le scrive il server con l'ADMIN client, best-effort (fallisce → profilo salvato comunque, cercabile per parola; tollerante pre-055). **+5 test** `tests/unit/marketplace/save-profile.test.ts` (payload utente senza lat/lng · coordinate via admin · admin che esplode non blocca il salvataggio · geocode fallita ok · upsert in errore = messaggio onesto). **370/370 verdi.** ⚠️ REGOLA: se una migration aggiunge colonne a una tabella con GRANT per colonna (reviews, marketplace_profiles, marketplace_requests), va aggiornato anche il GRANT o la scrittura va spostata sull'admin client.

### ✅ 28 lug (9) — FRECCIA "INDIETRO" affidabile su tutte le pagine (Eli: "a volte funziona in modo errato")
Causa reale: `BackButton` decideva con `history.length > 1`, che è quasi SEMPRE vero (conta anche la cronologia PRIMA di entrare nell'app e non cala mai) → `router.back()` cieco: con un link diretto (notifica/WhatsApp) USCIVA dall'app, dopo un salvataggio con redirect riportava sul form appena inviato. Fix:
- **`NavTracker`** (nuovo, montato in `app/(app)/layout.tsx`): registra il percorso in-app precedente in sessionStorage (`cc_prev_path`) a ogni cambio rotta.
- **`BackButton` riscritto**: `router.back()` SOLO se esiste una precedente in-app, diversa dalla corrente e non "di passaggio" (`*/nuovo`, `/catalogo/importa`, login/signup/verifica-email/onboarding/avvio); altrimenti `push(fallback)` (pagina genitore, sempre prevedibile). Logica pura `shouldGoBack()` esportata e congelata con **+7 test** (`tests/unit/shared/back-button.test.ts`, 365/365).
- Verificati i 30 fallback esistenti (tutti genitori sensati: /altro, liste, /farti-trovare…); i link mese di calendario/bilancio usano già `replace` (niente cronologia impilata). `BackChip` di /professionisti NON toccato (pagina pubblica: il back verso l'esterno lì è il comportamento atteso del browser).
- tsc+build+**365/365** verdi · scan spazi pulito.

### ✅ 28 lug (8) — EDITOR TEMPLATE: pannelli che restano aperti + più aria tra le righe del documento
Feedback Eli: ① "apro le sezioni del template e basta che clicco in un'altra parte della pagina e spariscono" → RIMOSSO il listener pointerdown-fuori in `TemplateEditor` (il pannello Stile/Colore/… ora resta aperto; cambia toccando un'altra sezione, si chiude ri-toccando la stessa). ② "poco spazio tra una riga e l'altra" (foto Tecnico) → padding verticale delle righe voci alzato nei 4 preset: Classico 9→11, Bold 8→10, Tecnico 7→10 (+line-height 1.5), Elegante 8→10. Verificato con screenshot Chromium (Tecnico terracotta). tsc+build+358/358 verdi.

### ✅ 28 lug (7) — BADGE "SdI" in lista fatture + ricerca "sdi" (ok Eli)
Nella lista fatture le righe delle fatture passate dallo SDI mostrano un badge accanto allo stato: **"SdI ✓"** verde (inviata/consegnata/emessa) o **"SdI scartata"** rosso. Scrivendo **"sdi"** nel cerca si filtrano tutte le fatture con stato SdI. Implementazione TOLLERANTE: `sdi_status` letto con una query separata sugli id già in lista (la select principale resta intatta; pre-044 → mappa vuota, nessun badge, niente crash) e il filtro di ricerca su colonna assente risponde vuoto senza rompere la pagina. File: `app/(app)/fatture/page.tsx`. tsc+build+358/358 verdi.

### ✅ 28 lug (6) — DOCUMENTO REALE ricalibrato sulle PROPORZIONI dell'anteprima template (foto Eli)
Eli (3 foto, preset Tecnico): "mi piace molto l'anteprima dei template, le proporzioni tra le scritte… ma non viene replicata nel documento vero". Causa: in `TemplatePreview` la gerarchia ha 3 livelli chiari (etichette ~0,6-0,8× del corpo, corpo, display 1,4-1,7×), mentre in `template.ts` era tutto appiattito a 17-19px (intestazioni tabella = corpo). Ricalibrati i 4 preset sul rapporto dell'anteprima (àncora: descrizione voce = 19px):
- **Tecnico** (il suo): occhiello 19→16, **numero documento 22→30**, nome azienda 17→22, indirizzo 19→14, etichette strip 17→13, **intestazioni tabella 19→13**, cella COD 19→17, totale 17→**24**.
- **Classico**: PREVENTIVO 24→28, nome 19→21, indirizzo 17→15, th 19→15, "Valido…" 17→15.
- **Bold**: fascia contatti 19→14, indirizzo 19→15, th 19→16, cifra nel box totale 20→24.
- **Elegante**: numero 23→28, th 17→13.
- `TemplatePreview` NON toccata: è il riferimento. Verificato con Chromium sui 4 preset (Tecnico terracotta come le foto di Eli — replica fedele dell'anteprima). tsc+build+358/358 verdi.

### ✅ 28 lug (5) — FILIGRANA ATTIVA sui template appena creati (richiesta Eli)
`createBlankCustomTemplateAction` (bottone "Nuovo template" mobile, Pro) creava la riga con `show_watermark: false` → il template nuovo si apriva con la filigrana "Generato con Carta Canta" SPENTA, in contrasto con l'editor desktop /template/nuovo che parte acceso (`useState(?? true)`). Ora `show_watermark: true`: ogni template nuovo nasce con la filigrana attiva; il Pro può spegnerla dall'editor. NB pre-esistente non toccato: le card di PresetSelector mostrano l'anteprima con `?? false` (scelta display "documento pulito"). tsc+build+358/358 verdi.

### ✅ 28 lug (4) — RESTYLE "ARIA" dei 4 preset (scelta Eli dal mockup: "la B, ma niente parole a capo, e rispetta i template")
Mockup Artifact con 3 proposte (A Rifinita / B Aria / C Blocchi) → Eli sceglie la **B** + regola ferrea: **mai parole o frasi spezzate a capo** (es. "valido fino al" con "al" da solo) + i preset scelti dagli artigiani vanno RISPETTATI. Applicato in `lib/pdf/template.ts` come "lingua" B senza cancellare le identità:
- **Classico** (il più toccato): etichette Destinatario/Data emissione piccole nel **colore del template** (safeAccentColor, mai a capo), titolo lavoro 21px, righe voci con più aria (padding 9px, filo caldo #f0efec), totale con **riga d'accento 2px + cifra 24px** (stile B). Testata scura della tabella INVARIATA (identità del preset).
- **Elegante**: totale corsivo 24px; la validità ora dice la **data vera** ("Valido fino al X" — prima diceva "Valido 30 giorni dalla data" ANCHE quando la data c'era).
- **Bold/Tecnico**: identità intatte, solo nowrap + fix sotto.
- **Regola niente-a-capo, meccanica**: nuovo helper **`joinDots(parts)`** — indirizzo+P.IVA in testata (6 punti) e fascia contatti del Bold escono come `<span white-space:nowrap>` uniti da " · " → l'a-capo cade solo TRA le parti, mai dentro "P.IVA 123…" o "Valido fino al: …" (lo screenshot Bold lo spezzava). Etichette (`LABEL`) nowrap in tutti e 4 i preset; date/validità nowrap.
- **Righe IVA del riepilogo da 10px → 17px** (stonavano accanto al totale nuovo; 3 preset).
- `TemplatePreview.tsx` specchiato (LABEL_ACCENT, totale con riga accent, "Valido fino al {expiry}").
- Verificato con Chromium a 900px: 4 preset forfettario + classico ordinario (righe IVA) + Bold post-fix. tsc+build+358/358 verdi.

### ✅ 28 lug (3) — DOCUMENTO PUBBLICO come "lettore" elegante (Eli: "tutto poco ordinato ed elegante")
La pagina del documento completo (route PDF pubblica/in-app via `preparePrintHtml`) era un foglio bianco attaccato ai bordi. Ora, SOLO a schermo (stampa verificata intatta con emulateMedia print: radius 0, shadow none, body bianco): sfondo grigio caldo #e8e6e0 coerente col brand, foglio con angoli arrotondati (10px) e ombra morbida, e margine laterale di 12px anche sul telefono — il `fitScript` scala il foglio a `(vw−24)/794` invece di `vw/794` così la cornice si vede tutt'attorno (prima il foglio riempiva lo schermo edge-to-edge). Nota legale meno slavata: #ccc → **#b3b1ab** in `template.ts` E nei 4 preset di `TemplatePreview`. Verificato con Chromium: telefono 412px emulazione mobile (cornice visibile, angoli tondi) + desktop 1280px + print. File: `lib/pdf/logo.ts` (printCss + fitScript), `lib/pdf/template.ts`, `TemplatePreview.tsx`. tsc+build+358/358 verdi. ⏭️ Se Eli vuole un restyle più profondo dei CONTENUTI dei preset → mockup con varianti da approvare prima (regola F).

### ✅ 28 lug (2) — INTESTAZIONI TABELLA DOCUMENTO su UNA riga (screenshot Eli: "PREZZO UNIT." a capo)
Sul documento pubblico (preset Classico) l'intestazione "PREZZO UNIT." andava su due righe — colpa della larghezza fissa del th (90px non basta a 19px uppercase), non del telefono. Fix in `lib/pdf/template.ts`: "Prezzo unit." → **"Prezzo"** su Classico e Tecnico (Bold ed Elegante dicevano già così) + `white-space:nowrap` su TUTTE le intestazioni corte (Q.tà/Prezzo/Totale/Cod/U.M./Tot., 14 celle nei 4 preset) → mai più a capo a nessuna larghezza. `TemplatePreview.tsx` allineato (stesse etichette). Verificato con Chromium sui 4 preset a 900px (larghezza reale d'impaginazione: la pagina non ha meta viewport, il telefono la scala) E a 412px: zero intestazioni a capo, replica dello screenshot di Eli pulita. tsc+build+358/358 verdi.

### ✅ 28 lug — TENDINA CRONOLOGIA anche sui PREVENTIVI mobile (Eli: "per i preventivi non vedo i menu a tendina")
Causa reale: la vista MOBILE di preventivi/[id] non usa DocumentTimeline — ha una "Card Cronologia" costruita inline nella pagina (righe ~563-586); la tendina del 27 lug era finita solo sul componente condiviso, che sui preventivi monta solo su desktop. Fix: nuovo **`CronologiaDisclosure`** (client, stesso header "CRONOLOGIA · N eventi" + chevron del DocumentTimeline) che avvolge la lista inline mobile; lista e stili INVARIATI. Verificato con Chromium a 390px (chiusa → aperta → richiusa). ⚠️ Da ricordare: le cronologie sono DUE — DocumentTimeline (fatture mobile+desktop, preventivi desktop) e la card inline mobile dei preventivi. tsc+build+358/358 verdi.

### ✅ 27 lug (5) — CRONOLOGIA: motivo di ogni azzeramento + tendina apri/chiudi
Richiesta Eli: "ogni minima modifica tracciata con data e ora" (acconto eliminato/reinserito) + "la cronologia si possa aprire con un menu a tendina".
- **Motivo negli azzeramenti**: le voci `payment_reset` ora portano `reason` — 'correzione' (dal link "Azzera e reinserisci"), 'annullamento', 'riattivazione', 'non_pagata' — e la timeline le mostra come "Acconto azzerato per correzione (X)", "Incasso azzerato — fattura annullata (X)", ecc. Le voci senza reason (legacy) restano "Incasso azzerato". Gli acconti precedenti restavano GIÀ (log append-only): ora la sequenza sbagliato→azzerato→reinserito si legge per intero, ogni voce con data e ora reali. **+1 test** sulla sequenza completa (358/358).
- **Cronologia a tendina** (`DocumentTimeline`, vale per preventivi E fatture): chiusa di default, header "CRONOLOGIA · N eventi" con chevron, tap per aprire/chiudere (aria-expanded). Verificata con Chromium reale a 390px (bundle esbuild + click: chiusa → aperta → richiusa).
- tsc+build+**358/358** verdi · scan spazi pulito.

### ✅ 27 lug (4) — RITENUTA FASE 1 (dicitura forfettari) + correzione acconto sbagliato + piano in RITENUTA_DACCONTO_TODO.md
Eli: "ok a procedere come suggerisci, segna quello che manca da fare in un file .md" + domanda "se un artigiano avesse sbagliato a inserire l'acconto come fa a cambiarlo?".
- **📄 `RITENUTA_DACCONTO_TODO.md`** (nuovo, nel repo): stato fasi 1-6 + le 4 domande 🔒 per il commercialista (causale W vs A, testo dicitura, 4% vs 8% bonifico parlante, base di calcolo). Fasi 2-6 = blocco unico DOPO la conferma del commercialista (B.0).
- **✅ Fase 1 — dicitura comma 67**: le FATTURE dei forfettari ora dichiarano "Compenso non soggetto a ritenuta d'acconto ai sensi dell'art. 1, comma 67, Legge n. 190/2014" — su PDF (`template.ts`: riga aggiuntiva nel blocco legale, presente ANCHE con legal_notice personalizzata perché è dicitura fiscale; solo fatture, non preventivi — verificato con screenshot Chromium) e nell'XML (`lib/sdi/causale.ts` nuovo helper condiviso da route SdI e doc-xml; `xml.ts` ora emette una `<Causale>` per riga — il campo è ripetibile max 200 char). Senza questa riga un condominio committente trattiene il 4% per errore a un forfettario ESENTE. **+8 test** (4 PDF, 4 XML).
- **[GAP dal collaudo] Acconto sbagliato = inchiodato**: "Segna come non pagata" esiste SOLO sulle fatture saldate (accepted) → su una fattura ancora da incassare con un acconto errato non c'era NESSUNA correzione. Ora: link "Acconto sbagliato? Azzera e reinserisci" sotto "Resta da incassare" (`CorreggiIncassoButton`, con conferma) → `PATCH {reset_payment:true}` sulla status route (nuovo ramo: solo payment_status 'partial', 409 su saldate con rimando a "Segna non pagata", lock ottimistico su importo, voce `payment_reset` con importo in cronologia, stato INVARIATO, nessuna guardia SdI — il pagamento è gestionale). **+3 test** (357/357 verdi).
- **DOMANDA APERTA a Eli (risposta data in chat, decisione sua)**: badge "SdI" sulle fatture trasmesse in lista + ricerca — raccomandato il badge (non una sezione separata).
- tsc+build+**357/357** verdi · scan spazi pulito.

### ✅ 27 lug (3) — RICERCA APPROFONDITA RITENUTA D'ACCONTO consegnata in chat (richiesta Eli "prima di implementarla")
Report completo consegnato a Eli in chat, NESSUN codice toccato (implementazione = blocco separato dopo il suo ok + conferma commercialista). Punti chiave della ricerca (fonti nel report in chat):
- **Meccanismo**: chi PAGA (sostituto d'imposta) trattiene la % e la versa con F24 (codice 1040) entro il 16 del mese dopo; in fattura si mostra "Ritenuta −X → Netto a pagare Y", ma imponibile/IVA/totale documento NON cambiano. Rilascia la CU al fornitore.
- **I 3 casi per gli utenti Carta Canta**: ① **forfettari = ESENTI** (caso più comune): niente ritenuta MAI, serve la dicitura comma 67 L.190/2014 in fattura — costo quasi zero, massimo valore; ② **condominio committente = 4%** su TUTTI (anche ditte/imprese, art. 25-ter DPR 600/73), causale pagamento **"W"** — IL caso concreto per artigiani; ⚠️ NON confondere con l'8% sui bonifici parlanti (la trattiene la BANCA, non va in fattura); se il lavoro è pagato con bonifico parlante per detrazioni, il 4% NON si applica (prevalenza 8%); ③ **professionisti ordinari = 20%** (30% non residenti), causale **"A"**.
- **Base di calcolo**: compenso + rivalsa INPS 4% Gestione Separata (SOGGETTA a ritenuta); ESCLUSI: cassa previdenziale privata (Inarcassa ecc.), spese anticipate in nome e per conto documentate, bollo addebitato al cliente. IVA mai nella base.
- **XML FatturaPA**: blocco `DatiRitenuta` (TipoRitenuta RT01 persone fisiche incl. ditte individuali / RT02 giuridiche, AliquotaRitenuta, ImportoRitenuta, CausalePagamento) + flag `<Ritenuta>SI</Ritenuta>` su OGNI riga soggetta — senza accoppiata → **scarto 00415**. NON esiste campo "netto a pagare" nel tracciato (solo rappresentazione PDF/app).
- **Piano implementazione proposto** (6 fasi, nel report): toggle per-fattura con aliquota+causale (default 4%/W condominio e 20%/A professionista), motore in lib/fiscal/calcoli.ts (test obbligatori B.1.3), PDF con righe ritenuta/netto (screenshot obbligatori regola F), XML DatiRitenuta al posto dell'attuale 422, dicitura automatica comma 67 per forfettari, riepilogo in-app. Da chiedere al commercialista: conferma causale W vs A per artigiano-persona-fisica vs società, testo esatto dicitura forfettari, interazione col bonifico parlante.
- ⚠️ La guardia 422 attuale ("ritenuta non rappresentata nell'XML") resta FINCHÉ il wiring non è completo — mai trasmettere un XML che diverge dal PDF.

### ✅ 27 lug (2) — COLLAUDO A1 (parte 3): annullata/riattivata in cronologia, incassi futuri vietati, cliente all'invio
Decisioni Eli applicate ("sono d'accordo su tutta la linea, procedi") + fix dagli screenshot:
- **Annullata/Riattivata ora in cronologia** (prima nessuna traccia): voci `cancelled`/`reactivated` nel document_log; l'evento "Annullata" derivato dallo STATO si mostra solo per i documenti vecchi senza log (dedupe). ⚠️ `withLog` reso CUMULATIVO: due update in sequenza nella stessa richiesta (cambio stato → azzeramento incassi) partivano dalla stessa lettura e il secondo cancellava la voce del primo.
- **Incassi con data FUTURA vietati** (422 + `max` sul campo data): un incasso è denaro già arrivato — chiude l'ambiguità "acconto del 30 lug registrato il 27, che succede se annullo?".
- **Cliente obbligatorio all'INVIO del preventivo** (bozze libere): blocco in `registerManualSendAction` (il varco era WhatsApp/copia link) + badge ambra "Senza cliente" sulle bozze in lista; sopralluoghi con "— Senza cliente" nel titolo riga (nessun vincolo al salvataggio: appunti in cantiere).
- **Card scadenza in Home con titolo** "Preventivo in scadenza" (era l'unica senza).
- **⚠️ CONTAINER RESET durante il lavoro**: node_modules sparita E modifiche non committate perse — riapplicate tutte e 6 e verificate coi test (la lezione: committare spesso).
- **DECISIONE Eli (29 lug)**: Supabase Pro (backup) si attiva POCO PRIMA del lancio sul mercato, non ora — annotato in PRIMA_DEL_LANCIO.md §1 come PRIMO passo del giorno del lancio (fino ad allora: nessun utente reale).
- **PROMEMORIA Eli**: restano da collaudare "Fatti trovare dai clienti" e il link/area commercialista (/studio). Ritenuta d'acconto: Eli la vuole — ricerca fatta (20%/4%, RT01-RT02, esenzione forfettari comma 67), dettagli mancanti (causale pagamento, base imponibile con cassa/rivalsa) da approfondire PRIMA di implementare; wiring completo = prossimo blocco di lavoro.
- tsc+build+**346/346** verdi · scan spazi pulito.

### ✅ 27 lug — COLLAUDO ELI A1 (parte 2): incassi con orari veri, residuo in vista, copy SdI + ricerca ritenuta
Feedback dagli screenshot del collaudo, tutti chiusi (PR #192-#197):
- **Avviso "non sostituisce la fattura elettronica"**: via da bozze e annullate; ora vive DENTRO la card Fattura elettronica (SDI) accanto al bottone che trasmette (banner a fondo pagina solo come ripiego con flag SdI spento). Stati SdI riscritti: **"Consegnata al cassetto fiscale"** (scelta Eli) e "Emessa, da ritirare nel cassetto fiscale" per la mancata consegna.
- **Tab Impostazioni di nuovo con spazi uguali** (regressione di F13/22 lug): il TabsTrigger base di shadcn ha `flex-1` e l'override valeva solo su desktop → celle uguali e vuoti visivi diversi. Misurato con Chromium: prima 0/0/0/0, ora 18/18/18/18. ⚠️ REGOLA: sui TabsTrigger mobile serve `flex-none` SENZA prefisso lg:.
- **Cronologia incassi rifinita**: orario VERO del click (il T12:00 resta solo per incassi retrodatati — prima tutto alle "14:00" e fuori sequenza); "Incasso azzerato" sempre con l'importo (bug: leggevo solo il caso partial → la riattivazione di una fattura SALDATA lo scriveva muto) e MAI a vuoto (annulla+riattiva senza soldi registrati riempiva la cronologia); **"Pagata — fattura saldata" solo con status accepted** (con un acconto parziale paid_at è pieno ma lo stato è sent → compariva "Pagata" accanto all'acconto).
- **Residuo acconto in vista**: dialog "Segna pagata" → "Ricevuto finora X su Y — mancano Z"; riepilogo fattura → righe "Acconto già ricevuto" / "Resta da incassare" sempre visibili. Riga **"Marca da bollo"** nel riepilogo in-app (il totale saltava 100→102 senza spiegazione; in bozza c'era già via FiscalSummary — soglia 77,47 €).
- **Nota di credito**: copy onesta (cos'è + "Carta Canta oggi non la prepara"); NON si spiega una procedura che l'app non ha (B.0). Eli chiede se possiamo gestirla noi → risposta: fattibile (fase TD04 già progettata), gate = SdI live + risposta commercialista su numerazione.
- **DOMANDE APERTE a Eli**: cliente obbligatorio anche sul preventivo? (raccomandazione data: obbligo all'INVIO, bozze libere + badge "Senza cliente" in lista — oggi si può inviare via WhatsApp/copia link SENZA cliente, verificato su registerManualSendAction); ritenuta d'acconto → ricerca consegnata in chat (20% professionisti / 4% condomini via DatiRitenuta RT01-RT02; forfettari ESENTI con dicitura comma 67 — decisione con commercialista).
- tsc+build+**343/343** verdi.

### ✅ 26 lug (4) — RILETTURA DI TUTTA LA SESSIONE (Eli "controlla tutto quello che hai fatto"): 2 fix
- **[ALTA] La ripresa Stripe poggiava su un confronto fragile.** Il lock che avevo aggiunto poche ore prima usava l'**uguaglianza** su `started_at`. Verificato su PG16: PostgREST rende i timestamp con i **microsecondi** (`.665306`), JavaScript arriva ai millisecondi → sarebbe bastato un `new Date()` di troppo perché l'uguaglianza non matchasse **mai più**, e ogni prenotazione appesa sarebbe stata scambiata per doppione = **evento perso**. Il rimedio contro la doppia elaborazione sarebbe diventato la causa della perdita. Ora la ripresa **ri-afferma la staleness** con `<` sul taglio dei 5 minuti: stessa protezione (misurata su PG16: 1 riga / 0 righe), senza dipendere dal round-trip esatto del timestamp.
- **[MEDIA] Export che producevano un file VUOTO senza dirlo.** Con `fetchAllRows` la risposta in errore è `{data: null}` → CSV preventivi/fatture, export GDPR, registro fatture e bilancio (anche dall'area **/studio** del commercialista) consegnavano un file vuoto o con le sole intestazioni, che sembra legittimo. Ora rispondono con un messaggio in italiano ("…non è stato creato per non dartelo incompleto"). Nei due builder fiscali il fallback senza colonne 038 scatta **solo** se le colonne mancano davvero (`isMissingColumnError`), non su un errore qualsiasi — prima un blip di rete produceva un registro fiscale incompleto in silenzio.
- **Verificato che i pre-check XML non bloccano dati legittimi** (il rischio speculare: sono guardie che *impediscono* il download): CF normale, CF con omocodia, CF femminile, CF di ente, codice destinatario valido/estero → tutti passano; spazzatura e troncati → bloccati.
- tsc+build+**338/338** verdi · scan spazi pulito.

### ✅ 26 lug (3) — CANTIERE SENZA CAMPO + altre 6 troncature silenziose: 11 fix + 4 test
Richiesta Eli "altre verifiche utili per evitare problemi agli artigiani". Due angoli nuovi.
- **[ALTA] Salvataggio bloccato per sempre quando manca la linea**: le Server Action, senza rete, **LANCIANO** (non ritornano `{error}`). In `PreventivoForm` le due chiamate a `saveDraftAction` non avevano try/catch → l'eccezione saltava il `setSaving(false)` finale e il bottone restava su **"Salvataggio…" all'infinito**, senza dire nulla. È lo scenario più probabile di tutti: preventivo scritto a casa del cliente, in cantonina o in cantina, con poco campo. Ora un messaggio onesto che dice che **i dati sono ancora lì** e di non chiudere la pagina.
- **Stessa rete di sicurezza sui 5 punti dove si perde ROBA SCRITTA**: sopralluogo (gli appunti presi sul posto), lavoro, rapportino, spesa, voce di catalogo. Lì l'eccezione dentro `startTransition` faceva comparire la **pagina di errore** e il testo spariva.
- **Nuovo `lib/net-error.ts`** con la copy condivisa (**4 test**). Il test ha beccato una mia sgrammaticatura ("la spesa non è stato salvato") → frase rifatta in forma impersonale ("non è stato possibile salvare …"), che regge con soggetti maschili e femminili; un test la congela.
- **✅ PATTERN CHIUSO SU TUTTA L'APP (26 lug, decisione Eli "non lascerei nulla a dopo, deve essere affidabile")**: tutte e **64** le chiamate a Server Action dai client component passano ora da **`lib/run-action.ts`** — `runAction(() => azione(), 'salvare il preventivo')` trasforma il lancio in un normale `{ error }`, cioè la forma che ogni call site già gestisce (una riga per punto, nessun cambio di flusso). Variante **`runActionVoid`** per le action che fanno `redirect()` (checkout Stripe, apertura template): TypeScript le vede come `Promise<never>`, quindi `.error` non era leggibile. **⚠️ Gli errori di CONTROLLO di Next (`digest` che inizia per `NEXT_`) vengono RILANCIATI** — senza quello il checkout Stripe non navigherebbe più. **10 punti che ignoravano del tutto il risultato** (template predefinito, preset, abbonamento) ora mostrano un toast invece di non fare niente in silenzio. **+9 test** su `runAction` (successo · errore applicativo che passa intatto · guasto di rete · redirect rilanciato · notFound rilanciato · digest non-Next gestito). Scan finale: **0 chiamate scoperte**.
- ⚠️ **REGOLA**: ogni nuova chiamata a una Server Action da un client component va avvolta in `runAction`/`runActionVoid`. Lo scan dell'handoff la fa rispettare.
- **AUTO-REVIEW del codemod (26 lug, richiesta Eli "ricontrolla che non ci siano bug"): 4 correzioni al mio stesso lavoro.**
  ① **[REGRESSIONE mia] `NotificationList` non si autoriparava più**: quel punto distingueva DUE guasti — offline (riprova) e **app rimasta su una build vecchia** (Server Action che non esiste più → ricarica automatica, fix del 18 lug per il bug di Eli "non succede nulla"). `runAction` li appiattiva entrambi in un toast e il reload non sarebbe più scattato. Riportata la chiamata grezza dentro il suo try/catch, con commento che la marca come **eccezione voluta** alla regola.
  ② **[MEDIA, pre-esistente] Foto del lavoro: occhio e etichetta mentivano senza rete.** `void updateWorkPhotoAction(...).then(...)` — se la promise viene RIFIUTATA il `.then` non parte: niente rollback e niente avviso, con l'icona che mostra lo stato nuovo e il DB fermo a quello vecchio. È esattamente il caso che un commento nel file segnalava come "GRAVE" (l'artigiano crede che il cliente veda una foto che invece non vede). Ora passano da `runAction`.
  ③ **`ImportWizard`: try/catch diventato codice morto** e, peggio, potenziale trappola — avrebbe inghiottito un redirect rilanciato di proposito. Rimosso.
  ④ `preloadClientsAction().then()` e il mark-read singolo: aggiunto `.catch` (fire-and-forget voluti, ma senza rete lasciavano una unhandled rejection = rumore in Sentry).
  Verificato inoltre: **tutti** i call site leggono `.error` prima di ogni altro campo (controllo automatico sul primo uso della variabile); nessun `catch` esterno inghiotte più i `NEXT_*`; `lib/run-action.ts` non è importato da codice server.
- **TERZO GIRO di controllo (26 lug, Eli "ricontrolla bene che non ci siano altri danni"): 1 problema di sostanza + 4 verifiche pulite.**
  ⑤ **[ALTA] `runAction` nascondeva i bug VERI del server e li raccontava come problemi di linea.** Lo stesso lancio arriva sia dalla rete assente sia da un'eccezione lato server: prima del codemod finiva all'error boundary e quindi **a Sentry**; dopo, la intercettavamo noi e restava solo un `console.warn` → i bug del server sarebbero diventati **invisibili**, e all'artigiano si diceva "la connessione sembra assente o instabile" anche quando la connessione era perfetta. Ora: `report()` manda l'eccezione a **Sentry** (import dinamico, no-op se il DSN manca; **non** segnala quando `navigator.onLine === false`, che è la condizione attesa e non un bug) e la copy online non accusa più la rete con certezza — "**Può essere** la linea che va e viene… Se continua a non funzionare, scrivici da Aiuto". **+2 test**.
  **Verificati PULITI** (nessuna modifica): nessun call site usa il destructuring (che il controllo precedente non copriva); nessun import duplicato o infilato dentro un import multiriga; **tutti e 27 i `fetch` dai client component hanno già try/catch** con messaggio e spegnimento del loading (i 4 che sembravano scoperti avevano il `catch` più in basso); nessun doppio toast; le 48 frasi di `runAction` lette una per una nella loro forma finale (l'unica anomalia — "non è stato possibile read" — era un artefatto del mio grep, non del codice).
- **[ALTA] Altre 6 query esposte alla troncatura silenziosa** (stessa classe del giro precedente): export CSV preventivi e fatture (l'artigiano apre il file convinto di avere tutto), export GDPR "Scarica i tuoi dati" (clienti, documenti, spese) e le **3 query del cron notturno** — queste ultime girano su TUTTI i workspace insieme, quindi sono le prime a toccare il tetto man mano che gli iscritti crescono: una troncatura lì significa artigiani che **non ricevono il promemoria di scadenza** e perdono un lavoro. Tutte paginate con `fetchAllRows`.
- tsc+build+**338/338** verdi · scan spazi pulito.

### ✅ 26 lug (2) — PUNTI PIÙ CRITICI (soldi Stripe + numeri del Bilancio): 2 fix + 7 test
Richiesta Eli "ricontrolla i punti che potrebbero essere più critici". Scelti i due dove un errore costa davvero: i soldi di Stripe e le cifre fiscali.
- **[ALTA] Doppia elaborazione dell'evento Stripe sulla ripresa — TROVATA SIMULANDO LA 061 SU PG16 REALE** (i test coi finti non potevano vederla): due retry che trovano la STESSA prenotazione scaduta vincevano **entrambi** la ripresa (`UPDATE … WHERE status <> 'done'` → 1 riga a testa, misurato) → evento elaborato due volte in parallelo, seconda email "Piano attivato" e stato riscritto. Fix: **lock ottimistico su `started_at`** (la ripresa è condizionata al valore appena letto) → il secondo trova 0 righe e risponde "doppione". Verificato su PG16: con il lock 1 riga / 0 righe, senza 1 riga / 1 riga. **+1 test (10 sul webhook).**
- **[ALTA] Cifre fiscali troncate IN SILENZIO**: le query delle entrate (pagina Bilancio) e dei due export per il commercialista (**registro fatture** e **bilancio CSV**) scaricavano TUTTO lo storico senza finestra né paginazione. Sopra il tetto righe dell'API (1.000 di default su Supabase) la risposta arriva **troncata senza errore**: registro fiscale e bilancio incompleti, e nessuno se ne accorge. Fix: nuovo helper **`lib/supabase/fetch-all.ts`** (paginazione con ordine stabile, mai dati parziali spacciati per completi — **6 test**) sui due export; finestra temporale su `updated_at` per la pagina Bilancio (l'incasso è un UPDATE → `paid_at ≤ updated_at`, trigger `trg_documents_updated_at` verificato: nessuna riga della finestra può sfuggire; stesso ragionamento già applicato alla Home il 14 lug).
- **Verificata CORRETTA la matematica delle entrate**: `.or()` non duplica le righe che matchano entrambi i rami (acconto + saldo), l'acconto conta una volta sola, le annullate sono escluse (l'azzeramento a `'unpaid'` del 25 lug regge), fallback `paid_amount ?? total` sensato.
- **DEFERRED confermato**: l'acconto "migra" di mese quando si incassa il saldo (`paid_at` sovrascritto) — serve la tabella storia incassi, già annotato.
- tsc+build+**323/323** verdi.

### ✅ 26 lug — CONTROLLO APPROFONDITO post-migration 061: 2 fix veri (route fatture aperta ai preventivi, cestino) + 4 test
Richiesta Eli "fai un altro controllo approfondito". Metodo: caccia alle CLASSI di bug già confermate in questo repo, non rilettura generica.
- **[ALTA] `PATCH /api/preventivi/[id]/status` accettava anche le FATTURE** (nessun filtro `doc_type`, come il buco accept/decline del 25 lug): da lì una fattura poteva essere **annullata saltando la guardia SdI** ("fattura trasmessa → serve una nota di credito"), segnata "Pagata" **senza registrare l'incasso** (accepted senza paid_amount/paid_at → sparita dal Bilancio), o riattivata su 'sent' invece che in bozza. L'interfaccia usa già `/api/fatture/[id]/status` (verificati tutti i call site), quindi il filtro non toglie niente a nessuno. **+4 test** `tests/unit/preventivi/status-route.test.ts` (312→**316**).
- **Verificate PULITE le altre route che mutano documenti**: sdi (route/esito/reclaim), fatture/status, converti-fattura, p/[token] accept/decline/review, send-email — tutte già filtrate per `doc_type`. Era l'unica.
- **[MEDIA] Numero "già in uso" senza spiegazione**: l'indice unico 059 copre **anche i documenti nel cestino** (verificato su PG16), ma il controllo applicativo li ignorava → l'artigiano scriveva 003/2026 a mano, non vedeva nessun documento con quel numero e si beccava un rifiuto incomprensibile. Ora il messaggio dice che è nel cestino e cosa fare.
- **[BASSA] Ramo morto nel cestino**: la pagina mostrava "numero riassegnato" per un `numberConflict` che il server non produceva mai (ripristino → "Errore nel ripristino" senza uscita). Ora il ramo esiste davvero (ripristino liberando il numero, **stato invariato**: forzare la bozza distruggerebbe un'accettazione firmata). Verificato su PG16 che con la 059 il conflitto non è nemmeno raggiungibile → resta come rete di sicurezza, non come rimedio a un caso reale.
- **FALSO ALLARME verificato**: conversione preventivo→fattura con più proposte e nessuna scelta — la guardia c'è già ed è fail-closed (route converti-fattura), non serviva nulla.
- Verificato su PG16 reale: cestino che occupa il numero ✓, numeri NULL che convivono ✓, preventivo e fattura con lo stesso numero ✓ (fix 059), cron `expire_overdue_documents` che non tocca le fatture pagate ✓.
- tsc+build+**316/316** verdi · scan spazi (build e sorgente) pulito.

### ✅ 25 lug notte (8) — TERZA rilettura della deduplica: 2 ultimi percorsi di PERDITA EVENTI chiusi + doc-xml riallineato
Richiesta Eli "controlla ancora che non ci siano problemi" (dopo la 061). Rilettura del mio codice a mente fredda:
- **[ALTA] Errore di LETTURA del registro scambiato per doppione**: sul ramo 23505 la `select` dello stato veniva letta con `{ data }` senza guardare `error` — un blip di rete → `prev` undefined → si finiva sul reclaim, e se falliva anche quello si rispondeva **200 `duplicate`** = Stripe smette di ritentare = **evento perso per sempre**. Ora la lettura in errore risponde **409** (Stripe ritenta).
- **[ALTA] Stessa classe sulla ripresa della prenotazione**: `!claimed` non distingueva "0 righe" (doppione vero, un'altra esecuzione ha finito) da "errore di scrittura" → il secondo caso rispondeva 200 e perdeva l'evento. Ora l'errore è separato dalle 0 righe → 409. **+2 test (9 sul webhook, 312 in totale).**
- **[MEDIA] `doc-xml` riallineato ai pre-check della trasmissione** (era il finding F6 rimasto deferred): l'helper prometteva "le STESSE guardie della route SdI", ma i controlli nuovi del 25 lug lo avevano scavalcato → il commercialista poteva ricevere un XML con P.IVA/CF sbagliati o con **codice destinatario invalido silenziosamente diventato `0000000`**. Ora checksum P.IVA (cedente E cliente), CF con omocodia e codice destinatario bloccano il download con un messaggio in italiano.
- ⚠️ **Nota operativa**: con la 060 applicata ma **non** la 061, l'INSERT fallisce con `PGRST204` (colonna `status` assente) → si prosegue **senza deduplica** (comportamento pre-060: nessuna perdita di eventi, al massimo una seconda email "Piano attivato" su un retry). Degradazione voluta e sicura, si auto-ripara appena la 061 è applicata.
- tsc+build+**312/312** verdi.

### ✅ 25 lug notte (7) — REVIEW ESTERNA sui fix appena scritti: 4 fix + ⚠️ migration 061 (deduplica a DUE FASI)
Un revisore fresco sul commit precedente ha smontato il MIO primo rimedio: **il `delete` nel catch non bastava**.
- **[ALTA] Deduplica Stripe che perdeva eventi anche dopo il primo fix**: il cleanup copre solo gli errori GESTITI — un **timeout della lambda / OOM / kill** lascia la riga orfana e il retry di Stripe viene scambiato per doppione → evento perso per sempre. Aggravante: il webhook è l'**UNICA** via che scrive il piano (nessuna riconciliazione da `success_url`), quindi "paga → resta Free per sempre" era un percorso reale. **⚠️ migration 061 + pattern a DUE FASI**: INSERT `status='processing'` (prenotazione) → `'done'` SOLO a elaborazione completata; retry su `done` = doppione (skip), su `processing` **vecchio >5 min** = lambda morta → si riprende, su `processing` recente = 409 (Stripe ritenta, niente lavoro in parallelo). +2 test (7 in totale sul webhook).
- **[MEDIA] `try/catch` attorno al delete = CODICE MORTO**: supabase-js non lancia, ritorna `{error}` → il log "CRITICO" non sarebbe mai comparso proprio nel caso peggiore. Ora l'errore è letto e loggato.
- **[MEDIA] Regex CF che RIFIUTAVA i codici fiscali con OMOCODIA** (cifre sostituite da L M N P Q R S T U V): CF validissimi, e il ramo scatta proprio sui PRIVATI = il caso più comune per un artigiano → fattura bloccata con 422 su un dato corretto. Fix con classe `[0-9LMNPQRSTUV]` + ramo enti separato (verificato su CF normale, omocodico, ente, spazzatura).
- **[BASSA→MEDIA] Checksum P.IVA esteso al CEDENTE** (la propria, presente su OGNI fattura: se sbagliata lo scarto è sistematico) — prima solo `\d{11}`.
- **Confermato CORRETTO dal revisore**: algoritmo P.IVA (testato su 8 P.IVA reali pubbliche + 4 non valide, indice 0-based giusto), `stampStripeEvent` chiamato solo dopo update riusciti, primo evento e eventi con lo stesso `created` non bloccati.
- **DEFERRED (annotati)**: guardia d'ordine con `>` stretto sugli eventi con lo STESSO secondo (updated+deleted simultanei — il caso lascia `stripe_subscription_id` di una sub morta su un workspace free: cosmetico, la pagina abbonamento resta corretta); `checkout.session.completed` senza watermark; `purge_old_stripe_events` senza cron che la chiami; PGRST205 aggiunto ai codici tollerati; CF non validato quando c'è anche la P.IVA (F3); `doc-xml` senza i nuovi pre-check (F6).
- tsc+build+**310/310** verdi · migration 061 validata su PG16 (idempotente, 4 casi, upgrade dalla 060 con righe esistenti → restano 'done').

### ✅ 25 lug notte (6) — AUTO-REVIEW dei fix di stanotte: 2 DIFETTI MIEI trovati e corretti + 5 test
Richiesta Eli "controlla ancora". Rilettura critica del MIO codice appena scritto (poi confermata da un revisore fresco):
- **[ALTA — difetto introdotto da me poche ore prima] Deduplica Stripe che PERDEVA gli eventi**: l'event.id veniva registrato PRIMA di elaborare; se l'handler falliva (500 → Stripe ritenta), il retry trovava la riga e rispondeva "duplicato" → **l'evento non veniva elaborato MAI** (un utente che paga resta su Free per sempre). Il rimedio era peggiore del male. Fix: flag `dedupRegistered` + DELETE della riga nel catch prima del 500 → il retry rielabora davvero. Test dedicato che lo congela.
- **[MEDIA] Codice destinatario/PEC digitati male scartati in SILENZIO**: il parse del body accettava solo valori validi (`if regex → bodyDest`), quindi un "ABC12" digitato nel dialog spariva e si usava il valore VECCHIO della rubrica (o `0000000`) — l'utente credeva di averlo cambiato. Il pre-check aggiunto prima copriva solo il valore della rubrica, non quello digitato. Fix: `rawDestInvalid`/`rawPecInvalid` → 422 con il valore citato.
- **Verificato di persona l'algoritmo P.IVA** con valori reali pubblici (P.IVA Stellantis `00743110157` → valida; stessa con ultima cifra cambiata → non valida) oltre ai 6 test: nessun rischio di bloccare fatture legittime.
- **+5 test** `tests/unit/stripe/webhook-dedup.test.ts` (303→**308**): evento nuovo elaborato · retry 23505 ignorato senza rielaborare · **fallimento → riga di dedup rimossa** · pre-060 (42P01) comportamento invariato · firma non valida senza accesso al DB.

### ✅ 25 lug notte (5) — RICERCA WEB punti deboli + 2 DOC per Eli + 3 fix dai risultati (✅ migration 060 applicata)
Richiesta Eli: "quali sono i punti deboli di queste app/processi" + "inserisci i test che devo fare in un md" + "fai tu i controlli che puoi".
- **📄 `RISCHI_E_PUNTI_DEBOLI.md`** (nuovo): incrocia la ricerca web (scarti SdI più frequenti 00404/00305, pitfall dei software di fatturazione, rischi operativi dei SaaS a founder singolo) con lo stato REALE del repo. 27 punti classificati ✅ coperto / ⚠️ residuo / ❌ da fare / 🔵 decisione, con priorità.
- **📄 `TEST_DA_FARE_ELI.md`** (nuovo): checklist operativa dei test che può fare solo Eli — A) 22 collaudi app dal telefono (ciclo fattura, scaduta, prove firmate, accesso, documenti cliente); B) infrastruttura (⚠️ **backup + PROVA DI RESTORE**, UptimeRobot, mail-tester ≥9/10); C) 9 test SdI sandbox; D) 4 test Stripe post-060; E) domande per commercialista/avvocato.
- **✅ migration 060 APPLICATA da Eli il 25 lug** (validata su PG16, 4 casi + idempotenza): tabella `stripe_webhook_events` (PK = event.id) + `workspaces.stripe_event_at` + `purge_old_stripe_events()`.
- **[ALTA] Idempotenza webhook Stripe**: Stripe RITENTA gli eventi e NON garantisce l'ordine — un retry di `checkout.session.completed` rimandava l'email "Piano attivato", e un `subscription.updated` consegnato DOPO un `deleted` RIATTIVAVA un piano cancellato. Fix: INSERT dell'event.id come lock (23505 → 200 "duplicate"), guardia `isStaleStripeEvent` + `stampStripeEvent` sui due handler subscription. Tollerante pre-060 (42P01/colonna assente → comportamento invariato).
- **[MEDIA] Pre-check P.IVA/CF/codice destinatario prima della trasmissione SdI** (dalla ricerca: la P.IVA errata è tra le PRIME cause di scarto): nuovo `lib/fiscal/piva.ts` con checksum ministeriale (**6 test**), CF con regex, e codice destinatario compilato-ma-invalido che prima diventava `'0000000'` IN SILENZIO (fattura non recapitata al canale del cliente). Ora tutti e tre bloccano PRIMA di bruciare una trasmissione e una quota.
- **[MEDIA] Copy scartata con il termine dei 5 giorni**: "Correggi il dato segnalato e reinviala: va fatto entro 5 giorni, tenendo lo stesso numero e la stessa data" (prima nessun accenno alla scadenza).
- tsc+build+**310/310** verdi · migration 060 validata su PG16 reale.

### ✅ 25 lug notte (4) — 9 TEST sulla catena anti doppia-trasmissione del reclaim SdI (richiesta Eli "un altro test sui passaggi fattura")
`tests/unit/fatture/sdi-reclaim-route.test.ts` (288→**297**): gate SDI_ENABLED 403 · non-inviata 409 · traccia d'invio 409 · marker "tentativo avviato" 409 con invito al supporto · finestra 10 min 409 · updated_at assente fail-closed · sblocco vero con verifica del reset CONDIZIONATO (eq/is/lt su provider/sent/updated) · race 0 righe 409 · 404 cross-workspace. Pattern import dinamico + stubEnv (env letta a livello modulo). Nota per Eli: i banner rossi "non riuscita" nella chat mobile = primi tentativi di comandi poi corretti nello stesso giro (tsc con errori → fix → verde; script PDF con struttura dati sbagliata → fix → generato) — nessun errore residuo nell'app.

### ✅ 25 lug notte (3) — TERZO GIRO fatture: SUPERFICI DI OUTPUT + collaudo PG16 + test regressione (richiesta Eli "qualsiasi casistica")
Metodo diverso dai giri precedenti: ESECUZIONE reale, non solo lettura. ① **Collaudato su PG16 reale il trigger 057 vs cestino**: "Elimina definitivamente" di un documento ACCETTATO funziona (nel CASCADE il padre è già eliminato → v_status NULL → trigger passa), la manomissione diretta delle voci resta bloccata — chiuso il punto "da collaudare in staging". ② **8 test di regressione** su `tests/unit/fatture/status-route.test.ts` (280→288): reset 'unpaid', accepted→sent/draft, guardia SdI, lock ottimistici, reset scartata. ③ 1 agent sulle superfici di OUTPUT (PDF/pubblica/email/export/KPI/timeline), findings verificati e fixati:
- **[ALTA] PDF preset Tecnico: "Imponibile" includeva la marca da bollo** per i forfettari (502 invece di 500, bollo contato due volte a video, diverso dal registro) → `afterDisc` — VERIFICATO con screenshot Chromium su HTML reale.
- **[ALTA] Fattura scaduta: IBAN/QR "Come pagare" SPARIVANO** proprio quando il cliente entra per saldare → showPayment include 'expired'.
- **[ALTA] Sollecito manuale VIETATO sulle fatture scadute** ("solo le fatture in attesa di pagamento…" — l'opposto della realtà) → 'expired' sollecitabile.
- **[ALTA] Reinvio di una fattura PAGATA spostava expires_at** (+30gg su fattura incassata) → keepExpiry su accepted; avviso "scadenza riparte da oggi" ora anche nel dialog fatture.
- **[ALTA] "Totale da incassare" (scadenze fatture) sommava i totali PIENI** ignorando gli acconti → residuo.
- **[MEDIE] PDF**: timbro diagonale "ANNULLATA" sulle fatture annullate (prima identiche a una valida dal link pubblico — screenshot ✓); label bold "Totale da pagare"→"Totale fattura" quando c'è un acconto (contraddiceva il box "Saldo da pagare" — screenshot ✓). **[MEDIE] Pubblica/email**: data card mobile = created_at per fatture (= PDF, prima due date sullo stesso schermo); "IVA 22%" bugiarda su multi-aliquota → prop multiVat ("IVA" e basta); sconto card con round+clamp; "Fattura generata" (concordanza); badge email = RESIDUO con acconto; copy dialog "La fattura non ha voci". **[MEDIE] Export CSV fatture**: formato ITALIANO (BOM + ';' + virgola decimale — prima Excel corrompeva accenti e importi), +cognome +colonna Incassato. **[MEDIE] Timeline**: "Pagata" con la DATA DI INCASSO (paid_at) non l'ora del click; fmtDatetime con timeZone Roma.
- **FALSO ALLARME**: template_snapshot "non congelato all'invio" — è salvato ALLA CREAZIONE (documents.ts:451/1965), i cambi template non toccano i documenti esistenti.
- **DEFERRED (decisioni, annotati)**: ⚠️ **IVA calcolata sui totali riga PRE-sconto documento** (lo sconto globale non riduce l'imponibile IVA — motore fiscale INTOCCABILE, questione da COMMERCIALISTA, propagata anche al registro); dashboard "Fatturato" (accepted_at/total) vs Bilancio (paid_at/paid_amount) = due grandezze con lo stesso nome (decisione naming/valore); acconto che "migra" di mese al saldo (serve tabella storia incassi); scadenza/termini di pagamento assenti dai PDF non-tecnici (design PDF con screenshot); quietanza email dedicata; validity_days vs payment_terms scollegati nel form; /studio KPI senza filtro periodo.

### ✅ 25 lug notte (2) — VERIFICA MIRATA fatture/movimenti/SdI (richiesta Eli) — 2 agent (matrice stati + SdI end-to-end), ~15 FIX
Verdetto SdI del revisore: **"nessun percorso di crash o concorrenza produce una doppia trasmissione — il pezzo più solido del repo"**; matrice crash claim→marker→send→save→snapshot mappata per intero. Fix applicati (findings verificati di persona):
- **[ALTA] accept/decline pubblici SENZA filtro doc_type**: chiunque col link di una FATTURA poteva segnarla "Pagata" (entrata fantasma nel Bilancio, campi firma-preventivo scritti su una fattura, doc read-only) o "Annullata" via POST diretta → `.eq('doc_type','preventivo')` su entrambe le route.
- **[ALTA] "Trasmessa, NON reinviarla" MAI mostrato**: la risposta 200 col campo `error` finiva nel ramo successo del client → toast "Fattura inviata ✓" e avviso critico scartato → risposta `{success, warning}` + ramo dedicato nel client (toast.warning 30s).
- **[ALTA] Fatture trasmesse escluse dal purge automatico del cron** (`.is('sdi_status', null)`): il cestino le teneva 15 giorni e poi hard-delete di documento fiscale + snapshot XML. L'eliminazione MANUALE resta possibile con avviso dedicato nel dialog del cestino ("documento fiscale emesso… parlane col commercialista"). Blocco totale delete = decisione commercialista (annotata).
- **[ALTA] Snapshot XML stantio**: la riattivazione di una scartata azzerava sdi_status ma NON snapshot/provider_id/sent_at → "Scarica XML" dava l'XML del tentativo RIFIUTATO spacciandolo per trasmesso. Fix triplo: reset completo alla riattivazione; claim azzera lo snapshot (rollback lo ripristina); doc-xml usa lo snapshot SOLO con whitelist stati confermati + sent_at.
- **[MEDIA] Webhook precoce non più perso**: esito arrivato PRIMA del salvataggio del provider_id → prima 200 (provider non ritenta, esito perso per sempre) → ora 404 sui soli uuid sconosciuti → il provider RITENTA. **[MEDIA] Quota UI onesta**: `quotaReason` passato alla card — errore transitorio ('unavailable') e kill-switch ('budget_paused') non mostrano più il paywall "hai usato le 8" (falso); pro_cap avvisato PRIMA del dialog. **[MEDIA] Bozza pagata per errore → "Segna non pagata" torna in BOZZA** (prima atterrava su 'sent' = "Inviata" mai inviata, timeline bugiarda). **[MEDIA] Reinvio fattura scaduta via WhatsApp/copia-link ora rimette 'sent'+scadenza** (prop isExpired alla ShareButton — prima solo il canale email). **[MEDIA] Dropdown desktop "Segna non pagata" ORA CON CONFERMA** (+ copy "acconti inclusi" ovunque, anche su Annulla). **[MEDIA] Trasferimento acconto in conversione con retry+log** (fallito = acconto contato DUE volte nel Bilancio). **[MEDIA] recordSdiUse loggato su errore** (trasmissione non conteggiata = falla nei tetti di spesa). **[BASSA] copy esito marker-aware; marker update con rowcount; card "in verifica" senza promessa dei 10 minuti quando c'è il marker (prop sdiAttempted)**.
- **FALSI ALLARMI verificati**: form fatture annullate/pagate GIÀ read-only+inert con auto-save spento (F18 22 lug — l'agent non l'aveva visto); deposit_* copiati dalla 059 = inerti ma innocui (nessun doppio conteggio: PDF/pubblica calcolano l'acconto SOLO da payment_status).
- **DEFERRED (annotati)**: sblocco self-service del caso marker (oggi: "scrivici da Aiuto" + riconciliazione manuale via SQL; mitigazione futura = lookup provider per numero); TOCTOU quota SdI (contatore atomico DB); trigger 057 esteso alle colonne sdi_* (richiede spostare gli update su admin client); data fattura XML = created_at (decisione fiscale, dossier commercialista); secret webhook in query verso il provider; acconti invisibili su DESKTOP (SegnaPagataButton solo mobile); "storia incassi" (l'azzeramento perde la data dell'acconto originale); quota consumata anche dagli scarti (policy provider, copy); mese quota in UTC.

### ✅ 25 lug notte — AUDIT COMPLETO APP con focus FATTURE (richiesta Eli "nessun intoppo assoluto") — 4 agent, ~30 FIX + ⚠️ migration 059
4 revisori adversariali (fatture core · fatture bordi/stati · resto app · robustezza trasversale), ~50 findings, i chiave verificati di persona. **⚠️ migration 059 DA APPLICARE** (validata su PG16 reale, 4 casi): ① indice unico numeri CON doc_type — prima `(workspace_id, doc_number)` della 001: alla prima sovrapposizione (fattura 014/2026 con preventivo 014/2026) la creazione fattura falliva 23505 SENZA USCITA (campo read-only) — bomba a orologeria mai scattata per pura fortuna; ② `convert_preventivo_to_fattura` trasporta bonus_edilizio + deposit_type/value e NON usa più invoice_prefix (doppio formato in serie, perso al primo auto-save); ③ RPC `increment_sent_quota` atomica (il read-modify-write perdeva incrementi concorrenti — fallback pre-059 nel codice).
**FIX FATTURE (i più gravi):**
- **[ALTA] Azzeramento acconto MAI funzionato**: `payment_status: null` viola il NOT NULL della 038 → il reset su annulla/riattiva/riporta-in-bozza falliva in silenzio da sempre (acconto fantasma nel Bilancio su fatture annullate, 422 sulla bozza riattivata). Fix: `'unpaid'` (2 route status).
- **[ALTA] "Segna pagata" era IRREVERSIBILE**: nessuna transizione da accepted → fattura inchiodata in sola lettura (uscita solo cestino). Fix: `accepted→sent` "Segna come non pagata" (nuovo `SegnaNonPagataButton` + dropdown desktop; azzera incasso e accepted_at, con conferma).
- **[ALTA] Fattura SCADUTA = link pubblico morto**: /p/[token] redirectava a "scaduto" anche per le fatture (expires_at = scadenza di PAGAMENTO, non dell'offerta!) proprio quando il cliente deve pagare; e il reinvio email era 422. Fix: redirect solo preventivi (il banner "Fattura scaduta" esisteva già); send-email consente fatture expired/accepted (sollecito/quietanza) e il reinvio di una expired la riporta 'sent' con nuova scadenza.
- **[ALTA] Interruttori fiscali MORTI**: "Ritenuta d'acconto automatica" salvava il flag ma NESSUN calcolo lo leggeva (fattura sbagliata per i professionisti che si fidavano); "Bollo automatico" su OFF ignorato. Fix onesto: card "Automazioni fiscali" NASCOSTA con commento (comportamento reale invariato: bollo sempre applicato ai forfettari >77,47). ⏭️ DECISIONE ELI: implementare il wiring completo ritenuta (form+server+PDF+test) o lasciarla fuori.
- **[ALTA] Duplicare una fattura pescava il numero dalla sequenza PREVENTIVI** → fix: allocateInvoiceNumber per doc_type fattura.
- **[ALTA] Annullata trasmissibile allo SdI**: la card SdI montava anche su rejected → si poteva trasmettere una fattura annullata e auto-intrappolarsi. Fix: card non montata su rejected + 422 server.
- **[ALTA] Cron: email "preventivo in scadenza" mandate ai clienti per le FATTURE** (2 query senza doc_type) → filtro 'preventivo'.
- **[ALTA] Liste tagliate: 100 fatture/50 preventivi col default "Meno recenti" (ASC) = le PIÙ RECENTI invisibili oltre il taglio** → limit 500 (paginazione vera in backlog).
- **[MEDIA] Cliente ora OBBLIGATORIO sulla fattura** (server; prima si creava una fattura senza intestatario con numero consumato). **[MEDIA] Su mobile la bozza fattura non aveva azioni** (Segna pagata/Annulla solo desktop) → blocco mobile esteso a draft + bottone "non pagata" su accepted. **[MEDIA] Riattivare una scartata azzera sdi_status/sdi_error** (prima la bozza restava marchiata senza card né uscita). **[MEDIA] "Ripristina versione inviata" senza guardie**: su accettato falliva PER SEMPRE (trigger 057), su trasmessa divergeva dall'XML → guardie + banner nascosto in quei casi (fatture E preventivi). **[MEDIA] Status route con lock ottimistico** (update condizionato allo stato letto + rowcount → 409 onesto su race, anche sull'acconto: doppio submit non somma più due volte). **[MEDIA] esito route: gate SDI_ENABLED + rate-limit** (mancavano, uniche fra le route SdI). **[MEDIA] quota Free: createAdminClient nel try** (500 nudo → 'unavailable'). **[MEDIA] rollback SdI con retry** (fallito = fattura bloccata col marker per sempre). **[MEDIA] SDI_WEBHOOK_SECRET mancante → console.error forte** (callback registrati con secret vuoto = esiti persi in silenzio). **[MEDIA] send-email: warning onesto se l'update di stato fallisce dopo l'email** (prima "inviato" bugiardo su doc rimasto bozza). **[MEDIA] foto origine cestinata non più mostrate sulla fattura** (banner diceva "non collegata" ma le foto c'erano).
**FIX RESTO APP:** [ALTA] `setLaborMinutesAction` ("Correggi il totale") era l'UNICA azione ore SENZA la guardia rapportino-firmato → ore firmate alterabili; [ALTA] timer acceso al momento della firma = MAI più fermabile (stop bloccato post-firma) → ore/margine gonfiati all'infinito → la firma AZZERA timer_started_at (senza sommare: il cliente firma le ore persistite; cascata 42703 a 3 livelli); [ALTA] eliminare un cliente cancellava nome/indirizzo da preventivi FIRMATI (FK SET NULL, blocco solo fatture) → blocco esteso a documenti con signer_name/accepted_ip e lavori con rapportino firmato (fail-closed); [MEDIA] "Riporta in bozza" ora 409 se il lavoro collegato ha rapportino firmato; [MEDIA] "Segna accettato" manuale BLOCCATO su multi-proposta senza scelta (422 con istruzioni — prima: pagina pubblica che mentiva + conversione bloccata per sempre); [MEDIA] accept pubblico: messaggi PER CAMPO (prima "Nome firma obbligatorio" anche per firma troppo pesante → 5 tentativi ciechi bruciavano il rate-limit del preventivo per un'ora); congelamento foto ignora lavori cestinati; markedAccepted onesto su linkDocument; timeline "Fattura collegata" con la data VERA (prima l'ora di apertura pagina); saveDraft revalida anche /fatture; SendEmailDialog della lista riceve docType (email di fattura non parla più di "preventivo"); conferma su "Annulla fattura"; plusMonths senza overflow di calendario (31 gen +1 mese); foto sopralluogo bloccate con appuntamento a metà; XML in nuova scheda; log voice ripuliti (apiKey length/user id); .order('accepted_at') sulle 3 copie manuali del resolver membership (collaboratori multi-team deterministca).
**DEFERRED (annotati per Eli/prossime sessioni):** wiring completo ritenuta+bollo (decisione); Stripe idempotenza event.id + ordine eventi (tabella nuova); paginazione vera liste; blocco delete/purge fatture TRASMESSE (decisione commercialista — oggi solo avviso cestino per firmati); trigger DB work_photos (già annotato); rpID passkey fisso (ATTENZIONE: cambiarlo invalida le passkey esistenti); flag "frozen" alla WorkPhotosCard (bottoni attivi che falliscono al tocco + upload orfano nel bucket); quota "8 a vita" Free conta anche gli invii da ex-Pro (messaggio impreciso); NEXT_PUBLIC_* inline a build-time (flag cambiato su Vercel senza redeploy = nessun effetto); manodopera nel margine lavoro ma non nelle uscite Bilancio (incoerenza percepita, decisione); autofill comune senza avviso su CAP/città incoerenti; M6 bordi (N fatture collegabili allo stesso preventivo); timeline senza eventi sdi_*; busy route che risponde "libero" su errore DB; ensureConfiguration 4 chiamate HTTP pre-invio (rischio timeout); trigger 057 senza search_path + 1 query/riga (hardening).
tsc+build+280/280 verdi · migration 059 validata su PG16 (idempotente, 4 casi).

### ✅ 25 lug sera (2) — SECONDA ONDATA di fix dalla doppia review (2 agent: sicurezza + flussi/UX)
Findings verificati di persona e fixati (il round 1 manuale è la sezione sotto):
- **[ALTA sicurezza] Reclaim poteva permettere la DOPPIA TRASMISSIONE nel caso "lambda morta DOPO sendInvoice, PRIMA del salvataggio"** (sent_at/provider_id mai scritti → dopo 10 min indistinguibile da un'orfana vera). Fix strutturale: **marker "tentativo avviato"** (`SDI_SEND_ATTEMPT_MARKER` in lib/sdi/types.ts, testo italiano leggibile) scritto in `sdi_error` DOPO il claim e PRIMA di `sendInvoice` (se la scrittura fallisce → rollback claim + "riprova", niente invio senza rete di sicurezza); azzerato dai salvataggi di successo; se il marker resta → il reclaim rifiuta ("non posso escludere che sia partita: scrivici") e la card mostra "Invio in verifica", non l'orfana. Crash PRIMA del marker = davvero nulla trasmesso = sblocco sicuro.
- **[MEDIA] Reinvio di una scartata interrotto = fattura inchiodata per sempre**: il claim non azzerava `sdi_sent_at` (restava la data del 1° invio) → mai "orfana", e l'esito 409 senza provider_id. Fix: il claim azzera anche sent_at (rollback ripristina status/provider/sent_at/error).
- **[MEDIA] Chiave Redis del contatore login SENZA TTL se il singolo `expire` falliva** → captcha eterno per quell'IP (peggio su NAT). Fix: `expire` rinfrescato a OGNI fallimento (idempotente, auto-riparante).
- **[MEDIA] Lockout invisibile con env asimmetriche** (secret presente, site key assente → server esige un captcha che il client non può renderizzare). Fix: il gate esige ENTRAMBE le chiavi (`captchaConfigured`), e `needsCaptcha` è emesso solo se configurato.
- **[UX] Login**: riga esplicativa sopra il widget ("Per sicurezza, dopo alcuni tentativi serve una verifica veloce…") + via d'uscita sotto ("La verifica non compare o non funziona? Reimposta la password oppure riprova tra 15 minuti") → niente più riquadro alieno muto né vicolo cieco con adblock.
- **[UX] SdiCard senza contraddizioni**: nel caso senza conferma d'invio il badge non dice più "Inviata allo SDI" sopra un banner che dice il contrario — 3 stati distinti: "Invio interrotto" (orfana sbloccabile, copy ipotetico + paracadute "se hai letto NON reinviarla, scrivici"), "Invio in verifica" (in volo o ambigua), "Inviata" (confermata). `sdiOrphan` computato SERVER-side (fatture/[id]: senza tracce + senza marker + ferma >10 min) → il bottone appare solo quando lo sblocco può riuscire (prima dava "riprova tra qualche minuto" proprio nei primi 10 min in cui l'utente guarda). Label onesta "Sbloccala per reinviare". "Controlla l'esito" solo con sent_at.
- **[UX] Avviso prova firmata**: frase raddrizzata (soggetto unico, via il doppio "15 giorni"), `docType` nel testo (il dialog è condiviso con le fatture); predicato FES allineato al resto dell'app (`signer_name || accepted_ip`). **+ avviso anche sul punto IRREVERSIBILE**: il dialog "Elimina definitivamente" del /cestino ora avvisa se il documento è firmato (select + signer_name/accepted_ip).
- **[UX] Foto congelate**: copy allineato al gemello ore ("Il rapportino è firmato: queste foto non si possono più modificare."); upload multiplo si FERMA al primo rifiuto dell'action (prima 6 toast identici + 6 file orfani nel bucket).
- **[fix] doc-xml**: snapshot NON restituito nemmeno con 'inviata' senza sent_at (reinvio in volo → lo snapshot è del tentativo precedente). **[fix] pro_cap** copy azionabile (spiega il perché + dove scrivere: Aiuto/supporto@). **[fix] reclaim**: gate SDI_ENABLED + rate-limit 10/min (simmetria con le altre route SdI) + copy senza gergo di stato; reset con `lt(sdi_updated_at, cutoff)` nel WHERE (il `not eq` SQL non matcha i NULL — three-valued logic).
- **DEFERRED (annotati, non fixati)**: trigger DB su work_photos (il congelamento foto è solo app-level: un titolare via PostgREST diretta può ancora alterarle — gemello della 057, ma il trigger ingenuo romperebbe il purge del cestino che usa il client utente → serve design attento, prossima sessione); campi login svuotati a ogni errore (React 19 form reset, pre-esistente); contatore per IP su NAT condiviso (trade-off accettato, mitigato dalla riga esplicativa); widget Turnstile ~300px su viewport ≤360 (pre-esistente, condiviso col signup); bottoni dialog 32px (pre-esistenti ovunque); `select('*')` trascina lo snapshot XML (~10-30KB, solo pagine di dettaglio).

### ✅ 25 lug sera — RI-REVIEW del lavoro di giornata (richiesta Eli "ricontrolla") — 4 FIX + scoperta branch non mergiato
Verifica di persona sull'intero diff master..branch (gli agent erano indisponibili per outage del classificatore — review manuale con grep/read su ogni percorso). **Scoperta principale: i 5 commit del giorno erano SOLO sul branch, NON su master → non in produzione** (il messaggio precedente "deploy in partenza" era impreciso). Fix trovati e applicati:
- **[MEDIA] Token Turnstile monouso riusato sul login**: dopo un tentativo fallito col captcha risolto, il token era già consumato da siteverify → il submit successivo rimandava il token bruciato → "completa la verifica" pur avendola completata. Fix: `key={captchaKey}` sul widget, incrementata a ogni `state.error` → rimonta e nuovo token.
- **[MEDIA] Race sul reclaim SdI**: tra il claim e la risposta del provider (secondi) sent_at/provider_id sono null → un reclaim in quella finestra sbloccherebbe una trasmissione IN CORSO. Fix: guardia temporale server-side — sblocco solo se `sdi_updated_at` più vecchio di 10 minuti (409 "riprova tra qualche minuto" altrimenti).
- **[MEDIA] Tetto Pro non fail-open davvero**: `createAdminClient()` LANCIA se le env mancano ed era fuori dal try → 500 per i Pro invece di lasciar passare. Fix: creazione dentro il try (fail-open totale). (Per i Free il createAdminClient fuori dal try è pre-esistente, non toccato.)
- **[MEDIA] Snapshot XML stantio sulla scartata**: con fattura SCARTATA e dati corretti, "Scarica XML" restituiva lo snapshot del tentativo RIFIUTATO invece dell'XML coi dati correnti (quello utile pre-reinvio). Fix: doc-xml ricostruisce quando `sdi_status='scartata'`; lo snapshot resta la fonte per inviata/consegnata/mancata_consegna.
- **[BASSA] `{' '}` esplicito dopo `</strong>`** nell'avviso prova-firmata (regola B.2, il testo seguente contiene "è").
- **Verificati PULITI**: tutti i percorsi che mutano work_photos passano dalle 3 azioni guardate (insert su doc nuovo, transform, purge/cron/account = cancellazioni consapevoli); signedProof assente nella lista fatture = corretto (le fatture non hanno FES); import verifyTurnstile già presente; AlertTriangle già importato in SdiCard; helper foto tollerante pre-053 (Supabase non lancia, ritorna {error} → false).
- **RISCHIO RESIDUO ACCETTATO (documentato)**: caso A3 estremo — fattura TRASMESSA ma doppio fallimento consecutivo del salvataggio DB → dopo 10 min apparirebbe orfana e sbloccabile (→ possibile doppio invio). Probabilità minuscola (DB scrivibile al claim un attimo prima); il log dice "riconciliazione manuale" e la risposta all'utente dice "NON reinviare". Mitigazione futura possibile: lookup provider per numero fattura.

### ✅ 25 lug — FOTO DEL RAPPORTINO CONGELATE dopo la firma (audit #9 — Eli: "nessuna preferenza" → decido io, coerente con "stare in sicurezza")
Gemello del congelamento ORE (già fatto 24 lug). Il rapportino `/r/[token]` mostra LIVE le `work_photos` del documento collegato al lavoro (`lavori.document_id`) con `visible_to_client=true`; dopo la firma restavano modificabili → contenuto firmato alterabile. Helper `documentHasSignedReport(db, wsId, documentId)` in `lib/actions/sopralluoghi.ts` (query `lavori` con quel `document_id` e `report_signed_at` NON null; tollerante pre-053 → non blocca) applicato a **addWorkPhotoAction / updateWorkPhotoAction / deleteWorkPhotoAction**: aggiunta, cambio visibilità/etichetta, scollegamento ed eliminazione bloccati con messaggio chiaro quando il rapportino è firmato. `WorkPhotosCard`: rollback del detach/elimina ora mostra il MOTIVO specifico (prima messaggio generico). tsc+build+280/280 verdi.

### ✅ 25 lug — 4 SCELTE PRODOTTO di Eli (via AskUserQuestion) IMPLEMENTATE (✅ migration 058 APPLICATA da Eli il 25 lug)
Eli ha scelto "sì" a tutte e 4 le decisioni non-professionali rimaste dall'audit 24 lug:
- **[#5 audit] Tetto di sicurezza spesa Pro sulle trasmissioni SdI (~50€/mese)**: `lib/sdi/quota.ts` — `PRO_MONTHLY_CAP=285` (≈€50 a ~€0,175/invio). NON è un limite di prodotto (le e-fatture Pro restano "illimitate" nella comunicazione) ma una diga anti-abuso: un account Pro compromesso col rate-limit 10/min lascerebbe passare ~€100/h. `getSdiQuota` conta le trasmissioni `plan_at_use='pro'` del mese per workspace; oltre soglia → `reason:'pro_cap'` (403 SENZA paywall, l'utente è già Pro; messaggio "scrivici e lo alziamo"). **Fail-OPEN**: un errore di conteggio non blocca mai un Pro legittimo. L'AI foto/voce hanno GIÀ le loro quote mensili → il tetto copre l'unico servizio Pro non ancora limitato (SdI).
- **[#3 audit] Avviso cancellazione preventivo ACCETTATO+FIRMATO**: `DocumentRowActions` (lista preventivi) mostra un avviso ambra nel dialog di eliminazione quando `signer_name` è valorizzato (= prova FES del cliente). Lista preventivi: aggiunto `signer_name` al select + flag `signedProof` al componente. (DeleteDocumentButton è codice morto; la cancellazione avviene dal menu ⋮ della riga.)
- **[#10 audit] Sblocco fattura SdI ORFANA**: nuova route `POST /api/fatture/[id]/sdi/reclaim` + bottone "Sblocca e riprova" nella SdiCard, mostrato SOLO nel caso orfano (`sdi_status='inviata'` MA `sdi_sent_at` null = crash tra claim e invio, NULLA trasmesso). Anti doppia-trasmissione: sblocca (reset a null) SOLO se `sdi_sent_at` E `sdi_provider_id` sono entrambi null (update condizionato); se c'è traccia di invio → 409 "usa Controlla l'esito". Il "Controlla l'esito ora" ora si nasconde nel caso orfano.
- **[#3 audit — snapshot] Copia ESATTA dell'XML trasmesso (⚠️ migration 058 `documents.sdi_xml_snapshot TEXT`)**: la route SdI salva l'XML inviato (best-effort, tollerante pre-058, DOPO il salvataggio del provider_id → non compromette la trasmissione); `buildInvoiceXmlForDoc` (doc-xml.ts) restituisce lo snapshot tale-e-quale se esiste (fonte di verità), altrimenti ricostruisce come prima. Colonna user-writable via RLS (è la copia-record dell'artigiano, non una prova verso terzi come signer_name → nessun trigger 057). tsc+build+280/280 verdi; scan spazi pulito. **✅ migration 058 APPLICATA da Eli il 25 lug.** Da collaudare dopo il deploy.

### ✅ 25 lug — CAPTCHA SUL LOGIN dopo 3 tentativi falliti (richiesta Eli "stare in sicurezza")
Chiusa la raccomandazione MEDIA del pentest 24 lug (login senza captcha). Soglia soft = **3 fallimenti** (best practice via ricerca web: Atlassian/CyberArk default 3). Oltre soglia il server (`loginAction`) esige il Turnstile **prima** di provare le credenziali → un bot che bypassa il client non lo salta. Nuovo contatore fallimenti per IP **leggibile** in `lib/auth-rate-limit.ts` (`getLoginFailureCount`/`recordLoginFailure`/`clearLoginFailures` + `LOGIN_CAPTCHA_THRESHOLD`; Redis `incr`/`expire` 15 min con fallback in-memory), azzerato al login riuscito. `TurnstileWidget` ora accetta `action` (default 'signup'); il form login lo monta su `state.needsCaptcha` (sticky). **Fail-open**: se Turnstile non è configurato `verifyTurnstile` ritorna true → nessun rischio di lockout. tsc+build+280/280 verdi. Da collaudare da Eli (3 password sbagliate → compare il captcha). ⏭️ RESTA a Eli il pacchetto scelte prodotto (tetto spesa Pro, avviso cancellazione doc firmato, stato SdI orfano) — in corso di raccolta via domande.

### ✅ 24 lug — PENTEST 3 agent (auth/takeover · multi-tenant/IDOR · endpoint pubblici/abuso) — NESSUNA CRITICA/ALTA, 1 fix (PR #175)
Richiesta Eli "altre cose per bloccare malintenzionati". 3 pentester adversariali, findings verificati di persona. **Esito: nessun account takeover, nessun bypass auth, ZERO IDOR/leak cross-tenant, nessun abuso da esterno non autenticato (webhook Stripe/SdI a prova di forgiatura, niente consumo AI/email da non-auth, XSS/SSRF/injection puliti, CSP ok).** Confermato che la 057 e il fix storage 041→045 reggono. **Fixato l'unico finding sostanziale:**
- **[MEDIA] Enumerazione utenti al SIGNUP**: `signupAction` rivelava "Esiste già un account con questa email" (sia sul `User already registered` sia sul `identities=[]`) → oracolo per liste di account reali (phishing/credential stuffing), in contraddizione con l'anti-enumerazione già fatta sul login (20 lug). Ora entrambi i casi ritornano lo STESSO `{ success: 'verifica-email' }` di una registrazione nuova. Anche `resendVerificationEmail` risponde sempre col messaggio neutro (errore vero solo nei log). + igiene: redirect login esclude anche i path `/api/`.
- **Raccomandazioni NON forzate (a Eli)**: [MEDIA] login SENZA captcha (Turnstile solo sul signup) + rate-limit fail-open se Redis giù → valutare Turnstile sul login dopo N fallimenti (scelta UX/prodotto; il rate-limit IP c'è, Upstash verificato attivo in prod). [BASSA] RP WebAuthn da x-forwarded-host (non sfruttabile: uno spoof rompe la verifica, non la bypassa). Aree PULITE: proxy default-deny, callback/confirm path-only, PKCE/OTP monouso, WebAuthn sfida monouso + no cross-account + no minting sessione, /studio da accountant_links su email confermata, reset password sempre-neutro, clientIp non spoofabile, storage path-scoped.
- tsc+build+280/280 verdi. (PR #175 — merge in ritardo per incident GitHub 500 su create-PR; branch pushato e in salvo.)

### ✅ 24 lug — IRROBUSTIMENTO SICUREZZA (Eli: "fai tutto quello che serve") — migration 057 (✅ APPLICATA da Eli il 25 lug) + guardie codice (PR #174)
Applicati i lucchetti TECNICI dell'audit (riducono l'esposizione, non cambiano regole fiscali → ok di Eli sufficiente). Le SCELTE fiscali/legali restano a Eli+professionista.
- **✅ migration 057** (`057_sicurezza_prove_e_quota.sql`, **APPLICATA su Supabase da Eli il 25 lug 2026**) — VALIDATA su Postgres 16 reale (13 casi, incluso il flusso legittimo che NON si rompe):
  - **`sdi_usage` → sola lettura per gli utenti**: DELETE = 0 righe (no-op RLS), INSERT = rifiutato → l'utente non può più azzerare il limite Free 8-a-vita né innescare il kill-switch di spesa. Scritture solo via service role (già così nel codice).
  - **Trigger colonne-prova** (SECURITY INVOKER, check `current_user='service_role'`): `signer_name/accepted_ip/accepted_ua/signature_image` sui documenti e `report_signed_at/report_signer_name/report_signature_image` sui lavori sono scrivibili SOLO dal service role (route pubbliche accept/sign). Un titolare con chiamata PostgREST diretta NON può più fabbricare/alterare la firma del cliente. Le voci di un documento `accepted` sono bloccate per gli utenti (pulizia tier in accettazione = service role, bypass). ✅ Verificato: "Segna accettato" manuale, "Riporta in bozza", editing su draft/sent → NON toccati.
- **Guardie codice (attive subito, tolleranti pre-migration):**
  - **Fattura trasmessa non modificabile**: `updateDocumentAction`+`saveDraftAction` bloccano se `sdi_status` non null e ≠ 'scartata' (l'XML riscaricato divergerebbe da quello trasmesso). Helper `isSdiTransmitted` tollerante 044. (Cancellazione NON bloccata: recuperabile dal cestino + serve la decisione "documento fiscale" del commercialista.)
  - **Ore rapportino congelate post-firma**: `startTimer`/`stopTimer`/`addLaborMinutes` rifiutano se `report_signed_at` valorizzato (prima le ore mostrate nella pagina firmata restavano editabili → contenuto firmato alterabile).
- tsc+build+280/280 verdi. **Restano a Eli** (in A0 sotto, PR #173): snapshot dell'XML trasmesso (migration), tetto spesa Pro, reminder cliente opt-out, data fattura tardiva, avviso cancellazione documento firmato, foto rapportino post-firma, stato SdI orfano, legal_storage enforcement.

### ✅ 24 lug — AUDIT CRITICITÀ (3 agent: fiscale/SdI · probatorio/FES · privacy/soldi) — fix sicuri applicati + DECISIONI per Eli (PR #173)
Richiesta Eli "verifica gli aspetti più critici che possono esporci legalmente". 3 audit adversariali, findings verificati di persona. **Fix APPLICATI (sicuri, isolati, riducono esposizione senza cambiare l'uso legittimo):**
- **[ALTA fiscale] Ritenuta d'acconto nell'XML**: l'XML fase 1 non ha `DatiRitenuta` → il totale usciva al netto SENZA dichiararla (rappresentazione diversa dal PDF, accettata in silenzio dallo SdI). Ora guardia 422 in trasmissione E nel download XML (come sconti/multi-aliquota).
- **[ALTA fiscale] Doppia trasmissione**: invio riuscito + update DB fallito → il codice invitava al "riprova" (= seconda trasmissione reale). Ora: ritenta il salvataggio del provider_id UNA volta, poi tiene 'inviata' e dice "trasmessa, NON reinviare" (200) — mai una seconda trasmissione fiscale.
- **[MEDIA] Mock marca "Consegnata" una fattura reale**: se la chiave OpenAPI sparisse, il provider tornava mock e il pull marcava consegnata senza interrogare nessuno. Ora guardia prefisso `mock-` ↔ `provider.isMock` (409 se incoerente).
- **[MEDIA privacy] Stripe checkout senza allowlist priceId**: `createCheckoutSessionAction` accettava qualsiasi priceId + mode dal client → col webhook (`?? 'pro'`, `mode payment → lifetime`) un futuro price one-time economico pagato darebbe Lifetime. Ora solo i 4 prezzi configurati, mode derivato server-side.
- **[BASSE] fix**: email utente tolta dai log del rollback signup (PII); banner "trasmetti via SdI" nascosto dopo trasmissione riuscita; doppia email di scarto evitata (rowcount webhook+pull); log-payload SdI con dati personali gated dietro `SDI_DEBUG_PAYLOADS=true` (default nascosto); log dell'ambiente (SANDBOX/PRODUZIONE) a ogni invio; decline pubblico con update condizionale `.in(status,[sent,viewed])` (anti-race accept↔decline che sporcava la prova FES).
- **⚠️ DECISIONI/LAVORI PER ELI (NON applicati — richiedono migration o scelta prodotto/legale, molti pre-go-live SdI):**
  1. **[ALTA probatorio] RLS colonne-prova riscrivibili**: `docs_update`/`items_update` (migration 001) non restringono le colonne → il titolare, con una chiamata PostgREST diretta e il proprio JWT, può FABBRICARE/ALTERARE accepted_at/signer_name/accepted_ip/signature_image e le voci di un documento già accettato. Il blocco 'accepted' è solo app-level. Serve un TRIGGER DB che vieti l'UPDATE delle colonne-prova quando valorizzate (eccetto service_role). Indebolisce il valore FES in una lite. → migration + validazione avvocato.
  2. **[MEDIA soldi] RLS `sdi_usage` FOR ALL** (migration 044): l'utente può DELETE/INSERT le proprie righe → azzerare il limite Free 8-a-vita o innescare il kill-switch globale. Fix: policy solo `FOR SELECT`, scritture via service role. → migration.
  3. **[ALTA fiscale] Modifica/cancellazione post-trasmissione**: una fattura trasmessa (`sdi_status` non null) è ancora modificabile da updateDocumentAction/saveDraftAction/auto-save (documents.ts non guarda sdi_status) e cancellabile+purgabile; l'XML trasmesso NON è salvato ("Scarica XML" ricostruisce dai dati correnti → potenzialmente diverso da quello allo SdI). Serve: guardia sdi_status in update/saveDraft/delete + snapshot dell'XML trasmesso (colonna nuova). → migration + decisione.
  4. **[MEDIA fiscale] Data fattura = created_at**: una bozza vecchia trasmessa oggi esce con data >12 giorni (art. 21) senza avviso. → decisione UX.
  5. **[MEDIA] Tetto spesa provider solo per i Free** (€15/mese kill-switch); nessun tetto per Pro (rate-limit 10/min → ~€100/h teorici). → scelta prodotto (tetto Pro).
  6. **[MEDIA] "Conservazione a norma"**: `apply_legal_storage:true` vale solo alla creazione profilo; sendInvoice segue ciecamente l'endpoint suggerito. Rifiutare se l'endpoint non contiene `legal_storage`. → decisione.
  7. **[MEDIA legale] Reminder scadenza al CLIENTE FINALE in opt-out** dal cron (`reminder_cliente !== false`) — in tensione con B.0 §3 (opt-in). → riconferma avvocato (dossier email transazionali).
  8. **[MEDIA] Cancellazione/purge di preventivo ACCETTATO+FIRMATO** senza avviso specifico ("questa è la tua prova"); cancellazione account hard-deleta i preventivi accettati. → copy + validazione avvocato (ritenzione contratto).
  9. **[MEDIA] Rapportino firmato**: ore e foto mostrate restano LIVE dopo la firma (solo il testo è congelato) → contenuto firmato alterabile a posteriori. → guardia report_signed_at su timer/ore/foto.
  10. **[MEDIA] Stato SdI orfano** ('inviata' senza provider_id dopo crash tra claim e invio): nessuno sblocco. → percorso di reclaim.
  11. **[varie BASSE]** secret webhook in query (header preferito mai usato in pratica — rotazione facile); progressivoInvio collide (002/012→22026, innocuo?); aliquota 0 senza Natura per non-forfettari/minimi (scarto certo); Stripe no-dedup event.id (solo email doppia); downgrade immediato su past_due. Aree PULITE: /studio (accountant_links), quote AI/voice (fail-closed), segreti repo (zero), IDOR, escaping XML, claim atomico anti doppio-invio, accoppiamento esito↔fattura, webhook Stripe (firma+idempotenza), follow-up cliente opt-in.
- tsc+build+280/280 verdi. **La regola B.0 impone di NON toccare le aree fiscali/legali strutturali senza ok di Eli e del professionista** — perciò 1-11 sono elencate, non implementate; SdI è comunque in SANDBOX (nessuna esposizione reale oggi).

### ✅ 23 lug notte — QUARTA REVIEW (delta SdI-esito, agent fresco) — 1 ALTA + 2 MEDIE fixate (PR #172)
Richiesta Eli "controlla che tutto quello implementato sia corretto". Findings verificati di persona sul sorgente e FIXATI:
- **[ALTA] `attachCallbacks` era IRRAGGIUNGIBILE per i workspace già configurati**: `ensureConfiguration` girava solo con `sdi_config_done_at` null — il workspace sandbox ce l'ha valorizzato dal 22 lug → i callback sarebbero rimasti sull'evento sbagliato PER SEMPRE e il test webhook del prossimo giro sarebbe fallito. Fix: `ensureConfiguration` gira a OGNI trasmissione (idempotente, 400/230→ok+callback riallineati), il flag resta solo informativo.
- **[MEDIA] Adattatore webhook: esito e UUID estratti separatamente → possibile incrocio esito↔fattura** con payload multi-notifica (NS per X + RC per Y → rischio Y marcata scartata). Fix: `extractNotificationEvents` accoppia tipo↔uuid NELLO STESSO oggetto; il webhook elabora ogni notifica col SUO uuid (job indipendenti, cap 10); più notifiche senza uuid accoppiati = ambiguo → 422. 15 casi verificati.
- **[MEDIA] Reinvio di una scartata: il vecchio `sdi_provider_id` restava vivo durante l'invio** → un retry webhook/pull con la vecchia NS poteva rimarcare 'scartata' la trasmissione nuova in volo (fino alla doppia trasmissione). Fix: il claim azzera anche `sdi_provider_id` (ripristinato sui rami di errore).
- **BASSE fixate**: tetto 10 candidati/notifiche per chiamata webhook; email di scarto anche dal percorso PULL (helper condiviso `lib/sdi/scartata-email.ts` — la campanella promette l'email, ora è vero sempre); fetchEsito distingue il 401 ("controlla gli scope del token") dal non-trovato. **Accettate/annotate**: log payload troncati nei log Vercel (strumento di calibrazione sandbox, da rimuovere/ridurre quando l'adattatore è calibrato — contengono dati personali); PATCH callbacks se fosse replace-non-merge potrebbe toccare i flag del profilo (recuperabile: invio adattivo sul path suggerito).

### ✅ 23 lug sera — ESITO SDI VERIFICATO END-TO-END IN SANDBOX 🎉 (Fatt. 014/2026 → "Consegnata")
Collaudo live con Eli, calibrazione iterativa sui log Vercel + scope del token + Swagger UI della console: ① il token sandbox aveva GIÀ tutte le GET — il "Wrong Token" sulle rotte `*_legal_storage` in GET significa che NON esistono (il gateway risponde 401 per metodo+path fuori da ogni scope, non 404); le rotte di lettura vere sono `GET /invoices_notifications/{uuid}` (risposta confermata: `{"data":[...],"success":true}`) e `GET /invoices`; esiste `PATCH /business_registry_configurations` per aggiornare i callback (fix in PR #170). ② La simulazione sandbox è **`POST /simulate/{tipo-simulazione}`** (path = `customer-notification`, NON il tipo notifica!) con body `{"uuid": "<uuid fattura>", "notification": "RC|NS|MC|NE|DT|AT"}` — la Swagger UI della console è bloccata dal CORS ("Failed to fetch"): va usato curl dal PC col token sandbox. ③ Flusso verificato: simulazione RC → "Controlla l'esito ora" → **"Consegnata"** in app. Il webhook NON è ancora stato chiamato (il profilo sandbox ha il callback sull'evento vecchio; l'`attachCallbacks` coi eventi giusti scatta alla PROSSIMA trasmissione). ⏭️ Prossimo giro sandbox: nuova fattura → trasmetti (aggancia i callback) → simula NS → attesi "Scartata" + email + aggiornamento automatico via webhook (verifica registro CALLBACKS/Sandbox in console). Nel Playground della console l'ambiente si sceglie col menu Env (Sandbox/Production); i token "Playground sdi.openapi.it" in lista Production sono auto-generati dalla console, durata 1 giorno, innocui.

### ✅ 23 lug — ESITO SDI MAI ARRIVATO: causa trovata + pull "Controlla l'esito" + terza review
Eli segnala (screenshot): Fatt. 014/2026 ferma su "Inviata allo SDI · 22 lug". **Indagine (log Vercel 26h: ZERO chiamate a /api/webhooks/sdi + ricerca doc OpenAPI): ① in sandbox l'esito NON arriva da solo — va SIMULATO dalla console ("Customer Notification Simulation", tipi NS/RC/MC/NE/DT/AT); ② registravamo l'evento callback SBAGLIATO (`supplier-invoice` = fatture RICEVUTE, pure disattivate) — quello giusto per l'esito delle EMESSE è `customer-notification` (+ `customer-invoice`), configurabile anche via endpoint dedicato `/api_configurations`; ③ il webhook aspettava un payload normalizzato mai adattato a quello reale.** Fix (PR #169): eventi giusti alla creazione del profilo + `attachCallbacks()` best-effort via /api_configurations quando il profilo ESISTE GIÀ (caso nostro: il 400/230 idempotente non aggiornava i callback) con log per calibrare; **`lib/sdi/esito.ts`** (mappa RC/DT→consegnata, MC/AT→mancata_consegna, NS→scartata, NE→fase 2; walker tollerante per tipi-notifica e UUID nel JSON — 10 casi verificati); webhook accetta payload normalizzato O reale (candidati UUID multipli, ciò che non riconosce → log troncato + 422); **`fetchEsito` sul provider** (GET 3 path noti) + route `POST /api/fatture/[id]/sdi/esito` + bottone **"Controlla l'esito ora"** sulla SdiCard quando "Inviata" → l'esito si recupera ANCHE senza webhook. Mock allineato (pull→consegnata). ⏭️ Eli: simulare RC dalla console sandbox → "Controlla l'esito ora" deve portare a "Consegnata" (+ prova NS). I log `[sdi/openapi]` su Vercel dicono se /api_configurations ha uno schema diverso (metodo iterativo sandbox).
Terza review (agent fresco sul delta bb9c26a+6e71fb0+pre-check): **[MEDIA fixata] "Riporta in bozza" non azzerava l'acconto** registrato sull'accettazione (contava nelle Entrate del Bilancio da bozza, riappariva stantio — gemello del riattiva-fattura) → azzeramento 038 best-effort nell'unaccept; **BASSE fixate**: guardia fattura-collegata fail-closed, update unaccept condizionato `.eq('status','accepted')` + rowcount (anti-race col Converti), canale PEC/destinatario salvato PRIMA del pre-check indirizzo (non si perde più se l'indirizzo manca). Accettate: revert markAll con snapshot potenzialmente stantio (si autocorregge), `inert` assente su browser molto vecchi (auto-save comunque spento), chip mestieri pieni = tap muto. **Fix test PRE-ESISTENTE**: il mock di `updateClientAction` non supportava la catena `.select('id')` della guardia #14 (la suite era rossa da ieri, mai rilanciata — solo tsc+build) → mock aggiornato, **280/280 verdi**.

### ✅ 22 lug — RI-REVIEW del lotto feedback (richiesta Eli "ricontrolla") — 2 agent freschi sull'intero diff, findings verificati di persona e FIXATI
- **[MEDIA] Helper XML download senza le guardie della trasmissione** (`lib/sdi/doc-xml.ts`): sconti/multi-aliquota (non rappresentati nell'XML fase 1), dati fiscali mancanti, bozze, fattura senza numero → il file scaricato poteva avere importi diversi dal PDF o essere XSD-invalid, consegnato al commercialista senza avvisi. Ora l'helper applica le STESSE 8 guardie della route SdI e ritorna un esito tipizzato; le 2 route rispondono con l'errore in TESTO SEMPLICE (leggibile nel browser cliccando "Scarica XML"). Bozze escluse anche per lo /studio.
- **[MEDIA] #18: `opacity:1` sul figlio NON annulla l'opacity del padre** (CSS: si moltiplicano — VERIFICATO con Chromium reale, pixel misurato): il banner "campi bloccati" restava sbiadito al 55%. Fix: banner spostato FUORI dal form (fratello, piena leggibilità); il form usa **`inert`** al posto di `pointer-events:none` → bloccata anche la TASTIERA (prima i campi restavano editabili via Tab).
- **[MEDIA] useComuneLookup: correzione della città sul cliente NUOVO lasciava CAP/provincia dell'autofill precedente** (Asti→Alba = città Alba + CAP 14100 salvati incoerenti, finiscono nell'XML SdI). Fix: ref `auto` che ricorda cosa ha scritto l'AUTOFILL — quei valori si ri-allineano al nuovo match, i valori dell'utente/salvati restano intoccabili (il fix #14 regge).
- **[MEDIA] Notifiche markAll fallito = stato senza ritorno** (ottimistico non annullato → tutte "lette", bottone sparito, "riprova" impossibile). Fix: snapshot + ripristino nei rami d'errore. · **[MEDIA] BottomNav nascosta per sempre** se il campo a fuoco viene smontato (dialog chiuso col campo attivo: il browser non emette focusout). Fix: focusin segue sempre lo stato reale (false sui non-campi → il refocus di Radix sul trigger la rimette).
- **[FALSO ALLARME verificato] "re-edit del preventivo accettato eliminato"**: la nota B.4 era STANTIA — il server blocca `accepted` incondizionatamente da tempo (documents.ts:596/847, nessuna transizione dalla status route). Il #18 rende solo VISIBILE lo stato reale. B.4 corretta. → **RISOLTO con "Riporta in bozza"** (delega Eli "valuta tu la strategia migliore e applicala"): nuova transizione `accepted → draft` nella status route dei preventivi + `RiportaInBozzaButton` (mobile+desktop), SOLO per accettazioni MANUALI — il server rifiuta (409) se il cliente ha accettato dalla pagina pubblica (`signer_name`/`accepted_ip` = prova FES da non distruggere) o se c'è una fattura collegata (anche in bozza); azzera `accepted_at`, numero invariato. Gemello del "Riattiva fattura".
- **BASSE fixate**: cintura `lockedRef` AppLock aggiornato nello stesso tick (niente lag tra due visibilitychange); scontrino 200-con-body-vuoto non dice più "Scontrino letto"; copy avviso ora ("hh:mm" → tendine); chip mestieri non superano più gli 80 char (il server troncava a metà parola); tab Impostazioni con overflow-x-auto (paracadute 320px+Testo grande). **Accettate/documentate**: auto-`:00` alla scelta dell'ora (default visibile nelle tendine, deliberato); flicker nav sui select nativi; race visiva sync notifiche.

### ✅ 22 lug — LOTTO FEEDBACK ELI (21 punti F#1-#21 dal collaudo dal vivo) — TUTTI CHIUSI
Lista in `FEEDBACK_ELI_22LUG.md`. Un punto per volta, tsc+build verdi a ogni commit, scan spazi puliti. #4 (email commercialista) e #11 (lasciato come feature, decisione Eli) senza codice. Fixati e pushati: #1 app-lock (mirror `lockedRef`: chiuso/riaperto mentre bloccato non azzerava più l'attività → niente più Home senza sblocco); #2 NearMe stato "bloccato" + hint quando il permesso è negato; #3 `BackChip` su /professionisti; #5 chip mestieri comuni nel profilo pubblico; #6 errore "migration 023" fuorviante → log + messaggio generico; #7 **orario appuntamento: via l'orologio nativo (bottoni "Imposta/Annulla" tagliati, non stilabili) → due tendine ore/minuti** (`AppointmentPicker`); #8 "Prossimi appuntamenti" → Link all'Agenda; #9 "Assicurazione" fuori dai suggerimenti spesa; #10 foto scontrino: prompt rinforzato (totale non IVA, data prudente) + gestione risposta con messaggi per stato (413/429/5xx) invece di "errore di rete"; #12 rapportino in ALTO sul dettaglio lavoro; #13 tab Impostazioni con spaziatura uniforme; #14 **causa vera trovata: `useComuneLookup` sovrascriveva CAP/città/provincia salvati → ora riempie solo i campi vuoti** (+ guardia rowcount `updateClientAction`); #15 ordinamento fatture anche su desktop; #16 notifica cliccata → letta subito (stato locale ottimistico); #17 hint preventivo→fattura a lavoro finito; #18 **sezioni disattivate (grigie, non cliccabili) nelle fasi avanzate** — form in sola lettura per preventivo accettato / fattura pagata/annullata, avviso in cima + auto-save spento (**bug corretto: su fattura annullata l'auto-save salvava in silenzio nonostante la scritta**); #19 card app-lock in una sezione "Sicurezza e accesso"; #20 **"Scarica XML" della fattura** (helper condiviso `lib/sdi/doc-xml.ts`, route artigiano + route `/studio` commercialista, nessuna trasmissione); #21 BottomNav nascosta quando si apre la tastiera (hook focusin/focusout). ⏭️ Da collaudare da Eli sul telefono (soprattutto #1 app-lock, #7 tendine ora, #21 tastiera).

### ✅ 22 lug — SDI SANDBOX: PRIMA TRASMISSIONE RIUSCITA end-to-end 🎉
Collaudo sandbox OpenAPI con Eli (console: API "Invoice" + "SDI Electronic Invoicing" attivate, token sandbox scope Invoice+SDI, variabili su Vercel: OPENAPI_SDI_API_KEY=token sandbox, NEXT_PUBLIC_SDI_ENABLED=true, SDI_WEBHOOK_SECRET). Contratto generale v3.2 + DPA (4pp) revisionati → `ricerca-fatturazione-elettronica/REVISIONE_CONTRATTO_OPENAPI.md`. **4 fix di integrazione scoperti/corretti in sandbox (PR #163-166):** ① base URL vero = `sdi.openapi.it` / `test.sdi.openapi.it` (il default test.invoice.openapi.com era sbagliato → 401 XML dal gateway); ② profilo fiscale già esistente = OpenAPI risponde 400/230, non 409 → trattato idempotente; ③ l'invio vuole l'**XML NUDO con Content-Type application/xml** (il wrapper JSON+base64 dava 422 malformed), UUID letto anche dentro `data`; ④ endpoint adattivo: se i flag del profilo differiscono l'API suggerisce "Please use: /<endpoint>" → retry sul path indicato (in sandbox il profilo ha la firma attiva → /invoices_signature_legal_storage). Poi validazione contenuto: l'API esige l'INDIRIZZO completo del cessionario → compilato sul cliente di prova → **"Inviata allo SDI · In attesa dell'esito"** su Fatt. 014/2026 (B2C 0000000, P.IVA di prova 12345678903). ⏭️ Da fare: verificare l'arrivo dell'esito via webhook in timeline; test bollo>77,47, B2B, scarto; UX pre-check indirizzo cliente prima della trasmissione; falso positivo GitGuardian 35017023 da chiudere in dashboard (copy hasPassword, nessun segreto).

### ✅ 21 lug — "Vicino a me" diretto + AUDIT FLUSSI (Opzione A, 4 agent) + fix collaboratori
- **"Vicino a me" (richiesta Eli)**: al tocco parte SUBITO il prompt nativo di sistema per la posizione (`getCurrentPosition`); rimossi il messaggio "Non riesco a leggere la posizione…" e l'intera guida ai permessi. Errore/permesso negato → il bottone torna semplicemente allo stato iniziale (la ricerca per comune resta). + `key={geo?'geo':'plain'}` sul componente in `professionisti/page.tsx` (la soft-nav non rimontava → spinner infinito).
- **AUDIT FLUSSI end-to-end (4 agent: preventivi · fatture · sopralluoghi/lavori/agenda · auth/app-lock/marketplace), findings verificati di persona e FIXATI:**
  - **[ALTA] App-lock: utenti Google/OAuth chiusi fuori** — `signInWithPassword` non può funzionare per account senza password → loop di lockout. Fix: `AppLock`/`BiometricToggle` rilevano le identities (`provider==='email'`); senza password il blocco si attiva SOLO con l'impronta ("Aggiungi l'impronta e blocca"), la lock screen nasconde il campo password, e al logout c'è la rete di sicurezza anti-loop (se non c'è NESSUN modo di sbloccare, `cc_lock` viene azzerato).
  - **[MEDIA] App-lock: attivazione senza effetto fino al reload** — l'effect usciva in early-return se il blocco era OFF al mount (layout persistente) → listener mai agganciato. Fix: listener SEMPRE registrati, `isAppLockEnabled()` valutato dentro gli handler.
  - **[MEDIA] Fattura annullata con acconto contava nel Bilancio** — l'azzeramento `payment_status/paid_amount/paid_at` ora scatta anche su `→ rejected` (prima solo su `rejected→draft`); la select entrate `payment_status.in.(partial,paid)` matchava a prescindere dallo stato.
  - **[MEDIA] Duplica preventivo a proposte** — la copia perdeva `option_tier` (voci appiattite) e `options_enabled/recommended_tier/deposit_*` → ora copiati (riuso `applyDepositAndOptions`).
  - **[MEDIA] Numero fattura nel form**: era editabile ma il server lo ignorava sempre (`allocateInvoiceNumber`) → campo READ-ONLY con copy onesta ("Assegnato automaticamente dalla numerazione fiscale").
  - **[MEDIA] Copy "il cliente ha ancora la versione precedente" FALSA** — `/p/[token]` serve i dati LIVE: banner dettaglio preventivo ora dice "il cliente vede già la versione aggiornata dal link: reinvialo per avvisarlo". (Servire lo snapshot al pubblico = eventuale scelta futura.)
  - **[BASSA] Pagina pubblica multi-proposta**: "Vedi il documento completo" nascosto quando le proposte sono in scelta (quel PDF mescola i tier). · **AppointmentPicker**: fetch busy ora dipende da `viewMonth` (finestra fissa −1/+13 dava "✓ Quel giorno è libero" FALSO fuori finestra). · **RapportinoCard**: canale WhatsApp solo se il numero normalizza a cifre valide (prima `wa.me/` senza destinatario).
- **FIX COLLABORATORI (piano Team)**: nuovo helper **`lib/actions/resolve-workspace.ts`** (`resolveWorkspaceForUser`: titolare → membro accettato, come `getSessionWorkspace`) applicato a `documents.ts` (TUTTE le 15 azioni: create/update/saveDraft/restore/duplicate/invoice/reminder/link/deposit…), `templates.ts`, `support.ts`, route PDF/send-email/SdI, e ATECO del `CatalogPicker` (via filtro owner_id, basta RLS). ⚠️ **Le aree owner-only restano VOLUTAMENTE tali**: abbonamento, account, team, referral, impostazioni workspace, marketplace — il commento nell'helper lo dice esplicitamente. Le route AI, clients/lavori/sopralluoghi/expenses/notifications/catalogo/export/cestino avevano GIÀ il fallback membro.
- tsc + build + 280/280 + smoke 20/20 verdi; scan spazi puliti. Da collaudare da Eli sul telefono: blocco app con account Google (deve chiedere l'impronta, non la password).
- **RI-REVIEW (richiesta Eli "ricontrolla") — 2 agent freschi sull'intero diff di giornata, RLS verificata fino alle policy (001/031/046: membri OK su documents/items/clients/templates/sequenze). Fixati:** ① [MEDIA] retro-compat `isAppLockEnabled` ora vale anche col solo `cc_biometric` legacy (le build vecchie non scrivevano `cc_lock` → chi aveva l'impronta avrebbe PERSO il blocco al deploy, in silenzio); ② [MEDIA] NearMe: `setLoading(false)` dopo il push (ri-tocco in modalità geo = stessa key → nessun remount → spinner infinito); ③ [MEDIA] account Google che rimuove l'ULTIMA impronta → ora si spegne anche il blocco (prima restava `cc_lock` senza alcun modo di sbloccare) + toast onesto; ④ [BASSA] `hasPassword` tri-stato (null=in verifica) nel Toggle: niente bottone "Attiva il blocco" nella finestra di caricamento per gli account Google; ⑤ `.order('accepted_at')` in resolve-workspace (multi-team deterministico); ⑥ log dell'errore best-effort in duplicate. Verificati puliti: 15 call site collaboratori (colonne/null-check/quota), status route (acconto parziale NON azzerato), duplicate (soft-delete su insert fallito), FatturaForm read-only, AppointmentPicker viewMonth.

### ✅ 20 lug — AUDIT DI SICUREZZA COMPLETO (5 revisori) + fix
Richiesta Eli ("siamo protetti? ho paura degli hacker"). 5 agent adversariali su tutta l'app: ① auth/sessioni ② permessi/RLS/IDOR ③ segreti/config ④ injection/XSS/SSRF/upload ⑤ endpoint pubblici. **Esito: NESSUNA vulnerabilità critica o alta. Nessun bypass auth, nessuna fuga dati, nessun IDOR cross-tenant.** Isolamento multi-tenant robusto (RLS + filtro esplicito su ogni uso del service role; bug storici già chiusi da 035/036/045). WebAuthn "a regola d'arte" (sfida monouso, userVerification required, no unlock cross-account, no session-minting). Token pubblici 128-bit non enumerabili. Segreti puliti (GitGuardian ok). **Fix applicati** (media/bassa): SVG rimosso dall'allowlist upload logo (`lib/actions/workspace.ts` — stored-XSS confinato a storage); `"` strippato in 5 ricerche liste (preventivi/fatture/catalogo/sopralluoghi/clients); open-redirect `/auth/confirm` allineato a callback (blocca `:`/`\`); rate-limit `pdf:${token}` 20/min su `/api/p/[token]/pdf`; avviso `console.error` in `lib/redis.ts` se Upstash manca in prod. **Follow-up affrontati (20 lug, 2° giro):** ① **CSP "sicura"** in `next.config.ts` (`object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors` 'none'/'self' su pdf) — verificata servita; il lockdown script inline con nonce resta task dedicato (collaudo dal vivo). ② **Enumerazione utenti login CHIUSA**: messaggio unico "Email o password non corretti", rimossa la ricerca admin (`app/(auth)/actions.ts`), UI login mostra link reset+registrati generici. **Rimasto:** ~~verificare Upstash su Vercel prod~~ ✅ FATTO 20 lug (URL+TOKEN presenti, Sensitive → rate-limit attivi). tsc+build+280+smoke 20/20 verdi.

### ✅ 21 lug — "BLOCCA L'APP QUANDO ESCO" (evoluzione dello sblocco impronta)
Richiesta Eli: "dopo il login resto dentro senza che me la chieda più; voglio che ad ogni uscita mi richieda l'accesso con password O impronta". Prima l'AppLock si attivava SOLO con l'impronta abilitata. Ora:
- **Interruttore master `cc_lock`** ("Blocca l'app quando esco") in `lib/biometric/local.ts` (`isAppLockEnabled/setAppLockEnabled`) — vale ANCHE senza impronta. Abilitare l'impronta implica il blocco (`setBiometricEnabled(true)` → `cc_lock='1'`).
- **`AppLock` ora si attiva su `isAppLockEnabled()`** e la lock screen ha il **campo PASSWORD** (sblocco via `createClient().auth.signInWithPassword({email: userEmail, password})` — stessa sessione, niente perdita dati) + bottone impronta SOLO se `isBiometricEnabled()` + "Esci dall'account". `userEmail` passato dal layout.
- **Card Impostazioni** rinominata "Blocca l'app quando esco": toggle master + selettore timeout (Ad ogni apertura / 15 min / 1 ora / 1 giorno) + sotto-sezione opzionale "Sblocco con impronta" (aggiungi/rimuovi passkey).
- File: `components/security/AppLock.tsx` + `BiometricToggle.tsx` riscritti, `lib/biometric/local.ts`, `app/(app)/layout.tsx`. tsc+build+280+smoke 20/20 verdi, replica visiva 390px. Da collaudare da Eli sul telefono (blocco all'uscita → password/impronta).

### ✅ 20 lug — SBLOCCO CON IMPRONTA (passkey/WebAuthn) — MVP additivo (⚠️ migration 056 DA APPLICARE)
Richiesta Eli ("possiamo fare ora l'accesso con impronta?"). Scelta di Eli via chat: **"sblocco rapido dopo un primo login" + gestione del timeout** (dopo quanto tempo ri-chiedere l'impronta, incluso mai). Implementato come **schermata di blocco additiva**, che NON tocca il login esistente (se l'impronta non va → si entra come sempre con la password). L'impronta resta SUL TELEFONO (standard passkey/WebAuthn, come le banche): al nostro server arriva solo la chiave pubblica.
- **Come funziona**: dopo il login normale, da **Impostazioni › Generale › "Sblocco con impronta"** l'artigiano attiva la passkey su QUEL dispositivo (registrazione WebAuthn platform authenticator). Da lì, riaprendo l'app dopo il tempo scelto (`AppLock` overlay navy), per rientrare serve l'impronta/Face ID; la sessione Supabase sotto resta valida (blocco di privacy, non logout → niente perdita dati). Fallback "Usa la password" = signOut + /login.
- **Timeout scelto in-app** (per-dispositivo, localStorage): Ad ogni apertura · Dopo 15 min (default) · Dopo 1 ora · Dopo un giorno.
- **Sicurezza**: verifica WebAuthn server-side (`@simplewebauthn/server` v13) con sfida monouso in cookie httpOnly; l'unlock esige una passkey **dell'utente della sessione** (no cross-account); RLS su `passkeys` (owner select/delete; insert/update via service role dopo la verifica). È un blocco di *convenienza* (la sessione resta in memoria dietro l'overlay) — la password resta la vera porta per un login fresco. Threshold onesto comunicato a Eli.
- **File**: `lib/webauthn/{rp,store}.ts`, `app/api/passkey/{register,auth}/{options,verify}/route.ts`, `lib/actions/passkeys.ts`, `lib/biometric/local.ts`, `components/security/{AppLock,BiometricToggle}.tsx`, mount in `app/(app)/layout.tsx`, card in `impostazioni/tabs/generali.tsx`, migration `056_passkeys.sql`. Nuove dipendenze: `@simplewebauthn/server@^13` + `@simplewebauthn/browser@^13`.
- **Verifica**: tsc + build (4 route registrate) + 280/280 + smoke 20/20 verdi; scan spazi puliti; **E2E reale della cerimonia WebAuthn** con l'autenticatore VIRTUALE di Chromium (CDP) usando la stessa logica delle route + stesso round-trip base64url → registrazione ✓ e sblocco ✓; verifica visiva a 390px (lock screen + card impostazioni). ⚠️ **DA COLLAUDARE DA ELI su telefono vero** (impronta/Face ID reali; in TWA serve il fingerprint in assetlinks, già gestito). NON marcato CHIUSO: auth = area sensibile (B.0).
- **Backlog**: opzionale "Accesso completo senza password" (passkey come login primario, richiede minting sessione via admin) — NON ora (scelta Eli: prima lo sblocco rapido).
- **✅ 20 lug (2) — RICHIESTA POST-LOGIN (Eli: "non farlo cercare in Impostazioni")**: dopo il login compare UNA volta per dispositivo un bottom-sheet "Vuoi entrare con l'impronta?" (Sì, attiva / Più tardi → rimanda a Impostazioni). `components/security/BiometricPrompt.tsx` (montato in layout accanto ad AppLock); flag `cc_biometric_prompted` in localStorage; si mostra solo se il device supporta WebAuthn, non è già attivo, e NON durante il tutorial (`body.driver-active`). Logica di registrazione estratta in `lib/biometric/register.ts` (condivisa con `BiometricToggle`). tsc+build+280+smoke 20/20 verdi; replica visiva a 390px.

### ✅ 20 lug — FIX dei findings della review 19 lug decies (Opus 4.8) + nota fingerprint
Sessione di fix dei findings rilevati (e non sistemati) il 19 lug. Applicati tutti i **6 MEDI** e le **5 BASSE utili** (B1-B5); B6-B9 lasciati (volumi/irrilevanti). tsc + build + **280/280** + smoke 20/20 verdi, scan spazi puliti, verifica visiva Chromium a 390px dei nuovi stati UI.
- **M1** — riattiva fattura (`rejected→draft`) ora AZZERA `payment_status/paid_amount/paid_at` (best-effort, tollerante 038) in `app/api/fatture/[id]/status/route.ts` → niente acconto stantio sulla bozza riattivata.
- **M2** — le foto del PREVENTIVO di origine mostrate sulla FATTURA sono ora **read-only**: niente ✕ (detach/delete) né toggle occhio/etichetta che agirebbero cross-documento; badge "dal preventivo" + indicatore visibilità non interattivo + nota esplicativa. `WorkPhotosCard` (prop `readonly` per foto) + `fatture/[id]/page.tsx` (origin photos marcate `readonly:true`).
- **M3** — `MonthAgenda` ora ha `key={monthParam}` in `calendario/page.tsx` → al cambio mese il client rimonta e il giorno selezionato riparte dal default del nuovo mese (niente più giorno stantio).
- **M4** — `AppointmentPicker`: giorno senza ora non si perde più in silenzio. Avviso ambra ("Manca l'ora… l'appuntamento non viene salvato") + nuova prop `onIncompleteChange` → SopralluogoForm e LavoroForm **bloccano il salvataggio** con messaggio se c'è giorno senza ora.
- **M5** — la deselezione (ri-tocco giorno, design #147) ora azzera ANCHE l'ora (niente più ora grigia orfana) e c'è un'etichetta scopribile ("Per togliere l'appuntamento tocca di nuovo il giorno scelto"). Design deselect-on-retap mantenuto (scelta Eli).
- **M6** — `NearMeButton`: coordinate GPS del cliente troncate a `toFixed(2)` (~1 km) → non finiscono a ~1 m negli access log dell'URL.
- **B1** — `/api/agenda/busy`: date valide per regex ma impossibili (es. 2026-13-45) → ora 400 (prima RangeError→500).
- **B2** — `/professionisti`: `generateMetadata` con canonical fisso `/professionisti` + `noindex` sulle varianti con `?lat/?lng` (coordinate non indicizzabili).
- **B3** — `safeTok` ora strippa anche le virgolette `"` (niente `.or()` malformata).
- **B4** — `TierPicker` accetta `initialTier`: sui documenti legacy col totale "Totale proposta {X}" preseleziona quella stessa proposta (niente contraddizione con la Base).
- **B5** — PDF confronto multi-proposta: l'acconto FISSO mostra l'importo VERO impostato (prima cappato al totale Base via `Math.min`).
- **Nota richiesta Eli**: registrato in `COSE_DA_FARE_ELI.md` §8 + backlog il desiderata **accesso all'app con impronta** (login biometrico, passkey/WebAuthn — feature per una prossima sessione).

### ⚠️ 19 lug decies — REVIEW-ONLY del lavoro di giornata (PR #135-#150): FINDINGS DA FIXARE, NON ANCORA SISTEMATI
**Decisione Eli (19 lug, a fine giornata): rilevare senza sistemare — i fix li fa la prossima sessione (Opus 4.8).** Review a 3 agent adversariali sull'intero diff `6a215a2..master`; findings chiave ri-verificati di persona sul sorgente (righe citate controllate). NESSUN fix applicato. Aree verificate PULITE: € NBSP ovunque, rimozione ★ Consigliata coerente, blocchi PDF multi-proposta (fatture escluse, regressione singola ok), matematica griglia calendario+picker (10 mesi critici incl. DST/bisestile), SwipeMonths (tap/scroll ok), publish marketplace NON azzera lat/lng, RLS 055 ok, guardia SdI status route ok, scan spazi ok.

**MEDIE (6) — da fixare:**
- **M1 · Riattiva fattura non azzera i dati di pagamento** (`app/api/fatture/[id]/status/route.ts` ~167-174): `rejected→draft` fa solo `update({status})` — `payment_status/paid_amount/paid_at` restano. Scenario: acconto parziale 500€ → annulla → riattiva → bozza con "Acconto già ricevuto −500€" stantio; se il totale scende sotto 500 il "Segna pagata" va in 422. Fix: azzerare i campi 038 alla riattivazione.
- **M2 · Dalla card foto della FATTURA si staccano/eliminano foto del PREVENTIVO di origine** (`fatture/[id]/page.tsx` merge origin+fattura + `WorkPhotosCard.tsx:108-119`): la ✕ su una foto d'origine fa detach (sparisce dal preventivo, pagina pubblica inclusa) o DELETE definitivo (se senza sopralluogo_id); l'occhio la mostra/nasconde anche sul preventivo. Nessun IDOR (scoped workspace) ma effetto cross-documento non evidente, con perdita permanente. Fix possibile: foto d'origine read-only dalla fattura, o copy chiaro.
- **M3 · MonthAgenda non risincronizza il giorno al cambio mese** (`calendario/page.tsx:205` senza `key` + `MonthAgenda.tsx:50` useState senza sync): navigazione frecce con destinazione in router cache → il client non rimonta → `selected` resta del mese prima (griglia senza evidenza, header "Oggi" sbagliato, pannello vuoto). Fix: `key={monthParam}` sul componente (o effect su monthParam).
- **M4 · AppointmentPicker: giorno scelto senza ora = appuntamento NON salvato in silenzio** (`AppointmentPicker.tsx` emit solo con giorno+ora; `sopralluoghi.ts:78` '' → null): l'utente vede la cella navy e crede di aver fissato; c'è solo l'hint testuale. Fix: avviso bloccante/validazione al salvataggio se selDay senza selTime.
- **M5 · AppointmentPicker in EDIT: ri-tocco del giorno = deselezione → il salvataggio AZZERA l'appuntamento esistente senza conferma** (+ sotto-nota: selTime resta visibile in grigio dopo la deselezione). ⚠️ La deselezione è stata introdotta OGGI come sostituto del bottone "Togli" (scelta di design nel giro #147): il revisore segnala che non è scopribile — decisione da riconfermare con Eli o aggiungere conferma/etichetta.
- **M6 · Privacy: coordinate del cliente a ~1 m nell'URL/log** (`NearMeButton.tsx:28-29` `toFixed(5)`): l'URL con lat/lng finisce negli access log Vercel. Fix: troncare a 2 decimali (~1 km, bastano per l'ordinamento).

**BASSE (9):** B1 busy route 500 (RangeError) su date valide per regex ma impossibili (es. 2026-13-45) → validare/400 · B2 `/professionisti?lat&lng` senza canonical/noindex (URL con coordinate indicizzabile se condiviso) · B3 `safeTok` non strippa `"` → .or() malformata → 0 risultati (innocuo, try/catch) · B4 pagina pubblica di documenti LEGACY con vecchia ★: etichetta "Totale proposta Premium" ma TierPicker preseleziona Base (contraddizione visiva finché non ri-salvato) · B5 PDF confronto multiTier: acconto FISSO cappato al totale Base (`Math.min(v, total)`) → importo sbagliato se acconto > Base ma < Premium · B6 mini-riepilogo per proposta: IVA per-gruppo vs totale per-voce → possibile 1 cent di scarto in ordinario (pre-esistente, ora più visibile) · B7 lavoro in_corso con appuntamento appare sia in griglia sia nei chip (percezione doppione) · B8 pallini del picker su finestra fissa −1/+13 mesi (fuori finestra niente pallini) · B9 limit silenziosi (300 griglia agenda, 500 busy) — irrilevanti ai volumi.

### Fatto anche (19 lug nonies — Trova professionista: ricerca per parola + "Vicino a me")
Due richieste Eli sulla pagina pubblica `/professionisti`:
- **Ricerca per parola parziale**: la query è tokenizzata (fino a 5 parole) e cerca OGNI parola dentro `trade`, `bio`, `public_name` in OR (prima solo trade+nome con la query intera) → "serbatoi" trova chi scrive "pulizie dei serbatoi" nel mestiere O nella presentazione. Placeholder "Mestiere o servizio (es. serbatoi)"; campo del profilo rinominato "Mestiere e servizi" con invito a elencarli.
- **"Vicino a me" (migration 055 `marketplace_profiles.lat/lng`)**: `lib/geocode.ts` (geocodeCity via OpenStreetMap Nominatim, gratis senza chiave; distanceKm Haversine — 4 test). Il comune del profilo viene geocodificato al SALVATAGGIO (`saveMarketplaceProfileAction`, tollerante 055 con retry senza lat/lng). Il bottone `NearMeButton` (client) chiede la posizione al browser e ricarica `?lat&lng` → la pagina ordina per distanza (Haversine), mostra "a X km", e se il più vicino è oltre 30 km avvisa "nessuno proprio nei dintorni: ecco i più vicini" (l'ordinamento per distanza allarga da solo fino a ≥5). ⚠️ PRIVACY: la posizione del cliente arriva SOLO al nostro server (via URL); OpenStreetMap vede solo i NOMI dei comuni dei professionisti, mai dati del cliente. La select lat/lng è tollerante pre-055 (retry senza). tsc+build+280+smoke 20/20 verdi. ✅ Migration 055 APPLICATA da Eli (19 lug); i profili esistenti prendono le coordinate al primo ri-salvataggio.

### Fatto anche (19 lug octies — swipe mesi sul grafico Bilancio)
Richiesta Eli: "muovermi velocemente tra i mesi a grafico nel bilancio scorrendo col dito". Nuovo `SwipeMonths` (client, `bilancio/_components/`) avvolge la card del grafico: trascinamento a SINISTRA → mese successivo, a DESTRA → precedente (`router.replace`, come le frecce; `router.prefetch` dei mesi adiacenti). Swipe valido solo se orizzontale ≥50px e nettamente più orizzontale che verticale (`touchAction:'pan-y'`) → non ruba lo scroll verticale né il tap sui bar (che restano Link al mese). Header grafico: "tocca un mese o scorri per cambiare". Sul mese corrente lo swipe-sinistra è no-op (niente mesi futuri). tsc+build+276+smoke 20/20 verdi.

### Fatto anche (19 lug sexies — AGENDA a CALENDARIO MENSILE)
Richiesta Eli: "voglio l'agenda organizzata coi giorni del mese come un calendario, così capisco quali giorni hanno già appuntamenti; toccando un giorno mi escono gli appuntamenti di quel giorno (ora, con chi, dove), e cliccandoci si apre il dettaglio". Rifatta `/calendario` da LISTA settimanale a CALENDARIO mensile:
- **`MonthAgenda.tsx`** (nuovo client component): griglia lunedì-primo (5 o 6 righe), intestazione giorni, **pallino ORO sui giorni con appuntamenti** (bianco se il giorno è selezionato), oggi evidenziato (bg crema + anello oro), giorni fuori mese sbiaditi. Toccando un giorno (client-side, istantaneo) sotto compaiono gli appuntamenti di quel giorno con ora, titolo+cliente, indirizzo, e le azioni WhatsApp "sto arrivando" + navigazione mappe; il tocco sull'appuntamento apre il dettaglio (`/lavori/[id]` o `/sopralluoghi/[id]`). **Default = OGGI** (se nel mese corrente), altrimenti primo giorno del mese con appuntamenti.
- **Server** (`page.tsx` riscritta): naviga per MESE via `?m=YYYY-MM` (link server, come prima per la settimana); calcola la griglia (dal lunedì della settimana del giorno 1 fino a coprire l'ultimo giorno, settimane intere); fetch di sopralluoghi+lavori con `scheduled_at` nell'intera griglia (tollerante pre-migration 047/048/049) + lavori in corso; costruisce `byDay` con gli eventi GIÀ PRONTI (ora, cliente, href, waHref, mapsHref) → il client sceglie solo il giorno.
- Verificato: matematica griglia su 6 mesi critici (lug/feb/mar/nov 2026, feb 2024 bisestile, ago 2026) — sempre lunedì-primo, contigua, copre primo e ultimo giorno, 5 o 6 righe corrette. Aspetto verificato con replica HTML Chromium (pallini, oggi selezionato, fuori-mese sbiaditi). tsc+build+276+smoke 20/20 verdi.
- ✅ **Follow-up FATTO (19 lug septies)**: `AppointmentPicker` (`app/(app)/_components/`) sostituisce il datetime-local nei form Sopralluogo/Lavoro — mini-calendario mensile coi pallini oro sui giorni occupati (dati da `/api/agenda/busy?from&to`), input ora, e AVVISO ambra "Quel giorno hai già N appuntamenti: HH:MM — titolo" (escluso il documento in modifica via excludeKind/excludeId); "✓ Quel giorno è libero" se vuoto. Griglia lunedì-primo con gli stessi helper del calendario. Verificato con replica Chromium a 360px. **Rifinitura (Eli): niente ora precompilata** — stato interno selDay/selTime, l'ora resta `--:--` finché non la scegli (hint "Scegli l'ora toccando hh:mm"); l'appuntamento si emette al form solo con giorno+ora ENTRAMBI; via il bottone "Togli" (ri-toccare il giorno selezionato lo deseleziona); rimosse le frasi-caption sotto il calendario nei due form.

### Fatto anche (19 lug quinquies — fattura annullata: riattivabile pre-SdI, blocco post-SdI, niente più reinvio ambiguo)
Domanda fiscale di Eli: "posso rinviare una fattura annullata? posso rimetterla attiva? verifica sul web e organizziamo il flusso senza guai". Ricerca web (Fatture in Cloud, Danea, TeamSystem, laleggepertutti, Studio Previtali): il punto di non ritorno è la TRASMISSIONE allo SdI. Prima = copia di cortesia, malleabile; dopo = emessa, si corregge solo con nota di credito (TD04). Un salto di numerazione è errore formale non sanzionabile; NON cancellare mai fisicamente. Implementato l'Opzione 1 (prassi standard):
- **Riattivazione pre-SdI**: nuovo `RiattivaFatturaButton` + transizione `rejected → draft` in `/api/fatture/[id]/status` (enum status ora include 'draft'). Riporta la fattura in bozza mantenendo lo STESSO numero; l'artigiano la rivede e la reinvia.
- **Guardia SdI (server, future-safe)**: la route legge `sdi_status` (tollerante 044); se la fattura è TRASMESSA (`sdi_status` non null e ≠ 'scartata') annulla e riattiva sono BLOCCATE (409, messaggio "serve una nota di credito"). Oggi SdI spento → `sdi_status` null → mai bloccato. Stessa condizione del lock già presente in `sdi/route.ts:88`.
- **Fix incoerenza**: su una fattura ANNULLATA sparisce "Invia al cliente" (reinviare un documento annullato non ha senso — il cliente vedrebbe "annullata"); al suo posto "Riattiva fattura" (solo se non trasmessa). Desktop + mobile. Banner annullata aggiornato (riattivabile vs nota di credito).
- La nota di credito NON è costruita ora: è materiale della fase SdI (annotato). tsc+build+276+smoke 20/20 verdi. Da collaudare da Eli (annulla → Riattiva → torna in bozza col suo numero → reinvio).
- **Note di credito via SdI (domanda Eli)**: SÌ, se trasmettiamo la fattura via SdI dobbiamo gestire anche la nota di credito (è un doc elettronico TD04 da trasmettere allo SdI: numero proprio, riferimento alla fattura originale, storno totale/parziale, stesso provider OpenAPI + webhook esito). L'infrastruttura SdI esistente (`lib/sdi/xml.ts`, providers, webhook) si estende a TD04 → feature CONTENUTA ma della FASE SdI, non ora. Domande fiscali (numerazione serie/sezionale, forfettari, termini) nel dossier unico commercialista.
- **⚠️ REGOLA (Eli 19 lug): un SOLO file per ciascun professionista, non addendum.** Avvocato: `CartaCanta_Avvocato_DOSSIER_UNICO`. Commercialista: `CartaCanta_Commercialista_DOSSIER_UNICO_19lug2026.pdf` (13 aree, riassorbe tutti i precedenti). Ogni nuova domanda AGGIORNA il dossier unico giusto e si RI-invia tutto il file in chat (SendUserFile), mai committare nel repo.

### Fatto anche (19 lug quater — scheda lavoro chiara, rapportino completo, foto trasportate in fattura, anteprima in overlay)
4 punti di Eli (screenshot della Fatt. 003/2026):
- **"Apri lavoro" → "Apri la scheda lavoro"** con sottotitolo "Ore in cantiere, foto e rapportino di fine lavoro" (Eli: "non si capisce che cosa bisogna farci"); allineati aiuto e empty state di /lavori.
- **Rapportino /r/[token] COMPLETO**: oltre al testo ora mostra le **ore di lavoro** segnate (riga "Ore di lavoro in cantiere", solo se >0; tollerante pre-052) e le **foto del lavoro** (griglia con badge PRIMA/DOPO). ⚠️ Le foto restano SOLO quelle rese visibili con l'occhio (regola permanente "di default il cliente non vede nessuna foto") — hint nel RapportinoCard che lo spiega all'artigiano. Occhio agli spazi Turbopack: il testo nuovo del hint ha richiesto {' '} dopo i </b> (beccato dallo scan).
- **Foto trasportate preventivo→fattura**: il dettaglio fattura mostra e gestisce anche le foto del preventivo di origine (query origin nel Promise.all di wave 2, merge origin+fattura; le azioni della card sono keyate su photo.id quindi funzionano su entrambe); la pagina pubblica della fattura mostra le foto VISIBILI di fattura+origine (`.in('document_id', [id, origin])`, select con origin_document_id).
- **Anteprima in OVERLAY su mobile** (`AnteprimaButton` in preventivi/_components, usato da preventivi/[id] e fatture/[id]): niente più navigazione verso la route PDF — iframe a schermo pieno con barra "Chiudi", scroll lock, Escape; chiudendo si torna ESATTAMENTE al punto in cui si era (Eli: "deve permettermi di ritornare allo stesso punto"). Dimensioni divise per --cc-zoom (Testo grande). Desktop invariato (nuova scheda).
- tsc+build+276+smoke 20/20 verdi, scan spazi pulito. Da collaudare da Eli sul telefono (rapportino con ore+foto, fattura da conversione, overlay anteprima).

### Fatto anche (19 lug ter — brief video Higgsfield + DOSSIER UNICO avvocato)
Richiesta Eli: ricerca web + file per far produrre a Higgsfield i video promo social; poi "l'avvocato non l'ho ancora contattato: tutto in un unico file".
- **`CartaCanta_Brief_Higgsfield_Video_Promo.md`** (in chat, NON nel repo): 3 video strutturati scena-per-scena (principale 27s "La sera al furgone", taglio 15s quasi tutto app vera — consigliato come primo, variante prima/dopo) con prompt EN pronti per Higgsfield, overlay/VO in italiano, didascalie e hashtag. Dentro: tabella claim VIETATI (AGCM: no "gratis per sempre", no numeri di guadagno, no countdown finti, no testimonial finti) e claim CONSENTITI testuali; obbligo etichetta AI (toggle TikTok, autodichiarazione Meta, AI Act dal 2/8/2026); **regola: le schermate dell'app nei video devono essere REALI (4 clip dall'account demo, elenco §3c) — mai UI inventata dall'AI**; musica solo con licenza commerciale; CTA → cartacanta.app/prova.
- **`CartaCanta_Avvocato_DOSSIER_UNICO_19lug2026.pdf`** (in chat, NON nel repo): documento UNICO che riassorbe e SOSTITUISCE i PDF avvocato del 7/14/15/17 lug e l'addendum ads — 16 aree (informative+campi gialli · cookie/PostHog opt-in · firma FES preventivo · firma rapportino · copia di cortesia fatture · DPA OpenAPI/SdI · ruoli GDPR commercialisti · foto+AI photo-to-quote/AI Act · email transazionali clienti finali · recensioni in-app e Google BLOCCATA · directory DSA · claim beta AGCM · cancellazione vs ritenzione 10 anni · export art. 20 · Data Safety Play Store · **ads video AI (nuovo)**) + sezione "cosa NON facciamo in attesa del parere". ⚠️ D'ora in poi ogni nuova domanda legale AGGIORNA il dossier unico (non più addendum separati).
- **COSE_DA_FARE_ELI.md aggiornato**: sezione 2 punta al dossier unico; sezione 6 con la checklist operativa video (4 clip demo, Higgsfield, etichette AI, claim ammessi).

### Fatto anche (19 lug bis — ★ "Consigliata" RIMOSSA, link documento completo a bottone, € mai a capo)
3 punti di Eli (screenshot del 002/2026 Elegante con "€" a capo da solo):
- **★ "Segna come Consigliata" RIMOSSA (decisione Eli: "non ha senso")**: via l'interruttore dal form (resta il selettore Base/Premium), via il badge dal TierPicker (parte selezionata la PRIMA proposta = Base), via le stelle da PDF (blocchi e box confronto) e riepiloghi. `parseOptionsFields` ora ritorna sempre `recommended: null` → i totali di documento seguono SEMPRE la Base e **al primo salvataggio le stelle legacy in DB vengono azzerate** (`recommended_tier: null` in applyDepositAndOptions). ⚠️ `recommended_tier` si LEGGE ancora (PDF refTier, nota in-app, etichetta pagina pubblica) SOLO per i documenti legacy non ancora ri-salvati, i cui totali erano calcolati sulla proposta stellata — così le etichette non mentono mai. Nessuna migration (la colonna resta). Copy Pro card: "più proposte (Base/Premium)".
- **"Vedi il documento completo" a BOTTONE** sulla pagina cliente mobile (bianco bordato, icona FileText, min-height 48 — prima link testuale 13px che "non si nota"); testo con "il" anche nei 2 link desktop.
- **⚠️ REGOLA: il simbolo € non va MAI a capo separato dall'importo.** Tutte le concatenazioni `X €`/`€ X` ora usano NBSP: `}&nbsp;€` nell'HTML di template.ts (34) e nel JSX di TemplatePreview, ` ` nelle stringhe TS (fmtEuro/formatEur/euro in TierPicker, MobilePublicCard, AccontoCard, PreventivoForm, preventivi/[id], fatture/[id] ×4, dashboard, send-email, notifications, RevenueChart, status route, fiscali/abbonamento/MobileProCard). Intl `style:'currency'` è già a posto (NBSP nativo). Nei testi JSX usare `&nbsp;`; occhio alla regola degli spazi Turbopack: dopo `</b>` serve comunque `{' '}` (beccato dallo scan su abbonamento:195 e fixato).
- VERIFICATO con Chromium: Elegante replica 002/2026 → 0 nodi € spezzati su due righe (prima "1500,00 / €"); tecnico multi-tier legacy con ★Premium → zero stelle nell'HTML e strip "Tot. Proposta Premium"; card pubblica a 360px → bottone ben visibile, nessun badge, 0 overflow. tsc+build+276+smoke 20/20 verdi, scan spazi pulito.

### Fatto anche (19 lug — PDF multi-proposta: proposte DAVVERO separate, ogni blocco col suo riepilogo)
Feedback Eli sullo screenshot del 034/2026 deployato: "anche aprendo il documento non si capisce come vengono calcolati i totali, le due proposte dovrebbero essere separate" — il raggruppamento del 18 lug c'era, ma sotto entrambe le proposte restava il riepilogo di DOCUMENTO (Imponibile 100 / Bollo 2 / Totale 100 + nota ambra) che mescolava i conti. Rifatto in `lib/pdf/template.ts` (condiviso dai 4 preset):
- **Ogni proposta è un blocco AUTONOMO**: banda grigia col nome ("PROPOSTA BASE — ★ Consigliata"), le sue voci, e in coda il SUO mini-riepilogo — Subtotale/Sconto/IVA per aliquota/Marca da bollo → riga forte "TOTALE PROPOSTA X" (righe intermedie solo se esistono: la Premium da 55€ senza bollo mostra solo il totale). Conti per proposta in `tierFiscals` (calcolaDocumento + righe IVA contate come il riepilogo di documento, sui totali riga salvati → i numeri combaciano sempre).
- **Riepilogo di documento SOPPRESSO con più proposte** nei 4 preset (wrap `${multiTier ? '' : ...}`): al suo posto il box **"Le proposte a confronto"** (una riga per proposta col totale, ★ Consigliata, nota "si sceglie una sola proposta, dalla pagina del preventivo") che viaggia in depositHtml come prima la nota ambra (ora rimossa). Box acconto con importi ASSOLUTI sospeso con più proposte (era calcolato su una proposta sola) → riga descrittiva nel confronto ("acconto del X% sulla proposta scelta"; importo fisso col suo valore).
- **Strip del Tecnico**: la 4ª cella "Totale IVA incl." con più proposte diventa "Tot. Proposta X" (la proposta di riferimento dei totali di documento).
- VERIFICATO con screenshot Chromium su 5 casi (tecnico forfettario col bollo = replica 034/2026: 98+2=100 e 55 leggibili; classico ordinario con IVA per gruppo 98+21,56=119,56; elegante con ★ su Premium; bold con acconto 30%; regressione a proposta singola INVARIATA). tsc+build+276+smoke 20/20 verdi.

### Fatto anche (18 lug septies — RI-REVIEW completa del lavoro di oggi + registro feedback + lotto UI serale)
Richiesta Eli "ricontrolla tutti i fix e aggiungi i feedback nel file md preposto" + 4 punti UI nuovi. Ri-review a 2 agent (conformità richiesta-per-richiesta: **14/14 CONFORMI**; correttezza runtime) sull'intero diff delle 8 PR di oggi, finding fixati:
- **[ALTA] nota/riepilogo multi-proposta citavano sempre la "Base"**, ma i totali del DOCUMENTO seguono la proposta CONSIGLIATA (fallback Base — documents.ts `docTierItems`): con la ★ su Premium il PDF diceva "si riferisce alla Base" mostrando i numeri della Premium. Ora `refTier = recommended ?? base` guida riepilogo IVA, nota PDF, nota in-app e "Totale proposta X" della pagina pubblica (prop `totalTierLabel`).
- **[MIO finding] righe IVA del riepilogo PDF** sommavano l'IVA di TUTTI i tier (ordinario) → ora contano solo la proposta di riferimento (verificato: 22,00 vs 66,00).
- **[MEDIA] auto-save aggirava il blocco Base=Premium** → nuova guardia SERVER `tierDuplicateSendError` (lib/documents/tier-check.ts, pura) al primo invio in `registerManualSendAction` e `send-email` (422).
- **BASSE**: COD del preset Tecnico ora GLOBALE nei gruppi (niente 01 doppi); markAll offline → messaggio "Sei offline" invece del reload; CTA "primo appuntamento" solo se non c'è MAI stato un appuntamento (conta anche i passati); riga misura 13.5→14px (regola mezzi pixel); ripulito un NBSP che rendeva doppio lo spazio in "Totale X €" dei gruppi.
- **DECISIONI_E_FEEDBACK.md**: nuova sezione "Collaudo Eli 17–18 lug" con TUTTE le decisioni del collaudo (✅/🔁/⏳) — d'ora in poi il registro copre anche questa giornata.
Lotto UI serale (richieste Eli):
- **Boot ≥3s con PRERISCALDAMENTO** (🔁 supera "nessuna durata fissa", istruzione esplicita): lo script di `/avvio` scalda `/dashboard /preventivi /fatture /altro` (fetch parallele, cap 8s) e naviga non prima di 3s → prima navigazione post-boot molto più rapida. Le tab della BottomNav hanno `prefetch={true}` (cambio tab quasi istantaneo entro staleTimes).
- **Card Home separate**: bordino oro leggero a sinistra (2px #e5d3a1) su agenda/scadenza/KPI/attività.
- **Riga "Ordina"** di Preventivi/Fatture in riquadro bianco bordato.
- **Tab di stato più visibili**: barra in riquadro bianco con bordo + tab attiva a pillola NAVY (verificato con Chromium a 360px: 1 riga, 0 overflow).
- **Card proposte con le VOCI PREZZATE** (richiesta successiva di Eli "voglio che già veda le singole voci lì"): `PublicTier.items` da `string[]` a oggetti completi (descrizione/qtà/unità/prezzo/totale riga, presi da `fiscal.itemTotals` → sconto voce incluso); il TierPicker mostra TUTTE le voci (via il cap 4/+N), descrizione a capo, dettaglio "qtà × prezzo" se qtà≠1, importo riga a destra. Verificato con Chromium a 360px: 0 overflow.

### Fatto anche (18 lug sexies — PUNTO CRITICO proposte al cliente + colore accento vero + Georgia corsivo)
Dagli screenshot del preventivo 034/2026 di Eli (Base 45 + Premium 55):
- **[GRAVE] PDF multi-proposta appiattito**: il "documento completo" mostrava le voci di TUTTI i tier in un'unica lista (01: 45€, 02: 55€) col totale della sola Base → incoerente per il cliente. Ora in `buildPdfHtml` con più tier le righe sono RAGGRUPPATE con intestazione "PROPOSTA BASE/PREMIUM (★ se consigliata) — Totale X €" (totale per proposta calcolato con `calcolaDocumento`, stessa formula del TierPicker), voci ordinate per tier, e NOTA sotto il riepilogo ("il riepilogo si riferisce alla Proposta Base…") via `tierNoteHtml` in testa a depositHtml (unico punto condiviso dai 4 preset; helper `withTierHeaders(renderItem, colSpan)`: classico/bold/elegante 4 col, tecnico 6). Dopo l'ACCETTAZIONE resta la sola proposta scelta (accept route elimina le altre) → resa normale. VERIFICATO con screenshot Chromium sull'HTML reale.
- **Riepilogo in-app** (dettaglio preventivo): voci raggruppate con etichette "Proposta Base/Premium" + nota che i totali si riferiscono alla Base. **Pagina pubblica**: "Totale" → "Totale proposta Base" + riga "Qui sotto trovi tutte le proposte…" quando c'è il TierPicker (MobilePublicCard, prop tierPicker già esistente).
- **[CAUSA VERA] colore accento "cambia solo la riga"**: `safeAccentColor` ripiegava sul navy già a luminance>0.4 → ORO, VERDE e TERRACOTTA della palette (3 su 5!) non coloravano MAI i testi. Nuova `darkenToReadable` (in TemplatePreview E template.ts): i colori medi vengono SCURITI mantenendo la tinta finché leggibili su bianco (oro → oro scuro); solo i quasi-bianchi (luminance>0.85) → navy. Verificato con screenshot: Elegante+oro ora colora occhiello/etichette/totale/riga.
- **Georgia corsivo** (richiesta Eli): nome nel bottoncino/menu font in corsivo (`italic: true` in FONTS) e nel template Elegante il NOME AZIENDA è in corsivo (preview+PDF; numero e totale lo erano già). Il corpo del documento resta dritto (leggibilità).
- **Copy foto form**: "…Scegli poi quali mostrare al cliente." (via il riferimento alla card).
- tsc+build+276+smoke 20/20 verdi.

### Fatto anche (18 lug quinquies — agenda sempre in Home, tab su una riga, dialog email compatto, installa in Home)
Terzo giro serale di Eli (lo screenshot delle "spaziature non cambiate" era delle 22:04 = PRIMA del deploy 22:14 e con la PWA sulla build vecchia — spiegato a Eli):
- **"Oggi in agenda" SEMPRE in Home**: agenda del tutto vuota → riga CTA "Aggiungi il tuo primo appuntamento" (→ /sopralluoghi/nuovo); oggi libero ma con impegni futuri → "Nessun impegno oggi". `getTodayEvents` ora ritorna `{events, hasUpcoming}` (2 count head in più nel Promise.all, tolleranti pre-migration).
- **Tab liste su UNA riga (supera la scelta a-capo del 16 lug — istruzione esplicita Eli "Rifiutati non deve andare a capo")**: `.cc-filter-scroll` → nowrap + overflow-x auto (scrollbar nascosta) + `.cc-tabs.cc-filter-scroll > *` con `flex: 1 0 auto` e padding 4px: le tab si DIVIDONO lo spazio della riga → vuoti uguali tra tutte le parole e riga sempre piena. Verificato con Chromium: 1 riga e ZERO overflow a 360px (anche in Testo grande) e a 320px; unico caso estremo 320px+cc-large = scroll di 30px invece dell'a-capo. Vale per preventivi/fatture/lavori (stesse classi); le tab di Impostazioni non usano cc-filter-scroll e restano com'erano.
- **Dialog invio email compattato** (Eli: "troppo grande"): messaggio 7→4 righe, tolto il paragrafo doppione "Il cliente riceve un link…" (lo dice già il sottotitolo), helper rubrica e ricerca clienti accorciati. Il base Dialog ha già max-h 90dvh/zoom + scroll interno.
- **Banner "Installa l'app" in HOME** (`InstallHomeBanner`, montato nella sezione mobile della dashboard): compare solo dal BROWSER (mai in standalone), e SPARISCE PER SEMPRE al primo tocco (Installa, "Come si fa" o ✕ — flag localStorage `cc_install_home_done`). Riusa il prompt nativo e l'`InstallSheet` (ora esportato) di InstallAppButton; la voce di Altro › Strumenti resta il percorso permanente.
- **Piano Pro**: domanda di prodotto — data a Eli una proposta (in chat) su cosa spostare/lasciare; NESSUN cambio di gating senza sua decisione.
- tsc+build+276+smoke 20/20 verdi · scan spazi pulito.

### Fatto anche (18 lug quater — foto dal form, tier identici bloccati, copy inviato, FONT self-hosted)
5 punti del secondo giro serale di Eli (migration 054 APPLICATA da Eli):
- **Foto allegate DAL form preventivo** (via la dicitura "salva la bozza e usa Foto lavoro"): in **Altre opzioni** (solo create mode) sezione "Foto lavoro" con Scatta/Galleria — upload immediato nello storage, percorsi nel campo hidden `photo_paths` → `createDocumentAction` inserisce le righe `work_photos` collegate al documento appena creato (best-effort, tetto Free 6 client+server, `visible_to_client: false`). Sulle bozze resta la card «Foto lavoro» del dettaglio.
- **Base = Premium BLOCCATO**: tolta la frase "Le voci della Base sono copiate…"; nuovo `getTierDuplicateError` in PreventivoForm (confronto normalizzato e insensibile all'ordine su descrizione/qtà/prezzo/sconto/IVA/unità) dentro `runPreSubmitValidation` → salvataggi manuali e invio bloccati con messaggio chiaro ("…cambia qualcosa o disattiva «Proponi più opzioni»"); l'auto-save NON è bloccato (salva silenzioso). Una bozza con tier identici non si può salvare → non arriva mai al Condividi del dettaglio.
- **Copy "Segna come Inviato"**: via "Riceverà il numero progressivo" (il numero è già assegnato alla creazione, B.3) → "…come Inviato? La scadenza ripartirà da oggi (N giorni)."
- **FONT davvero distinti sul TELEFONO (causa vera trovata)**: Android non ha Trebuchet/Verdana/Georgia (solo Roboto/Noto) → gli slot font cadevano sul sans di sistema "uguale a Inter" (per questo a Eli "Georgia non è più come prima" e "Trebuchet è come Inter"). Fix: **font SELF-HOSTED in `/public/fonts`** (GDPR ok, zero chiamate a Google dal client): slot 'Helvetica' → **Atkinson Hyperlegible** (400+700, chip "Atkinson — grande e chiaro"), 'Georgia' → fallback **Lora** (variabile 400-700; Georgia resta prima nello stack: su desktop invariata). @font-face in globals.css E nell'HTML dei PDF (`SELF_HOSTED_FACES` in template.ts, URL relativi ok anche negli iframe srcDoc); `/fonts/` in PUBLIC_PREFIXES (i clienti sloggati su /p/ li caricano) e nello smoke (20 check). VERIFICATO con Chromium senza Georgia/Trebuchet installati (= come Android): 4 font chiaramente diversi, Lora serif con bold/corsivo veri. ⚠️ REGOLA: gli stack dei template devono citare le famiglie self-hosted, non contare sui font di sistema.
- tsc+build+276+smoke **20/20** verdi · scan spazi pulito.

### Fatto anche (18 lug ter — avvio istantaneo, fix "segna tutte", Agenda in Home, misure nel sopralluogo)
6 punti del feedback serale di Eli (+ migration 054 DA APPLICARE):
- **"Non vedo le modifiche template"**: falso allarme — lo screenshot era su Impostazioni; i template sono in **Altro › Template documenti**. Deploy #128 verificato READY.
- **Avvio: boot screen SUBITO** — nuova pagina statica **`/avvio`** (start_url del manifest) col `BootScreen` condiviso (estratto dal layout) + script `location.replace('/dashboard')`; il SW (cc-v2) la PRECACHEA e la serve cache-first → primo frame ~istantaneo anche a freddo: splash di sistema via subito, spinner visibile mentre il server carica. Spinner con CSS inline (autosufficiente se la copia in cache punta a CSS di build vecchie). `/avvio` in PUBLIC_PATHS, robots disallow+noindex, smoke 19/19.
- **"Segna tutte come lette" (di nuovo)**: nessun errore server nei log Vercel → causa più probabile: **PWA aperta da giorni con build vecchia** (server action inesistente → fallimento SILENZIOSO; markAll ignorava anche l'{error}). Fix: markAll mostra l'errore (toast) e su eccezione ricarica l'app; nuovo **`VersionGuard`** globale (root layout) + **`/api/version`** (VERCEL_GIT_COMMIT_SHA): al rientro in app confronta la build — nascosta ≥30 min → reload automatico, altrimenti toast "Ricarica" (non si perde un form a metà). ⚠️ Per stavolta Eli deve chiudere e riaprire l'app una volta.
- **Calendario → "Agenda"** (decisione: parola d'ufficio che gli artigiani già usano; ROTTA `/calendario` invariata): titolo pagina, voce Altro "Agenda appuntamenti", aiuto/novità/LavoroForm.
- **"Oggi in agenda" in Home**: card compatta (solo se oggi c'è ≥1 impegno) — ora + titolo — cliente, tap → dettaglio, "Agenda →" → /calendario. Helper condiviso `lib/agenda.ts` (getTodayEvents, filtro giorno Roma ±36h, tollerante pre-migration); query nel Promise.all della dashboard. Mobile + desktop.
- **Calcolatore misure nel SOPRALLUOGO** (migration 054 `sopralluoghi.measurements JSONB`): negli Appunti bottone "Calcola una misura" → Calcolatrice in overlay centrato (pattern F13); "Salva" conserva il calcolo CON gli input (`lib/calc/misure.ts`: parseMisure/misuraText/misureToNotes, 9 test); le misure restano listate col dettaglio ("4 × 3,5 m +10% scarto = 15,40 m²"), un tocco le riapre GIÀ COMPILATE (Calcolatrice: nuove prop `initial`+`onSnapshot`, `fieldsForTab` con chiavi canoniche), ✕ elimina. Al "Trasforma in preventivo" finiscono nelle Note interne ("Misure calcolate: • …"). Salvataggio a cascata tollerante (054→047→pre-047) e campo toccato solo se il form lo invia (un client vecchio non azzera le misure).
- tsc+build+**276** test+smoke **19/19** verdi · scan spazi pulito · /avvio verificata su next start reale (statica ○, script redirect, spinner, manifest start_url, /api/version).

### Fatto anche (18 lug bis — template: Elegante più colorato, font a bottoncini, Trebuchet, anteprima lista scalata)
4 punti di collaudo Eli sui template:
- **Elegante, colore accento visibile**: prima il colore compariva SOLO nella riga separatrice; ora colora anche l'occhiello "Preventivo", le etichette (Destinatario/Data), e il valore del Totale — in TemplatePreview E in lib/pdf/template.ts (verificato con screenshot Chromium sull'HTML PDF reale: 5 occorrenze del colore, fallback navy con colori chiari via safeAccentColor). Il numero documento resta navy (decisione storica invariata).
- **Verdana → Trebuchet MS** (ricerca web: humanist sans del 1996, tra i più diffusi web-safe, chiaramente diverso da Inter): stack `'Trebuchet MS', Tahoma, sans-serif` in TemplateEditor/TemplatePreview/pdf. ⚠️ La chiave DB resta 'Helvetica' (enum Zod intoccabile) — cambiano solo stack ed etichette.
- **Pannello Font a bottoncini** come gli stili (griglia 2×2): nome nel SUO carattere sopra + descrizione grigia sotto (Inter/Moderno · Trebuchet/Grande e chiaro · Macchina/Tecnico · Georgia/Elegante). FONTS ora ha `name`/`desc` (il `label` lungo resta per il dropdown desktop).
- **Anteprima lista template non più "appiccicata"**: `PreviewScaler` (+RENDER_W 560) estratto da TemplateEditor in `PreviewScaler.tsx` condiviso e applicato anche al pannello espanso di MobileTemplateList (render a 560px → scala al contenitore, cc-zoom-neutral in Testo grande).
- tsc+build+267+smoke 18/18 verdi · scan spazi pulito.

### Fatto anche (18 lug — boot screen completo, copy formale, bilancio mese rapido)
- **Boot screen (richiesta Eli)**: il fallback in streaming ora è lo splash completo — marchio CC GRANDE nello stesso punto/taglia dell'icona di sistema + "Carta Canta" + "il tuo ufficio in tasca" + spinner. NON è lo splash a durata fissa rimosso il 17: sparisce appena l'app è pronta. (Supera la nota "non re-introdurre splash custom": istruzione esplicita di Eli 18 lug.)
- **Copy formale**: /scadenze "Le cose coi soldi da tenere d'occhio" → "Il quadro delle scadenze…" (+2 sottotitoli); Bilancio card Pro "quanto ti resta in tasca… senza commercialista" → "Entrate, uscite e utile del mese…"; tour "crealo al volo" → "crealo subito da qui". Tono amichevole del tutorial (👋 🎉) mantenuto (deliberato).
- **Bilancio, cambio mese lento**: frecce con `prefetch={true}` (payload del mese adiacente scaricato prima → cambio quasi istantaneo) + MonthPicker in useTransition con rotellina sul titolo mentre carica (prima nessun segnale).

### Fatto anche (17 lug sera/notte — controllo generale + 3 fix da collaudo Eli)
- **Controllo generale app (PR #121)**: nessun bug — copy/link/proxy/sw/env/test verificati puliti; 3 commenti stantii allineati (manifest post-AppSplash, percorso Testo grande, TierPicker impilato).
- **Q.tà tagliata su mobile (PR #122, screenshot Eli)**: su mobile gli input sono a 16px REALI (regola anti-zoom iPhone), non i 13px nominali → "402,25" del Calcola quantità usciva dal campo. Griglia voce ridistribuita (Unità 62px, gap 6px, padding 8px); in **Testo grande su telefono i 4 campi numerici passano a 2 per riga** (regola `.cc-voce-nums` in globals, solo <640px). Verificato con Chromium a 390/360px, normale+TG, valori realistici+estremi.
- **Numeri manuali duplicati BLOCCATI (PR #123, test di Eli: due preventivi "001/2026")**: helper `manualNumberError` in documents.ts — un numero scritto a mano non può coesistere con un altro documento ATTIVO dello stesso tipo (check in createDocumentAction e nei 2 salvataggi quando il numero CAMBIA; cestino escluso: al ripristino già riassegnato; errore transiente della verifica non blocca). Le fatture in creazione allocano sempre dalla sequenza.
- **Tondo di Altro = tondo della Home (PR #123)**: iniziali della PERSONA (Nome+Cognome, helper condiviso `lib/utils/user-initials.ts` usato da dashboard e Altro), forma a cerchio; col logo caricato si vede il logo. `WorkspaceLogo` ora ha prop `round`/`fallbackInitials`.
- tsc+build+267+smoke 18/18 verdi a ogni PR.

### Fatto anche (17 lug ter — DECISIONE Eli: AppSplash RIMOSSO, resta solo lo splash di sistema)
Dopo i tentativi di rendere continua la sequenza (navy PR #115, marchio centrato PR #116, marchio grande PR #118), Eli ha deciso: **all'apertura si vede UNA schermata sola, quella di sistema Android** (manifest: sfondo navy + icona CC). `components/shared/AppSplash.tsx` ELIMINATO e smontato dal layout (PR #119). ⚠️ NON re-introdurre uno splash custom senza istruzione esplicita. Il payoff "il tuo ufficio in tasca" NON è aggiungibile allo splash di sistema (Android accetta solo colore+icona): vive su landing e login. Comunicato a Eli.

### Fatto anche (17 lug bis — RE-REVIEW della PR #116 (2 agent freschi): 4 rifiniture, nessuna ALTA)
Richiesta Eli "controlla che non ci siano altri bug nelle ultime modifiche". 2 agent adversariali sulla sola PR #116 (l'unica non ancora revisionata), finding verificati di persona:
- **[MEDIA fondata] mailto rapportino**: il MIO fix precedente (`encodeURIComponent` sull'intera email) codificava anche la `@` → `nome%40dominio` non conforme RFC 6068 (qualche client di posta non decodifica). Ora la `@` resta letterale, si encodano solo i caratteri pericolosi (`.replace(/%40/g,'@')`).
- **[MEDIA confutata, blindata comunque] "nav morta" col quirk driver.js <400ms**: ENTRAMBI gli agent hanno verificato sul sorgente 1.6.0 che è irraggiungibile (markTour scatta in onHighlighted a fine animazione; il quirk salta onDestroyed solo PRIMA di quell'istante → finestre disgiunte). Cintura a costo zero: la regola pointer-events/z-index è ora scoped su `.driver-active nav.cc-tour-lift` — driver.js toglie sempre `.driver-active` alla chiusura, quindi anche una classe orfana non può lasciare la bottom-nav non cliccabile.
- **[BASSE splash] fixate**: `cc-portal-float` sull'AppSplash (in cc-large il marchio restava zoomato +15% e "saltava" rispetto all'icona di sistema; ora identico) e `marginTop: min(76px,12vh)` sui testi (in landscape basso il payoff usciva dal fondo).
- **Verificati puliti**: mappa option_tier end-to-end (serialize/server/tab/acconto), nearestScroller (in entrambe le collocazioni lo scroller è il main giusto), convergenza del loop iterativo (nessuna oscillazione, clamp browser innocuo), niente recommended_tier stantio al submit, ZodError su zod/v4 ok. Segnalati non fixati: both-fail nome+firma mostra solo il messaggio firma (raggiungibile solo bypassando il client); tap sulla tab illuminata = skip volontario del tour (deliberato, F16).
- tsc+build+267+smoke 18/18 verdi.

### Fatto anche (17 lug — scroll-jump del Testo grande, splash allineato, REVIEW del batch F8-F22: 1 ALTA fixata)
Feedback Eli (17 lug) + "ricontrolla tutto quello che hai fatto":
- **Scroll-jump al toggle "Testo grande"**: lo zoom 1.15 allunga la pagina ma lo scroll resta in px assoluti → il punto guardato scivolava via. Fix in TextSizeToggle: àncora sull'interruttore stesso (correzione iterativa dello scroller più vicino, delta/1.15 con zoom attivo). VERIFICATO con Chromium reale: drift 52px→0,0px in entrambe le direzioni.
- **Splash**: la prima schermata (icona su sfondo) è quella DI SISTEMA di Android per le PWA — non si può togliere. Già navy dal fix manifest (PR #115); ora l'AppSplash ha il marchio CC ESATTAMENTE al centro viewport (posizione assoluta 50%/50%, testi sotto a +76px) = stesso punto dove Android disegna l'icona → percepita come un'unica schermata. ⚠️ Sul telefono serve rimuovere/riaggiungere la PWA per vedere il nuovo colore di sistema.
- **REVIEW 3 agent sul diff F8-F22 (findings verificati di persona)**:
  - **[ALTA, pre-esistente] option_tier PERSO al re-edit**: la mappa document_items→VoceItem in PreventivoForm non copiava `option_tier` (041 non nei tipi) → riaprendo un documento a proposte tutte le voci finivano in Base e il SALVATAGGIO distruggeva i livelli (la pagina pubblica perdeva il TierPicker). Fixato (cast esplicito con whitelist dei 3 valori).
  - **[MEDIA] recommendedTier fantasma**: disattiva/riattiva opzioni su un doc con stella su "Consigliata" → stella su tier senza voci, anteprima acconto vuota in silenzio. Ora enable/disableOptions azzerano la stella orfana.
  - **[MEDIA] nav.cc-tour-lift cliccabile sopra l'overlay** del benvenuto: un tap su una tab navigava e il tour moriva senza essere segnato saltato (ripartiva al ritorno in Home). Fix: `pointer-events: none` sulla nav alzata (il tap cade sull'overlay = skip volontario, come pre-F16).
  - **[MEDIA] toast 12s residuo** (successo photo-AI) → tolto (F21).
  - **BASSE fixate**: 400 della firma rapportino con messaggio giusto se a sforare è l'immagine (prima diceva "scrivi il nome" e il rate-limit mangiava i tentativi); email encodata nel mailto del rapportino.
  - **Segnalati NON fixati (motivati)**: tap singolo = firma valida (ereditato dal preventivo, identico); firma obbligatoria solo client-side (deliberato per client in cache); errore DB transiente→404 su /r (pattern pre-esistente); popover benvenuto sopra la nav in landscape basso (estetico); anelli F16 compaiono ~400ms dopo il popover (animazione driver.js); tab Consigliata legacy non rimovibile in sessione (sparisce al reload).
- tsc+build+267+smoke 18/18 verdi · scan spazi pulito.

### Fatto anche (16 lug notte — FEEDBACK F8-F22: TUTTA la lista completata)
Batch finale della lista di collaudo (dopo F1-F7). Un punto per volta col metodo "verifica → controlla in app → valuta → implementa → controlla":
- **F8** — Proposte preventivo: attivando le opzioni si creano solo **Base+Premium** (niente più tier "Consigliata" ridondante); "Segna come Consigliata ★" elegge una delle due. I documenti VECCHI a 3 tier restano leggibili (la tab Consigliata compare solo se ha voci).
- **F9/F10/F11** — Note descrittive con margine dal bordo (wrapper F9 condizionale, niente vuoti senza AI); note ACCORCIATE (photo-AI, foto, tier); "Altre opzioni" con **divisori** tra le voci (divide-y al posto di space-y).
- **F12** — "Importa da preventivo" su /fatture/nuovo: full-width centrato, niente più doppio rientro.
- **F13** — Tendina "Calcola quantità" ora **centrata** (maxWidth 440, maxHeight 82dvh/var(--cc-zoom)) invece che ancorata in basso e tagliata.
- **F14** — "Schermo e leggibilità" (TextSizeToggle) spostato in **Altro › Strumenti** su mobile; ⚠️ su DESKTOP resta in Impostazioni › Generale (`hidden lg:block`) perché la sidebar desktop NON ha la voce Altro (sarebbe stato introvabile). Copy aggiornato in tour/aiuto/novità (aiuto cita entrambi i percorsi).
- **F15** — Notifiche: tolta la dicitura "Le modifiche vengono salvate automaticamente" (c'è già il toast).
- **F16** — Tutorial: (a) tolto "Aa" dal bottone testo grande; (b) il benvenuto **marca in bianco la tab Altro** nella bottom-nav (`markTour`/`clearTourMarks` + CSS `.cc-tour-mark` anello bianco+oro e `nav.cc-tour-lift` z-10001 sopra l'overlay; testo responsive `.cc-tour-mobile`/`.cc-tour-desktop`); (c) il passo 3 marca il riquadro descrizione+microfono (`data-tour="voce-mic"` in VociTable desktop+mobile) e il bottone foto AI (`data-tour="ai-foto"`); (d) passo finale con **badge DEMO** disegnati nel popover (colori veri di StatusBadge). Anelli ripuliti in onDestroyed + cleanup pathname (quirk driver.js <400ms).
- **F17 (BUG vero)** — "Segna tutte come lette" non salvava MAI se tra le notifiche c'era un richiamo: la chiave `richiamo:{uuid}:{timestamp}` non passava la regex di `markNotificationsReadAction` (non ammetteva il 2° ":" né +/.) → cleanKeys vuoto → no-op silenzioso. Fix: regex `/^[a-z_]+:[\w.:+-]+$/` + len≤120; e l'`{error}` dell'upsert non si ingoia più (supabase-js non lancia).
- **F18** — Copy richiamo: "…promemoria nella campanella **nella Home**."
- **F19** — Rapportino: bottone "Crea link per la firma"→"**Crea rapportino da inviare**"; creato il link, riga compatta con i 3 canali **Email / WhatsApp / Copia link** (Email = `mailto:` dalla posta dell'artigiano — NIENTE email automatiche ai clienti finali, regola B.0). `clientEmail` aggiunta a RapportinoData.
- **F20** — Rapportino con **firma a mano** (canvas) come il preventivo: `SignatureCanvas` estratto in `components/public/` (lo usa anche AcceptModal), obbligatoria nel form /r/[token], salvata in `lavori.report_signature_image` (**migration 053**, data URI PNG ≤64KB) e mostrata nella pagina firmata. Route sign TOLLERANTE pre-migration (42703 → retry senza colonna: la firma va a buon fine senza immagine). Migration 053 APPLICATA da Eli (17 lug). Domande legali (valenza, privacy, conservazione firma) nel PDF UNICO avvocato del 17 lug (inviato in chat, non nel repo).
- **F21** — ⚠️ REGOLA PERMANENTE (Eli): i toast di successo durano MAX 4s e si chiudono da soli. `<Toaster duration={4000}>` + rimossi tutti gli override 5-10s dai toast.success/info (~25 punti). Gli ERRORI (rossi) e il warning logo restano più a lungo (deliberato: fuori dal "verde" di Eli).
- **F22** — `WorkspaceLogo` estratto in `app/(app)/_components/WorkspaceLogo.tsx` (prop `size`): la scheda profilo di **Altro** ora mostra il LOGO caricato (iniziali solo come fallback), identico all'header. FIX-31 preservato (useState proprio per onError).
- tsc+build+267 test+smoke 18/18 verdi · scan spazi pulito.

### Fatto anche (16 lug — FEEDBACK Eli batch (22 punti F1-F22): F1+F2)
Lista feedback di collaudo (task F1-F22). Fatti i primi due:
- **F1** — Freccia indietro (BackButton fallback /altro) aggiunta alla fascia titolo mobile di **Clienti** e **Catalogo** (prima non c'era).
- **F2** — Testo visibile "Farti trovare dai clienti" → **"Fatti trovare dai clienti"** ovunque (Altro, pagina, metadata, aiuto, novità, email). ⚠️ La ROTTA `/farti-trovare` resta invariata (URL, cambiarlo romperebbe i link).
- tsc+build+267+smoke 18/18 verdi. Poi F3-F7 (PR #112): editor template compatto, hub /scadenze, ordina per numero, AI import "Da controllare"+"Trasforma in preventivo" con titolo/note riportati.

### Fatto anche (16 lug sera — "Testo grande" scopribile dal tutorial)
Punto 2 delle considerazioni post-accessibilità (ok Eli "implementa pure"): chi ha bisogno del testo grande non va a cercarlo nelle Impostazioni. Nel **passo di benvenuto del tutorial** ora c'è un bottoncino pillola ("Aa Scritte piccole? Attiva il testo grande") che attiva/disattiva la modalità ALL'ISTANTE (stessa logica di TextSizeToggle: localStorage `cc_large` + classList) — l'app si ingrandisce sotto gli occhi durante il tour. Cablato via `onPopoverRender` di driver.js (bind sull'id `cc-tour-textlarge`, presente solo nel passo 1); sotto il bottone la nota "Si cambia quando vuoi in Impostazioni › Generale". tsc+build+267 verdi.

### Fatto anche (16 lug sera — REVIEW ADVERSARIALE del lavoro di giornata: 3 agent, 1 ALTA + fix zoom)
Richiesta Eli "ricontrolla tutto quello che hai inserito oggi". 3 agent (logica componenti nuovi · effetti zoom cc-large · navigazione/copy), ogni finding verificato di persona. Fixati:
- **[ALTA] quantità dal calcolo Volume ×1000**: volumeMc arrotondava a 3 decimali → "2,376" nel campo Quantità (NumericInput non-locale) mostrato "2.376" → al blur parseImportoIt lo rileggeva come MIGLIAIA → 2376. Ora volumi a 2 decimali come tutta l'app (+ test di regressione, 267 verdi).
- **[ALTA] zoom cc-large disallineava i layer flottanti** (~15%): VERIFICATO EMPIRICAMENTE con Chromium reale (drift 59,6px su 390px; col contro-zoom 0,0px). Fix: `zoom: 0.869565` (=1/1.15) su `body > [data-radix-popper-content-wrapper]` (Select/Popover/Dropdown/Tooltip Radix), `.driver-overlay`/`.driver-popover` (tour e mini-tour) e `.cc-portal-float` (classe nuova su ClientAutocomplete + SendEmailDialog). ⚠️ REGOLA: ogni nuovo portale su body posizionato con getBoundingClientRect deve avere la classe `cc-portal-float`.
- **[MEDIA] dvh/vh dentro il body zoomato** valgono +15% → sforavano il viewport: dialog.tsx `max-h-[calc(90dvh/var(--cc-zoom,1))]`, ShareButton e CalcQuantitaButton idem (var `--cc-zoom`: 1 di default, 1.15 in cc-large).
- **[MEDIA] AppSplash inchiodato in dev StrictMode** (marcatore scritto subito + cleanup che cancellava i timer → secondo giro usciva senza rischedularli): ora il marcatore si scrive a splash FINITO. + getItem nel try (con storage bloccato dal browser l'accesso a sessionStorage LANCIA → crashava l'app).
- **[MEDIA] BottomNav**: `/farti-trovare`, `/calcoli`, `/account` mancavano da ALTRO_PREFIXES → nessuna tab attiva navigandoci.
- **BASSE**: InstallAppButton prompt() in try con fallback istruzioni (doppio tap) + scroll lock sull'InstallSheet; riporto area tra linguette ora SENZA scarto (doppio conteggio); robots.ts + disallow nuove route; email marketplace_richiesta "sezione Richieste"→"Altro › Farti trovare dai clienti › Richieste"; /novita voce nuova (calcoli, testo grande, menu, correggi totale, installa); /aiuto +3 FAQ (calcoli, testo grande, farti trovare).
- **Segnalati NON fixati (motivati)**: /professionisti senza back in-app (pagina pubblica, il back del browser funziona; un fallback a /farti-trovare romperebbe gli anonimi); cc-tabs in cc-large al limite su 360px (degrado pilotato: c'è cc-filter-scroll); modalità cc-large valida per dispositivo su tutte le route incluse /p/ e /studio (da collaudo Eli se dà fastidio).
- tsc+build+267 verdi · smoke 18/18 · scan spazi pulito · contro-zoom verificato nel CSS buildato.

### Fatto anche (16 lug — ACCESSIBILITÀ over-50: modalità "Testo grande e leggibile" + Altro alleggerito)
Da ricerca web (mockup prima/dopo approvato). **DECISIONE Eli: di default l'app resta IDENTICA; la leggibilità potenziata è OPT-IN; la struttura alleggerita vale per tutti.**
- **Modalità "Testo grande e leggibile"** (classe `cc-large` su `<html>`): interruttore in **Impostazioni › Generale** (`components/shared/TextSizeToggle.tsx`, localStorage `cc_large`); script inline nel root layout la applica PRIMA del primo paint (niente flash; `suppressHydrationWarning` su `<html>`, pattern theme-switcher). Effetti: `zoom:1.15` sul body (tutto più grande, testo E bersagli); `--cc-muted` da #8a887f a #55534b (grigi secondari più scuri, ~3,5:1→~6:1); le `.cc-desc` diventano visibili.
- **`--cc-muted`**: TUTTE le 249 occorrenze inline di `'#8a887f'` + 9 `text-[#8a887f]` sostituite con `var(--cc-muted)` (default identico #8a887f → zero cambi visivi di default). ⚠️ REGOLA: per il grigio dei testi secondari usare SEMPRE `var(--cc-muted)`, mai il letterale.
- **Altro alleggerito PER TUTTI** (21→18 voci, 6→5 sezioni): le 4 voci marketplace (Richieste/Recensioni/Profilo/Vetrina) accorpate in **"Farti trovare dai clienti"** → nuova pagina **`/farti-trovare`** (badge richieste nuove risale sulla voce; sottotitolo sempre visibile `descAlways`); sezioni rinominate: **Ogni giorno · Soldi · [Farti trovare] · Strumenti · Account e aiuto**; "Installa l'app" spostata in Strumenti (via sezione "App"). BackButton di richieste/recensioni/marketplace → fallback `/farti-trovare`.
- **`MenuRow` con prop `desc`** (sottotitolo esplicativo, visibile solo in cc-large salvo `descAlways`): Lavori, Calendario, Sopralluoghi, Bilancio, Catalogo, Template, Impostazioni, Account e dati, Cestino.
- tsc+build+266 verdi · smoke 18/18 · scan spazi pulito (il match "furgone" è dopo un `<br/>`, innocuo). Da collaudare da Eli (interruttore ON/OFF + nuova Altro).

### Fatto anche (16 lug — CALCOLATRICE di cantiere, Opzione 1 + 4 scelte da Eli)
Dopo mockup Artifact approvato, Eli ha scelto "sia la 1 che la 4". Fatto tutto client, nessun DB:
- **`lib/calc/calc.ts`** (PURE, 13 test): `areaMq` (L×W+scarto→m²), `volumeMc` (×H→m³), `piastrelle` (area+formato cm→pezzi ceil + m² con scarto), `verniceLitri` ((area×mani)/resa). `applicaScarto` NON arrotonda (lo fanno area/volume) → test con toBeCloseTo.
- **`components/calc/Calcolatrice.tsx`**: linguette Superficie/Volume/Piastrelle/Vernice; input formato IT (parseImportoIt); risultati con "Usa" (se prop `onUse`) o "Copia" (navigator.clipboard). Note "controlla la scatola/latta" su piastrelle/vernice.
- **Opzione 1** — `components/calc/CalcQuantitaButton.tsx`: pulsantino "📐 Calcola quantità" per OGNI voce in VociTable (dopo VoceBadges) → tendina dal basso → "Usa" riempie `quantity` di quella voce (`updateVoce`). Vale su preventivo E fattura (VociTable condivisa).
- **Opzione 4** — **`app/(app)/calcoli/page.tsx`** (nuova): stessa Calcolatrice in modalità "Copia", raggiungibile da **Altro › Strumenti › "Calcoli (metri quadri, piastrelle…)"** (icona Calculator). Serve anche "durante il sopralluogo".
- **Self-review (16 lug, richiesta Eli "valuta se è al meglio") → 2 migliorie**: (1) "Usa" imposta anche l'UNITÀ della voce (mq/mc/lt/pz) via `onUse(value, unitValue)` — prima un'area diventava "13,86 pz"; l'unità si applica solo se in `units`; (2) riporto area: calcolando la Superficie e passando a Piastrelle/Vernice il campo superficie è già compilato (solo se vuoto, `goTab`).
- tsc+build+266 verdi; scan spazi Turbopack pulito. Da collaudare da Eli.

### Fatto anche (15 lug sera — "ultima verifica" richiesta da Eli: 3 agent freschi su TUTTA l'app, 12 fix)
Dopo la gap analysis, Eli ha chiesto un'ultima verifica totale. 3 agent (vicoli ciechi/link rotti · robustezza runtime/config · copy/coerenza decisioni), ogni finding verificato di persona. Nessun link rotto su 44 route+16 email+notifiche; nessuna env server letta in client; webhook Stripe/SdI solidi. Fixati:
- **[MEDIA sicurezza] cron fail-OPEN**: `secret !== process.env.CRON_SECRET` con env mancante passava (undefined===undefined) → chiunque poteva innescare le email ai clienti (expire-documents) o i premi referral. Ora fail-closed (`!process.env.CRON_SECRET ||`) come già faceva il webhook SdI.
- **[MEDIA] storico aperture perdeva righe**: insert `document_views` fire-and-forget in `/api/p/[token]/view` → su Vercel la lambda può congelarsi prima che l'insert parta (l'IP ha valore probatorio accanto alla firma FES). Ora await in try/catch. Stessa classe: welcome email in signupAction ora await.
- **[MEDIA] copy stantio post-spostamento /account** (4 punti sfuggiti il 14 lug): aiuto:78 pacchetto commercialista "(o Impostazioni)", novita:34+41, **studio/page.tsx:51** ("Impostazioni › Dati › Il tuo commercialista" — istruzione che il commercialista gira all'artigiano!) → tutti "Altro › Account e dati".
- **[MEDIA] "Fattura Fatt. 001/2026"** sul dettaglio Lavoro (lavori/[id]:188): violava la regola B.3 — tolto il marcatore 'fattura' nel testo già prefissato.
- **[MEDIA] HEIC ancora accettato da scan-receipt** (foto scontrino): stessi provider vision di extract-photos → 502 fuorviante con quota consumata. Rimosso heic/heif (iOS converte da solo con accept="image/*"), messaggio 415 chiaro.
- **Etichetta "Da fare" estesa OVUNQUE** (era solo sul filtro): badge di stato (lavoro-status.ts, usato anche dalle pill del form), empty state /lavori, /prova, /novita — prima filtro e badge dicevano due nomi diversi sulla stessa schermata.
- **BASSE**: tel: non normalizzato su clienti/[id] (spazi nel numero → URI non conforme); ServiceWorkerRegister non registrava se `load` era già scattato prima dell'hydration (ora check readyState); global-error.tsx usava classi Tailwind ma sostituisce il root layout dove globals.css potrebbe non esserci → tutto inline + link "Torna alla Home"; commento stantio AccountantCard.
- **Segnalati NON fixati (noti/deliberati)**: [DATA] placeholder nelle legali + sezione cookie della privacy (cancello avvocato); precache SW aggiornata solo al cambio di sw.js (architetturale, impatto minimo); mockup/SPEC interni stantii sul tutorial.
- tsc+build+249 verdi · smoke 18/18 · scan spazi Turbopack pulito.

### Fatto anche (15 lug — gap analysis da ricerca web: SEO/lancio, 3 fix + azioni Eli)
Richiesta Eli "pensi che sia davvero chiuso tutto? fai una ricerca web". 4 ricerche (pre-launch SaaS · PWA/TWA Play Store · legale GDPR Italia · SEO tecnico/monitoring) incrociate con lo stato del repo. Esito: quasi tutto già coperto (cookie banner opt-in, assetlinks, maskable icon, Data Safety, backup/rollback…), 3 gap reali fixati:
- **🔒 `/p/[token]` SENZA noindex** (il gap più serio): la pagina pubblica del preventivo (nome cliente + importi) era indicizzabile da Google se il link circolava; `/r/[token]` era già protetto. Aggiunto `robots: { index:false, follow:false }` in generateMetadata.
- **`app/robots.ts` + `app/sitemap.ts`** (nuovi): robots esclude le route dell'app dal crawl ma NON blocca `/p/`/`/r/` (il noindex funziona solo se Google può leggere la pagina — link-only indexing altrimenti); sitemap con le 8 pagine pubbliche. Entrambi aggiunti a PUBLIC_PATHS del proxy (stessa lezione PR #11) e allo smoke test (16→18 check, **18/18 verdi qui**).
- **COSE_DA_FARE_ELI.md sezione 7 nuova** (operatività post-lancio): uptime monitoring (UptimeRobot — Sentry copre gli errori, non il sito giù), Google Search Console + invio sitemap, verifica backup Supabase + prova di restore.

### Fatto anche (15 lug — test Tier 2: 213→249, sbloccati da Eli "procedi pure")
36 test nuovi con mock (niente DB reale), pattern del repo (vi.mock hoistati + catena Supabase finta "a coda di risultati"):
- **`tests/unit/referral/register-use.test.ts`** (7): codice vuoto→no-op senza client, normalizzazione trim+upper, codice inesistente/workspace mancante/auto-invito→nessun insert, happy path col payload esatto, client che esplode→NON propaga (best-effort).
- **`tests/unit/lavori/actions.test.ts`** (18): setRecall (sessione scaduta, data malformata, 08:00 Roma con offset +02:00 estivo, nota troncata a 300, rimozione, rowcount 0→"non trovato", 42703→messaggio migration 052) · startTimer (guardia `is timer_started_at null` presente nella query, 0 righe→"già in corso") · stopTimer (fake timers: 25 min sommati, minimo 1 min, nessun timer→errore) · addLaborMinutes (0/NaN/tetto→errore senza query, timer in corso→"ferma prima", clamp a 0, somma, lavoro assente).
- **`tests/unit/ai/extract-photos-route.test.ts`** (11): flag off→404, 401, quota→403+paywall, multipart senza foto/HEIC/oltre 8MB→400, JSON senza id→400, **IDOR→404**, **catalogo illeggibile→503 SENZA chiamare l'AI né consumare quota**, happy path (prezzo SOLO dal catalogo: match→120+unit del catalogo+price_source catalog, no-match→0+todo; qty_source notes/todo; recordAiExtraction chiamato), Mistral+OpenAI giù→502 senza quota. ⚠️ AI_ENABLED letto all'import → `vi.resetModules`+`stubEnv`+import dinamico; `vi.clearAllMocks()` nel beforeEach (i contatori sopravvivono tra i test).
Tier 3 (E2E con DB) resta in backlog.

### Fatto anche (15 lug — assetlinks.json via env + feature graphic + PDF avvocato 15 lug + registro)
- **`app/.well-known/assetlinks.json/route.ts`** (nuovo): Digital Asset Links per la TWA del Play Store guidato da env — con `TWA_SHA256_FINGERPRINT` su Vercel (anche più fingerprint, virgola) il file si pubblica da solo; senza, 404. `TWA_PACKAGE_NAME` opzionale (default app.cartacanta.twa). `/.well-known/` aggiunto a PUBLIC_PREFIXES del proxy. **Verificato con next start reale**: 404 senza env, JSON corretto con env. Eli non deve più aspettare una mia sessione per il fingerprint.
- **Feature graphic Play Store** 1024×500 (marchio su crema + riga oro, da app/logo-firma.png via PIL) inviata in chat. **PDF avvocato COMPLETO_15lug2026** rigenerato col punto 15 (conferma Data Safety) e inviato in chat — sostituisce il 14 lug. **REGISTRO_AGGIORNAMENTI** allineato (voce 14-15 lug + sintesi 7-13).
- Verificato: il cron purge dei workspace cancellati NON è un gap pre-lancio (la cancellazione account elimina subito i dati non fiscali; il purge riguarda solo la ritenzione decennale fiscale → 2036).

### Fatto anche (15 lug sera — QA ADVERSARIALE sulle 18 PR della giornata: 3 agent, 1 ALTA + 1 MEDIA fixate)
3 revisori indipendenti sull'intero diff (perf refactor · tour/client · sicurezza/script/stili), ogni finding verificato di persona. Il refactor perf (11 pagine) è uscito PULITO (gate, join, finestra 6 mesi, thenable, retry pre-migration: tutto corretto — verificato perfino il trigger updated_at del DB). Fixati:
- **[ALTA] tour che RIPARTIVA dal passo 1 a ogni ritorno in Home** dopo il completamento: la prop `tourDone` del layout resta stantia per tutta la sessione SPA (markTourDoneAction non revalidava) e la rimozione della Fase C aveva reso raggiungibile il loop sul flusso felice. Fix doppio: flag `cc_tour_done` in sessionStorage controllato nella guardia + `revalidatePath('/(app)','layout')` nell'action (copre le altre tab).
- **[MEDIA] driver.js 1.6 non emette onDestroyed se destroy() arriva entro la prima animazione (~400ms)** → `phaseChangeRef` restava true e la successiva chiusura volontaria NON veniva registrata come skip. Fix: reset esplicito dei ref dopo destroy() nel cleanup. (Caso residuo Escape<400ms: degrado innocuo, documentato.)
- **[MEDIA] smoke-public non partiva su Windows** (il PC di Eli): spawn npx senza shell (hardening Node CVE-2024-27980) → `shell: process.platform==='win32'` + guardia "porta 3111 occupata" (evita di testare un server orfano/stale).
- **BASSE**: copy del carosello rimasto nel TierPicker impilato ("Scorri per vedere…" → "Scegli la proposta…"); ombra della pillola attiva clippata su /lavori (padding-bottom 0 → 15, margin card compensato); riga morta document_views nel wipe del seed (non ha workspace_id; cascade dai documents); assetlinks con env di soli separatori → 404 invece di JSON con array vuoto; timestamp malformato del mini-tour ora scade subito; commento stantio "6 passi/3 fasi".
- **Non toccati (motivati)**: tab "sparse" su desktop largo (estetica, coerente con la scelta mobile di Eli); empty-state della Home per workspace fermi >6 mesi (edge documentato, beta); disallineamento header/righe in AiImportModal (pre-esistente); StrictMode dev-only sul restart del tour (pre-esistente). tsc+build+249 verdi + smoke 16/16.

### Fatto anche (15 lug — GITGUARDIAN: password demo esposta nel repo pubblico, bonificata)
Email GitGuardian a Eli: "Company Email Password exposed" (push 15 lug 08:25 UTC = PR #87 con PLAY_STORE_SCHEDA.md). Verità: la password del demo era nel repo PUBBLICO **dall'8 lug** (hardcoded in scripts/seed-demo.ts), la scheda l'ha solo ri-esposta in formato riconoscibile. Scan completo del repo: NESSUN altro segreto (solo template vuoti in .env.example). Bonifica: `DEMO_PASSWORD` ora SOLO da env (guardia: exit 1 se manca o <12 char; l'output non stampa più la password); credenziali rimosse da PLAY_STORE_SCHEDA.md e scripts/README.md; `DEMO_PASSWORD=` aggiunto a .env.example; regola permanente B.1.2-bis. ⚠️ AZIONI ELI: (1) DEMO_PASSWORD nuova in .env.local, (2) `npm run seed:demo` → RUOTA la password in prod (se l'account non era mai stato creato, la vecchia non apre nulla), (3) segnare risolto l'incident su GitGuardian. La password vecchia va considerata bruciata.

### Fatto anche (15 lug — punto 4: smoke test pagine pubbliche, `npm run smoke:public`)
**`scripts/smoke-public.mjs`** (+ script npm + doc in scripts/README.md): avvia `next start` col build di produzione e credenziali Supabase FINTE (zero contatto col DB) e verifica in ~10s: pagine pubbliche 200 con contenuto chiave (/, /prova, /login, /signup, /verifica-email, legali), file PWA raggiungibili (manifest/sw.js/offline/opengraph-image — regressione PR #11), route protette → 30x verso /login (/dashboard, /preventivi, /impostazioni, /account). Uscita 1 al primo problema. **Eseguito qui: 16/16 verdi.** Il crash di /p/[token] del 6 lug sarebbe stato intercettato da questo giro. Uso: `npm run build && npm run smoke:public` prima dei rilasci importanti (non c'è CI: è una guardia manuale).

### Fatto anche (15 lug — punto 3: Home senza fetch illimitato)
Chiuso il follow-up della sessione perf: la query documenti della dashboard scaricava l'INTERO storico (13 campi, nessun limit) per KPI/trend/feed. Ora: (1) query principale limitata a `updated_at >= inizio finestra trend` (6 mesi — accettazioni e incassi aggiornano updated_at, quindi KPI/trend identici); (2) **query dedicata sulle ATTESE** (sent/viewed anche vecchie: solleciti, "scade domani", conteggio "Altri N"); (3) **conteggi bozze** con `head:true` (niente righe scaricate). Semantica KPI invariata; unico edge: il feed "Attività recente" mostra solo attività degli ultimi 6 mesi (prima mostrava anche storico più vecchio — irrilevante in beta). tsc+build+213 verdi.

### Fatto anche (15 lug — punto 1: FAQ aggiornate + scheda Play Store · punto 2: demo arricchito)
Lista "cose che posso fare io" approvata da Eli, un punto per volta:
- **Punto 1 (PR #87, deploy READY)**: /aiuto +5 FAQ (preventivo dalle foto dietro flag AI · Apri lavoro/Lavori · ore in cantiere · richiami · rapportino); **PLAY_STORE_SCHEDA.md** (repo + inviato in chat): titolo 24/30, short 76/80, descrizione ~1.700/4.000, Data Safety (⚠️ da far confermare all'avvocato), note revisori con account demo, checklist grafiche, ⚠️ nodo POLICY PAGAMENTI GOOGLE (abbonamento in-app nella TWA richiede Play Billing → consigliata opzione "upgrade solo dal sito") + tipo account (Personale vs D-U-N-S).
- **Punto 2**: `scripts/seed-demo.ts` arricchito — hourly_cost 30 sul workspace (tollerante), 3 LAVORI (in_corso col preventivo accettato collegato + 150 min timer + prossimo intervento; finito con rapportino FIRMATO e richiamo GIÀ SCATTATO ieri → notifica campanella visibile in demo; da_iniziare con appuntamento), spesa collegata al lavoro (economia con margine reale), 2 sopralluoghi (uno con appuntamento domani → agenda/Calendario), 2 aperture sul preventivo accettato (storico "visto"). Tutto tollerante pre-migration con warn non bloccanti. Dry-run con env finte validato (fallisce solo alla rete). ⚠️ Lo rilancia Eli: `npm run seed:demo`.

### Fatto anche (15 lug — MINI-TOUR dalla checklist "Completa il profilo" + tour principale arricchito)
Scelta Eli: "parti con la A e aggiungi il miglioramento del tutorial (funzioni in più da far vedere)". Implementato il pattern più efficace della ricerca onboarding (checklist → micro-guida, ~67% completamento):
- **`components/tour/MiniTourController.tsx`** (nuovo): toccando una voce NON fatta della checklist in Home si atterra sulla pagina giusta e una guida driver.js di 1-2 passi evidenzia DOVE agire, con **interazione permessa** sull'elemento evidenziato (disableActiveInteraction:false — l'utente può scrivere subito). Innesco: `CompleteProfileCard` salva `cc_minitour="<key>:<ts>"` in sessionStorage (scade in 2 min); **`MiniTourLoader`** (nuovo, dipende dal pathname perché la nav è client-side) carica il motore solo se c'è una guida in attesa. Mai sopra il tour principale (check body.driver-active). Passi il cui elemento non esiste (es. card AI dietro flag) vengono filtrati a runtime.
- **5 mini-tour**: dati→`#ragione_sociale` · phone→`#telefono` · logo→`[data-tour="logo-card"]` (generali.tsx) · ateco→`[data-tour="ateco-field"]` (fiscali.tsx, wrapper nuovo) · listino→2 passi `[data-tour="importa-ai"]`+`[data-tour="nuova-voce"]` (catalogo/page.tsx).
- **Tour principale**: passo 3 ora menziona anche il preventivo dalle foto (solo se `NEXT_PUBLIC_AI_IMPORT_ENABLED`); passo finale aggancia le mini-guide ("Per il resto, segui Completa il profilo in Home").
- tsc+build+213 verdi. Da collaudare da Eli: Home → tocca una voce della checklist → la guida compare sulla pagina di destinazione.

### Fatto anche (15 lug — feedback collaudo photo-to-quote di Eli: badge chiari + prompt posa)
Dal collaudo con foto vera (bagno): (1) **badge incomprensibili** ("dal tuo catalogo"+"da compilare" affiancati senza contesto) → etichette ESPLICITE sul campo: **"prezzo dal tuo catalogo" / "prezzo da inserire" / "quantità da inserire"** (VoceBadges in VociTable); (2) **water sospeso descritto "a pavimento"** → nuova regola nel SYSTEM_PROMPT di extract-photos: dettagli di posa (a pavimento/sospeso/a muro/incasso) SOLO se inequivocabili nella foto, altrimenti descrizione senza il dettaglio + confidence bassa; con varianti a catalogo, scegliere solo se la foto conferma. (3) **Foto non recuperabili dopo l'analisi**: oggi le foto scattate col bottone AI si usano SOLO per l'analisi e non vengono salvate (scelta MVP); il giro dal SOPRALLUOGO le conserva già. Proposta a Eli (in attesa di decisione): salvare automaticamente le foto analizzate come foto del lavoro sul documento.
Dal mockup Artifact (sezioni-tagliate-proposte) Eli ha scelto: **1-2-3 = proposta A**, **4 = alternativa impilata**, più la richiesta "lo spazio TRA le parole sempre uguale" (con flex:1 'Tutti' aveva molto più vuoto attorno delle etichette lunghe). Applicato:
- **globals.css `.cc-tab`/`.cc-tab-active`**: rimosso `flex:1` (ogni tab alla sua larghezza naturale → col `justify-content:space-between` del container i vuoti tra le parole sono TUTTI uguali); pillola attiva più snella (padding 22→14px, inattivi 5→2px) → le 5 tab di Preventivi/Fatture entrano su 360px senza scroll.
- **/lavori**: i filtri pill custom (navy/bordi, sforavano di ~70-100px: "Fatturati" fuori schermo) sostituiti con le stesse classi `cc-tabs cc-filter-scroll` + etichetta **"Da iniziare" → "Da fare"** (key `da_iniziare` invariata) → coerenza con Preventivi/Fatture e tutto visibile.
- **TierPicker (pagina pubblica /p/[token])**: carosello orizzontale (card 200px, la seconda si vedeva a metà) → **card impilate in verticale** a piena larghezza: tutte le proposte visibili subito.
- tsc+build+213 verdi.

### Fatto anche (14 lug sera — tutorial ottimizzato da ricerca web: 6→5 passi + chiusura "in azione")
Richiesta Eli "migliora il tutorial: ricerca web → elenca → valuta → applica". Dati chiave (Appcues/Pendo/Userpilot/Amplitude/Chameleon): oltre 5 passi l'abbandono sale al ~63% (3 passi ≈72% completamento, 7 ≈16%); copy ≤140 caratteri benefit-led; tour "in azione" batte il passivo 2-3×; skip da rispettare (già ok); rilancio volontario da rendere visibile. Applicato:
- **6→5 passi**: gli ultimi due (spiegazione stato/cronologia + "Hai finito") fusi in un unico finale benefit-led con invito all'azione. `TOTAL=5`, benvenuto aggiornato ("5 passaggi veloci").
- **Chiusura "in azione"**: nuovo hook `onClosed` in startPhase → alla chiusura del tour in Fase B la card Cliente viene portata in vista (scrollIntoView smooth): l'utente atterra sul punto di partenza.
- NON applicato (backlog se interessa): pattern "checklist → mini-tour" (il più efficace, 67% completamento — la dashboard ha già "Completa il profilo", collegarci mini-tour è un progetto a sé).

### Fatto anche (14 lug sera — tab "Dati" → pagina /account "Account e dati" in Altro, proposta Eli)
La sesta tab schiacciava la barra di Impostazioni su mobile. Fatto: **nuova pagina `/account`** (fascia oro + titolo serif, skeleton loading) col contenuto della vecchia tab Dati (`DatiSections`: Scarica i tuoi dati · Pacchetto commercialista · Invita commercialista · **Rivedi il tutorial** (spostato da Impostazioni›Generale, copy "5 passi") · Elimina account); voce **"Account e dati"** (icona UserRound) in Altro›Account sotto Impostazioni; Impostazioni torna a **5 tab**; `?tab=dati` → redirect a /account (link salvati ok). Aggiornati i riferimenti testuali: aiuto (×2), novita, cancella-account (pagina legale), email studio_client_invite, commento TourController.

### Fatto anche (14 lug — hardening: IP non spoofabile su TUTTI gli endpoint pubblici)
Chiuso il deferito del QA 14 lug ("pattern IP-rate-limit sugli altri endpoint pubblici"): il primo elemento di `x-forwarded-for` è controllabile dal client → ruotarlo aggirava i limiti per IP e inquinava l'IP salvato come prova. Nuovo helper **`lib/client-ip.ts`** (`clientIpFrom(headers)`: `x-real-ip` primario — impostato da Vercel, non falsificabile — XFF solo fallback per dev locale) applicato a: `/api/marketplace/richiesta` (rate-limit 5/h) · `/api/p/[token]/accept` (**anche PROVA firma FES: accepted_ip**) · `/api/p/[token]/view` (IP nello storico aperture) · `/api/r/[token]/sign` (prova firma rapportino) · `lib/turnstile.ts` (remoteip a Cloudflare) · `lib/auth-rate-limit.ts` (lockout login per IP) · `/api/marketplace/segnala` (già fixato, ora usa l'helper). tsc+build+213 verdi.

### Fatto anche (14 lug — riquadri fuori schermo: audit completo (3 agent) + 4 fix)
Segnalazione Eli (screenshot non arrivato in chat): "questo riquadro esce dallo schermo e non si legge; ricontrolla tutti i riquadri". 3 agent (width fisse · dialog/overlay · popover/dropdown) su tutta l'app, findings verificati di persona su dialog.tsx. Esito: app molto ben protetta (Dialog base con `max-w-[calc(100%-2rem)]` + scroller interno; Radix con collision detection; nessun `avoidCollisions=false`). Fix:
- **[il probabile colpevole] AiImportModal** ("Importa con AI" voci preventivo, fase risultati): (1) l'override `max-h-[90vh] overflow-y-auto` sul DialogContent ESTERNO annullava l'`overflow-hidden` del base → scroll/taglio ORIZZONTALE possibile; (2) la griglia `grid-cols-[2fr_55px_75px_85px_30px]` senza varianti responsive lasciava ~27px al campo Descrizione su 360px. Ora: mobile = layout impilato (descrizione sopra, riga Qtà/€/confidenza/cestino sotto, mini-label, aria-label), desktop = griglia identica via `sm:contents`; overflow gestito dal base.
- **5 dialog senza margine mobile**: `max-w-*` NUDO (senza `sm:`) sovrascrive via twMerge il `max-w-[calc(100%-2rem)]` del base → dialog a filo dei bordi su mobile. Prefissati `sm:`: AiImportModal, TemplatePreviewDialog, CatalogPicker, AcceptModal (×2, pagina pubblica), DeclineModal. ⚠️ **REGOLA: sui DialogContent usare SEMPRE `sm:max-w-*`, mai `max-w-*` nudo.** Rimossi anche `p-0 gap-0`/`p-4 sm:p-6` morti (il padding del dialog vive sul wrapper INTERNO non overridabile — passarli sull'esterno non fa nulla).
- **ViewHistorySection**: tooltip info `side="right"` → `side="top"` (320px a destra su 360px finiva a filo bordo).
- **Segnalati NON fixati** (nessun overflow): CatalogPicker ha doppio padding storico (suo px-4 + p-4 del wrapper base — solo estetica, invariata da sempre); TemplatePreviewDialog altezza 460px stretta su schermi bassi ma scrollabile; sheet.tsx side bottom/top senza max-h (mai usato nell'app). tsc+build+213 verdi.

### Fatto anche (14 lug — tutorial: il 6/6 non compariva; tour chiuso in Fase B, niente più Fase C)
Bug Eli: "salvata la bozza per il 5/6, il 6/6 non compare". **Causa reale** (documents.ts:478-481): "Salva bozza" reindirizza alla LISTA (`/preventivi?bozza=N`), non al dettaglio; e l'invio atterra con `?send=1` che la Fase C escludeva → la vecchia Fase C (passi 5-6 sul dettaglio) NON PARTIVA MAI: l'utente restava a 4/6 in silenzio. Decisione Eli: "non facciamo fare il 5/6, continuiamo con un 6/6" (la pagina del preventivo salvato non esiste ancora al momento del tour). Fix in TourController:
- **Fase C RIMOSSA** (con essa il poll da 30s, visibilitychange e il toast "il tutorial continua sul preventivo salvato"). Il tour ora chiude in Fase B su /preventivi/nuovo con 4 passi: 3 cliente/voci · 4 invia · **5 "Poi segui la risposta"** (popover CENTRATO che spiega a parole badge di stato + cronologia — il contenuto del vecchio 5 senza chiedere di salvare) · **6 "Hai finito!"** con bottone Fine.
- Valore legacy `cc_tour_step='detail'` in sessionStorage ripulito al mount. `useSearchParams`/`toast` rimossi. I `data-tour="cronologia"` sulle pagine restano (innocui). tsc+build+213 verdi. Da collaudare da Eli: Impostazioni → "Rivedi il tutorial" → i 6 passi filano senza cambio pagina dopo il 4.
- **DECISIONE Eli (14 lug): 2FA NON si fa ora** — "gli artigiani di solito non lo vogliono; se lo chiedono lo valuteremo". Resta nel backlog post-lancio (con CSP/pen-test).

### Fatto anche (14 lug — PERF: audit velocità, onde di query parallelizzate su 11 pagine)
Richiesta Eli "come velocizziamo ulteriormente il caricamento?". Diagnosi: prefetch/staleTimes/skeleton già a posto (perf fase 1-2 + Binario A); il collo di bottiglia sono le ONDE di query Supabase in serie nei server component (ogni onda = 1 round trip DB). Indici DB verificati: già completi (001-052), nessuna migration. Fix (semantica INVARIATA, gate spostati dal fetch al display dove serve):
- **Dashboard 4→2 onde**: cliente del preventivo in scadenza JOINato (`clients(name,email,phone)`) al posto della query in serie; catalogo+notifiche spostati nel Promise.all iniziale (getAppNotifications era già parallelo internamente).
- **Preventivi/[id] 3→2 e Fatture/[id] 4→2 onde** (pagine core): cliente JOINato in `select('*, document_items(*), clients(...))'` (RLS equivalente al vecchio check workspace); views/fattura-collegata/foto-lavoro keyate sull'id di route → onda 1; i gate per stato (`status!=='draft'`, `accepted`) applicati DOPO il fetch (visibilità identica). Su fatture resta un'onda 2 solo per origin_document_id (+ blocco SDI invariato).
- **Calendario 4→2**: le 3 query (sopralluoghi+lavori settimana, lavori in corso) in un Promise.all; tolleranza pre-migration con rejected-handler per ramo. ⚠️ **I builder PostgREST sono PromiseLike (solo `.then`)**: `.catch()` diretto sul builder ESPLODE a runtime — usare `.then(ok, ko)` o `.then().catch()`.
- **Lavori/[id] 5→3**: colonne 052 + riga principale (049) + spese collegate in un Promise.all; retry pre-migration e onda documentId invariati.
- **Bilancio 4→2**: entrate+spese+lavori attivi in un Promise.all (fallback 038 resta sequenziale ma parte solo su errore).
- **Sopralluoghi lista 4→2**: lista+conteggi foto+agenda in un Promise.all; i conteggi foto ora scoped al workspace (superset innocuo: la mappa serve solo alle righe mostrate). **Sopralluoghi/[id] 3→2**: dettaglio+foto insieme.
- **Scadenze preventivi/fatture 3→2**: cliente JOINato nella query documenti (via seconda query eliminata).
- **Clienti**: il banner email-duplicate non blocca più la pagina → componente async `DuplicateEmailBanner` in `<Suspense fallback={null}>`, carica in parallelo alla lista.
- tsc+build+213 verdi; scan spazi Turbopack pulito. Liste preventivi/fatture e /altro erano già ottimizzate (Promise.all preesistenti). NON toccati: fetch senza limit della dashboard (semantica KPI da preservare — eventuale follow-up), staleTimes (già 30s).

### Fatto anche (14 lug — feedback estetico Eli: testata con carattere, riga oro + titoli serif)
Richiesta Eli (via mockup Artifact approvato): dare identità alle pagine, oggi "anonime". Decisione finale (proposta A rifinita):
- **Logo "Carta Canta" invariato e SOLO in Home** (come da foto): il brand strip SVG (Georgia serif navy/oro + "il tuo ufficio in tasca") non è toccato; le liste non hanno logo, solo il titolo.
- **Titoli di pagina nel serif del marchio** `Georgia, 'Times New Roman', serif` navy (#1a1a2e) — stesso carattere del logo — al posto del sans anonimo.
- **Riga oro piena** (`2px solid #c9a44c`) sotto la fascia-testata che la stacca dal contenuto (niente sottolineatura corta, tolta su richiesta).
- Nuove classi condivise in globals.css: `.cc-title-band` (bg bianco + bordo oro) e `.cc-page-title` (Georgia serif navy 600).
- **Applicato a:** Home (riga oro sotto il saluto, logo intatto), Preventivi, Fatture, Clienti, Catalogo, Lavori, Sopralluoghi, Calendario, Bilancio.
- **Esteso a TUTTE le pagine (richiesta Eli "mettila ovunque")**: Altro, preventivi/fatture scadenze, cestino, notifiche, abbonamento, aiuto, novità, recensioni, marketplace, richieste, impostazioni, template (+[id]/nuovo), catalogo/importa, e le pagine di DETTAGLIO e FORM (preventivi/fatture/clienti/sopralluoghi/lavori [id] e nuovo). Applicato via script su ~26 file (stringhe di contesto complete → il brand strip del logo in dashboard e i divisori di riga NON toccati). Rimosso il const `FASCIA` ora inutilizzato in scadenze. tsc+build+213 verdi; scan spazi Turbopack pulito.

### Fatto anche (14 lug — Binario A #4: accessibilità, aria-label sui bottoni-icona)
Audit accessibilità (1 agent) su nav/header/row-action/card-action: l'app è già molto curata (77 aria-label esistenti, zero img senza alt). Trovati e fixati 4 gap reali di bottoni icona-only senza nome accessibile:
- **VociTable** (flusso core preventivo/fattura, alto traffico): bottoni "elimina voce" desktop (`<Button>` con solo `<Trash2>`) e mobile (`<button>` con solo `<Trash2>`) → `aria-label={`Elimina voce ${idx+1}`}`.
- **CatalogPicker**: freccia "indietro" (`<ArrowLeft>`) nella sotto-vista "Nuova voce" → `aria-label="Torna alla lista"`.
- **SetDefaultButton** (codice morto, non importato): `aria-label="Imposta come predefinito"` per future-proofing.
- Resto verificato già a posto (BottomNav, BackButton, ShareButton, WorkPhotosCard, DocumentRowActions, ecc.). tsc+build+213 verdi.

### Fatto anche (14 lug — Binario A #3: loading skeleton su 7 route data-fetching)
Rifinitura perceived-speed (zero rischio, puramente additivo): aggiunto `loading.tsx` (→ `<PageSkeleton />`, stesso pattern delle route già coperte) alle route server che caricano dati e prima "lampeggiavano" vuote alla navigazione: **lavori**, **lavori/[id]**, **calendario**, **clienti/[id]**, **sopralluoghi/[id]**, **preventivi/scadenze**, **fatture/scadenze**. Le pagine-form (nuovo/importa) e statiche (aiuto/novità/referral) NON toccate (non ne beneficiano). Verificato prima che gli empty state delle liste principali (preventivi/clienti/lavori/sopralluoghi/catalogo) sono già buoni (icona+messaggio+CTA). tsc+build+213 verdi.

### Fatto anche (14 lug — Binario A #2: test Tier 1 sul codice nuovo, 198→213)
Copertura test sulle parti pure del codice recente (rischio zero, nessun mock):
- **`lib/lavori/parse-hours.ts`** (NUOVO): estratta da OreLavoroCard la validazione dell'input ore (behavior-preserving: la card ora importa `parseManualHours`) → 9 test in `tests/unit/lavori/parse-hours.test.ts` (virgola/punto, negativi per correzione, "1.5.5" rifiutato, vuoto/zero/testo rifiutati, arrotondamento a 2 decimali di parseImportoIt poi ×60).
- **`lib/consent.ts`** → 6 test in `tests/unit/consent/consent.test.ts` (`@vitest-environment jsdom`): round-trip granted/denied, valore corrotto→null, evento `CONSENT_EVENT` emesso, `analyticsAllowed` = configurato×granted (dynamic import + `vi.stubEnv` per la chiave PostHog).
- Tier 2/3 (register-use con mock admin, server action lavori, route foto) NON fatti in questo giro per scelta di Eli. tsc+build+213 verdi.

### Fatto anche (14 lug — banner cookie / consenso analytics, pronto-da-attivare)
Primo item del "Binario A" (cose fattibili senza Eli). Meccanismo di consenso ePrivacy/Garante:
- **`lib/consent.ts`**: stato consenso in localStorage (`cc_cookie_consent` = granted/denied), eventi `CONSENT_EVENT`/`OPEN_SETTINGS_EVENT`, `ANALYTICS_CONFIGURED` (= chiave PostHog presente), `analyticsAllowed()`.
- **PostHog parte SOLO dopo il consenso**: `PostHogProvider` ora chiama `posthog.init` solo se `getConsent()==='granted'` (prima partiva subito con la chiave); ascolta l'evento consenso → si attiva senza reload all'accettazione, `opt_out_capturing()` sul rifiuto. `phCapture` (analytics.ts) gated su `analyticsAllowed()` → nessun evento (es. signup_completed) prima del consenso.
- **`CookieConsentBanner`** (montato nel root layout): compare SOLO se PostHog è configurato E l'utente non ha ancora scelto → **finché la chiave PostHog è vuota in prod, nessun banner e comportamento identico a oggi**. "Rifiuta" prominente quanto "Accetta" (requisito Garante), link all'Informativa privacy, non-modale.
- **`CookiePreferencesLink`** nel footer legale: riapre il banner (withdraw facile quanto l'accettazione); compare solo se analytics configurato.
- ⚠️ **Restano a Eli/avvocato (contenuto, non meccanismo):** (1) decisione se l'approccio opt-in va bene così; (2) aggiornare il TESTO della privacy policy con la sezione cookie + PostHog/Sentry/Cloudflare come destinatari (già nella lista domande avvocato/PDF 14 lug). Il banner si accende da solo quando Eli mette `NEXT_PUBLIC_POSTHOG_KEY` su Vercel. tsc+build+198 verdi.

### Fatto anche (14 lug — QA completo (4 agent) sulle feature nuove: 8 fix)
Richiesta Eli "li facciamo tutti". 4 agent QA (ore lavoro/richiami · grammatica/copy · sicurezza server · flussi artigiano) sulle superfici degli ultimi giorni; ogni finding verificato di persona prima del fix. Verdetto: app ben irrobustita, nessun bug critico. Fix applicati:
- **[MEDIA] `setRecallAction` falso "salvato"** (lavori.ts): l'update non verificava il rowcount → un lavoro eliminato altrove riportava "Promemoria impostato" senza salvare. Ora `.select('id')` + errore se 0 righe.
- **[MEDIA] correzione ore negativa col timer in corso** (lavori.ts `addLaborMinutesAction`): i minuti mostrati (persistiti+timer) non coincidono con i persistiti → una correzione veniva clampata sul solo persistito togliendo meno del previsto ma dicendo "aggiornato". Ora se il timer è in corso l'edit manuale è rifiutato ("Ferma il timer prima…").
- **[BASSA] input ore malformato** (OreLavoroCard): "1.5.5" veniva letto da parseImportoIt come 155 ore in silenzio. Guard regex `^-?\d+([.,]\d+)?$` prima dell'invio.
- **[correttezza] extract-photos: errore lettura catalogo ignorato** → si consumava una elaborazione AI producendo tutte voci a 0 "da prezzare" per un errore DB. Ora 503 PRIMA di chiamare l'AI (quota non consumata).
- **[BASSA] `linkedPhotoCount` > 6**: il bottone diceva "Usa le 9 foto" ma la route ne elabora max 6 → `Math.min(workPhotos.length, 6)`.
- **[BASSA] voce manuale con solo prezzo/quantità scartata in silenzio** all'estrazione AI (foto e note): il filtro `manual` teneva solo `description!==''` → allineato a "descrizione O prezzo O quantità" (niente perdita silenziosa).
- **[LOW sicurezza] rate-limit IP spoofabile** su `/api/marketplace/segnala`: `x-forwarded-for.split(',')[0]` è controllabile dal client → ora `x-real-ip` primario (non spoofabile su Vercel), XFF fallback.
- **[copy] RichiamoCard** "Da richiamare dal" (articolo davanti alla data).
- **Verificati OK (nessun fix):** timer concurrency (start/stop anti doppio-click), fusi orari richiamo (08:00 Roma), margine/manodopera in Economia, IDOR ovunque scoped, open-redirect callback, referral anti auto-invito, honeypot+rate-limit segnala, banner "collega commercialista" (già mostra l'email in chiaro). Emoji nelle email: zero (B.6 ok).
- **Deferiti (LOW, pre-esistenti/architetturali):** TOCTOU quota AI (marginale, condiviso con AI import); lost-update cross-device su `labor_minutes` (serve RPC atomico, target mono-utente); resurrezione stato "letto" del richiamo (impatto minimo); pattern IP-rate-limit sugli altri endpoint pubblici pre-esistenti. tsc+build+198 verdi.

### Fatto anche (14 lug — 2 fix backlog: OAuth ?studio/?ref + Segnala profilo DSA)
- **OAuth propaga ?studio e ?ref**: prima l'invito commercialista (`?studio=email`) e il referral (`?ref=CODICE`) viaggiavano SOLO col form email/password (campi hidden→signupAction) → chi si iscriveva con Google da un link li perdeva. Ora `OAuthButtons` li aggiunge al `redirectTo` del callback (`cc_studio`/`cc_ref`, validati; studio anche da sessionStorage first-touch), e `/auth/callback` (solo NUOVO utente, `wsResult==='created'`) applica: `studio_invite_email` in user_metadata (via `updateUser`) + `registerReferralUse`. Nuovo helper `lib/referral/register-use.ts` condiviso con signupAction (estratto dal blocco inline, behavior-preserving). Nessun rischio nuovo: gli stessi valori erano già accettati dal form email (spoofabilità invariata; il collegamento studio resta un suggerimento con consenso dell'artigiano).
- **"Segnala profilo" → notice-and-takedown vero (DSA)**: sul dettaglio `/professionisti/[id]` il vecchio `mailto:` (inerte senza client di posta) è sostituito da `ReportProfileButton` (dialog: motivo + contatto facoltativo + honeypot) → `POST /api/marketplace/segnala` (pubblico, rate-limit 3/h per IP, verifica profilo esistente) → email a segnalazioni@ con template `MarketplaceSegnalazioneEmail` (no emoji, replyTo sul contatto se email). tsc+build+198 verdi.

### Fatto anche (14 lug — QA self-review: 1 regressione trovata e fixata)
- **🟠 `hasVoci` troppo severo anche sui RE-INVII**: la stretta "tutte le voci complete" (introdotta per non far partire una bozza con voci AI "da prezzare") gatava il bottone Condividi per QUALSIASI stato → un documento GIÀ inviato con una riga a €0 legittima (es. "omaggio", riga descrittiva) non era più ri-condivisibile (prima bastava una voce completa). FIX: la regola severa vale SOLO al primo invio (bozza); per i re-invii di documenti già inviati torna il comportamento storico (`some` completa). Allineato in 3 punti: `preventivi/[id]`, `fatture/[id]` e l'evento `voci-changed` in PreventivoForm (severo se create/draft, lasco altrimenti). Le guardie server (`registerManualSendAction`, `send-email`) erano già gated `status==='draft'`, quindi ok. tsc+build+198 verdi.

### Fatto anche (14 lug — photo-to-quote FASE 3b: riuso foto del sopralluogo)
- **"Usa le N foto già caricate (AI)"**: quando un preventivo nasce da un sopralluogo (o ha già foto collegate), l'artigiano lancia il preventivo dalle foto SENZA ricaricarle. La trasformazione sopralluogo→preventivo già collega `work_photos.document_id`; il bottone (solo edit mode, `linkedPhotoCount>0`) chiama la route.
- **Route `/api/ai/extract-photos` estesa**: oltre al multipart (foto appena scattate) ora accetta `application/json { document_id, notes }` → verifica che il documento sia del workspace (no IDOR), carica le `work_photos` collegate (max 6), le SCARICA dallo storage `work-photos` (bucket pubblico, sempre JPEG ridimensionati all'upload) e prosegue con la stessa pipeline (quota/rate-limit/catalog-match). Se mancano note, usa le `internal_notes` del documento (quelle del sopralluogo).
- **Refactor**: mapping risposta→voci estratto in `applyPhotoScope()` condiviso dai due flussi (multipart + json). Prop `linkedPhotoCount` passata da `preventivi/[id]/page.tsx` (già carica `workPhotos`). tsc+build+198/198 verdi.

### Fatto anche (14 lug — photo-to-quote FASE 3: badge per voce)
- **Badge di stato per le voci proposte dalle foto** (`VoceBadges` in VociTable): sotto ogni voce AI compare una pillola che dice a colpo d'occhio cosa controllare — **"dal tuo catalogo"** (verde, il prezzo viene dal listino dell'utente), **"da prezzare"** (ambra, nessun match a catalogo, prezzo 0), **"da compilare"** (ambra, quantità non nelle note, 0). Le pillole "da fare" spariscono appena il valore viene inserito; la verde resta come info sull'origine. Rende operativo il principio "controlla sempre": l'artigiano vede subito cosa l'AI ha potuto compilare e cosa no.
- **Come:** `VoceItem` ha 2 campi di SOLA UI `price_source`('catalog'|'todo') e `qty_source`('notes'|'todo'), valorizzati in `handleAiExtractPhotos` dai metadati che la route già restituiva (prima scartati). NON persistiti: nuovo helper `serializeVoci()` li rimuove (insieme a `_key`) dall'`items_json` inviato al server (3 punti). Rendered una volta per riga (desktop+mobile). tsc+build+198/198 verdi.

### Fatto anche (14 lug — ADDENDUM PDF professionisti + ISTRUZIONE PERMANENTE di Eli)
- **⚖️ ISTRUZIONE PERMANENTE (Eli, 14 lug): "aggiorna comunque sempre tutti i documenti per commercialista e avvocato se ci sono nuove domande da fargli"** → ogni volta che una feature/decisione genera una nuova domanda legale o fiscale, produrre/aggiornare l'addendum PDF per il professionista giusto e inviarlo a Eli in chat (SendUserFile), senza aspettare che lo chieda. NON committare questi documenti nel repo (è PUBBLICO — contengono la situazione fiscale/legale personale).
- **Consegnati 2 addendum** (scratchpad, via SendUserFile — script `gen_addenda.py` con reportlab): `CartaCanta_Avvocato_Aggiornamento_14lug2026.pdf` (7 punti: recensioni Google bloccate · photo-to-quote AI+disclaimer+GDPR foto+AI Act · canale commercialisti ruoli GDPR · firma rapportino FES · PostHog/Sentry/Turnstile + cookie banner · claim beta AGCM · cancellazione account) e `CartaCanta_Commercialista_Aggiornamento_14lug2026.pdf` (5 punti: fatture PDF=copia di cortesia con dicitura da definire · tracciati export registro/bilancio da validare · area /studio cosa manca · ore lavoro senza valenza fiscale · beta gratuita e P.IVA). Coprono tutte le novità 8-14 lug successive ai 3 PDF del 7 lug.

### Fatto anche (14 lug mattina — CONTROLLO post-ship photo-to-quote: 2 bug veri trovati e fixati)
Richiesta Eli: "fai prima un controllo che sia tutto ok". Deploy PR #65 verificato READY in prod. Il controllo ha trovato 2 bug reali, fixati subito:
- **🔴 Salvataggio bozza bloccato dalle voci AI "da completare"**: le voci proposte dalle foto nascono con prezzo 0 ("da prezzare") e/o quantità 0 ("da compilare"), ma la validazione (client `getVociError` + server `vociCombinationMessage`/`VoceSchema.quantity.positive()`) rifiutava qualunque voce a 0 → "Salva bozza" IMPOSSIBILE in create mode; in edit mode l'auto-save **scartava in silenzio** le voci (parse Zod fallito → `voci=[]` tollerante) dicendo "salvata". FIX: **bozza tollerante, invio severo** — `VoceDraftSchema` (quantity nonnegative) usato da `saveDraftAction` (solo status draft) e `createDocumentAction` con intent `save_draft`/`create`; client `getVociError(items, forDraft)` per Salva bozza (serve solo la descrizione). L'INVIO resta severo OVUNQUE: `hasVoci` (pagine dettaglio + evento voci-changed) ora richiede che TUTTE le voci inserite siano complete (prima bastava UNA → una bozza mista poteva partire con righe a €0); guardie server nuove in `registerManualSendAction` e in `send-email` (primo invio di bozza: 422 se una voce è incompleta; re-invii invariati per i documenti storici).
- **HEIC rimosso dai formati accettati** in `/api/ai/extract-photos`: i provider vision (Mistral/OpenAI) NON leggono HEIC e non c'è conversione server-side (niente sharp; i binari precompilati di sharp comunque non decodificano HEIF) → un .heic reale produceva un 502 fuorviante dopo aver consumato la chiamata. Con `accept="image/*"` iOS converte da solo HEIC→JPEG all'upload, quindi le foto iPhone funzionano comunque; un .heic grezzo ora riceve un 400 chiaro ("Usa JPG, PNG o WEBP"). ⚠️ Corregge il claim del 13 lug "accetta anche HEIC".
- tsc+build+198/198 verdi.

### Fatto anche (13 lug sera — FEATURE "Preventivo dalle foto" MVP anti-invenzione, dietro flag AI)
Killer feature scelta da Eli (fase 1 ricerca → fase 2 build). Vincolo di Eli: "autentico, non un'AI che inventa; poche cose ma corrette". Design con la garanzia SPOSTATA DAL PROMPT AL CODICE:
- **`lib/ai/catalog-match.ts`** (DETERMINISTICO, 8 test in `tests/unit/ai/catalog-match.test.ts`): il PREZZO di una voce può venire SOLO da un abbinamento col catalogo dell'utente (token-overlap ≥0.6, ignora voci senza prezzo, non confonde idraulica/elettrica). Nessun match → prezzo 0 "da prezzare". È il "guardiano dei prezzi": l'AI non emette mai un prezzo.
- **`lib/ai/extract-photos.ts`**: schema Zod SENZA campo prezzo (l'AI non lo può scrivere). L'AI propone solo le descrizioni dei lavori; la `quantity` solo se ESPLICITA nelle note (`quantity_from_notes`), altrimenti null → in UI quantità 0 "da compilare". Mistral pixtral → OpenAI gpt-4o-mini, temp 0.
- **`app/api/ai/extract-photos/route.ts`** (multipart photos[]+notes): stessa quota/kill-switch/rate-limit dell'AI import; carica il catalogo, chiama la vision, poi ABBINA I PREZZI NEL NOSTRO CODICE (matchCatalog). Max 6 foto, 8MB. ~~Accetta anche HEIC/HEIF~~ → CORRETTO il 14 lug: HEIC rifiutato con messaggio chiaro (i provider non lo leggono; iOS converte da solo in JPEG).
- **UI in PreventivoForm** (create + bozze): bottone oro "Proponi le voci dalle foto (AI)" accanto a quello delle note; input file `capture=environment`; le voci si AGGIUNGONO a quelle manuali; toast dice quante sono "da prezzare"; nota fissa "controlla sempre prima di inviare".
- Ricerca in `RICERCA_PHOTO_TO_QUOTE.md`; design in `PROGETTO_PHOTO_TO_QUOTE.md`. Lezione VSI-Bench: l'AI riconosce l'ambito ma NON stima quantità/misure → mai quantità dalla foto. tsc+build+198/198 verdi. ⚠️ Attiva solo con `NEXT_PUBLIC_AI_IMPORT_ENABLED=true` (già in prod). Da collaudare da Eli sul demo con foto vere; disclaimer da validare con l'avvocato (lista).

### Fatto anche (13 lug — decisioni Eli applicate + rebrand + 2 feature nuove)
- **Rebrand (PR #59, decisione Eli "il vecchio logo non deve più comparire"):** icone PWA/favicon rigenerate dal marchio nuovo (doppia C oro/crema su navy, crop hi-res da `app/logo-firma.png` via PIL; maskable con safe zone su navy pieno); **landing / rifatta on-brand** (marchio SVG + wordmark serif navy/oro come il login, badge crema, CTA navy, chip crema/oro, footer mobile) — era l'unica pagina bianco/nero con icona generica. ⚠️ Le icone sul telefono si aggiornano rimuovendo/riaggiungendo la PWA alla Home.
- **4 decisioni di Eli (via AskUserQuestion) APPLICATE:** (1) **beta libera** — `FREE_TRIAL_ENFORCED=false` in lib/free-trial.ts (il blocco 30gg è spento, resta il limite 8; il trigger 024 continua a popolare la colonna → riattivazione immediata al lancio); claim aggiornati su landing e piano.tsx ("gratis durante la beta"); (2) **niente zoom iPhone** — regola globale in globals.css: su mobile (<1024px) `input/textarea/select` a 16px `!important` (batte gli inline 13-15px dei mockup, che restano su desktop); (3) **cliente con fatture NON eliminabile** — guardia in `deleteClientAction` (conta le fatture, anche nel cestino) + copy dialog aggiornato; (4) feature scelte: manutenzioni + timer ore (fatte, sotto). Deferite ancora: OAuth che perde ?studio/?ref, form segnalazione /professionisti.
- **Migration 052 APPLICATA da Eli (13 lug)** → richiami e ore di lavoro ATTIVI in prod.
- **DECISIONE Eli (13 lug): recensioni Google automatiche = BLOCCATE su validazione legale.** Motivazione: massima cautela, "non abbiamo soldi per difenderci" — nessuna feature con profilo legale dubbio senza ok dell'avvocato. Domanda da aggiungere alla lista avvocato: liceità dell'invito automatico a recensire su Google post-incasso (nota tecnica: la policy Google vieta le recensioni INCENTIVATE e il review-gating/selezione dei soli clienti contenti — l'invito neutro a TUTTI i clienti è la prassi conforme; il rischio è di policy/account Google più che legale, ma la conferma spetta al legale). NON implementare senza ok esplicito di Eli.
- **FEATURE "Richiama il cliente" (⚠️ migration 052 DA APPLICARE):** `lavori.recall_at/recall_note`; card `RichiamoCard` sul dettaglio Lavoro (pill 3/6/12 mesi o data custom + nota, salvate alle 08:00 di Roma); notifica campanella tipo **'richiamo'** calcolata live in lib/notifications.ts (`recall_at <= now`), toggle `inapp_richiamo` in Impostazioni›Notifiche; `setRecallAction` in lavori.ts (tollerante pre-migration).
- **FEATURE "Ore di lavoro" (stessa migration 052):** `lavori.labor_minutes/timer_started_at` + `workspaces.hourly_cost`; card `OreLavoroCard` (timer Avvia/Ferma con anti doppio start/stop condizionali, aggiunta manuale ore ±, tick display 30s); campo "Costo orario manodopera" in Impostazioni›Fiscale (parse parseImportoIt, update tollerante); l'Economia del lavoro ora somma la manodopera nello "Speso" (riga dedicata) → margine reale.
- Migration 052 **validata 2× su PG16 locale** (idempotente, colonne+indice parziale, dati di prova ok). /novita aggiornata. tsc+build+190/190 verdi.

### Backlog residuo (aggiornato 15 lug 2026)
**⚠️ PRIMA DEL LANCIO:** checklist bloccante in **`PRIMA_DEL_LANCIO.md`** (da leggere prima di dare l'app a utenti reali). Punto n.1: **Supabase Pro per i backup** (il piano free NON ha backup — verificato 20 lug).

**Eli (azioni manuali):** inviare i PDF consolidati ad avvocato+commercialista (cancello principale: campi gialli privacy/termini, cookie policy, copy fattura di cortesia, recensioni Google, SdI) · SdI/OpenAPI: registrazione console.openapi.com + chiavi sandbox (must-have fiscale n.1) · Play Store: tipo account (Personale vs D-U-N-S) + `npm run seed:demo` aggiornato + fingerprint per assetlinks.json (testi pronti in PLAY_STORE_SCHEDA.md, ⚠️ nodo Play Billing per l'abbonamento in-app) · Stripe live + P.IVA · video demo /prova (NotebookLM) · email automatica lead Meta (quando parte la campagna).
**Richieste Eli — Accesso con impronta:** ✅ **Sblocco rapido FATTO 20 lug (MVP, migration 056 da applicare, collaudo device da Eli)** — vedi handoff in cima ad A0. Resta opzionale l'**accesso completo senza password** (passkey come login primario) per una prossima sessione.

**Codice (post-lancio o su richiesta):** **NOTE DI CREDITO TD04 (fase SdI)** — ⏸️ IN ATTESA per decisione Eli (19 lug): si costruisce quando lo SdI è LIVE **e** il commercialista ha risposto sulla numerazione (stessa serie vs sezionale). Struttura dati già quasi pronta (origin_document_id, invoice_sequences per doc_type, infra SdI xml/provider/webhook). **Progetto completo in `PROGETTO_NOTE_CREDITO.md`** (cosa c'è, cosa manca, fasi). Domande commercialista nel dossier unico §6. · FASE C commercialisti (XML FatturaPA, dopo SdI live) · pagamento carta nel link (dopo P.IVA+Stripe) · cron purge workspace cancellati >10 anni · 2FA (decisione Eli 14 lug: non ora) · CSP con nonce + pen-test · salvataggio automatico foto analizzate dall'AI (decisione Eli 15 lug: si lascia così) · test Tier 2/3 · pattern checklist→mini-tour ✅ FATTO 15 lug.

### Migration: 047-061 TUTTE APPLICATE (✅ 061 applicata da Eli il 26 lug: deduplica Stripe a due fasi)
### Migration 047-060 (storico): tutte applicate (✅ 060 applicata da Eli il 25 lug: idempotenza + ordine eventi Stripe)
### Migration 047-059 (storico): (✅ 059 applicata da Eli il 25 lug: indice numeri con doc_type, convert con bonus/acconto senza prefix, quota atomica)
### Migration 047-058 (storico): (054 misure sopralluogo: 18 lug; 055 marketplace lat/lng "Vicino a me": 19 lug; **056 passkeys "sblocco con impronta": applicata da Eli il 20 lug**; **057 sicurezza prove/quota sdi_usage: applicata da Eli il 25 lug**; **058 snapshot XML SdI: applicata da Eli il 25 lug**). Test: tsc verde · build verde · **310/310** verdi. Smoke pubblico: `npm run build && npm run smoke:public` (20 check).

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

## ⏰ PROMEMORIA — CONFIGURAZIONI DA RICORDARE A ELI A FINE PACCHETTO FEATURE (richiesto da Eli 6 lug 2026)

> Quando TUTTE le nuove feature (blocchi 1-9) sono implementate, ricordare a Eli queste azioni manuali:
> 1. ~~AI Import~~ FATTO (11-12 lug): flag+chiavi su Vercel, tetti di spesa impostati (OpenAI $10, Mistral 10€ prepagato).
> 2. **Stripe Customer Portal** — config "switch plans" per upgrade mensile→annuale (dettagli nella sezione "CONFIG STRIPE DA FARE" qui sotto). Sandbox E live.
> 3. **SDI** — credenziali del provider di fatturazione elettronica (quando scelto — vedi ricerca-fatturazione-elettronica/DECISIONE_SDI.md).

---

## B. REGOLE DI COMPORTAMENTO

### B.0 ⚖️ REGOLA PRUDENZA LEGALE — PERMANENTE (decisione Eli, 13 lug 2026)

> **"Dobbiamo stare in sicurezza ed evitare ogni tipo di problema legale, amministrativo
> o che ci può mettere in seria difficoltà o costi elevati. Non abbiamo soldi per difenderci."**

Questa regola PREVALE su crescita, marketing e velocità di rilascio. In pratica:

1. **Default = NON implementare/lanciare** nulla con profilo legale, fiscale o amministrativo
   dubbio senza ok esplicito di Eli e, dove serve, del professionista (avvocato/commercialista).
2. **Aree sensibili che richiedono SEMPRE il cancello** (lista non esaustiva):
   fatturazione elettronica/SdI e qualsiasi claim di valore fiscale dei documenti;
   claims di marketing (AGCM — mai promesse assolute, mai "gratis per sempre");
   GDPR e nuovi destinatari/trattamenti di dati; recensioni e directory (diffamazione,
   notice-and-takedown); email automatiche ai CLIENTI FINALI degli artigiani (spam/consenso);
   pagamenti e denaro; scraping/uso di dati di terzi; integrazione con piattaforme
   con policy proprie (Google, Meta, WhatsApp Business).
3. **A parità di alternative, scegliere la più difendibile**, anche se meno "growth"
   (es. invito manuale invece che automatico, opt-in invece che opt-out, copy sobrio
   invece che aggressivo).
4. **Feature attualmente BLOCCATE su validazione professionale:** recensioni Google
   automatiche (avvocato) · SdI live (contratto/DPA OpenAPI + avvocato) · qualsiasi
   automazione email verso i clienti finali oltre a quelle già validate.
5. Ogni nuova feature con possibile rilevanza legale va segnalata a Eli PRIMA di
   implementarla, con i rischi spiegati in parole semplici, e aggiunta alla lista
   domande per i professionisti se serve.
6. **(istruzione Eli, 14 lug 2026)** Quando emergono nuove domande per avvocato o
   commercialista, AGGIORNARE SEMPRE i documenti per i professionisti senza aspettare
   che Eli lo chieda: addendum PDF datato (base: 3 PDF del 7 lug + addendum 14 lug),
   inviato in chat via SendUserFile. MAI committare questi documenti nel repo (pubblico).

### B.1 Regole TypeScript / codice

1. MAI `any` senza commento ESLint esplicito
2. MAI chiavi API nel client — tutto passa da Server Actions o API Routes
2-bis. **MAI credenziali/password nei file committati** (il repo è PUBBLICO) — nemmeno quelle dell'account demo: vivono in `.env.local` (es. `DEMO_PASSWORD`). Lezione GitGuardian 15 lug 2026.
3. MAI skipare i test sui calcoli fiscali — coverage 100% obbligatoria su `lib/fiscal/`
4. Commit atomici con conventional commits: `feat/fix/chore/docs/test`
5. Ogni modifica: `npx tsc --noEmit` + `npm run build` devono essere verdi prima del commit
6. `types/database.ts` va rigenerato dopo ogni migration (`npx supabase gen types typescript --project-id ivbzuhgwszkdnlsybsao > types/database.ts`). Non editare manualmente salvo aggiunta urgente documentata.

### B.2 Regole UX/UI permanenti

- **⚠️ SPAZI NEL TESTO JSX (bug Turbopack — scoperto 11 lug 2026):** lo spazio tra un elemento inline (`</b>`, `</strong>`, `</Link>`) e il testo che segue può venire MANGIATO dal compilatore quando il testo contiene accenti/apostrofi tipografici (es. "…</b> e scarica" → "…e scarica" attaccato), anche se nel sorgente lo spazio c'è. **Regola: usare SEMPRE `{' '}` esplicito tra un elemento inline e il testo adiacente** nei copy visibili. Verifica ground-truth: `grep -roh '}),"[a-zàèéìòù][^"]\{0,50\}' .next/server/chunks/ssr/*.js | sort -u` dopo il build (devono restare solo valori tecnici). ⚠️ **Lo scan sul build è CIECO sulle MAIUSCOLE** (19 lug: "…foto.</b> Tocca" arrivò in prod attaccato — "Tocca" non matcha `[a-z]`; estendere alle maiuscole produce troppi falsi positivi dalle label): per le maiuscole affiancare il grep sul SORGENTE `grep -rn '</b> [A-ZÀÈÉ]\|</strong> [A-ZÀÈÉ]\|</Link> [A-ZÀÈÉ]' --include="*.tsx" app components` → deve restituire 0 righe.
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

**Preventivo accettato — re-edit:** ⚠️ NOTA CORRETTA (22 lug 2026, verificata sul codice): oggi un documento `accepted` NON è modificabile in nessun caso — sia `updateDocumentAction` (documents.ts:596) sia `saveDraftAction` (:847) lo rifiutano incondizionatamente, e la status route dei preventivi non ha transizioni in uscita da `accepted`. La vecchia descrizione ("ri-editabile a meno che non abbia fattura accettata collegata") NON corrisponde più al codice. Limite noto da riconfermare con Eli: un preventivo segnato accettato PER ERRORE non ha via di ritorno (le fatture hanno "Riattiva", i preventivi no).

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

## 0. REGOLE BASE PER CLAUDE CODE

1. Leggi TUTTO questo file prima di scrivere codice
2. Un task alla volta — output sempre: file toccati + commit hash + tsc verde + build verde
3. Sequenza: capire → implementare → `npx tsc --noEmit` → `npm run build` → verificare → commit
4. Mai interpretare arbitrariamente una decisione di prodotto — se non è documentata qui, chiedi
5. Non reimplementare da zero senza prima trovare la causa precisa del problema
5-B. Prima di cambiare UI/copy/comportamento, leggi DECISIONI_E_FEEDBACK.md. NON annullare le voci ✅ (bloccate) senza istruzione esplicita di Eli.
6. **A fine di OGNI task** (non solo a fine sessione): aggiornare CLAUDE.md + `git push` (origin → Vercel) — questo è il backup primario. Confermare all'utente che il push è andato a buon fine. **Backup NAS (`git push nas master`) ora OPZIONALE** (decisione Eli 14 giu 2026): GitHub è la fonte di verità/backup; il NAS solo occasionale e solo quando il drive Z: è montato (utente `moian`). Con l'utente `elisa` il push NAS fallisce ed è normale — non bloccarsi.
7. `types/database.ts` va rigenerato dopo ogni migration
8. **Non dichiarare risolto un bug solo perché hai trovato la causa nel codice.** Usa il formato sezione C.

---

## 0-B. BACKUP NAS

```
NAS path:    Z:\CARTA CANTA
Remote git:  nas   (già configurato)
Comando:     git push nas master

File da ESCLUDERE sempre: node_modules/ .next/ dist/ build/ .claude/worktrees/ supabase/.temp/

⚠️ AGGIORNATO 14 giu 2026 — il NAS NON è più obbligatorio a ogni task. GitHub (origin) è il backup primario.
  1. Aggiorna CLAUDE.md
  2. git add <file specifici> && git commit -m "..."
  3. git push              (origin → Vercel Production, deploy automatico entro 1-3 min) — OBBLIGATORIO
  4. git push nas master   (OPZIONALE — backup NAS, solo se il drive Z: è montato; con utente 'elisa' fallisce ed è normale)
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
NEXT_PUBLIC_SDI_ENABLED=          # 'true' per mostrare la card SDI sulle fatture
OPENAPI_SDI_API_KEY=              # chiave OpenAPI (vuota = provider MOCK di prova, nessuna trasmissione reale)
OPENAPI_SDI_BASE_URL=             # default sandbox https://test.sdi.openapi.it (prod: da doc OpenAPI)
SDI_WEBHOOK_SECRET=               # segreto per /api/webhooks/sdi?secret=...
TWA_SHA256_FINGERPRINT=           # Play Store: fingerprint SHA-256 (anche più d'uno, separati da virgola) → attiva /.well-known/assetlinks.json
TWA_PACKAGE_NAME=                 # default app.cartacanta.twa
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
