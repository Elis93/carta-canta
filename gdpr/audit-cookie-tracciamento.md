# Audit cookie e tracciamento — Carta Canta

> Verifica in sola lettura del codice, 14 giugno 2026. Serve a stabilire se è necessario un
> banner cookie. **Da confermare con il consulente**, ma il quadro è semplice.

## Cosa ho controllato

- Presenza di strumenti di analytics/tracciamento (PostHog, Google Analytics/GTM, Meta Pixel,
  Mixpanel, Hotjar, Plausible, Segment, Vercel Analytics).
- Cookie impostati dall'applicazione.
- Eventuali banner di consenso già presenti.

## Risultato

**Nessun tracciamento attivo.**
- `posthog-js` è presente tra le dipendenze (`package.json`) ma **non è inizializzato** da nessuna
  parte nel codice (nessuna chiamata `posthog.init()` in `app/`, `components/`, `lib/`) e la
  chiave `NEXT_PUBLIC_POSTHOG_KEY` è vuota in produzione. Quindi **non raccoglie nulla e non
  imposta cookie**.
- Nessun Google Analytics, Meta Pixel, Vercel Analytics o altro tracker.

**Cookie impostati:** solo i **cookie di sessione di Supabase** (autenticazione), scritti in
`app/auth/callback/route.ts` e `proxy.ts`. Sono cookie **tecnici/necessari** al funzionamento
del servizio (tenere l'utente loggato).

## Conclusione

I cookie tecnici/necessari **non richiedono consenso** né banner (ePrivacy + linee guida del
Garante). Allo stato attuale **non serve un banner cookie**. È comunque buona prassi citarli in
una breve sezione "Cookie" dell'informativa.

## Raccomandazioni

1. **Decidi su PostHog:** o lo **rimuovi** dalle dipendenze (se non lo userai a breve), oppure,
   **prima di attivarlo**, aggiungi un **banner di consenso** — PostHog imposta cookie di
   analytics/profilazione che *richiedono consenso preventivo*.
2. Stessa regola per qualsiasi futuro strumento di analytics o per Vercel Analytics/Speed
   Insights: se li attivi, serve prima il banner di consenso.
3. Se in futuro servirà il banner, posso costruirlo io (è codice — file nuovi + un piccolo
   provider). Per ora non è necessario.

_Da confermare con il consulente privacy nella checklist `domande-per-consulente.md`._
