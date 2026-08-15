// Server component — legge i searchParams e li passa al form client
import type { Metadata } from 'next'
import { SignupForm } from './_components/SignupForm'

// Senza, ereditava il titolo di default del layout auth («Accedi») → la pagina
// di registrazione si annunciava «Accedi» nella scheda del browser e nella SEO.
export const metadata: Metadata = { title: 'Registrati' }

interface Props {
  searchParams: Promise<{ ref?: string }>
}

export default async function SignupPage({ searchParams }: Props) {
  const { ref } = await searchParams
  return <SignupForm defaultRefCode={ref?.toUpperCase()} />
}
