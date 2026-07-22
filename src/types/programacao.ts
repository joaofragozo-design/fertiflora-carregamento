import type { Embalagem, Formula } from './formula'
import type { Motorista, SolicitacaoStatus, Transportadora } from './transportadora'

// Um item dentro de um agendamento: uma fórmula + quantidade + embalagem.
// Um agendamento (Programacao) pode ter vários itens.
export interface ProgramacaoItem {
  id:             string
  programacao_id: string
  formula_id:     number | null
  formula?:       Formula
  quantidade:     number
  embalagem:      Embalagem
  tons:           number
  created_at:     string
  updated_at:     string
}

export type ProgramacaoItemInsert = Omit<ProgramacaoItem, 'id' | 'tons' | 'formula' | 'created_at' | 'updated_at'>
export type ProgramacaoItemUpdate = Partial<ProgramacaoItemInsert>

export interface Programacao {
  id:            string
  data:          string
  cliente:       string
  cliente_codigo: number | null
  itens:         ProgramacaoItem[]
  observacao:    string
  enviado_em:    string | null
  confirmado_em: string | null
  confirmado_por: string | null
  // Fluxo transportadora/motorista (migration 058)
  transportadora_id:         string | null
  transportadora?:           Transportadora | null
  motorista_id:              string | null
  motorista?:                Motorista | null
  solicitacao_status:        SolicitacaoStatus | null
  enviado_transportadora_em: string | null
  solicitado_em:             string | null
  liberado_em:               string | null
  liberado_por:              string | null
  created_at:    string
  updated_at:    string
}

export type ProgramacaoInsert = Omit<
  Programacao,
  | 'id' | 'itens' | 'enviado_em' | 'confirmado_em' | 'confirmado_por'
  | 'transportadora_id' | 'transportadora' | 'motorista_id' | 'motorista'
  | 'solicitacao_status' | 'enviado_transportadora_em' | 'solicitado_em' | 'liberado_em' | 'liberado_por'
  | 'created_at' | 'updated_at'
>
export type ProgramacaoUpdate = Partial<ProgramacaoInsert>
