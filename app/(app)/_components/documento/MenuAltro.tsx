'use client'

// ============================================================
// MenuAltro — il «⋯» della pagina del documento: un foglio dal basso con
// le azioni secondarie (mockup A, Eli 5 set 2026). Tutto ciò che non è
// «il passo successivo» sta qui: sollecito, annulla, collega, archivia,
// elimina, e i due ripieghi «segna accettato a voce / rifiutato».
//
// ⚠️ In PORTAL su <body> (regola B.2): un fixed dentro la pagina verrebbe
// ritagliato. Le righe sono i componenti-azione GIÀ esistenti vestiti da
// riga (`rigaMenu` in triggerStyle): una logica sola, nessun doppione.
// ⚠️ La chiusura è in fase BUBBLE (onClick), mai capture: React flusha lo
// stato fra le due fasi e il figlio non riceverebbe il tocco (bug della
// campanella, 26 ago). Le righe che aprono un pannello INLINE o un dialog
// portalato (quale proposta? · motivo della nota · collega) stanno dentro
// `[data-keep-open]`: lì il foglio resta aperto, altrimenti smonterebbe
// il pannello appena aperto. Le righe con window.confirm o navigazione
// chiudono il foglio al tocco: il confirm è sincrono, il resto prosegue.
// ⚠️ zIndex 45: sopra la barra in basso (z-40), SOTTO i dialog (z-50) —
// il dialog di conferma di «Elimina» deve comparire davanti al foglio.
// ============================================================

import { useEffect, useState, type ReactNode, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { MoreHorizontal, Archive, BellRing, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { runAction } from '@/lib/run-action'
import { archiviaDocumentoAction, sendReminderAction } from '@/lib/actions/documents'
import { btnQuadrato, rigaMenu } from './stili'

export function MenuAltro({ children, label = 'Altro', style }: { children: ReactNode; label?: string; style?: CSSProperties }) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()

  useEffect(() => setMounted(true), [])
  useEffect(() => { setOpen(false) }, [pathname])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        style={{ ...btnQuadrato, ...style }}
      >
        <MoreHorizontal size={20} />
      </button>

      {mounted && open && createPortal(
        <div role="menu" aria-label={label} style={{ position: 'fixed', inset: 0, zIndex: 45 }}>
          <div onClick={() => setOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(20,20,40,.35)' }} />
          <div
            onClick={(e) => {
              // Bubble: il figlio ha già ricevuto il tocco. Chiudi, tranne
              // dove il figlio ha aperto qualcosa che vive qui dentro.
              const t = e.target as HTMLElement
              if (t.closest('[data-keep-open]')) return
              if (t.closest('button, a')) setOpen(false)
            }}
            style={{
              position: 'absolute', left: 0, right: 0, bottom: 0,
              background: '#fff', borderRadius: '14px 14px 0 0',
              boxShadow: '0 -10px 30px -12px rgba(20,20,40,.5)',
              padding: '10px 15px calc(12px + env(safe-area-inset-bottom, 0px))',
              maxHeight: '82vh', overflowY: 'auto',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--cc-muted)', margin: '2px 0 4px', textAlign: 'center' }}>
              {label}
            </div>
            {children}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

/** Riga semplice del menu: link o azione. */
export function RigaMenu({ icon, children, href, onClick, danger, disabled, style }: {
  icon: ReactNode
  children: ReactNode
  href?: string
  onClick?: () => void
  danger?: boolean
  disabled?: boolean
  style?: CSSProperties
}) {
  const s: CSSProperties = { ...rigaMenu, ...(danger ? { color: '#b05656' } : null), ...(disabled ? { opacity: .5, cursor: 'default' } : null), ...style }
  if (href) {
    return (
      <Link href={href} role="menuitem" style={s}>
        <span style={{ flex: 'none', display: 'inline-flex', color: danger ? '#b05656' : '#55534b' }}>{icon}</span>
        {children}
      </Link>
    )
  }
  return (
    <button type="button" role="menuitem" onClick={onClick} disabled={disabled} style={s}>
      <span style={{ flex: 'none', display: 'inline-flex', color: danger ? '#b05656' : '#55534b' }}>{icon}</span>
      {children}
    </button>
  )
}

/** Archivia: esce dalle liste attive, resta in Bilancio e cerca (075). */
export function RigaArchivia({ documentId, femminile }: { documentId: string; femminile?: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  return (
    <RigaMenu
      icon={busy ? <Loader2 size={18} className="animate-spin" /> : <Archive size={18} />}
      disabled={busy}
      onClick={async () => {
        if (busy) return
        setBusy(true)
        const res = await runAction(() => archiviaDocumentoAction(documentId), 'archiviare il documento')
        setBusy(false)
        if (res?.error) { toast.error(res.error); return }
        toast.success(femminile ? 'Fattura archiviata: la ritrovi in Fatture › Archivio.' : 'Preventivo archiviato: lo ritrovi in Preventivi › Archivio.')
        router.refresh()
      }}
    >
      Archivia
    </RigaMenu>
  )
}

/** Sollecita il cliente via email (stessa action della Home e delle scadenze). */
export function RigaSollecita({ documentId, docType }: { documentId: string; docType: 'preventivo' | 'fattura' }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  return (
    <RigaMenu
      icon={busy ? <Loader2 size={18} className="animate-spin" /> : <BellRing size={18} />}
      disabled={busy}
      onClick={async () => {
        if (busy) return
        // ⚠️ La busta manda l'email SUBITO, senza anteprima (regola della Home,
        // 20 ago): la conferma sta qui, prima che parta.
        if (!window.confirm(docType === 'fattura'
          ? 'Mandare ora al cliente l’email di sollecito del pagamento? Parte subito, già scritta.'
          : 'Mandare ora al cliente l’email di sollecito? Parte subito, già scritta.')) return
        setBusy(true)
        const res = await runAction(() => sendReminderAction(documentId, docType), 'inviare il sollecito')
        setBusy(false)
        if (res?.error) { toast.error(res.error, { closeButton: true }); return }
        toast.success('Sollecito inviato al cliente.')
        router.refresh()
      }}
    >
      Sollecita il cliente
    </RigaMenu>
  )
}
