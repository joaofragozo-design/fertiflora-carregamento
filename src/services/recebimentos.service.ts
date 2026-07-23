import type { createClient } from '@/lib/supabase/client'
import type { Fornecedor } from '@/types/fornecedor'

type DB = ReturnType<typeof createClient>

// Alias diferente de `fornecedor` (a coluna de texto livre legada) de propósito
// -- `select('*, fornecedor:fornecedores(...)')` colidiria com a coluna real.
const SELECT_COM_FORNECEDOR = `*, fornecedor_rel:fornecedores ( id, nome, created_at, updated_at )`

// Previsão de chegada de matéria-prima ("Programação de Recebimento"), espelho
// da Programação de Carregamento: a Logística lança (data prevista, matéria-
// prima, quantidade, fornecedor, placa do caminhão); o Faturamento confirma a
// chegada. `materia_prima`/`fornecedor` (texto livre) são o formato antigo,
// mantidos só pra não quebrar registros lançados antes desta migration —
// `materia_prima_key`/`fornecedor_id` são os campos estruturados usados daqui
// pra frente.
export interface RecebimentoPrevisto {
  id:                string
  data_prevista:     string
  materia_prima:     string
  materia_prima_key: string | null
  quantidade_ton:    number
  fornecedor:        string
  fornecedor_id:     string | null
  fornecedor_obj?:   Fornecedor | null
  placa:             string
  observacao:        string
  recebido:          boolean
  confirmado_em:     string | null
  confirmado_por:    string | null
  created_at:        string
  updated_at:        string
}

export interface RecebimentoInsert {
  data_prevista:     string
  materia_prima_key: string
  quantidade_ton:    number
  fornecedor_id:     string | null
  placa:             string
  observacao:        string
}

export class RecebimentosService {
  constructor(private supabase: DB) {}

  /** Recebimentos de uma janela de datas (semana), com o fornecedor já resolvido. */
  async getByRange(inicio: string, fim: string): Promise<RecebimentoPrevisto[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase as any)
      .from('recebimentos_previstos')
      .select(SELECT_COM_FORNECEDOR)
      .gte('data_prevista', inicio)
      .lte('data_prevista', fim)
      .order('data_prevista', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) throw new Error(this.traduzirErro(error.message, 'carregar recebimentos'))
    return this.normalizar(data)
  }

  /** Recebimentos ainda não confirmados a partir de uma data (usado no painel de TV). */
  async listarPendentes(aPartirDe?: string): Promise<RecebimentoPrevisto[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (this.supabase as any)
      .from('recebimentos_previstos')
      .select(SELECT_COM_FORNECEDOR)
      .is('confirmado_em', null)
      .order('data_prevista', { ascending: true })

    if (aPartirDe) query = query.gte('data_prevista', aPartirDe)

    const { data, error } = await query
    if (error) throw new Error(this.traduzirErro(error.message, 'listar recebimentos'))
    return this.normalizar(data)
  }

  async criar(input: RecebimentoInsert): Promise<RecebimentoPrevisto> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase as any)
      .from('recebimentos_previstos')
      .insert({
        data_prevista: input.data_prevista,
        materia_prima_key: input.materia_prima_key,
        materia_prima: input.materia_prima_key, // compat com telas/consultas antigas
        quantidade_ton: input.quantidade_ton,
        fornecedor_id: input.fornecedor_id,
        placa: input.placa.trim().toUpperCase(),
        observacao: input.observacao,
      })
      .select(SELECT_COM_FORNECEDOR)
      .single()

    if (error) throw new Error(this.traduzirErro(error.message, 'lançar recebimento'))
    return this.normalizar([data])[0]
  }

  /** Faturamento confirma que o caminhão de matéria-prima chegou. */
  async confirmarChegada(id: string, usuario: string): Promise<RecebimentoPrevisto> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase as any)
      .from('recebimentos_previstos')
      .update({ confirmado_em: new Date().toISOString(), confirmado_por: usuario, recebido: true })
      .eq('id', id)
      .select(SELECT_COM_FORNECEDOR)
      .single()

    if (error) throw new Error(this.traduzirErro(error.message, 'confirmar chegada'))
    return this.normalizar([data])[0]
  }

  async deletar(id: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (this.supabase as any)
      .from('recebimentos_previstos')
      .delete()
      .eq('id', id)

    if (error) throw new Error(this.traduzirErro(error.message, 'remover recebimento'))
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private normalizar(rows: any[]): RecebimentoPrevisto[] {
    return (rows ?? []).map((r) => ({ ...r, fornecedor_obj: r.fornecedor_rel ?? null }))
  }

  private traduzirErro(msg: string, acao: string): string {
    if (msg.includes('row-level security') || msg.includes('new row violates'))
      return 'Sem permissão para esta operação.'
    if (msg.includes('relation') && msg.includes('does not exist'))
      return 'Tabela de recebimentos não encontrada — rode as migrations 058/063 no Supabase.'
    console.error(`[RecebimentosService.${acao}]`, msg)
    return `Erro ao ${acao}. Tente novamente.`
  }
}
