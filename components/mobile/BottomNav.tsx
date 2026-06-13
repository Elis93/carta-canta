'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, FileText, FileCheck2, Users, Menu, Plus } from 'lucide-react'

const TABS = [
  { href: '/dashboard',  label: 'Home',       icon: LayoutDashboard },
  { href: '/preventivi', label: 'Preventivi', icon: FileText        },
  { href: '/fatture',    label: 'Fatture',    icon: FileCheck2      },
  { href: '/clienti',    label: 'Clienti',    icon: Users           },
  { href: '/altro',      label: 'Altro',      icon: Menu            },
]

export function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <>
      {/* FAB — Nuovo preventivo, flottante sopra la nav bar */}
      <Link
        href="/preventivi/nuovo"
        aria-label="Nuovo preventivo"
        className="fixed z-50 lg:hidden"
        style={{
          bottom: 70,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 52,
          height: 52,
          borderRadius: 999,
          background: 'var(--cc-navy)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'var(--cc-shadow-fab)',
        }}
      >
        <Plus size={26} strokeWidth={2} />
      </Link>

      {/* Bottom tab bar */}
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
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            padding: '8px 8px 10px',
            height: 60,
          }}
        >
          {TABS.map((tab) => {
            const isActive =
              pathname === tab.href ||
              (tab.href !== '/dashboard' && pathname.startsWith(tab.href + '/'))
            const color = isActive ? 'var(--cc-navy)' : 'var(--cc-text-3)'
            const Icon = tab.icon
            return (
              <Link
                key={tab.href}
                href={tab.href}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 3,
                  color,
                  textDecoration: 'none',
                }}
              >
                <Icon size={23} strokeWidth={isActive ? 2 : 1.5} />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: isActive ? 500 : 400,
                    lineHeight: 1,
                  }}
                >
                  {tab.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
