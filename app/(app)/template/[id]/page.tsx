import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { TemplateEditor } from '../_components/TemplateEditor'
import { DeleteTemplateButton } from '../_components/DeleteTemplateButton'
import { ArrowLeft, Star, X } from 'lucide-react'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditTemplatePage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let { data: workspace } = await supabase
    .from('workspaces')
    .select('id, plan, name, ragione_sociale, logo_url')
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
        .from('workspaces').select('id, plan, name, ragione_sociale, logo_url')
        .eq('id', membership.workspace_id)
        .maybeSingle()
      workspace = mw
    }
  }
  if (!workspace) redirect('/login')

  const { data: template } = await supabase
    .from('templates')
    .select('*')
    .eq('id', id)
    .eq('workspace_id', workspace.id)
    .maybeSingle()

  if (!template) notFound()

  const workspaceName = workspace.ragione_sociale ?? workspace.name
  const isPro = workspace.plan !== 'free'

  return (
    <div className="max-w-5xl mx-auto lg:p-6 lg:space-y-5">
      {/* Header mobile: ✕ + titolo (mockup "Modifica template") */}
      <div
        className="lg:hidden flex items-center gap-2.5"
        style={{ background: '#fff', borderBottom: '0.5px solid #eeeeee', padding: '12px 15px' }}
      >
        <Link href="/template" style={{ color: '#55534b', display: 'flex', alignItems: 'center' }}>
          <X size={25} />
        </Link>
        <span style={{ flex: 1, fontSize: 17, fontWeight: 600, color: '#161616' }}>Modifica template</span>
        <span style={{ width: 24 }} />
      </div>

      {/* Breadcrumb + titolo desktop */}
      <div className="hidden lg:block space-y-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/template" className="flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="size-3.5" /> Template
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">{template.name}</span>
          {template.is_default && (
            <Badge variant="secondary" className="text-xs flex items-center gap-1 ml-1">
              <Star className="size-3" /> Default
            </Badge>
          )}
        </div>

        <div>
          <h1 className="text-2xl font-semibold">{template.name}</h1>
          {template.description && (
            <p className="text-muted-foreground text-sm mt-0.5">{template.description}</p>
          )}
        </div>
      </div>

      <TemplateEditor
        mode="edit"
        isPro={isPro}
        templateId={id}
        defaultValues={template}
        workspaceName={workspaceName}
        logoUrl={workspace.logo_url}
      />

      <Separator className="hidden lg:block" />

      <div className="flex items-center justify-between gap-4 py-2 px-4 pb-6 lg:px-0 lg:pb-0">
        <div>
          <p className="text-sm font-medium">Elimina template</p>
          <p className="text-xs text-muted-foreground">
            I preventivi che lo usano non verranno modificati.
          </p>
        </div>
        <DeleteTemplateButton templateId={id} templateName={template.name} />
      </div>
    </div>
  )
}
