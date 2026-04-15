import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ImpostazioniGenerali } from './tabs/generali'
import { ImpostazioniFiscali } from './tabs/fiscali'
import { ImpostazioniNotifiche } from './tabs/notifiche'
import { ImpostazioniPiano } from './tabs/piano'

export default async function ImpostazioniPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('*')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!workspace) redirect('/login')

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Impostazioni</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Gestisci il tuo profilo, le impostazioni fiscali e il piano.
        </p>
      </div>

      <Tabs defaultValue="generale">
        <TabsList className="w-full md:w-auto">
          <TabsTrigger value="generale">Generale</TabsTrigger>
          <TabsTrigger value="fiscale">Fiscale</TabsTrigger>
          <TabsTrigger value="notifiche">Notifiche</TabsTrigger>
          <TabsTrigger value="piano">Piano</TabsTrigger>
        </TabsList>

        <TabsContent value="generale" className="mt-6">
          <ImpostazioniGenerali workspace={workspace} userEmail={user.email ?? ''} />
        </TabsContent>

        <TabsContent value="fiscale" className="mt-6">
          <ImpostazioniFiscali workspace={workspace} />
        </TabsContent>

        <TabsContent value="notifiche" className="mt-6">
          <ImpostazioniNotifiche />
        </TabsContent>

        <TabsContent value="piano" className="mt-6">
          <ImpostazioniPiano workspace={workspace} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
