# Sicurezza — stato reale, rischi residui e cosa fare se succede qualcosa

> Aggiornato al **5 agosto 2026**. Nasce dalla domanda di Eli: *"come evitiamo gli attacchi
> informatici? Siamo coperti su dati sensibili e frodi?"*.
> Documento operativo: dice cosa è **già protetto**, cosa **resta scoperto** e cosa **fare in caso
> di incidente**. Va riletto prima di ogni apertura al pubblico.

---

## 1. Com'è protetta l'app oggi (verificato sul codice, non a memoria)

| Fronte | Stato | Come |
|---|---|---|
| Separazione tra clienti (multi-tenant) | ✅ | RLS attiva su **tutte** le 28 tabelle; ogni uso della chiave admin filtra per workspace. Tre audit e un pentest (12, 20, 24 lug) senza IDOR. |
| Autenticazione | ✅ | Supabase Auth (PKCE). ⚠️ **Il controllo non vive nel middleware**: ogni pagina e ogni route ricontrolla la sessione — per questo i bypass del middleware (le CVE di luglio) non aprivano i dati. |
| Password e login | ✅ | 4 requisiti obbligatori, rate-limit 10 tentativi/15 min per IP, **captcha dopo 3 fallimenti**, messaggio identico per email inesistente e password errata (niente enumerazione degli utenti). |
| Blocco del telefono | ✅ | "Blocca l'app quando esco" con impronta (passkey) o password, timeout scelto dall'utente. |
| Segreti | ✅ | Nessuna chiave nel repo (pubblico); la chiave admin di Supabase è solo lato server. Verificato con GitGuardian. |
| Link pubblici (preventivo, rapportino, foto) | ✅ | Token casuali a 128 bit, non indovinabili e non indicizzati dai motori di ricerca (`noindex`). |
| Endpoint pubblici | ✅ | Rate-limit su ognuno (accettazione, messaggi, PDF, richieste dalla vetrina, segnalazioni). |
| Input degli utenti | ✅ | Validazione server con Zod, escaping XML/HTML, upload limitati a immagini con allowlist. |
| Intestazioni di sicurezza | ✅ | CSP, HSTS, `X-Frame-Options`, `nosniff`, `Referrer-Policy`. |
| Email a nome nostro | ✅ | SPF, DKIM e **DMARC in quarantine**: più difficile mandare phishing spacciandosi per Carta Canta. |
| Prove dei documenti firmati | ✅ | Trigger a livello di database: firma, IP e foto di un rapportino firmato non sono più modificabili nemmeno dal titolare. |
| Pagamenti | ✅ | Stripe: non passiamo mai dati di carta, non teniamo mai i soldi. |
| Dipendenze | ✅ (dal 5 ago) | Next aggiornato alla versione con le patch di luglio; rimossi 3 pacchetti non più usati; Dependabot attivo per le prossime. |
| Permessi del browser | ✅ (dal 5 ago) | Posizione, microfono e fotocamera concessi **solo al nostro sito**; pagamento, USB, sensori, bluetooth, cattura schermo negati a chiunque. |
| Controllo automatico | ✅ (dal 5 ago) | `npm run smoke:public` verifica anche gli header di sicurezza (28 controlli); `npm run security:check` li verifica **in produzione** e prova a leggere ogni tabella con la sola chiave pubblica. |

---

## 2. Rischi residui — in ordine di quanto farebbero male

### 🔴 1. Nessun backup del database (piano Supabase free)
Un errore, una cancellazione sbagliata o un attacco che arriva al database **non sono recuperabili**.
È il rischio più grave in assoluto: perdere i dati di tutti gli artigiani.
→ **Supabase Pro prima del lancio** (già primo punto di `PRIMA_DEL_LANCIO.md`) e **prova di restore**
fatta almeno una volta: un backup mai testato non è un backup.

### 🔴 2. Gli account di chi amministra (Eli) sono la vera chiave del regno
Supabase, Vercel, GitHub, il registrar del dominio, la casella email. Chi entra lì non ha bisogno di
attaccare l'app: si prende tutto.
→ **2FA attiva su tutti e cinque**, possibilmente con app di autenticazione (non SMS), e codici di
recupero stampati. È l'azione col miglior rapporto tra fatica e protezione.

### 🟠 3. Nessun secondo fattore per gli artigiani
Se un artigiano riusa la password di un altro sito già violato, chi la trova entra nel suo account
(vede clienti, documenti, importi). Il blocco con impronta protegge il telefono, non il login.
→ Decisione presa il 14 luglio: **niente 2FA per ora** ("gli artigiani non lo vogliono"). Resta
ragionevole, ma va riaperta quando ci sono utenti veri: almeno come **opzione** per chi la vuole.

### 🟠 4. Non ce ne accorgeremmo
Non c'è nessun avviso che dica "qualcuno sta provando 500 password al minuto" o "un account ha
scaricato tutti i documenti". Sentry è cablato, ma va acceso in produzione e guarda gli errori, non
i comportamenti sospetti.
→ Accendere Sentry in produzione + un controllo periodico degli accessi anomali.

### 🟡 5. CSP ancora permissiva sugli script (ma ora sappiamo cosa serve stringere)
La policy attiva ammette script da qualunque origine https. Dal 5 agosto viaggia **in parallelo una
policy stretta in sola osservazione** (`Report-Only`): gli script possono arrivare solo da noi e
dalle quattro origini che usiamo davvero (Cloudflare Turnstile, Stripe, PostHog, Supabase), niente
`unsafe-eval`. Non blocca nulla, ma ogni violazione finisce nei log di Vercel (cerca `[csp]`).
→ **Dopo qualche giorno di traffico vero**, se il registro resta pulito, si scambiano le due
intestazioni in `next.config.ts` e la policy stretta diventa quella effettiva. Stringerla al buio
avrebbe voluto dire scoprire in produzione che il login non funziona più.

### 🟡 6. Le foto stanno in un archivio pubblico con indirizzo segreto
Servono a essere mostrate al cliente senza login, quindi l'indirizzo è pubblico ma impossibile da
indovinare (identico al link del preventivo). Chi riceve l'indirizzo può però ridistribuirlo.

### 🟡 7. Tre vulnerabilità note restano nelle dipendenze interne di Next
Riguardano `postcss` (usato solo in fase di compilazione) e `sharp` (l'ottimizzatore di immagini,
che nella nostra app non elabora **nessuna** immagine caricata dagli utenti: tutte le foto sono
servite direttamente da Supabase). Non sfruttabili come siamo messi; si chiuderanno con la prossima
patch di Next.

### ✅ Risolto il 5 agosto: la posizione era negata anche a noi
`Permissions-Policy: geolocation=()` era in produzione da luglio: negava la geolocalizzazione a
tutti, **noi compresi**. "Vicino a me" riceveva *"Geolocation has been disabled in this document by
permissions policy"* anche con il permesso concesso dall'utente, e l'app lo raccontava come
"permesso negato" mandando le persone a cercare impostazioni che non c'entravano. Verificato con
Chromium prima e dopo il fix (`geolocation=(self)` → funziona). Lezione: **un'intestazione di
sicurezza sbagliata rompe le funzioni in silenzio** — per questo ora è controllata dallo smoke test.

---

## 3. Se succede davvero: cosa fare, nell'ordine

Il GDPR dà **72 ore** dal momento in cui si viene a conoscenza di una violazione per notificarla al
Garante (art. 33), e impone di avvisare gli interessati se il rischio per loro è elevato (art. 34).
Non serve essere certi: basta il ragionevole sospetto.

1. **Fermare l'emorragia.** Revocare le sessioni (Supabase → Auth → Sessions), ruotare le chiavi
   (Supabase service role, Stripe, Resend, Upstash, AssemblyAI/OpenAI/Mistral) e, se serve, mettere
   l'app in manutenzione. Meglio un'ora di disservizio che un giorno di dati che escono.
2. **Congelare le prove.** Non cancellare niente: log di Vercel, log di Supabase, email sospette.
   Annotare data e ora di ogni cosa che si fa, da subito.
3. **Capire l'estensione.** Quali tabelle, quanti workspace, quali dati (nomi, email, telefoni,
   indirizzi, importi). Le password non sono a rischio: non le conserviamo noi in chiaro.
4. **Notificare.** Se sono coinvolti dati personali: **Garante Privacy entro 72 ore** dal momento in
   cui lo si è saputo (modulo online sul sito del Garante), e comunicazione agli artigiani coinvolti
   se il rischio per loro è elevato — con parole semplici: cos'è successo, quali dati, cosa devono
   fare (cambiare password), a chi scrivere.
5. **Chiudere il buco** e scrivere qui sotto cosa è successo e cosa si è cambiato.

> Contatti utili da tenere a portata: avvocato (per la notifica), Supabase support, Stripe support.
> Il registro delle violazioni (anche di quelle non notificate) è obbligatorio: si tiene in questo file.

**Registro violazioni:** nessuna a oggi (5 agosto 2026).

---

## 4. Manutenzione ordinaria — cosa fare e ogni quanto

- **Ogni lunedì**: guardare le PR aperte da Dependabot; applicare subito quelle marcate come
  aggiornamento di sicurezza, dopo che la pipeline è verde.
- **Prima di ogni rilascio importante**: `npm audit --omit=dev` e `npm run smoke:public`.
- **Dopo ogni deploy importante**: `npm run security:check` — controlla il sito VERO: header di
  sicurezza, nessuna tabella leggibile con la chiave pubblica, archivio foto non sfogliabile.
- **Una volta al mese**: aprire il **Security Advisor** di Supabase (Dashboard → Advisors) — segnala
  tabelle senza RLS, policy incomplete e funzioni esposte. È l'unico controllo che va fatto sul
  database vero e che non si può fare dal codice.
- **Una volta al mese**: controllare che non ci siano accessi strani negli utenti Supabase e che le
  chiavi API non siano finite in giro (GitGuardian avvisa da solo sul repo).
- **Quando esce una patch di sicurezza di Next**: applicarla entro pochi giorni. Le CVE di luglio
  2026 permettevano di saltare i controlli del middleware: da noi non bastava a entrare, ma
  aspettare non conviene mai.
