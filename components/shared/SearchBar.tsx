'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface SearchBarProps {
  placeholder?: string
  paramName?: string   // query param da usare nell'URL (default: 'q')
  className?: string
  onSearch?: (value: string) => void  // callback alternativa all'URL
  defaultValue?: string
}

export function SearchBar({
  placeholder = 'Cerca…',
  paramName = 'q',
  className,
  onSearch,
  defaultValue = '',
}: SearchBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(
    defaultValue || searchParams.get(paramName) || ''
  )
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Mantieni il valore in sync se cambia il searchParam esterno
  useEffect(() => {
    const current = searchParams.get(paramName) || ''
    if (current !== value) setValue(current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, paramName])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setValue(v)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (onSearch) {
        onSearch(v)
      } else {
        const params = new URLSearchParams(searchParams.toString())
        if (v) {
          params.set(paramName, v)
        } else {
          params.delete(paramName)
        }
        router.replace(`${pathname}?${params.toString()}`)
      }
    }, 300)
  }

  function handleClear() {
    setValue('')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (onSearch) {
      onSearch('')
    } else {
      const params = new URLSearchParams(searchParams.toString())
      params.delete(paramName)
      router.replace(`${pathname}?${params.toString()}`)
    }
  }

  return (
    <div className={`relative ${className ?? ''}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
      <Input
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="pl-9 pr-8"
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}
