import { describe, it, expect, afterEach } from 'vitest'
import { sdiAmbiente } from '@/lib/sdi'

// Nasce da una segnalazione di Eli (9 ago): con la chiave SANDBOX di OpenAPI
// configurata la pillola «PROVA» spariva, perché guardava solo SE la chiave
// c'era e non DOVE puntava. Schermata identica a quella di produzione su un
// ambiente che all'Agenzia non arriva: chi trasmetteva credeva di aver emesso.

const KEY = 'OPENAPI_SDI_API_KEY'
const URL_ = 'OPENAPI_SDI_BASE_URL'
const originale = { key: process.env[KEY], url: process.env[URL_] }

function set(key: string | undefined, url: string | undefined) {
  if (key === undefined) delete process.env[KEY]
  else process.env[KEY] = key
  if (url === undefined) delete process.env[URL_]
  else process.env[URL_] = url
}

afterEach(() => set(originale.key, originale.url))

describe('sdiAmbiente — dove finisce davvero la fattura', () => {
  it('senza chiave: provider di prova', () => {
    set(undefined, undefined)
    expect(sdiAmbiente()).toBe('prova')
  })

  it('chiave + host di sandbox: COLLAUDO, non reale', () => {
    set('chiave-sandbox', 'https://test.sdi.openapi.it')
    expect(sdiAmbiente()).toBe('collaudo')
  })

  it('chiave sandbox SENZA indirizzo esplicito: resta collaudo (il default è la sandbox)', () => {
    set('chiave-sandbox', undefined)
    expect(sdiAmbiente()).toBe('collaudo')
  })

  it('chiave + host di produzione: reale', () => {
    set('chiave-vera', 'https://sdi.openapi.it')
    expect(sdiAmbiente()).toBe('reale')
  })

  it('l’indirizzo di produzione vale anche con percorso, porta o maiuscole', () => {
    for (const u of ['https://SDI.openapi.it/', 'https://sdi.openapi.it/v1', 'https://sdi.openapi.it:443']) {
      set('chiave-vera', u)
      expect(sdiAmbiente()).toBe('reale')
    }
  })

  it('un host SCONOSCIUTO non viene dichiarato reale', () => {
    set('chiave', 'https://qualcosa.example.com')
    expect(sdiAmbiente()).toBe('collaudo')
  })

  it('un indirizzo illeggibile non viene dichiarato reale', () => {
    set('chiave', 'non-un-indirizzo')
    expect(sdiAmbiente()).toBe('collaudo')
  })

  it('«test.sdi.openapi.it» NON deve passare per l’host di produzione', () => {
    set('chiave', 'https://test.sdi.openapi.it')
    expect(sdiAmbiente()).not.toBe('reale')
  })
})
