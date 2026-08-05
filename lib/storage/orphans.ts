// ============================================================
// Riconciliazione dei file orfani negli archivi (server only).
//
// COS'È UN ORFANO: un file che sta nel bucket ma che nessuna riga del
// database nomina più. Non è raggiungibile da nessuna query — quindi nessuna
// cancellazione futura lo troverà mai, e resta lì per sempre. Sono foto di
// cantieri di clienti reali che continuiamo a conservare senza saperlo:
// dato personale in eccesso, e superficie d'attacco che cresce da sola.
//
// ── PERCHÉ NON C'È UNA TABELLA DI "CANDIDATI ALLA CANCELLAZIONE" ──────────
// Il disegno naturale sarebbe: trovo gli orfani, li metto in lista, li
// cancello dopo N giorni se nessuno li riaggancia. Non serve: lo storage di
// Supabase espone già `created_at` per ogni file, quindi **l'età del file è
// già la lista d'attesa**. Una tabella in più sarebbe una seconda verità da
// tenere allineata — e che a sua volta potrebbe andare fuori sincrono,
// chiedendo la propria riconciliazione. Meno pezzi, meno cose che si rompono.
//
// Il bisogno vero dietro la "lista" — *vedere cosa sto per cancellare prima
// di cancellarlo* — è coperto meglio dalla modalità di prova (sotto).
//
// ⚠️ MODALITÀ DI PROVA, ACCESA DI DEFAULT. Questo job cancella file in modo
// irreversibile: parte in sola lettura, conta e riferisce senza toccare
// nulla. Si accende con ORPHAN_CLEANUP_ENABLED=true, dopo aver guardato per
// qualche giro che i numeri siano quelli attesi.
//
// ⚠️ LA REGOLA PIÙ IMPORTANTE DI QUESTO FILE: se la lettura dal database
// fallisce, o è parziale, NON SI CANCELLA NULLA. Un elenco di riferimenti
// incompleto farebbe sembrare orfani dei file perfettamente collegati — e li
// cancellerebbe. È il modo in cui un lavoro di pulizia diventa la peggiore
// perdita di dati possibile, quindi qui si fallisce sempre in sicurezza.
// ============================================================

import { fetchAllRows } from '@/lib/supabase/fetch-all'

/** Un file più giovane di così non si tocca: è la finestra in cui una foto
 *  appena caricata attende ancora la riga che la collegherà (il caso più
 *  comune: chi carica le foto e poi compila il preventivo con calma). */
const GIORNI_DI_GRAZIA = 7

/** Tetto per esecuzione: se qualcosa va storto nella logica, il danno resta
 *  piccolo e visibile invece che totale. */
const MAX_CANCELLAZIONI = 200

export interface OrphanReport {
  bucket: string
  fileTotali: number
  riferimenti: number
  orfani: number
  orfaniMaturi: number      // orfani più vecchi dei giorni di grazia
  cancellati: number
  provaSoltanto: boolean
  errore?: string
}

interface StorageEntry {
  name: string
  id: string | null          // null = è una cartella, non un file
  created_at?: string | null
}

/** Elenca una cartella dell'archivio, seguendo la paginazione. */
async function listaCartella(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- admin client
  admin: any,
  bucket: string,
  prefix: string,
): Promise<StorageEntry[]> {
  const out: StorageEntry[] = []
  const PAGINA = 100
  // ⚠️ Tetto di pagine: ci fidiamo che l'archivio rispetti limit/offset, ma
  // se non lo facesse questo ciclo non finirebbe mai e il job resterebbe
  // appeso. 200 pagine = 20.000 file per cartella, molto oltre il reale.
  const MAX_PAGINE = 200
  for (let pagina = 0, offset = 0; pagina < MAX_PAGINE; pagina++, offset += PAGINA) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, {
      limit: PAGINA, offset, sortBy: { column: 'name', order: 'asc' },
    })
    if (error) throw new Error(`elenco di "${prefix || '/'}" non riuscito: ${error.message}`)
    const righe = (data ?? []) as StorageEntry[]
    out.push(...righe)
    if (righe.length < PAGINA) break
  }
  return out
}

/** Tutti i file dell'archivio, come percorsi completi `cartella/file`. */
async function tuttiIFile(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- admin client
  admin: any,
  bucket: string,
): Promise<Array<{ path: string; createdAt: number }>> {
  const radice = await listaCartella(admin, bucket, '')
  const cartelle = radice.filter((e) => e.id === null).map((e) => e.name)
  const files: Array<{ path: string; createdAt: number }> = []
  for (const cartella of cartelle) {
    for (const f of await listaCartella(admin, bucket, cartella)) {
      if (f.id === null) continue // sottocartella: non le usiamo
      files.push({
        path: `${cartella}/${f.name}`,
        // Senza data ci comportiamo come se il file fosse appena nato: nel
        // dubbio non si cancella.
        createdAt: f.created_at ? new Date(f.created_at).getTime() : Date.now(),
      })
    }
  }
  return files
}

/**
 * Riconcilia un archivio con i percorsi che il database dichiara di usare.
 *
 * @param riferimenti percorsi realmente collegati a una riga. DEVE essere
 *        completo: se è parziale, tutto ciò che manca sembra orfano.
 */
export async function riconcilia(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- admin client
  admin: any,
  bucket: string,
  riferimenti: Set<string>,
  opts: { provaSoltanto: boolean },
): Promise<OrphanReport> {
  const base: OrphanReport = {
    bucket, fileTotali: 0, riferimenti: riferimenti.size,
    orfani: 0, orfaniMaturi: 0, cancellati: 0, provaSoltanto: opts.provaSoltanto,
  }

  let files: Array<{ path: string; createdAt: number }>
  try {
    files = await tuttiIFile(admin, bucket)
  } catch (err) {
    return { ...base, errore: err instanceof Error ? err.message : String(err) }
  }
  base.fileTotali = files.length

  const soglia = Date.now() - GIORNI_DI_GRAZIA * 24 * 60 * 60 * 1000
  const orfani = files.filter((f) => !riferimenti.has(f.path))
  const maturi = orfani.filter((f) => f.createdAt < soglia)
  base.orfani = orfani.length
  base.orfaniMaturi = maturi.length

  if (opts.provaSoltanto || maturi.length === 0) return base

  const daCancellare = maturi.slice(0, MAX_CANCELLAZIONI).map((f) => f.path)
  const { error } = await admin.storage.from(bucket).remove(daCancellare)
  if (error) return { ...base, errore: `cancellazione non riuscita: ${error.message}` }
  base.cancellati = daCancellare.length
  return base
}

/**
 * Percorsi delle foto realmente collegate a una riga.
 * ⚠️ `fetchAllRows` e non una select semplice: con il tetto di righe dell'API
 * un archivio grande restituirebbe solo le prime mille foto, e TUTTE le altre
 * risulterebbero orfane. Sarebbe la cancellazione di massa delle foto dei
 * clienti, fatta da un lavoro di manutenzione.
 */
export async function riferimentiFoto(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- admin client
  admin: any,
): Promise<Set<string>> {
  const { data, error } = await fetchAllRows<{ storage_path: string | null }>(
    () => admin.from('work_photos').select('id, storage_path'),
  )
  if (error || !data) throw new Error('elenco delle foto non leggibile: nessuna cancellazione')
  return new Set(data.map((r) => r.storage_path).filter((p): p is string => !!p))
}

/**
 * Percorsi dei logo in uso, ricavati da `workspaces.logo_url`.
 * ⚠️ Un workspace può avere PIÙ file logo: il percorso include l'estensione
 * del file caricato (`{id}/logo.png`), quindi ricaricare lo stesso logo in
 * un formato diverso lascia il precedente nell'archivio per sempre — e la
 * cancellazione dell'account rimuove solo quello in uso. È la sorgente di
 * orfani più subdola, perché non nasce da un errore: nasce dall'uso normale.
 */
export async function riferimentiLogo(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- admin client
  admin: any,
): Promise<Set<string>> {
  const { data, error } = await fetchAllRows<{ logo_url: string | null }>(
    () => admin.from('workspaces').select('id, logo_url'),
  )
  if (error || !data) throw new Error('elenco dei workspace non leggibile: nessuna cancellazione')
  const out = new Set<string>()
  for (const r of data) {
    if (!r.logo_url) continue
    const i = r.logo_url.indexOf('/logos/')
    if (i !== -1) out.add(r.logo_url.slice(i + '/logos/'.length))
  }
  return out
}
