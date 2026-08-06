# ⏰ Reminder — Come attivare PostHog senza problemi legali

> Da leggere QUANDO deciderai di attivare PostHog (analytics). Oggi PostHog è installato ma
> spento (chiave vuota, nessuna inizializzazione) → nessun problema. Ma appena lo accendi,
> imposta cookie di analytics/profilazione che **per legge richiedono il consenso preventivo**
> dell'utente (GDPR + ePrivacy + linee guida del Garante).

## Regola d'oro

**Non caricare né inizializzare PostHog finché l'utente non ha dato il consenso.**
Consenso preventivo = nessun tracciamento prima della scelta; libero, specifico, **opt-in**
(caselle NON pre-spuntate) e revocabile con la stessa facilità con cui è stato dato.

## Checklist PRIMA di accendere PostHog

1. **Banner cookie con consenso preventivo** — categorie: "Necessari" (sempre attivi) e
   "Analytics" (opt-in). PostHog parte SOLO dopo "Accetta analytics". (Posso costruirlo io.)
2. **Hosting UE** — usare `https://eu.posthog.com` (è già il default in
   `NEXT_PUBLIC_POSTHOG_HOST`). Non usare l'host USA.
3. **DPA con PostHog** — accettarlo/archiviarlo e aggiungerlo a `checklist-dpa-fornitori.md`.
4. **Aggiornare l'informativa privacy** — aggiungere PostHog all'elenco fornitori + una sezione
   "Cookie" con finalità, durata e come revocare.
5. **Configurare PostHog in modo privacy-friendly:**
   - mascherare input e testo (così NON cattura nomi, importi, P.IVA dei clienti negli eventi
     o nel session replay);
   - limitare/disattivare l'autocapture sui campi sensibili;
   - valutare l'anonimizzazione dell'IP; rispettare il "Do Not Track".
6. **Non mandare dati personali negli eventi** — niente nomi/email/dati fiscali dei clienti
   finali; usare ID anonimi.
7. **Revoca del consenso** — l'utente deve poter cambiare idea (riaprire le impostazioni
   cookie); a quel punto PostHog si ferma con `posthog.opt_out_capturing()`.

## Lato tecnico

- Inizializzare PostHog dopo il consenso, oppure gestirlo con
  `opt_in_capturing()` / `opt_out_capturing()` legati al consenso salvato.
- Quando sarai pronta, posso fare io: banner di consenso + init di PostHog vincolato al consenso
  + sezione "Cookie" nell'informativa.

## In alternativa

Se decidi di NON usare PostHog, conviene **rimuovere `posthog-js`** dalle dipendenze, per pulizia.

_Stato attuale: PostHog spento → nessun banner necessario (vedi `audit-cookie-tracciamento.md`)._
