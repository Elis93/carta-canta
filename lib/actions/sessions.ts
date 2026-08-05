'use server'

// ============================================================
// Chiusura di TUTTE le sessioni dell'utente ("esci da tutti i dispositivi").
//
// Cambiare la password non revoca le sessioni già aperte: chi è dentro resta
// dentro. Questo è il pulsante che chiude davvero la porta — best practice
// standard per i servizi che custodiscono dati e coordinate di pagamento.
// ============================================================

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function signOutEverywhereAction(): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // scope 'global': invalida i refresh token di OGNI dispositivo, non solo di
  // questo browser. La sessione corrente cade con le altre, ed è voluto.
  const { error } = await supabase.auth.signOut({ scope: 'global' })
  if (error) {
    console.error('[sessions] signOut globale fallito:', error)
    return { error: 'Non è stato possibile chiudere le sessioni: riprova tra qualche secondo.' }
  }

  redirect('/login?uscito=1')
}
