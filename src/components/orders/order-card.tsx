import { cn } from '@/lib/utils'
import { Clock, Package, Trash2 } from 'lucide-react'
import { OrderStatusBadge } from './order-status-badge'
import { Button } from '@/components/ui/button'
import type { Carregamento } from '@/types'

interface OrderCardProps {
  order:        Carregamento
  loading?:     boolean
  onIniciar?:   (item: Carregamento) => void
  onConcluir?:  (item: Carregamento) => void
  onCancelar?:  (item: Carregamento) => void
  compact?:     boolean
}

export function OrderCard({
  order,
  loading,
  onIniciar,
  onConcluir,
  onCancelar,
  compact = false,
}: OrderCardProps) {
  const isActive = order.status === 'CARREGANDO'

  return (
    <div
      className={cn(
        'rounded-lg bg-industrial-900 border-2 transition-colors',
        isActive
          ? 'border-info-500/80'
          : order.status === 'PENDENTE'
          ? 'border-warning-500/70'
          : 'border-industrial-700',
        compact ? 'p-3' : 'p-4'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <OrderStatusBadge status={order.status} />

          <div className="mt-2 flex items-center gap-2">
            <Package className="h-4 w-4 shrink-0 text-industrial-400" />
            <span className="truncate text-sm font-semibold text-industrial-100">
              {order.insumo}
            </span>
          </div>

          <p className="mt-1 text-xl font-bold text-industrial-100">
            {formatarQtd(order.quantidade)} conchas
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {order.status === 'PENDENTE' && onCancelar && (
            <button
              type="button"
              title="Cancelar solicitação"
              disabled={loading}
              onClick={() => onCancelar(order)}
              className="rounded-lg border border-danger-400/40 p-1.5 text-danger-400 transition-colors hover:bg-danger-400/10 hover:border-danger-400 disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          {order.status === 'PENDENTE' && onIniciar && (
            <Button size="sm" variant="secondary" loading={loading} onClick={() => onIniciar(order)}>
              Iniciar
            </Button>
          )}
          {order.status === 'CARREGANDO' && onConcluir && (
            <Button size="sm" variant="primary" loading={loading} onClick={() => onConcluir(order)}>
              Finalizar
            </Button>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-xs text-industrial-500">
        <Clock className="h-3 w-3" />
        <span>
          {order.status === 'CONCLUIDO' && order.finished_at
            ? `Concluído ${tempoRelativo(order.finished_at)}`
            : order.status === 'CARREGANDO' && order.started_at
            ? `Iniciado ${tempoRelativo(order.started_at)}`
            : `Criado ${tempoRelativo(order.created_at)}`}
        </span>
      </div>
    </div>
  )
}

function formatarQtd(n: number): string {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 }).format(n)
}

function tempoRelativo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60)    return 'agora'
  if (s < 3600)  return `há ${Math.floor(s / 60)} min`
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`
  return `há ${Math.floor(s / 86400)} d`
}
