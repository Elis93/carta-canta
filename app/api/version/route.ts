// Versione della build in produzione (commit sha di Vercel).
// Usata da VersionGuard: la PWA tenuta aperta per giorni gira con JS vecchio
// e le server action della build nuova non rispondono più ("il tocco non fa
// nulla") — al rientro in app si confronta la versione e si ricarica.
export const dynamic = 'force-dynamic'

export function GET() {
  return Response.json(
    { v: process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev' },
    { headers: { 'cache-control': 'no-store' } }
  )
}
