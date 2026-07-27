'use client'

import { Truck, PlayCircle, Flag, PackageCheck } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import {
  type RecebimentoPrevisto,
  getStatusRecebimento,
} from '@/services/recebimentos.service'
import { MATERIAS_PRIMA } from '@/types/formula'

interface FilaOperacaoProps {
  recebimentos:     RecebimentoPrevisto[]
  processandoId:     string | null
  onConfirmarChegada: (r: RecebimentoPrevisto) => void
  onIniciarDescarga:  (r: RecebimentoPrevisto) => void
  onFinalizarDescarga: (r: RecebimentoPrevisto) => void
}

const ETAPA: Record<'AGUARDANDO_CHEGADA' | 'AGUARDANDO_FILA' | 'DESCARREGANDO', {
  rotulo: string
  railClass: string
  chipClass: string
}> = {
  AGUARDANDO_CHEGADA: {
    rotulo: 'Aguardando chegada',
    railClass: 'bg-paper-400',
    chipClass: 'border-paper-400 text-paper-600',
  },
  AGUARDANDO_FILA: {
    rotulo: 'Aguardando na fila',
    railClass: 'bg-warning-500',
    chipClass: 'border-warning-500/40 text-warning-600 bg-warning-500/8',
  },
  DESCARREGANDO: {
    rotulo: 'Descarregando',
    railClass: 'bg-leaf-500',
    chipClass: 'border-leaf-500/40 text-leaf-700 bg-leaf-100/60',
  },
}

function labelMateriaPrima(r: RecebimentoPrevisto): string {
  const mp = MATERIAS_PRIMA.find((m) => m.key === r.materia_prima_key)
  return mp?.label ?? r.materia_prima ?? '—'
}
function labelFornecedor(r: RecebimentoPrevisto): string {
  return r.fornecedor_obj?.nome ?? r.fornecedor ?? '—'
}
function ddmm(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

export function FilaOperacao({
  recebimentos, processandoId, onConfirmarChegada, onIniciarDescarga, onFinalizarDescarga,
}: FilaOperacaoProps) {
  const fila = recebimentos
    .filter((r) => getStatusRecebimento(r) !== 'FINALIZADO')
    .sort((a, b) => {
      const ordem = { AGUARDANDO_FILA: 0, DESCARREGANDO: 1, AGUARDANDO_CHEGADA: 2, FINALIZADO: 3 }
      const diff = ordem[getStatusRecebimento(a)] - ordem[getStatusRecebimento(b)]
      if (diff !== 0) return diff
      return a.data_prevista.localeCompare(b.data_prevista) || a.created_at.localeCompare(b.created_at)
    })

  return (
    <div className="relative overflow-hidden rounded-tl-2xl rounded-br-2xl rounded-tr-lg rounded-bl-lg border border-paper-300 bg-paper-50 shadow-editorial">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-leaf-400 to-spruce-600" />

      <div className="flex items-center justify-between gap-3 px-5 pt-5">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-paper-500">
            Faturamento · Recebimento
          </p>
          <h2 className="font-display text-xl font-semibold text-paper-900">Fila de operação</h2>
        </div>
        <span className="flex items-center gap-1.5 rounded-full border border-spruce-600/25 bg-spruce-600/8 px-3 py-1 text-xs font-bold text-spruce-700">
          <PackageCheck className="size-3.5" />
          {fila.length} {fila.length === 1 ? 'em andamento' : 'em andamento'}
        </span>
      </div>

      <div className="flex flex-col gap-2 p-5 pt-4">
        {fila.length === 0 && (
          <p className="rounded-lg border border-dashed border-paper-300 py-6 text-center text-sm text-paper-500">
            Nenhum caminhão pendente — tudo finalizado.
          </p>
        )}

        {fila.map((r) => {
          const status = getStatusRecebimento(r) as keyof typeof ETAPA
          const etapa = ETAPA[status]
          const processando = processandoId === r.id

          return (
            <div
              key={r.id}
              className="flex items-stretch gap-3 rounded-lg border border-paper-300 bg-paper-100 pr-3 transition-colors"
            >
              <span className={cn('w-1.5 shrink-0 rounded-l-lg', etapa.railClass)} />

              <div className="flex flex-1 flex-wrap items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="text-sm font-semibold text-paper-900">
                    {labelMateriaPrima(r)}{' '}
                    <span className="font-mono text-xs font-normal text-paper-600">
                      {(r.quantidade_ton ?? 0).toFixed(2)} ton
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-paper-600">
                    {ddmm(r.data_prevista)} · {labelFornecedor(r)}
                    {(r.placa_cavalo || r.placa) && (
                      <span className="ml-1 font-mono uppercase text-paper-500">
                        · {r.placa_cavalo || r.placa}
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className={cn('rounded-full border px-2.5 py-1 text-[11px] font-semibold', etapa.chipClass)}>
                    {etapa.rotulo}
                  </span>

                  {status === 'AGUARDANDO_CHEGADA' && (
                    <button
                      type="button"
                      onClick={() => onConfirmarChegada(r)}
                      disabled={processando}
                      className="flex items-center gap-1.5 rounded-md bg-spruce-600 px-3 py-1.5 text-xs font-semibold text-paper-50 shadow-sm transition-colors hover:bg-spruce-500 disabled:opacity-50"
                    >
                      <Truck className="size-3.5" />
                      {processando ? 'Confirmando…' : 'Confirmar chegada'}
                    </button>
                  )}
                  {status === 'AGUARDANDO_FILA' && (
                    <button
                      type="button"
                      onClick={() => onIniciarDescarga(r)}
                      disabled={processando}
                      className="flex items-center gap-1.5 rounded-md bg-spruce-600 px-3 py-1.5 text-xs font-semibold text-paper-50 shadow-sm transition-colors hover:bg-spruce-500 disabled:opacity-50"
                    >
                      <PlayCircle className="size-3.5" />
                      {processando ? 'Iniciando…' : 'Iniciar descarga'}
                    </button>
                  )}
                  {status === 'DESCARREGANDO' && (
                    <button
                      type="button"
                      onClick={() => onFinalizarDescarga(r)}
                      disabled={processando}
                      className="flex items-center gap-1.5 rounded-md bg-spruce-600 px-3 py-1.5 text-xs font-semibold text-paper-50 shadow-sm transition-colors hover:bg-spruce-500 disabled:opacity-50"
                    >
                      <Flag className="size-3.5" />
                      {processando ? 'Finalizando…' : 'Finalizar descarga'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
