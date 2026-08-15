'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Home, FileText, Receipt, Menu } from 'lucide-react'
import { FabCreateMenu } from './FabCreateMenu'

// Nasconde la BottomNav mentre si scrive in un campo (feedback Eli 22 lug #21):
// altrimenti su Android la barra fixed sale sopra la tastiera. Con un campo a
// fuoco la nascondiamo → resta "giù", coperta dalla tastiera.
function useHideOnKeyboard(): boolean {
  const [typing, setTyping] = useState(false)
  useEffect(() => {
    // ⚠️ Non tutti gli `<input>` aprono la tastiera: una CASELLA DI SPUNTA
    // (o un radio, o un input-bottone) non la apre mai — ma contandola come
    // campo la barra spariva al primo tocco e non tornava più (segnalato da
    // Eli sull'interruttore della trasmissione automatica, 11 ago; il difetto
    // valeva per OGNI spunta dell'app, dalle notifiche ai template).
    const SENZA_TASTIERA = new Set([
      'checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'image', 'color', 'range',
    ])
    const isField = (el: EventTarget | null) => {
      const t = el as HTMLElement | null
      if (!t) return false
      const tag = t.tagName
      if (tag === 'INPUT') {
        const type = ((t as HTMLInputElement).type || 'text').toLowerCase()
        return !SENZA_TASTIERA.has(type)
      }
      return tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable
    }
    // ⚠️ Conta solo il fuoco dato DALL'UTENTE (tocco sul campo): l'autoFocus
    // programmatico — es. la prima voce del NUOVO preventivo/fattura — non
    // apre nessuna tastiera ma nascondeva la barra da subito (bug Eli 3 ago
    // sera: "manca la barra sotto; se clicco su catalogo compare").
    let lastTapTarget: EventTarget | null = null
    let lastTapAt = 0
    const onTap = (e: Event) => {
      lastTapTarget = e.target
      lastTapAt = Date.now()
      // Tocco su un campo GIÀ a fuoco (dall'autoFocus): la tastiera si apre
      // ma nessun focusin parte → nascondi subito da qui.
      if (isField(e.target) && document.activeElement === e.target) setTyping(true)
    }
    // ⚠️ focusin segue SEMPRE lo stato reale (true per i campi TOCCATI, FALSE
    // per tutto il resto): se il campo a fuoco viene smontato (es. dialog che
    // si chiude col campo attivo) il browser NON emette focusout, ma Radix
    // rifocalizza il trigger → quel focusin su un non-campo rimette la nav,
    // che altrimenti restava nascosta per sempre (review 22 lug).
    const onIn = (e: FocusEvent) => {
      const el = e.target as HTMLElement | null
      const tapped = lastTapTarget != null && Date.now() - lastTapAt < 3000
        && (lastTapTarget === el || !!el?.contains(lastTapTarget as Node))
      setTyping(isField(e.target) && tapped)
    }
    const onOut = () => setTyping(false)
    document.addEventListener('pointerdown', onTap, true)
    document.addEventListener('focusin', onIn)
    document.addEventListener('focusout', onOut)
    return () => {
      document.removeEventListener('pointerdown', onTap, true)
      document.removeEventListener('focusin', onIn)
      document.removeEventListener('focusout', onOut)
    }
  }, [])
  return typing
}

// Pagine che attivano il tab "Altro"
const ALTRO_PREFIXES = [
  '/altro', '/clienti', '/catalogo', '/template',
  '/impostazioni', '/abbonamento', '/cestino', '/referral',
  // Sezioni raggiungibili da "Altro": senza, navigandoci nessuna tab
  // risultava attiva
  '/lavori', '/sopralluoghi', '/calendario', '/bilancio', '/notifiche',
  '/aiuto', '/novita', '/richieste', '/recensioni', '/marketplace',
  '/farti-trovare', '/calcoli', '/account', '/scadenze',
]

const LEFT_TABS = [
  { href: '/dashboard',  label: 'Home',       icon: Home     },
  { href: '/preventivi', label: 'Preventivi', icon: FileText },
]
const RIGHT_TABS = [
  { href: '/fatture', label: 'Fatture', icon: Receipt },
  { href: '/altro',   label: 'Altro',   icon: Menu    },
]

export function MobileBottomNav() {
  const pathname = usePathname()
  const typing = useHideOnKeyboard()

  function isActive(href: string): boolean {
    if (href === '/dashboard') return pathname === '/dashboard'
    if (href === '/altro')
      return ALTRO_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
    if (href === '/preventivi')
      return pathname === '/preventivi' || pathname.startsWith('/preventivi/')
    if (href === '/fatture')
      return pathname === '/fatture' || pathname.startsWith('/fatture/')
    return false
  }

  function tabStyle(href: string) {
    const active = isActive(href)
    return {
      display: 'flex' as const,
      flexDirection: 'column' as const,
      alignItems: 'center' as const,
      gap: 3,
      color: active ? 'var(--cc-navy)' : 'var(--cc-text-3)',
      fontWeight: active ? 500 : 400,
      textDecoration: 'none' as const,
      fontSize: 12,
    }
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden"
      style={{
        background: '#ffffff',
        borderTop: '0.5px solid var(--cc-border-color)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        // Campo a fuoco = tastiera aperta → nascondi (non salire sopra la tastiera).
        display: typing ? 'none' : undefined,
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          justifyItems: 'center',
          alignItems: 'end',
          padding: '9px 18px 11px',
        }}
      >
        {/* Tab sinistra */}
        {/* prefetch={true}: le pagine delle tab vengono scaricate in anticipo
            (dati inclusi) → il cambio tab è quasi istantaneo (richiesta Eli
            18 lug: "quando clicco su una pagina ci mette poco ad aprirla") */}
        {LEFT_TABS.map(tab => {
          const active = isActive(tab.href)
          const Icon = tab.icon
          return (
            <Link key={tab.href} href={tab.href} prefetch={true} style={tabStyle(tab.href)}>
              <Icon size={22} strokeWidth={active ? 2 : 1.5} />
              <span style={{ lineHeight: 1 }}>{tab.label}</span>
            </Link>
          )
        })}

        {/* FAB centrale — dentro la barra, margin-top:-14px lo fa sporgere.
            Toccandolo si aprono DUE scelte: Preventivo o Sopralluogo (Eli 14 ago). */}
        <FabCreateMenu />

        {/* Tab destra */}
        {RIGHT_TABS.map(tab => {
          const active = isActive(tab.href)
          const Icon = tab.icon
          return (
            <Link
              key={tab.href}
              href={tab.href}
              prefetch={true}
              style={tabStyle(tab.href)}
              // F16: il benvenuto del tutorial marca la tab Altro (lì vive
              // l'impostazione "Testo grande e leggibile")
              data-tour={tab.href === '/altro' ? 'tab-altro' : undefined}
            >
              <Icon size={22} strokeWidth={active ? 2 : 1.5} />
              <span style={{ lineHeight: 1 }}>{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
