// Codici ATECO 2025 — più comuni per artigiani/professionisti italiani.
// ⚠️ AGGIORNATO ad ATECO 2025 (in vigore dal 2025). Sostituisce la vecchia lista ATECO 2007.
//    - Sezione F (edilizia/impianti/finiture) e studi tecnici: VERIFICATI su fonti ISTAT/ANCE.
//    - Voci marcate "// ⚠ verificare": confermare il sottocodice esatto sulla Struttura ISTAT ATECO 2025 prima del rilascio.
// NB: searchAteco invariata: cerca per codice, descrizione e categoria (parola chiave).

export type AtecoCode = {
  code: string
  label: string
  category: string
}

export const ATECO_CODES: AtecoCode[] = [
  // ── Costruzioni ──
  { code: '41.00.00', label: 'Costruzione di edifici residenziali e non residenziali', category: 'Costruzioni' },
  { code: '43.11.00', label: 'Demolizione', category: 'Costruzioni' },
  { code: '43.12.09', label: 'Preparazione del cantiere edile (scavi, movimento terra)', category: 'Costruzioni' },
  { code: '43.41.00', label: 'Realizzazione di coperture (tetti, lattoniere)', category: 'Costruzioni' },
  { code: '43.91.00', label: 'Lavori di muratura', category: 'Costruzioni' },
  { code: '43.99.01', label: 'Noleggio di gru e attrezzature edili con operatore', category: 'Costruzioni' },
  { code: '43.99.09', label: 'Altri lavori specializzati di costruzione', category: 'Costruzioni' },

  // ── Impianti ──
  { code: '43.21.01', label: 'Installazione di impianti elettrici, illuminazione e fotovoltaici', category: 'Impianti' },
  { code: '43.21.02', label: 'Installazione di cablaggi per telecomunicazioni e reti', category: 'Impianti' },
  { code: '43.22.05', label: 'Installazione di impianti termo-idraulici (idraulico)', category: 'Impianti' },
  { code: '43.22.07', label: 'Installazione di impianti di riscaldamento e condizionamento', category: 'Impianti' },
  { code: '43.22.06', label: 'Installazione di impianti per la distribuzione del gas', category: 'Impianti' },
  { code: '43.23.00', label: 'Installazione di sistemi per l’isolamento (cappotto termico)', category: 'Impianti' },
  { code: '43.24.01', label: 'Installazione di ascensori e scale mobili', category: 'Impianti' },

  // ── Finiture edili ──
  { code: '43.31.01', label: 'Posa in opera di cartongesso', category: 'Finiture edili' },
  { code: '43.31.02', label: 'Intonacatura', category: 'Finiture edili' },
  { code: '43.32.02', label: 'Posa di infissi, porte, finestre, arredi, controsoffitti, pareti', category: 'Finiture edili' },
  { code: '43.32.01', label: 'Posa in opera di porte blindate', category: 'Finiture edili' },
  { code: '43.33.00', label: 'Rivestimento di pavimenti e di pareti (piastrellista)', category: 'Finiture edili' },
  { code: '43.34.01', label: 'Tinteggiatura (imbianchino)', category: 'Finiture edili' },
  { code: '43.34.02', label: 'Posa in opera di vetri (vetraio)', category: 'Finiture edili' },
  { code: '43.35.00', label: 'Altri lavori di completamento e finitura degli edifici', category: 'Finiture edili' },

  // ── Studi tecnici / professionali ──
  { code: '71.11.00', label: 'Attività degli studi di architettura', category: 'Servizi professionali' },
  { code: '71.12.10', label: 'Attività degli studi di ingegneria', category: 'Servizi professionali' },
  { code: '71.12.30', label: 'Attività tecniche svolte da geometri', category: 'Servizi professionali' },
  { code: '74.10.00', label: 'Attività di design (grafica, interni)', category: 'Servizi professionali' }, // ⚠ verificare sottocodice
  { code: '74.20.00', label: 'Attività fotografiche', category: 'Servizi professionali' }, // ⚠ verificare sottocodice

  // ── Metallo ──
  { code: '25.11.00', label: 'Fabbricazione di strutture metalliche (carpenteria, fabbro)', category: 'Metallo' },
  { code: '25.12.10', label: 'Fabbricazione di porte, finestre e telai in metallo', category: 'Metallo' },
  { code: '25.99.30', label: 'Fabbricazione di oggetti/minuteria in metallo (fabbro)', category: 'Metallo' }, // ⚠ verificare sottocodice
  { code: '33.11.00', label: 'Riparazione e manutenzione di prodotti in metallo', category: 'Metallo' }, // ⚠ verificare

  // ── Legno ──
  { code: '16.23.09', label: 'Fabbricazione di elementi in legno e falegnameria per l’edilizia', category: 'Legno' }, // ⚠ verificare sottocodice
  { code: '31.02.10', label: 'Fabbricazione di mobili per cucina', category: 'Legno' }, // ⚠ verificare
  { code: '31.09.10', label: 'Fabbricazione di mobili per arredo domestico', category: 'Legno' }, // ⚠ verificare
  { code: '33.19.09', label: 'Riparazione e manutenzione di mobili', category: 'Legno' }, // ⚠ verificare

  // ── Automotive ──
  { code: '45.20.10', label: 'Riparazioni meccaniche di autoveicoli (meccanico)', category: 'Automotive' },
  { code: '45.20.20', label: 'Riparazione di carrozzerie di autoveicoli', category: 'Automotive' }, // ⚠ ATECO 2025: verificare vs 95.31.20
  { code: '45.20.30', label: 'Riparazione di impianti elettrici per autoveicoli', category: 'Automotive' }, // ⚠ verificare
  { code: '45.40.00', label: 'Commercio e riparazione di motocicli', category: 'Automotive' }, // ⚠ verificare sottocodice

  // ── ICT ──
  { code: '62.10.00', label: 'Produzione di software e programmazione', category: 'ICT' }, // ⚠ verificare sottocodice
  { code: '62.20.10', label: 'Consulenza informatica', category: 'ICT' },
  { code: '95.11.00', label: 'Riparazione di computer e periferiche', category: 'ICT' }, // ⚠ verificare
  { code: '95.12.00', label: 'Riparazione di apparecchiature per le comunicazioni', category: 'ICT' }, // ⚠ verificare

  // ── Servizi (edifici e verde) ──
  { code: '81.10.00', label: 'Servizi integrati di gestione degli edifici', category: 'Servizi' }, // ⚠ verificare
  { code: '81.21.00', label: 'Pulizia generale di edifici', category: 'Servizi' },
  { code: '81.30.00', label: 'Cura e manutenzione del paesaggio (giardinaggio)', category: 'Servizi' },

  // ── Servizi alla persona ──
  { code: '96.21.00', label: 'Servizi di parrucchieri e barbieri', category: 'Servizi alla persona' },
  { code: '96.22.09', label: 'Trattamenti estetici e di bellezza (estetista)', category: 'Servizi alla persona' },

  // ── Tessile ──
  { code: '14.13.10', label: 'Confezione di abbigliamento su misura (sarto)', category: 'Tessile' }, // ⚠ verificare sottocodice
  { code: '96.01.10', label: 'Attività di lavanderia per privati', category: 'Tessile' }, // ⚠ verificare sottocodice

  // ── Arte e artigianato ──
  { code: '32.12.00', label: 'Fabbricazione di oggetti di gioielleria e oreficeria', category: 'Arte e artigianato' }, // ⚠ verificare
  { code: '90.03.09', label: 'Altre creazioni artistiche e letterarie', category: 'Arte e artigianato' }, // ⚠ verificare
]

export function searchAteco(query: string): AtecoCode[] {
  const q = query.toLowerCase().trim()
  if (!q) return ATECO_CODES.slice(0, 10)
  return ATECO_CODES.filter(
    (a) =>
      a.code.includes(q) ||
      a.label.toLowerCase().includes(q) ||
      a.category.toLowerCase().includes(q)
  ).slice(0, 10)
}
