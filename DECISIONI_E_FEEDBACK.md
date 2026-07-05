# DECISIONI & FEEDBACK — Carta Canta (fonte di verità)

> **Registro di tutto ciò che Eli ha chiesto/deciso.** Serve a non ripetere i feedback e a non far "tornare indietro" o rifare a Code cose già decise.
> **Regola per Claude Code:** prima di cambiare UI/copy/comportamento, **leggi questo file**. **NON annullare le voci ✅ (bloccate) senza un'istruzione esplicita di Eli.** Se una modifica rischia di toccare una voce ✅, fermati e segnala.
> **Manutenzione:** lo aggiorna l'assistente di pianificazione (Cowork) a ogni feedback di Eli, e verifica ogni output di Code anche contro questo registro.
> **Legenda stato:** ✅ fatto/bloccato · ⏳ da fare · 🔁 superato (indica la voce valida) · ℹ️ chiarito/non è un bug.
> Per l'elenco operativo e l'ordine dei lavori vedi `BACKLOG_MIGLIORAMENTI.md` (sez. G/H). Qui stanno le **decisioni** e il loro stato.

---

## A. DECISIONI BLOCCATE (✅ — non annullare)

### UI mobile — feedback Eli (4–5 lug 2026)
- ✅ **Duplica ed Elimina SOLO dal menu ⋮ delle liste** (Preventivi e Fatture). **MAI dentro il dettaglio** del documento, né mobile né desktop. Eli l'ha ribadito più volte: NON riproporre "Altre azioni"/danger zone nel dettaglio.
- ✅ **Un solo bottone di invio, sempre "Invia al cliente"** (la parola "Condividi" sparisce), in ogni stato del documento → apre il pop-up coi canali (WhatsApp / Email / Altre app / Copia link). **L'icona Email apre l'attuale pop-up email** (oggetto, destinatario, testo). Per le bozze la consegna via link chiede prima "Segna come inviato" (come oggi).
- ✅ **Errori dei form: NON pastello** — restano rossi accesi. Tutti gli altri avvisi/stati informativi: **palette pastello** del design system.
- ✅ **Grigi: restano come sono** (non sostituire #a5a39b ecc. — proposta ritirata).
- ✅ **Scala tipografica unica in tutta l'app**: titolo pagina 20/600/#161616 · header con ← indietro 17/600/#161616 · titolo sezione 13/600/UPPERCASE/#6f6d64 · titoletto campo 12/600/UPPERCASE/#8a887f · testo 14/#161616 · secondario 13/#55534b · note 12/#767676. **Niente mezzi pixel** (13.5→14 · 12.5→13 · 11.5→12 · 10.5→11).
- ✅ **Salvataggio Impostazioni: toast di conferma** visibile in basso (stile allineato agli altri toast dell'app: 10 s + ✕), per tutti i tab.
- ✅ **Pop-up di successo** (es. invio email, bozza salvata): resta finché non lo si chiude. **Toast/banner**: auto-chiusura dopo 10 s con ✕.
- ✅ **Numero assegnato ben visibile** nel pop-up dopo salvataggio/invio di un nuovo documento.
- ✅ **CTA upgrade unificata: "Passa a Pro"** ovunque ("Abbonati" ammesso solo dentro le card prezzo).
- ✅ **Cronologia**: distinguere sempre le azioni del cliente ("Accettato dal cliente", "e firmato") da quelle manuali dell'artigiano ("Segnato come accettato manualmente").
- ✅ **Card Cliente nel dettaglio**: se il cliente non è in rubrica → niente link/freccia, mostrare "Non è in rubrica · Aggiungilo →". (Capita ad es. se il cliente è stato eliminato dalla rubrica dopo la creazione del documento.)
- ✅ **Impostazioni in Altro**: si raggiunge sia dalla scheda profilo sia dalla riga Account — tenere entrambe (deciso 5 lug).
- ✅ **Niente doppioni inutili**: la stessa azione deve comparire una sola volta per schermata (salvo decisione esplicita contraria).
- ✅ **Abbonamento mobile**: il prezzo mostrato e quello addebitato devono coincidere — scelta Mensile/Annuale anche su mobile (fix bug €182/anno vs checkout mensile).
- ✅ Punto 17: il tab Notifiche resta a **salvataggio automatico** (senza bottone Salva), con toast di conferma. Deciso 5 lug.
- ✅ Punti mappa tasti 5, 7–16, 18–21 — approvati da Eli e implementati (5 lug). Punto 6 = **NO** (deciso, vedi prima voce).
- ⏳ Punto 22 (wording pagina pubblica mobile vs desktop) — da confermare.

### Ciclo incasso — Bilancio / Pagamenti / Acconti (decisioni Eli 5 lug 2026, dai mockup)
- ✅ **Simbolo tipo documento (A2)**: foglio NAVY = preventivo · banconota ORO #b08d3e = fattura, accanto al titolo negli header. Implementato.
- ✅ **Bilancio**: categorie spese preimpostate + possibilità di crearne di personalizzate. Grafico semplice incluso da subito (scelta delegata a Code). Acconto incassato conta nelle Entrate del mese dell'incasso (criterio di cassa — scelta delegata).
- ✅ **Pagamenti F1**: QR bonifico EPC subito (è gratis, generato dall'app). PayPal/Satispay = campi facoltativi con aiuto guidato passo-passo (per utenti poco tecnologici); il metodo principale resta IBAN+QR. Campo note pagamento con placeholder GRIGIO sovrascrivibile "Accetto contanti in cantiere". Riquadro "Come pagare" anche sui PREVENTIVI ACCETTATI (per l'acconto) e in fondo al PDF/documento. Card "Segna come pagata": nota "un importo più basso del totale = acconto".
- ✅ **Acconti**: default proposto **30%** (modificabile) — prassi 10-30%, 30% comune per lavori piccoli. Campo dentro "Altre opzioni" (form snello). Riga acconto in fondo al documento/pagina pubblica. Fattura generata da preventivo con acconto: righe "Acconto già ricevuto −€X / Saldo €Y" (niente nuovo stato DB nell'MVP). **Promemoria automatico** se l'acconto non viene versato (riusa cron solleciti — deciso da Eli). ⚠️ Nota fiscale: all'incasso dell'acconto scatta l'obbligo di fattura d'acconto → quando si segna "Acconto ricevuto" l'app suggerisce di creare la fattura d'acconto.
- ✅ **AI Import**: confermata come feature (scopo = migrazione listino nel catalogo, mai copia "identica" del template). Proposta di implementazione in 3 blocchi presentata il 5 lug — in attesa di conferma numeri/entry point.

### Documenti / numerazione
- ✅ Numeri documento nel formato `NNN/YYYY` **senza prefissi** "Prev"/"Fatt". In-app le fatture mostrano il marcatore "Fatt. NNN/YYYY"; il prefisso legacy va sempre strippato (anche nel link cliente e nel CSV). *(FIX-03)*
- ✅ Bozze senza numero → etichetta "Bozza senza numero" (non "–"). *(FIX-03)*
- ✅ Watermark diagonale rimosso per tutti; resta solo il footer "generato con Carta Canta" (Free). *(sessioni precedenti)*

### Email al cliente
- ✅ L'email invia **solo il link** al documento, **nessun PDF allegato**; il testo non deve mai dire "PDF allegato". *(FIX-04)*
- ✅ `reply-to` = email dell'artigiano: le risposte del cliente arrivano all'artigiano (anche se il mittente è noreply). *(verificato)*
- ✅ Mostrare nell'email il contatto email dell'artigiano come link cliccabile (`mailto`). *(T-12, FIX-11)*
- ✅ La pagina pubblica `/p/[token]` **non** espone l'email personale dell'account: mostra "Contatta {azienda}". *(FIX-04)*

### Invio / reinvio
- ✅ Dopo l'invio lo stato si aggiorna subito (no "Bozza" residua); cliente associato visibile. *(FIX-01/FIX-08)*
- ✅ Selezione contatto da autocomplete → nessun falso conflitto "stessa email". *(FIX-08)*
- ✅ "Reinvia": email destinatario **in sola lettura** sul cliente (reinvio = stesso doc, stesso cliente). *(FIX-09)*
- ✅ Badge "Modificato" sui preventivi, **"Modificata"** sulle fatture. *(FIX-10)*
- ✅ Il badge "Modificato" deve comparire anche cambiando solo descrizione/unità di una voce. *(FIX-08)*

### Coerenza fatture vs preventivi
- ✅ Fatture: stati "Inviata/Pagata/Annullata/Scaduta" (mai "Visto"); sezione "Voci fattura"; campo "Scadenza pagamento"; niente "valido fino al"; avviso "non sostituisce la fattura elettronica (SdI)". *(FIX-02)*
- ✅ Template **Bold**: "TOTALE" sui preventivi, "TOTALE DA PAGARE" sulle fatture. *(FIX-10)*

### Form / voci / dashboard
- ✅ Nuova voce nasce con **Q.tà = 1**. *(FIX-05)*
- ✅ Form snellito: in cima Cliente → Voci → Riepilogo → bottoni; il resto sotto "Altre opzioni" (chiuso in creazione). I campi restano nel DOM (niente perdita dati al salvataggio). *(IMPROVE M1)*
- ✅ Dashboard "azioni prima dei numeri": "Prossima scadenza" in cima, poi KPI "questo mese" (niente "-100%" aggressivo a inizio mese). *(IMPROVE M3 / FIX-05)*
- ✅ Etichette semplici: "Oggetto" → "Titolo del lavoro"; "Validità" → "Il preventivo vale (giorni)". *(IMPROVE M6)*
- ✅ Automazioni/reminder ON di default per i nuovi workspace. *(IMPROVE M5)*
- ✅ Iniziali avatar dalla **ragione sociale**, sempre maiuscole, coerenti col logo. *(T-4, FIX-11)*

### Budget / costi (principio generale)
- ✅ **Eli NON ha budget infinito:** ogni funzione che genera **spesa variabile senza incasso** (es. chiamate AI di utenti Free) va **sempre limitata/capata** (cap per utente, quota, serbatoio legato ai ricavi, e/o tetto di spesa mensile con kill-switch). Mai costi variabili illimitati per i Free. *(deciso giu 2026)*

### AI import (acceleratore onboarding — deciso giu 2026; spec completa in `SPEC_NUOVE_FEATURE.md`)
- ✅ Scopo: **migrazione/onboarding** → importa **voci nel catalogo**. NON funzione quotidiana. MVP solo voci; niente copia del template utente.
- ✅ Copy: MAI "identico" né "simile" → è un **ADATTAMENTO** dei contenuti al template dell'app. Sempre anteprima + modifica prima di salvare.
- ✅ Free: **1 import gratis** (contato solo a salvataggio), poi congelato. Serbatoio gratuito globale = base + N per Pro attivo, ricarica mensile + tetto di spesa mensile (kill-switch).
- ✅ A serbatoio esaurito → **messaggio opzione A**: "Hai finito gli import gratuiti. Con Pro importi quando vuoi." + "Passa a Pro". NON "riprova più tardi".
- ✅ Piattaforma: **Mistral (UE) primario** + OpenAI gpt-4o-mini fallback. Flusso "Completa il profilo" (listino/logo/ATECO, "1 di 3 fatto").

### Processo / git (anti-perdita lavoro)
- ✅ Code lavora **su `master`**, nella cartella `C:\Users\Public\carta-canta`, **niente worktree/branch `claude/*`**, e fa **`git push` a ogni task** (verità = `origin/master` su GitHub).
- ✅ **Backup NAS opzionale** (14 giu 2026): GitHub/origin è il **backup primario**; `git push nas master` solo occasionale e solo col drive Z: montato (utente `moian`). Con `elisa` il push NAS fallisce ed è **normale** — non bloccarsi.
- ✅ Pagamenti: modello "bring your own" (IBAN/QR/PayPal/Satispay) + "segna pagato"; carta via Stripe Connect come perk Pro (Fase 2). *(decisione prodotto)*
- ✅ Recensioni solo cliente→artigiano per ora; SdI con provider gestito; marketplace come fase a parte. *(roadmap)*

---

## B. FEEDBACK APERTI (⏳)
Elenco completo e ordine in `BACKLOG_MIGLIORAMENTI.md` sez. H (T-1…T-18) e sez. A-E. In sintesi i prossimi:
- ✅ Fatto: batch bug mobile `PROMPT_FIX_11` (T-4, T-6, T-7, T-8, T-12, T-15, T-16) — commit `2482124`, verificato nel codice e (T-4,6,7,8,15,16) confermati nel test.
- ✅ Fatto (sessione FIX-13): **T-13** (etichetta "Importa da preventivo" sempre visibile su mobile in `fatture/page.tsx`).
- 🟡 **T-18** — **da riconfermare nel browser** (ultima sessione: FIX-POPUP-CLICK-2). Storia completa: FIX-16 ha portato la tendina su portale `document.body` per evitare il clipping dall'`overflow-y-auto` del `DialogContent`. FIX-POPUP-CLICK ha aggiunto `data-dropdown-portal` + `onPointerDownOutside`→`preventDefault` per bloccare il dismiss del dialog al click sulla tendina. Ma i click ancora non funzionavano: la causa reale è che Radix Dialog (modal=true) chiama `disableBodyPointerEvents()` che imposta `document.body.style.pointerEvents = 'none'` — la tendina eredita `none` dal body e non riceve eventi. **Fix (FIX-POPUP-CLICK-2):** `pointerEvents: 'auto'` aggiunto inline sull'`<ul>` portale in `SendEmailDialog.tsx` e `ClientAutocomplete.tsx` — sovrascrive il `none` ereditato. Il `data-dropdown-portal`+`onPointerDownOutside` rimangono per impedire il dismiss. I tentativi precedenti NON vanno segnati ✅ — questo NON va segnato ✅ finché Eli non lo conferma nel browser. Vedi CLAUDE.md sessioni FIX-16/FIX-17/FIX-18/FIX-19/FIX-20/FIX-POPUP-CLICK/FIX-POPUP-CLICK-2.
- ✅ Fatto (sessione FIX-13): **T-12bis** rifinitura testo email → solo "scrivimi a {email}" (rimosso "rispondi direttamente a questa email o…").
- ✅ Fatto (sessione FIX-13): **T-19** — riapertura automatica del popup invio al reload della pagina (causata da `?send=1` residuo in URL) risolta con `history.replaceState` dopo l'apertura iniziale.
- ✅ Fatto (sessione FIX-13): **T-20** — guardia server-side robusta in `send-email/route.ts`: nessun invio possibile senza almeno una voce completa (descrizione+prezzo+quantità), indipendentemente dallo stato (non salvato) del form. Vedi CLAUDE.md per dettagli/scelta.

> ⚠️ NOTA (assistente Cowork, sessione notturna): i punti FIX-13 sopra sono **applicati nel codice ma NON ancora confermati nel browser da Eli**. In particolare **T-18 (suggerimenti) era già stato segnato ✅ una volta e poi NON funzionava** → trattare come "da confermare" finché Eli non lo verifica nel test.

### Nuovi punti aperti (sessione notturna — prompt pronti)
- ✅ **T-21a** [bug]: messaggio "Nessun template disponibile" fuorviante → sostituito con testo muted neutro "Stai usando il template predefinito Classico…". *(FIX-14)*
- ✅ **T-21b**: banner quota Free non bloccante → reso discreto (`text-xs text-muted-foreground`, non box colorato). Blocco attivo resta prominente (rosso). *(FIX-14)*
- ℹ️ **T-21c**: posizione "Invia al cliente" — creazione (fondo form) vs dettaglio (toolbar) sono schermate diverse, la struttura è corretta. Nessun micro-fix necessario.
- ✅ **Bonus FIX-14**: query indipendenti nelle pagine `preventivi/[id]`, `fatture/[id]` e `dashboard` parallelizzate con `Promise.all` → riduzione latenza (~30-60% sulle pagine di dettaglio con più round-trip).
- ✅ **T-9 / T-22 (PERF-01)**: pagine lente + errore fattura al riapri (cold start Vercel). Parallelizzate con `Promise.all` le query sequenziali indipendenti in: `preventivi/page.tsx` (ricerca: matchingClients+matchingItems; post-lista: convertedRows+viewRows+counts in parallelo), `fatture/page.tsx` (ricerca: matchingClients+matchingItems), `clienti/[id]/page.tsx` (client+documents), `p/[token]/page.tsx` (isOwner+getUserById). Cold start: `@sparticuz/chromium`/`puppeteer-core` sono solo in route AI/PDF (dynamic import), non pesano sulle pagine principali. Il ritardo ~20s su fatture è cold start Vercel (limite del piano) — non implementato warm-ping cron (aggiungerebbe route senza fix definitivo del cold start; documentato come limite da monitorare).
- ✅ **Data contestuale nelle liste** (feat DATA_CONTESTUALE + fix grammatica): nelle liste preventivi e fatture la data accanto a ogni documento è ora contestuale allo stato: bozza → "Modificato il…" (preventivo) / "Modificata il…" (fattura), inviato → "Inviato/a il…" o "Scade tra N g" (rosso se ≤7gg), accettato → "Accettato il…"/"Pagata il…", rifiutato → "Rifiutato il…"/"Annullata il…", scaduto → "Scaduto/Scaduta il…". Helper condiviso `lib/utils/document-date.ts` — tutti gli stati differenziati per genere in base a `docType`. Select Supabase aggiornate. Badge "Modificato/a" e logica di ordinamento invariati.
- ✅ **Filtri di stato anche su Fatture** (feat FATTURE_FILTRI_STATO): la lista Fatture ha ora i tab Tutte / Bozze / Inviate / Pagate / Annullate, identici per markup/stile ai tab della lista Preventivi. `status` aggiunto ai searchParams; filtro applicato in AND con ricerca e filtri avanzati esistenti; `inviate` → `.in('status', ['sent','viewed'])`; empty state contestuale senza CTA fuorviante; conteggio intestazione include il tab attivo.
- ⏳ **Feature**: catalogo + autocompletamento voci → `PROMPT_IMPROVE_catalogo_autocomplete` (arricchito col pattern tendina-a-portale di T-18). È la leva "risparmia-ore" da implementare.
- ✅ Fatto: T-14 (sconto globale > totale voci → totale negativo) — sessione FIX-12, causa A confermata, fix applicato (vedi CLAUDE.md).
- Da indagare: T-9 (lentezza caricamento).
- UX mobile: T-3 (margini/bordi), T-17 (riepilogo voci su una riga).
- Feature: T-1 (CAP→indirizzo), T-5 (catalogo+autocomplete), T-11 (click cliente → pagina cliente), T-2 (ATECO più completi), MOB-1b (invito a installare l'app).

---

## C. ℹ️ Chiariti / non bug
- ℹ️ Link "generato con Carta Canta" nell'email → porta alla landing con "Prova gratis"/registrazione. Eli vedeva l'onboarding perché loggata. *(CHECK-8)*
- ℹ️ "Rispondi a questa email" funziona (reply-to = artigiano). Si rende solo più esplicito. *(T-12)*
