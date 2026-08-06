# RISCHI E PUNTI DEBOLI — elenco di valutazione (25 lug 2026)

> Richiesto da Eli: "quali sono i punti deboli di queste app/processi, così abbiamo
> un elenco di cosa valutare". Costruito incrociando una ricerca web (errori SdI più
> frequenti, pitfall dei software di fatturazione, rischi operativi dei SaaS a founder
> singolo) con lo stato REALE del repo dopo i 4 giri di audit del 25 lug.
>
> Legenda: ✅ già coperto · ⚠️ mitigato ma con residuo noto · ❌ scoperto, da fare ·
> 🔵 decisione di Eli / professionista richiesta.

---

## 1. Fiscale / SdI (il rischio più caro se sbagliato)

| # | Punto debole (dalla ricerca) | Stato nostro |
|---|---|---|
| 1.1 | **Termine dei 12 giorni per l'emissione** (sanzione 250–2.000 € per operazione tardiva) | 🔵 **PUNTO PIÙ IMPORTANTE DA DECIDERE**: oggi la data fattura nell'XML = `created_at`; una bozza creata settimane prima e trasmessa oggi esce con data vecchia, senza alcun avviso. Serve la decisione col commercialista (data emissione = trasmissione? avviso in UI oltre gli 11 giorni?) — già nel dossier unico §. |
| 1.2 | **Scarto 00404 (duplicata)** — tra i più frequenti in assoluto | ✅ Coperto in profondità: claim atomico + marker anti doppia trasmissione (verificato: "nessun percorso produce doppio invio"), indice numeri per tipo (059), 9 test sul reclaim. |
| 1.3 | **Scarto per P.IVA cessata (00305) / codice destinatario inesistente** | ⚠️ Pre-check nostro = solo indirizzo completo. NON validiamo P.IVA del cliente né codice destinatario PRIMA dell'invio → scarti evitabili che consumano quota. Da valutare: check formale P.IVA (checksum) + avviso sul codice destinatario a 7 caratteri. |
| 1.4 | **Correzione di uno scarto entro 5 giorni, stesso numero e data** | ⚠️ Il flusso correggi-e-ritrasmetti funziona end-to-end (verificato), ma la card "Scartata" NON dice all'artigiano che ha ~5 giorni per rimediare. Fix di copy, piccolo. |
| 1.5 | **Numerazione progressiva** (buchi non sanzionabili, ma da spiegare) | ✅ Sequenze per tipo atomiche (059); i buchi da bozze cancellate sono accettati e leciti (fonte: errore di progressione non sanzionabile). |
| 1.6 | Ritenuta/bollo esposti male sul documento | ✅ Interruttori morti nascosti; guardie 422 su XML con ritenuta; imponibile PDF corretto (terzo giro). 🔵 Resta la decisione: implementare la ritenuta completa o lasciarla fuori. |
| 1.7 | **IVA su sconto documento** (ordinari): l'IVA è calcolata sulle voci PRIMA dello sconto globale | 🔵 Da validare col commercialista (dossier aggiornato). Irrilevante per forfettari. |
| 1.8 | Conservazione a norma / cancellazione documenti fiscali | ⚠️ Trasmesse mai purgate automaticamente + avvisi sul cestino; 🔵 blocco totale della cancellazione = decisione commercialista. |

## 2. Soldi interni (abbonamenti, incassi)

| # | Punto debole | Stato nostro |
|---|---|---|
| 2.1 | **Webhook di pagamento che falliscono in silenzio** (il difetto post-lancio più citato) | ✅ CHIUSO (25-26 lug, migration 060 + 061): firma verificata, idempotenza su `event.id` con prenotazione a due fasi (`stripe_webhook_events`), guardia sull'ordine degli eventi (`stripe_event_at`) così un retry tardivo non riattiva un piano cancellato. Un errore di lettura del registro risponde 409 → Stripe ritenta, non si perde l'evento. |
| 2.2 | **Acconto che "migra" di mese** al saldo (una sola coppia data/importo per fattura) | 🔵 Serve una tabella "storia incassi" (ledger) — decisione di prodotto; il CSV mensile già inviato al commercialista non riconcilia più dopo un saldo. |
| 2.3 | "Fatturato" dashboard ≠ Bilancio (emesso vs incassato, date diverse) | 🔵 Decisione di naming/valore (annotata). |

## 3. Operativo (dove muoiono i SaaS a founder singolo)

| # | Punto debole | Stato nostro |
|---|---|---|
| 3.1 | **Backup senza prova di RESTORE** ("il backup non testato non esiste") | ❌ Supabase Pro per i backup è il punto n.1 di PRIMA_DEL_LANCIO; la PROVA DI RIPRISTINO non è mai stata fatta. Azione Eli: attivare Pro + fare un restore di prova su progetto separato. |
| 3.2 | **Uptime monitoring** (Sentry vede gli errori, non il sito giù) | ✅ CHIUSO (20 lug): UptimeRobot su cartacanta.app, controllo ogni 5 min, avviso via email, test di notifica riuscito. |
| 3.3 | **Deliverability email** (SPF/DKIM/DMARC) — email in spam = preventivi mai visti | ⚠️ Codice a posto (plain-text, no emoji, replyTo); la verifica DNS/DMARC del dominio send.cartacanta.app è nel debito tecnico, mai confermata. Azione Eli: test con mail-tester.com. |
| 3.4 | **Supporto non presidiato** (email di supporto lette solo in settimana) | 🔵 Operativo Eli: chi legge supporto@ nel weekend quando lo SdI andrà live? |
| 3.5 | Rate-limit in-memory sugli endpoint autenticati (moltiplicati per lambda) | ⚠️ Noto e documentato; gli endpoint PUBBLICI usano Redis. Accettato per la beta. |
| 3.6 | Flag `NEXT_PUBLIC_*` inline a build-time (cambiarli su Vercel senza redeploy non fa nulla) | ⚠️ Trappola da incidente, documentata. Regola operativa: dopo ogni cambio flag → Redeploy. |
| 3.7 | Cron falliti in silenzio | ⚠️ Fail-closed sul secret ✅; nessun alert se il cron smette di girare. Da valutare: heartbeat (es. cron-job che pinga UptimeRobot). |

## 4. Sicurezza (residui dopo il pentest del 24 lug: zero critiche/alte)

| # | Punto debole | Stato nostro |
|---|---|---|
| 4.1 | Colonne `sdi_*` e `work_photos` scrivibili via PostgREST diretta dal titolare stesso | ⚠️ App-level ovunque; trigger DB stile 057 = prossima sessione (serve spostare update su admin client, design attento per non rompere il purge). |
| 4.2 | 2FA assente | 🔵 Decisione Eli 14 lug: non ora ("gli artigiani non lo vogliono"). Rivalutare post-lancio. |
| 4.3 | CSP senza nonce sugli script inline | ⚠️ CSP base attiva; lockdown completo = task dedicato con collaudo dal vivo. |
| 4.4 | rpID passkey derivato dall'host | ⚠️ Annotato — ATTENZIONE: cambiarlo invalida le passkey esistenti. |

## 5. Dipendenze terze (cosa succede se X è giù)

| # | Servizio | Se è giù |
|---|---|---|
| 5.1 | OpenAPI (SdI) | ✅ Invio fallisce con rollback pulito e messaggio; esito recuperabile col pull. Kill-switch di spesa attivi. |
| 5.2 | Supabase | ❌ App giù (inevitabile, è il DB). Mitigazione = backup + status page da seguire. |
| 5.3 | Upstash Redis | ✅ Fallback in-memory documentato (fail-open sui rate-limit). |
| 5.4 | Resend | ⚠️ Invio email fallisce con errore visibile; nessuna coda di retry (accettato: l'artigiano ripreme il bottone). |
| 5.5 | Mistral/OpenAI/AssemblyAI | ✅ Fallback a catena + quote + errori leggibili; feature non-core. |

## 6. Già coperto in profondità (per completezza, non rifare)

Anti doppia-trasmissione SdI (claim+marker+reclaim, 9 test) · matrice stati fattura (8 test) ·
azzeramento acconti (fix NOT NULL) · numerazione per tipo (059, validata PG16) · trigger 057
collaudato su PG16 (purge ok, manomissione bloccata) · pentest multi-tenant/IDOR/auth pulito ·
captcha login · congelamento ore+foto post-firma · link pubblico fatture scadute · PDF
verificati con screenshot · cron con doc_type · email/CSV/registro allineati.

---

### Priorità suggerite (proposta)
1. 🔵 **1.1 data emissione 12 giorni** → domanda al commercialista PRIMA del go-live SdI (rischio sanzioni ricorrenti).
2. ❌ **3.1 prova di restore** + **3.2 uptime** + **3.3 test deliverability** → azioni Eli da 1 ora totale.
3. ❌ **2.1 idempotenza Stripe** → prossima sessione di codice (migration piccola).
4. ⚠️ **1.3/1.4 pre-check P.IVA + copy 5 giorni sulla scartata** → sessione di codice breve.
5. 🔵 **2.2 storia incassi** → decidere se serve prima del lancio o dopo.
