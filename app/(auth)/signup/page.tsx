// Server component — legge i searchParams e li passa al form client
import { SignupForm } from './_components/SignupForm'

interface Props {
  searchParams: Promise<{ ref?: string }>
}

export default async function SignupPage({ searchParams }: Props) {
  const { ref } = await searchParams
  return <SignupForm defaultRefCode={ref?.toUpperCase()} />
}
