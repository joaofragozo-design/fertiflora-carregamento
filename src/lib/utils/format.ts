export function formatConchas(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value) + ' conchas'
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function formatDateShort(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatOrderNumber(id: string): string {
  return `#${id.slice(0, 8).toUpperCase()}`
}

export function formatPercent(value: number, total: number): string {
  if (total === 0) return '0%'
  return `${Math.round((value / total) * 100)}%`
}

interface ComPlacas {
  placa_cavalo?: string | null
  placa?:        string | null // legado (só recebimentos_previstos)
  placa_1?:      string | null
  placa_2?:      string | null
  placa_3?:      string | null
  placa_4?:      string | null
}

/** Placa completa (cavalo + reboques) — motorista e recebimento de matéria-
 *  prima usam o mesmo formato de placas (bitrem/rodotrem). Mostrar só o
 *  cavalo esconde o(s) reboque(s), que é o que identifica o veículo num
 *  pátio com vários caminhões do mesmo transportador. */
export function formatPlacaCompleta(v: ComPlacas): string {
  const cavalo = v.placa_cavalo || v.placa
  if (!cavalo) return ''
  const reboques = [v.placa_1, v.placa_2, v.placa_3, v.placa_4].filter(Boolean)
  return reboques.length > 0 ? `${cavalo} / ${reboques.join(' / ')}` : cavalo
}

export function formatElapsedTime(date: string | Date): string {
  const diff = Date.now() - new Date(date).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) return `${hours}h ${minutes % 60}min`
  if (minutes > 0) return `${minutes}min`
  return 'agora'
}
