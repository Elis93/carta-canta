'use client'

// ============================================================
// AppShell — shell visuale dell'app.
//
// Desktop (lg+):  sidebar fissa a sinistra + header con "Nuovo preventivo".
// Mobile (<lg):   header con logo/nome workspace + avatar;
//                 navigazione via bottom tab bar (MobileBottomNav);
//                 FAB "+" per nuovo preventivo (in MobileBottomNav).
// ============================================================

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Settings, CreditCard } from 'lucide-react'
import { SidebarNav } from './NavItem'
import { LogoutButton } from './LogoutButton'
import { WorkspaceLogo } from './WorkspaceLogo'
import { MobileBottomNav } from '@/components/mobile/BottomNav'

// FIX-30: etichette piano leggibili (no capitalize CSS che lascia "lifetime" minuscolo)
const PLAN_LABELS: Record<string, string> = {
  free:     'Free',
  pro:      'Pro',
  team:     'Team',
  lifetime: 'Lifetime',
}

// ── WorkspaceLogo: estratto in ./WorkspaceLogo (F22) ───────────────────────
// FIX-31 resta valido: componente a livello di modulo col PROPRIO useState
// (mai definirlo dentro AppShell). Ora lo usa anche la scheda profilo di /altro.

interface AppShellProps {
  children: React.ReactNode
  workspace: {
    id: string
    name: string
    ragione_sociale: string | null
    logo_url: string | null
    plan: string
  }
  fullName: string
  userEmail: string
  initials: string
}

export function AppShell({
  children,
  workspace,
  fullName,
  userEmail,
  initials,
}: AppShellProps) {
  const displayName = workspace.ragione_sociale ?? workspace.name

  // ── Piano sidebar (bottom) ─────────────────────────────────
  // FIX-30: rimossi freccia e link "Upgrade" — solo il nome del piano corrente
  const PlanBadge = () => (
    <div className="p-3 border-t">
      <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        Piano{' '}
        <span className="font-semibold text-foreground">
          {PLAN_LABELS[workspace.plan] ?? workspace.plan}
        </span>
      </div>
    </div>
  )

  // ── Avatar dropdown (header destra) ────────────────────────
  const UserMenu = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Menu account" title="Menu account">
          <Avatar className="size-7">
            <AvatarFallback className="text-xs bg-primary text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium truncate">{fullName}</p>
          <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
        </div>
        {workspace.plan !== 'free' && (
          <div className="px-2 pb-1.5">
            <Badge variant="secondary" className="text-xs">
              {PLAN_LABELS[workspace.plan] ?? workspace.plan}
            </Badge>
          </div>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/impostazioni">
            <Settings className="size-4" />
            Impostazioni
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/abbonamento">
            <CreditCard className="size-4" />
            Abbonamento
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <LogoutButton />
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <div className="flex min-h-screen bg-background">

      {/* ── SIDEBAR DESKTOP (lg+) ────────────────────────────── */}
      <aside className="hidden lg:flex w-56 flex-col border-r bg-card/50 shrink-0">
        {/* Brand */}
        <div className="h-14 flex items-center px-4 border-b gap-2 shrink-0">
          <WorkspaceLogo logoUrl={workspace.logo_url} displayName={displayName} />
          <span className="font-semibold text-sm truncate">{displayName}</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 flex flex-col gap-0.5">
          <SidebarNav />
        </nav>

        <PlanBadge />
      </aside>

      {/* ── CONTENUTO PRINCIPALE ─────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header — hidden on mobile (dashboard renders its own brand strip + header) */}
        <header className="hidden lg:flex h-14 border-b items-center justify-between px-4 lg:px-6 shrink-0 bg-card/50">

          {/* Sinistra mobile (<lg): logo + nome workspace */}
          <div className="flex lg:hidden items-center gap-2">
            <WorkspaceLogo logoUrl={workspace.logo_url} displayName={displayName} />
            <span className="font-semibold text-sm truncate max-w-[160px]">
              {displayName}
            </span>
          </div>

          {/* Sinistra desktop (lg+): vuota (c'è la sidebar) */}
          <div className="hidden lg:block" />

          {/* Destra: azioni */}
          <div className="flex items-center gap-2">
            {/* "Nuovo preventivo" solo su desktop (lg+) — su mobile c'è il FAB */}
            <Button asChild size="sm" className="hidden lg:flex">
              <Link href="/preventivi/nuovo" data-tour="fab">
                <Plus className="size-4" />
                Nuovo preventivo
              </Link>
            </Button>

            <UserMenu />
          </div>
        </header>

        {/* Page content — padding-bottom su mobile per la bottom nav */}
        <main className="cc-main-safe-top cc-main-gutter flex-1 overflow-y-auto overflow-x-hidden pb-[72px] lg:pb-0 bg-[#f0eee8] lg:bg-background">{children}</main>
      </div>

      {/* ── BOTTOM NAV + FAB (solo mobile, lg:hidden interno) ── */}
      <MobileBottomNav />

    </div>
  )
}
