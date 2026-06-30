import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getAuthContext } from '@/lib/supabase/get-user'
import { createClient } from '@/lib/supabase/server'
import { ROUTES, ROLE_DEFAULT_ROUTES } from '@/constants/routes'
import { ProgramacaoSemana } from './_programacao'
import type { Programacao } from '@/types/programacao'

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
    profile.role === 'admin' || profile.role === 'logistica' || profile.role === 'logistica_02'
  if (!podeVer) redirect(ROLE_DEFAULT_ROUTES[profile.role] ?? ROUTES.HOME)

  const sp = await searchParams
  const refValida = sp?.semana && /^\d{4}-\d{2}-\d{2}$/.test(sp.semana)
  const segunda = refValida
    ? segundaDaSemana(new Date(sp!.semana + 'T12:00:00'))
    : segundaDaSemana(new Date())
  const semanaInicio = iso(segunda)
  const semanaFim = iso(addDias(segunda, 4))

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: itens } = await (supabase as any)
    .from('programacao_carregamento')
    .select('*, formula:formulas (id, nome)')
    .gte('data', semanaInicio)
    .lte('data', semanaFim)
    .order('data', { ascending: true })
    .order('created_at', { ascending: true })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: formulas } = await (supabase as any)
    .from('formulas')
    .select('id, nome')
    .eq('ativo', true)
    .order('nome', { ascending: true })

  return (
    <ProgramacaoSemana
      key={semanaInicio}
      initialItens={(itens ?? []) as Programacao[]}
      formulas={(formulas ?? []) as { id: number; nome: string }[]}
      semanaInicio={semanaInicio}
      hoje={iso(new Date())}
      readOnly={profile.role === 'logistica_02'}
    />
  )
}
