'use client'

// ============================================================
// AppShell — shell visuale dell'app con sidebar hamburger.
//
// Desktop (md+): sidebar fissa a sinistra, sempre visibile.
// Mobile (<md):  header con hamburger top-left; Sheet side=left
//               aperto/chiuso dallo stesso pulsante (toggle).
//               La bottom nav è stata rimossa — tutte le 8 voci
//               sono accessibili tramite lo Sheet.
// ============================================================

import { useState } from 'react'
import Link from 'next/link'
import { Menu, Plus } from 'lucide-react'
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Settings, CreditCard } from 'lucide-react'
import { SidebarNav } from './NavItem'
import { LogoutButton } from './LogoutButton'

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

// FIX-30: etichette piano leggibili (no capitalize CSS che lascia "lifetime" minuscolo)
const PLAN_LABELS: Record<string, string> = {
  free:     'Free',
  pro:      'Pro',
  team:     'Team',
  lifetime: 'Lifetime',
}

export function AppShell({
  children,
  workspace,
  fullName,
  userEmail,
  initials,
}: AppShellProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  // FIX-31: traccia immagine rotta per mostrare fallback iniziali
  const [logoError, setLogoError] = useState(false)

  const displayName = workspace.ragione_sociale ?? workspace.name

  // FIX-31: iniziali dalla ragione sociale (es. "Rossi Idraulica" → "RI")
  const logoInitials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((w: string) => w[0] ?? '')
    .join('')
    .toUpperCase() || 'CC'

  // ── Logo o iniziali azienda ────────────────────────────────
  // FIX-31: onError gestisce bucket non pubblico o URL rotto → fallback iniziali
  const LogoMark = () =>
    workspace.logo_url && !logoError ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={workspace.logo_url}
        alt={displayName}
        className="size-7 rounded-lg object-cover shrink-0"
        onError={() => setLogoError(true)}
      />
    ) : (
      <div className="size-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
        <span className="text-primary-foreground font-bold text-xs">{logoInitials}</span>
      </div>
    )

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
        <Button variant="ghost" size="icon" className="rounded-full">
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
            <Badge variant="secondary" className="text-xs capitalize">
              {workspace.plan}
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

      {/* ── SIDEBAR DESKTOP (md+) ────────────────────────────── */}
      <aside className="hidden md:flex w-56 flex-col border-r bg-card/50 shrink-0">
        {/* Brand */}
        <div className="h-14 flex items-center px-4 border-b gap-2 shrink-0">
          <LogoMark />
          <span className="font-semibold text-sm truncate">{displayName}</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 flex flex-col gap-0.5">
          <SidebarNav />
        </nav>

        <PlanBadge />
      </aside>

      {/* ── SHEET MOBILE (hamburger, <md) ────────────────────── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-72 p-0 flex flex-col gap-0"
        >
          {/* Header sheet — stesso hamburger chiude */}
          <SheetHeader className="h-14 flex-row items-center px-4 border-b gap-3 space-y-0 shrink-0">
            <button
              aria-label="Chiudi menu"
              onClick={() => setSheetOpen(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Menu className="size-5" />
            </button>
            <LogoMark />
            <SheetTitle className="text-sm font-semibold truncate flex-1">
              {displayName}
            </SheetTitle>
          </SheetHeader>

          {/* Nav — click su voce chiude lo Sheet */}
          <nav className="flex-1 px-2 py-4 flex flex-col gap-0.5 overflow-y-auto">
            <SidebarNav onItemClick={() => setSheetOpen(false)} />
          </nav>

          <PlanBadge />
        </SheetContent>
      </Sheet>

      {/* ── CONTENUTO PRINCIPALE ─────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <header className="h-14 border-b flex items-center justify-between px-4 md:px-6 shrink-0 bg-card/50">

          {/* Sinistra mobile: hamburger + logo + nome */}
          <div className="flex md:hidden items-center gap-2">
            <button
              aria-label="Apri menu"
              onClick={() => setSheetOpen((o) => !o)}
              className="text-muted-foreground hover:text-foreground transition-colors p-1 -ml-1 rounded"
            >
              <Menu className="size-5" />
            </button>
            <LogoMark />
            <span className="font-semibold text-sm truncate max-w-[140px]">
              {displayName}
            </span>
          </div>

          {/* Sinistra desktop: vuota (c'è la sidebar) */}
          <div className="hidden md:block" />

          {/* Destra: azioni */}
          <div className="flex items-center gap-2">
            {/* FAB desktop — testo completo */}
            <Button asChild size="sm" className="hidden md:flex">
              <Link href="/preventivi/nuovo">
                <Plus className="size-4" />
                Nuovo preventivo
              </Link>
            </Button>

            {/* FAB mobile — solo icona, visibile su mobile */}
            <Button asChild size="icon" variant="ghost" className="md:hidden">
              <Link href="/preventivi/nuovo" aria-label="Nuovo preventivo">
                <Plus className="size-5" />
              </Link>
            </Button>

            <UserMenu />
          </div>
        </header>

        {/* Page content — padding bottom solo su mobile per compensare h-14 header */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>

    </div>
  )
}
