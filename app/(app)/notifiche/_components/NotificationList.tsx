'use client'

// Lista notifiche (campanella) — pallino blu finché non tocchi QUELLA
// notifica (decisione Eli). Icone a contorno: sfondo pieno solo per gli stati.

import { useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Eye, Banknote, AlertTriangle, Receipt, BellRing } from 'lucide-react'
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
  richiamo:           { icon: <BellRing size={15} />,      border: '#cfe8da', color: '#2f8a63' },
  sdi_scartata:       { icon: <AlertTriangle size={15} />, border: '#ecc9c9', color: '#b05656' },
  sdi_da_trasmettere: { icon: <Receipt size={15} />,       border: '#e8d6ad', color: '#b0863e' },
}

export function NotificationList({ notifications }: { notifications: AppNotification[] }) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  // La navigazione è affidata a un <Link> NATIVO (naviga sempre, come
  // qualsiasi link); qui si registra solo la lettura, in background e
  // SENZA revalidate — la revalidation concorrente interrompeva la
  // navigazione in corso e il tocco sembrava non fare nulla.
  function markRead(n: AppNotification) {
    if (n.read) return
    void markNotificationsReadAction([n.key], { revalidate: false })
  }

  function markAll() {
    const unread = notifications.filter((n) => !n.read).map((n) => n.key)
    if (unread.length === 0) return
    startTransition(async () => {
      // 18 lug (Eli: "non succede nulla"): prima QUALSIASI fallimento era
      // invisibile — l'{error} dell'action veniva ignorato e un'app rimasta
      // aperta su una build vecchia (server action non più esistente) faceva
      // fallire la chiamata in silenzio. Ora l'errore si vede sempre e nel
      // caso "build vecchia" l'app si ricarica da sola.
      try {
        const res = await markNotificationsReadAction(unread)
        if (res?.error) {
          toast.error(res.error)
          return
        }
        router.refresh()
      } catch {
        // Offline (in cantiere capita): ricaricare servirebbe solo a perdere
        // la lista — meglio dire di riprovare. Il reload resta per il caso
        // "build vecchia" (server action non più esistente).
        if (!navigator.onLine) {
          toast.error('Sei offline: riprova quando torni in linea.')
          return
        }
        toast.info("L'app si sta aggiornando alla versione nuova…", { duration: 4000 })
        setTimeout(() => window.location.reload(), 1200)
      }
    })
  }

  if (notifications.length === 0) {
    return (
      <div style={{ margin: '14px 15px 0', background: '#fff', borderRadius: 14, boxShadow: SH, padding: '28px 15px', textAlign: 'center' }}>
        <p style={{ fontWeight: 600, color: '#161616', fontSize: 14 }}>Nessun avviso</p>
        <p style={{ fontSize: 13, color: '#55534b', marginTop: 4 }}>Quando succede qualcosa che merita la tua attenzione, lo trovi qui.</p>
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
            <Link
              key={n.key}
              href={n.href}
              onClick={() => markRead(n)}
              style={{
                display: 'flex', gap: 10, width: '100%', textAlign: 'left', padding: '12px 0',
                textDecoration: 'none', color: 'inherit', fontFamily: 'inherit',
                borderBottom: idx < notifications.length - 1 ? '0.5px solid #eee' : 'none',
                opacity: n.read ? 0.55 : 1,
              }}
            >
              <span style={{ width: 32, height: 32, borderRadius: '50%', border: `1px solid ${t.border}`, color: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {t.icon}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#161616', lineHeight: 1.35 }}>{n.title}</span>
                <span style={{ display: 'block', fontSize: 12, color: '#767676', marginTop: 2, lineHeight: 1.4 }}>{n.body}</span>
                <span style={{ display: 'block', fontSize: 12, color: '#767676', marginTop: 3 }}>
                  {timeAgo(n.when)}{n.read ? ' · letta' : ''}
                </span>
              </span>
              {!n.read && (
                <span aria-label="Non letta" style={{ width: 8, height: 8, borderRadius: '50%', background: '#3f6fb0', flexShrink: 0, marginTop: 5 }} />
              )}
            </Link>
          )
        })}
      </div>
    </>
  )
}
