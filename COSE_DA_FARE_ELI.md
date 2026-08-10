# Cose da fare (Eli) — aggiornato al 6 agosto 2026

> Tutto ciò che richiede un'azione manuale tua e non risulta ancora fatto.
> Spunta le caselle man mano; quando una sezione è completa dimmelo e
> aggiorno il file. In fondo c'è la sezione **TEST** con tutti i collaudi.

---

## 🔐 0. DA CONTROLLARE ORA — Autenticazione a 2 fattori sui TUOI account

> Promemoria che mi hai chiesto tu (5 ago). È **l'azione di sicurezza col miglior
> rapporto tra fatica e protezione**: la nostra app è difesa bene, ma chi entra in
> uno di questi cinque account non ha bisogno di attaccarla — si prende tutto
> (dati di tutti gli artigiani, dominio, codice, incassi).

Su ognuno: attiva il **2FA con app di autenticazione** (Google Authenticator, Authy,
1Password…) — **non con SMS**, che si intercetta con lo scambio di SIM — e **salva i
codici di recupero** (stampati o in cassaforte, non nella stessa email).

- [x] ~~**Supabase**~~ ✅ (5 ago: accesso via GitHub → eredita il 2FA di GitHub.
      ⚠️ Unico controllo residuo: verificare di NON avere anche una password
      Supabase impostata — sarebbe una porta laterale senza secondo fattore.)
- [x] ~~**Vercel**~~ ✅ (5 ago)
- [x] ~~**GitHub**~~ ✅ (5 ago)
- [x] ~~**Registrar del dominio (OVH)**~~ ✅ (5 ago: app di autenticazione)
- [x] ~~**La tua casella email**~~ ✅ (5 ago)

**🎉 SEZIONE COMPLETATA (5 ago).** Resta solo da verificare che i **codici di
recupero** di ciascun account siano al sicuro e non nella stessa email.
NB: il banner Vercel "Organization MFA enforcement → Upgrade to Pro" NON serve —
è l'obbligo di MFA per i membri di un team, e il team è di una persona sola.

---

## 🔐 0-bis. DUE MIGRATION (5 ago) — applicate, resta da confermare

Applicate da Eli il 5 agosto dal telefono. **Verificato dal vivo**: le impostazioni
di pagamento si salvano correttamente (= il codice nuovo è online e la 070 non ha
rotto il salvataggio) e il cambio IBAN **fa partire davvero l'email di avviso**.

- [x] ~~**069 — chiude davvero l'archivio foto.**~~ ✅ La 068 non era bastata: era
      rimasta la vecchia regola *"le foto le può leggere chiunque"*, e le regole si
      sommano. Con la chiave pubblica del sito si poteva sfogliare e scaricare le foto
      di **tutti** gli artigiani. **Confermata dal vivo** il 5 ago con
      `npm run security:check`: un anonimo non sfoglia più l'archivio.
- [x] ~~**070 — l'IBAN si cambia solo passando dall'app.**~~ ✅ Senza, chi ruba una
      sessione cambia le coordinate di pagamento **scavalcando l'email di avviso**.
      **Confermata** il 5 ago (query su `pg_trigger` → `070 OK`), e verificato che il
      salvataggio dei pagamenti funziona e l'avviso email parte davvero.

**🎉 SEZIONE COMPLETATA.** Nota di metodo, perché è costata una giornata: salvataggio
riuscito ed email ricevuta dimostravano che il **codice** funziona, non che le
migration fossero in piedi — sarebbero andati a buon fine anche senza. È la stessa
trappola della 068 (il collaudo passava perché toccava l'unico canale già chiuso).
Per le migration che toccano la sicurezza, la prova è sempre **guardare il database**,
mai l'effetto in interfaccia.

---

## 🔐 0-ter. DUE VARIABILI SU VERCEL (5 ago, 5 minuti) + migration 072

- [ ] **`SECURITY_EVENT_SALT`** → genera con `openssl rand -hex 32`, incolla su Vercel,
      Redeploy. Senza, il registro degli eventi di sicurezza funziona ma **non salva
      l'impronta degli indirizzi IP** — e metà delle soglie di allarme che abbiamo
      progettato non sarebbe calcolabile. Non cambiarla più dopo averla impostata
      (le impronte vecchie e nuove smetterebbero di confrontarsi).
- [x] ~~**Migration 072**: impedisce al database di accettare per sbaglio testi personali
      nel registro eventi~~ ✅ 6 ago — ma **applicata solo per metà**, vedi qui sotto.
- [x] ~~**Migration 072, la seconda metà** (REVOKE+GRANT sulle funzioni di pulizia)~~
      ✅ 6 ago — applicata da Eli nella versione CORRETTA (quella col GRANT a
      service_role: la prima stesura conteneva un errore che avrebbe fermato la
      pulizia notturna dei registri; trovato e corretto PRIMA che venisse applicata).
      **Con questa, le migration 001-072 sono tutte applicate per intero.**
- [x] ~~**`OPENAPI_COMPANY_API_KEY`** (token IT-start in produzione)~~ ✅ 5 ago + Redeploy.
      **Collaudata in produzione**: P.IVA vera fuori dal VIES → pubblicata con
      "Riscontro automatico sul **Registro Imprese**"; P.IVA inventata → bloccata.
      Costo reale 0,050 €/chiamata con **le prime 30 al mese gratis** → in beta zero.
- [ ] ⏰ **`ORPHAN_CLEANUP_ENABLED=true` — DAL 1° SETTEMBRE, NON PRIMA.** Il job della
      pulizia file gira il 1° di ogni mese alle 4:00 e per ora **conta soltanto**.
      Il 1° settembre esiste il primo report: si guardano i numeri e, se sono sensati,
      si accende. **Non serve che te lo ricordi tu**: il promemoria è in cima a
      `CLAUDE.md` e Claude lo tira fuori da sé alla prima sessione di settembre.
      Se vuoi una rete in più, mettiti una sveglia sul telefono al **1° settembre**.
      ⚠️ Perché non accenderla adesso: il 5 agosto la revisione ha trovato che il
      confronto sbagliava e **avrebbe cancellato tutti i loghi in uso** — l'ha reso
      innocuo solo il fatto che la cancellazione fosse spenta.

## 🔴 1. URGENTE — Rotazione password account demo (GitGuardian)

La password del demo è finita nel repository pubblico (segnalazione GitGuardian
del 15 lug). Se hai già lanciato `seed:demo` in passato, l'account esiste in
produzione con quella password: va cambiata subito.

- [x] ~~Nel file `.env.local` una password NUOVA (min 12 caratteri): `DEMO_PASSWORD=...`~~ ✅
- [x] ~~`npm run seed:demo` — ruota la password in prod + rigenera il demo~~ ✅ (20 lug: seed
      andato a buon fine, "ACCOUNT DEMO PRONTO" → password = quella del tuo .env.local; la vecchia è morta)
- [x] ~~GitGuardian: segnare l'incident risolto~~ ✅ (20 lug: incident del 15 lug → Resolved
      "Secret revoked"; le 2 segnalazioni di maggio erano falsi positivi — password finta nei
      test + falso riconoscimento in auth/confirm — → Ignored "Not a secret". 0 incident aperti.)

**🎉 SEZIONE COMPLETATA — l'incidente GitGuardian è chiuso del tutto.**

---

## ⚖️ 2. Professionisti — il cancello che sblocca quasi tutto

> **📅 Stato al 7 agosto 2026 — i due professionisti sono a punti diversi, e si trattano in
> modo diverso:**
> · **Commercialista → dossier GIÀ MANDATO** (5 ago, con la mail preparata insieme). Si aspettano
>   le risposte. Le domande nate dopo NON diventano un nuovo PDF: si mandano di seguito nella
>   conversazione già aperta, numerate N1, N2… → sezione «Nuove domande» qui sotto.
> · **Avvocato → non ancora contattato**, si parte a **settembre**. Qui basta **una lista unica**:
>   tutto quello che si accumula entra nel PDF che gli si manderà, in un colpo solo.

- [ ] **Inviare all'avvocato UN SOLO file**: `CartaCanta_Avvocato_DOSSIER_UNICO_19lug2026.pdf`
      (in chat, 19 lug — 16 aree: riassorbe e SOSTITUISCE tutti i PDF precedenti del
      7/14/15/17 lug e l'addendum ads; include anche le domande sulla campagna video AI).
      ⏭️ **Da aggiungere alla prossima rigenerazione del dossier** (annotato 4 ago):
      pagamenti con carta via **Stripe Connect Standard** (direct charge sull'account
      dell'artigiano, Carta Canta mai parte del flusso di denaro) — conferma impostazione
      + aggiornamento Termini/Privacy (Stripe destinatario). Dettagli in PROGETTO_PAGAMENTI_CARTA.md §3.
      Allega solo, se te lo chiede: PLAY_STORE_SCHEDA.md (per il Data Safety, punto 15)
      e il brief video (per il punto 16)
- [x] **Commercialista — dossier GIÀ INVIATO** (conferma di Eli, 7 ago), con la mail preparata
      insieme. Il file era `CartaCanta_Commercialista_DOSSIER_UNICO_5ago2026.pdf`
      (17 aree, 40 domande numerate D1-D40; riassorbiva e sostituiva il dossier del 19 lug).
      ⏳ **In attesa delle risposte.** Le domande nate DOPO l'invio stanno qui sotto (N1, N2…):
      non serve un altro PDF, si mandano di seguito nella conversazione già aperta.
      Conteneva, di nuovo rispetto al 19 lug: pagina Bilancio + testo di avvertenza per i forfettari (§11),
      storia degli incassi che cambia il CSV già consegnato in passato (§12), tracciato export con
      la colonna "Lavoro" (§13), incasso con carta via Stripe Connect (§15), collaboratori e ore
      di lavoro (§16). Le risposte più urgenti sono segnate in fondo al PDF: D13-D14 (data della
      fattura), D17-D19 (note di credito), D9 (IVA sullo sconto), D2-D3 (P.IVA/forma giuridica).

> ✅ **D9 (IVA sullo sconto) — RISOLTA e APPLICATA l'8 ago, decisione di Eli.** Il motore ora
> calcola l'IVA sull'imponibile **già scontato**, come dicono le fonti (art. 13 DPR 633/1972 +
> tracciato FatturaPA, controllo SdI 00422). ⚠️ Vale la pena **dirglielo lo stesso** quando
> risponde, come conferma: se avesse un'opinione diversa si torna indietro con un test solo.
> Sotto, com'era prima e perché è cambiato.
>
> 🔴 ~~D9 è la più urgente delle quattro~~ — ricerca dell'8 ago.
> Le fonti pubbliche dicono che uno **sconto incondizionato** indicato in fattura **abbassa la
> base imponibile**, e che l'IVA si calcola sull'importo **già scontato**. Il nostro motore fa
> un'altra cosa: lo sconto globale abbassa l'imponibile (100 → 90) ma l'IVA resta calcolata per
> voce sull'importo **pieno** (22 invece di 19,80) → totale 112 invece di 109,80.
> **Cosa è stato fatto**: lo sconto di documento si ripartisce sulle voci in proporzione e l'IVA
> si calcola sulle basi ridotte. 100 con sconto 10% → imponibile 90, IVA 19,80, totale **109,80**
> (prima: 112). Cinque test nuovi in `tests/unit/fiscal/calcoli.test.ts` bloccano il ritorno
> indietro, incluso il caso con due aliquote diverse e quello degli arrotondamenti.

### 📌 NUOVE domande per il commercialista — emerse DOPO l'invio del dossier

> Il dossier del 5 agosto è **già stato mandato** (con la mail preparata insieme). Queste sono
> le domande nate **dopo**, mentre l'app cresceva: **non serve un nuovo PDF**, si mandano come
> messaggio di seguito alla conversazione già aperta. Numerate N1, N2… così può rispondere
> citando il numero, come faceva con le D1-D40.
> **Man mano che ne emergono altre, Code le aggiunge qui.**

**N1 — Si può cancellare una fattura già emessa?** *(7 ago)*
Oggi l'app lo permette: qualsiasi fattura può finire nel cestino e, da lì, essere eliminata per
sempre. Le fatture **trasmesse allo SdI** mostrano un avviso e non vengono mai cancellate in
automatico allo scadere dei 15 giorni, ma un tocco esplicito le distrugge, snapshot XML compreso.
- ① L'app dovrebbe **impedirlo del tutto** per le fatture emesse (lasciando come unica strada la
  nota di credito), o basta l'avviso che c'è adesso?
- ② La stessa regola vale per le fatture inviate al cliente **senza** passare dallo SdI?
- ③ Per quanto vanno conservate se il cliente le rifiuta o l'incasso non arriva mai?

✅ **AGGIORNAMENTO 8 agosto — il punto ① è stato chiuso da solo, con una ricerca.** Le fonti
concordano: una fattura **trasmessa e accettata** dallo SdI è emessa, non si elimina e non si
modifica (si storna con nota di credito TD04); una fattura **scartata** è invece considerata
**non emessa** e si corregge e ritrasmette entro 5 giorni, stesso numero e stessa data. L'app
ora **impedisce** di eliminare una fattura trasmessa (lista e cestino), lascia eliminabili le
scartate, e non riporta più in bozza una fattura già partita allo SdI.
⚠️ **Restano aperti ② e ③**, e se ne aggiunge uno nuovo: vedi N3.

⚠️ *Sul resto il comportamento NON si cambia finché non arriva la risposta: sono decisioni
fiscali, non dettagli di interfaccia.*

**N2 — La marca da bollo sui PREVENTIVI, e con due proposte** *(7 ago)*
Nel regime forfettario l'app aggiunge i 2 € di marca da bollo sopra 77,47 € **anche sui
preventivi**, non solo sulle fatture: al cliente arriva quindi un preventivo che già la espone.
E da oggi, quando il preventivo contiene **due proposte** (Base e Premium), il bollo è contato
**dentro ciascuna delle due** — perché è il documento che il cliente accetterà, non una tassa da
dividere a metà.
- ① È corretto mostrare il bollo già nel preventivo, o va indicato solo come avvertenza
  ("in fattura sarà aggiunta la marca da bollo di 2 €")?
- ② Con due proposte, contarlo su entrambe è giusto?
- ③ Se il preventivo è sotto soglia ma la fattura finale la supera (per varianti in corso
  d'opera), c'è qualcosa da dire al cliente in anticipo?

*(Verificare se il dossier del 5 ago copriva già il punto ①: in caso, basta il ② e il ③.)*

**N3 — «Annullare» una fattura trasmessa, e le fatture emesse con un altro programma** *(8 ago)*
Due situazioni limite emerse collaudando, che l'app oggi non sa gestire da sola:
- ~~① «Segna annullata» su una fattura trasmessa~~ → **NON è una domanda: era già bloccato.**
  Verificato l'8 ago sul codice: il server rifiuta `rejected` e `draft` quando `sdi_status` è
  valorizzato e diverso da `scartata`, e l'interfaccia **non mostra nemmeno il tasto**, al suo
  posto c'è la spiegazione della nota di credito. Un mio errore di lettura in una risposta
  precedente. Decisione di Eli confermata comunque: *"se fiscalmente non si può, non si deve
  poter fare nemmeno da noi"* — ed è già così.
- ~~② interruttore «l'ho già emessa altrove»~~ → **DECISO da Eli l'8 ago: NON si fa.** Protegge
  solo chi si ricorda di accenderlo, crea uno stato non verificabile e duplica un fatto che vive
  in un altro gestionale. Resta com'è: avviso prima di eliminare + cestino di 15 giorni +
  la FAQ. Nessuna domanda da fare al commercialista su questo punto.
- ③ Un preventivo **accettato e firmato** dal cliente: per quanto va conservato, e conta come
  prova dell'accordo anche senza fattura?

**N4 — Marca da bollo sulla NOTA DI CREDITO, in forfettario** *(9 ago)*
Stiamo per costruire le note di credito e questo è l'unico punto su cui le fonti pubbliche si
contraddicono apertamente:
- ① Una nota di credito sopra 77,47 € in regime forfettario deve avere **il suo bollo da 2 €**,
  come una fattura, oppure no?
- ② Il bollo della **fattura originaria** si recupera in qualche modo quando la si storna del
  tutto, o resta comunque dovuto?
- ③ Se la nota è **parziale** e porta la fattura sotto i 77,47 €, cambia qualcosa?

⚠️ *Finché non risponde, sulla nota di credito il bollo resta a ZERO e modificabile a mano, con
una riga che invita a chiedere conferma. Non lo decidiamo noi.*

**N5 — Conferma dei TERMINI della nota di variazione (art. 26)** *(10 ago)*
Nell'app, quando si crea una nota di credito, si sceglie il motivo e accanto c'è scritto il
termine. Dopo una rilettura delle fonti (AdE, risposte 663/2021 e 762/2021) abbiamo scritto
così — da confermare, perché la prima stesura diceva l'opposto sull'errore:
- ① **errore nella fattura** (importi più alti del reale) → nota **entro un anno** dall'operazione;
- ② **accordo sopravvenuto** col cliente (sconto dopo, reso) → **entro un anno**;
- ③ **senza limite dell'anno**: contratto che viene meno (risoluzione, annullamento), sconti
  già previsti dal contratto, mancato pagamento con procedure infruttuose.
È il riassunto giusto per un artigiano? C'è un caso frequente nel suo lavoro che stiamo
incasellando male?

### ⚖️ Avvocato — lista UNICA, il contatto non è ancora partito

> Eli non l'ha ancora contattato (conferma del 7 ago), quindi qui **non serve distinguere fra
> "dossier" e "domande nuove"**: tutto quello che segue entra nel PDF che gli si manderà a
> settembre, in un colpo solo.

⏭️ **Da aggiungere alla rigenerazione del dossier avvocato** (annotato 5 ago):
**verifica automatica della partita IVA sui registri pubblici.** Quando un artigiano chiede di
pubblicarsi nella vetrina, controlliamo la sua P.IVA prima sul VIES (servizio pubblico della
Commissione europea) e, se lì non risulta, sul **Registro Imprese tramite Openapi S.p.A.** —
lo stesso fornitore dello SdI, quindi l'avvocato può guardare i due contratti insieme. Da
chiedergli: ① la **base giuridica** che abbiamo scritto nell'informativa è quella giusta
(oggi: esecuzione del contratto + legittimo interesse a una directory affidabile)? ② l'
**addendum "informazioni commerciali"** di Openapi, firmato da Eli come persona fisica ai sensi
del T.U.L.P.S., copre il nostro uso (verifichiamo la P.IVA di TERZI, cioè dei nostri utenti)?
③ va rifatto se in futuro nasce una società? ④ l'informativa dice abbastanza, o serve anche un
avviso nel momento della pubblicazione?
⚠️ **L'informativa privacy è già stata aggiornata** con questa informazione (5 ago): meglio
dichiarare un trattamento che facciamo davvero che ometterlo. Resta da far confermare il testo.

⏭️ **Da aggiungere alla prossima rigenerazione del dossier avvocato** (annotato 6 ago):
**cookie e statistiche d'uso.** Rileggendo i vecchi appunti GDPR è venuto fuori che PostHog
(lo strumento che conta quali funzioni vengono usate) era **attivo in produzione ma non
comparivano né lui né una sezione cookie nell'informativa** — insieme a Sentry, che raccoglie
gli errori tecnici, e al captcha di Cloudflare. **Ho già sistemato l'informativa il 6 agosto**
(tutti e tre fra i fornitori, nuova finalità "statistiche d'uso — consenso", nuova sezione
"Cookie e statistiche d'uso"), perché un'omissione è peggio di un testo da rifinire. Da
chiedere all'avvocato: ① il testo della sezione cookie va bene così com'è, o serve una pagina
"Cookie policy" separata? ② il nostro banner (che non raccoglie nulla finché non scegli, e in
cui "Rifiuta" ha lo stesso peso di "Accetta") è conforme alle linee guida del Garante?

⏭️ **Da aggiungere alla prossima rigenerazione del dossier avvocato** (annotato 10 ago):
**l'email di conferma al cliente che accetta un preventivo.** Dal 9 agosto, quando il cliente
finale tocca «Accetta e firma», gli parte in automatico un'email col riepilogo di ciò che ha
appena accettato (numero, proposta, totale, data/ora, firmatario) e il link per rileggere.
Perché l'abbiamo giudicata difendibile senza aspettare: è la **ricevuta di un gesto che il
cliente ha appena compiuto** — non contiene inviti, offerte né richiami, parte **una sola
volta** (un preventivo si accetta una volta) e solo verso chi ha appena firmato. Non è una
comunicazione commerciale, quindi non rientra nel divieto B.0 sulle email automatiche ai
clienti finali (pensato per solleciti e marketing). Da chiedergli: ① conferma che la base
giuridica sia l'esecuzione del contratto (art. 6.1.b) e che non serva consenso; ② se il
piè di pagina debba citare l'informativa privacy dell'artigiano o la nostra.

✅ **Verifica regione Sentry FATTA (6 ago):** il pannello di Sentry dice **"Data Storage
Region: EU"** → i dati di errore sono conservati su **server in Europa** (esito migliore del
previsto). Informativa aggiornata: §5 "UE (server in Europa; società USA)", §6 con la
precisazione che le garanzie coprono l'eventuale accesso dalla casa madre statunitense.
Nota a margine: il primo controllo sul DSN ("non c'è de") diceva il contrario — fa fede il
pannello, che è la dichiarazione ufficiale di Sentry sull'organizzazione. Se un giorno gli
errori smettessero di arrivare nel pannello, ricontrollare che il `SENTRY_DSN` su Vercel sia
davvero quello dell'organizzazione EU (dovrebbe contenere `ingest.de.sentry.io`).

⏭️ **Terza cosa da portargli, sempre del 6 agosto: il registro dei trattamenti (art. 30).**
È un documento interno obbligatorio, che teniamo e mostriamo al Garante solo se ce lo chiede.
Il nostro è fermo a giugno e **oggi dichiara cose non vere** (dice che l'AI è spenta, e non
conosce foto, firme, recensioni, vetrina, verifica P.IVA, statistiche). Un registro che mente
è peggio di uno assente. Sta in `gdpr/registro-trattamenti.md`, con in testa l'elenco preciso
di cosa manca: si rifà in mezz'ora partendo dall'informativa, ma va fatto **con lui**, perché
metà dei campi (ragione sociale, sede, email privacy) dipende dalla forma giuridica che
sceglierai.

Dopo l'OK dell'avvocato (in ordine di impatto):
- [ ] Compilare i **campi in giallo** nelle pagine Privacy e Termini
      (ragione sociale, P.IVA, foro competente, email privacy)
- [ ] Confermare il **testo su cookie e statistiche** (§5-bis dell'informativa, scritto il 6 ago)
- [ ] Rifare il **registro dei trattamenti** art. 30 (`gdpr/registro-trattamenti.md`)
- [ ] Dicitura **"copia di cortesia"** sulle fatture PDF (finché lo SdI non è live)
- [ ] Decisione sulle **recensioni Google** automatiche (feature pronta ma bloccata)
- [ ] Conferma delle risposte **Data Safety** del Play Store (sono in PLAY_STORE_SCHEDA.md §2)

Dopo il confronto col commercialista:
- [ ] Decisione **forma giuridica / P.IVA** (questione frontaliera — ricerca del 7 lug)
- [ ] Validare i **tracciati degli export** (registro fatture e bilancio CSV)

---

## 🧾 3. SdI / fatturazione elettronica (must-have fiscale n.1)

- [ ] Registrazione su **console.openapi.com**
- [ ] Generare le **chiavi sandbox** e passarmele → collaudo io la trasmissione di prova
- [ ] (dopo l'ok dell'avvocato sul contratto/DPA OpenAPI) chiavi di produzione
- [ ] ⏸️ **Note di credito (TD04)** — da costruire QUANDO lo SdI è live: chiedi al
      commercialista se la nota di credito usa la **stessa serie** delle fatture o un
      **sezionale separato** (dossier §6). Con quella risposta + SdI attivo, Code costruisce
      la funzione (progetto già pronto in `PROGETTO_NOTE_CREDITO.md`). NON prima.

---

## 📱 4. Play Store

I testi sono pronti in **PLAY_STORE_SCHEDA.md** (te l'ho mandato anche in chat).

- [ ] Decidere il **tipo di account sviluppatore**: Personale (richiede 12 tester
      per 14 giorni prima di pubblicare) vs Organizzazione (serve numero D-U-N-S,
      niente requisito tester) — dipende dalla decisione P.IVA del punto 2
- [ ] Decidere sul **nodo Play Billing** (scheda §5): l'abbonamento comprato dentro
      l'app Android viola la policy pagamenti di Google → il mio consiglio è
      nascondere l'acquisto nell'app Android e gestire l'upgrade solo dal sito
- [ ] Impacchettare la TWA (es. PWABuilder) e prendere il **fingerprint SHA-256**
      → su Vercel imposta `TWA_SHA256_FINGERPRINT=<fingerprint>` + Redeploy:
      `assetlinks.json` si pubblica da solo (già pronto nel codice)
- [ ] ⚠️ Nel pacchetto TWA attivare la **"Location delegation"** (opzione di
      PWABuilder/Bubblewrap): fa comparire la voce **Posizione** nel pannello
      Android dell'app (verificato il 29 lug: senza, le PWA mostrano solo
      "Notifiche" e il permesso posizione resta dentro Chrome).
      → Dopo il rilascio dell'app vera, DIRE A CLAUDE di aggiornare le
      istruzioni del pop-up "Attiva la posizione" (`NearMeButton`, variante
      app installata): il percorso diventa quello standard "tieni premuta
      l'icona → ⓘ → Autorizzazioni → Posizione".
- [ ] **Screenshot** del telefono (minimo 2 — consigliati: Home, Nuovo preventivo,
      pagina del cliente con Accetta, Lavori, Bilancio)
- [x] ~~Feature graphic 1024×500~~ ✅ pronta — te l'ho inviata in chat il 15 lug

---

## 💳 5. Stripe

- [ ] **Stripe live** (dopo P.IVA): chiavi live su Vercel + prodotti/prezzi in modalità live
- [x] ~~**Customer Portal (modalità TEST/sandbox)**~~ ✅ (20 lug: "cambio piani" attivo,
      prodotto Pro con entrambi i prezzi 19€/mese + 182€/anno, proration = "Ripartisci
      addebiti e accrediti", salvato)
- [ ] **Customer Portal (modalità LIVE)** — rifare IDENTICA config al lancio (la sandbox
      non si propaga al live). Istruzioni in CLAUDE.md §"CONFIG STRIPE DA FARE" → anche in PRIMA_DEL_LANCIO.md
- [ ] **Stripe Connect (per il "Paga con carta" dalla fattura — deciso 4 ago "appena possibile")**:
      quando Stripe è live, attiva **Connect → account Standard** dal Dashboard (gratis, solo config).
      Poi dimmelo: il progetto è pronto in `PROGETTO_PAGAMENTI_CARTA.md` e lo implemento.
      ⚠️ Prima serve anche la riga nel dossier avvocato (già annotata per la prossima rigenerazione).

---

## 📣 6. Marketing / lancio

- [ ] **Video demo** per la pagina /prova (lo volevi fare con NotebookLM)
- [ ] **Email automatica per i lead** dei moduli Meta (si imposta quando parte la campagna)

### Video promo con Higgsfield (brief pronto in chat: `CartaCanta_Brief_Higgsfield_Video_Promo.md`)
- [ ] **Registrare le 4 clip REALI dell'app** dall'account demo (10 min — elenco nel brief §3c:
      dettatura voce, invio, pagina cliente con firma, notifica+converti in fattura).
      ⚠️ Le schermate nei video devono essere vere, mai inventate dall'AI
- [ ] Generare le scene su **Higgsfield** con i prompt del brief (parti dal video corto da 15s)
- [ ] Montare: sottotitoli sempre, scritta "Video realizzato con AI", musica con licenza commerciale
- [ ] Alla pubblicazione: **toggle "Contenuto generato con AI" su TikTok** + autodichiarazione
      AI nelle inserzioni Meta (obbligatori; checklist completa nel brief §9)
- [ ] Claim ammessi SOLO quelli del brief §2b ("Gratis durante la beta", mai "gratis per sempre",
      niente promesse di guadagno) — le domande fini (es. claim "60 secondi") sono nel dossier
      avvocato punto 16, ma NON bloccano la partenza se rispetti il brief

---

## 🛰️ 7. Operatività post-lancio (dalla verifica del 15 lug contro le checklist di settore)

Tre cose da 10 minuti l'una che le checklist di lancio danno per obbligatorie
e che nessuno strumento nostro copre ancora:

- [x] ~~**Monitoraggio uptime** (UptimeRobot)~~ ✅ (20 lug: monitor HTTP su `cartacanta.app`,
      intervallo 5 min, avviso email al tuo indirizzo, status "Up" verde. Test email ok.)
- [x] ~~**Google Search Console** — proprietà + sitemap~~ ✅ (20 lug: proprietà DOMINIO
      `cartacanta.app` verificata via record TXT su OVH ⚠️ NON rimuovere quel TXT; sitemap
      `sitemap.xml` inviata con successo.)
- [~] **Backup del database** — ⚠️ **VERIFICATO 20 lug: il progetto è su piano FREE, che
      NON include backup automatici.** Ora va bene (solo dati demo). 🔴 **AL LANCIO (prima del
      primo cliente reale) → passare a Supabase Pro (~25 $/mese)**: attiva il backup giornaliero
      (7 gg) + Point-in-Time Recovery. NON rinunciabile per un gestionale con documenti fiscali.
      (Facoltativo nel frattempo: export manuale periodico — chiedere a Code se serve.)

---

## 💡 8. Accesso con impronta — FATTO (da collaudare)

Lo **sblocco rapido con l'impronta** è pronto (versione "dopo un primo login",
quella che avevi scelto). Come funziona: entri una volta con email e password sul
telefono, poi da **Impostazioni › Generale › "Sblocco con impronta"** lo attivi su
quel telefono; da lì, riaprendo l'app dopo il tempo che scegli (ad ogni apertura /
15 min / 1 ora / 1 giorno), rientri con impronta o Face ID. La password resta come
riserva. L'impronta **resta sul telefono**, non arriva a noi.

- [x] ~~Applica la migration 056 su Supabase~~ ✅ fatto il 20 lug
- [ ] **Collaudo sul telefono vero**: attiva lo sblocco, chiudi e riapri l'app,
      verifica che chieda l'impronta e che "Usa la password" riporti al login
- [ ] (più avanti, se vuoi) l'opzione "accesso completo SENZA password" — la
      valutiamo in una prossima sessione, tocca il cuore del login e va con calma

---

## 🧪 TEST — collaudi da fare sul telefono (10-15 minuti totali)

### Tutorial e guide
- [ ] **Tutorial nuovo (5 passi)**: Altro → Account e dati → "Rivedi il tutorial".
      Verifica: i 5 passi filano uno dietro l'altro SENZA dover salvare nulla in mezzo;
      al passo 3 si parla anche del preventivo dalle foto; alla fine la schermata
      scorre da sola sulla card Cliente
- [ ] **Mini-guide dalla checklist**: Home → tocca una voce NON completata di
      "Completa il profilo" (es. "Carica il listino nel catalogo").
      Verifica: atterri sulla pagina giusta e compare una guida che evidenzia il punto
      esatto dove agire — e puoi scriverci dentro subito, senza chiudere la guida

### Filtri e layout (le "sezioni tagliate")
- [ ] **Lavori**: i 5 filtri (Tutti · Da fare · In corso · Finiti · Fatturati) si vedono
      TUTTI senza scorrere, con spazi uguali tra le parole
- [ ] **Preventivi e Fatture**: le 5 tab entrano tutte, niente scroll laterale
- [ ] **Pagina del cliente** (se hai un preventivo con opzioni a livelli): le proposte
      sono impilate in verticale, tutte visibili subito

### Preventivo dalle foto (round 2)
- [ ] Rifai la prova con la foto del bagno: i badge ora dicono
      "prezzo dal tuo catalogo" / "prezzo da inserire" / "quantità da inserire"
- [ ] Il water sospeso NON deve più venire descritto "a pavimento" (nel dubbio l'AI
      ora omette il dettaglio di posa)
- [ ] **"Importa con AI"** (dal catalogo o dalle voci): su telefono la tabella dei
      risultati è impilata e non esce più dallo schermo

### Nuove pagine e contenuti
- [ ] **Altro → Account e sicurezza**: tre sezioni (Account · Sicurezza · Dati) e Impostazioni è
      tornata a 5 tab comode
- [ ] **Aiuto**: 5 FAQ nuove (foto AI, Lavori, ore, richiami, rapportino)
- [ ] **Novità**: c'è l'annuncio del preventivo dalle foto
- [ ] **Velocità**: apri Home, Preventivi, Fatture, un dettaglio preventivo e il
      Bilancio — devono sembrare più reattivi di prima
- [ ] **Account demo** (dopo il seed del punto 1): entra col demo e verifica che ci
      siano i 3 lavori, la campanella col richiamo, i sopralluoghi in agenda e il
      margine nella card Economia del lavoro

---

*Le cose fatte di recente (per riferimento): caselle email OVH ✅ · DMARC quarantine ✅ ·
chiavi PostHog/Sentry/Turnstile su Vercel ✅ · chiavi AI + tetti di spesa ✅ ·
migration 047-052 ✅.*
