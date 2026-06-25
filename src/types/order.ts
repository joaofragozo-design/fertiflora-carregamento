export type CarregamentoStatus =
  | 'SOLICITADO'
  | 'LIBERADO'
  | 'EM_EXECUCAO'
  | 'CONCLUIDO'
  | 'CANCELADO'

export interface Carregamento {
  id:                  string
  insumo:              string
  quantidade:          number
  conchas_executadas:  number
  status:              CarregamentoStatus
  created_at:          string
  started_at:          string | null
  finished_at:         string | null
}

export type Ordem       = Carregamento
export type OrdemStatus = CarregamentoStatus
