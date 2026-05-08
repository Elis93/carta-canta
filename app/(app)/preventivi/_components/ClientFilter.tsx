'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ClientFilterProps {
  clients: { id: string; name: string }[]
  currentClientId?: string
}

export function ClientFilter({ clients, currentClientId }: ClientFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== '__all__') {
      params.set('client_id', value)
    } else {
      params.delete('client_id')
    }
    router.push(`/preventivi?${params.toString()}`)
  }

  return (
    <Select value={currentClientId ?? '__all__'} onValueChange={handleChange}>
      <SelectTrigger className="h-9 w-full sm:w-44 text-sm">
        <SelectValue placeholder="Tutti i clienti" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">Tutti i clienti</SelectItem>
        {clients.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
