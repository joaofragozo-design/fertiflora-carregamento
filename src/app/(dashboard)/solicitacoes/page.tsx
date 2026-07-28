import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getAuthContext } from '@/lib/supabase/get-user'
import { createClient } from '@/lib/supabase/server'
import { ROUTES, ROLE_DEFAULT_ROUTES } from '@/constants/routes'
import { ProgramacaoService } from '@/services/programacao.service'
import { PainelSolicitacoes } from '@/components/transportadoras/painel-solicitacoes'

export const metadata: Metadata = {
  title: 'Solicitações de Carregamento',
}

export default async function SolicitacoesPage() {
  const { sessionUser, profile } = await getAuthContext()
  if (!sessionUser || !profile) redirect(ROUTES.LOGIN)

  const podeGerenciar = profile.role === 'admin' || profile.role === 'logistica'
  if (!podeGerenciar) redirect(ROLE_DEFAULT_ROUTES[profile.role] ?? ROUTES.HOME)

  const supabase = await createClient()
  const progSvc = new ProgramacaoService(supabase)
  const solicitacoes = await progSvc.getPendentesLiberacao().catch(() => [])

  return (
    <div className="flex flex-col gap-4">
      <PainelSolicitacoes initialSolicitacoes={solicitacoes} usuario={profile.username} />
    </div>
  )
}
