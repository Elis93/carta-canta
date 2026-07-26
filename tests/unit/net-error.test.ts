// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { saveNetworkError } from '@/lib/net-error'

// Il messaggio è l'unica cosa che l'artigiano vede quando il campo va via
// mentre salva: deve dire che i dati sono ancora lì e cosa fare.

function setOnline(value: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value)
}
afterEach(() => vi.restoreAllMocks())

describe('saveNetworkError', () => {
  it('offline: lo dice esplicitamente e invita a non chiudere la pagina', () => {
    setOnline(false)
    const msg = saveNetworkError('il preventivo')
    expect(msg).toContain('senza connessione')
    expect(msg).toContain('non è stato possibile salvare il preventivo')
    expect(msg).toContain('Non chiudere la pagina')
  })

  it('online ma chiamata fallita: non accusa la connessione con certezza', () => {
    setOnline(true)
    const msg = saveNetworkError('la spesa')
    expect(msg).toContain('sembra assente o instabile')
    expect(msg.toLowerCase()).toContain('non è stato possibile salvare la spesa')
    // rassicura che il lavoro non è perso
    expect(msg).toContain('ancora qui')
  })

  it('non promette mai che il salvataggio sia riuscito', () => {
    setOnline(false)
    expect(saveNetworkError('il lavoro')).not.toMatch(/salvato con successo/)
  })

  it('la frase regge con soggetti maschili E femminili (niente concordanze sbagliate)', () => {
    setOnline(true)
    for (const s of ['il preventivo', 'la fattura', 'la spesa', 'il rapportino', 'la voce']) {
      // costruzione impersonale: "non è stato possibile salvare X"
      expect(saveNetworkError(s).toLowerCase()).toContain(`non è stato possibile salvare ${s}`)
      expect(saveNetworkError(s)).not.toMatch(new RegExp(`${s} non è stat`))
    }
  })
})
