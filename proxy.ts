import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Route pubbliche — accessibili senza sessione attiva
// ---------------------------------------------------------------------------
const PUBLIC_PATHS = new Set([
  '/',
  '/login',
  '/signup',
  '/reset-password',
  '/reset-password/confirm',
])

// Prefissi pubblici: qualsiasi path che inizia con uno di questi NON viene
// rediretto a /login. Le API gestiscono l'auth autonomamente (risposta 401 JSON),
// i path /p/ sono preventivi pubblici per i clienti.
const PUBLIC_PREFIXES = ['/p/', '/api/', '/auth/', '/_next/', '/favicon']

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

// ---------------------------------------------------------------------------
// Helper: crea un redirect che porta con sé i cookie aggiornati da Supabase
// ---------------------------------------------------------------------------
// PERCHÉ: quando getUser() rinnova l'access token, i nuovi cookie vengono
// scritti in `supabaseResponse`. Se restituiamo un NextResponse.redirect()
// diverso senza copiare quei cookie, il browser non riceve mai i token
// aggiornati e la sessione va fuori sync al request successivo.
function makeRedirect(dest: URL, supabaseResponse: NextResponse): NextResponse {
  const res = NextResponse.redirect(dest)
  supabaseResponse.cookies.getAll().forEach(({ name, value, ...opts }) => {
    res.cookies.set(name, value, opts)
  })
  return res
}

// ---------------------------------------------------------------------------
// Proxy principale (ex middleware — rinominato per Next.js 16 convention)
// ---------------------------------------------------------------------------
export async function proxy(request: NextRequest) {
  // Risposta base "passa oltre". Sarà sostituita da setAll() se Supabase
  // rinnova i cookie di sessione durante getUser().
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        // setAll viene invocato da getUser() solo se l'access token è scaduto
        // e Supabase lo rinnova automaticamente con il refresh token.
        //
        // Doppia operazione intenzionale (pattern ufficiale Supabase):
        // 1. request.cookies.set() → muta la request in-memory in modo che
        //    i Server Component vedano il token aggiornato tramite cookies()
        //    (NextResponse.next({ request }) propaga la request mutata all'RSC).
        // 2. Ricrea supabaseResponse con la request mutata → include i nuovi
        //    Set-Cookie nella risposta HTTP verso il browser.
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

  // IMPORTANTE: non inserire alcun codice tra createServerClient e getUser()
  // che legga/scriva cookie — invaliderebbe il meccanismo di refresh.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // ── Utente AUTENTICATO ────────────────────────────────────────────────────

  if (user) {
    // / → /dashboard
    if (pathname === '/') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      url.search = ''
      return makeRedirect(url, supabaseResponse)
    }

    // /login o /signup → /dashboard (o al path salvato in ?redirect=)
    if (pathname === '/login' || pathname === '/signup') {
      const raw = request.nextUrl.searchParams.get('redirect') ?? '/dashboard'

      // Sanity check: il parametro redirect deve essere un path interno e
      // non può puntare di nuovo a /login, /signup o ad un'API route.
      // Questo evita loop da ?redirect=/login e da URL manipolati.
      const isSafe =
        raw.startsWith('/') &&
        raw !== '/login' &&
        raw !== '/signup' &&
        !raw.startsWith('/api/')

      const url = request.nextUrl.clone()
      url.pathname = isSafe ? raw : '/dashboard'
      url.search = '' // rimuove tutti i query param, incluso ?redirect=
      return makeRedirect(url, supabaseResponse)
    }

    // Tutte le altre route: utente autenticato → passa attraverso.
    // È fondamentale restituire supabaseResponse (non NextResponse.next())
    // perché contiene i cookie aggiornati da propagare al browser.
    return supabaseResponse
  }

  // ── Utente NON AUTENTICATO ─────────────────────────────────────────────────

  if (!isPublicPath(pathname)) {
    // Path protetto senza sessione → redirect a /login con path di ritorno.
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('redirect', pathname)
    return makeRedirect(loginUrl, supabaseResponse)
  }

  // Path pubblico senza sessione → passa attraverso.
  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Esegui il proxy su tutti i path TRANNE:
     * - _next/static   (bundle JS/CSS)
     * - _next/image    (ottimizzazione immagini)
     * - favicon.ico
     * - file con estensioni immagine comuni
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
