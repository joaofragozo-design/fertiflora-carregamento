import type { createClient } from '@/lib/supabase/client'
import type { EstoqueAtual, EstoqueConfig } from '@/types/estoque'

type DB = ReturnType<typeof createClient>

export interface LinhaCsvEstoque {
  materia_prima_key: string
  quantidade_ton:    number
}

export class EstoqueService {
  constructor(private supabase: DB) {}

  async listarAtual(): Promise<EstoqueAtual[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase as any)
      .from('estoque_atual')
      .select('*')

    if (error) throw new Error(this.traduzirErro(error.message, 'carregar estoque'))
    return data as EstoqueAtual[]
  }

  async listarConfig(): Promise<EstoqueConfig[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase as any)
      .from('estoque_config')
      .select('*')

    if (error) throw new Error(this.traduzirErro(error.message, 'carregar limites do estoque'))
    return data as EstoqueConfig[]
  }

  async atualizarConfig(materiaPrimaKey: string, limites: { limite_perigo: number; limite_cuidado: number; limite_confortavel: number }): Promise<EstoqueConfig> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase as any)
      .from('estoque_config')
      .update(limites)
      .eq('materia_prima_key', materiaPrimaKey)
      .select('*')
      .single()

    if (error) throw new Error(this.traduzirErro(error.message, 'salvar limites do estoque'))
    return data as EstoqueConfig
  }

  /** Lança um lote de recebimentos avulsos por CSV — SOMA ao estoque atual (não substitui). */
  async importarCsv(linhas: LinhaCsvEstoque[], usuario: string): Promise<void> {
    if (linhas.length === 0) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (this.supabase as any)
      .from('estoque_movimentos')
      .insert(linhas.map((l) => ({
        materia_prima_key: l.materia_prima_key,
        quantidade_ton: l.quantidade_ton,
        origem: 'CSV',
        observacao: 'Importação por CSV',
        created_por: usuario,
      })))

    if (error) throw new Error(this.traduzirErro(error.message, 'importar CSV de estoque'))
  }

  private traduzirErro(msg: string, acao: string): string {
    if (msg.includes('row-level security') || msg.includes('new row violates'))
      return 'Sem permissão para esta operação.'
    if (msg.includes('relation') && msg.includes('does not exist'))
      return 'Tabelas de estoque não encontradas — rode a migration 064 no Supabase.'
    console.error(`[EstoqueService.${acao}]`, msg)
    return `Erro ao ${acao}. Tente novamente.`
  }
}
