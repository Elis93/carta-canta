import Link from 'next/link'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'

interface KpiCardProps {
  title: string
  value: string | number
  /** Delta percentuale rispetto al periodo precedente. null = non disponibile. */
  delta?: number | null
  icon: React.ReactNode
  /** Se presente, la card è cliccabile */
  href?: string
  /** Testo descrittivo sotto il valore (es. "vs mese scorso") */
  sub?: string
}

export function KpiCard({ title, value, delta, icon, href, sub }: KpiCardProps) {
  const hasDelta = delta !== null && delta !== undefined
  const isPositive = hasDelta && delta > 0
  const isNegative = hasDelta && delta < 0
  const isNeutral  = hasDelta && delta === 0

  const deltaLabel = hasDelta
    ? `${isPositive ? '+' : ''}${delta.toFixed(1)}%`
    : null

  const content = (
    <Card className={href ? 'transition-colors hover:border-primary/30 hover:bg-muted/30 cursor-pointer' : ''}>
      <CardHeader className="pb-1 pt-4 px-4">
        <CardDescription className="flex items-center gap-1.5 text-xs">
          {icon}
          {title}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-1">
        <p className="text-2xl font-bold leading-none">{value}</p>
        <div className="flex items-center gap-1.5 h-4">
          {hasDelta && (
            <span className={`flex items-center gap-0.5 text-xs font-medium ${
              isPositive ? 'text-green-600'
              : isNegative ? 'text-red-500'
              : 'text-muted-foreground'
            }`}>
              {isPositive && <TrendingUp className="size-3" />}
              {isNegative && <TrendingDown className="size-3" />}
              {isNeutral  && <Minus className="size-3" />}
              {deltaLabel}
            </span>
          )}
          {sub && (
            <span className="text-xs text-muted-foreground">{sub}</span>
          )}
        </div>
      </CardContent>
    </Card>
  )

  if (href) {
    return <Link href={href} className="block">{content}</Link>
  }
  return content
}
