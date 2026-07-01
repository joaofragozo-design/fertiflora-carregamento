import type { Embalagem, Formula } from './formula'

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
  id:         string
  data:       string
  cliente:    string
  itens:      ProgramacaoItem[]
  observacao: string
  enviado_em: string | null
  created_at: string
  updated_at: string
}

export type ProgramacaoInsert = Omit<Programacao, 'id' | 'itens' | 'enviado_em' | 'created_at' | 'updated_at'>
export type ProgramacaoUpdate = Partial<ProgramacaoInsert>
