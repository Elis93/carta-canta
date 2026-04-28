'use client'

import * as React from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Input password con toggle mostra/nascondi.
 * Drop-in replacement di <Input type="password"> — accetta gli stessi props.
 */
function PasswordInput({
  className,
  disabled,
  ...props
}: Omit<React.ComponentProps<'input'>, 'type'>) {
  const [visible, setVisible] = React.useState(false)

  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        data-slot="input"
        disabled={disabled}
        className={cn(
          // Stesso stile di Input + padding-right per il bottone
          'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 pr-9 text-base transition-colors outline-none',
          'placeholder:text-muted-foreground',
          'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
          'disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50',
          'aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20',
          'dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
          'md:text-sm',
          className
        )}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={visible ? 'Nascondi password' : 'Mostra password'}
        disabled={disabled}
        onClick={() => setVisible((v) => !v)}
        className={cn(
          'absolute right-2 top-1/2 -translate-y-1/2',
          'text-muted-foreground hover:text-foreground transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded',
          'disabled:pointer-events-none disabled:opacity-50',
        )}
      >
        {visible
          ? <EyeOff className="size-4" aria-hidden />
          : <Eye    className="size-4" aria-hidden />}
      </button>
    </div>
  )
}

export { PasswordInput }
