'use server'

// Segnalazione recensioni (notice-and-takedown — mockup crescita §2).
// La recensione resta visibile con l'etichetta "in verifica".

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const REASONS = new Set(['non_mio_lavoro', 'anomala', 'altro'])

export async function reportReviewAction(
  reviewId: string,
  reason: string,
  note: string
): Promise<{ error?: string; success?: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }
  if (!REASONS.has(reason)) return { error: 'Scegli un motivo.' }

  // RLS: l'update passa solo se la recensione è del workspace dell'utente
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 042 non ancora in types/database.ts
  const { error } = await (supabase as any)
    .from('reviews')
    .update({
      reported_at: new Date().toISOString(),
      report_reason: `${reason}${note.trim() ? `: ${note.trim().slice(0, 500)}` : ''}`,
    })
    .eq('id', reviewId)

  if (error) return { error: 'Segnalazione non riuscita. Riprova.' }
  revalidatePath('/recensioni')
  return { success: 'Segnalazione inviata' }
}
