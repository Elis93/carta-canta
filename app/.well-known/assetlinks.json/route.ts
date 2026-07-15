// ============================================================
// /.well-known/assetlinks.json — Digital Asset Links per la TWA
// del Play Store: dice ad Android che l'app impacchettata è
// "proprietaria" di cartacanta.app (niente barra URL nell'app).
//
// ⚙️ CONFIGURAZIONE (nessun deploy di codice necessario):
//   Su Vercel impostare TWA_SHA256_FINGERPRINT con il fingerprint
//   SHA-256 del certificato di firma (dalla Play Console → App
//   integrity, o da PWABuilder). Più fingerprint separati da virgola
//   (es. chiave upload + chiave di firma Google). Facoltativo:
//   TWA_PACKAGE_NAME (default app.cartacanta.twa — deve combaciare
//   col package scelto quando si impacchetta la TWA).
//
// Finché la variabile non è impostata risponde 404: innocuo.
// ============================================================

export const dynamic = 'force-dynamic'

export async function GET() {
  const raw = process.env.TWA_SHA256_FINGERPRINT?.trim()
  if (!raw) return new Response('Not configured', { status: 404 })

  const fingerprints = raw
    .split(',')
    .map((f) => f.trim().toUpperCase())
    .filter(Boolean)

  const packageName = process.env.TWA_PACKAGE_NAME?.trim() || 'app.cartacanta.twa'

  return Response.json(
    [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: packageName,
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ],
    {
      headers: {
        // I crawler di Google la rileggono comunque; 1h di cache basta
        'Cache-Control': 'public, max-age=3600',
      },
    }
  )
}
