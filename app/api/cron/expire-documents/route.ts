// GET /api/cron/expire-documents
// Chiamato dal cron Vercel ogni notte. Protetto da CRON_SECRET.
// Chiama la funzione Supabase expire_overdue_documents().

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data, error } = await admin.rpc('expire_overdue_documents')

  if (error) {
    console.error('[cron/expire] RPC error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log(`[cron/expire] Scaduti ${data} documenti`)
  return NextResponse.json({ success: true, expired: data })
}
