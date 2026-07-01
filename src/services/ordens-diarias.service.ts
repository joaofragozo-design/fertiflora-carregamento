import type { OrdemDiaria, OrdemDiariaUpdate, OrdemItem, OrdemItemInsert, OrdemItemUpdate } from '@/types/formula'
import type { createClient } from '@/lib/supabase/client'

type DB = ReturnType<typeof createClient>

const SELECT_ITEM_FORMULA = `
  id, nome, mo, map, calcario_concha, sulfato_amonia, carbonato_ca_mg,
  ureia, cloreto_potassio, boro, enxofre_pastilhado, fte_br_12, oxmag_s, tsp, caltimag, hiphos_25,
  ativo, created_at, updated_at
`.trim()

const SELECT_COM_ITENS = `
  *,
  itens:ordem_itens (
    *,
    formula:formulas ( ${SELECT_ITEM_FORMULA} )
  )
`.trim()

export class OrdensDiariasService {
  constructor(private supabase: DB) {}

  async getByDate(data: string): Promise<OrdemDiaria[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rows, error } = await (this.supabase as any)
      .from('ordens_diarias')
      .select(SELECT_COM_ITENS)
      .eq('data', data)
      .order('sequencia', { ascending: true })
      .order('created_at', { foreignTable: 'ordem_itens', ascending: true })

    if (error) throw new Error('Erro ao carregar ordens do dia.')
    return rows as OrdemDiaria[]
  }

  /** Cria um caminhão/carga já com o primeiro item (fórmula/quantidade/embalagem). */
  async criar(input: {
    data: string
    cliente: string
    placa: string
    envelopar: boolean
    iniciado: boolean
    finalizado: boolean
    formula_id: number | null
    quantidade: number
    embalagem: OrdemItemInsert['embalagem']
  }): Promise<OrdemDiaria> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: ordem, error } = await (this.supabase as any)
      .from('ordens_diarias')
      .insert({
        data: input.data,
        cliente: input.cliente,
        placa: input.placa,
        envelopar: input.envelopar,
        iniciado: input.iniciado,
        finalizado: input.finalizado,
      })
      .select('*')
      .single()

    if (error) throw new Error(this.traduzirErro(error.message, 'criar'))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: itemErr } = await (this.supabase as any)
      .from('ordem_itens')
      .insert({
        ordem_id: ordem.id,
        formula_id: input.formula_id,
        quantidade: input.quantidade,
        embalagem: input.embalagem,
      })

    if (itemErr) {
      // Evita caminhão órfão sem nenhum item (as duas inserções não são atômicas).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (this.supabase as any).from('ordens_diarias').delete().eq('id', ordem.id)
      throw new Error(this.traduzirErro(itemErr.message, 'criar item'))
    }

    return this.getById(ordem.id)
  }

  async getById(id: string): Promise<OrdemDiaria> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase as any)
      .from('ordens_diarias')
      .select(SELECT_COM_ITENS)
      .eq('id', id)
      .order('created_at', { foreignTable: 'ordem_itens', ascending: true })
      .single()

    if (error) throw new Error('Erro ao carregar a ordem.')
    return data as OrdemDiaria
  }

  /** Atualiza os campos da carga/caminhão (cliente, placa, envelopar, status). */
  async atualizar(id: string, input: OrdemDiariaUpdate): Promise<OrdemDiaria> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (this.supabase as any)
      .from('ordens_diarias')
      .update(input)
      .eq('id', id)

    if (error) throw new Error(this.traduzirErro(error.message, 'atualizar'))
    return this.getById(id)
  }

  async marcarIniciado(id: string): Promise<OrdemDiaria> {
    return this.atualizar(id, { iniciado: true })
  }

  async marcarFinalizado(id: string): Promise<OrdemDiaria> {
    return this.atualizar(id, { iniciado: true, finalizado: true })
  }

  /** Adiciona um novo item (fórmula/quantidade/embalagem) a uma carga existente. */
  async adicionarItem(ordemId: string, input: Omit<OrdemItemInsert, 'ordem_id'>): Promise<OrdemDiaria> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (this.supabase as any)
      .from('ordem_itens')
      .insert({ ordem_id: ordemId, ...input })

    if (error) throw new Error(this.traduzirErro(error.message, 'adicionar item'))
    return this.getById(ordemId)
  }

  async atualizarItem(itemId: string, ordemId: string, input: OrdemItemUpdate): Promise<OrdemDiaria> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (this.supabase as any)
      .from('ordem_itens')
      .update(input)
      .eq('id', itemId)

    if (error) throw new Error(this.traduzirErro(error.message, 'atualizar item'))
    return this.getById(ordemId)
  }

  async removerItem(itemId: string, ordemId: string): Promise<OrdemDiaria> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (this.supabase as any)
      .from('ordem_itens')
      .delete()
      .eq('id', itemId)

    if (error) throw new Error(this.traduzirErro(error.message, 'remover item'))
    return this.getById(ordemId)
  }

  /** Reordena as ordens do dia: `ids` na nova ordem de prioridade (1..N). */
  async reordenar(data: string, ids: string[]): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (this.supabase as any).rpc('reordenar_ordens', { p_data: data, p_ids: ids })
    if (error) throw new Error(this.traduzirErro(error.message, 'reordenar'))
  }

  async deletar(id: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (this.supabase as any)
      .from('ordens_diarias')
      .delete()
      .eq('id', id)

    if (error) throw new Error(this.traduzirErro(error.message, 'deletar'))
  }

  private traduzirErro(msg: string, acao: string): string {
    if (msg.includes('row-level security') || msg.includes('new row violates'))
      return 'Sem permissão para esta operação.'
    if (msg.includes('unique') || msg.includes('duplicate'))
      return 'Já existe uma ordem nessa posição.'
    if (msg.includes('check constraint'))
      return 'Valor inválido. Rode as migrations pendentes no banco (embalagens/reordenação/itens).'
    if (msg.includes('Could not find the function') || msg.includes('reordenar_ordens'))
      return 'Função de reordenação não encontrada — rode a migration 015 no Supabase.'
    if (msg.includes('ordem_itens'))
      return 'Tabela de itens não encontrada — rode a migration 021 no Supabase.'
    console.error(`[OrdensDiariasService.${acao}]`, msg)
    return `Erro ao ${acao} ordem. Tente novamente.`
  }
}

export type { OrdemItem }
