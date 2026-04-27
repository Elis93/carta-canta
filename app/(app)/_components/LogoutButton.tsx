'use client'

import { useTransition } from 'react'
import { LogOut } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { logoutAction } from '@/app/(auth)/actions'

export function LogoutButton() {
  const [isPending, startTransition] = useTransition()

  return (
    <DropdownMenuItem
      onSelect={(e) => {
        // Previene la chiusura automatica del menu da parte di Radix prima
        // che la Server Action sia stata avviata. startTransition avvia
        // logoutAction() come chiamata HTTP — la risposta redirect('/login')
        // viene gestita dal router anche dopo lo smontaggio del Portal.
        e.preventDefault()
        startTransition(() => logoutAction())
      }}
      disabled={isPending}
      className="text-destructive focus:text-destructive cursor-pointer"
    >
      <LogOut className="size-4" />
      {isPending ? 'Uscita…' : 'Esci'}
    </DropdownMenuItem>
  )
}
