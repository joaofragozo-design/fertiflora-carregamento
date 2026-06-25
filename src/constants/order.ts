import type { CarregamentoStatus } from '@/types'

export const STATUS_LABELS: Record<CarregamentoStatus, string> = {
  PENDENTE: 'Pendente',
  CARREGANDO: 'Carregando',
  CONCLUIDO: 'Concluído',
  CANCELADO: 'Cancelado',
}

export const STATUS_COLORS: Record<CarregamentoStatus, string> = {
  PENDENTE: 'text-warning-600 bg-warning-500/10 border-warning-500/30',
  CARREGANDO: 'text-info-600 bg-info-500/10 border-info-500/30',
  CONCLUIDO: 'text-brand-700 bg-brand-500/10 border-brand-500/30',
  CANCELADO: 'text-red-600 bg-red-500/10 border-red-500/30',
}

export const STATUS_PULSE: Record<CarregamentoStatus, boolean> = {
  PENDENTE: false,
  CARREGANDO: true,
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