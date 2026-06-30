'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Check, Clock, Play, FlagTriangleRight, Printer, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { OrdensDiariasService } from '@/services/ordens-diarias.service'
import { useOrdensDiarias, type EditableOrdem } from '@/hooks/use-ordens-diarias'
import { ROUTES } from '@/constants/routes'
import type { AppUser } from '@/types'
import type { OrdemDiaria, Formula } from '@/types/formula'
import { INGREDIENTES, EMBALAGEM_LABEL, calcularIngrediente, calcularTons, getStatus } from '@/types/formula'
import { cn } from '@/lib/utils/cn'

interface TvBoardProps {
  initialOrdens: OrdemDiaria[]
  user: AppUser
  hoje: string
}

function fmtKg(n: number): string {
  return n.toFixed(1).replace(/\.0$/, '')
}

export function TvBoard({ initialOrdens, user, hoje }: TvBoardProps) {
  const { ordens, setOrdens } = useOrdensDiarias(initialOrdens, hoje)
  const svc = useMemo(() => new OrdensDiariasService(createClient()), [])

  const podeMarcar = user.role === 'admin' || user.role === 'logistica_02'

  const totalTons = useMemo(() => ordens.reduce((s, o) => s + (o.tons ?? 0), 0), [ordens])

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

  function toggleIniciado(o: EditableOrdem) {
    if (!podeMarcar || o.finalizado) return
    salvar(o.id, { iniciado: !o.iniciado })
  }

  function toggleFinalizado(o: EditableOrdem) {
    if (!podeMarcar) return
    const next = !o.finalizado
    salvar(o.id, { finalizado: next, iniciado: next ? true : o.iniciado })
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
          const formula = o.formula as Formula | null | undefined
          const usados = formula
            ? INGREDIENTES.map((ing) => ({ ing, kg: calcularIngrediente(formula, ing.key) })).filter((x) => x.kg > 0)
            : []
          const tons = calcularTons(o.quantidade, o.embalagem)

          return (
            <div
              key={o.id}
              className={cn(
                'rounded-2xl border border-l-8 p-5 transition-colors',
                o._saving && 'opacity-80',
                emAndamento ? 'bg-amber-200 border-amber-500' : 'bg-industrial-900 border-industrial-300',
              )}
            >
              {/* Cliente + status */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className="font-mono text-base text-industrial-500">{o.sequencia}</span>
                  <span className="text-xl font-bold text-industrial-50 truncate">{o.cliente || 'Sem cliente'}</span>
                </div>
                <span
                  className={cn(
                    'flex items-center gap-1.5 text-base font-bold whitespace-nowrap',
                    emAndamento ? 'text-amber-900' : 'text-industrial-500',
                  )}
                >
                  {emAndamento ? <Clock className="size-5" /> : null}
                  {emAndamento ? 'Em andamento' : 'Aguardando'}
                </span>
              </div>

              {/* Quantidade + envelopar (MAIÚSCULO, destaque) + toneladas */}
              <div className="flex items-center justify-between gap-3 flex-wrap mt-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl font-extrabold text-industrial-50 tracking-wide">
                    {o.quantidade} × {EMBALAGEM_LABEL[o.embalagem]}
                  </span>
                  {o.envelopar && (
                    <span className="rounded-md bg-brand-600 text-white text-xs font-bold uppercase tracking-wide px-2 py-1">
                      Envelopar
                    </span>
                  )}
                </div>
                <span className="text-xl font-bold text-brand-700">
                  {tons.toFixed(2)} <span className="text-sm font-normal text-industrial-500">ton</span>
                </span>
              </div>

              {/* Fórmula — secundária (rótulo) */}
              <div className="mt-3 text-sm text-industrial-500">
                Fórmula:{' '}
                <span className="font-semibold text-industrial-200">
                  {formula?.nome ?? 'sem fórmula'}
                </span>
              </div>

              {/* Ingredientes — PROTAGONISTAS (números grandes) */}
              {usados.length > 0 && (
                <div className="flex flex-wrap gap-x-9 gap-y-4 mt-3">
                  {usados.map(({ ing, kg }) => (
                    <div key={ing.key} className="flex flex-col">
                      <span className="text-sm font-bold uppercase tracking-wide text-industrial-300">{ing.label}</span>
                      <span className="text-5xl font-black font-mono text-industrial-50 leading-none">{fmtKg(kg)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Botões grandes */}
              {podeMarcar && (
                <div className="flex gap-3 mt-5">
                  <button
                    type="button"
                    onClick={() => toggleIniciado(o)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-lg font-bold transition-colors',
                      o.iniciado
                        ? 'bg-industrial-900 border-2 border-brand-600 text-brand-700'
                        : 'bg-amber-500 text-white hover:bg-amber-600',
                    )}
                  >
                    {o.iniciado ? <Check className="size-5" strokeWidth={3} /> : <Play className="size-5" />}
                    {o.iniciado ? 'Iniciado' : 'Iniciar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleFinalizado(o)}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-lg font-bold bg-brand-600 text-white hover:bg-brand-700 transition-colors"
                  >
                    <FlagTriangleRight className="size-5" /> Finalizar
                  </button>
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
              const formula = o.formula as Formula | null | undefined
              const tons = calcularTons(o.quantidade, o.embalagem)
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
                    </div>
                    <div className="text-xs text-industrial-600 truncate mt-0.5">
                      {formula?.nome ?? 'sem fórmula'} · {tons.toFixed(2)} ton · {o.quantidade} {EMBALAGEM_LABEL[o.embalagem]}
                    </div>
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
    </div>
  )
}
