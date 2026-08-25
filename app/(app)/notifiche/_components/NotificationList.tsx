'use client'

// Lista notifiche (campanella) — pallino blu finché non tocchi QUELLA
// notifica (decisione Eli). Icone a contorno: sfondo pieno solo per gli stati.

import { useTransition, useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Eye, Banknote, AlertTriangle, Receipt, BellRing, MessageSquare, Clock, Tag } from 'lucide-react'
import { markNotificationsReadAction } from '@/lib/actions/notifications'
import { segnaLettaLocale, applicaLetteLocali } from '@/lib/notifiche-lette-locali'
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
  richiesta:          { icon: <MessageSquare size={15} />, border: '#c9d4ea', color: '#3f6fb0' },
  preventivo_fermo:   { icon: <Clock size={15} />,         border: '#ddd4ec', color: '#7b5cb8' },
  messaggio:          { icon: <MessageSquare size={15} />, border: '#d9cdf0', color: '#6a44b5' },
  sdi_scartata:       { icon: <AlertTriangle size={15} />, border: '#ecc9c9', color: '#b05656' },
  sdi_da_trasmettere: { icon: <Receipt size={15} />,       border: '#e8d6ad', color: '#b0863e' },
  listino_scaduto:    { icon: <Tag size={15} />,           border: '#f0d2b8', color: '#c06a2a' },
}

export function NotificationList({
  notifications,
  compact = false,
  onUnreadChange,
}: {
  notifications: AppNotification[]
  /** true = dentro il pannello della campanella: niente margini né card propria
      (la cornice la dà il pannello). false = pagina /notifiche, com'era. */
  compact?: boolean
  /** Avvisa il contenitore (la campanella) di quante non-lette restano, così
      il pallino rosso si aggiorna appena una notifica viene letta. */
  onUnreadChange?: (n: number) => void
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  // Stato LOCALE: senza revalidate (per non interrompere la navigazione) la
  // lista non si aggiornava e la notifica cliccata restava "attiva" al ritorno
  // in Home (feedback Eli 22 lug #16). Marcandola letta subito localmente,
  // diventa "letta" come le altre all'istante.
  const [items, setItems] = useState(notifications)
  // Le letture LOCALI (sessionStorage) si applicano dopo il mount, mai
  // nell'initializer: il componente è renderizzato anche sul server e un
  // valore diverso lì creerebbe un mismatch di idratazione.
  useEffect(() => { setItems(applicaLetteLocali(notifications)) }, [notifications])
  useEffect(() => { onUnreadChange?.(items.filter((x) => !x.read).length) }, [items, onUnreadChange])

  // La navigazione è affidata a un <Link> NATIVO (naviga sempre, come
  // qualsiasi link); qui si registra solo la lettura, in background e
  // SENZA revalidate — la revalidation concorrente interrompeva la
  // navigazione in corso e il tocco sembrava non fare nulla.
  function markRead(n: AppNotification) {
    if (n.read) return
    setItems((prev) => prev.map((x) => (x.key === n.key ? { ...x, read: true } : x)))
    // Rete contro la cache stantia (25 ago): la Home può tornare a schermo
    // PRIMA della revalidation — la campanella sottrae comunque questa chiave.
    segnaLettaLocale(n.key)
    // Fire-and-forget VOLUTO (la navigazione non deve aspettare), ma con il
    // .catch: senza rete la promise verrebbe rifiutata e resterebbe una
    // "unhandled rejection" (rumore in Sentry). Se fallisce, la notifica
    // resta da leggere e si ri-marca al prossimo tocco.
    void markNotificationsReadAction([n.key], { revalidate: false }).catch(() => {})
    // La campanella in Home restava col conteggio VECCHIO tornando indietro
    // (Eli 4 ago): la Home in cache non veniva invalidata (revalidate: false
    // è necessario — la revalidation concorrente uccideva la navigazione).
    // A navigazione ormai avvenuta, una seconda chiamata IDEMPOTENTE (stessa
    // chiave, upsert) fa la revalidation → al ritorno la Home è fresca.
    setTimeout(() => {
      void markNotificationsReadAction([n.key]).catch(() => {})
    }, 1500)
  }

  function markAll() {
    const unread = items.filter((n) => !n.read).map((n) => n.key)
    if (unread.length === 0) return
    // Snapshot per il RIPRISTINO: se il salvataggio fallisce (offline, errore
    // server) lo stato ottimistico va annullato — altrimenti tutte le notifiche
    // appaiono lette, il bottone "Segna tutte" sparisce e il toast dice
    // "riprova" senza che ci sia più nulla da premere (review 22 lug).
    const before = items
    setItems((prev) => prev.map((x) => ({ ...x, read: true })))
    segnaLettaLocale(...unread)
    startTransition(async () => {
      // 18 lug (Eli: "non succede nulla"): prima QUALSIASI fallimento era
      // invisibile — l'{error} dell'action veniva ignorato e un'app rimasta
      // aperta su una build vecchia (server action non più esistente) faceva
      // fallire la chiamata in silenzio. Ora l'errore si vede sempre e nel
      // caso "build vecchia" l'app si ricarica da sola.
      // ⚠️ ECCEZIONE alla regola runAction (26 lug): qui il lancio serve.
      // Questo punto distingue DUE guasti diversi — offline (si riprova) e
      // "app aperta su una build vecchia", dove la Server Action non esiste
      // più e l'unico rimedio è ricaricare. runAction li appiattirebbe
      // entrambi in un toast, e l'auto-aggiornamento (fix 18 lug, bug di Eli
      // "non succede nulla") non scatterebbe mai più.
      try {
        const res = await markNotificationsReadAction(unread)
        if (res?.error) {
          setItems(before)
          toast.error(res.error)
          return
        }
        router.refresh()
      } catch {
        // Offline (in cantiere capita): ricaricare servirebbe solo a perdere
        // la lista — meglio dire di riprovare. Il reload resta per il caso
        // "build vecchia" (server action non più esistente).
        if (!navigator.onLine) {
          setItems(before)
          toast.error('Sei offline: riprova quando torni in linea.')
          return
        }
        toast.info("L'app si sta aggiornando alla versione nuova…", { duration: 4000 })
        setTimeout(() => window.location.reload(), 1200)
      }
    })
  }

  if (items.length === 0) {
    return (
      <div style={{ margin: compact ? 0 : '14px 15px 0', background: '#fff', borderRadius: compact ? 0 : 14, boxShadow: compact ? 'none' : SH, padding: '28px 15px', textAlign: 'center' }}>
        <p style={{ fontWeight: 600, color: '#161616', fontSize: 14 }}>Nessun avviso</p>
        <p style={{ fontSize: 13, color: '#55534b', marginTop: 4 }}>Quando succede qualcosa che merita la tua attenzione, lo trovi qui.</p>
      </div>
    )
  }

  const hasUnread = items.some((n) => !n.read)

  return (
    <>
      {hasUnread && (
        <div style={{ margin: compact ? '8px 14px 0' : '12px 15px 0', textAlign: 'right' }}>
          <button
            type="button"
            onClick={markAll}
            style={{ background: 'none', border: 'none', padding: 4, fontSize: 12, fontWeight: 600, color: '#1a1a2e', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Segna tutte come lette
          </button>
        </div>
      )}

      <div style={{ margin: compact ? 0 : `${hasUnread ? 6 : 14}px 15px 0`, background: '#fff', borderRadius: compact ? 0 : 14, boxShadow: compact ? 'none' : SH, padding: '2px 14px' }}>
        {items.map((n, idx) => {
          const t = TYPE_ICON[n.type]
          return (
            <Link
              key={n.key}
              href={n.href}
              onClick={() => markRead(n)}
              style={{
                display: 'flex', gap: 10, width: '100%', textAlign: 'left', padding: '12px 0',
                textDecoration: 'none', color: 'inherit', fontFamily: 'inherit',
                borderBottom: idx < items.length - 1 ? '0.5px solid #eee' : 'none',
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
