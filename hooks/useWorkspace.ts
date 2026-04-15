'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'

type Workspace = Database['public']['Tables']['workspaces']['Row']

type UseWorkspaceReturn = {
  workspace: Workspace | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useWorkspace(): UseWorkspaceReturn {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('Non autenticato')
      setLoading(false)
      return
    }

    const { data, error: dbError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('owner_id', user.id)
      .maybeSingle()

    if (dbError) {
      setError('Errore nel caricamento del workspace.')
    } else {
      setWorkspace(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { workspace, loading, error, refetch: fetch }
}
