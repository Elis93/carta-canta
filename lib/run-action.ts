'use client'

// ── runAction ─────────────────────────────────────────────────────────────
// Rete di sicurezza attorno a OGNI chiamata a una Server Action dal client.
//
// PERCHÉ (26 lug 2026): senza connessione una Server Action non ritorna
// `{ error }` — **lancia**. Il risultato, in cantiere con poco campo, è che
// il bottone resta bloccato su "Salvataggio…" per sempre (se il codice
// chiamante fa `setLoading(false)` dopo l'await) oppure che salta fuori la
// pagina di errore a schermo intero, portandosi via quello che l'artigiano
// aveva appena scritto.
//
// runAction trasforma quel lancio in un normalissimo `{ error: '…' }`, cioè
// esattamente la forma che tutti i call site già sanno gestire. Uso:
//
//   const result = await runAction(() => saveLavoroAction(fd), 'salvare il lavoro')
//   if (result?.error) { setError(result.error); return }
//
// ⚠️ DUE cose che questo file deve fare e che è facile dimenticare:
//
//  1. Gli errori di CONTROLLO di Next.js (redirect, notFound, …) viaggiano
//     come eccezioni con un `digest` che inizia per NEXT_: vanno RILANCIATI,
//     altrimenti si rompono le navigazioni (es. il checkout Stripe).
//  2. Lo stesso lancio arriva anche da un errore VERO del server, non solo
//     dalla rete. Prima di runAction quell'eccezione finiva all'error
//     boundary e quindi a Sentry; ora la intercettiamo noi, quindi va
//     segnalata a mano — senza, i bug del server diventerebbero invisibili.

import { networkErrorMessage } from '@/lib/net-error'

function isNextControlFlow(err: unknown): boolean {
  const digest = (err as { digest?: unknown } | null)?.digest
  return typeof digest === 'string' && digest.startsWith('NEXT_')
}

/**
 * Segnala l'errore per la diagnosi, senza mai far fallire il call site.
 * Import dinamico: se Sentry non è configurato (DSN vuoto) `captureException`
 * è un no-op, e qui non vogliamo dipendenze statiche in un modulo importato
 * da mezza app.
 */
function report(err: unknown, operazione: string): void {
  console.warn('[runAction] chiamata non riuscita:', operazione, err)
  // Offline: è la condizione attesa, non un bug da segnalare.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return
  void import('@sentry/nextjs')
    .then((Sentry) => {
      Sentry.captureException(err, { tags: { origine: 'server-action' }, extra: { operazione } })
    })
    .catch(() => { /* Sentry assente o non caricabile: pazienza */ })
}

/**
 * @param call     la chiamata alla Server Action, avvolta in una funzione
 * @param operazione verbo all'infinito + complemento: "salvare il preventivo",
 *                   "eliminare la voce", "inviare il sollecito".
 *                   Finisce in un messaggio in italiano per l'utente.
 */
export async function runAction<T>(call: () => Promise<T>, operazione: string): Promise<T> {
  try {
    return await call()
  } catch (err) {
    if (isNextControlFlow(err)) throw err
    report(err, operazione)
    // Il cast è voluto e vale per tutte le Server Action del repo: ritornano
    // sempre una forma con `error?: string`, che è ciò che i call site
    // controllano per primo.
    return { error: networkErrorMessage(operazione) } as T
  }
}

/**
 * Variante per le Server Action che non ritornano un risultato utile —
 * tipicamente quelle che finiscono con un `redirect()` (checkout Stripe,
 * apertura di un template…). TypeScript le vede come `Promise<never>`,
 * quindi non si può leggere `.error` sul valore di ritorno.
 *
 * @returns il messaggio da mostrare all'utente, oppure `null` se è andata.
 */
export async function runActionVoid(
  call: () => Promise<unknown>,
  operazione: string,
): Promise<string | null> {
  try {
    await call()
    return null
  } catch (err) {
    if (isNextControlFlow(err)) throw err
    report(err, operazione)
    return networkErrorMessage(operazione)
  }
}
