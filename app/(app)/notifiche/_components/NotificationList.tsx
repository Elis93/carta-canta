'use client'

// Lista notifiche (campanella) — pallino blu finché non tocchi QUELLA
// notifica (decisione Eli). Icone a contorno: sfondo pieno solo per gli stati.

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, Banknote, AlertTriangle, Receipt } from 'lucide-react'
import { markNotificationsReadAction } from '@/lib/actions/notifications'
import type { AppNotification } from '@/lib/notifications'

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 60) return mins <= 1 ? 'Adesso' : `${mins} minuti fa`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return hours === 1 ? '1 ora fa' : `${hours} ore fa`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Ieri'
  if (days < 7) return `${days} giorni fa`
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }).replace('.', '')
}

const TYPE_ICON: Record<AppNotification['type'], { icon: React.ReactNode; border: string; color: string }> = {
  viewed:             { icon: <Eye size={15} />,           border: '#e9c3d6', color: '#c25b91' },
  acconto:            { icon: <Banknote size={15} />,      border: '#e8d6ad', color: '#b0863e' },
  sdi_scartata:       { icon: <AlertTriangle size={15} />, border: '#ecc9c9', color: '#b05656' },
  sdi_da_trasmettere: { icon: <Receipt size={15} />,       border: '#e8d6ad', color: '#b0863e' },
}

export function NotificationList({ notifications }: { notifications: AppNotification[] }) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  function open(n: AppNotification) {
    startTransition(async () => {
      await markNotificationsReadAction([n.key])
      router.push(n.href)
    })
  }

  function markAll() {
    const unread = notifications.filter((n) => !n.read).map((n) => n.key)
    if (unread.length === 0) return
    startTransition(async () => {
      await markNotificationsReadAction(unread)
      router.refresh()
    })
  }

  if (notifications.length === 0) {
    return (
      <div style={{ margin: '14px 15px 0', background: '#fff', borderRadius: 14, boxShadow: SH, padding: '28px 15px', textAlign: 'center' }}>
        <p style={{ fontWeight: 600, color: '#161616', fontSize: 14 }}>Nessun avviso</p>
        <p style={{ fontSize: 13, color: '#8a887f', marginTop: 4 }}>Quando succede qualcosa che merita la tua attenzione, lo trovi qui.</p>
      </div>
    )
  }

  const hasUnread = notifications.some((n) => !n.read)

  return (
    <>
      {hasUnread && (
        <div style={{ margin: '12px 15px 0', textAlign: 'right' }}>
          <button
            type="button"
            onClick={markAll}
            style={{ background: 'none', border: 'none', padding: 4, fontSize: 12, fontWeight: 600, color: '#1a1a2e', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Segna tutte come lette
          </button>
        </div>
      )}

      <div style={{ margin: `${hasUnread ? 6 : 14}px 15px 0`, background: '#fff', borderRadius: 14, boxShadow: SH, padding: '2px 14px' }}>
        {notifications.map((n, idx) => {
          const t = TYPE_ICON[n.type]
          return (
            <button
              key={n.key}
              type="button"
              onClick={() => open(n)}
              style={{
                display: 'flex', gap: 10, width: '100%', textAlign: 'left', padding: '12px 0',
                background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                borderBottom: idx < notifications.length - 1 ? '0.5px solid #eee' : 'none',
                opacity: n.read ? 0.55 : 1,
              }}
            >
              <span style={{ width: 32, height: 32, borderRadius: '50%', border: `1px solid ${t.border}`, color: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {t.icon}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#161616', lineHeight: 1.35 }}>{n.title}</span>
                <span style={{ display: 'block', fontSize: 12, color: '#767676', marginTop: 2, lineHeight: 1.4 }}>{n.body}</span>
                <span style={{ display: 'block', fontSize: 11, color: '#a5a39b', marginTop: 3 }}>
                  {timeAgo(n.when)}{n.read ? ' · letta' : ''}
                </span>
              </span>
              {!n.read && (
                <span aria-label="Non letta" style={{ width: 8, height: 8, borderRadius: '50%', background: '#3f6fb0', flexShrink: 0, marginTop: 5 }} />
              )}
            </button>
          )
        })}
      </div>
    </>
  )
}
