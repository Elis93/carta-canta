'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, FileText, Receipt, Menu, Plus } from 'lucide-react'

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

        {/* FAB centrale — dentro la barra, margin-top:-14px lo fa sporgere */}
        <Link
          href="/preventivi/nuovo"
          aria-label="Nuovo preventivo"
          data-tour="fab"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            textDecoration: 'none',
            marginTop: -14,
          }}
        >
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: '50%',
              background: 'var(--cc-navy)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--cc-shadow-fab)',
            }}
          >
            <Plus size={24} strokeWidth={2} />
          </div>
          <span style={{ fontSize: 11, lineHeight: 1, color: 'var(--cc-text-3)' }}>
            Preventivo
          </span>
        </Link>

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
