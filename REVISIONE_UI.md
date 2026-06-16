# REVISIONE UI — pagina per pagina (con Eli, giugno 2026)

> Traccia della revisione estetica/funzionale fatta con Eli, schermata per schermata, confrontando l'app con i mockup.
> **Regola per Code:** le voci marcate ✅ VOLUTO sono decisioni intenzionali di Eli — NON modificarle/annullarle.
> Stato: 🗣️ in discussione · ✅ deciso (voluto) · ⏳ da implementare. Niente prompt a Code finché Eli non dà l'ok.
> Giudice dell'estetica = Eli con gli screenshot dal telefono. Il browser di Claude è inaffidabile.

## Principio generale
- ✅ **Desktop ⊇ mobile**: il desktop deve avere SEMPRE più funzioni/densità del mobile (es. dashboard: 4 KPI + grafico + card extra in `hidden lg:`). NON rendere desktop e mobile identici. Il mobile è la versione semplificata.

---

## HOME (dashboard) — revisione 15 giu 2026

### Deciso (✅ VOLUTO)
- ✅ **Togliere la doppia intestazione su mobile.** Oggi: barra globale ("Eli Impianti" + avatar) + intestazione Home ("Ciao, X" + campanella + secondo avatar) → nome doppio e due avatar. Tenere UNA sola intestazione su mobile (rimuovere la barra globale su mobile; il desktop mantiene il suo layout).
- ✅ Riquadri "Accettati · mese" / "Fatturato · mese": vanno bene così.
- ✅ "Attività recente" con righe + pill (Pagata/Visto/Bozza/Inviata): va bene così.

### Da decidere / proposte (🗣️)
- 🗣️ **Branding in Home (richiesta Eli):** mostrare il logo Carta Canta + tagline "il tuo ufficio in tasca" (come promemoria) E il logo dell'artigiano (se caricato) + nome azienda. Proposta layout: striscia sottile in alto col brand Carta Canta + tagline (muted); sotto, intestazione con logo artigiano + "Eli Impianti" + "Ciao, [nome]" + campanella + avatar/menu. Da confermare dove mettere il brand Carta Canta. (Richiederà aggiornamento del mockup Home.)
- 🗣️ **Campanella:** oggi non fa nulla (il centro notifiche non esiste ancora). Proposta: o nasconderla finché non c'è il centro notifiche, o farla puntare a "Scadenze e solleciti". Da decidere.
- 🗣️ **Nomi/iniziali confusi (TE / T2 / "d d"):** l'app mescola ragione sociale ("Test eli 2") e nome utente ("d d"), con iniziali calcolate in modo incoerente. Decisione di progetto già esistente: avatar = iniziali della RAGIONE SOCIALE, sempre → "TE". Da fixare le incoerenze (T2, "d d"). Da decidere: il saluto "Ciao, X" usa il nome persona o la ragione sociale? (Con la singola intestazione resta un solo avatar che apre il menu.)
- 🗣️ **Banner giallo Free troppo lungo** ("Hai inviato 3 di 8 preventivi gratuiti…"): accorciare, es. "3/8 preventivi gratuiti · Passa a Pro →".
- 🗣️ **Su Pro: doppio reminder** (banner "X preventivi senza risposta 14+ gg" + card "Prossima scadenza") = ridondante. Proposta: su Pro togliere il banner giallo separato e tenere solo la card "Prossima scadenza"; l'info "senza risposta" va nella sezione Scadenze/solleciti. Da confermare.
- 🗣️ **Card "Prossima scadenza" troppo lunga/ridondante** (oggi: Inviato il…/Modificato il…/Non ancora rinviato + badge + "Nessun sollecito inviato" + Sollecita email + telefono). Il mockup era troppo stringato. Proposta via di mezzo: titolo + "Vedi tutte"; riga numero·cliente·importo; UNA riga stato ("Scade tra N gg" rosso se vicino / "In attesa da N gg") + badge "Modificato" solo se serve; azioni "Sollecita" (primaria) + "Apri" (+ "Chiama" se c'è il telefono). Togliere le righe verbose. Da confermare.

## Colori brand nell'app (✅ deciso 15 giu — chiude il "DA VALUTARE" sez. G)
- ✅ Introdurre i colori del logo come **ACCENTI**, mantenendo l'app sobria/elegante/leggera:
  - **Navy #1a1a2e** = struttura + azioni primarie (già così).
  - **Oro #c9a44c** = accento RARO/"premium": wordmark "Canta", elementi Pro (corona, "Passa a Pro"), piccoli dettagli/indicatori. MAI sfondi di aree grandi.
  - **Crema #f3ede0** = tinta calda leggera in piccole dosi (es. striscia brand).
  - Neutri/bianco = base; testo scuro.

## HOME — 2° giro (revisione mockup home_v2, 15 giu)
- ✅ **Logo vero**: usare gli asset in `branding/` (logo-compact-light.svg / icon.svg) + wordmark Georgia "Carta **Canta**" ("Canta" oro) + tagline "il tuo ufficio in tasca". NON ridisegnare un "CC".
- ✅ Card scadenza: in alto **non** "Prossima scadenza" ma l'urgenza diretta: **"Scade domani" / "Scade il [data]"**.
- ✅ Togliere **"Vedi tutte (4)"**.
- ✅ Bottone **"Sollecita per mail"** (campanello) + icona telefono/WhatsApp se c'è il numero.
- ✅ Notifiche/campanella = **To-Do** (centro notifiche da costruire); per ora campanella nascosta dalla Home.
- ✅ Saluto sempre col **nome** (raccolto in registrazione/onboarding; fallback ragione sociale se manca).
- ✅ **Più preventivi in scadenza ravvicinata** (deciso 15 giu): Home = **1 card** del più urgente + riga **"Altri N in scadenza →"** verso pagina Scadenze. Sulla pagina Scadenze: sollecito **uno per uno** (ogni preventivo il suo "Sollecita per mail"). **NIENTE "Sollecita tutti" automatico** (rischio invio di massa accidentale, niente controllo per singolo, spam). Eventuale futuro "Sollecita tutti" SOLO come **riepilogo + conferma** (mai invio silenzioso).

## TO-DO emersi
- ⏳ Costruire il **centro notifiche** (campanella Home).
- ⏳ Pagina **Scadenze e solleciti**: sollecito per singolo (uno per uno). "Sollecita tutti" SOLO come opzione futura con riepilogo+conferma (mai invio silenzioso).
- ⏳ Registrazione/onboarding: assicurarsi di raccogliere il **Nome** (per il saluto).

## ELEGANZA — principi (ricerca web 15 giu 2026) — applicare a TUTTA l'app
- **Base bianca + molto spazio bianco**: sfondo prevalentemente bianco/quasi-bianco, **NON beige/crema**. Lo spazio bianco = eleganza e respiro.
- **Palette limitata** (max ~4 colori): navy + oro (brand) come **accenti**, neutri/grigio per il testo, bianco come base. Evitare colori fuori palette (es. l'arancione del banner). I colori "di significato" (badge di stato) restano.
- **Ombre morbide** su sfondo bianco/chiaro → le card "galleggiano"; angoli arrotondati. È il tocco premium.
- **Gerarchia con la tipografia** (peso/dimensione), non con il colore. Brand in Georgia serif; UI in Inter.
- Coerenza (stessi raggi, stesse ombre, stesse spaziature); micro-interazioni discrete.
- Fonti: LogRocket (linear design), MockFlow/Uitop (minimalism UI), Envato/DECODE (color trends 2026).

## HOME — 3° giro (feedback sui mockup, 15 giu)
- ✅ **Attività recente**: prefisso **"Prev"** davanti ai PREVENTIVI (le fatture hanno già "Fatt.") perché sono in un unico elenco. ⚠️ **SOLO in questa schermata**, NON altrove.
- ✅ **Sfondo pagina NON beige** (#eceae4 = "orribile") → **bianco/quasi-bianco**. (segnalato)
- ✅ **Banner quota Free**: l'arancione è fuori palette → riportarlo a navy/oro o renderlo molto discreto. Unici colori accettati in Home = i **badge di stato**.
- ✅ **Tagline** "il tuo ufficio in tasca": **oro #b08d3e**, Georgia corsivo (come `logo-firma-light.svg`), non grigia.
- ✅ **Logo** più grande (era troppo piccolo).
- ✅ **Ombre morbide ben visibili** (eleganza) — prima non si notavano.
- ✅ Direzione generale: **più bianco + navy/oro del logo con eleganza**; niente beige.

## HOME — SPEC FINALE (✅ BLOCCATA 15 giu — riferimento mockup `mockup-mobile/home_v2.html`) — ✅ IMPLEMENTATA 15 giu, rifiniture 16 giu
Code: questa è la Home definitiva concordata con Eli. NON reintrodurre ciò che è stato tolto.
- **Intestazione unica** su mobile (rimuovere la barra globale doppia). **Campanella tolta** (notifiche = To-Do).
- **Brand**: usare il logo **"firma" ufficiale** (`branding/logo-firma-light.svg`: icona + "Carta Canta" + tagline) **centrato**, su una riga compatta. Tagline "il tuo ufficio in tasca" leggibile (oro #b08d3e, Georgia corsivo); wordmark un filo più piccolo della tagline-default. Sezione brand bassa (poco padding).
- **Header**: logo azienda (se caricato) + **"Ciao, [nome]"** + ragione sociale + avatar (apre menu account). Saluto col **nome** (raccolto in registrazione; fallback ragione sociale).
- **Sfondo pagina quasi-bianco** (~#fafafa); **card bianche con ombre morbide visibili**. NIENTE beige.
- **Testi** grigio scuro; titoli/numeri quasi neri.
- **Banner quota**: Free = card bianca con accento **oro** + corona "Passa a Pro" (NO arancione). Pro = **nessun banner**.
- **Card scadenza** snella: header urgenza **"Scade domani / Scade il [data]" in ORO** (non "Prossima scadenza", non "Vedi tutte"); riga numero·cliente·importo; badge "Modificato — cliente non aggiornato" **solo se serve** (triangolo attenzione più marcato); azioni **"Sollecita per mail" + icone WhatsApp + Chiama**; **card tappabile** per aprire.
- Sotto la card: riga **"Altri N in scadenza →"** (triangolo attenzione più marcato) → pagina Scadenze e solleciti.
- **Riquadri** Accettati/Fatturato: card bianche con ombra.
- **Attività recente** (card): righe con prefisso **"Prev"** sui preventivi (⚠️ SOLO qui) e "Fatt." sulle fatture; **badge** = sfondo tenue ma distinguibile + **testo grigio scuro** (non colorato).
- **Bottom nav**: Home·Preventivi·[+]·Fatture·Altro, "+" centrato.
- **Palette**: navy (azioni/struttura), oro (brand/Pro/urgenza), badge di stato; base bianca + ombre. Niente colori fuori palette.
- **Desktop ⊇ mobile**: il desktop mantiene 4 KPI + grafico (più del mobile).
- **Pagina "Scadenze e solleciti"** = hub per sollecitare QUALSIASI preventivo fermo: sia quelli **in scadenza** sia quelli **"in attesa di risposta da tempo"** (anche NON in scadenza). Sollecito uno per uno.
- ✅ **Avatar account (in alto a dx)** = **iniziale Nome + iniziale Cognome** dell'UTENTE (es. "Eli Dal Pozzo" → **"ED"**; "d d" → "DD"), NON della ragione sociale → coerente con "Ciao, {nome}". ⚠️ Supera la vecchia regola T-4 "iniziali avatar dalla ragione sociale" SOLO per l'avatar dell'account/persona loggata. (Gli avatar di altri soggetti, es. clienti, restano le loro iniziali.)
- ✅ **Menu avatar**: nell'header tenere SOLO la **mail** (+ badge piano se non Free) — **rimuovere la riga col nome** sopra la mail (ripete l'avatar). Poi Impostazioni + Abbonamento + Esci.
- ✅ Segnaposto logo azienda **nascosto** se non caricato; icona **WhatsApp** = logo vero (SVG); **"Vedi tutti" rimosso** dall'Attività recente mobile (apriva solo i preventivi, non le fatture).
