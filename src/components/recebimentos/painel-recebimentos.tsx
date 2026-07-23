'use client'

import { Package } from 'lucide-react'
import type { RecebimentoPrevisto } from '@/services/recebimentos.service'
import { MATERIAS_PRIMA } from '@/types/formula'
import { cn } from '@/lib/utils/cn'

function fmtData(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
}

function labelMateriaPrima(r: RecebimentoPrevisto): string {
  const mp = MATERIAS_PRIMA.find((m) => m.key === r.materia_prima_key)
  return mp?.label ?? r.materia_prima ?? '—'
}
function labelFornecedor(r: RecebimentoPrevisto): string {
  return r.fornecedor_obj?.nome ?? r.fornecedor ?? ''
}

/** Painel de TV, só-leitura: matéria-prima a caminho (lançada na Programação
 *  de Recebimento), em amarelo pra chamar atenção até o Faturamento confirmar
 *  a chegada. */
export function RecebimentosTv({ recebimentos }: { recebimentos: RecebimentoPrevisto[] }) {
  if (recebimentos.length === 0) return null
  const ordenados = [...recebimentos].sort((a, b) => a.data_prevista.localeCompare(b.data_prevista))
  return (
    <div className="mt-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-industrial-400 uppercase tracking-wide border-t border-industrial-700 pt-3 mb-3">
        <Package className="size-4 text-amber-600" />
        Matéria-prima chegando
      </div>
      <div className="flex flex-wrap gap-3">
        {ordenados.map((r) => (
          <div key={r.id} className={cn('rounded-xl border px-4 py-2.5', 'border-amber-500 bg-amber-100')}>
            <p className="text-lg font-bold text-industrial-950">
              {labelMateriaPrima(r)}
              {r.quantidade_ton > 0 && (
                <span className="font-mono text-amber-800"> · {r.quantidade_ton.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ton</span>
              )}
            </p>
            <p className="text-sm text-industrial-700 capitalize">
              {fmtData(r.data_prevista)}
              {labelFornecedor(r) && <span> · {labelFornecedor(r)}</span>}
              {r.placa && <span className="font-mono uppercase"> · {r.placa}</span>}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
