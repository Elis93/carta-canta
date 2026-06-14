# Cartella GDPR — Carta Canta

> ⚠️ **Questi sono documenti di partenza (bozze), NON documenti legali definitivi.**
> Sono scritti per farti risparmiare tempo e soldi: porti già qualcosa di concreto a un
> consulente privacy invece di partire da zero. **Firmi tu come titolare del trattamento,
> quindi la responsabilità legale è tua: fai validare tutto da un professionista prima di
> pubblicare.** I costi di una consulenza GDPR per un'app come questa sono in genere
> contenuti (qualche centinaio di euro), molto meno di una sanzione.

## Cosa contiene questa cartella

| File | Cos'è | Cosa devi farci |
|---|---|---|
| `informativa-privacy.md` | L'informativa privacy da pubblicare sul sito (per i tuoi utenti artigiani) | Compilare i `[PLACEHOLDER]`, far validare, pubblicare su una pagina `/privacy` |
| `registro-trattamenti.md` | Il registro dei trattamenti (obbligo art. 30 GDPR) | Compilare i `[PLACEHOLDER]`, tenerlo aggiornato, conservarlo (non si pubblica) |
| `procedura-data-breach.md` | Cosa fare se c'è una violazione di dati (obbligo art. 33-34) | Leggerla, tenerla a portata di mano |
| `checklist-dpa-fornitori.md` | Lista dei fornitori (Supabase, Stripe…) con cui devi avere un DPA firmato | Seguire i link, accettare/scaricare ogni DPA, segnare ✅ |
| `nomina-responsabile-utenti.md` | La clausola con cui ti nomini "responsabile" dei dati dei clienti dei tuoi utenti | Inserirla nei Termini di Servizio, far validare |

## Concetto chiave (in due righe)

In Carta Canta ci sono **due livelli** di dati personali:

1. **I tuoi utenti (gli artigiani)** → di loro sei **titolare del trattamento**: serve l'informativa privacy (`informativa-privacy.md`).
2. **I clienti finali degli artigiani** (quelli inseriti nei preventivi) → di quei dati l'artigiano è titolare e **tu sei solo responsabile** (li elabori per suo conto): serve la nomina a responsabile (`nomina-responsabile-utenti.md`).

## Stato sicurezza tecnica (verificato nel codice, 14 giugno 2026)

- ✅ RLS attiva e corretta su tutte le tabelle con dati personali
- ✅ Link cliente con token casuale a 128 bit, letto lato server con chiave service_role
- ✅ Cifratura a riposo (AES-256) e in transito (TLS) gestita da Supabase
- ✅ Dati ospitati in UE (Francoforte)
- ✅ **Fix applicato e attivo**: chiusa una fuga dati tra workspace (migration 035, applicata 14 giu 2026)
- ✅ **Hardening applicato e attivo**: ristrette le policy di scrittura sui loghi (migration 036, applicata 14 giu 2026)
- ⏳ **Da fare a mano da te**: attivare la 2FA su Supabase, Vercel, Stripe, GitHub

👉 **L'elenco completo di cosa resta da fare è in [`PUNTI-APERTI.md`](PUNTI-APERTI.md)** — aggiornato man mano.

_Documenti generati come bozza il 14 giugno 2026. Da far validare a un consulente privacy._
