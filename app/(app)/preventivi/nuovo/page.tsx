import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft } from 'lucide-react'
import { PreventivoForm } from '../_components/PreventivoForm'

export default async function NuovoPreventivoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name, ragione_sociale, fiscal_regime, plan, vat_rate_default: fiscal_regime')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!workspace) redirect('/login')

  // Piano Free: max 10 documenti
  if (workspace.plan === 'free') {
    const { count } = await supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspace.id)
    if ((count ?? 0) >= 10) redirect('/preventivi')
  }

  // Carica template
  const { data: templates } = await supabase
    .from('templates')
    .select('id, name, is_default')
    .eq('workspace_id', workspace.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })

  const defaultTemplate = templates?.find((t) => t.is_default) ?? templates?.[0] ?? null

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
      />
    </div>
  )
}
