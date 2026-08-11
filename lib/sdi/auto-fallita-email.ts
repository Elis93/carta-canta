// ============================================================
// Email "la trasmissione automatica non è riuscita" (review 11 ago).
// Il pilota SdI che molla la presa in silenzio è ESATTAMENTE il
// fallimento silenzioso che questa funzione esiste per evitare
// (lamentela n.1 sugli altri gestionali): quando il cron rimanda una
// fattura al giro manuale, l'artigiano lo deve sapere SUBITO, non al
// promemoria dei 12 giorni una settimana dopo. Best-effort: un
// fallimento qui non blocca il cron.
// ============================================================

import { createElement } from 'react'
import { sendEmail } from '@/lib/email/send'
import { SdiAutoFallitaEmail } from '@/lib/email/templates/sdi_auto_fallita'
import { stripPrefissoLegacy } from '@/lib/utils'

export async function sendSdiAutoFallitaEmail(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- admin client (auth.admin)
  admin: any,
  ownerId: string,
  documentId: string,
  motivo: string | null,
): Promise<void> {
  try {
    const { data: ownerData } = await admin.auth.admin.getUserById(ownerId)
    const ownerEmail = ownerData?.user?.email
    if (!ownerEmail) return
    const { data: doc } = await admin
      .from('documents')
      .select('doc_number')
      .eq('id', documentId)
      .maybeSingle()
    const numClean = stripPrefissoLegacy(String(doc?.doc_number ?? '')) || 'senza numero'
    await sendEmail({
      to: ownerEmail,
      subject: `Fattura ${numClean}: la trasmissione automatica non è riuscita — trasmettila tu`,
      react: createElement(SdiAutoFallitaEmail, {
        docNumber: numClean,
        motivo,
        appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'https://cartacanta.app',
        documentId,
      }),
    })
  } catch (err) {
    console.warn('[sdi-auto] email pilota fallito non recapitata (non bloccante):', err)
  }
}
