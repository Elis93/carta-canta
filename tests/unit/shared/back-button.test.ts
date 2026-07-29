import { describe, it, expect } from 'vitest'
import { shouldGoBack } from '@/components/shared/BackButton'

// La freccia "indietro" decide tra history.back() e il fallback (pagina
// genitore). Feedback Eli 28 lug: "a volte funziona in modo errato" —
// il vecchio criterio era `history.length > 1`, quasi sempre vero (conta
// anche la cronologia PRIMA di entrare nell'app): back cieco che usciva
// dall'app sui link diretti o riportava sul form appena inviato.

describe('shouldGoBack — quando la freccia può usare la cronologia', () => {
  it('navigazione normale in-app (lista → dettaglio): torna indietro', () => {
    expect(shouldGoBack('/fatture', '/fatture/abc', 5)).toBe(true)
  })

  it('LINK DIRETTO (notifica/WhatsApp): nessuna pagina in-app precedente → fallback', () => {
    // history.length > 1 per via dei siti visitati PRIMA: senza questa
    // guardia il back usciva dall'app.
    expect(shouldGoBack(null, '/fatture/abc', 7)).toBe(false)
  })

  it('arrivo da un FORM appena inviato (redirect post-salvataggio): fallback', () => {
    // Tornare sul form di creazione già inviato è sempre sbagliato.
    expect(shouldGoBack('/preventivi/nuovo', '/preventivi', 5)).toBe(false)
    expect(shouldGoBack('/sopralluoghi/nuovo', '/sopralluoghi/xyz', 5)).toBe(false)
    expect(shouldGoBack('/catalogo/importa', '/catalogo', 5)).toBe(false)
  })

  it('arrivo dal LOGIN o dal boot: fallback (mai tornare ai flussi di accesso)', () => {
    expect(shouldGoBack('/login', '/dashboard', 5)).toBe(false)
    expect(shouldGoBack('/avvio', '/dashboard', 5)).toBe(false)
  })

  it('pagina precedente = pagina corrente (refresh/replace): fallback', () => {
    expect(shouldGoBack('/clienti/x', '/clienti/x', 5)).toBe(false)
  })

  it('cronologia vuota: fallback anche con una precedente registrata (stantia)', () => {
    expect(shouldGoBack('/fatture', '/fatture/abc', 1)).toBe(false)
  })

  it('una pagina che CONTIENE "nuovo" ma non è un form non viene bloccata', () => {
    // il filtro è sul suffisso /nuovo, non sulla parola
    expect(shouldGoBack('/clienti/nuovo-cliente-srl', '/clienti', 5)).toBe(true)
  })
})
