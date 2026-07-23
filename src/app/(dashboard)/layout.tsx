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
  // logística: /ordens, /programacao, /recebimento, /admin e /transportadoras (gestão)
  if (
    profile.role === 'logistica' &&
    !pathname.startsWith(ROUTES.ORDENS) &&
    !pathname.startsWith(ROUTES.PROGRAMACAO) &&
    !pathname.startsWith(ROUTES.RECEBIMENTO) &&
    !pathname.startsWith('/admin') &&
    !pathname.startsWith(ROUTES.TRANSPORTADORAS)
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
  // faturamento: acompanha /ordens, /programacao e /recebimento (confirma chegada)
  if (
    profile.role === 'faturamento' &&
    !pathname.startsWith(ROUTES.ORDENS) &&
    !pathname.startsWith(ROUTES.PROGRAMACAO) &&
    !pathname.startsWith(ROUTES.RECEBIMENTO)
  ) {
    redirect(ROUTES.ORDENS)
  }
  // transportadora: só a própria tela (/transportadora — checagem exata pra não
  // colidir com /transportadoras, a tela de gestão da Logística/admin)
  if (
    profile.role === 'transportadora' &&
    pathname !== ROUTES.TRANSPORTADORA &&
    !pathname.startsWith(`${ROUTES.TRANSPORTADORA}/`)
  ) {
    redirect(ROUTES.TRANSPORTADORA)
  }

  return (
    <DashboardShell user={profile}>
      {children}
    </DashboardShell>
  )
}
