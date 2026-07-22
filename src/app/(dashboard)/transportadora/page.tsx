import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getAuthContext } from '@/lib/supabase/get-user'
import { createClient } from '@/lib/supabase/server'
import { ROUTES, ROLE_DEFAULT_ROUTES } from '@/constants/routes'
import type { Programacao } from '@/types/programacao'
import type { Transportadora, Motorista } from '@/types/transportadora'
import { PainelTransportadora } from './_painel'

export const metadata: Metadata = {
  title: 'Meus Carregamentos',
}

export default async function TransportadoraPage() {
  const { sessionUser, profile } = await getAuthContext()
  if (!sessionUser || !profile) redirect(ROUTES.LOGIN)
  if (profile.role !== 'transportadora') redirect(ROLE_DEFAULT_ROUTES[profile.role] ?? ROUTES.HOME)

  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: transportadora } = await (supabase as any)
    .from('transportadoras')
    .select('*')
    .eq('profile_id', profile.id)
    .maybeSingle()

  if (!transportadora) {
    return (
      <div className="text-center py-24 text-industrial-400">
        Seu login ainda não está vinculado a uma transportadora. Fale com a logística da Fertiflora.
      </div>
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: agendamentos } = await (supabase as any)
    .from('programacao_carregamento')
    .select(`
      *,
      itens:programacao_itens (
        *,
        formula:formulas ( id, nome )
      ),
      motorista:motoristas ( id, transportadora_id, nome, whatsapp, created_at, updated_at )
    `)
    .eq('transportadora_id', transportadora.id)
    .not('solicitacao_status', 'is', null)
    .order('data', { ascending: false })
    .order('created_at', { ascending: true })
    .order('created_at', { foreignTable: 'programacao_itens', ascending: true })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: motoristas } = await (supabase as any)
    .from('motoristas')
    .select('*')
    .eq('transportadora_id', transportadora.id)
    .order('nome', { ascending: true })

  return (
    <PainelTransportadora
      transportadora={transportadora as Transportadora}
      initialAgendamentos={(agendamentos ?? []) as Programacao[]}
      initialMotoristas={(motoristas ?? []) as Motorista[]}
    />
  )
}
