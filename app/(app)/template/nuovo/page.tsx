import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft } from 'lucide-react'
import { TemplateEditor } from '../_components/TemplateEditor'

export default async function NuovoTemplatePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name, plan, ragione_sociale, logo_url')
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
        .from('workspaces').select('id, name, plan, ragione_sociale, logo_url')
        .eq('id', membership.workspace_id)
        .maybeSingle()
      workspace = mw
    }
  }
  if (!workspace) redirect('/login')

  // Blocca piano Free se ha già 1 template
  if (workspace.plan === 'free') {
    const { count } = await supabase
      .from('templates')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspace.id)
    if ((count ?? 0) >= 1) redirect('/template')
  }

  const workspaceName = workspace.ragione_sociale ?? workspace.name
  const isPro = workspace.plan !== 'free'

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/template" className="flex items-center gap-1 hover:text-foreground transition-colors">
          <ArrowLeft className="size-3.5" /> Template
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">Nuovo template</span>
      </div>
      <div>
        <h1 className="text-2xl font-semibold">Nuovo template</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Personalizza l&apos;aspetto del tuo preventivo.
        </p>
      </div>
      <TemplateEditor
        mode="create"
        isPro={isPro}
        workspaceName={workspaceName}
        logoUrl={workspace.logo_url}
      />
    </div>
  )
}
