// ── Rilevatore di errori "chunk vecchio" ────────────────────────────────────
//
// PERCHÉ (Eli 15 ago: "a volte quando esco e rientro esce «Qualcosa è andato
// storto»"): la PWA aperta ha in memoria i file JS di una build; se nel
// frattempo esce un nuovo deploy (qui si pubblica a ogni commit), quei file
// referenziano chunk che sul server nuovo NON esistono più → alla prima
// navigazione il caricamento del chunk fallisce (404, o l'HTML della pagina di
// errore servito al posto del JS → "not a valid JavaScript MIME type") e la
// pagina finisce sull'error boundary.
//
// VersionGuard prova a prevenirlo al rientro, ma ha delle maglie (controllo
// non più di ogni 5 min, reload automatico solo dopo 30 min in background):
// se si rientra in fretta, l'app resta vecchia e il chunk salta. Questo
// rilevatore serve all'error boundary per riconoscere quel caso e RICARICARE
// da solo — recuperare la versione nuova invece di mostrare un errore.

export function isChunkLoadError(err: unknown): boolean {
  const e = err as { name?: string; message?: string } | null
  const s = `${e?.name ?? ''} ${e?.message ?? ''}`
  return /ChunkLoadError|Loading chunk\b|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|not a valid JavaScript MIME type|Unexpected token '<'/i.test(s)
}

// Ricarica UNA volta sola: se dopo il reload l'errore si ripresenta subito
// (< finestra), NON è un chunk vecchio (che il reload avrebbe risolto) →
// meglio mostrare l'errore vero che entrare in un ciclo di ricariche.
const RELOAD_GUARD_KEY = 'cc_chunk_reload_at'
const RELOAD_GUARD_MS = 20_000

/** true se ha avviato la ricarica; false se un reload è appena avvenuto (loop). */
export function recoverFromChunkError(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || 0)
    if (Number.isFinite(last) && Date.now() - last < RELOAD_GUARD_MS) return false
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()))
  } catch { /* storage bloccato: si prova comunque a ricaricare una volta */ }
  window.location.reload()
  return true
}
