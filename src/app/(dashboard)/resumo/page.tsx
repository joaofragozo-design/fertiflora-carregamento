import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getAuthContext } from '@/lib/supabase/get-user'
import { createClient } from '@/lib/supabase/server'
import { ROUTES, ROLE_DEFAULT_ROUTES } from '@/constants/routes'
import { ResumoMensal, type DiaCarregado } from './_resumo'

export const metadata: Metadata = {
  title: 'Resumo',
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}
/** Hoje no fuso da fábrica (a Vercel roda em UTC). */
function hojeEmBrasilia(): { iso: string; mes: string } {
  const iso = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  return { iso, mes: iso.slice(0, 7) }
}
/**
 * Intervalo das semanas que aparecem na agenda do mês: da segunda da semana do dia 1 ao sábado da
 * semana do último dia. As semanas que atravessam o mês (ex.: 31/08–05/09) somam os 6 dias; só o
 * total do mês, no rodapé, fica restrito aos dias do próprio mês.
 */
function intervaloDasSemanas(mes: string): { inicio: string; fim: string } {
  const [y, m] = mes.split('-').map(Number)
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const primeiro = new Date(y, m - 1, 1, 12)
  const ultimo = new Date(y, m, 0, 12)
  const dowP = primeiro.getDay()
  primeiro.setDate(primeiro.getDate() + (dowP === 0 ? 1 : 1 - dowP)) // domingo dia 1 -> semana começa no dia 2
  const dowU = ultimo.getDay()
  ultimo.setDate(ultimo.getDate() + (dowU === 0 ? -1 : 6 - dowU))
  return { inicio: iso(primeiro), fim: iso(ultimo) }
}

/**
 * Resumo mensal do que foi carregado — agenda do mês com a tonelagem de cada
 * dia, total por semana e total do mês. A régua é a mesma do relatório diário
 * e do painel do login: ordens diárias FINALIZADAS, tonelagem = soma dos itens.
 */
export default async function ResumoPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>
}) {
  const { sessionUser, profile } = await getAuthContext()
  if (!sessionUser || !profile) redirect(ROUTES.LOGIN)

  const podeVer =
    profile.role === 'admin' || profile.role === 'logistica' ||
    profile.role === 'logistica_02' || profile.role === 'faturamento'
  if (!podeVer) redirect(ROLE_DEFAULT_ROUTES[profile.role] ?? ROUTES.HOME)

  const { iso: hoje, mes: mesAtual } = hojeEmBrasilia()
  const sp = await searchParams
  const mes = sp?.mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.mes) && sp.mes <= mesAtual ? sp.mes : mesAtual

  const supabase = await createClient()

  // Primeiro carregamento registrado — limite inferior do seletor de mês.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: primeiro } = await (supabase as any)
    .from('ordens_diarias')
    .select('data')
    .eq('finalizado', true)
    .order('data', { ascending: true })
    .limit(1)
    .maybeSingle()
  const primeiroMes: string = (primeiro?.data as string | undefined)?.slice(0, 7) ?? mesAtual

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: ordens } = await (supabase as any)
    .from('ordens_diarias')
    .select('data, itens:ordem_itens(tons)')
    .eq('finalizado', true)
    .gte('data', intervaloDasSemanas(mes).inicio)
    .lte('data', intervaloDasSemanas(mes).fim)

  const dias: Record<string, DiaCarregado> = {}
  for (const o of (ordens ?? []) as { data: string; itens: { tons: number | null }[] | null }[]) {
    const tons = (o.itens ?? []).reduce((s, i) => s + (i.tons ?? 0), 0)
    const atual = dias[o.data] ?? { tons: 0, cargas: 0 }
    dias[o.data] = { tons: atual.tons + tons, cargas: atual.cargas + 1 }
  }

  return (
    <ResumoMensal
      mes={mes}
      mesAtual={mesAtual}
      primeiroMes={primeiroMes < mesAtual ? primeiroMes : mesAtual}
      hoje={hoje}
      dias={dias}
    />
  )
}
