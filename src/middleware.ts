import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    // Exclui `api` (rotas de API se protegem sozinhas e respondem JSON — nunca
    // devem ser redirecionadas para o HTML de login), assets estáticos e os
    // arquivos públicos do PWA (manifest.webmanifest e sw.js) — sem essa
    // exclusão, um fetch sem sessão válida (ex.: <link rel="manifest">) era
    // redirecionado pro HTML de login, e o navegador tentava parsear aquele
    // HTML como JSON ("Manifest: Line 1, Syntax error").
    '/((?!api|_next/static|_next/image|favicon.ico|manifest\\.webmanifest|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
