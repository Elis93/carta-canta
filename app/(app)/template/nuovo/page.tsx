import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { ArrowLeft, X } from 'lucide-react'
import { TemplateEditor } from '../_components/TemplateEditor'

export default async function NuovoTemplatePage() {
  const { supabase, user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
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
    <div className="max-w-5xl mx-auto lg:p-6 lg:space-y-5">
      {/* Header mobile: ✕ + titolo */}
      <div
        className="lg:hidden flex items-center gap-2.5"
        style={{ background: '#fff', borderBottom: '2px solid #c9a44c', padding: '12px 15px' }}
      >
        <Link href="/template" style={{ color: '#55534b', display: 'flex', alignItems: 'center' }}>
          <X size={25} />
        </Link>
        <span style={{ flex: 1, fontSize: 18, fontWeight: 600, fontFamily: "Georgia, 'Times New Roman', serif", color: '#1a1a2e' }}>Nuovo template</span>
        <span style={{ width: 24 }} />
      </div>

      {/* Breadcrumb + titolo desktop */}
      <div className="hidden lg:block space-y-5">
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
