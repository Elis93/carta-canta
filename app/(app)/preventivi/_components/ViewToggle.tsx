'use client'

import Link from 'next/link'
import { LayoutList, Columns3 } from 'lucide-react'

export function ViewToggle({
  currentView,
  listHref,
  kanbanHref,
}: {
  currentView: 'list' | 'kanban'
  listHref: string
  kanbanHref: string
}) {
  return (
    <div className="flex items-center rounded-md border bg-muted/50 p-0.5 gap-0.5">
      <Link
        href={listHref}
        title="Vista lista"
        className={`inline-flex items-center justify-center h-7 px-2 rounded-sm transition-colors text-sm font-medium ${
          currentView === 'list'
            ? 'bg-background shadow-sm text-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
        }`}
      >
        <LayoutList className="size-3.5" />
      </Link>
      <Link
        href={kanbanHref}
        title="Vista Kanban"
        className={`inline-flex items-center justify-center h-7 px-2 rounded-sm transition-colors text-sm font-medium ${
          currentView === 'kanban'
            ? 'bg-background shadow-sm text-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
        }`}
      >
        <Columns3 className="size-3.5" />
      </Link>
    </div>
  )
}
