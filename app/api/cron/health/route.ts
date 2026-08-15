// GET /api/cron/health
// Guardiano dei cron: legge l'ultimo battito di ciascun lavoro automatico e,
// se qualcuno è fermo da troppo tempo, avvisa l'operatore via email.
// Protetto da CRON_SECRET (fail-closed). Vedi lib/cron/heartbeat.ts per il
// disegno e il limite («chi controlla il controllore»).

import { NextRequest, NextResponse } from 'next/server'
import { createElement } from 'react'
import { sendEmail } from '@/lib/email/send'
import { CronAlertEmail } from '@/lib/email/templates/cron_alert'
import { checkStaleCrons, recordCronRun, OPERATOR_EMAIL } from '@/lib/cron/heartbeat'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '')
  // Fail-CLOSED: senza CRON_SECRET l'endpoint resta chiuso (undefined === undefined
  // passerebbe, e chiunque potrebbe far partire il guardiano e le sue email).
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  const stale = await checkStaleCrons(Date.now())

  if (stale.length > 0) {
    // Best-effort: se l'email non parte, l'esito resta comunque nella risposta
    // e nei log. Non blocca né ritenta (un guasto email non è il problema).
    const res = await sendEmail({
      to: OPERATOR_EMAIL,
      subject: `Carta Canta — ${stale.length} cron fermo${stale.length === 1 ? '' : 'i'}`,
      react: createElement(CronAlertEmail, { stale }),
    })
    if (!res.success) console.error('[cron/health] avviso non inviato:', res.error)
  }

  // Il guardiano registra il proprio battito, ma NON sorveglia sé stesso
  // (non è in CRON_JOBS): è il limite dichiarato in heartbeat.ts.
  await recordCronRun('health', { stale: stale.length })

  return NextResponse.json({ ok: true, stale: stale.map((s) => s.name) })
}
