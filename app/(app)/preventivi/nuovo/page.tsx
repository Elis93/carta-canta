import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { PreventivoForm } from '../_components/PreventivoForm'
import { peekNextDocNumber } from '@/lib/actions/documents'
import { checkFreeBlock, FREE_DOC_LIMIT } from '@/lib/free-trial'

interface Props {
  searchParams: Promise<{ client_id?: string }>
}

export default async function NuovoPreventivoPage({ searchParams }: Props) {
  const { client_id } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name, ragione_sociale, fiscal_regime, plan, validity_days, free_trial_expires_at, sent_quota_used')
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
        .from('workspaces').select('id, name, ragione_sociale, fiscal_regime, plan, validity_days, free_trial_expires_at, sent_quota_used')
        .eq('id', membership.workspace_id)
        .maybeSingle()
      workspace = mw
    }
  }
  if (!workspace) redirect('/login')

  // Piano Free: controlla blocco trial (scadenza o quota)
  const freeTrialStatus = workspace.plan === 'free'
    ? checkFreeBlock(workspace)
    : null

  // Carica template
  const { data: templates } = await supabase
    .from('templates')
    .select('id, name, is_default')
    .eq('workspace_id', workspace.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })

  const defaultTemplate = templates?.find((t) => t.is_default) ?? templates?.[0] ?? null

  // Anteprima del prossimo numero disponibile (senza incrementare la sequenza)
  const nextDocNumber = await peekNextDocNumber(workspace.id)

  // Pre-carica il cliente se client_id è presente nell'URL
  let defaultClient: { id: string; name: string; email: string | null; phone: string | null; piva: string | null } | null = null
  if (client_id) {
    const { data: cl } = await supabase
      .from('clients')
      .select('id, name, email, phone, piva')
      .eq('id', client_id)
      .eq('workspace_id', workspace.id)
      .maybeSingle()
    defaultClient = cl ?? null
  }

  if (freeTrialStatus?.blocked) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/preventivi" className="flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="size-3.5" /> Preventivi
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">Nuovo preventivo</span>
        </div>
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium mb-1">
              {freeTrialStatus.reason === 'trial_expired'
                ? 'Il periodo di prova è terminato'
                : `Limite di ${FREE_DOC_LIMIT} preventivi raggiunto`}
            </p>
            <p className="mb-3">
              {freeTrialStatus.reason === 'trial_expired'
                ? 'Il tuo periodo di prova Free è scaduto. Non puoi creare nuovi preventivi.'
                : `Hai già inviato ${freeTrialStatus.docsUsed} preventivi con il piano Free. Non puoi crearne altri.`}
            </p>
            <Link
              href="/abbonamento"
              className="inline-flex items-center rounded-md bg-red-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-800"
            >
              Passa a Pro — preventivi illimitati
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/preventivi" className="flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Preventivi
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">Nuovo preventivo</span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">Nuovo preventivo</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Compila le voci e salva — il totale viene calcolato automaticamente.
        </p>
      </div>

      <PreventivoForm
        mode="create"
        templates={(templates ?? []) as Array<{ id: string; name: string; is_default: boolean | null }>}
        defaultTemplateId={defaultTemplate?.id ?? null}
        fiscalRegime={workspace.fiscal_regime}
        isProPlan={workspace.plan !== 'free'}
        nextDocNumber={nextDocNumber}
        defaultValidityDays={workspace.validity_days ?? 30}
        defaultClient={defaultClient}
      />
    </div>
  )
}
