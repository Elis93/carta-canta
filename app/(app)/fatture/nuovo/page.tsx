import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft } from 'lucide-react'
import { FatturaForm } from '../_components/FatturaForm'
import { peekNextInvoiceNumber } from '@/lib/actions/documents'

export default async function NuovaFatturaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, fiscal_regime, plan, invoice_prefix')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!workspace) redirect('/login')

  const { data: templates } = await supabase
    .from('templates')
    .select('id, name, is_default')
    .eq('workspace_id', workspace.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })

  const defaultTemplate = templates?.find((t) => t.is_default) ?? templates?.[0] ?? null
  const prefix = (workspace.invoice_prefix as string | null) ?? ''
  const nextInvoiceNumber = await peekNextInvoiceNumber(workspace.id, prefix)

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/fatture" className="flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Fatture
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">Nuova fattura</span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">Nuova fattura</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Compila le voci e salva — il totale viene calcolato automaticamente.
        </p>
      </div>

      <FatturaForm
        templates={(templates ?? []) as Array<{ id: string; name: string; is_default: boolean | null }>}
        defaultTemplateId={defaultTemplate?.id ?? null}
        fiscalRegime={workspace.fiscal_regime}
        isProPlan={workspace.plan !== 'free'}
        nextInvoiceNumber={nextInvoiceNumber}
      />
    </div>
  )
}
