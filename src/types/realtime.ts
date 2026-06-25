import type { Carregamento } from './order'

export type RealtimeEventType = 'INSERT' | 'UPDATE' | 'DELETE'

export interface RealtimeCarregamentoPayload {
  eventType: RealtimeEventType
  new: Carregamento | null
  old: Partial<Carregamento> | null
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'
