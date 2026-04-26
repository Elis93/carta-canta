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
  Settings,
  CreditCard,
} from 'lucide-react'

interface NavItemDef {
  href: string
  label: string
  icon: LucideIcon
}

const NAV_ITEMS: NavItemDef[] = [
  { href: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/preventivi',   label: 'Preventivi',   icon: FileText },
  { href: '/clienti',      label: 'Clienti',      icon: Users },
  { href: '/catalogo',     label: 'Catalogo',     icon: BookOpen },
  { href: '/fatture',      label: 'Fatture',      icon: FileCheck2 },
  { href: '/template',     label: 'Template',     icon: LayoutTemplate },
  { href: '/impostazioni', label: 'Impostazioni', icon: Settings },
  { href: '/abbonamento',  label: 'Abbonamento',  icon: CreditCard },
]

const MOBILE_NAV: NavItemDef[] = [
  { href: '/dashboard',    label: 'Home',       icon: LayoutDashboard },
  { href: '/preventivi',   label: 'Preventivi', icon: FileText },
  { href: '/clienti',      label: 'Clienti',    icon: Users },
  { href: '/impostazioni', label: 'Settings',   icon: Settings },
]

function NavItem({ href, label, icon: Icon }: NavItemDef) {
  const pathname = usePathname()
  const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))

  return (
    <Link
      href={href}
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

function MobileNavItem({ href, label, icon: Icon }: NavItemDef) {
  const pathname = usePathname()
  const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))

  return (
    <Link
      href={href}
      className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
        isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      <Icon className="size-5" />
      <span className="text-[10px]">{label}</span>
    </Link>
  )
}

export function SidebarNav() {
  return (
    <>
      {NAV_ITEMS.map((item) => (
        <NavItem key={item.href} {...item} />
      ))}
    </>
  )
}

export function MobileNav() {
  return (
    <>
      {MOBILE_NAV.map((item) => (
        <MobileNavItem key={item.href} {...item} />
      ))}
    </>
  )
}
