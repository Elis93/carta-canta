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

## 📧 0-zero. URGENTE — SMTP di Supabase per le email di accesso (21 ago)

> Emerso dal tuo collaudo del reset password («Errore nell'invio dell'email»):
> le email di **accesso** (conferma registrazione, reset password, magic link)
> NON passano da Resend — le manda **Supabase col suo servizio integrato**, che
> è pensato solo per lo sviluppo: pochissime email l'ora per TUTTO il progetto,
> consegne lente e nessuna garanzia. Con utenti veri il reset password si
> incepperebbe esattamente come è successo a te.

**Cosa fare (5 minuti):** nel pannello Supabase la voce si trova sotto
**Authentication** (icona utenti nella barra a sinistra) → sezione
*Configuration* → **Emails** → linguetta **SMTP Settings** → interruttore
«Enable Custom SMTP». Link diretto:
https://supabase.com/dashboard/project/ivbzuhgwszkdnlsybsao/auth/smtp
(se il pannello è la versione vecchia: Project Settings → Authentication →
SMTP Settings). Poi inserisci Resend:
- Host: `smtp.resend.com` · Port: `465`
- Username: `resend`
- Password: la **RESEND_API_KEY** (la stessa che sta su Vercel)
- Sender email: `noreply@send.cartacanta.app` · Sender name: `Carta Canta`

Poi in Authentication → **Rate Limits** alza «Email sent» a un valore sensato
(es. 30/ora). Da lì le email di accesso partono da Resend come tutte le altre.

- [ ] SMTP Resend configurato su Supabase
- [ ] Rate limit email alzato

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
- [x] ~~**`OPENAPI_COMPANY_API_KEY`** (token IT-start in produzione, verifica P.IVA)~~ ✅ 5 ago + Redeploy.
      **Collaudata in produzione**: P.IVA vera fuori dal VIES → pubblicata con
      "Riscontro automatico sul **Registro Imprese**"; P.IVA inventata → bloccata.
      Costo reale 0,050 €/chiamata con **le prime 30 al mese gratis** → in beta zero.
      ⚠️ **Nota 12 ago**: la console OpenAPI mostrava il token come «Scaduto», ma
      **ricaricando la pagina risulta valido** — era uno stato vecchio della console,
      nessun rinnovo necessario. Se ricapita «Scaduto», **ricarica prima di allarmarti**.
      È una chiave DIVERSA da quella SdI `OPENAPI_SDI_API_KEY`: non confonderle.
      Se un giorno scade davvero, la conseguenza è che chi pubblica il profilo e non è
      nel VIES (quasi tutti i forfettari) non riesce a pubblicare e legge «I registri
      delle P.IVA non rispondono» → si rigenera il token con scope `GET
      company.openapi.com/IT-start` e si aggiorna su Vercel.
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

🔎 **Ricerca sulle fonti (11 ago):** il preventivo **non è un documento fiscale** ai sensi
dell'art. 13 della tariffa (non «reca addebitamenti»: è un'offerta) → su di esso il bollo
**non è dovuto**. I 2 € che mostriamo sono l'**anteprima onesta** della futura fattura, ed è
una scelta di trasparenza, non un obbligo: legittima. Con due proposte, contarlo dentro
ciascuna resta giusto (ognuna è la futura fattura). ✅ Decisione di Eli
(11 ago): «se non è prassi, non facciamolo» → il bollo NON compare più sul preventivo
(arriva alla conversione in fattura); una FAQ spiega perché la fattura ha 2 € in più.
Al commercialista resta solo la conferma.

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

🔎 **Ricerca sulle fonti (11 ago, decisione di Eli: si implementa la prassi trovata e al
commercialista resta la CONFERMA).** Esito:
- ① il bollo sulla nota **è dovuto**: l'art. 13 della tariffa del DPR 642/1972 tassa «fatture,
  note, conti e simili documenti recanti addebitamenti o **accreditamenti**» sopra 77,47 €
  quando l'importo non è soggetto a IVA (caso forfettario, natura N2.2). E la guida AdE sul
  bollo delle fatture elettroniche esclude dal conteggio automatico solo TD16-TD19: una TD04
  sopra soglia finisce **nell'Elenco A del cassetto fiscale** e i 2 € vengono chiesti comunque —
  tenerla a zero da noi creerebbe solo uno scarto fra l'app e il conteggio dell'Agenzia.
- ② confermato ciò che già facciamo: il bollo della fattura originaria **non si recupera** con
  la nota (per questo il tetto dello storno lo esclude, `baseStornabile`).
- ③ conta l'importo **della nota**, non quello che resta della fattura: nota sotto 77,47 € →
  niente bollo sulla nota.
✅ *IMPLEMENTATO l'11 ago (ok di Eli): bollo 2 € automatico sulla NC forfettaria sopra
77,47 €, come sulla fattura — nel motore, nell'XML (DatiBollo) e nel tetto dello storno
(che confronta le BASI, mai i bolli). E dai PREVENTIVI il bollo è SPARITO (v. N2):
arriva alla conversione in fattura.*

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

**N6 — ✅ DECISA da Eli (10 ago): il «Regime dei Minimi» è stato TOLTO dall'app.** *(resta da dirlo al commercialista come informazione, non più come domanda)*
Rileggendo il processo IVA sulle fonti è emerso che l'app OFFRE il «Regime dei Minimi» fra i
regimi fiscali, ma poi lo tratta come un regime ORDINARIO: **addebita l'IVA al 22%** (i minimi
non addebitano IVA per rivalsa, art. 27 DL 98/2011), **non mette il bollo** sopra i 77,47 €
(dovuto, come per i forfettari) e **non stampa la dicitura di legge**. Cioè: chi lo
selezionasse farebbe fatture sbagliate su tre fronti. Il regime è chiuso ai nuovi ingressi
dal 2016 e ha un limite d'età, quindi i sopravvissuti sono pochissimi.
- ① Ha senso **togliere l'opzione** dall'app (chi ce l'ha oggi non è nessuno: siamo pre-lancio)?
- ② Oppure c'è una ragione per tenerla — e allora ci serve la gestione giusta: niente IVA,
  bollo sopra i 77,47 €, quale dicitura esatta in fattura, e RF02 nell'XML con quale Natura?
✅ *Fatto il 10 ago: l'opzione non è più selezionabile (né in onboarding né nelle
Impostazioni; chi l'avesse già scelta continua a vederla, ma è un caso che oggi non esiste)
e la promessa «e minimi» è sparita dalla pagina di presentazione. Se un giorno arriva un
utente vero nei minimi, si riapre come progetto «gestirlo bene» con le regole qui sopra.*

**🔎 D13-D14 (data della fattura e regola dei 12 giorni) — ricerca sulle fonti (11 ago)**
Erano fra le risposte più urgenti del dossier; la circolare **14/E del 2019** dell'AdE è
chiara e non serve aspettare:
- il campo **Data** della fattura elettronica è la **data di effettuazione dell'operazione**
  (per i servizi: il pagamento — oppure l'emissione stessa della fattura, se avviene prima);
- la **trasmissione allo SdI** può avvenire **entro 12 giorni** da quella data: la data di
  emissione «vera» diventa quella di trasmissione, ma il campo Data resta quello
  dell'operazione.
✅ *IMPLEMENTATO l'11 ago (richiesta di Eli: «voglio che abbia sotto controllo la situazione
e sia guidato»): sulla card SdI di ogni fattura non trasmessa c'è il CONTO ALLA ROVESCIA
(«Da trasmettere entro il … · mancano N giorni» — ambra negli ultimi 3, rosso oltre), col
tondino ⓘ che spiega bozza/copia di cortesia/emessa e il ravvedimento; negli ultimi 3 giorni
suona anche la campanella; alla trasmissione fuori termine compare l'avviso di tardività
(senza bloccare: trasmettere tardi è meglio che mai). Riferimento del conteggio: la più
vecchia fra data del documento e primo incasso (art. 6 c.4 — principio di anticipazione).
Al commercialista resta la conferma.*

**🔎 RICERCA «cosa dà per scontato l'app» (11 ago, richiesta di Eli: «ho paura che
anche per altre funzioni abbiamo dato per scontato qualcosa che nella prassi non si fa»).**
Ricerca su fonti ufficiali e professionali. Ne escono SETTE domande nuove, in ordine di
quanto pesano per un artigiano. ⚠️ Nessuna è stata implementata: sono tutte materia B.0.

**N7 — REVERSE CHARGE in edilizia (art. 17 c.6 lett. a-ter): quanto ci riguarda davvero?**
Un idraulico o un elettricista che lavora per un'IMPRESA (non per un privato) su un edificio
dovrebbe fatturare **senza IVA**, con natura **N6.7** e la dicitura «inversione contabile».
Le fonti dicono che il **forfettario non lo applica mai in uscita** (il suo regime prevale:
resta N2.2), quindi il nostro utente-tipo sarebbe salvo — ma un utente in **regime ordinario**
oggi non ha modo di farlo, e sbaglierebbe.
- ① Confermi che il forfettario NON applica mai il reverse charge in uscita?
- ② Per l'ordinario: quanto è frequente nella pratica, e vale la pena costruirlo (flag sul
  cliente «soggetto IVA» + flag «intervento su edificio» → natura N6.7)?
- ③ Il forfettario che RICEVE una fattura in reverse charge deve integrarla e versare l'IVA:
  è una cosa che dobbiamo almeno spiegare nelle FAQ, o lo vede solo lui col commercialista?

**N8 — IVA 10% e «beni significativi» (DM 29.12.1999, circ. 15/E/2018).**
Il lavoro tipico dell'idraulico — caldaia + posa in una casa privata — non va tutto al 10%:
il bene significativo sta al 10% solo fino al valore della manodopera, il resto al 22%. E la
circolare 15/E/2018 chiede di **indicare separatamente in fattura il valore del bene**.
- ① Riguarda solo l'ordinario (il forfettario non addebita IVA), giusto?
- ② Vale la pena che l'app faccia da sola lo split 10/22 con una casella «bene significativo»
  sulla riga, o è un tecnicismo che passa comunque dal commercialista?

**N9 — RITENUTA 4% del CONDOMINIO (art. 25-ter DPR 600/1973).**
Chi lavora in condominio si vede trattenere il 4% dal condominio-sostituto d'imposta. Il
forfettario NON la subisce, ma deve dichiararlo (in pratica una dicitura in fattura).
- ① Per il forfettario: qual è la dicitura esatta da mettere, e basta quella?
- ② Per l'ordinario: confermi RT01/RT02 con aliquota 4% nel blocco DatiRitenuta, e quale
  **CausalePagamento** va scritta nell'XML? (Su questo le fonti non sono univoche.)
- ③ Nel PDF va esposto il «netto a pagare» (totale − ritenuta): è la prassi che si aspetta?

**N10 — RITENUTA BANCARIA 11% sul bonifico parlante (bonus casa).**
Quando il cliente privato paga con bonifico parlante per la detrazione, la banca trattiene
l'**11%**: l'artigiano fattura 10.000 e sul conto ne trova ~8.900. Non è un campo della
fattura, ma **falsa i nostri incassi** (sembra un pagamento parziale).
- ① **Il forfettario la subisce o no?** Le fonti si CONTRADDICONO apertamente: alcune dicono
  che con una dichiarazione alla banca è esonerato, altre che le banche la applicano comunque
  e si recupera in dichiarazione. Ci serve la tua risposta prima di scrivere qualunque cosa.
- ② Se la subisce: ha senso che l'app avvisi al momento dell'incasso e permetta di registrare
  l'incasso al netto senza far risultare la fattura «non saldata»?

**N11 — FATTURA DI ACCONTO: è il punto dove la nostra app può portare fuori strada.**
L'app mette l'acconto nel PREVENTIVO. Ma incassare un acconto è un **fatto fiscale**: fa
scattare l'obbligo di fattura entro 12 giorni per la parte incassata, e il saldo deve poi
scorporare l'acconto già fatturato.
- ① Confermi che ogni acconto incassato va fatturato subito (anche in forfettario)?
- ② Ha senso che l'app, quando si registra l'incasso dell'acconto, proponga «crea la fattura
  di acconto» e poi generi il saldo che scorpora l'acconto già fatturato?

**N12 — CONSERVAZIONE A NORMA 10 ANNI** *(⚠️ corretta l'11 ago dopo il controllo dei
nostri documenti: la conservazione **la fa OPENAPI**, il nostro provider SdI — era uno dei
criteri di scelta, e ha escluso Invoicetronic che non la offriva. Quindi la domanda NON è
«chi la fa», ma i tre pezzi che mancano.)*
Le fatture elettroniche vanno conservate 10 anni con un processo a norma. Nel nostro caso è
compresa nel servizio OpenAPI, ma:
- ① **il servizio va attivato** (è nella lista di cose da fare per il go-live SdI);
- ② **manca la designazione del conservatore**: l'artigiano deve nominarlo formalmente, e
  il DPA di OpenAPI non ne parla (annotato il 21 lug). Va gestita nell'onboarding come
  accettazione, e **l'avvocato deve validarne il testo** prima del go-live;
- ③ **cosa succede se l'artigiano lascia Carta Canta**: il contratto OpenAPI dà 3 mesi per
  recuperare i dati, ma la conservazione è un obbligo di 10 anni — chi conserva dopo?
Domanda al commercialista: ① basta la conservazione del provider o l'artigiano deve
comunque aderire al servizio gratuito dell'Agenzia? ② se ha già un conservatore (tramite il
commercialista), le due conservazioni si sovrappongono creando problemi?

**N13 — ✅ IMPLEMENTATA l'11 ago (decisione di Eli: «nota di debito da implementare»). NOTA DI DEBITO TD05 (art. 26 c.1).**
*Al commercialista resta la CONFERMA, non la domanda: sezionale proprio «ND 001/2026»
(come per le note di credito), riferimento alla fattura in DatiFattureCollegate, importi
positivi, TD05 nell'XML, si trasmette e si incassa come una fattura. Nasce VUOTA di voci
(ci si mette solo l'integrazione, non tutto il lavoro) e solo da fatture già trasmesse.
Da chiedere: ① il sezionale separato va bene o preferisce la stessa serie delle fatture?
② la nota di debito richiede una data particolare o vale la data di emissione?*

*(testo originale della domanda:)*
Abbiamo la nota di credito (TD04). Se invece l'importo va **aumentato** (lavoro extra,
aliquota applicata per difetto) serve la nota di DEBITO, che a differenza della nota di
credito è **obbligatoria**. Senza, l'artigiano emette una seconda fattura scollegata.
- ① Confermi che serve, e che è la stessa struttura della TD04 (stessa numerazione? o
  sequenza propria?)
- ② Casi frequenti per un artigiano, o roba rara?

**N14-N18 — ✅ IMPLEMENTATE l'11 ago (istruzione di Eli: implementare la prassi trovata
sulle fonti, al commercialista resta la CONFERMA). Le tre cose che «nella prassi si fanno».**

**N14 — IVA 10% e BENI SIGNIFICATIVI** (L. 488/1999 · DM 29.12.1999 · circ. AdE 15/E/2018).
*Cosa fa l'app ora:* l'artigiano spunta la voce come bene significativo (i sette del
decreto: ascensori, infissi, caldaie, videocitofoni, condizionatori, sanitari, impianti di
sicurezza) e l'app applica `10% = P + min(B,P)` / `22% = max(0, B−P)`, spezzando la riga
in due e scrivendo in fattura il valore del bene e il corrispettivo al netto (obbligo
dell'art. 1 c.19 L. 205/2017, che vale **anche quando tutto resta al 10%**). Il termine di
confronto è l'intera prestazione al netto del bene — manodopera, materiali, e le parti
staccate con autonomia funzionale (tapparelle, zanzariere, grate).
*Da confermare:* ① il perimetro delle parti staccate come l'abbiamo inteso; ② il caso
dell'ACCONTO — noi riportiamo il valore del bene in misura proporzionale al pagamento e
rifacciamo lo split su quella proporzione: è la prassi che ha in mente anche lui?

**N15 — RITENUTA 4% DEL CONDOMINIO** (art. 25-ter DPR 600/1973).
*Cosa fa l'app ora:* spunta «Il cliente è un condominio» sulla fattura → riga «Ritenuta
d'acconto 4% −X €» nel PDF, dicitura che dice chi la versa, e nell'XML il blocco
`DatiRitenuta` con `<Ritenuta>SI</Ritenuta>` su ogni riga (senza, scarto 00415). Mai ai
forfettari (esenti, art. 1 c.67 L. 190/2014 — la loro fattura porta già la dicitura di
esenzione). Nel ⓘ è scritto che 4% e 11% del bonifico parlante **non si cumulano**
(circ. 40/E/2010).
*Da confermare, tre punti tecnici:*
- ① **CausalePagamento**: abbiamo messo **W** (corrispettivi per contratti d'appalto).
  Confermi? La «A» è lavoro autonomo e ci sembra sbagliata.
- ② **TipoRitenuta**: RT01 (persona fisica) o RT02 (soggetti diversi) lo deduciamo dalla
  ragione sociale, con default RT01. Va bene, o conviene chiederlo all'artigiano?
- ③ **ImportoTotaleDocumento**: lo scriviamo AL NETTO della ritenuta (= la cifra da
  bonificare, la stessa del PDF). Le fonti si dividono su lordo/netto e lo SdI non lo
  valida: confermi la scelta?

**N16 — INVERSIONE CONTABILE in edilizia** (art. 17 c.6 lett. a-ter DPR 633/1972).
*Cosa fa l'app ora:* spunta manuale sulla fattura → nessuna IVA addebitata, natura
**N6.7** (non N6.3, che è il subappalto della lett. a), dicitura di legge, e il rifiuto di
trasmettere se il cliente in rubrica non ha la P.IVA. Mai ai forfettari (non lo applicano
in uscita: restano N2.2).
*⚠️ Perché MANUALE e non dedotta dall'ATECO:* la circ. 14/E/2015 mappa il reverse charge
sui codici ATECO 2007, ma dal 2025 la classificazione è cambiata e quella mappatura non è
stata aggiornata. Dedurre da un codice che non corrisponde più significherebbe togliere
l'IVA a una fattura che la deve avere, o il contrario.
*Da confermare:* ① che la scelta manuale sia la strada giusta finché l'Agenzia non
aggiorna la tabella; ② il caso del **contratto unico d'appalto** che comprende sia
prestazioni in reverse charge sia altre (va spezzato o segue una regola sola?);
③ serve una **dichiarazione del committente** da conservare, o basta la P.IVA?

**N17 — BOLLO e REVERSE CHARGE: ⚠️ CORRETTO IL 17 AGO — il bollo NON è dovuto.**
Storia in due tempi. L'11 ago avevamo esteso il bollo alle fatture in inversione contabile
(«IVA zero = bollo dovuto»). Un collaudatore ha sollevato il dubbio e la ricerca su fonti
ufficiali gli ha dato ragione: per il **principio di alternatività** (art. 6 Tabella B
DPR 642/1972) l'inversione contabile è un'operazione **soggetta a IVA** — la versa il
committente — quindi **esente da bollo** (circ. AdE 37/E/2006 sui subappalti edili in
reverse charge; e la stessa AdE, nella guida sul bollo delle e-fatture, esclude TUTTI gli
N6.* dal calcolo automatico dell'Elenco B: pretende il bollo solo su N2.1, N2.2, N3.5,
N3.6, N4). **Il motore ora non applica il bollo al reverse charge**; il forfettario
(N2.2, nell'Elenco B) resta col bollo com'era.
*Da confermare (non domanda aperta — le fonti sono univoche):* che sulla fattura SOLO
reverse charge sopra 77,47 € il bollo non vada applicato, e che sul caso misto
(parte reverse + parte con IVA esposta) il bollo scatti solo se le eventuali componenti
esenti/fuori campo — non quelle in reverse — superano da sole 77,47 € (RM 98/E/2001).

**N20 — FATTURE agli ENTI PUBBLICI: l'app le BLOCCA con spiegazione (17 ago).**
Ricerca su fonti ufficiali (feedback collaudatori): una fattura a una PA richiede il
formato **FPA12** col Codice Univoco Ufficio a **6 caratteri** (Indice PA), quasi sempre lo
**split payment** (art. 17-ter — prorogato dalla Decisione UE 2026/1728 fino al 30/6/2029;
i FORFETTARI ne sono esclusi, circ. 15/E/2015), e **CIG/CUP** senza i quali la PA non può
pagare (art. 25 DL 66/2014). Il nostro FPR12 verso una PA = **scarto certo 00427**.
L'app ora **rifiuta la trasmissione** quando il codice destinatario ha 6 caratteri, con
il messaggio: fattura all'ente pubblico → dal gestionale del commercialista. Il supporto
vero (FPA12+split) è un progetto a sé, da valutare post-lancio se c'è domanda.
*Da confermare:* che il blocco con rimando al commercialista sia la scelta giusta per i
suoi clienti artigiani (quanti fatturano a comuni/scuole?).

**N18 — MULTI-ALIQUOTA nell'XML: era rifiutata, ora è supportata.**
Fino a oggi l'app si rifiutava di trasmettere una fattura con aliquote diverse fra le voci
(«non ancora rappresentabile»). Serviva dai beni significativi, che per costruzione ne
hanno due: ora `DatiRiepilogo` esce con un blocco per aliquota, con l'imposta calcolata una
volta sola sulla somma delle basi di quell'aliquota (mai riga per riga: è la causa nota
dello scarto 00421).
*Nessuna domanda* — è un'informazione: da qui in poi una fattura può legittimamente avere
IVA diverse sulle sue righe.

**N19 — ⏸️ NON IMPLEMENTATA. CASSA PREVIDENZIALE e RIVALSA INPS 4%** (segnalazione di Eli,
11 ago). L'app oggi **non le gestisce**: chi deve addebitarle al cliente non ha modo di
farlo se non aggiungendo una voce a mano, e in quel caso l'XML non le dichiara.
- **Chi riguarda:** i **professionisti**, non gli artigiani. Un idraulico o un elettricista
  è iscritto alla gestione artigiani/commercianti e non ha né cassa di categoria né
  rivalsa. Riguarda invece geometri, architetti, ingegneri (cassa di categoria: Inarcassa,
  CNPADC…) e i professionisti **senza cassa**, iscritti alla Gestione Separata, che
  applicano la **rivalsa INPS del 4%**.
- **⚠️ È l'OPPOSTO della ritenuta**: la ritenuta si sottrae, il contributo integrativo si
  **somma** all'imponibile e — per la cassa di categoria — è **soggetto a IVA**. Sbagliare
  il verso vuol dire sbagliare il totale in fattura.
- **Cosa servirebbe:** il blocco `DatiCassaPrevidenziale` dell'XML (TipoCassa TC01-TC22,
  aliquota, importo, aliquota IVA, e il flag Ritenuta se il contributo è a sua volta
  soggetto a ritenuta), più la scelta della cassa in Impostazioni.
- **Domande, se decidiamo di farlo:** ① la **rivalsa INPS 4%** entra nella base imponibile
  IVA e nella base della ritenuta d'acconto — confermi? ② il contributo del **4% delle
  casse di categoria** è invece escluso dalla ritenuta: confermi? ③ per il **forfettario**
  che applica la rivalsa, il contributo concorre al reddito o no?
- **Il mio parere:** vale la pena, ma **dopo** il lancio e solo se apriamo davvero ai
  professionisti — per l'artigiano che è il nostro utente tipo non cambia nulla, e ogni
  campo fiscale in più è una superficie in più da tenere corretta.

**Segnalati come OPPORTUNITÀ, non come rischi** (non servono risposte, ma un parere se
capita): la **fattura differita TD24** entro il 15 del mese successivo, che ci calzerebbe
perché abbiamo già i rapportini firmati (= la «documentazione idonea» che la norma chiede);
un **contatore della soglia forfettaria** (avvisi a 75k/85k, blocco a 100k, contando per
CASSA e includendo il bollo riaddebitato); e i **termini di pagamento** ex D.Lgs. 231/2002
(30 giorni + interessi e 40 € automatici), che però è materia da avvocato.

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
