# Carta Canta — Decisioni UI consolidate (revisione mobile, giugno 2026)

> Registro di tutte le decisioni prese e dei pattern consolidati finora.
> Da riportare in `REVISIONE_UI.md` (repo) appena Code è libero. Il mockup è la specifica al pixel.

## A. Pattern UI consolidati — valgono in TUTTA l'app
1. **Sfondo pagina** quasi-bianco (~#fafafa); **card bianche** con **ombra morbida** `--cc-shadow` = `0 1px 2px rgba(20,20,40,.04), 0 6px 16px -8px rgba(20,20,40,.13)` (la versione scura del 16 giu è stata RIPRISTINATA: troppo forte). **Niente bordi**. + un filo di spazio in più tra le card.
2. **Filtri di stato**: pillola **bianca che galleggia** sull'attivo (NIENTE binario grigio); inattivi = testo grigio scuro. Via classi condivise `.cc-tabs / .cc-tab / .cc-tab-active`. Contenitore con `cc-filter-scroll` → scorre in orizzontale, niente slittamento.
   - **Valori esatti (dal mockup):** `.cc-tab-active` → background #fff, border-radius 999, box-shadow `0 1px 3px rgba(20,20,40,.06), 0 7px 18px -4px rgba(20,20,40,.20)`, color var(--cc-navy), font-weight 600, font-size 13, **padding 10px 22px**. `.cc-tab` (inattivo) → color var(--cc-text-2), font-size 13, **padding 6px 5px**, niente sfondo/bordo.
3. **scrollbar-gutter: stable su `<main>`** (AppShell) → lo spazio della scrollbar verticale è sempre riservato, la pagina non slitta cambiando filtro. (NON su `html`: lo scroll è su `<main>`.)
4. **Badge di stato**: sfondo tenue + **testo grigio scuro #2b2b2b**, niente bordo colorato. **Fonte di verità = HOME (`getMobileBadgeBg`), BLOCCATA — non si tocca.** `StatusBadge` (Preventivi/Fatture) si adegua a questi:
   - bozza **#e8e8e8** · inviato **#d8e8fb** · visto **#d8e8fb** · accettato/pagata **#d4efe2** · rifiutato/annullata **#f5dede** · scaduto **#f5e9d0**.
5. **Badge "Modificato/Modificata"**: affiancato al badge di stato sulla **stessa riga** (riga 1), non sotto. Sfondo #e9e0f7, testo #2b2b2b.
6. **Barra di ricerca**: bianca/tenue #f7f7f8, bordo #e6e6e6, `rounded-xl` (12px), **altezza ~44px (h-11)** — non a pillola.
7. **"Ordina"**: solo testo + chevron ("Ordina: … ▾"), **niente riquadro/box**.
8. **Puntini ⋮** (dove presenti): **grigi**, non neri.
9. **Banner Free**: card **corta oro** (corona + "N/8 preventivi gratuiti · Passa a Pro →"), niente arancione/testo lungo. Solo dove c'è la quota Free (= Preventivi).
10. **Niente ⋮ in alto su mobile** (esportava il CSV → resta solo su desktop).
11. **"+" bottom nav = solo Nuovo preventivo** (azione primaria); senza etichetta nel codice reale.
12. **Bottoni di creazione**: primario navy + secondario bianco "galleggiante" (ombra come le card), angoli 14px.
13. **Troncamento** nome cliente lungo con "…" (già nel codice).
14. **Numerazione**: prefisso "Fatt." per le fatture in-app; prefisso "Prev" SOLO in Attività recente Home.
15. **Mockup = specifica al pixel** ("per filo e per segno"), per ogni pagina.

## B. Decisioni di prodotto
- **Scaduti** preventivi → dentro **"In attesa"** (query `['sent','viewed','expired']`), col badge "Scaduto". Niente sesto filtro.
- **Fatture**: filtri = Tutte / Bozze / Inviate / Pagate / Annullate (no "Scadute": le fatture non scadono allo stesso modo).
- **Da preventivo** = percorso primario per creare una fattura; **Nuova fattura** (vuota) = secondario.

## C. Stato pagine
- **HOME**: ✅ BLOCCATA v10 (vedi sez. E) — commit 09d197f + ombra card più marcata.
- **PREVENTIVI**: ✅ allineata al mockup (filtri pillola no-binario, ricerca h-11, Ordina DropdownMenu min-w-190, ⋮ grigi, banner oro, scrollbar-gutter, scaduti in "In attesa", ricerca "modificato").
- **FATTURE**: ✅ allineata (filtri condivisi, no ⋮ CSV in alto, badge "Modificata" affiancato, 2 bottoni creazione, ⋮ per riga).
- ⏳ Prossime: Nuovo preventivo (form) · Dettaglio preventivo · "Altro" (hub) + Clienti/Catalogo.

## D. FATTURE — cosa eredita e cosa è specifico
**Eredita in automatico** (dal lotto Preventivi, componenti/CSS condivisi):
- Filtri no-binario (classi `.cc-tabs/.cc-tab/.cc-tab-active`).
- Ricerca h-11 (SearchBar condiviso).
- Badge di stato grigio scuro (StatusBadge condiviso, con etichette Pagata/Annullata).
- scrollbar-gutter su `<main>` (globale).

**Specifico di Fatture (da fare nel prompt Fatture):**
- Aggiungere `cc-filter-scroll` al contenitore filtri (`className="cc-tabs cc-filter-scroll"`).
- Togliere il **⋮ mobile CSV** in alto.
- Badge **"Modificata"** affiancato al badge di stato (oggi è sulla riga 2).
- **Restyle dei due bottoni** già presenti (Nuova fattura + Da preventivo) → mockup: "Da preventivo" primario navy, "Nuova fattura" secondario bianco galleggiante, sotto al titolo.
- "Ordina" è già solo testo (ok) — eventualmente aggiungere il chevron per uniformità.

**Deciso:**
- ✅ **⋮ per riga anche sulle fatture** (coerenza con Preventivi): riusare `DocumentRowActions` (azioni per id, generiche: duplica / invia-se-bozza / elimina). Code verifica che per una fattura redirect/duplica restino su `/fatture/...` e `doc_type='fattura'`.

## E. HOME — SPEC FINALE v10 (BLOCCATA 16 giu) — riferimento mockup `Carta_Canta_home_v10_ombra.html` (base commit `09d197f` + ombra card più marcata)
NON modificare senza ok esplicito di Eli.
- **Brand strip**: logo "firma" (icona + "Carta Canta" + tagline "il tuo ufficio in tasca") centrato, su bianco con bordo sotto. (SVG viewBox 720×210, height 52, wordmark 64, tagline 40 oro.)
- **Intestazione**: **SENZA logo azienda** (deciso: stona con l'eleganza; il logo vale sul preventivo/PDF dove lo vede il cliente). Solo "Ciao, {nome}" + ragione sociale a sx, avatar (iniziali Nome+Cognome, es. "ED") a dx che apre il menu account.
- **Banner Free**: card bianca, bordo sx 3px oro, corona, "{N}/8 preventivi gratuiti" + "Passa a Pro →" oro. Niente arancione. Pro = nessun banner.
- **Card scadenza** (MobileScadenzaCard): "Scade domani/oggi/il [data]" gold clock; numero·cliente a sx + importo grande a dx; badge "Modificato — cliente non aggiornato" se serve; azioni "Sollecita per mail" (navy largo) + WhatsApp + Chiama (quadratini); hint "Tocca la card per aprire il preventivo". DENTRO la stessa card, sotto una **linea grigia sottile**: "Altri N preventivi in scadenza →" (link a /preventivi/scadenze).
- **WhatsApp**: apre `wa.me/{numero}?text=...` col messaggio **SOLLECITO (Opzione A)**: "Buongiorno {cliente}, le ricordo il preventivo {numero} in scadenza il {data}. Può visionarlo e accettarlo direttamente qui: {link p/[token]}. Resto a disposizione per qualsiasi chiarimento. Cordiali saluti, {azienda}". Il link è cliccabile nel messaggio inviato.
- **Card del mese** (2): **centrate**, label "**Preventivi accettati**" / "**Fatturato**", valore grande, **mese corrente** sotto (dinamico, es. "giugno").
- **Attività recente**: card col titoletto "Attività recente"; righe con prefisso "Prev" sui preventivi (SOLO qui) + "Fatt." sulle fatture; testo grigio scuro; badge coi colori getMobileBadgeBg.
- **Bottom nav**: Home · Preventivi · [+ = Nuovo preventivo, etichetta "Preventivo"] · Fatture · Altro.
- **Badge "Visto"**: **rosa #fbe1ee** (distinto da Inviato/azzurro, Rifiutato/rosso, Modificato/viola) — in StatusBadge E getMobileBadgeBg.
- **Ombra card**: morbida (la scura è stata ripristinata perché troppo forte); leggermente più spazio tra le card.

## F. NUOVO PREVENTIVO — feedback e decisioni (16 giu)
- **Titolo header** più elegante (✕ in cerchietto chiaro, "Nuovo preventivo" centrato).
- **Sfondo grigio** #fafafa, fascia titolo bianca (già via <main>).
- **Template**: sotto il selettore, link "Gestisci i template →" alla pagina template.
- **Unità di misura**: AGGIUNGERE "a corpo" e "cad/cadauno". Attuali: pz · ore · gg · mq · ml · mc · kg · lt · lotto · servizio.
- **Validità vs Termini pagamento**: due cose distinte (ok). Pagamento: opzioni già complete (Alla firma · 10/30/60/90 gg · 30 gg data fattura · Fine mese + 30 gg · Personalizzati).
- **Bonus edilizio** (semplificato): toggle in "Altre opzioni"; se flaggato → campo **% detrazione LIBERA** (l'artigiano la inserisce a mano; niente prima casa/altro). Verificato: **per legge la % NON è obbligatoria nel preventivo** (né in fattura; i riferimenti normativi servono solo sul bonifico) → facoltativa, basta la Nota per eventuali dettagli. Voci bonus **IVA 10%**. **NIENTE trainante/trainato** e **NIENTE auto-redirect**. Colore **ORO** (badge "Bonus 50%"), non lilla.
- **Campi Note**: testo più piccolo (13px); "(visibili al cliente)"/"(non visibili al cliente)" stessa estetica del "(opzionale)" (piccolo, grigio).
- **Altre opzioni**: separare le sezioni con **più spazio** (NO linee divisorie — troppo vicine al testo). Togliere "(opzionale)" dalle etichette (è sottinteso).
- **Riga voce**: distanziare **microfono e cestino** (rischio mis-tap se troppo vicini).
- **Riga voce**: numero non in grassetto (500); Prezzo più largo; Totale "€ 2.800,00".
- **Invia senza cliente**: deve aprire il pop-up invio/condivisione (segna come inviato + condividi link), NON ricaricare in silenzio. Cliente NON obbligatorio.

## G. DETTAGLIO PREVENTIVO SALVATO — feedback (16 giu, mockup da fare)
- Banner **Piano Free** troppo lungo → versione corta (card oro come le altre pagine).
- **TOGLIERE** la frase "Stai usando il template predefinito Classico…".
- Testi del dettaglio (descrizione, note) troppo lunghi → più compatti.
- Mockup da costruire con gli screen di un preventivo INVIATO + ACCETTATO + la parte Cronologia.
- ✅ **FATTO (screen 8)**: header back+titolo+matita, badge stato, banner oro corto, card Cliente, Riepilogo compatto, chip uniformi (Anteprima·Salva PDF·Condividi), "Segna accettato/rifiutato", Cronologia timeline. Frase template NON presente.

## F-bis. NUOVO PREVENTIVO — aggiornamenti 16 giu (cont.) — mockup `Carta_Canta_mockup_app.html`
- **Microfono**: spostato in **alto a destra della card voce** (coerente con le Note, che già hanno il mic in alto a dx). Una sola posizione, usata ovunque.
- **Cestino**: non più accanto al mic. Diventa **"🗑 Rimuovi"** (testo+icona, grigio) in **basso a sinistra** della voce — opposto al Totale (basso dx) e lontano dal mic (alto dx) → niente mis-tap.
- **Bonus edilizio**: checkbox → **interruttore (toggle)**, acceso = **oro**. Acceso mostra % libero ("50 %") + "Bonus attivo" oro + help breve.
- **Bonus IVA 10% — correzione**: vale **solo in regime ordinario**. In **forfettario** non c'è IVA (fuori campo) → la % è **solo informativa**. Testo live attuale ("IVA 10% attiva. Usa il menu Standard/Trainante/Trainato…") da correggere su entrambi i fronti. Mockup reso regime-aware.
- **"Personalizzati" (pagamento)**: deve aprire **campo di testo libero** (oggi non lo fa → bug). Mockup screen 5.
- **"Scadenza stimata: …"** sotto i termini di pagamento: comportamento corretto, mantenuto (screen 7).
- **"la imposti tu"**: rimossa dal mockup.

## H. VERIFICA CALCOLI + BUG/DA DECIDERE (screenshot 16 giu) — fonte: valori reali degli screenshot
**Calcoli — TORNANO (verificati in Python):** voci 7.500 + 10 + 1.288.320 = Subtotale **1.295.830**; Sconto = 20% (259.166) **+** 1.020.000 fisso = **1.279.166**; Imponibile **16.664**; forfettario fuori campo IVA; bollo **2,00**; **Totale 16.666** ✓
**Da decidere / bug (prompt Code NON ancora inviati):**
1. **Sconto % e Sconto in € si CUMULANO** (si sommano). Voluto? → decidere: cumulativi o mutuamente esclusivi.
2. **Campi numerici accettano zeri iniziali** ("020", "0102 0000"): normalizzare (no leading zeros; eventuale separatore migliaia).
3. **Bonus "IVA 10%" in forfettario scorretto** (vedi F-bis): correggere testo + logica (10% solo ordinario).
4. **"Personalizzati" pagamento non apre campo libero**: bug → fix.
5. **Numero "#003/2027"**: creato a giugno 2026 ma anno 2027 (scadenza 2026 incoerente). Verificare: bug numerazione o data a mano?
6. **Bug Condividi/"Segna come inviato"** (turno precedente): `hasVoci` server stale → non vede voci non salvate. Fix: salvare il form prima di condividere.

## I. RAFFINAMENTI 16 giu (cont. 2) — mockup `Carta_Canta_mockup_app.html` aggiornato
**Riga voce:**
- **Microfono DENTRO** il riquadro Descrizione, dimensione ~testo (15px). Stesso per le **Note** (mic dentro il box). Una sola posizione coerente.
- **Cestino** spostato in **alto a destra**, in linea con "VOCE 1" (18px grigio). Sparito "Rimuovi" in basso → footer = solo Totale.
- **"VOCE 1" = 10px** (più piccolo di "VOCI" 11px).
- **Unità** allargata a 90px + ellissi → **fix "servizio" che usciva dal riquadro** (è anche bug app reale → Code).

**Pagamento — "Scadenza stimata" RIMOSSA dal preventivo.** Motivo (verificato): su un preventivo la scadenza di pagamento dipende dalla data **fattura**, che non esiste ancora; calcolarla da oggi è falsa precisione/fuorviante. Sul preventivo si mostra solo il **termine come testo**; la data concreta ha senso solo sulla **fattura**. "Personalizzati" → campo libero "Scrivi tu le condizioni: appariranno così sul preventivo".

**Bonus — frase confermata corretta** (con cautela): % = detrazione, solo informativa (non obbligatoria su preventivo/fattura). IVA 10% = agevolata su interventi edilizi, vale **solo in ordinario** (forfettario: no IVA). Caveat futuro: **beni significativi** (caldaie, sanitari) → 10% solo fino al valore manodopera, eccedenza 22% → l'artigiano deve poter cambiare l'IVA per voce. **Badge "Bonus 50%"**: ora **solo testo oro discreto** (niente pillola piena "pacchiana").

**Dettaglio preventivo salvato:**
- **"Salva PDF" RIMOSSO** (font/template non replicabili 1:1 nel PDF — decisione già presa).
- Anteprima/Condividi e Segna accettato/rifiutato resi più eleganti.
- **Cronologia colorata per stato** (azzurro=inviato, verde=accettato, rosso=rifiutato, rosa=visto, ambra=scaduto), come nell'app.

**Pop-up Invia/Condividi — NUOVO FLUSSO (da confermare con Eli):**
- WhatsApp = **stessa icona SVG e colore navy della Home** (non verde). Tolto il tile "Copia link" (la copia è già nel campo link). "Altre app" = menu di sistema (Telegram/SMS…).
- **Decisione proposta: condividere = inviare.** Ogni canale (WhatsApp/Email/Copia/Altre app) segna **in automatico** il preventivo come "Inviato" (status sent + parte validità + consuma quota Free + abilita tracciamento). Niente più passo separato "Segna come inviato" da dimenticare.
- ~~Scorciatoia in fondo "L'ho già mandato io — segna come inviato"~~ **RIMOSSA (cont. 4)**: ridondante dentro un pop-up che parla già di "inviare". Il "segna come inviato a mano" (caso invio fuori app) va semmai sul **dettaglio** come azione di stato, non qui.
- Trade-off onesto: aprendo WhatsApp non possiamo sapere se il messaggio è stato davvero inviato → marchiamo "Inviato" in modo ottimistico (lo stato resta visibile/modificabile). Alternativa: conferma dopo ("Hai inviato? Sì/Non ancora") — più attrito.
- Nota: potenziale ridondanza con il bottone esistente "Invia al cliente" (email via app) → valutare se unificare.

## L. RAFFINAMENTI 16 giu (cont. 3)
- **Testo dentro TUTTI i campi compilabili = 13px** (uniforme con le Note). Etichette sopra i campi restano 14px/600.
- **"* Campo obbligatorio" + tutti gli asterischi = oro #b08d3e** (come "Bonus attivo"). Vale anche nel popup "Da catalogo" per coerenza.
- **Cestino voce ridotto a 16px.**
- **Pagamento "Personalizzati"**: testo → "Scrivi tu le condizioni: appariranno sul preventivo…" (tolto "così").
- **Dettaglio — "Segna accettato/rifiutato" su sfondo BIANCO** (tolti verde/rosso); resta solo l'icona colorata (check verde / x rosso) + bordo+ombra come le chip.
- **Cronologia = toni dei badge**: ogni nodo usa lo **sfondo pastello del badge** corrispondente + icona dello stesso tono più scuro (creato grigio, inviato azzurro #d8e8fb, visto rosa #fbe1ee, accettato verde #d4efe2, rifiutato rosso #f5dede, scaduto ambra #f5e9d0). "In attesa" = grigino neutro.
- **Pop-up Invia**: icone WhatsApp/Email/Altre app **tutte navy #1a1a2e** (come la Home). Frasi più formali: «Selezionando un canale, il preventivo viene automaticamente contrassegnato come "Inviato" e la sua validità decorre da questa data.» / «Ho già inviato il preventivo per altra via — contrassegna come inviato».
- **Ombra/estetica**: verificato che la card delle schermate nuove usa **già la stessa ombra** delle bloccate (`0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px …`, 14× in Home/Prev/Fatt). Allineate.

## M. RIFINITURE Nuovo preventivo — feedback Eli dopo test su telefono (post commit H)
Verifica codice OK su: header fascia bianca + ✕ cerchio, mic compact 14px, barra cliente #f7f7f8, select mobile #e3e3e6/r10, totale "€ 0,00", VOCE 10px. Restano da sistemare:
1. **"Gestisci i template →"** sotto il select Template: MANCA nell'app (è nel mockup). Da aggiungere (13px navy + icona ingranaggio, link a /template).
2. **Placeholder/testo nei campi**: colore troppo scuro + sembra font diverso → placeholder color **#8a887f** e `font-family: inherit` (Inter) su tutti i campi.
3. **Badge oro "Bonus {N}%" vicino a "VOCI"**: con bonus attivo NON compare (è nel mockup). Aggiungere testo oro discreto #b08d3e a destra di "VOCI".
4. **Help bonus** ("Percentuale di detrazione…"): per forfettario mostra solo la 1ª frase (corretto: niente IVA). Da CONFERMARE con Eli se va bene o vuole altro testo.
5. **Bottoni "Salva bozza"/"Invia al cliente"** più bassi del mockup → aumentare altezza (padding verticale / min-height).
6. **Campo Prezzo**: mostrare i 2 decimali ("0,00", "70,00") almeno al blur, restando editabile.
7. **Caret "Cerca o crea cliente"** più in basso della prima lettera del placeholder → centrare verticalmente testo+caret (line-height/altezza input).
8. **Sconto**: bloccare le lettere (solo numeri + separatore decimale); applicare il filtro anche a Q.tà/Prezzo (NumericInput) così le lettere non compaiono mai.
9. **DECISIONE NUOVA — "+1px" a tutte le scritte di Nuovo preventivo** (rispetto al mockup): testo campi 13→14, etichette campo 14→15, titoli sezione 11→12, etichette colonne voce 11→12, "VOCE N" 10→11, Totale riga voce 13→14, help 12→13. **ECCEZIONI (NON aumentare):** titolo header "Nuovo preventivo" (resta 17px), parola "TOTALE" + importo nel Riepilogo, testo bottoni "Salva bozza"/"Invia al cliente" (restano 14px). Il mockup resta la specifica strutturale; questa è una delta documentata sui font.
10. **Allineamento riga voce — Unità sulla stessa riga di Q.tà/Prezzo/Sconto.** Oggi il select Unità ha altezza diversa dagli input → la sua etichetta finisce su una riga più alta. Dare a Unità la stessa altezza degli altri campi così etichette e campi stanno su un'unica riga.
11. **Bonus % NON va sottratto dal totale — comportamento CORRETTO.** La % è la *detrazione fiscale* che il cliente recupera dalle proprie tasse (es. 50% in 10 anni via dichiarazione), NON uno sconto sul preventivo. Il cliente paga l'intero, poi recupera la % col fisco. Quindi è giusto che il totale resti pieno. **Riga "Detrazione stimata": NO (Eli, scartata).**

## N. RIFINITURE colori/tipografia/icone (feedback Eli post-commit K/L)
12. **Gerarchia grigi:** TITOLI SEZIONE (CLIENTE/VOCI/RIEPILOGO/Altre opzioni) = grigio più scuro **#6f6d64**; SOTTO-ETICHETTE (VOCE N + titoletti campi tipo "Numero preventivo") = **#8a887f**.
13. **"Altre opzioni"** = stesso stile di VOCI (cc-section-label: 13px/600/.07em/uppercase/#6f6d64) + chevron.
14. **Titoletti campi** (Numero preventivo, Titolo, Template, Note, Note interne, Validità, Termini, Bonus) = tipografia di "VOCE 1": 12px/600/#8a887f/letter-spacing 0.05em, caso normale. SOSTITUISCE la dimensione 15.
15. **Icona bonus:** lucide `Tag` (sembra etichetta) → `BadgePercent` (percentuale), color oro #b08d3e. Solo sull'indicatore "Bonus attivo" in Altre opzioni.
16. **Badge "Bonus {N}%" vicino a VOCI: RIMOSSO** (Eli — ridondante, già mostrato in Altre opzioni). Supera la decisione del mockup che lo prevedeva.
17. **Valori dentro i campi riga voce** (Unità/Q.tà/Prezzo/Sconto/IVA): 15→14 (fatto) → **ulteriore a 13** (Eli). Descrizione resta 15; etichette colonna 13; VOCE N invariato.
18. **Popup catalogo:** bande categoria troppo chiare (bg-muted) → grigio più scuro come il mockup ("Pop-up Da catalogo").
19. **Nota "Regime forfettario — operazione fuori campo IVA"** (FiscalSummary.tsx, riga ~99): quasi illeggibile (`text-muted-foreground/70`) → togliere opacità /70 e usare grigio più scuro **#6f6d64**.
20. **Titoletti campi Altre opzioni → MAIUSCOLO** (textTransform uppercase): tutta la parola in maiuscolo (NUMERO PREVENTIVO, TITOLO DEL LAVORO, ecc.). Restano 12px/600/#8a887f/0.05em.
21. **Le tre frasette → stesso stile: text-[12px] + colore text-muted-foreground (#767676, ben leggibile).** "Numero assegnato automaticamente…" (~736) e "Percentuale di detrazione…(non è obbligatoria)." (~953) erano text-[14px] → 12px (colore già muted-foreground, ok). La nota "Regime forfettario — operazione fuori campo IVA" (FiscalSummary) → **OVERRIDE dell'item 19**: non più #6f6d64 ma **text-muted-foreground #767676** + text-[12px], così è uguale alle altre due (Eli: questo colore si vede bene).
22. **"Subtotale"** (FiscalSummary, riga ~66) → ~~stile VOCI~~ **CAMBIO IDEA Eli: uguale a "TERMINI DI PAGAMENTO"** (stile titoletto campo): 12px/600/**#8a887f**/letter-spacing **0.05em**/uppercase → "SUBTOTALE". (Non più #6f6d64/13px/.07em.)
23. **"(visibili al cliente)" / "(non visibili al cliente)"** (span dentro le label Note/Note interne, ~795/~825): oggi fontSize 14/weight 400 → devono ereditare lo stile della label "NOTE" (12px/600/#8a887f/0.05em/uppercase). Togliere gli override fontSize:14 e fontWeight:400 dallo span → tutto uniforme "NOTE (VISIBILI AL CLIENTE)".
24. **Spazio tra "ALTRE OPZIONI" e "NUMERO PREVENTIVO"**: il div campi (~riga 705) non ha padding-top → aggiungere `pt-2` (≈8px) allo stato aperto. ✅ Fatto (commit P, `pt-3`).

## ✅ NUOVO PREVENTIVO — BLOCCATA (Eli approvata)
La pagina Nuovo preventivo è approvata e bloccata. Non modificare senza ok esplicito di Eli.
**Tweaks residui (opzionali, NON ancora applicati al momento del blocco — da chiarire con Eli):**
- "(visibili al cliente)"/"(non visibili al cliente)" ancora 14px/400 invece di uguali a "NOTE" (item 23).
- "Subtotale" ancora stile VOCI (#6f6d64/13px) invece di stile "Termini di pagamento" (#8a887f/12px) (item 22).
