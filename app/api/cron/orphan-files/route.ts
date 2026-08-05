// ============================================================
// GET /api/cron/orphan-files — riconciliazione mensile degli archivi.
// Protetto da CRON_SECRET (fail-closed se il segreto non è configurato).
//
// Cerca i file che nessuna riga del database nomina più e, passati i giorni
// di grazia, li cancella. Perché serva e come è disegnato: lib/storage/orphans.ts.
//
// ⚠️ PARTE IN SOLA LETTURA. Finché ORPHAN_CLEANUP_ENABLED non è 'true'
// riferisce soltanto quanti orfani ha trovato, senza cancellare niente. È
// deliberato: prima di dare a un lavoro automatico il permesso di cancellare
// file in modo irreversibile, vogliamo guardare per qualche giro che i numeri
// siano quelli che ci aspettiamo. Un job di pulizia con la logica sbagliata è
// il modo più rapido di perdere i dati dei clienti.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { riconcilia, riferimentiFoto, riferimentiLogo, type OrphanReport } from '@/lib/storage/orphans'
import { logSecurityEvent } from '@/lib/security/events'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  // Fail-closed: senza CRON_SECRET configurato non passa nessuno (lezione del
  // 24 lug: `undefined === undefined` faceva entrare chiunque).
  const secret = request.nextUrl.searchParams.get('secret')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  const provaSoltanto = process.env.ORPHAN_CLEANUP_ENABLED !== 'true'
  const admin = createAdminClient()
  const report: OrphanReport[] = []

  for (const [bucket, leggiRiferimenti] of [
    ['work-photos', riferimentiFoto],
    ['logos', riferimentiLogo],
  ] as const) {
    try {
      // ⚠️ Se questa lettura fallisce si esce SUBITO per questo archivio: un
      // elenco di riferimenti incompleto farebbe sembrare orfani dei file
      // collegatissimi.
      const riferimenti = await leggiRiferimenti(admin)
      report.push(await riconcilia(admin, bucket, riferimenti, { provaSoltanto }))
    } catch (err) {
      const errore = err instanceof Error ? err.message : String(err)
      console.error(`[cron/orphan-files] ${bucket}: ${errore}`)
      report.push({
        bucket, fileTotali: 0, riferimenti: 0, orfani: 0, orfaniMaturi: 0,
        cancellati: 0, provaSoltanto, errore,
      })
    }
  }

  // Nel registro solo numeri ed etichette (regola della 072). Si registra
  // anche quando non si cancella nulla: serve a vedere se il fenomeno cresce.
  for (const r of report) {
    await logSecurityEvent({
      kind: 'orphan_cleanup',
      meta: {
        bucket: r.bucket,
        file: r.fileTotali,
        orfani: r.orfani,
        maturi: r.orfaniMaturi,
        cancellati: r.cancellati,
        prova: r.provaSoltanto,
        errore: r.errore ? true : false,
      },
    })
  }

  console.log('[cron/orphan-files]', JSON.stringify(report))
  return NextResponse.json({ success: true, provaSoltanto, report })
}
