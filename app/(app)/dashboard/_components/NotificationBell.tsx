'use client'

// Campanella della Home con PANNELLO A TENDINA (richiesta Eli 20 ago: «invece
// che aprire una nuova pagina, le informazioni si mostrano in un menu a
// tendina»). Il tocco apre le notifiche sul posto — un tocco in meno e la Home
// resta sotto; la pagina /notifiche resta viva per i collegamenti profondi
// (FAQ, ricerca in Altro) e come «Vedi tutte» in fondo al pannello.
// Il pannello vive in PORTALE su document.body con cc-portal-float (regola
// §B.2: gli overlay posizionati con getBoundingClientRect dentro un body
// zoomato si disallineano senza il contro-zoom).

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import type { AppNotification } from '@/lib/notifications'
import { NotificationList } from '@/app/(app)/notifiche/_components/NotificationList'
import { useAnchorRect, useCloseOnOutsideMouseDown } from '@/components/shared/dropdown-portal'

export function NotificationBell({
  notifications,
  hero = false,
}: {
  notifications: AppNotification[]
  /** true = variante oro sulla testata navy (mobile); false = cerchio bianco (desktop). */
  hero?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  // Il pallino segue le letture fatte DENTRO il pannello (onUnreadChange),
  // partendo dal conteggio arrivato dal server.
  const [unread, setUnread] = useState(() => notifications.filter((n) => !n.read).length)
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setMounted(true) }, [])

  const close = useCallback(() => setOpen(false), [])
  const rect = useAnchorRect(btnRef, open)
  useCloseOnOutsideMouseDown(open, close, [btnRef, panelRef])

  // Esc chiude (tastiera fisica / tablet con tastiera).
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const label = unread > 0 ? `Notifiche: ${unread} non lette` : 'Notifiche'

  // Geometria del pannello: ancorato sotto la campanella, allineato al suo
  // bordo destro ma mai fuori dallo schermo; largo al massimo 400px.
  let panel: React.ReactNode = null
  if (open && mounted && rect) {
    const vw = window.innerWidth
    // Più stretto (Eli 20 ago): non a tutta pagina — si legge come una
    // tendina della campanella, non come una pagina sovrapposta.
    const width = Math.min(340, vw - 48)
    const left = Math.max(10, Math.min(rect.right - width, vw - width - 10))
    const top = rect.bottom + 8
    const maxH = Math.max(240, Math.min(480, window.innerHeight - top - 16))
    panel = createPortal(
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Notifiche"
        className="cc-portal-float"
        // Il tocco su una notifica è un <Link> che naviga: il pannello si
        // chiude subito, così tornando indietro non lo si ritrova aperto.
        onClickCapture={(e) => {
          if ((e.target as HTMLElement).closest('a')) setOpen(false)
        }}
        style={{
          position: 'fixed', top, left, width, zIndex: 80,
          background: '#fff', borderRadius: 14, border: '1px solid #e7e7ea',
          boxShadow: '0 1px 2px rgba(20,20,40,.06),0 18px 44px -12px rgba(20,20,40,.3)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        <div style={{ maxHeight: maxH, overflowY: 'auto', overscrollBehavior: 'contain' }}>
          <NotificationList notifications={notifications} compact onUnreadChange={setUnread} />
        </div>
        <Link
          href="/notifiche"
          onClick={() => setOpen(false)}
          style={{ display: 'block', textAlign: 'center', padding: '11px 14px', fontSize: 13, fontWeight: 600, color: '#1a1a2e', textDecoration: 'none', borderTop: '1px solid #f0efec', flexShrink: 0 }}
        >
          Vedi tutte le notifiche
        </Link>
      </div>,
      document.body,
    )
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={
          hero
            ? { position: 'relative', width: 34, height: 34, borderRadius: '50%', background: open ? 'rgba(255,255,255,.16)' : 'rgba(255,255,255,.08)', border: open ? '1px solid rgba(255,255,255,.55)' : '1px solid rgba(203,164,76,.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: open ? '#fff' : '#e6cf94', cursor: 'pointer', padding: 0 }
            : { position: 'relative', width: 38, height: 38, borderRadius: '50%', background: open ? '#1a1a2e' : '#fff', border: open ? '1px solid #1a1a2e' : '1px solid #e7e7ea', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 2px rgba(20,20,40,.05)', color: open ? '#fff' : '#55534b', flexShrink: 0, cursor: 'pointer', padding: 0 }
        }
      >
        <Bell size={hero ? 16 : 18} strokeWidth={1.9} />
        {/* Badge più grande e più acceso (Eli 25 ago: «non si vede»): rosso
            vivo + anello del colore di fondo (navy in testata, bianco sul
            desktop) che lo stacca dal cerchio della campanella. */}
        {unread > 0 && (
          <span style={{ position: 'absolute', top: -7, right: -7, minWidth: 20, height: 20, boxSizing: 'border-box', borderRadius: 999, background: '#e04a3d', border: hero ? '2px solid #1a1a2e' : '2px solid #fff', color: '#fff', fontSize: 11.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', lineHeight: 1 }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {panel}
    </>
  )
}
