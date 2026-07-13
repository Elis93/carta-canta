import { describe, it, expect } from 'vitest'
import { matchCatalog, tokenize, type CatalogEntry } from '@/lib/ai/catalog-match'

// Il matcher è il GUARDIANO DEI PREZZI: questi test provano che un prezzo
// esce SOLO da una voce di catalogo che combacia davvero, mai altrimenti.

const CATALOGO: CatalogEntry[] = [
  { name: 'Rifacimento piastrelle bagno', unit: 'mq', unit_price: 45 },
  { name: 'Manodopera idraulica', unit: 'ora', unit_price: 35 },
  { name: 'Manodopera elettrica', unit: 'ora', unit_price: 38 },
  { name: 'Sostituzione miscelatore', unit: 'cad', unit_price: 120 },
  { name: 'Voce senza prezzo', unit: 'pz', unit_price: null },
]

describe('tokenize', () => {
  it('rimuove accenti, punteggiatura e parole troppo corte/generiche', () => {
    expect(tokenize('Rifàcimento, di piastrelle!')).toEqual(['rifacimento', 'piastrelle'])
  })
})

describe('matchCatalog — garanzia prezzi dal solo catalogo', () => {
  it('abbina una descrizione chiara e restituisce il prezzo VERO del catalogo', () => {
    const m = matchCatalog('Rifacimento piastrelle del bagno', CATALOGO)
    expect(m).not.toBeNull()
    expect(m!.unit_price).toBe(45)
    expect(m!.unit).toBe('mq')
    expect(m!.catalogName).toBe('Rifacimento piastrelle bagno')
  })

  it('NON confonde manodopera idraulica con quella elettrica', () => {
    const m = matchCatalog('Manodopera idraulica', CATALOGO)
    expect(m!.unit_price).toBe(35) // idraulica, non 38 (elettrica)
  })

  it('restituisce null quando NON c\'è un abbinamento sicuro (→ "da prezzare")', () => {
    expect(matchCatalog('Cartongesso controsoffitto', CATALOGO)).toBeNull()
    expect(matchCatalog('Tinteggiatura pareti', CATALOGO)).toBeNull()
  })

  it('ignora le voci di catalogo SENZA prezzo (non attacca prezzi nulli)', () => {
    // "voce senza prezzo" combacerebbe per testo, ma non ha unit_price → salta
    expect(matchCatalog('Voce senza prezzo', CATALOGO)).toBeNull()
  })

  it('descrizione vuota o priva di token → nessun prezzo', () => {
    expect(matchCatalog('', CATALOGO)).toBeNull()
    expect(matchCatalog('di e a', CATALOGO)).toBeNull()
  })

  it('catalogo vuoto → nessun prezzo (tutto "da prezzare")', () => {
    expect(matchCatalog('Manodopera idraulica', [])).toBeNull()
  })

  it('un match parziale sotto soglia non attacca il prezzo', () => {
    // "manodopera" da sola copre solo 1/2 dei token di "Manodopera idraulica"
    // (0.5 < soglia 0.6) → nessun match, la voce resta da prezzare
    expect(matchCatalog('Manodopera generica', CATALOGO)).toBeNull()
  })
})
