import type { Embalagem, Formula } from './formula'

export interface Programacao {
  id:         string
  data:       string
  cliente:    string
  formula_id: number | null
  formula?:   Formula
  quantidade: number
  embalagem:  Embalagem
  tons:       number
  observacao: string
  created_at: string
  updated_at: string
}

export type ProgramacaoInsert = Omit<Programacao, 'id' | 'tons' | 'formula' | 'created_at' | 'updated_at'>
export type ProgramacaoUpdate = Partial<ProgramacaoInsert>
