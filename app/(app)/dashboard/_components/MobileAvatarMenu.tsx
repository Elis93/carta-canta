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
}

export function MobileAvatarMenu({ initials, userEmail, plan }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          style={{
            width: 38, height: 38, borderRadius: '50%',
            background: '#1a1a2e', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 500,
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
