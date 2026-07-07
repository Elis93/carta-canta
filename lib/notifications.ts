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
  type: 'viewed' | 'acconto' | 'sdi_scartata' | 'sdi_da_trasmettere'
  title: string
  body: string
  when: string | null
  href: string
  read: boolean
}

const SDI_ENABLED = process.env.NEXT_PUBLIC_SDI_ENABLED === 'true'

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
  const showSdiScarto = SDI_ENABLED && prefs?.inapp_sdi_scarto !== false
  const showSdiPending = SDI_ENABLED && prefs?.inapp_sdi_trasmissione !== false

  const notifications: AppNotification[] = []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne/tabelle 038-044 non ancora in types/database.ts
  const db = supabase as any

  const [viewedRes, accontoRes, sdiRes, convertedRes, readsRes] = await Promise.all([
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
    // Fatture con esito/da trasmettere allo SDI (colonne 044 — tollerante)
    SDI_ENABLED && (showSdiScarto || showSdiPending)
      ? (async () => {
          try {
            return await db
              .from('documents')
              .select('id, doc_number, status, payment_status, sdi_status, sdi_error, sdi_updated_at, paid_at, accepted_at')
              .eq('workspace_id', workspaceId)
              .eq('doc_type', 'fattura')
              .is('deleted_at', null)
              .or('sdi_status.eq.scartata,and(status.eq.accepted,sdi_status.is.null)')
              .limit(20)
          } catch {
            return { data: null }
          }
        })()
      : Promise.resolve({ data: null }),
    // Preventivi già convertiti: l'acconto vive sulla fattura, la notifica
    // sul preventivo sarebbe un doppione fuorviante
    (async () => {
      try {
        return await supabase
          .from('documents')
          .select('origin_document_id')
          .eq('workspace_id', workspaceId)
          .eq('doc_type', 'fattura')
          .not('origin_document_id', 'is', null)
          .is('deleted_at', null)
      } catch {
        return { data: null }
      }
    })(),
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
  const convertedIds = new Set<string>(
    ((convertedRes?.data ?? []) as Array<{ origin_document_id: string | null }>)
      .map((r) => r.origin_document_id)
      .filter((v): v is string => !!v)
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
    if (convertedIds.has(doc.id)) continue
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

  // ── SDI: scarti + fatture pagate non trasmesse (mockup notifiche) ─────
  for (const doc of (sdiRes?.data ?? []) as Array<{
    id: string
    doc_number: string | null
    status: string
    payment_status: string | null
    sdi_status: string | null
    sdi_error: string | null
    sdi_updated_at: string | null
    paid_at: string | null
    accepted_at: string | null
  }>) {
    const num = doc.doc_number ? doc.doc_number.replace(/^[A-Za-z]+/, '') : null
    if (doc.sdi_status === 'scartata' && showSdiScarto) {
      const key = `sdi_scarto:${doc.id}`
      notifications.push({
        key,
        type: 'sdi_scartata',
        title: `Fattura ${num ?? ''} scartata dallo SDI`.replace('  ', ' '),
        body: `${doc.sdi_error ?? 'Controlla i dati'}. Correggi e reinvia. Ti abbiamo mandato anche un'email.`,
        when: doc.sdi_updated_at,
        href: `/fatture/${doc.id}`,
        read: readKeys.has(key),
      })
    } else if (!doc.sdi_status && doc.status === 'accepted' && showSdiPending) {
      const key = `sdi_pending:${doc.id}`
      notifications.push({
        key,
        type: 'sdi_da_trasmettere',
        title: `Fattura ${num ?? ''} pagata ma non trasmessa allo SDI`.replace('  ', ' '),
        body: 'Tocca per trasmetterla al Sistema di Interscambio.',
        when: doc.paid_at ?? doc.accepted_at,
        href: `/fatture/${doc.id}`,
        read: readKeys.has(key),
      })
    }
  }

  notifications.sort((a, b) => new Date(b.when ?? 0).getTime() - new Date(a.when ?? 0).getTime())
  return notifications
}
