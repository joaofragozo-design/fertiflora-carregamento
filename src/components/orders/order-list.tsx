import { InboxIcon } from 'lucide-react'
import { OrderCard } from './order-card'
import type { Carregamento } from '@/types'

interface OrderListProps {
  ordens:      Carregamento[]
  emptyLabel?: string
  loadingId?:  string | null
  onIniciar?:  (item: Carregamento) => void
  onConcluir?: (item: Carregamento) => void
  compact?:    boolean
}

export function OrderList({
  ordens,
  emptyLabel = 'Nenhuma solicitação.',
  loadingId,
  onIniciar,
  onConcluir,
  compact,
}: OrderListProps) {
  if (ordens.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-industrial-700 py-10 text-center">
        <InboxIcon className="h-7 w-7 text-industrial-600" />
        <p className="text-sm text-industrial-500">{emptyLabel}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {ordens.map((item) => (
        <OrderCard
          key={item.id}
          order={item}
          loading={loadingId === item.id}
          onIniciar={onIniciar}
          onConcluir={onConcluir}
          compact={compact}
        />
      ))}
    </div>
  )
}
