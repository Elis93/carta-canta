/**
 * Mapping ATECO → voci catalogo suggerite
 *
 * La chiave è il prefisso del codice ATECO (divisione a 2 cifre o classe a 4 cifre).
 * La ricerca usa il match per prefisso dal più specifico al più generico.
 *
 * Struttura codici ATECO italiani: "43.21.01" → sezione F, div 43, gruppo 43.2, classe 43.21
 */

export interface AtecoCatalogItem {
  name: string
  description?: string
  unit: string
  unit_price: number
  vat_rate: number
  category: string
}

export interface AtecoPreset {
  /** Label leggibile dall'utente (es. "Installazione impianti") */
  label: string
  items: AtecoCatalogItem[]
}

// ── Mappa prefisso → preset ────────────────────────────────────────────────────
const PRESETS: Record<string, AtecoPreset> = {

  // ─ Costruzione edile generica (sezione F, div 41) ─────────────────────────
  '41': {
    label: 'Costruzione di edifici',
    items: [
      { name: 'Manodopera edile specializzata', unit: 'h',  unit_price: 38, vat_rate: 22, category: 'Manodopera' },
      { name: 'Manodopera edile generica',      unit: 'h',  unit_price: 28, vat_rate: 22, category: 'Manodopera' },
      { name: 'Muratura in laterizio',          unit: 'm²', unit_price: 45, vat_rate: 10, category: 'Muratura' },
      { name: 'Intonacatura civile',            unit: 'm²', unit_price: 15, vat_rate: 10, category: 'Muratura' },
      { name: 'Demolizione muratura',           unit: 'm²', unit_price: 22, vat_rate: 22, category: 'Demolizioni' },
      { name: 'Smaltimento macerie',            unit: 'm³', unit_price: 35, vat_rate: 22, category: 'Demolizioni' },
      { name: 'Getto in calcestruzzo',          unit: 'm³', unit_price: 90, vat_rate: 10, category: 'Strutture' },
    ],
  },

  // ─ Ingegneria civile (div 42) ──────────────────────────────────────────────
  '42': {
    label: 'Ingegneria civile',
    items: [
      { name: 'Manodopera specializzata',       unit: 'h',  unit_price: 40, vat_rate: 22, category: 'Manodopera' },
      { name: 'Scavo a macchina',               unit: 'm³', unit_price: 18, vat_rate: 22, category: 'Scavi' },
      { name: 'Scavo manuale',                  unit: 'm³', unit_price: 45, vat_rate: 22, category: 'Scavi' },
      { name: 'Fornitura calcestruzzo',         unit: 'm³', unit_price: 95, vat_rate: 22, category: 'Materiali' },
    ],
  },

  // ─ Lavori specializzati (div 43 generico) ─────────────────────────────────
  '43': {
    label: 'Lavori di costruzione specializzati',
    items: [
      { name: 'Manodopera specializzata',       unit: 'h',  unit_price: 38, vat_rate: 22, category: 'Manodopera' },
      { name: 'Manodopera generica',            unit: 'h',  unit_price: 28, vat_rate: 22, category: 'Manodopera' },
      { name: 'Smontaggio/rimontaggio',         unit: 'pz', unit_price: 60, vat_rate: 22, category: 'Interventi' },
      { name: 'Trasferta / diritto di chiamata',unit: 'pz', unit_price: 20, vat_rate: 22, category: 'Trasferte' },
    ],
  },

  // ─ Demolizioni e preparazione (43.1) ──────────────────────────────────────
  '43.1': {
    label: 'Demolizioni e preparazione cantiere',
    items: [
      { name: 'Demolizione muratura',           unit: 'm²', unit_price: 22, vat_rate: 22, category: 'Demolizioni' },
      { name: 'Rimozione pavimento',            unit: 'm²', unit_price: 10, vat_rate: 22, category: 'Demolizioni' },
      { name: 'Smaltimento macerie',            unit: 'm³', unit_price: 35, vat_rate: 22, category: 'Demolizioni' },
      { name: 'Manodopera demolizione',         unit: 'h',  unit_price: 28, vat_rate: 22, category: 'Manodopera' },
    ],
  },

  // ─ Elettricisti (43.21) ───────────────────────────────────────────────────
  '43.21': {
    label: 'Impianti elettrici',
    items: [
      { name: 'Punto luce completo',            unit: 'pz', unit_price: 35,  vat_rate: 22, category: 'Impianti elettrici' },
      { name: 'Presa elettrica 16 A',           unit: 'pz', unit_price: 25,  vat_rate: 22, category: 'Impianti elettrici' },
      { name: 'Interruttore',                   unit: 'pz', unit_price: 18,  vat_rate: 22, category: 'Impianti elettrici' },
      { name: 'Quadro elettrico (fornitura + posa)', unit: 'pz', unit_price: 180, vat_rate: 22, category: 'Impianti elettrici' },
      { name: 'Tubazione corrugata',            unit: 'm',  unit_price: 4,   vat_rate: 22, category: 'Materiali' },
      { name: 'Cavo elettrico FG17',            unit: 'm',  unit_price: 3.5, vat_rate: 22, category: 'Materiali' },
      { name: 'Manodopera elettricista',        unit: 'h',  unit_price: 45,  vat_rate: 22, category: 'Manodopera' },
      { name: 'Trasferta',                      unit: 'pz', unit_price: 20,  vat_rate: 22, category: 'Trasferte' },
    ],
  },

  // ─ Idraulici (43.22) ──────────────────────────────────────────────────────
  '43.22': {
    label: 'Impianti idraulici',
    items: [
      { name: 'Manodopera idraulica',           unit: 'h',  unit_price: 45,  vat_rate: 22, category: 'Manodopera' },
      { name: 'Sostituzione rubinetteria',      unit: 'pz', unit_price: 70,  vat_rate: 22, category: 'Sanitari' },
      { name: 'Installazione sanitario',        unit: 'pz', unit_price: 100, vat_rate: 22, category: 'Sanitari' },
      { name: 'Scarico / sifone',               unit: 'pz', unit_price: 40,  vat_rate: 22, category: 'Sanitari' },
      { name: 'Tubazione in rame Ø 18',        unit: 'm',  unit_price: 15,  vat_rate: 22, category: 'Materiali' },
      { name: 'Raccordo / fittings',            unit: 'pz', unit_price: 8,   vat_rate: 22, category: 'Materiali' },
      { name: 'Trasferta / diritto di chiamata',unit: 'pz', unit_price: 25,  vat_rate: 22, category: 'Trasferte' },
    ],
  },

  // ─ Intonacatura (43.31) ───────────────────────────────────────────────────
  '43.31': {
    label: 'Intonacatura',
    items: [
      { name: 'Intonaco civile',                unit: 'm²', unit_price: 18, vat_rate: 10, category: 'Intonaci' },
      { name: 'Rasatura liscia',                unit: 'm²', unit_price: 12, vat_rate: 10, category: 'Intonaci' },
      { name: 'Cartongesso (lastra + posa)',    unit: 'm²', unit_price: 35, vat_rate: 10, category: 'Cartongesso' },
      { name: 'Manodopera intonacatore',        unit: 'h',  unit_price: 32, vat_rate: 22, category: 'Manodopera' },
    ],
  },

  // ─ Infissi / serramenti (43.32) ───────────────────────────────────────────
  '43.32': {
    label: 'Infissi e serramenti',
    items: [
      { name: 'Posa infisso finestra',          unit: 'pz', unit_price: 80,  vat_rate: 10, category: 'Infissi' },
      { name: 'Posa porta interna',             unit: 'pz', unit_price: 70,  vat_rate: 10, category: 'Infissi' },
      { name: 'Rimozione serramento esistente', unit: 'pz', unit_price: 30,  vat_rate: 22, category: 'Infissi' },
      { name: 'Sigillatura e rifinitura',       unit: 'pz', unit_price: 25,  vat_rate: 22, category: 'Infissi' },
      { name: 'Manodopera falegname',           unit: 'h',  unit_price: 38,  vat_rate: 22, category: 'Manodopera' },
    ],
  },

  // ─ Piastrellisti (43.33) ──────────────────────────────────────────────────
  '43.33': {
    label: 'Posa pavimenti e rivestimenti',
    items: [
      { name: 'Posa piastrelle (fornitura esclusa)', unit: 'm²', unit_price: 25, vat_rate: 10, category: 'Pavimentazioni' },
      { name: 'Posa parquet flottante',         unit: 'm²', unit_price: 15, vat_rate: 10, category: 'Pavimentazioni' },
      { name: 'Rimozione pavimento esistente',  unit: 'm²', unit_price: 10, vat_rate: 22, category: 'Demolizioni' },
      { name: 'Massetto livellante',            unit: 'm²', unit_price: 18, vat_rate: 10, category: 'Pavimentazioni' },
      { name: 'Rivestimento murale',            unit: 'm²', unit_price: 28, vat_rate: 10, category: 'Rivestimenti' },
      { name: 'Manodopera piastrellista',       unit: 'h',  unit_price: 32, vat_rate: 22, category: 'Manodopera' },
    ],
  },

  // ─ Tinteggiatura (43.34) ──────────────────────────────────────────────────
  '43.34': {
    label: 'Tinteggiatura e decorazione',
    items: [
      { name: 'Tinteggiatura pareti (2 mani)',  unit: 'm²', unit_price: 8,  vat_rate: 10, category: 'Tinteggiatura' },
      { name: 'Tinteggiatura soffitto',        unit: 'm²', unit_price: 10, vat_rate: 10, category: 'Tinteggiatura' },
      { name: 'Stuccatura e preparazione sup.', unit: 'm²', unit_price: 6,  vat_rate: 10, category: 'Tinteggiatura' },
      { name: 'Verniciatura serramenti',        unit: 'pz', unit_price: 35, vat_rate: 22, category: 'Tinteggiatura' },
      { name: 'Manodopera imbianchino',         unit: 'h',  unit_price: 30, vat_rate: 22, category: 'Manodopera' },
    ],
  },

  // ─ Coperture (43.91) ──────────────────────────────────────────────────────
  '43.91': {
    label: 'Coperture e tetti',
    items: [
      { name: 'Manto di copertura in tegole',   unit: 'm²', unit_price: 40, vat_rate: 10, category: 'Coperture' },
      { name: 'Impermeabilizzazione tetto',     unit: 'm²', unit_price: 25, vat_rate: 10, category: 'Coperture' },
      { name: 'Lattoneria (grondaie)',          unit: 'm',  unit_price: 22, vat_rate: 22, category: 'Lattoneria' },
      { name: 'Manodopera coperturista',        unit: 'h',  unit_price: 38, vat_rate: 22, category: 'Manodopera' },
    ],
  },

  // ─ Manifattura legno / falegnameria (div 16) ──────────────────────────────
  '16': {
    label: 'Falegnameria e lavorazione del legno',
    items: [
      { name: 'Lavorazione su misura legno',    unit: 'h',  unit_price: 40, vat_rate: 22, category: 'Falegnameria' },
      { name: 'Mobile su misura',               unit: 'pz', unit_price: 350,vat_rate: 22, category: 'Falegnameria' },
      { name: 'Ripristino/restauro mobile',     unit: 'h',  unit_price: 38, vat_rate: 22, category: 'Falegnameria' },
      { name: 'Posa parquet',                   unit: 'm²', unit_price: 20, vat_rate: 10, category: 'Pavimentazioni' },
      { name: 'Manodopera falegname',           unit: 'h',  unit_price: 38, vat_rate: 22, category: 'Manodopera' },
    ],
  },

  // ─ Autoriparazione (45.2) ─────────────────────────────────────────────────
  '45.2': {
    label: 'Riparazione autoveicoli',
    items: [
      { name: 'Manodopera meccanica',           unit: 'h',  unit_price: 55, vat_rate: 22, category: 'Manodopera' },
      { name: 'Tagliando standard',             unit: 'pz', unit_price: 80, vat_rate: 22, category: 'Tagliandi' },
      { name: 'Sostituzione pneumatici',        unit: 'pz', unit_price: 15, vat_rate: 22, category: 'Interventi' },
      { name: 'Diagnostica elettronica',        unit: 'pz', unit_price: 40, vat_rate: 22, category: 'Interventi' },
    ],
  },

  // ─ Architettura e ingegneria (71.1) ───────────────────────────────────────
  '71.1': {
    label: 'Progettazione e ingegneria',
    items: [
      { name: 'Progettazione architettonica',   unit: 'h',  unit_price: 80,  vat_rate: 22, category: 'Progettazione' },
      { name: 'Direzione lavori',               unit: 'h',  unit_price: 70,  vat_rate: 22, category: 'Progettazione' },
      { name: 'Consulenza tecnica',             unit: 'h',  unit_price: 75,  vat_rate: 22, category: 'Consulenza' },
      { name: 'Rilievo metrico',                unit: 'pz', unit_price: 200, vat_rate: 22, category: 'Sopralluoghi' },
      { name: 'Pratiche catastali / CILA / SCIA',unit: 'pz',unit_price: 350, vat_rate: 22, category: 'Pratiche' },
      { name: 'Perizia tecnica',                unit: 'pz', unit_price: 400, vat_rate: 22, category: 'Perizie' },
      { name: 'Relazione strutturale',          unit: 'pz', unit_price: 600, vat_rate: 22, category: 'Perizie' },
    ],
  },

  // ─ Consulenza legale (69.1) ───────────────────────────────────────────────
  '69.1': {
    label: 'Consulenza legale',
    items: [
      { name: 'Consulenza legale',              unit: 'h',  unit_price: 100, vat_rate: 22, category: 'Consulenza' },
      { name: 'Redazione atto / contratto',     unit: 'pz', unit_price: 300, vat_rate: 22, category: 'Atti' },
      { name: 'Assistenza stragiudiziale',      unit: 'pz', unit_price: 500, vat_rate: 22, category: 'Assistenza' },
    ],
  },

  // ─ Consulenza aziendale / contabilità (69.2, 70.2) ────────────────────────
  '69.2': {
    label: 'Contabilità e consulenza fiscale',
    items: [
      { name: 'Consulenza fiscale',             unit: 'h',  unit_price: 80,  vat_rate: 22, category: 'Consulenza' },
      { name: 'Dichiarazione dei redditi',      unit: 'pz', unit_price: 150, vat_rate: 22, category: 'Dichiarazioni' },
      { name: 'Tenuta contabilità mensile',     unit: 'mese',unit_price: 200,vat_rate: 22, category: 'Contabilità' },
    ],
  },
  '70.2': {
    label: 'Consulenza aziendale',
    items: [
      { name: 'Consulenza strategica',          unit: 'h',  unit_price: 100, vat_rate: 22, category: 'Consulenza' },
      { name: 'Business plan',                  unit: 'pz', unit_price: 800, vat_rate: 22, category: 'Documenti' },
      { name: 'Workshop / formazione',          unit: 'gg', unit_price: 600, vat_rate: 22, category: 'Formazione' },
    ],
  },

  // ─ Software / IT (62) ─────────────────────────────────────────────────────
  '62': {
    label: 'Sviluppo software e consulenza IT',
    items: [
      { name: 'Sviluppo software',              unit: 'h',  unit_price: 80,  vat_rate: 22, category: 'Sviluppo' },
      { name: 'Consulenza IT',                  unit: 'h',  unit_price: 70,  vat_rate: 22, category: 'Consulenza' },
      { name: 'Assistenza sistemistica',        unit: 'h',  unit_price: 55,  vat_rate: 22, category: 'Assistenza' },
      { name: 'Setup / configurazione',         unit: 'pz', unit_price: 120, vat_rate: 22, category: 'Interventi' },
      { name: 'Formazione tecnica',             unit: 'h',  unit_price: 60,  vat_rate: 22, category: 'Formazione' },
    ],
  },

  // ─ Design / grafica (74.10) ───────────────────────────────────────────────
  '74.10': {
    label: 'Design e grafica',
    items: [
      { name: 'Progettazione grafica',          unit: 'h',  unit_price: 55,  vat_rate: 22, category: 'Design' },
      { name: 'Identità visiva / logo',         unit: 'pz', unit_price: 800, vat_rate: 22, category: 'Branding' },
      { name: 'Social media kit',               unit: 'pz', unit_price: 300, vat_rate: 22, category: 'Branding' },
      { name: 'Impaginazione (dépliant/brochure)', unit: 'pz', unit_price: 150, vat_rate: 22, category: 'Editoria' },
    ],
  },

  // ─ Fotografia (74.20) ─────────────────────────────────────────────────────
  '74.20': {
    label: 'Fotografia',
    items: [
      { name: 'Servizio fotografico (mezza giornata)', unit: 'pz', unit_price: 300, vat_rate: 22, category: 'Servizi' },
      { name: 'Servizio fotografico (giornata)',       unit: 'gg', unit_price: 550, vat_rate: 22, category: 'Servizi' },
      { name: 'Post-produzione / ritocco',             unit: 'h',  unit_price: 50,  vat_rate: 22, category: 'Post-prod.' },
      { name: 'Stampa fotografica',                    unit: 'pz', unit_price: 25,  vat_rate: 22, category: 'Stampa' },
    ],
  },

  // ─ Pulizie (81.2) ─────────────────────────────────────────────────────────
  '81.2': {
    label: 'Pulizie e sanificazione',
    items: [
      { name: 'Pulizia civile (appartamenti)',  unit: 'h',  unit_price: 18, vat_rate: 22, category: 'Pulizie' },
      { name: 'Pulizia uffici / commerciale',  unit: 'h',  unit_price: 20, vat_rate: 22, category: 'Pulizie' },
      { name: 'Sanificazione ambienti',         unit: 'm²', unit_price: 5,  vat_rate: 22, category: 'Sanificazione' },
      { name: 'Facchinaggio / sgombero',        unit: 'h',  unit_price: 25, vat_rate: 22, category: 'Traslochi' },
    ],
  },

  // ─ Trasporti (49.4) ───────────────────────────────────────────────────────
  '49.4': {
    label: 'Trasporto merci',
    items: [
      { name: 'Trasporto merce (furgone)',      unit: 'km', unit_price: 1.5, vat_rate: 22, category: 'Trasporti' },
      { name: 'Consegna / ritiro locale',       unit: 'pz', unit_price: 25,  vat_rate: 22, category: 'Trasporti' },
      { name: 'Facchinaggio',                   unit: 'h',  unit_price: 25,  vat_rate: 22, category: 'Trasporti' },
    ],
  },

  // ─ Parrucchieri (96.02) ───────────────────────────────────────────────────
  '96.02': {
    label: 'Parrucchieri',
    items: [
      { name: 'Taglio capelli uomo',            unit: 'pz', unit_price: 15, vat_rate: 22, category: 'Taglio' },
      { name: 'Taglio capelli donna',           unit: 'pz', unit_price: 28, vat_rate: 22, category: 'Taglio' },
      { name: 'Colorazione',                    unit: 'pz', unit_price: 55, vat_rate: 22, category: 'Colorazione' },
      { name: 'Piega',                          unit: 'pz', unit_price: 18, vat_rate: 22, category: 'Acconciatura' },
    ],
  },

  // ─ Estetiste (96.02 / 86.90) ──────────────────────────────────────────────
  '86.90': {
    label: 'Servizi estetici e benessere',
    items: [
      { name: 'Trattamento viso',               unit: 'pz', unit_price: 45, vat_rate: 22, category: 'Trattamenti' },
      { name: 'Trattamento corpo',              unit: 'pz', unit_price: 50, vat_rate: 22, category: 'Trattamenti' },
      { name: 'Massaggio',                      unit: 'h',  unit_price: 60, vat_rate: 22, category: 'Massaggi' },
      { name: 'Manicure / pedicure',            unit: 'pz', unit_price: 25, vat_rate: 22, category: 'Nail' },
    ],
  },
}

// ── Lookup ─────────────────────────────────────────────────────────────────────

/**
 * Genera prefissi in ordine dal più specifico al più generico.
 * "43.21.01" → ["43.21", "43.2", "43"]
 */
function prefixes(code: string): string[] {
  const clean = code.trim().toUpperCase().replace(/\s/g, '')
  // Normalizza a lowercase per match (le chiavi sono lowercase)
  const lower = code.trim()
  const result: string[] = []

  // Prova lunghezze decrescenti (senza trailing ".")
  const dots = lower.split('.')
  if (dots.length >= 3) result.push(dots.slice(0, 3).join('.'))
  if (dots.length >= 2) result.push(dots.slice(0, 2).join('.'))
  if (dots.length >= 1) {
    // Solo i primi 4 char (es. "43.2") e i primi 2 (es. "43")
    const div2 = dots[0]!.slice(0, 2)
    const subdiv = lower.includes('.') ? dots[0] + '.' + (dots[1] ?? '').charAt(0) : ''
    if (subdiv) result.push(subdiv)
    result.push(div2)
    // Primo carattere (sezione lettera) — meno usato, non incluso
  }

  // Rimuovi duplicati mantenendo l'ordine
  return [...new Set(result)]
}

/**
 * Restituisce il preset più specifico che matcha almeno uno dei codici ATECO dati.
 * Prioritizza il match più specifico (più lungo).
 */
export function getAtecoPreset(atecoCodes: string[]): AtecoPreset | null {
  if (!atecoCodes.length) return null

  for (const code of atecoCodes) {
    const pfs = prefixes(code)
    for (const p of pfs) {
      if (PRESETS[p]) return PRESETS[p]!
    }
  }
  return null
}

/**
 * Restituisce tutti i preset unici che matchano i codici dati (senza duplicati).
 */
export function getAllAtecoPresets(atecoCodes: string[]): AtecoPreset[] {
  const seen = new Set<string>()
  const result: AtecoPreset[] = []
  for (const code of atecoCodes) {
    const pfs = prefixes(code)
    for (const p of pfs) {
      if (PRESETS[p] && !seen.has(p)) {
        seen.add(p)
        result.push(PRESETS[p]!)
        break // un solo match per codice ATECO
      }
    }
  }
  return result
}
