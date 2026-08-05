# Font self-hosted (GDPR: nessuna chiamata a Google Fonts dal client)

- `inter-latin-400-800.woff2` / `inter-latin-ext-400-800.woff2` — Inter (Rasmus
  Andersson), SIL Open Font License 1.1, variabile 400-800. È il carattere del
  preset "classico", cioè il default dei documenti. ⚠️ Fino al 5 ago 2026
  arrivava da fonts.googleapis.com: partiva dal browser del CLIENTE a ogni
  apertura del link, mandando il suo indirizzo IP a Google. Ora è nostro.
- `atkinson-hyperlegible-400/700.woff2` — Atkinson Hyperlegible (Braille Institute),
  SIL Open Font License 1.1. Font ad alta leggibilità: è il carattere "grande e
  chiaro" dei template (chiave DB storica: 'Helvetica').
- `lora-400-700.woff2` — Lora (Cyreal), SIL Open Font License 1.1, variabile 400-700.
  Fallback serif del carattere "elegante" (Georgia) sui dispositivi che non hanno
  Georgia (Android non la include: prima cadeva su un serif generico).

Licenza completa: https://openfontlicense.org — i font restano sotto OFL 1.1.
Dichiarati in `app/globals.css` (@font-face) e nell'HTML dei PDF (lib/pdf/template.ts).
