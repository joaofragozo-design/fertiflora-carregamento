import type { createClient } from '@/lib/supabase/client'

type DB = ReturnType<typeof createClient>

// Previsão de chegada de matéria-prima: lançada pela Logística na tela de
// Programação e exibida no painel de TV pra equipe saber o que está chegando.
export interface RecebimentoPrevisto {
  id:             string
  data_prevista:  string
  materia_prima:  string
  quantidade_ton: number
  fornecedor:     string
  observacao:     string
  recebido:       boolean
  created_at:     string
  updated_at:     string
}

export type RecebimentoInsert = Omit<RecebimentoPrevisto, 'id' | 'recebido' | 'created_at' | 'updated_at'>

export class RecebimentosService {
  constructor(private supabase: DB) {}

  /** Recebimentos ainda não recebidos a partir de uma data (default: todos os pendentes). */
  async listarPendentes(aPartirDe?: string): Promise<RecebimentoPrevisto[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (this.supabase as any)
      .from('recebimentos_previstos')
      .select('*')
      .eq('recebido', false)
      .order('data_prevista', { ascending: true })

    if (aPartirDe) query = query.gte('data_prevista', aPartirDe)

    const { data, error } = await query
    if (error) throw new Error(this.traduzirErro(error.message, 'listar recebimentos'))
    return data as RecebimentoPrevisto[]
  }

  async criar(input: RecebimentoInsert): Promise<RecebimentoPrevisto> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase as any)
      .from('recebimentos_previstos')
      .insert(input)
      .select('*')
      .single()

    if (error) throw new Error(this.traduzirErro(error.message, 'lançar recebimento'))
    return data as RecebimentoPrevisto
  }

  async marcarRecebido(id: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (this.supabase as any)
      .from('recebimentos_previstos')
      .update({ recebido: true })
      .eq('id', id)

    if (error) throw new Error(this.traduzirErro(error.message, 'marcar como recebido'))
  }

  async deletar(id: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (this.supabase as any)
      .from('recebimentos_previstos')
      .delete()
      .eq('id', id)

    if (error) throw new Error(this.traduzirErro(error.message, 'remover recebimento'))
  }

  private traduzirErro(msg: string, acao: string): string {
    if (msg.includes('row-level security') || msg.includes('new row violates'))
      return 'Sem permissão para esta operação.'
    if (msg.includes('recebimentos_previstos'))
      return 'Tabela de recebimentos não encontrada — rode a migration 058 no Supabase.'
    console.error(`[RecebimentosService.${acao}]`, msg)
    return `Erro ao ${acao}. Tente novamente.`
  }
}
