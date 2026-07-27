import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { STATUS_LABELS, STATUS_PULSE, STATUS_VARIANT } from '@/constants/order'
import type { CarregamentoStatus } from '@/types'

interface OrderStatusBadgeProps {
  status: CarregamentoStatus
  className?: string
}

export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  return (
    <Badge variant={STATUS_VARIANT[status]} className={cn('border-2 font-bold tracking-wide', className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full bg-current', STATUS_PULSE[status] && 'animate-pulse')} />
      {STATUS_LABELS[status]}
    </Badge>
  )
}
