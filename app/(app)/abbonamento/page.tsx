import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Crown, CreditCard } from 'lucide-react'
import { PricingSection } from './_components/PricingSection'
import { SuccessBanner } from './_components/SuccessBanner'
import { PLAN_FEATURES, type PlanType } from '@/lib/stripe/plans'
import { FREE_DOC_LIMIT, FREE_TRIAL_DAYS } from '@/lib/free-trial'

const PLAN_DISPLAY: Record<PlanType, { label: string; color: string }> = {
  free:     { label: 'Free',     color: 'bg-gray-100 text-gray-700' },
  pro:      { label: 'Pro',      color: 'bg-blue-100 text-blue-700' },
  team:     { label: 'Team',     color: 'bg-purple-100 text-purple-700' },
  lifetime: { label: 'Lifetime', color: 'bg-amber-100 text-amber-700' },
}

export default async function AbbonamentoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let { data: workspace } = await supabase
    .from('workspaces')
    .select('id, plan, stripe_customer_id, stripe_subscription_id, subscription_ends_at, free_trial_expires_at, sent_quota_used')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!workspace) {
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .not('accepted_at', 'is', null)
      .limit(1)
      .maybeSingle()
    if (membership) {
      const { data: mw } = await supabase
        .from('workspaces')
        .select('id, plan, stripe_customer_id, stripe_subscription_id, subscription_ends_at, free_trial_expires_at, sent_quota_used')
        .eq('id', membership.workspace_id)
        .maybeSingle()
      workspace = mw
    }
  }

  if (!workspace) redirect('/login')

  const currentPlan = workspace.plan as PlanType
  const planDisplay = PLAN_DISPLAY[currentPlan]
  const features = PLAN_FEATURES[currentPlan]
  const hasStripeCustomer = !!workspace.stripe_customer_id

  // Preventivi inviati (per mostrare usage nel piano Free)
  // Fonte di verità: sent_quota_used — contatore storico, mai decrementato.
  // Coerente con checkFreeBlock() e con la logica mostrata in /preventivi/nuovo.
  let docsUsed: number | null = null
  let daysRemaining: number | null = null
  if (currentPlan === 'free') {
    docsUsed = workspace.sent_quota_used ?? 0
    if (workspace.free_trial_expires_at) {
      const msLeft = new Date(workspace.free_trial_expires_at).getTime() - Date.now()
      daysRemaining = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)))
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Crown className="size-6 text-amber-500" />
          Abbonamento
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gestisci il tuo piano e le opzioni di fatturazione.
        </p>
      </div>

      {/* Banner successo/cancellazione (client) */}
      <Suspense fallback={null}>
        <SuccessBanner />
      </Suspense>

      {/* Stato piano attuale */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <CreditCard className="size-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Piano attuale</p>
              {workspace.subscription_ends_at && currentPlan !== 'free' && (
                <p className="text-xs text-muted-foreground">
                  {workspace.stripe_subscription_id
                    ? `Rinnovo il ${new Date(workspace.subscription_ends_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}`
                    : `Attivo fino al ${new Date(workspace.subscription_ends_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}`
                  }
                </p>
              )}
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${planDisplay.color}`}>
            {currentPlan === 'lifetime' && '♾️ '}
            Piano {planDisplay.label}
          </span>
        </div>

        {/* Usage bar piano Free */}
        {currentPlan === 'free' && docsUsed !== null && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Preventivi inviati</span>
              <span className="font-medium text-foreground">{docsUsed} / {FREE_DOC_LIMIT}</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  docsUsed >= FREE_DOC_LIMIT ? 'bg-red-500' : docsUsed >= Math.floor(FREE_DOC_LIMIT * 0.75) ? 'bg-amber-500' : 'bg-primary'
                }`}
                style={{ width: `${Math.min(100, (docsUsed / FREE_DOC_LIMIT) * 100)}%` }}
              />
            </div>
            {daysRemaining !== null && (
              <p className="text-xs text-muted-foreground">
                {daysRemaining > 0
                  ? <>Periodo di prova: <strong className="text-foreground">{daysRemaining} {daysRemaining === 1 ? 'giorno' : 'giorni'}</strong> rimanenti</>
                  : <span className="text-red-600 font-medium">Periodo di prova scaduto</span>
                }
              </p>
            )}
            {docsUsed >= FREE_DOC_LIMIT && (
              <p className="text-xs text-red-600 font-medium">
                Limite di {FREE_DOC_LIMIT} preventivi raggiunto. Effettua l&apos;upgrade per continuare.
              </p>
            )}
            {/* Spiegazione conteggio */}
            <details className="mt-2">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground select-none">
                Come vengono conteggiati i preventivi?
              </summary>
              <div className="mt-2 space-y-1.5 text-xs text-muted-foreground rounded-lg border bg-muted/30 px-3 py-2.5">
                <p>Quando viene conteggiato: un preventivo viene scalato dal limite nel momento in cui viene inviato al cliente per la prima volta (via email o link). Il semplice salvataggio come bozza non consuma quota.</p>
                <p>Cancellazione: eliminare un preventivo non recupera il contatore. Il conteggio è permanente e riflette tutti i preventivi inviati, anche quelli cancellati in seguito.</p>
                <p>Cestino e ripristino: spostare un preventivo nel cestino o ripristinarlo non modifica il contatore.</p>
                <p>Reinvio: reinviare un preventivo già inviato (con lo stesso status) non incrementa il contatore.</p>
                <p>Fatture: le fatture non consumano quota preventivi — il limite riguarda solo i preventivi.</p>
              </div>
            </details>
          </div>
        )}

        {/* Feature del piano corrente */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <FeaturePill
            label="Preventivi"
            value={features.maxDocuments === Infinity ? 'Illimitati' : `Max ${features.maxDocuments}`}
            active
          />
          <FeaturePill
            label="Template"
            value={features.maxTemplates === Infinity ? 'Illimitati' : `Max ${features.maxTemplates}`}
            active
          />
          <FeaturePill
            label="AI Import"
            value={features.aiImport ? 'Incluso' : 'Non incluso'}
            active={features.aiImport}
          />
          <FeaturePill
            label="Watermark"
            value={features.watermark ? 'Presente' : 'Rimosso'}
            active={!features.watermark}
          />
        </div>
      </div>

      <Separator />

      {/* Intestazione sezione piani */}
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold">
          {currentPlan === 'free' ? 'Scegli il piano giusto per te' : 'Cambia piano'}
        </h2>
        <p className="text-sm text-muted-foreground">
          Nessun contratto. Cancella quando vuoi.
        </p>
      </div>

      {/* Sezione prezzi (client — gestisce toggle mensile/annuale) */}
      {/* FIX-28: lifetime rimosso dai priceIds — piano non più venduto */}
      <PricingSection
        currentPlan={currentPlan}
        hasStripeCustomer={hasStripeCustomer}
        priceIds={{
          proMonthly:  process.env.STRIPE_PRICE_PRO_MONTHLY,
          proYearly:   process.env.STRIPE_PRICE_PRO_YEARLY,
          teamMonthly: process.env.STRIPE_PRICE_TEAM_MONTHLY,
          teamYearly:  process.env.STRIPE_PRICE_TEAM_YEARLY,
        }}
      />

      {/* Nota Free */}
      {currentPlan !== 'free' && (
        <p className="text-center text-xs text-muted-foreground">
          Piano Free disponibile gratuitamente con {FREE_DOC_LIMIT} preventivi e 1 template.
          Per tornare al piano gratuito, usa la sezione &quot;Gestisci abbonamento&quot;.
        </p>
      )}

    </div>
  )
}

function FeaturePill({
  label, value, active
}: { label: string; value: string; active: boolean }) {
  return (
    <div className={`rounded-lg px-3 py-2 text-center ${active ? 'bg-primary/5 border border-primary/10' : 'bg-gray-50 border border-gray-200'}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xs font-semibold mt-0.5 ${active ? 'text-primary' : 'text-muted-foreground'}`}>{value}</p>
    </div>
  )
}
