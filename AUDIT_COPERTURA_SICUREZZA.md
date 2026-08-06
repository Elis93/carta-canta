# Audit di copertura — sicurezza Carta Canta

> **Domanda a cui risponde questo documento:** *tutto ciò che andava fatto è stato almeno
> valutato?* Non è un elenco di paure: è la verifica, area per area, di cosa è coperto,
> cosa è coperto per caso, e cosa non lo è affatto.
>
> Fatto il **5 agosto 2026** sul codice reale (schema, 45 route, frontend, log, integrazioni,
> documentazione). Complementare a `SICUREZZA.md` (stato e rischi) e `PRIMA_DEL_LANCIO.md`
> (cancelli del lancio).
>
> ⚠️ **Fuori discussione**: la cifratura per colonna di IBAN e simili resta scartata, con le
> motivazioni in `SICUREZZA.md §2-bis`. Qui non si ripropone, e nessuna delle proposte sotto
> mette una chiave nello stesso posto del dato che dovrebbe proteggere.

---

## Sintesi: cosa è emerso

L'impianto regge. Su 8 aree, **5 sono coperte** e le altre 3 hanno lacune reali ma
circoscritte. Nessuna vulnerabilità critica, nessun accesso cross-tenant, nessun segreto
esposto. Le tre cose che mancano davvero:

| # | Lacuna | Gravità | Dove |
|---|---|---|---|
| 1 | ~~Export massivi senza alcun limite~~ → **✅ chiuso il 5 ago**: 10/ora per utente + evento registrato | 🟠 media | §2 |
| 2 | ~~Nessun registro degli eventi di sicurezza~~ → **✅ costruito il 5 ago** (migration 071, da applicare quando si vuole) | 🟠 media | §1, §5 |
| 3 | ~~Nessuna riconciliazione dei file orfani~~ → **✅ costruita il 5 ago** (job mensile, parte in sola lettura) | 🟡 bassa | §4 |

Più due decisioni prese nel codice ma **mai scritte da nessuna parte** (§7), che è il tipo
di cosa che si dimentica e poi si "riscopre" come se fosse un bug.

---

## 1. Modello dati e tabelle

### Cosa ho controllato
Tutte le migration da 001 a 070: tabelle create, RLS attivata, policy, trigger, vincoli.
Conteggio fatto sul sorgente, non a memoria.

### Cosa è a posto
- **29 tabelle, 29 con RLS attiva. Zero scoperte.** (Il numero è 29 e non 28 perché
  `passkeys` mancava dall'elenco di `security-check.mjs`, corretto oggi.)
- **65 policy** distribuite su 27 tabelle. Le due senza policy sono volute:
  - `accountant_links` → RLS senza policy = nessun accesso diretto. Si passa solo dal
    server, che matcha sull'**email confermata** del commercialista. È il disegno più
    sicuro possibile: il parametro nell'URL non autorizza nulla.
  - `rate_limit_events` → migration 011 mai applicata (il rate limit usa Redis). Tabella
    fantasma: esiste solo nel file.
- **Nessuna policy permissiva residua**: zero `USING (true)`, e gli unici due `TO public`
  erano sui bucket. Quello delle foto è stato rimosso oggi (069); quello dei **logo** resta,
  ed è corretto (il logo compare nei PDF e nelle email che il cliente apre senza login).
- **Trigger di integrità già presenti** dove servono: colonne-prova della firma cliente e
  del rapportino (057), voci di un documento accettato (057), foto di un rapportino firmato
  (067), coordinate di pagamento (070). `sdi_usage` in sola lettura (057), così i contatori
  di spesa non si azzerano dal client.

### Cosa manca
- **Nessuna tabella di audit.** Esiste `documents.document_log` (jsonb append-only), che
  però è la cronologia *di un documento*, non un registro di sicurezza: non contiene login,
  cambi password, sessioni chiuse, accessi del commercialista. Vedi §5 per la proposta.
- **`purge_old_stripe_events()` è definita ma non la chiama nessuno** (già annotato il 25
  luglio come rimandato): la tabella cresce all'infinito. Nessun dato personale dentro
  (solo id evento e stato), quindi è igiene, non rischio.
> ⚠️ **Correzione a una mia svista in questo stesso documento** (5 ago, poche ore dopo la
> prima stesura): avevo scritto che `document_views` conserva gli indirizzi IP **senza
> scadenza**. È falso — il cron notturno li cancella dopo **12 mesi**, esattamente come le
> richieste dalla vetrina. La retention c'era già; il campo giallo nell'informativa
> (`[es. 12 mesi]`) va semplicemente confermato dall'avvocato, non riscritto.

### ✅ Risolto lo stesso giorno
La pulizia mancante è stata agganciata al cron notturno che già esisteva, insieme a quella
del nuovo registro eventi:

```ts
for (const fn of ['purge_old_stripe_events', 'purge_old_security_events']) {
  try { await (admin as any).rpc(fn) } catch { /* migration non applicata */ }
}
```

**Registro degli eventi di sicurezza**: creato (migration **071**), vedi §5.

---

## 2. API, endpoint e servizi esterni

### Cosa ho controllato
Tutte e **45 le route** sotto `app/api`, una per una: quale primitiva di autorizzazione
applicano, se filtrano per workspace, se espongono più del necessario. Più la gestione
delle chiavi dei servizi esterni.

### Cosa è a posto
- **45 route su 45 hanno un controllo appropriato.** La ripartizione:
  - **28 autenticate** (sessione + workspace risolto);
  - **9 pubbliche per disegno** ma legate a un token non indovinabile da 128 bit
    (`/p/[token]`, `/r/[token]`), tutte con rate limit;
  - **3 dell'area commercialista**, autorizzate sull'email confermata contro
    `accountant_links` — **mai sul parametro nell'URL**, che sarebbe un IDOR immediato dato
    che quelle route usano la chiave di servizio;
  - **2 webhook** (Stripe, SdI) con verifica della firma;
  - **2 cron** con segreto, e **fail-closed** se il segreto manca (corretto il 24 luglio:
    prima `undefined === undefined` faceva passare chiunque);
  - **1 pubblica senza nulla**: `/api/version`, che restituisce il commit della build.
    Verificata: non espone altro, e serve alla PWA per accorgersi di girare su codice vecchio.
- **Nessun endpoint di debug o di test raggiungibile in produzione.**
- **Chiavi dei servizi esterni: nessuna esposizione.** Le uniche 8 variabili `NEXT_PUBLIC_*`
  che finiscono nel browser sono tutte pubbliche per costruzione (chiave anon di Supabase,
  site key di Turnstile, chiave PostHog, URL, tre interruttori di funzionalità). Stripe, SdI,
  OpenAPI, Resend, AssemblyAI, Mistral, OpenAI: **tutte chiamate solo dal server**. Nessun
  segreto nel repository (GitGuardian pulito dal 20 luglio).
- **Dati di pagamento con carta: non li tocchiamo mai.** Stripe gestisce tutto, noi vediamo
  solo l'esito.

### Cosa manca — 🟠 la lacuna principale dell'audit

**Otto endpoint di esportazione massiva non hanno alcun limite di frequenza:**

```
account/export            → TUTTI i dati (GDPR): clienti, documenti, spese
bilancio/export           → tutte le entrate e uscite
catalogo/export-csv       → tutto il listino, costi inclusi
commercialista/export     → registro fatture completo
fatture/export-csv        → tutte le fatture
preventivi/export-csv     → tutti i preventivi
studio/…/export           → registro fatture (commercialista)
studio/…/export-bilancio  → bilancio (commercialista)
```

Sono tutti autenticati e correttamente filtrati per workspace: **non c'è fuga cross-tenant**.
Il problema è un altro, ed è lo scenario che il documento sulle minacce mette al secondo
posto: chi entra in un account (password riusata, sessione rubata) può **scaricare l'intero
archivio in pochi secondi e ripetere l'operazione a piacere**, senza che nulla lo rallenti né
lo registri. È il passo "esfiltrazione" della catena, e oggi è a costo zero per l'attaccante.

**Proposta** — la stessa che usiamo già per gli endpoint pubblici, applicata per utente:

```ts
// in cima a ogni route di export, dopo aver risolto l'utente
import { checkPublicRateLimit, rateLimitResponse } from '@/lib/public-rate-limit'

const rl = await checkPublicRateLimit({
  key: `export:${user.id}`, limit: 10, window: '1 h', windowMs: 3_600_000,
})
if (rl.blocked) {
  return rateLimitResponse(rl.resetAt, 'Hai scaricato molti file di seguito. Riprova tra un po\'.')
}
```

Dieci export l'ora per utente non danno fastidio a nessun artigiano (un export è un gesto
raro e deliberato) e trasformano "scarico tutto in tre secondi" in qualcosa di lento e
visibile. Da abbinare all'evento di sicurezza del §5: un export è esattamente il tipo di
azione che vogliamo poter vedere a posteriori.

### ✅ Risolto il 5 agosto
Fatto con un helper unico (`lib/security/export-guard.ts`) chiamato da tutte e otto le route,
invece di otto copie dello stesso blocco. **La logica di esportazione non è stata toccata**:
la guardia sta prima e o lascia passare o risponde 429.

**Le chiavi scelte, e perché:**
- **Per UTENTE** (`export:{userId}`) sulle sei route dell'artigiano. Non per workspace,
  perché in un team l'uso legittimo di un collaboratore bloccherebbe il titolare; non per IP,
  perché l'attaccante ha già una sessione e l'IP non aggiunge nulla al tetto (resta però nel
  registro, come impronta, per riconoscere "sempre lo stesso").
- **Per COPPIA commercialista+cliente** (`export:{userId}:{workspaceId}`) sulle due route
  dell'area studio. Un commercialista con dieci artigiani deve poterli servire tutti nello
  stesso pomeriggio; quello che non deve poter fare è svuotare l'archivio di **uno** a
  ripetizione. ⚠️ Residuo accettato e documentato: chi avesse molti clienti collegati può
  comunque scaricare molto in totale — non si chiude con un tetto senza rompere l'uso
  legittimo, ed è il motivo per cui l'evento finisce nel registro.

---

## 3. Frontend, sessioni e autenticazione

### Cosa ho controllato
Flusso di login, gestione dei cookie, superficie XSS, esposizione a CSRF, header di sicurezza.

### Cosa è a posto
- **Login**: email+password e Google (OAuth con PKCE). Nessun magic link.
- **Cookie di sessione**: gestiti da `@supabase/ssr`, che li scrive `HttpOnly`, `Secure` e
  `SameSite=Lax`. Non sono leggibili da JavaScript e non viaggiano su richieste cross-site.
- **CSRF**: coperto su due fronti. Le mutazioni passano quasi tutte da **Server Action**, che
  in Next.js hanno il controllo di origine incorporato; e le route API che mutano si appoggiano
  al cookie di sessione, che con `SameSite=Lax` **non viene inviato** su una POST partita da
  un altro sito. Non serve un token CSRF aggiuntivo.
- **XSS**: superficie minima. Quattro soli `dangerouslySetInnerHTML` in tutta l'app, tutti
  con **stringhe statiche scritte da noi** (script di avvio, velo del blocco app, tema, PWA):
  nessuno interpola dati dell'utente. Tutto il resto passa da JSX, che scappa da sé. I
  messaggi del cliente, che sono l'unico testo libero che un terzo può inviarci, sono resi
  con `{m.text}`.
- **Header**: HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`,
  `Permissions-Policy` puntuale, CSP con `object-src 'none'` / `base-uri 'self'` /
  `form-action 'self'`. Verificati dal vivo oggi.
- **Rate limit sul login** con captcha dopo 3 tentativi falliti.

### Cosa manca
- **Il lockdown degli script inline nella CSP** (nonce + `strict-dynamic`) resta il pezzo
  aperto: oggi `script-src` ammette `'unsafe-inline'`. La policy stretta viaggia in sola
  osservazione e da oggi il registro può finalmente restare pulito (i font non chiamano più
  Google). 🟡 bassa, ma è la strada già tracciata.
- **Durata dei token**: `signOut({scope:'global'})` revoca i refresh token, ma un token di
  accesso già emesso resta valido **fino a un'ora**. L'interfaccia ora lo dice. Se vuoi
  stringere: Supabase → Authentication → Sessions → abbassare la durata del JWT (es. 30
  minuti). Costo: qualche refresh in più. 🟡 bassa.
- **Nessuna verifica automatica dei flag dei cookie in produzione.** Sono i valori di default
  della libreria, quindi corretti, ma non li ho potuti osservare dal vivo da qui.
  **Controllo da 10 secondi**: su cartacanta.app, F12 → Application → Cookies → i cookie
  `sb-*` devono avere ✔ su HttpOnly e Secure, e `Lax` in SameSite.

### 2FA opzionale per gli artigiani — proposta di disegno

La decisione del 14 luglio (niente 2FA, "gli artigiani non lo vogliono") resta ragionevole
**come default**, non come divieto. Il punto è offrirla senza imporla.

**Non serve costruirla**: Supabase ha il TOTP nativo (`auth.mfa.*`), quindi non ci sono
tabelle nuove da creare e nessun segreto da custodire noi — il fattore vive nel sistema di
autenticazione, non nel nostro database.

- **Dove**: Impostazioni → Generale, sotto "Blocca l'app quando esco", come **terza voce
  facoltativa**. Mai un banner, mai un obbligo, mai un "consigliato" con la spunta rossa.
- **Flusso**: "Aggiungi una verifica in più" → QR da inquadrare con l'app di autenticazione →
  un codice per confermare → **8 codici di recupero da salvare**, con l'avvertenza di non
  tenerli nella stessa email.
- **Al login**: se il fattore è attivo, dopo la password si chiede il codice a 6 cifre.
- **⚠️ Il punto delicato, da progettare prima di scrivere codice**: chi perde il telefono
  senza i codici di recupero resta fuori **per sempre**, e i suoi documenti fiscali sono lì
  dentro. Serve una procedura di recupero prima di offrire la funzione, altrimenti creiamo
  un problema peggiore di quello che risolviamo. Per il pubblico che abbiamo, la risposta
  giusta è probabilmente "scrivici e ti aiutiamo a mano", che però va scritta e resa
  sostenibile.

🟠 **Priorità media, ma non prima di avere utenti veri.** Su zero utenti non protegge nessuno.

---

## 4. File, storage e media

### Cosa ho controllato
I due bucket, tutte le superfici che mostrano file, la generazione dei link firmati, le
politiche di cancellazione.

### Cosa è a posto
- **`work-photos`: archivio privato**, link firmati con scadenza a un'ora. Chiuso davvero
  solo oggi: la 068 non bastava, ci è voluta la 069 (la storia è in `SICUREZZA.md`).
- **Chi firma cosa** è la parte fatta bene: il **server** firma con la chiave di servizio
  (così funziona anche per i collaboratori, che non sono proprietari della cartella del
  titolare), il **browser** firma solo ciò che l'utente ha appena caricato nella propria.
- **PDF e XML non sono file**: i PDF si generano al volo dall'HTML, l'XML SdI è una colonna
  del database protetta dalla RLS. Non esistono file scaricabili senza passare da una route
  autorizzata. Superficie in meno, per costruzione.
- **`logos`: bucket pubblico, ed è corretto** — il logo compare nei PDF e nelle email che il
  cliente apre senza account. È un marchio d'impresa, non un dato personale.
- **Upload irrobustito**: allowlist dei tipi, SVG escluso (era XSS potenziale), dimensione
  massima, percorsi `{user_id}/{uuid}`, scrittura consentita solo nella propria cartella.
- **Cancellazione**: il cron notturno elimina le foto dei documenti purgati; la cancellazione
  account elimina tutto. Entrambe passano dalla chiave di servizio, quindi funzionano anche
  sui file caricati da un collaboratore (corretto oggi: prima fallivano in silenzio).

### Cosa manca
- **Nessuna riconciliazione dei file orfani.** Se una riga sparisce dal database mentre il
  file resta nel bucket — upload riuscito e inserimento fallito, o una delle cancellazioni
  silenziose corrette oggi — quel file **non è più raggiungibile da nessuna query**, quindi
  nessuna cancellazione futura lo troverà. Restano lì per sempre foto di cantieri di clienti
  reali, invisibili anche a noi. È poco probabile ma è esattamente il tipo di dato che non
  dovrebbe accumularsi.

  **Proposta**: un passaggio mensile nel cron che elenca i file del bucket, li confronta con
  `work_photos.storage_path` e cancella quelli senza riscontro **più vecchi di 7 giorni** (il
  margine evita di cancellare un file appena caricato la cui riga sta per arrivare). Prima
  versione in sola lettura, che si limita a scrivere quanti ne ha trovati: se il numero è
  zero per qualche mese, si può anche lasciare così.

  ### ✅ Risolto il 5 agosto
  Job mensile `/api/cron/orphan-files` + `lib/storage/orphans.ts` (**13 test**).

  **Nessuna tabella di "candidati alla cancellazione"**: lo storage espone già
  `created_at` per ogni file, quindi **l'età del file È la lista d'attesa**. Una tabella in
  più sarebbe una seconda verità da tenere allineata — e che a sua volta potrebbe andare
  fuori sincrono, chiedendo la propria riconciliazione.

  **⚠️ Parte in sola lettura** (`ORPHAN_CLEANUP_ENABLED` assente = conta e riferisce, non
  cancella). Un lavoro automatico che cancella file va guardato per qualche giro prima di
  dargli il permesso di farlo davvero: è il modo più rapido di perdere i dati dei clienti.

  **La regola che governa tutto il file**: se la lettura dei riferimenti dal database
  fallisce o è parziale, **non si cancella nulla**. Un elenco incompleto farebbe sembrare
  orfani dei file collegatissimi. Per questo i riferimenti passano da `fetchAllRows` (col
  tetto di righe dell'API si vedrebbero solo le prime mille foto e tutte le altre
  sembrerebbero orfane) e le funzioni **lanciano** invece di restituire un insieme vuoto.
  Due dei tredici test congelano esattamente questo.

  **Sorgente di orfani che non avevo previsto**: il logo. Il percorso include l'estensione
  del file caricato (`{id}/logo.png`), quindi ricaricare lo stesso logo in un altro formato
  lascia il precedente nell'archivio per sempre — e la cancellazione dell'account rimuove
  solo quello in uso. Non nasce da un errore: nasce dall'uso normale.
- **Nessuna politica di conservazione scritta** per foto e aperture. Vedi §1.

---

## 5. Logging, monitoraggio e rilevamento anomalie

### Cosa ho controllato
Tutte le chiamate a `console.*` che potessero contenere dati personali, la configurazione di
Sentry, cosa esiste oggi come tracciamento.

### Cosa è a posto
- **I log sono puliti.** Ho riletto tutte le righe sospette: si registrano identificativi
  (workspace, documento, messaggio), oggetti errore e diciture — **mai valori di IBAN, P.IVA,
  codici fiscali, indirizzi o testi di documenti**.
- **I payload SdI** — gli unici che conterrebbero dati fiscali completi — sono dietro
  l'interruttore `SDI_DEBUG_PAYLOADS`, **spento di default**, con troncamento a 500 caratteri.
- I log finiscono su Vercel (stdout) e gli errori su Sentry.

### Cosa manca
- **`[email] Resend error` registra l'oggetto errore di Resend**, che in alcuni casi cita
  l'indirizzo del destinatario ("Invalid `to` field: mario@..."). È l'unico punto dove un
  dato personale può finire nei log per sbaglio. 🟡 bassa.

  ```ts
  // lib/email/send.ts
  if (error) {
    const msg = (error as { message?: string }).message ?? String(error)
    // L'errore di Resend può citare l'indirizzo: nei log ci va solo il tipo.
    console.error('[email] Resend error:', msg.replace(/[\w.+-]+@[\w.-]+/g, '<email>'))
    return { success: false, error: msg }
  }
  ```

- **Non esiste alcun registro degli eventi di sicurezza**, quindi non esiste alcuna
  possibilità di accorgersi di nulla. È il rischio 🟠 4 di `SICUREZZA.md`, ancora aperto sul
  lato nostro. Oggi, se qualcuno provasse 500 password al minuto o scaricasse l'intero
  archivio di un artigiano, **non lo sapremmo mai** — né sul momento né dopo.

### Proposta: rilevamento in due tempi

Il principio: **prima registrare, poi allarmare.** Un allarme senza storico è un allarme che
non sai interpretare, e la tentazione sarebbe di costruire subito la parte vistosa.

**Tempo 1 — il registro (piccolo, e va fatto per primo).** Una tabella `security_events`, RLS
attiva **senza policy** (come `accountant_links`: si scrive e si legge solo dal server), con
solo ciò che serve:

```sql
CREATE TABLE IF NOT EXISTS security_events (
  id           BIGSERIAL PRIMARY KEY,
  at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  kind         TEXT NOT NULL,          -- login_failed | password_changed | payment_changed |
                                       -- sessions_revoked | export | sdi_sent | studio_access
  workspace_id UUID,                   -- può mancare (es. login fallito)
  user_id      UUID,
  ip_hash      TEXT,                   -- ⚠️ SHA-256 dell'IP + un sale del server, MAI l'IP
  meta         JSONB                   -- solo conteggi ed etichette, mai dati personali
);
CREATE INDEX IF NOT EXISTS security_events_kind_at ON security_events (kind, at DESC);
```

⚠️ Due regole che rendono questa tabella una difesa e non un nuovo bersaglio: **l'IP si
registra come impronta, non in chiaro** (serve a dire "è sempre lo stesso", non "chi è"), e
`meta` non accetta mai testi dell'utente. Retention: **90 giorni**, con la cancellazione nello
stesso cron di cui sopra.

**Tempo 2 — le soglie**, quando lo storico dice cosa è normale. Punto di partenza ragionevole:

| Evento | Soglia | Azione |
|---|---|---|
| Login falliti sullo stesso account | 10 in 15 min | email a noi |
| Login falliti dalla stessa impronta IP | 50 in 15 min | email a noi |
| Export | 10 in 1 ora per utente | rifiuta (il rate limit del §2) + registra |
| Cambio coordinate di pagamento | sempre | email **all'utente** (già fatto) + registra |
| Trasmissioni SdI | oltre il tetto mensile | già gestito |

L'implementazione non richiede strumenti nuovi: una funzione `logSecurityEvent()` chiamata
nei sei o sette punti che conta, e una query nel cron notturno che manda una email a noi se
qualche soglia è stata superata.

### ✅ Tempo 1 fatto il 5 agosto
Migration **071** (`security_events`) + `lib/security/events.ts`. Il codice che scrive è già
in produzione ed è **tollerante**: finché la tabella non esiste non fa nulla, in silenzio.
Quindi la migration si applica quando si vuole, senza fretta e senza rischi.

Primo evento cablato: **`export`** (tutte e otto le route), con `meta.what` a dire quale.
Da cablare quando conviene, nell'ordine: `login_failed`, `payment_changed`,
`sessions_revoked`, `studio_access`, `sdi_sent`.

Le due regole di disegno sono nel codice e nella migration, perché è facile dimenticarle:
**IP solo come impronta con sale** (senza `SECURITY_EVENT_SALT` non si registra affatto — su
IPv4 un'impronta senza sale si inverte con una tabella precalcolata, cioè sarebbe l'indirizzo
in chiaro travestito) e **`meta` senza testi dell'utente**. RLS attiva senza policy, come
`accountant_links`: se l'utente potesse leggerlo saprebbe cosa vediamo, se potesse scriverlo
potrebbe inquinarlo.

**Eventi cablati** (5 ago): `login_ok`, `login_failed`, `password_changed`, `payment_changed`,
`sessions_revoked`, `accountant_linked`, `accountant_revoked`, `export`.
Restano da cablare `sdi_sent` e `studio_access`, quando conviene.

⚠️ Nota su un evento che NON esiste: **il cambio dell'indirizzo email dell'account**. Non è
stato dimenticato — nell'applicazione quella funzione non c'è (gli unici `auth.updateUser`
riguardano la password e i metadati dello studio). Se un domani si aggiungesse, quello
diventerebbe **l'evento più importante di tutti**: chi cambia l'email di un account si
prende anche il recupero password, cioè l'account per sempre.

**Il vincolo sul contenuto** (migration 072, facoltativa): finché "in `meta` solo etichette
nostre" resta una frase in un commento, basta un `meta: { cliente: nomeCliente }` scritto di
fretta fra sei mesi per trasformare il registro in una seconda copia dei dati personali —
sparsa, non prevista dall'informativa, e in una tabella che nessuno guarda. La 072 lo rende
verificabile dal database: passano numeri, booleani e stringhe corte da codice; non passano
`{"cliente":"Mario Rossi"}` né `{"email":"..."}`. Verificato su PG16 su dieci casi.

### Tempo 2 — le soglie, da implementare più avanti

Vanno tarate sui numeri veri (bastano poche settimane di registro), ma il punto di partenza
ragionevole è questo. **Nessuna di queste è collegata a un sistema di allarme oggi**: è
materiale per quando lo si costruirà, e la query è sempre la stessa forma
(`select count(*) from security_events where kind = … and at > now() - interval …`).

| Segnale | Soglia di partenza | Perché quella | Cosa farne |
|---|---|---|---|
| `login_failed` con la stessa impronta IP | **50 in 15 min** | Sopra il rate limit (10/15min per IP): se ci arriva vuol dire che sta ruotando indirizzi o che il limite non ha funzionato | email a noi |
| `login_failed` totali | **200 in 15 min** | Attacco distribuito: nessun IP sfora, ma il totale sì | email a noi |
| `login_ok` da un'impronta IP mai vista **seguito da** `export` entro 10 min | **1** | È la firma dell'esfiltrazione: entro e scarico. Da solo ciascuno dei due è normale; la sequenza no | email **all'utente** |
| `export` bloccati (`meta.bloccato`) | **3 in 1 ora** | Qualcuno sta insistendo contro il tetto | email a noi |
| `payment_changed` sullo stesso workspace | **3 in 24 h** | L'IBAN si cambia una volta ogni anni. Tre volte in un giorno è o un errore o un attacco | email a noi (all'utente arriva già ogni volta) |
| `accountant_linked` | **2 in 24 h** su un workspace | Dare accesso ai dati fiscali a due studi diversi in un giorno è anomalo | email a noi |
| `sessions_revoked` | sempre | Non è un allarme: è il contesto che serve a leggere tutto il resto | solo registro |

⚠️ **Una regola che vale più delle soglie**: gli allarmi che vanno a NOI devono essere pochi
e rari, altrimenti si smette di guardarli e tanto valeva non farli. Meglio partire con soglie
alte e abbassarle, che il contrario.

---

## 6. Backup, restore e disaster recovery

### Cosa è a posto
Nulla. È il rischio 🔴 numero 1 e il primo cancello di `PRIMA_DEL_LANCIO.md`: il piano
Supabase gratuito **non fa backup**. Oggi va bene perché non ci sono utenti veri; il giorno
in cui ce n'è uno, non va più bene.

### Piano minimo proposto

**Database — con Supabase Pro (~25 $/mese):**
- **Backup giornaliero automatico**, conservato 7 giorni: incluso, si attiva da solo.
- **Point-in-Time Recovery**: da attivare a mano. È quello che serve davvero — permette di
  tornare al minuto prima dell'errore, non alle 3 di notte del giorno prima. La differenza
  tra "abbiamo perso un giorno di fatture" e "abbiamo perso cinque minuti".
- **Prova di restore**: da fare **una volta, subito dopo l'attivazione**, ripristinando su un
  progetto Supabase nuovo e di prova. Va annotata la data in `PRIMA_DEL_LANCIO.md`.
  Un backup mai provato non è un backup: è una speranza.

**Cosa altro va nel piano, che il backup del database non copre:**

| Componente | Come si recupera | Cosa serve preparare |
|---|---|---|
| **File nell'archivio** (foto, logo) | ⚠️ **Non sono nel backup del database.** Se il bucket si svuota, le righe restano e le immagini no | Un export periodico del bucket, o accettare la perdita e dirlo — ma **decidere**, non scoprirlo dopo |
| **Variabili d'ambiente** (chiavi Stripe, SdI, OpenAPI, Resend…) | Non sono in nessun backup né nel repository | Copia in un gestore di password, con la data dell'ultimo aggiornamento |
| **Codice e deploy** | GitHub + Vercel ricostruiscono tutto | Già coperto |
| **Configurazioni esterne** (portale Stripe, callback SdI, DNS OVH) | Vanno rifatte a mano | Una pagina di appunti con le impostazioni, che oggi non esiste |

**Prova di ripristino completa**, da fare una volta prima del lancio: nuovo progetto Supabase
→ restore del backup → variabili d'ambiente dal gestore di password → deploy di anteprima su
Vercel → login e apertura di un documento. Se funziona, il piano esiste. Se non l'hai mai
fatto, hai solo dei file.

🔴 **Priorità alta il giorno del lancio, non prima.**

---

## 7. Documentazione: incongruenze trovate

### Cosa è a posto
`SICUREZZA.md` e `PRIMA_DEL_LANCIO.md` sono aggiornati a oggi, incluse le correzioni di
stamattina. `SICUREZZA.md §2-bis` (le misure valutate e **scartate**, col perché) è la parte
più preziosa: è ciò che evita di riproporre ogni due mesi la cifratura dell'IBAN.

### Incongruenze e buchi

1. **Il bucket `logos` è pubblico e non è scritto da nessuna parte.** È una decisione
   corretta e deliberata, ma non documentata: fra sei mesi qualcuno la troverà e la
   scambierà per una dimenticanza — esattamente com'è successo stamattina con la policy
   delle foto. → **Aggiornare la documentazione**, non il codice.
2. **`accountant_links` senza policy** è la scelta più sicura possibile, spiegata in un
   commento nel codice ma assente da `SICUREZZA.md`. Stesso rischio: sembra una svista.
   → **Aggiornare la documentazione.**
3. **La migration 011 (`rate_limit_events`) non è mai stata applicata** e il file resta lì a
   suggerire un'architettura che non usiamo. → Un commento in testa al file, o rimuoverlo.
4. **Nessuna sezione su backup, 2FA opzionale e rilevamento anomalie** in `SICUREZZA.md`:
   ci sono come *rischi*, non come *piani*. → Questo documento colma il vuoto; da richiamare
   da lì.
5. **Decisione da riaprire**: il 2FA per gli artigiani (14 luglio). Non perché fosse
   sbagliata — lo era per un'app senza utenti — ma perché la premessa cambia il giorno del
   lancio. → Rimettere in discussione, come *opzione*, quando ci sono utenti veri.

---

## 8. Coverage check finale

### Categorie di rischio non ancora toccate da nessuna parte

- **Dipendenze e catena di fornitura.** Dependabot è attivo dal 5 agosto (PR automatiche il
  lunedì), ma nessuno ha deciso **chi le guarda e quando**. Un aggiornamento di sicurezza che
  resta aperto tre settimane è come non averlo. → Regola semplice: il lunedì, cinque minuti.
  🟡 bassa, ma è il vettore numero uno del 2026 (31% delle intrusioni).
- **Cosa succede se sparisce Eli.** Non è morboso, è continuità operativa: oggi **una sola
  persona** ha accesso a tutti e cinque gli account amministrativi. Con utenti reali e
  documenti fiscali, va previsto un accesso di emergenza (codici in cassaforte, o una seconda
  persona di fiducia). 🟡 bassa oggi, media al lancio.
- **Cancellazione dei dati su richiesta** (art. 17): la funzione esiste, ma l'interazione con
  la conservazione decennale delle fatture è ancora una domanda aperta per l'avvocato.
  Già in lista, la segnalo perché è l'unico obbligo GDPR *attivo* che potrebbe arrivare dal
  giorno uno.

### Flussi che restano fuori dalle protezioni esistenti

Nessuno di sostanza. Le protezioni (RLS, trigger, link firmati, rate limit, verifica firma
webhook) coprono tutti i percorsi che ho ripercorso. Le due eccezioni sono quelle già dette:
gli **export massivi** (nessun freno) e i **file orfani** (nessuna riconciliazione).

### Decisioni di sicurezza presenti nel codice ma non documentate

Le tre del §7 (logos pubblico, `accountant_links` senza policy, migration 011 fantasma).
Tutte corrette; nessuna scritta. Le porto in `SICUREZZA.md`.

---

## Quarto giro di revisione (5 ago, sera): cosa ha trovato su questo stesso lavoro

Due revisori freschi sul lavoro descritto qui sopra. **Il finding principale avrebbe
cancellato tutti i loghi in uso.**

- **[ALTA] Il confronto dei loghi falliva SEMPRE**: `logo_url` porta un cache-buster
  (`?v=timestamp`) e l'estrazione del percorso se lo teneva attaccato → nessun logo
  combaciava mai col nome del file nel bucket → **ogni logo attivo risultava orfano
  maturo**. Con la pulizia accesa, il primo giro avrebbe cancellato fino a 200 loghi in
  uso. Il test era verde perché usava un URL senza `?v=`, un formato che in produzione
  non esiste. **È la modalità di prova ad aver reso il bug innocuo**: la scelta di
  partire in sola lettura non era prudenza di maniera. Fix: `logoPathFromUrl` (via query,
  fragment e percent-encoding) + test sull'URL reale. Trovato e corretto anche il
  **gemello pre-esistente** nella cancellazione account: rimuoveva il logo passando il
  nome sporco di `?v=` → il file restava nel bucket, in silenzio.
- **[ALTA] Il cron non sarebbe MAI partito**: leggeva il segreto da `?secret=` in query,
  ma Vercel Cron manda `Authorization: Bearer` (come fanno gli altri due cron del repo).
  Ogni giro schedulato → 401. Nessun danno (fail-closed), ma la fase di osservazione non
  avrebbe mai prodotto numeri — e **zero eventi nel registro si legge come "zero
  orfani"**, non come "job mai partito".
- **[MEDIA] Punto cieco del captcha nel registro**: oltre la soglia dei 3 fallimenti,
  ogni tentativo senza captcha usciva PRIMA di essere registrato → un attacco insistito
  spariva dal registro proprio mentre continuava. Ora anche quel ramo scrive
  `login_failed` con `motivo: 'captcha'`.
- **[MEDIA] L'esfiltrazione dalla porta accanto**: le route XML **per-documento**
  (studio e artigiano) non avevano né freno né traccia — uno script che itera gli id
  scarica l'intero archivio fiscale un XML alla volta senza mai toccare il tetto degli
  export. Ora 60/h per coppia (largo per l'uso vero, stretto per l'enumerazione), su un
  contatore separato.
- **[MEDIA] Il sale mancante era muto**: senza `SECURITY_EVENT_SALT` l'impronta IP non
  si salva (giusto), ma nessuno lo diceva → sarebbe rimasto non configurato fino al
  giorno dell'incidente. Ora un avviso una-tantum nei log + la riga in COSE_DA_FARE_ELI.
- **Cablati anche `sdi_sent` e `studio_access`**, che erano dichiarati nel tipo e
  nell'audit ma mai emessi da nessun punto del codice; hardening delle due funzioni di
  pulizia (REVOKE a pubblico/anon + `pg_temp`, appeso alla 072); tolto un giro di rete
  inutile dal login (`login_ok` usa l'utente già presente nella risposta).
- **Accettati e annotati**: il registro cresce senza tetto proprio sotto flood
  deliberato (bounded dai 90 giorni); il guard di bilancio sta prima del gate di piano
  (si vede anche il tentativo di un Free, ed è informazione); il listing sequenziale
  supera i 60s verso il migliaio di utenti (annotato nel modulo come limite di
  crescita); B2/B3 dei percorsi orfani (righe create dopo la lettura dei riferimenti,
  form aperto più di 7 giorni) — probabilità minima, direzione documentata.

## Ordine di intervento consigliato

| Priorità | Cosa | Quando |
|---|---|---|
| 🔴 alta | Backup Supabase Pro **+ prova di restore** | Il giorno del lancio, prima del primo utente |
| ✅ fatto | ~~Rate limit sugli 8 export~~ | 5 ago |
| ✅ fatto | ~~Registro eventi di sicurezza (Tempo 1)~~ — migration 071 da applicare quando vuoi | 5 ago |
| 🟠 media | Soglie e allarmi (Tempo 2), sui numeri veri del registro | Dopo qualche settimana di raccolta |
| 🟠 media | 2FA opzionale, **con la procedura di recupero decisa prima** | Dopo i primi utenti |
| 🟡 bassa | Riconciliazione file orfani + purge eventi Stripe | Nel cron esistente |
| 🟡 bassa | Mascherare l'indirizzo nei log di Resend | Una riga |
| 🟡 bassa | CSP stretta attiva (nonce sugli script inline) | Dopo qualche giorno di registro pulito |
| 🟡 bassa | Documentare le tre decisioni implicite | Insieme al prossimo giro |
