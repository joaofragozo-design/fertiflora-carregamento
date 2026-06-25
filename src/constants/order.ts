import type { CarregamentoStatus } from '@/types'

export const STATUS_LABELS: Record<CarregamentoStatus, string> = {
  SOLICITADO: 'Solicitado',
  LIBERADO: 'Liberado',
  EM_EXECUCAO: 'Em execução',
  CONCLUIDO: 'Concluído',
  CANCELADO: 'Cancelado',
}

export const STATUS_COLORS: Record<CarregamentoStatus, string> = {
  SOLICITADO: 'text-yellow-600 bg-yellow-500/10 border-yellow-500/30',
  LIBERADO: 'text-blue-600 bg-blue-500/10 border-blue-500/30',
  EM_EXECUCAO: 'text-info-600 bg-info-500/10 border-info-500/30',
  CONCLUIDO: 'text-brand-700 bg-brand-500/10 border-brand-500/30',
  CANCELADO: 'text-red-600 bg-red-500/10 border-red-500/30',
}

export const STATUS_PULSE: Record<CarregamentoStatus, boolean> = {
  SOLICITADO: true,
  LIBERADO: true,
  EM_EXECUCAO: true,
  CONCLUIDO: false,
  CANCELADO: false,
}

export const ORDER_STATUS_LABELS = STATUS_LABELS
export const ORDER_STATUS_COLORS = STATUS_COLORS
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