# CLAUDE.md — Memoria permanente del progetto Carta Canta

> **Fonte di verità per Claude Code.**
> Va aggiornato a fine di ogni sessione con: feature implementate, decisioni prese, bug emersi, cose rimandate.
> Storico sessioni precedenti spostato in `STORICO_SESSIONI.md` (consolidamenti doc: 14 giu · 15 lug 2026 — qui restano solo gli handoff dal 13 lug in poi).
> **Ultima sessione:** 7 luglio 2026 (COMPLIANCE + CYBERSECURITY — irrobustimento sicurezza, informative legali, 3 PDF per professionisti). Changelog operativo recente in `REGISTRO_AGGIORNAMENTI.md`.

---

## A0. HANDOFF — SESSIONE 7 lug (parte 2): export GDPR, fisco frontaliera, foto scontrino, Play Store

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
**Eli (azioni manuali):** inviare i PDF consolidati ad avvocato+commercialista (cancello principale: campi gialli privacy/termini, cookie policy, copy fattura di cortesia, recensioni Google, SdI) · SdI/OpenAPI: registrazione console.openapi.com + chiavi sandbox (must-have fiscale n.1) · Play Store: tipo account (Personale vs D-U-N-S) + `npm run seed:demo` aggiornato + fingerprint per assetlinks.json (testi pronti in PLAY_STORE_SCHEDA.md, ⚠️ nodo Play Billing per l'abbonamento in-app) · Stripe live + P.IVA · video demo /prova (NotebookLM) · email automatica lead Meta (quando parte la campagna).
**Codice (post-lancio o su richiesta):** FASE C commercialisti (XML FatturaPA, dopo SdI live) · pagamento carta nel link (dopo P.IVA+Stripe) · cron purge workspace cancellati >10 anni · 2FA (decisione Eli 14 lug: non ora) · CSP con nonce + pen-test · salvataggio automatico foto analizzate dall'AI (decisione Eli 15 lug: si lascia così) · test Tier 2/3 · pattern checklist→mini-tour ✅ FATTO 15 lug.

### Migration: 047-054 tutte APPLICATE (054 misure sopralluogo: applicata da Eli il 18 lug). Test: tsc verde · build verde · **276/276** verdi. Smoke pubblico: `npm run build && npm run smoke:public` (20 check).

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

- **⚠️ SPAZI NEL TESTO JSX (bug Turbopack — scoperto 11 lug 2026):** lo spazio tra un elemento inline (`</b>`, `</strong>`, `</Link>`) e il testo che segue può venire MANGIATO dal compilatore quando il testo contiene accenti/apostrofi tipografici (es. "…</b> e scarica" → "…e scarica" attaccato), anche se nel sorgente lo spazio c'è. **Regola: usare SEMPRE `{' '}` esplicito tra un elemento inline e il testo adiacente** nei copy visibili. Verifica ground-truth: `grep -roh '}),"[a-zàèéìòù][^"]\{0,50\}' .next/server/chunks/ssr/*.js | sort -u` dopo il build (devono restare solo valori tecnici).
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
OPENAPI_SDI_BASE_URL=             # default sandbox https://test.invoice.openapi.com (prod: da doc OpenAPI)
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
