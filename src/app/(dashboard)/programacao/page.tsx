import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getAuthContext } from '@/lib/supabase/get-user'
import { createClient } from '@/lib/supabase/server'
import { ROUTES, ROLE_DEFAULT_ROUTES } from '@/constants/routes'
import { ProgramacaoSemana } from './_programacao'
import { PainelRecebimentos } from '@/components/recebimentos/painel-recebimentos'
import { listarClientesErp } from '@/services/clientes-erp.service'
import type { Programacao } from '@/types/programacao'
import type { Cliente } from '@/types/cliente'
import type { Transportadora } from '@/types/transportadora'
import type { RecebimentoPrevisto } from '@/services/recebimentos.service'

export const metadata: Metadata = {
  title: 'Programação de Carregamento',
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

export default async function ProgramacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string }>
}) {
  const { sessionUser, profile } = await getAuthContext()
  if (!sessionUser || !profile) redirect(ROUTES.LOGIN)

  const podeVer =
    profile.role === 'admin' || profile.role === 'logistica' ||
    profile.role === 'logistica_02' || profile.role === 'faturamento'
  if (!podeVer) redirect(ROLE_DEFAULT_ROUTES[profile.role] ?? ROUTES.HOME)

  const sp = await searchParams
  const refValida = sp?.semana && /^\d{4}-\d{2}-\d{2}$/.test(sp.semana)
  const segunda = refValida
    ? segundaDaSemana(new Date(sp!.semana + 'T12:00:00'))
    : segundaDaSemana(new Date())
  const semanaInicio = iso(segunda)
  const semanaFim = iso(addDias(segunda, 4))

  const supabase = await createClient()

  const SELECT_ITENS_FORMULA = `
      *,
      itens:programacao_itens (
        *,
        formula:formulas (
          id, nome, mo, map, calcario_concha, sulfato_amonia, carbonato_ca_mg,
          ureia, cloreto_potassio, boro, enxofre_pastilhado, fte_br_12, oxmag_s, tsp, caltimag, hiphos_25,
          ativo, created_at, updated_at
        )
      )`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buscarSemana = (select: string) => (supabase as any)
    .from('programacao_carregamento')
    .select(select)
    .gte('data', semanaInicio)
    .lte('data', semanaFim)
    .order('data', { ascending: true })
    .order('created_at', { ascending: true })
    .order('created_at', { foreignTable: 'programacao_itens', ascending: true })

  // Tenta com as relations de transportadora/motorista; se as migrations
  // 057/058 ainda não rodaram no banco, cai no SELECT antigo pra semana
  // nunca aparecer em branco.
  let { data: itens } = await buscarSemana(`${SELECT_ITENS_FORMULA},
      transportadora:transportadoras ( id, nome, profile_id, ativo, created_at, updated_at ),
      motorista:motoristas ( id, transportadora_id, nome, whatsapp, created_at, updated_at )`)
  if (!itens) {
    ;({ data: itens } = await buscarSemana(SELECT_ITENS_FORMULA))
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: formulas } = await (supabase as any)
    .from('formulas')
    .select('id, nome')
    .eq('ativo', true)
    .order('nome', { ascending: true })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: clientes } = await (supabase as any)
    .from('clientes_carregamento')
    .select('*')
    .order('nome', { ascending: true })

  const clientesErp = await listarClientesErp(supabase)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: transportadoras } = await (supabase as any)
    .from('transportadoras')
    .select('*')
    .eq('ativo', true)
    .order('nome', { ascending: true })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: recebimentos } = await (supabase as any)
    .from('recebimentos_previstos')
    .select('*')
    .eq('recebido', false)
    .order('data_prevista', { ascending: true })

  const podeEditar = profile.role === 'admin' || profile.role === 'logistica'

  return (
    <div className="flex flex-col gap-4">
      <ProgramacaoSemana
        key={semanaInicio}
        initialItens={(itens ?? []) as Programacao[]}
        formulas={(formulas ?? []) as { id: number; nome: string }[]}
        initialClientes={(clientes ?? []) as Cliente[]}
        clientesErp={clientesErp}
        transportadoras={(transportadoras ?? []) as Transportadora[]}
        semanaInicio={semanaInicio}
        semanaFim={semanaFim}
        hoje={iso(new Date())}
        podeEditar={podeEditar}
        podeConfirmar={profile.role === 'admin' || profile.role === 'faturamento'}
        usuario={profile.username}
      />
      <PainelRecebimentos
        initialRecebimentos={(recebimentos ?? []) as RecebimentoPrevisto[]}
        podeEditar={podeEditar}
      />
    </div>
  )
}
