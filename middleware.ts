import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Route pubbliche — non richiedono autenticazione
const PUBLIC_PATHS = ['/', '/login', '/signup', '/reset-password']
const PUBLIC_PREFIXES = ['/p/', '/api/webhooks/', '/api/health', '/_next/', '/favicon']

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh della sessione — IMPORTANTE: non usare getUser() cached
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Utente non autenticato → redirect a /login (solo per route protette)
  if (!user && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Utente autenticato che visita login/signup → redirect a /dashboard
  if (user && (pathname === '/login' || pathname === '/signup')) {
    const redirectTo = request.nextUrl.searchParams.get('redirect') ?? '/dashboard'
    const url = request.nextUrl.clone()
    url.pathname = redirectTo
    url.searchParams.delete('redirect')
    return NextResponse.redirect(url)
  }

  // /onboarding è accessibile solo agli utenti autenticati (già gestito sopra)
  // Nessun check aggiuntivo necessario: il check di completamento è nel layout (app)

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
