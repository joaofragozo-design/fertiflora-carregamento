import { cn } from '@/lib/utils'
import { STATUS_COLORS, STATUS_LABELS, STATUS_PULSE } from '@/constants/order'
import type { CarregamentoStatus } from '@/types'

interface OrderStatusBadgeProps {
  status: CarregamentoStatus
  className?: string
}

export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border-2 px-2.5 py-0.5 text-xs font-bold tracking-wide',
        STATUS_COLORS[status],
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full bg-current', STATUS_PULSE[status] && 'animate-pulse')} />
      {STATUS_LABELS[status]}
    </span>
  )
}
