'use client'

import { useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { Check, Clock, Play, FlagTriangleRight, Printer, RotateCcw, CalendarRange } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { OrdensDiariasService } from '@/services/ordens-diarias.service'
import { useOrdensDiarias, type EditableOrdem } from '@/hooks/use-ordens-diarias'
import { ROUTES } from '@/constants/routes'
import type { AppUser } from '@/types'
import type { OrdemDiaria, Formula } from '@/types/formula'
import type { Programacao } from '@/types/programacao'
import { MATERIAS_PRIMA, EMBALAGEM_LABEL, calcularMateriaPrima, calcularTons, tonsDaOrdem, getStatus, formatDuracao, tonPorHora } from '@/types/formula'
import { cn } from '@/lib/utils/cn'

interface TvBoardProps {
  initialOrdens: OrdemDiaria[]
  programacao: Programacao[]
  user: AppUser
  hoje: string
}

function fmtKg(n: number): string {
  return n.toFixed(1).replace(/\.0$/, '')
}

/** Cronômetro ao vivo desde o início do carregamento. */
function Cronometro({ inicio }: { inicio: string }) {
  const [now, setNow] = useState<number>(() => new Date(inicio).getTime())
  useEffect(() => {
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const s = Math.max(0, Math.floor((now - new Date(inicio).getTime()) / 1000))
  const hh = String(Math.floor(s / 3600)).padStart(2, '0')
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return <span className="font-mono tabular-nums">{hh}:{mm}:{ss}</span>
}

function labelDia(data: string): string {
  return new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
}

export function TvBoard({ initialOrdens, programacao, user, hoje }: TvBoardProps) {
  const { ordens, setOrdens } = useOrdensDiarias(initialOrdens, hoje)
  const svc = useMemo(() => new OrdensDiariasService(createClient()), [])

  const podeMarcar = user.role === 'admin' || user.role === 'logistica_02'

  const totalTons = useMemo(() => ordens.reduce((s, o) => s + tonsDaOrdem(o), 0), [ordens])

  // Ativos (em andamento primeiro, depois aguardando) ficam no foco.
  // Finalizados vão para uma seção separada e discreta.
  const ativos = useMemo(
    () =>
      ordens
        .filter((o) => !o.finalizado)
        .sort((a, b) => a.sequencia - b.sequencia), // ordem de prioridade definida pelo Fransua
    [ordens],
  )
  const finalizados = useMemo(
    () => ordens.filter((o) => o.finalizado).sort((a, b) => a.sequencia - b.sequencia),
    [ordens],
  )

  // Programação agrupada por dia (prévia dos próximos dias).
  const diasProg = useMemo(() => {
    const map = new Map<string, Programacao[]>()
    for (const p of programacao) {
      const arr = map.get(p.data) ?? []
      arr.push(p)
      map.set(p.data, arr)
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([data, itens]) => ({ data, itens }))
  }, [programacao])

  async function salvar(id: string, patch: Partial<OrdemDiaria>) {
    setOrdens((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch, _saving: true, _dirty: false } : o)))
    try {
      const updated = await svc.atualizar(id, patch)
      setOrdens((prev) => prev.map((o) => (o.id === id ? { ...updated, _saving: false } : o)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar.')
      setOrdens((prev) => prev.map((o) => (o.id === id ? { ...o, _saving: false } : o)))
    }
  }

  // Carga em andamento (no máximo uma por vez).
  const cargaEmAndamento = useMemo(
    () => ordens.find((o) => o.iniciado && !o.finalizado),
    [ordens],
  )

  function toggleIniciado(o: EditableOrdem) {
    if (!podeMarcar || o.finalizado) return
    if (!o.iniciado) {
      // Iniciar: bloqueia se já há outra em andamento.
      if (cargaEmAndamento && cargaEmAndamento.id !== o.id) {
        toast.error('Finalize a carga em andamento antes de iniciar outra.')
        return
      }
      salvar(o.id, { iniciado: true })
    } else {
      salvar(o.id, { iniciado: false }) // desfazer início
    }
  }

  function toggleFinalizado(o: EditableOrdem) {
    if (!podeMarcar) return
    if (!o.finalizado) {
      // Finalizar: só se já iniciada.
      if (!o.iniciado) {
        toast.error('Inicie a carga antes de finalizar.')
        return
      }
      salvar(o.id, { finalizado: true })
    } else {
      salvar(o.id, { finalizado: false }) // reabrir
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Cabeçalho ao vivo */}
      <div className="flex items-center justify-between gap-3 border-b border-industrial-700 pb-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="relative flex size-3 shrink-0">
            <span className="absolute inline-flex h-full w-full rounded-full bg-brand-500 opacity-60 animate-ping" />
            <span className="relative inline-flex size-3 rounded-full bg-brand-600" />
          </span>
          <h1 className="text-2xl font-bold text-industrial-50 truncate">Carregamento · ao vivo</h1>
          <span className="text-sm text-industrial-400 capitalize hidden sm:inline">
            {new Date(hoje + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </span>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <span className="text-sm text-industrial-400">Total do dia </span>
            <span className="text-2xl font-bold text-brand-700">{totalTons.toFixed(2)} ton</span>
          </div>
          <Link
            href={ROUTES.ORDENS_RELATORIO}
            className="flex items-center gap-1.5 rounded-lg border border-industrial-700 px-3 py-2 text-sm font-medium text-industrial-300 hover:border-brand-500 hover:text-brand-700 transition-colors"
          >
            <Printer className="size-4" /> Relatório
          </Link>
        </div>
      </div>

      {ordens.length === 0 && (
        <div className="text-center py-24 text-xl text-industrial-400">Nenhum pedido para hoje ainda.</div>
      )}

      {/* ATIVOS — foco do Richardson */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {ativos.map((o) => {
          const emAndamento = o.iniciado
          const itens = o.itens ?? []
          const tonsCarga = tonsDaOrdem(o)
          const bloqueiaIniciar = !o.iniciado && cargaEmAndamento != null && cargaEmAndamento.id !== o.id

          return (
            <div
              key={o.id}
              className={cn(
                'rounded-2xl border border-l-8 p-5 transition-colors',
                o._saving && 'opacity-80',
                emAndamento ? 'bg-amber-200 border-amber-500' : 'bg-industrial-900 border-industrial-300',
              )}
            >
              {/* Cliente + placa + status */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-baseline gap-3 min-w-0">
                  <span className="font-mono text-xl text-industrial-500">{o.sequencia}</span>
                  <span className="text-4xl font-bold text-industrial-50 truncate">{o.cliente || 'Sem cliente'}</span>
                  {o.placa && (
                    <span className="text-4xl font-mono font-bold text-industrial-400 uppercase shrink-0">{o.placa}</span>
                  )}
                </div>
                <span
                  className={cn(
                    'flex items-center gap-2 text-2xl font-bold whitespace-nowrap',
                    emAndamento ? 'text-amber-900' : 'text-industrial-500',
                  )}
                >
                  {emAndamento ? <Clock className="size-8" /> : null}
                  {emAndamento ? 'Em andamento' : 'Aguardando'}
                  {emAndamento && o.iniciado_em && (
                    <span className="ml-2 text-3xl font-extrabold text-amber-900"><Cronometro inicio={o.iniciado_em} /></span>
                  )}
                </span>
              </div>

              {/* Envelopar + total da carga */}
              <div className="flex items-center justify-between gap-3 flex-wrap mt-3">
                {o.envelopar ? (
                  <span className="rounded-md bg-brand-600 text-white text-lg font-bold uppercase tracking-wide px-3 py-1.5">
                    Envelopar
                  </span>
                ) : <span />}
                <span className="text-4xl font-bold text-brand-700">
                  {tonsCarga.toFixed(2)} <span className="text-xl font-normal text-industrial-500">ton</span>
                </span>
              </div>

              {/* Itens da carga — cada um com fórmula + matéria-prima em destaque */}
              <div className="flex flex-col gap-5 mt-4">
                {itens.map((item, i) => {
                  const formula = item.formula as Formula | null | undefined
                  const usados = formula
                    ? MATERIAS_PRIMA.map((mp) => ({ mp, kg: calcularMateriaPrima(formula, mp.key) })).filter((x) => x.kg > 0)
                    : []
                  const tons = calcularTons(item.quantidade, item.embalagem)
                  return (
                    <div key={item.id} className={cn(i > 0 && 'border-t border-industrial-300/60 pt-4')}>
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <span className="text-3xl font-extrabold text-industrial-50 tracking-wide">
                          {item.quantidade} × {EMBALAGEM_LABEL[item.embalagem]}
                        </span>
                        <span className="text-2xl font-bold text-brand-700">{tons.toFixed(2)} ton</span>
                      </div>
                      <div className="mt-2 text-2xl text-industrial-500">
                        Fórmula:{' '}
                        <span className="font-bold text-industrial-100">
                          {formula?.nome ?? 'sem fórmula'}
                        </span>
                      </div>
                      {usados.length > 0 && (
                        <div className="flex flex-wrap gap-x-12 gap-y-6 mt-4">
                          {usados.map(({ mp, kg }) => (
                            <div key={mp.key} className="flex flex-col">
                              <span className="text-xl font-bold uppercase tracking-wide text-industrial-300">{mp.label}</span>
                              <span className="text-7xl font-black font-mono text-industrial-50 leading-none">{fmtKg(kg)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Botões grandes */}
              {podeMarcar && (
                <div className="mt-7">
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => toggleIniciado(o)}
                      disabled={bloqueiaIniciar}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-3 rounded-xl px-5 py-6 text-3xl font-bold transition-colors',
                        o.iniciado
                          ? 'bg-industrial-900 border-2 border-brand-600 text-brand-700'
                          : 'bg-amber-500 text-white hover:bg-amber-600',
                        bloqueiaIniciar && 'opacity-40 cursor-not-allowed hover:bg-amber-500',
                      )}
                    >
                      {o.iniciado ? <Check className="size-8" strokeWidth={3} /> : <Play className="size-8" />}
                      {o.iniciado ? 'Iniciado' : 'Iniciar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleFinalizado(o)}
                      disabled={!o.iniciado}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-3 rounded-xl px-5 py-6 text-3xl font-bold transition-colors bg-brand-600 text-white hover:bg-brand-700',
                        !o.iniciado && 'opacity-40 cursor-not-allowed hover:bg-brand-600',
                      )}
                    >
                      <FlagTriangleRight className="size-8" /> Finalizar
                    </button>
                  </div>
                  {bloqueiaIniciar && (
                    <p className="text-base text-amber-800 mt-2 text-center">Finalize a carga em andamento primeiro.</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* FINALIZADOS — seção separada, compacta e discreta */}
      {finalizados.length > 0 && (
        <div className="mt-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-industrial-400 uppercase tracking-wide border-t border-industrial-700 pt-3 mb-3">
            <Check className="size-4 text-brand-600" strokeWidth={3} />
            Finalizados · {finalizados.length}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {finalizados.map((o) => {
              const itens = o.itens ?? []
              const tonsCarga = tonsDaOrdem(o)
              const durMs = o.iniciado_em && o.finalizado_em
                ? new Date(o.finalizado_em).getTime() - new Date(o.iniciado_em).getTime()
                : 0
              const resumoItens = itens
                .map((it) => `${(it.formula as Formula | undefined)?.nome ?? 'sem fórmula'} (${it.quantidade} ${EMBALAGEM_LABEL[it.embalagem]})`)
                .join(' + ')
              return (
                <div
                  key={o.id}
                  className={cn(
                    'flex items-center justify-between gap-3 rounded-xl border border-brand-300 bg-brand-100 px-3 py-2',
                    o._saving && 'opacity-70',
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Check className="size-4 text-brand-700 shrink-0" strokeWidth={3} />
                      <span className="font-bold text-industrial-100 truncate">{o.cliente || 'Sem cliente'}</span>
                      {o.placa && <span className="text-xs font-mono text-industrial-500 uppercase shrink-0">{o.placa}</span>}
                    </div>
                    <div className="text-xs text-industrial-600 truncate mt-0.5">
                      {resumoItens || 'sem itens'} · {tonsCarga.toFixed(2)} ton
                    </div>
                    {durMs > 0 && (
                      <div className="text-xs text-brand-700 font-medium mt-0.5">
                        <Clock className="inline size-3 mb-0.5" /> {formatDuracao(durMs)} · {tonPorHora(tonsCarga, durMs).toFixed(2)} ton/h
                      </div>
                    )}
                  </div>
                  {podeMarcar && (
                    <button
                      type="button"
                      onClick={() => toggleFinalizado(o)}
                      className="flex items-center gap-1 text-xs font-medium text-industrial-500 hover:text-brand-700 transition-colors shrink-0"
                      title="Reabrir (desfazer finalização)"
                    >
                      <RotateCcw className="size-3.5" /> Reabrir
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* PROGRAMAÇÃO — prévia dos próximos dias (embutida, somente leitura) */}
      {diasProg.length > 0 && (
        <div className="mt-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-industrial-400 uppercase tracking-wide border-t border-industrial-700 pt-3 mb-3">
            <CalendarRange className="size-4 text-brand-600" />
            Programação dos próximos dias
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {diasProg.map(({ data, itens }) => (
              <div key={data} className="rounded-xl border border-industrial-800 p-3">
                <p className="text-sm font-bold text-industrial-200 capitalize mb-2">{labelDia(data)}</p>
                <div className="flex flex-col gap-1.5">
                  {itens.map((it) => (
                    <div key={it.id} className="text-sm leading-snug">
                      <span className="font-semibold text-industrial-100">{it.cliente || '—'}</span>
                      {it.formula?.nome && <span className="text-brand-700"> · {it.formula.nome}</span>}
                      <span className="text-industrial-500"> · {it.quantidade} {EMBALAGEM_LABEL[it.embalagem]} · {(it.tons ?? 0).toFixed(2)} ton</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
