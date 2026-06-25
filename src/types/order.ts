export type CarregamentoStatus =
  | 'SOLICITADO'
  | 'LIBERADO'
  | 'CONCLUIDO'
  | 'CANCELADO'
  | 'PENDENTE'    // legado
  | 'CARREGANDO'  // legado

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
