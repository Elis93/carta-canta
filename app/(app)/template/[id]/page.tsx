import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { TemplateEditor } from '../_components/TemplateEditor'
import { DeleteTemplateButton } from '../_components/DeleteTemplateButton'
import { ArrowLeft, Star } from 'lucide-react'

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

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name, ragione_sociale, logo_url')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!workspace) redirect('/login')

  const { data: template } = await supabase
    .from('templates')
    .select('*')
    .eq('id', id)
    .eq('workspace_id', workspace.id)
    .maybeSingle()

  if (!template) notFound()

  const workspaceName = workspace.ragione_sociale ?? workspace.name

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
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

      <TemplateEditor
        mode="edit"
        templateId={id}
        defaultValues={template}
        workspaceName={workspaceName}
        logoUrl={workspace.logo_url}
      />

      <Separator />

      <div className="flex items-center justify-between gap-4 py-2">
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
