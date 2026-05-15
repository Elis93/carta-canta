'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const SORT_OPTIONS = [
  { value: 'recent',      label: 'Più recenti' },
  { value: 'oldest',      label: 'Meno recenti' },
  { value: 'expiry',      label: 'Scadenza vicina' },
  { value: 'amount_desc', label: 'Importo ↓' },
  { value: 'amount_asc',  label: 'Importo ↑' },
]

export function SortSelect({ currentSort }: { currentSort?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'recent') {
      params.delete('sort')
    } else {
      params.set('sort', value)
    }
    router.push(`/preventivi?${params.toString()}`)
  }

  return (
    <Select value={currentSort ?? 'recent'} onValueChange={handleChange}>
      <SelectTrigger className="h-9 w-full sm:w-40 text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SORT_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
