'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  FileText,
  Users,
  BookOpen,
  FileCheck2,
  LayoutTemplate,
  Gift,
  Settings,
  CreditCard,
} from 'lucide-react'

interface NavItemDef {
  href: string
  label: string
  icon: LucideIcon
}

// Unica fonte di verità — usata sia dalla sidebar desktop che dallo Sheet mobile.
export const NAV_ITEMS: NavItemDef[] = [
  { href: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/preventivi',   label: 'Preventivi',   icon: FileText        },
  { href: '/clienti',      label: 'Clienti',      icon: Users           },
  { href: '/catalogo',     label: 'Catalogo',     icon: BookOpen        },
  { href: '/fatture',      label: 'Fatture',      icon: FileCheck2      },
  { href: '/template',     label: 'Template',     icon: LayoutTemplate  },
  { href: '/referral',     label: 'Porta un amico', icon: Gift          },
  { href: '/impostazioni', label: 'Impostazioni', icon: Settings        },
  { href: '/abbonamento',  label: 'Abbonamento',  icon: CreditCard      },
]

interface NavItemProps extends NavItemDef {
  /** Callback opzionale chiamato dopo il click — usato per chiudere lo Sheet mobile */
  onItemClick?: () => void
}

function NavItem({ href, label, icon: Icon, onItemClick }: NavItemProps) {
  const pathname = usePathname()
  const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))

  return (
    <Link
      href={href}
      onClick={onItemClick}
      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${
        isActive
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
      }`}
    >
      <Icon className="size-4 shrink-0" />
      {label}
    </Link>
  )
}

export function SidebarNav({ onItemClick }: { onItemClick?: () => void }) {
  return (
    <>
      {NAV_ITEMS.map((item) => (
        <NavItem key={item.href} {...item} onItemClick={onItemClick} />
      ))}
    </>
  )
}
