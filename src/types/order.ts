export type CarregamentoStatus = 'PENDENTE' | 'CARREGANDO' | 'CONCLUIDO'

export interface Carregamento {
  id:          string
  insumo:      string
  quantidade:  number
  status:      CarregamentoStatus
  created_at:  string
  started_at:  string | null
  finished_at: string | null
}

// Alias para compatibilidade interna — prefira Carregamento em código novo
export type Ordem       = Carregamento
export type OrdemStatus = CarregamentoStatus
