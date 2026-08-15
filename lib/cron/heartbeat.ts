// ============================================================
// Heartbeat dei cron — «se un lavoro automatico smette di girare, lo sappiamo».
//
// PERCHÉ (RISCHI 3.7): i cron sono silenziosi. Se `sdi-auto` o `expire-documents`
// smettessero di partire — un errore di deploy, una variabile mancante, un
// guasto di Vercel — nessuno se ne accorgerebbe finché un artigiano non si
// lamenta di una fattura non trasmessa. Un fallimento silenzioso su una cosa
// fiscale è il caso peggiore.
//
// COME, senza nuove tabelle: ogni cron, quando finisce bene, scrive un
// «battito» nel registro eventi (`security_events`, kind `cron_ok`). Un cron
// guardiano (`/api/cron/health`) legge l'ultimo battito di ciascuno e, se è
// più vecchio dell'intervallo previsto + margine, manda un'email a supporto@.
//
// ⚠️ LIMITE ONESTO (il «chi controlla il controllore»): se a fermarsi è il
// guardiano stesso, o l'intera piattaforma cron di Vercel, l'email non parte.
// Questo copre il caso comune (un singolo cron che muore), non un blackout
// totale — per quello restano il monitor di uptime e gli utenti. Documentato,
// non nascosto.
//
// Tollerante: finché la migration 071 (security_events) non è applicata il
// battito non si scrive (logSecurityEvent è best-effort) e il guardiano non
// trova nulla → non avvisa. In produzione la 071 è applicata dal 6 agosto.
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin'
import { logSecurityEvent } from '@/lib/security/events'

/** Dove arrivano gli avvisi: la casella dell'operatore (non un artigiano). */
export const OPERATOR_EMAIL = 'supporto@cartacanta.app'

/**
 * I cron sorvegliati e la loro «freschezza» massima = intervallo previsto +
 * margine per un giro saltato. Se l'ultimo battito è più vecchio, è fermo.
 * ⚠️ Il guardiano NON sorveglia sé stesso (vedi limite in testa al file).
 */
export const CRON_JOBS: { name: string; label: string; maxAgeHours: number }[] = [
  { name: 'sdi-auto',         label: 'Trasmissione automatica SdI (oraria)', maxAgeHours: 3 },
  { name: 'expire-documents', label: 'Scadenze e promemoria (giornaliera)',  maxAgeHours: 30 },
  { name: 'referral',         label: 'Premi invito (mensile)',               maxAgeHours: 24 * 33 },
  { name: 'orphan-files',     label: 'Pulizia file orfani (mensile)',        maxAgeHours: 24 * 33 },
]

/**
 * Registra il battito di un cron completato. Best-effort e non lancia MAI:
 * un errore qui non deve rompere il cron che sta finendo bene.
 * ⚠️ meta accetta solo scalari (vincolo 072): passare solo nomi/numeri.
 */
export async function recordCronRun(
  name: string,
  meta: Record<string, string | number | boolean | null> = {},
): Promise<void> {
  await logSecurityEvent({ kind: 'cron_ok', meta: { cron: name, ...meta } })
}

export interface StaleCron {
  name: string
  label: string
  lastOk: string | null
  ageHours: number | null
}

/**
 * Decisione pura di «fermo»: vero solo se un battito ESISTE ed è più vecchio
 * del consentito. `lastOk` null (mai battuto) → falso: è cold-start, non un
 * allarme. Estratta per poterla testare senza il database.
 */
export function isCronStale(lastOk: string | null, maxAgeHours: number, now: number): boolean {
  if (!lastOk) return false
  const t = new Date(lastOk).getTime()
  if (Number.isNaN(t)) return false // data illeggibile: non inventare un allarme
  return (now - t) / 3_600_000 > maxAgeHours
}

/**
 * I cron fermi: quelli il cui ultimo battito è più vecchio del consentito.
 * ⚠️ Se un cron non ha MAI battuto (`lastOk` null) NON viene segnalato: a
 * heartbeat appena introdotto è normale non avere ancora storico, e un falso
 * allarme al primo deploy farebbe perdere fiducia nell'avviso. Entro il primo
 * ciclo ogni cron scrive il suo battito e da lì la freschezza è verificabile.
 */
export async function checkStaleCrons(now: number): Promise<StaleCron[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- security_events non è in types/database.ts (071)
  const admin = createAdminClient() as any

  // Le 4 letture in PARALLELO: così il caso peggiore (DB irraggiungibile) resta
  // limitato al singolo timeout, non alla loro somma. ⚠️ Timeout difensivo: un
  // guardiano che si blocca è un controsenso; se il DB non risponde restiamo in
  // silenzio — un guasto al DB lo vede il monitor di uptime, non questo controllo.
  const rows = await Promise.all(
    CRON_JOBS.map((job) =>
      admin
        .from('security_events')
        .select('at')
        .eq('kind', 'cron_ok')
        .contains('meta', { cron: job.name })
        .order('at', { ascending: false })
        .limit(1)
        .abortSignal(AbortSignal.timeout(8_000))
        .maybeSingle(),
    ),
  )

  // Tabella assente (071 non applicata): heartbeat non attivo → non avvisare nulla.
  const tableMissing = rows.some(
    (r) => r.error && (r.error.code === '42P01' || r.error.code === 'PGRST205'),
  )
  if (tableMissing) return []

  const stale: StaleCron[] = []
  CRON_JOBS.forEach((job, i) => {
    const { data, error } = rows[i]
    if (error) return // blip di lettura / timeout: salta, non è un allarme
    const lastOk: string | null = data?.at ?? null
    if (isCronStale(lastOk, job.maxAgeHours, now)) {
      const ageHours = lastOk ? (now - new Date(lastOk).getTime()) / 3_600_000 : null
      stale.push({ name: job.name, label: job.label, lastOk, ageHours })
    }
  })
  return stale
}
