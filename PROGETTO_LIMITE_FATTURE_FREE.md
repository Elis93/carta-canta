# PROGETTO — Limite di 8 fatture sul piano Free

> **Decisione Eli (12 ago 2026):** il piano Free deve limitare anche le **fatture a 8**,
> per TUTTI i Free (non solo chi torna da Pro). Oggi il limite di 8 vale solo sui preventivi.
> **Stato: ✅ IMPLEMENTATO (12 ago) — ⚠️ migration 083 DA APPLICARE.** Eli: «procedi · non ci
> sono ancora utenti» → nessun grandfathering. Dettaglio in CLAUDE.md «12 ago (19)».
> Collegato alla decisione «downgrade Pro→Free» in `DECISIONI_E_FEEDBACK.md §A`.

---

## ⚠️ 0. LA DOMANDA CHE VIENE PRIMA DI TUTTO — dove «morde» il limite

Le fatture NON sono come i preventivi: un preventivo è un'offerta commerciale, una **fattura è un
documento fiscale** con obbligo di emissione/trasmissione (SdI, 12 giorni). Bloccare la 9ª fattura
può avere un peso legale che il blocco del 9° preventivo non ha. Quindi va deciso **quale azione**
il limite blocca, tra tre punti:

| Dove blocca | Effetto | Rischio |
|---|---|---|
| **A. Creazione** della fattura | Non puoi nemmeno creare la 9ª fattura | Duro: un'attività non può fatturare un lavoro fatto |
| **B. Invio al cliente** (copia di cortesia: email/link) — *come i preventivi* | Crei e (in futuro) trasmetti allo SdI, ma non mandi la copia dall'app | Il più leggero; il limite «morde» poco |
| **C. Trasmissione SdI** (emissione fiscale) | Non puoi emettere | ⚠️ **PERICOLOSO**: impedisce un adempimento di legge → mai fare questo |

**✅ DECISO da Eli (12 ago):** il limite conta le **«fatture inviate o link copiato»** → morde sul
punto **B (invio della copia al cliente)**, come i preventivi. **NON** blocca la creazione (§A) e
**NON** blocca mai la trasmissione SdI (§C, l'emissione fiscale resta sempre possibile). Cioè: un
Free può creare quante fatture vuole e trasmetterle allo SdI; ciò che si esaurisce a 8 è **l'invio
della copia al cliente dall'app** (email, WhatsApp, o «Copia link»). Al 9° invio → «Torna a Pro».
Questo è anche il più sicuro sul piano legale (non impedisce nessun adempimento).

---

## 1. Come funziona OGGI il limite preventivi (il modello da copiare)

- Colonna `workspaces.sent_quota_used INT` (migration **025**), **storica**: incrementata al **primo
  invio** di un preventivo, mai decrementata (neanche a delete → il limite non si aggira con
  invia+cancella).
- Incremento **atomico** via RPC `increment_sent_quota(workspace)` (migration **059**), con fallback
  read-modify-write. Chiamato nei punti di primo invio, sotto la guardia
  `plan === 'free' && doc_type === 'preventivo' && !doc.sent_at`.
- Blocco: `checkFreeBlock()` in `lib/free-trial.ts` → `blocked` quando `sent_quota_used >= FREE_DOC_LIMIT` (8).
- Applicato: creazione (`/preventivi/nuovo` mostra lo stato), invio email (`send-email/route.ts`),
  invio manuale (`registerManualSendAction`).
- UI: pagina **Abbonamento** mostra «X di 8 preventivi gratuiti usati»; `/preventivi/nuovo` blocca con messaggio.

## 2. Migration (il vero DB change — a differenza del resto del downgrade)

`0XX_limite_fatture_free.sql`:
- `ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS sent_invoice_quota_used INT NOT NULL DEFAULT 0;`
- **Backfill** dal numero di fatture già «inviate» esistenti (mirror della 025): conta le fatture
  non-bozza per workspace e valorizza il contatore. ⚠️ Vedi §7 grandfathering (i Free con >8 fatture
  risulteranno subito «pieni»).
- RPC `increment_invoice_quota(workspace)` gemella di `increment_sent_quota` (059) — oppure
  generalizzare in `increment_quota(workspace, p_column)`. Validare su PG16 (idempotente).
- Aggiornare `types/database.ts` (3 blocchi workspaces) — eccezione B.1.6 se il CLI non è disponibile.

## 3. Logica

- Estendere `lib/free-trial.ts`: nuovo `checkFreeInvoiceBlock(workspace)` (gemello di `checkFreeBlock`,
  soglia `FREE_INVOICE_LIMIT = 8`, legge `sent_invoice_quota_used`) — **oppure** un unico
  `checkFreeBlock(workspace, docType)` parametrico. Preferibile il parametrico per non duplicare la logica.
- `WorkspaceForFreeCheck` estesa con `sent_invoice_quota_used`.

## 4. Punti di guardia SERVER (SOLO l'INVIO al cliente; mai creazione, mai SdI)

Il limite morde SOLO dove una fattura «esce» verso il cliente. Sono gli stessi punti dei preventivi,
ramo fattura — oggi tutti **escludono** le fatture («le fatture non consumano»): vanno estesi.
- **Invio email** (`send-email/route.ts`, ~570): oggi `doc_type==='preventivo'` → aggiungere il ramo
  fattura (blocco + incremento contatore fatture).
- **Invio manuale / WhatsApp / «Copia link»** (`registerManualSendAction`, documents.ts ~1846): oggi
  esclude le fatture → aggiungere il ramo fattura. ⚠️ Ricordare il fix del 12 ago: su una bozza
  «Copia link» = invio (segna Inviato) → conta anche quello, come chiede Eli («o link copiato»).
- Guardia comune: `plan==='free' && doc_type==='fattura' && !sent_at` (solo il PRIMO invio conta;
  reinvii e correzioni no, come per i preventivi).
- ⚠️ **NON toccare**: creazione/salvataggio bozza fattura (resta libero) e la route di trasmissione
  **SdI** (`/api/fatture/[id]/sdi`) — l'emissione fiscale resta sempre possibile.
- ⚠️ **Conversione preventivo→fattura**: la conversione crea una BOZZA (non un invio) → non conta.
  Conterà quando quella fattura verrà inviata al cliente. Coerente con «fatture inviate».
- **Blocco all'invio**: quando `sent_invoice_quota_used >= 8`, i punti di invio rispondono con
  «Torna a Pro per inviare altre fatture» invece di procedere. La fattura resta salvata (bozza).

## 5. UI

- **Abbonamento** (`abbonamento/page.tsx`): seconda barra d'uso «X di 8 fatture inviate», accanto a
  quella dei preventivi. Aggiornare la sezione «Come vengono conteggiati» (spiegare: conta il primo
  invio/link copiato; creazione e trasmissione SdI non consumano).
- **Momento del blocco = l'INVIO** (la creazione resta libera): nel pop-up «Invia al cliente»
  (`ShareButton`) e nel dialog email, a quota piena, compare «Hai usato le 8 fatture inviate del piano
  Free. Torna a Pro per inviarne altre» → `/abbonamento`, e i canali di invio sono disabilitati. La
  fattura resta salvata come bozza. (Diverso dai preventivi, dove si blocca già `/preventivi/nuovo`.)
- Facoltativo: avviso morbido in `/fatture/nuovo`/lista quando restano poche («1 fattura gratuita
  rimasta»), senza bloccare la creazione.
- Messaggi coerenti col componente unico «🔒 Torna a Pro» (vedi progetto downgrade). Tono formale (§ 11 ago).

## 6. Copy / claim commerciali (⚠️ B.0)

Oggi dichiariamo «8 preventivi gratuiti» (landing `app/page.tsx`, FAQ `/aiuto`). Con il limite sulle
fatture va aggiornato a «8 preventivi e 8 fatture» ovunque appaia. **Modifica al piano gratuito e ai
claim = materia B.0**: rivedere con Eli e, se serve, non promettere nulla di assoluto.

## 7. Grandfathering — utenti Free ATTUALI con >8 fatture

Oggi i Free hanno fatture **illimitate**. Col backfill (§2) chi ne ha già >8 risulterebbe subito
«pieno» → non potrebbe crearne di nuove. **Decisione necessaria**:
- (a) applicare comunque (coerente, ma un Free attivo si vede bloccato di colpo);
- (b) **grandfathering**: chi ha già superato 8 alla data della migration parte «esente» (contatore
  congelato o flag) — più gentile, ma aggiunge logica.
- In beta gli utenti reali sono pochissimi/zero → l'impatto pratico è quasi nullo (come per altre
  migration «adesso è il momento giusto»), ma la scelta va messa a verbale.

## 8. Fasi consigliate

1. **Decisione §0** (dove morde) + §7 (grandfathering) + §6 (claim) — sono decisioni, non codice.
2. Migration §2 (contatore + RPC + backfill) validata su PG16, con SQL in chat (regola B.7).
3. Logica §3 (checkFreeBlock parametrico) + guardie server §4.
4. UI §5 (barra Abbonamento + blocco /fatture/nuovo).
5. Copy §6 e FAQ.

## 9. Test

- Unit su `checkFreeInvoiceBlock`/parametrico (sotto/sopra soglia, piano non-free esente).
- PG16: migration idempotente, backfill corretto, RPC atomica.
- E2e Free: 8ª fattura ok, 9ª bloccata all'invio/creazione, trasmissione SdI SEMPRE possibile.
- `npx tsc`, `npm run build`, `npm test`, scan spazi.
