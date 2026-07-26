// ── fetchAllRows ──────────────────────────────────────────────────────────
// Scarica TUTTE le righe di una query paginando, invece di fidarsi di una
// singola chiamata.
//
// Perché serve (26 lug 2026): le API di Supabase applicano un tetto di righe
// per richiesta (impostazione "Max rows" del progetto, 1.000 di default). Una
// query senza paginazione oltre quel tetto restituisce le prime N righe
// SENZA alcun errore: il chiamante crede di avere tutto. Sui documenti
// fiscali (registro fatture, bilancio per il commercialista) significherebbe
// consegnare un registro incompleto senza accorgersene.
//
// Uso: si passa una FUNZIONE che costruisce la query, perché ogni pagina è
// una richiesta nuova con un intervallo diverso.
//
//   const { data, error } = await fetchAllRows((q) => q.range(...), () =>
//     db.from('documents').select('...').eq('workspace_id', id))
//
// Ordine STABILE obbligatorio: senza un `order` deterministico due pagine
// potrebbero ripetere o saltare righe. Per questo l'helper impone l'ordine
// per `id` se il chiamante non ne ha già uno.

const PAGE = 1000
const MAX_PAGES = 100 // 100.000 righe: oltre, qualcosa non va nel chiamante

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- builder PostgREST generico
type Builder = any

export async function fetchAllRows<T = unknown>(
  /** Costruisce la query da zero a ogni pagina (senza range/order finali). */
  makeQuery: () => Builder,
  /** Colonna per l'ordinamento stabile della paginazione (default: id). */
  orderColumn = 'id',
): Promise<{ data: T[] | null; error: unknown }> {
  const out: T[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE
    const { data, error } = await makeQuery()
      .order(orderColumn, { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) return { data: null, error }
    const rows = (data ?? []) as T[]
    out.push(...rows)
    // Pagina non piena → era l'ultima.
    if (rows.length < PAGE) return { data: out, error: null }
  }
  // Tetto di sicurezza raggiunto: meglio dirlo che restituire dati parziali
  // spacciandoli per completi.
  return { data: null, error: { message: 'Troppe righe da esportare', code: 'TOO_MANY_ROWS' } }
}
