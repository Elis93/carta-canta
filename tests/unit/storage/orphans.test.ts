import { describe, it, expect } from 'vitest'
import { riconcilia, riferimentiFoto, riferimentiLogo, logoPathFromUrl } from '@/lib/storage/orphans'

// ============================================================
// Questo job CANCELLA FILE in modo irreversibile: i test servono a congelare
// i casi in cui NON deve cancellare, che sono più importanti di quelli in cui
// deve. Un errore qui non è un bug, è una perdita di dati dei clienti.
// ============================================================

const GIORNO = 24 * 60 * 60 * 1000
const vecchio = new Date(Date.now() - 30 * GIORNO).toISOString()
const recente = new Date(Date.now() - 2 * GIORNO).toISOString()

/** Finto archivio: una cartella per utente, con i file dentro. */
function fintoStorage(
  cartelle: Record<string, Array<{ name: string; created_at: string }>>,
  opts: { listError?: string; removeError?: string } = {},
) {
  const rimossi: string[] = []
  const storage = {
    from: () => ({
      // ⚠️ Il finto archivio RISPETTA limit/offset come quello vero: senza,
      // il ciclo di paginazione non finirebbe mai e il test resterebbe
      // appeso invece di fallire (successo al primo tentativo).
      list: async (prefix: string, o?: { limit: number; offset: number }) => {
        if (opts.listError) return { data: null, error: { message: opts.listError } }
        const limit = o?.limit ?? 100
        const offset = o?.offset ?? 0
        const tutti = prefix === ''
          ? Object.keys(cartelle).map((name) => ({ name, id: null }))
          : (cartelle[prefix] ?? []).map((f) => ({ ...f, id: `id-${f.name}` }))
        return { data: tutti.slice(offset, offset + limit), error: null }
      },
      remove: async (paths: string[]) => {
        if (opts.removeError) return { error: { message: opts.removeError } }
        rimossi.push(...paths)
        return { error: null }
      },
    }),
  }
  return { admin: { storage }, rimossi }
}

describe('riconcilia — file orfani negli archivi', () => {
  it('un file collegato a una riga non viene mai toccato, per quanto vecchio', async () => {
    const { admin, rimossi } = fintoStorage({ 'utente-1': [{ name: 'a.jpg', created_at: vecchio }] })
    const r = await riconcilia(admin, 'work-photos', new Set(['utente-1/a.jpg']), { provaSoltanto: false })
    expect(r.orfani).toBe(0)
    expect(rimossi).toEqual([])
  })

  it('un orfano più giovane dei giorni di grazia si conta ma NON si cancella', async () => {
    // È il caso normale: foto caricata e preventivo ancora da compilare.
    const { admin, rimossi } = fintoStorage({ 'utente-1': [{ name: 'nuova.jpg', created_at: recente }] })
    const r = await riconcilia(admin, 'work-photos', new Set(), { provaSoltanto: false })
    expect(r.orfani).toBe(1)
    expect(r.orfaniMaturi).toBe(0)
    expect(r.cancellati).toBe(0)
    expect(rimossi).toEqual([])
  })

  it('un orfano vecchio viene cancellato', async () => {
    const { admin, rimossi } = fintoStorage({ 'utente-1': [{ name: 'persa.jpg', created_at: vecchio }] })
    const r = await riconcilia(admin, 'work-photos', new Set(), { provaSoltanto: false })
    expect(r.orfaniMaturi).toBe(1)
    expect(r.cancellati).toBe(1)
    expect(rimossi).toEqual(['utente-1/persa.jpg'])
  })

  it('in modalità di prova non cancella nulla, ma conta tutto', async () => {
    const { admin, rimossi } = fintoStorage({ 'utente-1': [{ name: 'persa.jpg', created_at: vecchio }] })
    const r = await riconcilia(admin, 'work-photos', new Set(), { provaSoltanto: true })
    expect(r.orfaniMaturi).toBe(1)
    expect(r.cancellati).toBe(0)
    expect(rimossi).toEqual([])
  })

  it('se l\'archivio non si lascia elencare NON cancella niente e riporta l\'errore', async () => {
    const { admin, rimossi } = fintoStorage({}, { listError: 'rete assente' })
    const r = await riconcilia(admin, 'work-photos', new Set(), { provaSoltanto: false })
    expect(r.errore).toContain('rete assente')
    expect(r.cancellati).toBe(0)
    expect(rimossi).toEqual([])
  })

  it('non cancella più del tetto per esecuzione', async () => {
    const files = Array.from({ length: 250 }, (_, i) => ({ name: `f${i}.jpg`, created_at: vecchio }))
    const { admin, rimossi } = fintoStorage({ 'utente-1': files })
    const r = await riconcilia(admin, 'work-photos', new Set(), { provaSoltanto: false })
    expect(r.orfaniMaturi).toBe(250)
    expect(r.cancellati).toBe(200)
    expect(rimossi).toHaveLength(200)
  })

  it('separa i file di utenti diversi senza confonderli', async () => {
    // Due utenti con un file dallo STESSO nome: solo quello scollegato va via.
    const { admin, rimossi } = fintoStorage({
      'utente-1': [{ name: 'foto.jpg', created_at: vecchio }],
      'utente-2': [{ name: 'foto.jpg', created_at: vecchio }],
    })
    const r = await riconcilia(admin, 'work-photos', new Set(['utente-1/foto.jpg']), { provaSoltanto: false })
    expect(r.fileTotali).toBe(2)
    expect(r.cancellati).toBe(1)
    expect(rimossi).toEqual(['utente-2/foto.jpg'])
  })

  it('se la cancellazione fallisce lo dice, senza contarla come fatta', async () => {
    const { admin } = fintoStorage(
      { 'utente-1': [{ name: 'persa.jpg', created_at: vecchio }] },
      { removeError: 'permesso negato' },
    )
    const r = await riconcilia(admin, 'work-photos', new Set(), { provaSoltanto: false })
    expect(r.errore).toContain('permesso negato')
    expect(r.cancellati).toBe(0)
  })
})

describe('riferimenti — la lista di ciò che NON va cancellato', () => {
  function fintoDb(rows: unknown[] | null, error: unknown = null) {
    const q = {
      select: () => q,
      order: () => q,
      range: async () => ({ data: rows, error }),
    }
    return { from: () => q }
  }

  it('le foto: raccoglie i percorsi e scarta i vuoti', async () => {
    const admin = fintoDb([
      { id: '1', storage_path: 'u1/a.jpg' },
      { id: '2', storage_path: null },
      { id: '3', storage_path: 'u2/b.jpg' },
    ])
    const set = await riferimentiFoto(admin)
    expect(set).toEqual(new Set(['u1/a.jpg', 'u2/b.jpg']))
  })

  it('⚠️ se il database non risponde LANCIA, invece di restituire una lista vuota', async () => {
    // È il test che conta più di tutti: una lista vuota farebbe sembrare
    // orfano OGNI file dell'archivio, e il job li cancellerebbe tutti.
    const admin = fintoDb(null, { message: 'connessione persa' })
    await expect(riferimentiFoto(admin)).rejects.toThrow(/non leggibile/)
  })

  it('i logo: estrae il percorso dall\'URL REALE, cache-buster compreso', async () => {
    // ⚠️ uploadLogo salva SEMPRE `?v=timestamp` in coda all'URL. La prima
    // versione di questo test usava un URL senza query — un formato che in
    // produzione non esiste — e per questo era verde su un bug che avrebbe
    // fatto sembrare orfano OGNI logo in uso (trovato in revisione, 5 ago).
    const admin = fintoDb([
      { id: '1', logo_url: 'https://x.supabase.co/storage/v1/object/public/logos/ws-1/logo.png?v=1730000000000' },
      { id: '2', logo_url: null },
    ])
    const set = await riferimentiLogo(admin)
    expect(set).toEqual(new Set(['ws-1/logo.png']))
  })

  it('logoPathFromUrl: query, fragment e percent-encoding non sporcano il confronto', () => {
    expect(logoPathFromUrl('https://x.co/storage/v1/object/public/logos/ws/logo.png?v=123')).toBe('ws/logo.png')
    expect(logoPathFromUrl('https://x.co/storage/v1/object/public/logos/ws/logo.png#x')).toBe('ws/logo.png')
    // getPublicUrl percent-encoda i caratteri speciali: il nome nel bucket è quello decodificato
    expect(logoPathFromUrl('https://x.co/storage/v1/object/public/logos/ws/logo.p%20ng?v=1')).toBe('ws/logo.p ng')
    expect(logoPathFromUrl('https://x.co/altro/percorso.png')).toBeNull()
    expect(logoPathFromUrl(null)).toBeNull()
    // percent-encoding malformato: meglio il valore grezzo che perderlo
    expect(logoPathFromUrl('https://x.co/storage/v1/object/public/logos/ws/logo%.png')).toBe('ws/logo%.png')
  })

  it('⚠️ i logo: anche qui un errore LANCIA e non produce una lista vuota', async () => {
    const admin = fintoDb(null, { message: 'timeout' })
    await expect(riferimentiLogo(admin)).rejects.toThrow(/non leggibile/)
  })
})

describe('file alla radice del bucket', () => {
  it('un file senza cartella non viene mai visto né cancellato (direzione sicura)', async () => {
    // La radice viene filtrata a sole cartelle (id === null): un file lì è
    // invisibile al job. Non pulito, ma soprattutto MAI cancellato per errore.
    const { admin, rimossi } = fintoStorage({})
    // il finto storage non ha file in radice per costruzione: qui congeliamo
    // che con radice "vuota di cartelle" il job non tocca nulla
    const r = await riconcilia(admin, 'work-photos', new Set(), { provaSoltanto: false })
    expect(r.fileTotali).toBe(0)
    expect(rimossi).toEqual([])
  })
})

describe('il caso del logo con estensione diversa', () => {
  it('riconosce come orfano il vecchio logo.png quando in uso c\'è logo.jpg', async () => {
    // Nasce dall'uso normale: si ricarica lo stesso logo in un altro formato
    // e il percorso cambia (`{id}/logo.{ext}`), lasciando il precedente lì.
    const { admin, rimossi } = fintoStorage({
      'ws-1': [
        { name: 'logo.png', created_at: vecchio },
        { name: 'logo.jpg', created_at: vecchio },
      ],
    })
    const r = await riconcilia(admin, 'logos', new Set(['ws-1/logo.jpg']), { provaSoltanto: false })
    expect(r.cancellati).toBe(1)
    expect(rimossi).toEqual(['ws-1/logo.png'])
  })
})
