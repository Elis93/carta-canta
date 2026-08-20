'use client'

import Link from 'next/link'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Settings, CreditCard } from 'lucide-react'
import { LogoutButton } from '@/app/(app)/_components/LogoutButton'

const PLAN_LABELS: Record<string, string> = {
  free: 'Gratuito', pro: 'Pro', team: 'Team', lifetime: 'Lifetime',
}

interface Props {
  initials: string
  userEmail: string
  plan: string
  /** Variante per la testata navy della Home: tondo oro (il navy sparirebbe) */
  hero?: boolean
}

export function MobileAvatarMenu({ initials, userEmail, plan, hero }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          style={{
            width: hero ? 34 : 38, height: hero ? 34 : 38, borderRadius: '50%',
            background: hero ? 'linear-gradient(150deg,#c9a44c,#a97f2f)' : '#1a1a2e',
            color: hero ? '#241c08' : '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: hero ? 12 : 13, fontWeight: hero ? 800 : 500,
            border: 'none', cursor: 'pointer', flexShrink: 0,
          }}
          aria-label="Menu account"
        >
          {initials}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <div className="px-2 py-1.5">
          <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
        </div>
        {plan !== 'free' && (
          <div className="px-2 pb-1.5">
            <Badge variant="secondary" className="text-xs">
              {PLAN_LABELS[plan] ?? plan}
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
}
