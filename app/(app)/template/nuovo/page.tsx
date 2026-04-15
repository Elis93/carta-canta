import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TemplateEditor } from '../_components/TemplateEditor'

export default async function NuovoTemplatePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name, plan, ragione_sociale, logo_url')
    .eq('owner_id', user.id)
    .maybeSingle()
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

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Nuovo template</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Personalizza l&apos;aspetto del tuo preventivo.
        </p>
      </div>
      <TemplateEditor
        mode="create"
        workspaceName={workspaceName}
        logoUrl={workspace.logo_url}
      />
    </div>
  )
}
