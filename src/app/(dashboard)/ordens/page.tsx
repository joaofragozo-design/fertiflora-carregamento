import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getAuthContext } from '@/lib/supabase/get-user'
import { createClient } from '@/lib/supabase/server'
import { ROUTES } from '@/constants/routes'
import { OrdensParnel } from './_painel'
import { TvBoard } from './_tv-board'
import type { OrdemDiaria } from '@/types/formula'
import type { Programacao } from '@/types/programacao'
import type { Cliente } from '@/types/cliente'
import type { RecebimentoPrevisto } from '@/services/recebimentos.service'
import type { EstoqueAtual, EstoqueConfig } from '@/types/estoque'

export const metadata: Metadata = {
  title: 'Ordens Diárias de Carregamento',
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}
function addDias(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + n)
  return toDateString(new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 12))
}

export default async function OrdensPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string; vista?: string }>
}) {
  const { sessionUser, profile } = await getAuthContext()

  if (!sessionUser || !profile) redirect(ROUTES.LOGIN)

  const sp = await searchParams
  const hoje = sp?.data && /^\d{4}-\d{2}-\d{2}$/.test(sp.data) ? sp.data : toDateString(new Date())
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: ordens } = await (supabase as any)
    .from('ordens_diarias')
    .select(`
      *,
      itens:ordem_itens (
        *,
        formula:formulas (
          id, nome, mo, map, calcario_concha, sulfato_amonia, carbonato_ca_mg,
          ureia, cloreto_potassio, boro, enxofre_pastilhado, fte_br_12, oxmag_s, tsp, caltimag, hiphos_25,
          ativo, created_at, updated_at
        )
      )
    `)
    .eq('data', hoje)
    .order('sequencia', { ascending: true })
    .order('created_at', { foreignTable: 'ordem_itens', ascending: true })

  const ordensList = (ordens ?? []) as OrdemDiaria[]

  // Richardson (logistica_02) → sempre painel de TV.
  // Faturamento/logistica/admin → painel de TV sob demanda (?vista=tv), só leitura.
  // Fransua (logistica) e admin → tabela editável por padrão (lança os pedidos).
  const querTv =
    profile.role === 'logistica_02' ||
    (['faturamento', 'logistica', 'admin'].includes(profile.role) && sp?.vista === 'tv')

  if (querTv) {
    // Programação de hoje + próximos dias (até +7) para a prévia embutida na TV.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: prog } = await (supabase as any)
      .from('programacao_carregamento')
      .select('*, itens:programacao_itens (*, formula:formulas (id, nome))')
      .gte('data', hoje)
      .lte('data', addDias(hoje, 7))
      .order('data', { ascending: true })
      .order('created_at', { ascending: true })
      .order('created_at', { foreignTable: 'programacao_itens', ascending: true })

    // Previsão de chegada de matéria-prima (lançada na Programação de
    // Recebimento). Tenta com a relation de fornecedor + o filtro novo
    // (confirmado_em); se a migration 063 ainda não rodou, cai no SELECT E no
    // filtro antigos (recebido) — as duas colunas não coexistem antes dela,
    // então o fallback precisa trocar os dois juntos, não só o SELECT.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let { data: recebimentos } = await (supabase as any)
      .from('recebimentos_previstos')
      .select('*, fornecedor_rel:fornecedores ( id, nome, created_at, updated_at )')
      .is('confirmado_em', null)
      .order('data_prevista', { ascending: true })

    if (!recebimentos) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;({ data: recebimentos } = await (supabase as any)
        .from('recebimentos_previstos')
        .select('*')
        .eq('recebido', false)
        .order('data_prevista', { ascending: true }))
    }

    // Estoque em tempo real (migration 064) — se ainda não rodou, os arrays
    // ficam vazios e o painel simplesmente não aparece (sem quebrar a TV).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: estoqueAtual } = await (supabase as any).from('estoque_atual').select('*')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: estoqueConfig } = await (supabase as any).from('estoque_config').select('*')

    return (
      <TvBoard
        key={hoje}
        initialOrdens={ordensList}
        programacao={(prog ?? []) as Programacao[]}
        recebimentos={(recebimentos ?? []) as RecebimentoPrevisto[]}
        estoqueAtual={(estoqueAtual ?? []) as EstoqueAtual[]}
        estoqueConfig={(estoqueConfig ?? []) as EstoqueConfig[]}
        user={profile}
        hoje={hoje}
      />
    )
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

  return (
    <OrdensParnel
      key={hoje}
      initialOrdens={ordensList}
      initialFormulas={(formulas ?? []) as { id: number; nome: string }[]}
      initialClientes={(clientes ?? []) as Cliente[]}
      user={profile}
      hoje={hoje}
    />
  )
}
