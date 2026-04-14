import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Admin client con service_role key — SOLO server-side
// Non importare mai questo file in componenti client o pagine pubbliche
if (typeof window !== 'undefined') {
  throw new Error('lib/supabase/admin.ts non può essere importato lato client')
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sono obbligatori')
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
