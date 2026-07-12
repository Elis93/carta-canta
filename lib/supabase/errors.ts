// ============================================================
// Riconoscimento errori Supabase/PostgREST per i retry "tolleranti
// pre-migration": un retry senza la colonna nuova è legittimo SOLO se
// l'errore è davvero "colonna inesistente" — altrimenti (FK violata,
// RLS, constraint) il retry maschererebbe un errore reale salvando
// dati incompleti in silenzio.
// - 42703  = undefined_column (PostgreSQL)
// - PGRST204 = colonna non trovata nello schema cache (PostgREST)
// ============================================================

export function isMissingColumnError(
  e: { code?: string; message?: string } | null | undefined
): boolean {
  if (!e) return false
  if (e.code === '42703' || e.code === 'PGRST204') return true
  return /column .* does not exist|schema cache/i.test(e.message ?? '')
}
