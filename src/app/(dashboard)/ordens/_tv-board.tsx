'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Check, Clock, Play, FlagTriangleRight, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { OrdensDiariasService } from '@/services/ordens-diarias.service'
import { useOrdensDiarias, type EditableOrdem } from '@/hooks/use-ordens-diarias'
import { ROUTES } from '@/constants/routes'
import type { AppUser } from '@/types'
import type { OrdemDiaria, Formula, StatusOrdem } from '@/types/formula'
import { INGREDIENTES, calcularIngrediente, calcularTons, getStatus } from '@/types/formula'
import { cn } from '@/lib/utils/cn'

interface TvBoardProps {
  initialOrdens: OrdemDiaria[]
  user: AppUser
  hoje: string
}

// Ordem de exibição: o que falta carregar primeiro, finalizados por último.
const PRIORIDADE: Record<StatusOrdem, number> = { EM_ANDAMENTO: 0, AGUARDANDO: 1, FINALIZADO: 2 }

function fmtKg(n: number): string {
  return n.toFixed(1).replace(/\.0$/, '')
}

export function TvBoard({ initialOrdens, user, hoje }: TvBoardProps) {
  const { ordens, setOrdens } = useOrdensDiarias(initialOrdens, hoje)
  const svc = useMemo(() => new OrdensDiariasService(createClient()), [])

  const podeMarcar = user.role === 'admin' || user.role === 'logistica_02'

  const totalTons = useMemo(() => ordens.reduce((s, o) => s + (o.tons ?? 0), 0), [ordens])

  const ordenados = useMemo(
    () =>
      [...ordens].sort((a, b) => {
        const pa = PRIORIDADE[getStatus(a)]
        const pb = PRIORIDADE[getStatus(b)]
        return pa !== pb ? pa - pb : a.sequencia - b.sequencia
      }),
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
    <div className="flex flex-col gap-4">
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

      {ordenados.length === 0 && (
        <div className="text-center py-24 text-xl text-industrial-400">Nenhum pedido para hoje ainda.</div>
      )}

      {/* Cards grandes */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {ordenados.map((o) => {
          const status = getStatus(o)
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
                status === 'FINALIZADO'
                  ? 'bg-brand-200 border-brand-600'
                  : status === 'EM_ANDAMENTO'
                    ? 'bg-amber-200 border-amber-500'
                    : 'bg-industrial-900 border-industrial-300',
              )}
            >
              {/* Cliente + status */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className="font-mono text-base text-industrial-500">{o.sequencia}</span>
                  <span className="text-2xl font-bold text-industrial-50 truncate">{o.cliente || 'Sem cliente'}</span>
                </div>
                <span
                  className={cn(
                    'flex items-center gap-2 text-lg font-bold whitespace-nowrap',
                    status === 'FINALIZADO'
                      ? 'text-brand-900'
                      : status === 'EM_ANDAMENTO'
                        ? 'text-amber-900'
                        : 'text-industrial-500',
                  )}
                >
                  {status === 'FINALIZADO' && <Check className="size-5" strokeWidth={3} />}
                  {status === 'EM_ANDAMENTO' && <Clock className="size-5" />}
                  {status === 'FINALIZADO' ? 'Finalizado' : status === 'EM_ANDAMENTO' ? 'Em andamento' : 'Aguardando'}
                </span>
              </div>

              {/* Fórmula (destaque) + toneladas */}
              <div className="flex items-end justify-between gap-3 mt-3">
                <div className="text-3xl font-extrabold text-industrial-50 leading-tight break-words min-w-0">
                  {formula?.nome ?? <span className="text-xl font-normal text-industrial-500">Sem fórmula</span>}
                </div>
                <div className="text-right whitespace-nowrap">
                  <div className="text-2xl font-bold text-brand-700">
                    {tons.toFixed(2)} <span className="text-sm font-normal text-industrial-500">ton</span>
                  </div>
                  <div className="text-sm text-industrial-600">
                    {o.quantidade} · {o.embalagem.toLowerCase()}
                    {o.envelopar ? ' · envelopar' : ''}
                  </div>
                </div>
              </div>

              {/* Ingredientes em kg/ton */}
              {usados.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {usados.map(({ ing, kg }) => (
                    <span
                      key={ing.key}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-industrial-900 border border-industrial-700 px-2.5 py-1"
                    >
                      <span className="text-sm text-industrial-500">{ing.label}</span>
                      <span className="text-sm font-mono font-bold text-industrial-100">{fmtKg(kg)}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Botões grandes */}
              {podeMarcar && (
                <div className="flex gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => toggleIniciado(o)}
                    disabled={o.finalizado}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-lg font-bold transition-colors disabled:cursor-not-allowed',
                      o.iniciado
                        ? 'bg-industrial-900 border-2 border-brand-600 text-brand-700'
                        : 'bg-amber-500 text-white hover:bg-amber-600',
                      o.finalizado && 'opacity-70',
                    )}
                  >
                    {o.iniciado ? <Check className="size-5" strokeWidth={3} /> : <Play className="size-5" />}
                    {o.iniciado ? 'Iniciado' : 'Iniciar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleFinalizado(o)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-lg font-bold transition-colors',
                      o.finalizado
                        ? 'bg-industrial-900 border-2 border-brand-600 text-brand-700'
                        : 'bg-brand-600 text-white hover:bg-brand-700',
                    )}
                  >
                    {o.finalizado ? <Check className="size-5" strokeWidth={3} /> : <FlagTriangleRight className="size-5" />}
                    {o.finalizado ? 'Finalizado' : 'Finalizar'}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
