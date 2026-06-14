# Checklist DPA con i fornitori (sub-responsabili)

> ⚠️ Per ogni fornitore che tratta dati personali per tuo conto devi avere un **DPA**
> (Data Processing Agreement) accettato/firmato e **conservato**. Quasi tutti lo offrono
> già pronto: di solito basta accettarlo dalla dashboard o scaricarlo dalla pagina legale.
> **Verifica sempre i link** (possono cambiare) prima di considerarli validi.
> Ultimo aggiornamento: [DATA].

## Come si fa (in pratica)

Per ciascun fornitore: vai nella sua area "Legal / Privacy / DPA", accetta o scarica il DPA,
salva il PDF (o lo screenshot della conferma) in `gdpr/dpa-firmati/`, poi segna ✅ qui sotto.

| Fornitore | Cosa tratta | Dove trovare il DPA | Fatto |
|---|---|---|---|
| **Supabase** | Database, archiviazione | supabase.com → Legal → Data Processing Addendum (DPA scaricabile in PDF) | ⬜ |
| **Vercel** | Hosting | vercel.com → Legal → Data Processing Addendum | ⬜ |
| **Stripe** | Pagamenti | dashboard.stripe.com → Settings → Legal / Privacy; il DPA è incluso nei Stripe Services Agreement | ⬜ |
| **Resend** | Invio email | resend.com → Legal / Trust → DPA | ⬜ |
| **Upstash** | Rate limiting / cache | upstash.com → Legal → DPA | ⬜ |
| **AssemblyAI** | Trascrizione vocale | assemblyai.com → Legal / Trust → DPA | ⬜ |
| **OpenAI** _(solo se attivi l'AI import)_ | Estrazione da foto/PDF | openai.com → Policies → Data Processing Addendum | ⬜ |
| **Mistral** _(solo se attivi l'AI import)_ | Estrazione da foto/PDF | mistral.ai → Legal → DPA | ⬜ |

## Verifiche aggiuntive per ogni fornitore

- ⬜ Il DPA elenca le **misure di sicurezza** e i **sub-processor** del fornitore.
- ⬜ Per i fornitori USA (Stripe, Resend, AssemblyAI, OpenAI): è indicato lo **strumento di
  trasferimento** (Clausole Contrattuali Standard e/o EU-US Data Privacy Framework).
- ⬜ Hai selezionato, dove possibile, la **regione UE** (già fatto per Supabase = Francoforte,
  Vercel = fra1).

## Nota importante

Tieni questa lista **allineata** all'elenco fornitori nell'informativa privacy
(`informativa-privacy.md`, sezione 5) e nel registro (`registro-trattamenti.md`).
Se aggiungi o togli un fornitore, aggiorna tutti e tre i documenti.
