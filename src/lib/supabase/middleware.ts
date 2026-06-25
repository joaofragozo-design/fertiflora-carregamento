import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'
import type { Database } from '@/types/database'
import { ROUTES } from '@/constants/routes'

const PUBLIC_ROUTES = [ROUTES.LOGIN]

/** Extrai apenas a origin de uma URL, descartando qualquer path acidental. */
function sanitizeSupabaseUrl(raw: string): string {
  try {
    return new URL(raw).origin   // https://xxx.supabase.co
  } catch {
    return raw
  }
}

export async function updateSession(request: NextRequest) {
  const rawUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const isUnconfigured =
    !rawUrl  || rawUrl.includes('your_supabase')  ||
    !anonKey || anonKey.includes('your_supabase')

  if (isUnconfigured) {
    return NextResponse.next({ request })
  }

  const supabaseUrl = sanitizeSupabaseUrl(rawUrl!)

  // Injeta x-pathname nos headers de REQUEST para que Server Components possam
  // lê-lo via `headers()` do next/headers (response headers não são acessíveis).
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', request.nextUrl.pathname)

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  })

  const supabase = createServerClient<Database>(supabaseUrl, anonKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        )
        // Preserva requestHeaders ao recriar a resposta para não perder x-pathname
        supabaseResponse = NextResponse.next({
          request: { headers: requestHeaders },
        })
        cookiesToSet.forEach(({ name, value, options }) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          supabaseResponse.cookies.set(name, value, options as any)
        )
      },
    },
  })

  // Nunca use getSession() no middleware — getUser() valida o JWT no servidor
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route))

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = ROUTES.LOGIN
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
