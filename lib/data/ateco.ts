// 50 codici ATECO più comuni per artigiani italiani
export type AtecoCode = {
  code: string
  label: string
  category: string
}

export const ATECO_CODES: AtecoCode[] = [
  // Costruzioni e impianti
  { code: '43.11.00', label: 'Demolizione', category: 'Costruzioni' },
  { code: '43.12.00', label: 'Preparazione del cantiere edile', category: 'Costruzioni' },
  { code: '43.21.01', label: 'Installazione di impianti elettrici', category: 'Impianti' },
  { code: '43.21.02', label: 'Installazione di impianti elettronici', category: 'Impianti' },
  { code: '43.22.01', label: 'Installazione di impianti idraulici', category: 'Impianti' },
  { code: '43.22.02', label: 'Installazione di impianti di riscaldamento e climatizzazione', category: 'Impianti' },
  { code: '43.22.03', label: 'Installazione di impianti gas', category: 'Impianti' },
  { code: '43.29.01', label: 'Installazione di ascensori e scale mobili', category: 'Impianti' },
  { code: '43.29.09', label: 'Altri lavori di costruzione e installazione', category: 'Costruzioni' },
  { code: '43.31.00', label: 'Intonacatura', category: 'Finiture edili' },
  { code: '43.32.01', label: 'Posa in opera di casseforti', category: 'Finiture edili' },
  { code: '43.32.02', label: 'Posa in opera di infissi, arredi, controsoffitti, pareti mobili', category: 'Finiture edili' },
  { code: '43.33.00', label: 'Rivestimento di pavimenti e muri', category: 'Finiture edili' },
  { code: '43.34.00', label: 'Tinteggiatura e posa in opera di vetri', category: 'Finiture edili' },
  { code: '43.39.01', label: 'Altri lavori di completamento e finitura degli edifici', category: 'Finiture edili' },
  { code: '43.91.00', label: 'Realizzazione di coperture', category: 'Costruzioni' },
  { code: '43.99.01', label: 'Pulizia a vapore, sabbiatura e attività simili', category: 'Costruzioni' },
  { code: '43.99.09', label: 'Altre attività di lavori specializzati', category: 'Costruzioni' },

  // Falegnameria e lavorazione legno
  { code: '16.23.10', label: 'Fabbricazione di altri elementi in legno', category: 'Legno' },
  { code: '31.01.00', label: 'Fabbricazione di mobili per ufficio e negozi', category: 'Legno' },
  { code: '31.02.00', label: 'Fabbricazione di mobili per cucina', category: 'Legno' },
  { code: '31.09.01', label: 'Fabbricazione di mobili per arredo domestico', category: 'Legno' },
  { code: '33.19.09', label: 'Riparazione e manutenzione di mobili', category: 'Legno' },

  // Metalmeccanica
  { code: '25.11.00', label: 'Fabbricazione di strutture metalliche', category: 'Metallo' },
  { code: '25.12.00', label: 'Fabbricazione di porte, finestre e affini in metallo', category: 'Metallo' },
  { code: '25.62.00', label: 'Tornitura e fresatura', category: 'Metallo' },
  { code: '25.93.10', label: 'Fabbricazione di cerniere, serrature, chiavi', category: 'Metallo' },
  { code: '33.11.00', label: 'Riparazione di prodotti in metallo', category: 'Metallo' },

  // Automotive e trasporti
  { code: '45.20.10', label: 'Riparazione e manutenzione di autoveicoli', category: 'Automotive' },
  { code: '45.20.20', label: 'Riparazione di carrozzerie', category: 'Automotive' },
  { code: '45.20.30', label: 'Riparazione di impianti elettrici auto', category: 'Automotive' },
  { code: '45.40.10', label: 'Commercio e riparazione di motocicli', category: 'Automotive' },

  // Servizi professionali
  { code: '71.11.00', label: 'Attività degli studi di architettura', category: 'Servizi professionali' },
  { code: '71.12.10', label: 'Attività degli studi di ingegneria', category: 'Servizi professionali' },
  { code: '71.12.20', label: 'Attività di topografi e geometri', category: 'Servizi professionali' },
  { code: '74.10.21', label: 'Attività dei grafici', category: 'Servizi professionali' },
  { code: '74.20.19', label: 'Altre attività fotografiche', category: 'Servizi professionali' },

  // Giardinaggio e pulizie
  { code: '81.10.00', label: 'Servizi integrati di gestione degli edifici', category: 'Servizi' },
  { code: '81.21.00', label: 'Pulizia generale non specializzata di edifici', category: 'Servizi' },
  { code: '81.30.00', label: 'Cura e manutenzione del paesaggio', category: 'Servizi' },

  // Abbigliamento e tessile
  { code: '14.13.10', label: 'Confezione di abbigliamento su misura', category: 'Tessile' },
  { code: '96.09.02', label: 'Attività di lavanderia', category: 'Tessile' },

  // ICT e digitale
  { code: '62.01.00', label: 'Produzione di software', category: 'ICT' },
  { code: '62.02.00', label: 'Consulenza nel settore delle tecnologie informatiche', category: 'ICT' },
  { code: '95.11.00', label: 'Riparazione di computer e periferiche', category: 'ICT' },
  { code: '95.12.01', label: 'Riparazione di telefoni fissi e cellulari', category: 'ICT' },

  // Altro
  { code: '96.02.01', label: 'Servizi dei saloni di barbiere e parrucchiere', category: 'Servizi alla persona' },
  { code: '96.02.02', label: 'Altri trattamenti estetici', category: 'Servizi alla persona' },
  { code: '90.03.09', label: 'Altre creazioni artistiche e letterarie', category: 'Arte e artigianato' },
  { code: '32.99.20', label: 'Fabbricazione di oggetti di gioielleria artigianale', category: 'Arte e artigianato' },
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
