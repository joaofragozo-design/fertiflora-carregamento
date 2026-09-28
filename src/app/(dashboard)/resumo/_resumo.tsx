'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Truck } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { PageTitle } from '@/components/ui/page-header'
import { ROUTES } from '@/constants/routes'

export interface DiaCarregado {
  tons: number
  cargas: number
}

interface ResumoMensalProps {
  /** Mês exibido, YYYY-MM. */
  mes: string
  /** Mês corrente (limite superior do seletor). */
  mesAtual: string
  /** Mês do primeiro carregamento registrado (limite inferior do seletor). */
  primeiroMes: string
  /** YYYY-MM-DD de hoje no fuso da fábrica. */
  hoje: string
  /** Tonelagem e nº de cargas finalizadas por dia (YYYY-MM-DD) dentro do mês. */
  dias: Record<string, DiaCarregado>
}

const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const

function pad(n: number): string {
  return String(n).padStart(2, '0')
}
function iso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function addMeses(mes: string, n: number): string {
  const [y, m] = mes.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}
function nomeDoMes(mes: string): string {
  const [y, m] = mes.split('-').map(Number)
  const nome = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return nome.charAt(0).toUpperCase() + nome.slice(1)
}
/** Lista de meses (YYYY-MM) do primeiro registro até o mês corrente, do mais recente pro mais antigo. */
function mesesDisponiveis(primeiro: string, atual: string): string[] {
  const lista: string[] = []
  for (let m = atual; m >= primeiro && lista.length < 240; m = addMeses(m, -1)) lista.push(m)
  return lista
}
function fmtTons(t: number): string {
  return t.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface DiaCelula {
  iso: string
  dia: number
  noMes: boolean
}
interface Semana {
  /** Seg..Sáb (6 células). */
  dias: DiaCelula[]
}

/** Semanas do mês, de segunda a sábado, incluindo os dias "de fora" nas pontas (renderizados apagados). */
function semanasDoMes(mes: string): Semana[] {
  const [y, m] = mes.split('-').map(Number)
  const primeiro = new Date(y, m - 1, 1)
  const ultimo = new Date(y, m, 0)
  const cursor = new Date(primeiro)
  const dow = cursor.getDay() // 0 = domingo
  cursor.setDate(cursor.getDate() + (dow === 0 ? 1 : 1 - dow)) // segunda da 1ª semana (dia 1 no domingo: começa no dia 2)
  const semanas: Semana[] = []
  while (cursor <= ultimo) {
    const dias: DiaCelula[] = []
    for (let i = 0; i < 6; i++) {
      dias.push({ iso: iso(cursor), dia: cursor.getDate(), noMes: cursor.getMonth() === m - 1 })
      cursor.setDate(cursor.getDate() + 1)
    }
    cursor.setDate(cursor.getDate() + 1) // pula o domingo
    semanas.push({ dias })
  }
  return semanas
}

/**
 * Agenda mensal do carregado: um quadro por dia útil com a tonelagem e o nº de
 * cargas finalizadas, o total da semana no fim de cada linha e o total do mês
 * no rodapé. Sábado só aparece se algum sábado do mês teve carga.
 */
export function ResumoMensal({ mes, mesAtual, primeiroMes, hoje, dias }: ResumoMensalProps) {
  const router = useRouter()
  const semanas = useMemo(() => semanasDoMes(mes), [mes])
  const meses = useMemo(() => mesesDisponiveis(primeiroMes, mesAtual), [primeiroMes, mesAtual])

  const temSabado = semanas.some((s) => (dias[s.dias[5].iso]?.tons ?? 0) > 0)
  const colunas = temSabado ? 6 : 5

  const totalMes = useMemo(() => {
    let tons = 0, cargas = 0, diasComCarga = 0
    // Só os dias do próprio mês: as pontas das semanas vizinhas entram no total da semana, não no do mês.
    for (const [data, d] of Object.entries(dias)) {
      if (!data.startsWith(mes)) continue
      tons += d.tons
      cargas += d.cargas
      if (d.cargas > 0) diasComCarga++
    }
    return { tons, cargas, diasComCarga }
  }, [dias, mes])

  const irParaMes = (novo: string) => router.push(`${ROUTES.RESUMO}?mes=${novo}`)
  const anterior = addMeses(mes, -1)
  const proximo = addMeses(mes, 1)
  const podeVoltar = anterior >= primeiroMes
  const podeAvancar = proximo <= mesAtual

  return (
    <div className="flex flex-col gap-4">
      {/* Cabeçalho + seletor de mês */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <PageTitle className="font-extrabold">Resumo do mês</PageTitle>
          <p className="mt-1 text-xs text-industrial-600">Toneladas carregadas por dia, cargas finalizadas. Mesma régua do relatório diário.</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => irParaMes(anterior)}
            disabled={!podeVoltar}
            aria-label="Mês anterior"
            className="rounded-lg border border-industrial-300 p-1.5 text-industrial-600 transition-colors hover:border-brand-500 hover:text-industrial-900 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronLeft className="size-4" />
          </button>
          <label className="sr-only" htmlFor="resumo-mes">Mês</label>
          <select
            id="resumo-mes"
            value={mes}
            onChange={(e) => irParaMes(e.target.value)}
            className="rounded-lg border border-industrial-300 bg-industrial-50 px-3 py-1.5 text-sm font-medium text-industrial-900 focus:border-brand-500 focus:outline-none"
          >
            {meses.map((m) => (
              <option key={m} value={m}>{nomeDoMes(m)}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => irParaMes(proximo)}
            disabled={!podeAvancar}
            aria-label="Próximo mês"
            className="rounded-lg border border-industrial-300 p-1.5 text-industrial-600 transition-colors hover:border-brand-500 hover:text-industrial-900 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {/* Agenda */}
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          {/* Cabeçalho dos dias */}
          <div
            className="grid gap-2 pb-1.5"
            style={{ gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr)) minmax(120px, 0.9fr)` }}
          >
            {DIAS_SEMANA.slice(0, colunas).map((d) => (
              <div key={d} className="px-1 font-display text-[11px] font-bold uppercase tracking-wide text-industrial-500">{d}</div>
            ))}
            <div className="px-1 text-right font-display text-[11px] font-bold uppercase tracking-wide text-brand-300">Semana</div>
          </div>

          <div className="flex flex-col gap-2">
            {semanas.map((semana, idx) => {
              const diasVisiveis = semana.dias.slice(0, colunas)
              const totalSemana = diasVisiveis.reduce(
                (acc, d) => {
                  const info = dias[d.iso]
                  return info ? { tons: acc.tons + info.tons, cargas: acc.cargas + info.cargas } : acc
                },
                { tons: 0, cargas: 0 },
              )
              return (
                <div
                  key={idx}
                  className="grid gap-2"
                  style={{ gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr)) minmax(120px, 0.9fr)` }}
                >
                  {diasVisiveis.map((d) => {
                    const info = dias[d.iso]
                    const ehHoje = d.iso === hoje
                    const comCarga = !!info && info.cargas > 0
                    return (
                      <div
                        key={d.iso}
                        aria-label={`${d.dia}${d.noMes ? '' : ' (mês vizinho)'}: ${info ? `${fmtTons(info.tons)} toneladas em ${info.cargas} ${info.cargas === 1 ? 'carga' : 'cargas'}` : 'sem carga'}`}
                        title={d.noMes ? undefined : 'Dia do mês vizinho: entra no total da semana, não no total do mês'}
                        className={cn(
                          'flex min-h-[92px] flex-col rounded-xl border p-2.5 transition-colors',
                          !d.noMes && 'border-dashed opacity-55',
                          !comCarga && 'border-industrial-200 bg-industrial-100/40',
                          comCarga && 'border-brand-500/40 bg-brand-500/10',
                          ehHoje && 'ring-1 ring-brand-500',
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <span className={cn('font-mono text-sm font-bold leading-none', d.noMes ? (ehHoje ? 'text-brand-300' : 'text-industrial-800') : 'text-industrial-700')}>
                            {pad(d.dia)}{!d.noMes && <span className="ml-1 text-[10px] font-medium">/{d.iso.slice(5, 7)}</span>}
                          </span>
                          {ehHoje && <span className="text-[10px] font-semibold text-brand-300">hoje</span>}
                        </div>
                        {(
                          <div className="mt-auto">
                            {comCarga ? (
                              <>
                                <p className="font-mono text-lg font-extrabold leading-none text-brand-300">
                                  {fmtTons(info!.tons)}<span className="ml-1 text-[10px] font-normal text-industrial-500">ton</span>
                                </p>
                                <p className="mt-1 flex items-center gap-1 text-[11px] text-industrial-600">
                                  <Truck className="size-3 shrink-0" />
                                  {info!.cargas} {info!.cargas === 1 ? 'carga' : 'cargas'}
                                </p>
                              </>
                            ) : (
                              <p className="text-[11px] text-industrial-400">—</p>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Total da semana */}
                  <div className="flex min-h-[92px] flex-col justify-between rounded-xl border border-industrial-300 bg-industrial-50 p-2.5 text-right">
                    <span className="font-display text-[10px] font-bold uppercase tracking-wide text-industrial-500">
                      Semana {idx + 1}
                      <span className="block font-mono font-medium normal-case tracking-normal text-industrial-400">
                        {diasVisiveis[0].iso.slice(8)}/{diasVisiveis[0].iso.slice(5, 7)} – {diasVisiveis[diasVisiveis.length - 1].iso.slice(8)}/{diasVisiveis[diasVisiveis.length - 1].iso.slice(5, 7)}
                      </span>
                    </span>
                    <div>
                      <p className={cn('font-mono text-lg font-extrabold leading-none', totalSemana.tons > 0 ? 'text-industrial-900' : 'text-industrial-400')}>
                        {fmtTons(totalSemana.tons)}<span className="ml-1 text-[10px] font-normal text-industrial-500">ton</span>
                      </p>
                      <p className="mt-1 text-[11px] text-industrial-600">
                        {totalSemana.cargas} {totalSemana.cargas === 1 ? 'carga' : 'cargas'}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Total do mês */}
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-brand-500/40 bg-brand-500/10 px-5 py-4">
        <div>
          <p className="font-display text-[10px] font-bold uppercase tracking-wide text-industrial-600">Total carregado em {nomeDoMes(mes)}</p>
          <p className="mt-1 font-mono text-3xl font-extrabold leading-none text-brand-300">
            {fmtTons(totalMes.tons)}<span className="ml-1.5 text-sm font-normal text-industrial-500">ton</span>
          </p>
        </div>
        <dl className="flex gap-6 text-right">
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-wide text-industrial-500">Cargas</dt>
            <dd className="font-mono text-lg font-bold text-industrial-900">{totalMes.cargas}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-wide text-industrial-500">Dias com carga</dt>
            <dd className="font-mono text-lg font-bold text-industrial-900">{totalMes.diasComCarga}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-wide text-industrial-500">Média por dia</dt>
            <dd className="font-mono text-lg font-bold text-industrial-900">
              {totalMes.diasComCarga ? fmtTons(totalMes.tons / totalMes.diasComCarga) : '—'}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
