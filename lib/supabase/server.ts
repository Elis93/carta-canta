import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch (error) {
            // Inghiotti solo l'errore atteso nei Server Component (read-only).
            // Qualsiasi altra eccezione viene rilanciata perché è un vero errore.
            if (
              !(error instanceof Error) ||
              !error.message.includes('Cookies can only be modified')
            ) {
              throw error
            }
          }
        },
      },
    }
  )
}
