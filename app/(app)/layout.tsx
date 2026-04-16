import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { logoutAction } from '@/app/(auth)/actions'
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
  FileText,
  Users,
  LayoutTemplate,
  Settings,
  LogOut,
  LayoutDashboard,
  CreditCard,
  Plus,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard',    label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/preventivi',   label: 'Preventivi',  icon: FileText },
  { href: '/clienti',      label: 'Clienti',     icon: Users },
  { href: '/template',     label: 'Template',    icon: LayoutTemplate },
  { href: '/impostazioni', label: 'Impostazioni',icon: Settings },
  { href: '/abbonamento',  label: 'Abbonamento', icon: CreditCard },
]

// Bottom nav mobile: solo le 4 principali
const MOBILE_NAV = [
  { href: '/dashboard',  label: 'Home',       icon: LayoutDashboard },
  { href: '/preventivi', label: 'Preventivi', icon: FileText },
  { href: '/clienti',    label: 'Clienti',    icon: Users },
  { href: '/impostazioni', label: 'Settings', icon: Settings },
]

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Carica workspace
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name, plan, ragione_sociale, logo_url')
    .eq('owner_id', user.id)
    .maybeSingle()

  // Workspace non trovato → l'account esiste ma il workspace non è stato creato
  // (può succedere se signupAction ha fallito a metà). Mandiamo all'onboarding
  // invece di /login per evitare il loop middleware ↔ layout.
  if (!workspace) redirect('/onboarding')

  // Onboarding incompleto → redirect (ragione_sociale è il marker di completamento)
  if (!workspace.ragione_sociale) {
    redirect('/onboarding')
  }

  const fullName: string =
    user.user_metadata?.full_name ||
    `${user.user_metadata?.nome ?? ''} ${user.user_metadata?.cognome ?? ''}`.trim() ||
    user.email?.split('@')[0] ||
    'Utente'

  const initials = fullName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const displayName = workspace.ragione_sociale ?? workspace.name

  return (
    <div className="flex min-h-screen bg-background">
      {/* ── SIDEBAR DESKTOP ───────────────────────────────── */}
      <aside className="hidden md:flex w-56 flex-col border-r bg-card/50">
        {/* Brand */}
        <div className="h-14 flex items-center px-4 border-b gap-2 shrink-0">
          {workspace.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={workspace.logo_url}
              alt={displayName}
              className="size-7 rounded-lg object-cover"
            />
          ) : (
            <div className="size-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <span className="text-primary-foreground font-bold text-xs">CC</span>
            </div>
          )}
          <span className="font-semibold text-sm truncate">{displayName}</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 flex flex-col gap-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Piano + user */}
        <div className="p-3 border-t space-y-2">
          <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            Piano{' '}
            <span className="font-semibold capitalize text-foreground">
              {workspace.plan}
            </span>
            {workspace.plan === 'free' && (
              <Link
                href="/abbonamento"
                className="ml-1 text-primary underline underline-offset-2"
              >
                → Upgrade
              </Link>
            )}
          </div>
        </div>
      </aside>

      {/* ── CONTENUTO PRINCIPALE ──────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 border-b flex items-center justify-between px-4 md:px-6 shrink-0 bg-card/50">
          {/* Mobile brand */}
          <div className="flex md:hidden items-center gap-2">
            {workspace.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={workspace.logo_url}
                alt={displayName}
                className="size-7 rounded-lg object-cover"
              />
            ) : (
              <div className="size-7 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-xs">CC</span>
              </div>
            )}
            <span className="font-semibold text-sm">{displayName}</span>
          </div>

          <div className="hidden md:block" />

          {/* Azioni header */}
          <div className="flex items-center gap-2">
            {/* FAB nuovo preventivo (visibile solo desktop) */}
            <Button asChild size="sm" className="hidden md:flex">
              <Link href="/preventivi/nuovo">
                <Plus className="size-4" />
                Nuovo preventivo
              </Link>
            </Button>

            {/* Avatar + menu */}
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
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
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
                <DropdownMenuItem asChild>
                  <form action={logoutAction}>
                    <button
                      type="submit"
                      className="flex items-center gap-2 w-full text-destructive"
                    >
                      <LogOut className="size-4" />
                      Esci
                    </button>
                  </form>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto pb-16 md:pb-0">{children}</main>
      </div>

      {/* ── BOTTOM NAV MOBILE ─────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-card border-t z-40">
        <div className="grid grid-cols-5 h-14">
          {MOBILE_NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center justify-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Icon className="size-5" />
              <span className="text-[10px]">{label}</span>
            </Link>
          ))}
          {/* FAB centrale */}
          <Link
            href="/preventivi/nuovo"
            className="flex flex-col items-center justify-center"
          >
            <div className="size-10 rounded-full bg-primary flex items-center justify-center shadow-lg">
              <Plus className="size-5 text-primary-foreground" />
            </div>
          </Link>
        </div>
      </nav>
    </div>
  )
}
