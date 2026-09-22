// ============================================================
// Email di avviso "fattura scartata dallo SdI" (decisione Eli).
// Condivisa tra il webhook e il pull "Controlla l'esito ora": lo
// scarto va comunicato via email in ENTRAMBI i percorsi (la
// campanella promette "Ti abbiamo mandato anche un'email" — review
// 23 lug B3). Best-effort: un fallimento qui non blocca nulla.
// ============================================================

import { createElement } from 'react'
import { sendEmail } from '@/lib/email/send'
import { SdiScartataEmail } from '@/lib/email/templates/sdi_scartata'
import { stripPrefissoLegacy } from '@/lib/utils'

export async function sendSdiScartataEmail(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- admin client (auth.admin)
  admin: any,
  workspaceId: string,
  documentId: string,
  docNumber: string | null,
  motivo: string | null,
): Promise<void> {
  try {
    const { data: ws } = await admin
      .from('workspaces')
      .select('owner_id')
      .eq('id', workspaceId)
      .maybeSingle()
    if (!ws?.owner_id) return
    const { data: ownerData } = await admin.auth.admin.getUserById(ws.owner_id)
    const ownerEmail = ownerData?.user?.email
    if (!ownerEmail) return
    // Fase 2 (scarto post-copia): se la copia è già in mano al cliente,
    // l'email lo dice — il cliente ha un documento che per l'Agenzia non è
    // mai esistito e dopo la correzione va aggiornato. Lettura best-effort:
    // un blip qui non ferma l'avviso di scarto, che è la cosa importante.
    const copiaCircolata: boolean = await admin
      .from('documents')
      .select('sent_at')
      .eq('id', documentId)
      .maybeSingle()
      .then(
        (r: { data: { sent_at?: string | null } | null }) => !!r.data?.sent_at,
        () => false,
      )
    const numClean = stripPrefissoLegacy(String(docNumber ?? ''))
    await sendEmail({
      to: ownerEmail,
      subject: `Fattura ${numClean} scartata dallo SdI — correggi e reinvia`,
      react: createElement(SdiScartataEmail, {
        docNumber: numClean,
        motivo,
        appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'https://cartacanta.app',
        documentId,
        copiaCircolata,
      }),
    })
  } catch (err) {
    console.warn('[sdi] email scarto fallita (non bloccante):', err)
  }
}
