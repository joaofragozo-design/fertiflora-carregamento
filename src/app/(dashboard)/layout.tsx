import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getAuthContext } from '@/lib/supabase/get-user'
import { DashboardShell } from '@/components/layout/dashboard-shell'
import { ROUTES } from '@/constants/routes'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { sessionUser, profile } = await getAuthContext()

  const headersList = await headers()
  const pathname    = headersList.get('x-pathname') ?? ''

  if (!sessionUser) redirect(ROUTES.LOGIN)
  if (!profile)     redirect(ROUTES.LOGIN)

  // ── Routing centralizado por role ─────────────────────────────
  if (profile.role === 'operador_pa' && pathname.startsWith(ROUTES.CARREGAMENTO)) {
    redirect(ROUTES.PA)
  }
  if (profile.role === 'operador_carregamento' && pathname.startsWith(ROUTES.PA)) {
    redirect(ROUTES.CARREGAMENTO)
  }
  // logística: /ordens, /programacao e /admin
  if (
    profile.role === 'logistica' &&
    !pathname.startsWith(ROUTES.ORDENS) &&
    !pathname.startsWith(ROUTES.PROGRAMACAO) &&
    !pathname.startsWith('/admin')
  ) {
    redirect(ROUTES.ORDENS)
  }
  // logística 02: /ordens e /programacao (prévia)
  if (
    profile.role === 'logistica_02' &&
    !pathname.startsWith(ROUTES.ORDENS) &&
    !pathname.startsWith(ROUTES.PROGRAMACAO)
  ) {
    redirect(ROUTES.ORDENS)
  }

  return (
    <DashboardShell user={profile}>
      {children}
    </DashboardShell>
  )
}
