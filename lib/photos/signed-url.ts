// ============================================================
// URL firmate a scadenza per le foto dei lavori.
//
// PERCHÉ: fino al 5 ago 2026 il bucket `work-photos` era PUBBLICO e le foto
// erano protette solo dall'indirizzo casuale (`{user_id}/{uuid}.jpg`). Non
// enumerabile, ma permanente: un indirizzo inoltrato o finito in una
// cronologia restava valido per sempre. La pratica standard è l'opposto —
// bucket privato e link che scadono — ed è quello che facciamo qui.
//
// Le pagine che mostrano foto sono già autorizzate a monte (token del
// documento, sessione dell'artigiano): qui si firma soltanto, non si decide
// chi può vedere cosa.
// ============================================================

/** Un'ora: la pagina viene comunque ricaricata a ogni visita, e un PDF si
 *  stampa subito dopo l'apertura. Più lunga non servirebbe a nessuno. */
export const PHOTO_URL_TTL = 3600

/**
 * Firma più percorsi in una sola chiamata e restituisce una mappa
 * percorso → URL. I percorsi che falliscono non compaiono nella mappa:
 * il chiamante decide se saltare la foto o mostrare un segnaposto.
 */
export async function signPhotoPaths(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- vale sia per l'admin client sia per quello di sessione
  client: any,
  paths: string[],
  expiresIn: number = PHOTO_URL_TTL,
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const unici = [...new Set(paths.filter(Boolean))]
  if (unici.length === 0) return out
  try {
    const { data, error } = await client.storage.from('work-photos').createSignedUrls(unici, expiresIn)
    if (error || !Array.isArray(data)) {
      console.warn('[photos] firma URL fallita:', error)
      return out
    }
    for (const row of data as Array<{ path?: string | null; signedUrl?: string | null }>) {
      if (row?.path && row?.signedUrl) out.set(row.path, row.signedUrl)
    }
  } catch (err) {
    console.warn('[photos] firma URL non riuscita:', err)
  }
  return out
}
