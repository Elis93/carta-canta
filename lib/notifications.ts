// ============================================================
// Notifiche in Home (campanella) — calcolate dai dati esistenti.
// Nessun sistema push: la lista si ricava dai documenti; lo stato di
// lettura sta in notification_reads (migration 040, tollerante).
//
// Tipi attivi oggi:
//  - 'viewed'  → preventivo visto dal cliente (in attesa di risposta)
//  - 'acconto' → acconto richiesto ma non ancora ricevuto (preventivo accettato)
// I tipi SDI (pagate non trasmesse, scarti) arrivano col blocco SDI.
// Ogni tipo è disattivabile da Impostazioni → Notifiche (notification_prefs).
// ============================================================

import type { createClient } from '@/lib/supabase/server'

type ServerClient = Awaited<ReturnType<typeof createClient>>

export interface AppNotification {
  key: string
  type: 'viewed' | 'acconto'
  title: string
  body: string
  when: string | null
  href: string
  read: boolean
}

function clientDisplayName(c: { name: string | null; surname: string | null } | null): string {
  if (!c) return 'il cliente'
  return [c.name, c.surname].filter(Boolean).join(' ') || 'il cliente'
}

export async function getAppNotifications(
  supabase: ServerClient,
  workspaceId: string,
  prefs: Record<string, unknown> | null
): Promise<AppNotification[]> {
  const showViewed = prefs?.inapp_visto !== false
  const showAcconto = prefs?.inapp_acconto !== false

  const notifications: AppNotification[] = []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne/tabelle 038-040 non ancora in types/database.ts
  const db = supabase as any

  const [viewedRes, accontoRes, readsRes] = await Promise.all([
    showViewed
      ? supabase
          .from('documents')
          .select('id, doc_number, doc_type, updated_at, clients ( name, surname )')
          .eq('workspace_id', workspaceId)
          .eq('status', 'viewed')
          .is('deleted_at', null)
          .order('updated_at', { ascending: false })
          .limit(20)
      : Promise.resolve({ data: null }),
    showAcconto
      ? (async () => {
          try {
            return await db
              .from('documents')
              .select('id, doc_number, doc_type, accepted_at, total, deposit_type, deposit_value, payment_status, clients ( name, surname )')
              .eq('workspace_id', workspaceId)
              .eq('doc_type', 'preventivo')
              .eq('status', 'accepted')
              .is('deleted_at', null)
              .not('deposit_type', 'is', null)
              .order('accepted_at', { ascending: false })
              .limit(20)
          } catch {
            return { data: null }
          }
        })()
      : Promise.resolve({ data: null }),
    (async () => {
      try {
        return await db
          .from('notification_reads')
          .select('notif_key')
          .eq('workspace_id', workspaceId)
      } catch {
        return { data: null }
      }
    })(),
  ])

  const readKeys = new Set<string>(
    ((readsRes?.data ?? []) as Array<{ notif_key: string }>).map((r) => r.notif_key)
  )

  // ── Preventivi visti dal cliente ──────────────────────────────────────
  for (const doc of (viewedRes?.data ?? []) as Array<{
    id: string
    doc_number: string | null
    doc_type: string
    updated_at: string | null
    clients: { name: string | null; surname: string | null } | null
  }>) {
    if (doc.doc_type !== 'preventivo') continue
    const key = `viewed:${doc.id}`
    const num = doc.doc_number ? doc.doc_number.replace(/^[A-Za-z]+/, '') : null
    notifications.push({
      key,
      type: 'viewed',
      title: `Preventivo ${num ?? ''} visto dal cliente`.replace('  ', ' '),
      body: `${clientDisplayName(doc.clients)} ha aperto il preventivo.`,
      when: doc.updated_at,
      href: `/preventivi/${doc.id}`,
      read: readKeys.has(key),
    })
  }

  // ── Acconti in attesa ─────────────────────────────────────────────────
  const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
  for (const doc of (accontoRes?.data ?? []) as Array<{
    id: string
    doc_number: string | null
    accepted_at: string | null
    total: number | null
    deposit_type: string | null
    deposit_value: number | null
    payment_status: string | null
    clients: { name: string | null; surname: string | null } | null
  }>) {
    if (doc.payment_status === 'partial' || doc.payment_status === 'paid') continue
    const total = Number(doc.total ?? 0)
    const v = Number(doc.deposit_value)
    if (total <= 0 || !Number.isFinite(v) || v <= 0) continue
    const acconto = doc.deposit_type === 'percent'
      ? round2((total * Math.min(v, 100)) / 100)
      : round2(Math.min(v, total))
    if (acconto <= 0) continue
    const key = `acconto:${doc.id}`
    const num = doc.doc_number ? doc.doc_number.replace(/^[A-Za-z]+/, '') : null
    notifications.push({
      key,
      type: 'acconto',
      title: 'Acconto in attesa',
      body: `Preventivo ${num ?? ''} (${clientDisplayName(doc.clients)}): acconto € ${acconto.toLocaleString('it-IT', { minimumFractionDigits: 2 })} non ancora ricevuto.`.replace('  ', ' '),
      when: doc.accepted_at,
      href: `/preventivi/${doc.id}`,
      read: readKeys.has(key),
    })
  }

  notifications.sort((a, b) => new Date(b.when ?? 0).getTime() - new Date(a.when ?? 0).getTime())
  return notifications
}
