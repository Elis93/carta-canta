import Link from 'next/link'
import { CheckCircle2, Crown, Users, Infinity, Zap } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { formatDate } from '@/lib/utils'
import type { Database } from '@/types/database'

type Workspace = Database['public']['Tables']['workspaces']['Row']

const PLAN_FEATURES: Record<string, string[]> = {
  free: [
    'Fino a 10 preventivi',
    '1 template',
    'PDF professionale',
    'Link di accettazione cliente',
    'Watermark Carta Canta',
  ],
  pro: [
    'Preventivi illimitati',
    'Template illimitati',
    'AI Import (foto → preventivo)',
    'Nessun watermark',
    'Tutti i formati PDF',
  ],
  team: [
    'Tutto di Pro',
    'Fino a 5 utenti nel team',
    'Workflow di approvazione',
    'Ruoli: admin / operatore / viewer',
    'Analytics avanzate',
  ],
  lifetime: [
    'Accesso Pro per sempre',
    'Preventivi illimitati',
    'AI Import',
    'Nessun watermark',
    'Aggiornamenti futuri inclusi',
  ],
}

const PLAN_ICON = {
  free: Zap,
  pro: Crown,
  team: Users,
  lifetime: Infinity,
}

export function ImpostazioniPiano({ workspace }: { workspace: Workspace }) {
  const plan = workspace.plan
  const Icon = PLAN_ICON[plan] ?? Zap
  const features = PLAN_FEATURES[plan] ?? []
  const isPaid = plan !== 'free'

  return (
    <div className="space-y-6">
      {/* Piano corrente */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Icon className="size-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                Piano{' '}
                <span className="capitalize">{plan}</span>
                {isPaid && (
                  <Badge variant="secondary" className="text-xs">Attivo</Badge>
                )}
              </CardTitle>
              {workspace.subscription_ends_at && (
                <CardDescription>
                  Rinnovo il {formatDate(workspace.subscription_ends_at)}
                </CardDescription>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 mb-4">
            {features.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="size-4 text-primary shrink-0" />
                {f}
              </li>
            ))}
          </ul>

          {plan === 'free' ? (
            <div className="space-y-2">
              <Separator className="mb-4" />
              <p className="text-sm text-muted-foreground mb-3">
                Sblocca tutto con il piano Pro o Team.
              </p>
              <Button asChild className="w-full">
                <Link href="/abbonamento">
                  <Crown className="size-4" />
                  Scopri i piani Pro
                </Link>
              </Button>
            </div>
          ) : plan === 'lifetime' ? (
            <p className="text-sm text-muted-foreground">
              Hai accesso Pro per sempre. Nessun rinnovo richiesto.
            </p>
          ) : (
            <div className="space-y-2 pt-2">
              <Button variant="outline" asChild className="w-full">
                <Link href="/abbonamento">Gestisci abbonamento</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info fatturazione */}
      {isPaid && workspace.stripe_customer_id && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fatturazione</CardTitle>
            <CardDescription>
              Storico pagamenti e metodo di pagamento.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link href="/abbonamento">
                Apri portale di fatturazione
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
