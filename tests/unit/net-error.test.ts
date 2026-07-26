// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { networkErrorMessage } from '@/lib/net-error'

// Il messaggio è l'unica cosa che l'artigiano vede quando il campo va via
// mentre salva: deve dire che i dati sono ancora lì e cosa fare.

function setOnline(value: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value)
}
afterEach(() => vi.restoreAllMocks())

describe('networkErrorMessage', () => {
  it('offline: lo dice esplicitamente e invita a non chiudere la pagina', () => {
    setOnline(false)
    const msg = networkErrorMessage('salvare il preventivo')
    expect(msg).toContain('senza connessione')
    expect(msg).toContain('non è stato possibile salvare il preventivo')
    expect(msg).toContain('Non chiudere la pagina')
  })

  it('online ma chiamata fallita: NON dà la colpa alla connessione con certezza', () => {
    setOnline(true)
    const msg = networkErrorMessage('salvare la spesa')
    expect(msg).toContain('Può essere la linea che va e viene')
    expect(msg.toLowerCase()).toContain('non è stato possibile salvare la spesa')
    // rassicura: non si è perso niente
    expect(msg.toLowerCase()).toContain('non si è perso niente')
    // lo stesso lancio arriva da un bug del server: mai affermare che è la rete
    expect(msg).not.toMatch(/sei senza connessione|la connessione è assente/i)
    // e c'è una via d'uscita se il problema persiste
    expect(msg).toContain('Aiuto')
  })

  it('non promette mai che il salvataggio sia riuscito', () => {
    setOnline(false)
    expect(networkErrorMessage('salvare il lavoro')).not.toMatch(/salvato con successo/)
  })

  it('la frase regge con soggetti maschili E femminili (niente concordanze sbagliate)', () => {
    setOnline(true)
    for (const op of [
      'salvare il preventivo', 'salvare la fattura', 'eliminare la voce',
      'inviare il sollecito', 'ripristinare il documento',
    ]) {
      // costruzione impersonale + infinito: nessuna concordanza da sbagliare
      expect(networkErrorMessage(op).toLowerCase()).toContain(`non è stato possibile ${op}`)
      expect(networkErrorMessage(op)).not.toMatch(/non è stato salvat|non è stata salvat/)
    }
  })
})
