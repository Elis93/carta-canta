# Progetto "Preventivo dalle foto" — come lo faremmo (fase 2)

> Vincolo di Eli: "voglio qualcosa di autentico, non un'AI che inventa.
> Poche cose ma corrette." Questo documento è costruito ATTORNO a questo vincolo.

## Principio-cardine: l'AI propone COSA, mai QUANTO costa né QUANTO ce n'è

La ricerca (VSI-Bench, recensioni Handoff) dice chiaro: l'AI riconosce bene
**cosa c'è da fare** in una foto, ma sbaglia **misure e quantità** (vicino al
caso) e i suoi **prezzi** sono fuori mercato. Quindi il confine è netto:

- **L'AI genera SOLO testo**: la lista dei lavori visibili/plausibili come
  descrizioni ("Rimozione piastrelle esistenti", "Impermeabilizzazione piatto
  doccia"). È un suggeritore di scope, non un preventivista.
- **I PREZZI non li tocca l'AI**. Vengono SOLO dal catalogo dell'artigiano,
  per abbinamento fatto dal NOSTRO codice (deterministico). L'AI non emette
  nemmeno il campo prezzo — tecnicamente non PUÒ inventarlo.
- **Le QUANTITÀ** vengono SOLO da un numero che l'artigiano ha detto/scritto
  nelle note ("bagno 12 mq"). Se non c'è, la quantità resta VUOTA e la voce è
  contrassegnata "da compilare". Mai una quantità "vista" nella foto.

## Audit dell'invenzione — campo per campo

| Campo voce | Da dove viene | L'AI inventa? | Come lo impediamo |
|---|---|---|---|
| Descrizione | AI (legge foto + note) | Suggerisce testo | Editabile, spuntabile; è il valore "trovo le voci dimenticate" |
| Unità (mq/pz/ore…) | AI, ma solo dalla lista chiusa nota | No (enum) | Validazione: solo unità ammesse |
| **Quantità** | Numero ESPLICITO nelle note dell'artigiano | **NO** | Se il numero non è nel testo → vuota + "da compilare". Prompt vieta di dedurla dalla foto |
| **Prezzo** | **SOLO catalogo utente** (match del nostro codice) | **NO — l'AI non emette il campo** | Nessun match → prezzo 0 + "da prezzare". Zero prezzi AI |
| IVA / Sconto | Impostazioni artigiano | No | Sempre null dall'AI (già così oggi) |
| Titolo lavoro | AI (riassunto) | Suggerisce testo | Editabile |

**Componente di invenzione residua = solo il TESTO delle descrizioni.** Nessun
numero (né prezzo né quantità) è mai inventato: o viene dal catalogo/dalle note
dell'artigiano, o resta vuoto e segnalato. Questo è il cuore della garanzia.

## Il flusso (schermata per schermata)

1. **Sopralluogo** (già esiste): l'artigiano scatta le foto e detta due parole
   ("rifacimento bagno, 12 mq, doccia nuova"). Niente di nuovo per lui.
2. **Bottone oro "Proponi le voci dalle foto (AI)"** — accanto a quello già
   esistente "Compila le voci dalle note".
3. L'AI riceve: **le foto + le note + l'elenco dei nomi del catalogo** come
   contesto (così tende a nominare le voci come le chiama l'artigiano).
   Restituisce SOLO: `[{descrizione, unità, quantità?(se nelle note), fonte:
   "foto"|"note", confidenza}]` + titolo. **Nessun prezzo nel JSON.**
4. **Il nostro codice** prende ogni descrizione e la cerca nel catalogo:
   - match trovato → usa **prezzo e unità VERI del catalogo**;
   - nessun match → voce con prezzo 0, badge ambra **"da prezzare"**.
5. **Schermata di revisione** (come l'AI import): ogni voce ha un badge —
   verde "dal tuo catalogo", ambra "da prezzare", grigio "da completare la
   quantità". L'artigiano spunta quelle giuste, corregge, aggiunge, e SOLO
   quando preme lui il preventivo si crea. Le voci si AGGIUNGONO a quelle già
   inserite a mano (non le sostituiscono).
6. Disclaimer fisso: "Suggerimenti dalle foto: controlla sempre voci, quantità
   e prezzi prima di inviare."

## Cosa riusiamo (già in produzione)
Foto sopralluogo · pipeline Mistral pixtral→OpenAI (scontrini) · schema Zod
`ExtractResultSchema` con `confidence` già previsto · schermata di revisione
voci dell'AI import · quota AI con kill-switch · `handleVociChange` che
preserva le voci manuali. Il pezzo nuovo vero è: (a) prompt vision "solo scope,
mai numeri", (b) **matcher catalogo deterministico** (il guardiano dei prezzi),
(c) i badge di provenienza. Supporto HEIC (foto iPhone) da aggiungere.

## Costo e limiti
- ~pochi centesimi a preventivo (4-6 foto + note + catalogo, modello piccolo).
  Sta nei tetti $10-15/mese; consumo quota contato solo a successo, come l'import.
- Serve un catalogo popolato perché i prezzi compaiano; senza, tutte le voci
  sono "da prezzare" (l'artigiano mette i prezzi a mano — comunque utile per lo
  scope). Da dirlo nell'onboarding della feature.

## Rischio legale (regola B.0)
Basso: nessuna stima presentata come affidabile, nessun prezzo di mercato,
approvazione umana obbligatoria, disclaimer. Stesso pattern "AI prepara,
artigiano approva" già validato nell'app. Da aggiungere alla lista avvocato solo
la formula del disclaimer.

## Fasatura proposta
- **v1 (MVP)**: solo scope + match catalogo + quantità dalle note. Niente stima
  quantità dalla foto. È già la feature "wow" e rispetta al 100% "no invenzione".
- **v2 (eventuale, dopo dati d'uso)**: se gli artigiani lo chiedono, aggiungere
  la possibilità di dettare le misure guardando la foto (resta l'artigiano a
  misurare, non l'AI).
