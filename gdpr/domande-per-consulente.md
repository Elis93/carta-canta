# Preparazione per il consulente privacy — Carta Canta

> Porta questo foglio (e i documenti della cartella `gdpr/`) al consulente: la consulenza sarà
> più rapida e meno costosa se arrivi con tutto pronto. Ultimo aggiornamento: 14 giugno 2026.

## 1. Cosa portare / mostrare

- I documenti bozza già pronti in `gdpr/`: informativa privacy, registro dei trattamenti,
  procedura data breach, nomina a responsabile (per gli utenti), checklist DPA fornitori,
  audit cookie.
- Le pagine `/privacy` e `/termini` create nell'app (con i segnaposto da compilare).

## 2. Dati della tua azienda da avere pronti (servono per compilare i documenti)

- Ragione sociale / nome e cognome
- Forma giuridica (ditta individuale, S.r.l., ecc.)
- P.IVA e Codice Fiscale
- Sede legale / domicilio fiscale
- Email di contatto per la privacy (es. privacy@cartacanta.app)
- PEC (se disponibile)
- Eventuale foro competente (per i Termini)

## 3. Domande da fare al consulente

1. **DPO:** nel mio caso (SaaS che gestisce dati di clienti per conto di artigiani) è
   obbligatorio nominare un Responsabile della Protezione dei Dati? (Di norma no per realtà
   piccole, ma conferma.)
2. **DPIA:** serve una valutazione d'impatto sulla protezione dei dati?
3. **Basi giuridiche:** sono corrette quelle indicate nell'informativa (contratto, obbligo
   legale, legittimo interesse)?
4. **Tempi di conservazione:** quali periodi indico esattamente (i campi `[X]` nei documenti)?
   In particolare per dati account, log di sicurezza, documenti fiscali.
5. **Ruolo titolare/responsabile:** la nomina a responsabile verso gli utenti
   (`nomina-responsabile-utenti.md`) è formulata correttamente per l'art. 28?
6. **Trasferimenti extra-UE:** per i fornitori USA (Stripe, Resend, AssemblyAI) qual è lo
   strumento corretto da citare (Clausole Contrattuali Standard / EU-US Data Privacy Framework)?
7. **Cookie:** confermi che, non avendo tracciamento attivo, NON serve il banner cookie (vedi
   `audit-cookie-tracciamento.md`)? Cosa cambia se attivo PostHog/analytics?
8. **Termini di Servizio:** la bozza va integrata con clausole sul consumatore / recesso?
9. **Diritti degli interessati:** la gestione attuale (cancellazione via cestino, possibilità
   di esportare i dati) è sufficiente o serve una procedura formale dedicata?
10. **Email di contatto privacy:** meglio una casella dedicata (privacy@) o va bene quella
    aziendale?

## 4. Decisioni che restano a te (da prendere col consulente)

- Tempi di conservazione esatti.
- Se rimuovere PostHog o tenerlo (con banner di consenso quando attivo).
- Se predisporre una procedura formale per le richieste degli interessati.

## 5. Dopo la consulenza

- Compilare i `[PLACEHOLDER]` nei documenti e nelle pagine `/privacy` e `/termini`.
- Pubblicare l'informativa.
- Accettare e archiviare i DPA dei fornitori (`checklist-dpa-fornitori.md`).
- Spuntare le voci risolte in `PUNTI-APERTI.md`.
