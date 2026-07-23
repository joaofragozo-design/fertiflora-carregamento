import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getAuthContext } from '@/lib/supabase/get-user'
import { createClient } from '@/lib/supabase/server'
import { ROUTES, ROLE_DEFAULT_ROUTES } from '@/constants/routes'
import { RecebimentoSemana } from './_recebimento'
import type { RecebimentoPrevisto } from '@/services/recebimentos.service'
import type { Fornecedor } from '@/types/fornecedor'

export const metadata: Metadata = {
  title: 'Programação de Recebimento',
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}
function iso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function segundaDaSemana(ref: Date): Date {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())
  const dow = d.getDay() // 0 = domingo
  const diff = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + diff)
  return d
}
function addDias(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export default async function RecebimentoPage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string }>
}) {
  const { sessionUser, profile } = await getAuthContext()
  if (!sessionUser || !profile) redirect(ROUTES.LOGIN)

  const podeVer = profile.role === 'admin' || profile.role === 'logistica' || profile.role === 'faturamento'
  if (!podeVer) redirect(ROLE_DEFAULT_ROUTES[profile.role] ?? ROUTES.HOME)

  const sp = await searchParams
  const refValida = sp?.semana && /^\d{4}-\d{2}-\d{2}$/.test(sp.semana)
  const segunda = refValida
    ? segundaDaSemana(new Date(sp!.semana + 'T12:00:00'))
    : segundaDaSemana(new Date())
  const semanaInicio = iso(segunda)
  const semanaFim = iso(addDias(segunda, 4))

  const supabase = await createClient()

  // Tenta com a relation de fornecedor; se a migration 063 ainda não rodou,
  // cai no SELECT antigo pra semana nunca aparecer em branco.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buscarSemana = (select: string) => (supabase as any)
    .from('recebimentos_previstos')
    .select(select)
    .gte('data_prevista', semanaInicio)
    .lte('data_prevista', semanaFim)
    .order('data_prevista', { ascending: true })
    .order('created_at', { ascending: true })

  let { data: recebimentos } = await buscarSemana(
    '*, fornecedor_rel:fornecedores ( id, nome, created_at, updated_at )',
  )
  if (!recebimentos) {
    ;({ data: recebimentos } = await buscarSemana('*'))
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: fornecedores } = await (supabase as any)
    .from('fornecedores')
    .select('*')
    .order('nome', { ascending: true })

  const podeEditar = profile.role === 'admin' || profile.role === 'logistica'

  return (
    <RecebimentoSemana
      key={semanaInicio}
      initialRecebimentos={(recebimentos ?? []) as RecebimentoPrevisto[]}
      initialFornecedores={(fornecedores ?? []) as Fornecedor[]}
      semanaInicio={semanaInicio}
      semanaFim={semanaFim}
      hoje={iso(new Date())}
      podeEditar={podeEditar}
      podeConfirmar={profile.role === 'admin' || profile.role === 'faturamento'}
      usuario={profile.username}
    />
  )
}
