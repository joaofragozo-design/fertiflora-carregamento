import type { CarregamentoStatus } from '@/types'
import type { BadgeVariant } from '@/components/ui/badge'

export const STATUS_LABELS: Record<CarregamentoStatus, string> = {
  SOLICITADO: 'Solicitado',
  LIBERADO: 'Liberado',
  EM_EXECUCAO: 'Em execução',
  CONCLUIDO: 'Concluído',
  CANCELADO: 'Cancelado',
}

// Mesmo sistema de cor semântica usado pelo Badge genérico — evita ter
// duas paletas divergentes para o mesmo conceito de status.
export const STATUS_VARIANT: Record<CarregamentoStatus, BadgeVariant> = {
  SOLICITADO: 'warning',
  LIBERADO: 'info',
  EM_EXECUCAO: 'info',
  CONCLUIDO: 'success',
  CANCELADO: 'danger',
}

export const STATUS_PULSE: Record<CarregamentoStatus, boolean> = {
  SOLICITADO: true,
  LIBERADO: true,
  EM_EXECUCAO: true,
  CONCLUIDO: false,
  CANCELADO: false,
}

export const ORDER_STATUS_LABELS = STATUS_LABELS
export const ORDER_STATUS_PULSE = STATUS_PULSE

export const REALTIME_CHANNEL = 'carregamentos_changes'

export const INSUMOS_FIXOS = [
  'M.O',
  'MAP',
  'KCL',
  'SAM',
  'CARBONATO',
  'CALTIMAG',
  'URÉIA',
  'TSP',
  'CYSY+S',
  'CALTIMAG+S',
  'HIPHOS 25',
  'ENXOFRE',
  'BORO',
] as const