import type { Programacao, ProgramacaoUpdate, ProgramacaoItem, ProgramacaoItemInsert, ProgramacaoItemUpdate } from '@/types/programacao'
import type { createClient } from '@/lib/supabase/client'

type DB = ReturnType<typeof createClient>

const SELECT_ITEM_FORMULA = `
  id, nome, mo, map, calcario_concha, sulfato_amonia, carbonato_ca_mg,
  ureia, cloreto_potassio, boro, enxofre_pastilhado, fte_br_12, oxmag_s, tsp, caltimag, hiphos_25,
  ativo, created_at, updated_at
`.trim()

const SELECT_COM_ITENS = `
  *,
  itens:programacao_itens (
    *,
    formula:formulas ( ${SELECT_ITEM_FORMULA} )
  ),
  transportadora:transportadoras ( id, nome, profile_id, ativo, created_at, updated_at ),
  motorista:motoristas ( id, transportadora_id, nome, whatsapp, created_at, updated_at )
`.trim()

export class ProgramacaoService {
  constructor(private supabase: DB) {}

  async getByRange(inicio: string, fim: string): Promise<Programacao[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase as any)
      .from('programacao_carregamento')
      .select(SELECT_COM_ITENS)
      .gte('data', inicio)
      .lte('data', fim)
      .order('data', { ascending: true })
      .order('created_at', { ascending: true })
      .order('created_at', { foreignTable: 'programacao_itens', ascending: true })

    if (error) throw new Error('Erro ao carregar a programação.')
    return data as Programacao[]
  }

  async getById(id: string): Promise<Programacao> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase as any)
      .from('programacao_carregamento')
      .select(SELECT_COM_ITENS)
      .eq('id', id)
      .order('created_at', { foreignTable: 'programacao_itens', ascending: true })
      .single()

    if (error) throw new Error('Erro ao carregar o agendamento.')
    return data as Programacao
  }

  /** Cria um agendamento já com o primeiro item (fórmula/quantidade/embalagem). */
  async criar(input: {
    data: string
    cliente: string
    cliente_codigo: number | null
    observacao: string
    formula_id: number | null
    quantidade: number
    embalagem: ProgramacaoItemInsert['embalagem']
  }): Promise<Programacao> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: prog, error } = await (this.supabase as any)
      .from('programacao_carregamento')
      .insert({ data: input.data, cliente: input.cliente, cliente_codigo: input.cliente_codigo, observacao: input.observacao })
      .select('*')
      .single()

    if (error) throw new Error(this.traduzirErro(error.message, 'criar'))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: itemErr } = await (this.supabase as any)
      .from('programacao_itens')
      .insert({
        programacao_id: prog.id,
        formula_id: input.formula_id,
        quantidade: input.quantidade,
        embalagem: input.embalagem,
      })

    if (itemErr) {
      // Evita agendamento órfão sem nenhum item (as duas inserções não são atômicas).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (this.supabase as any).from('programacao_carregamento').delete().eq('id', prog.id)
      throw new Error(this.traduzirErro(itemErr.message, 'criar item'))
    }

    return this.getById(prog.id)
  }

  /** Atualiza os campos do agendamento (cliente, data, observação). */
  async atualizar(id: string, input: ProgramacaoUpdate): Promise<Programacao> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (this.supabase as any)
      .from('programacao_carregamento')
      .update(input)
      .eq('id', id)

    if (error) throw new Error(this.traduzirErro(error.message, 'atualizar'))
    return this.getById(id)
  }

  /** Adiciona um novo item (fórmula/quantidade/embalagem) a um agendamento existente. */
  async adicionarItem(programacaoId: string, input: Omit<ProgramacaoItemInsert, 'programacao_id'>): Promise<Programacao> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (this.supabase as any)
      .from('programacao_itens')
      .insert({ programacao_id: programacaoId, ...input })

    if (error) throw new Error(this.traduzirErro(error.message, 'adicionar item'))
    return this.getById(programacaoId)
  }

  async atualizarItem(itemId: string, programacaoId: string, input: ProgramacaoItemUpdate): Promise<Programacao> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (this.supabase as any)
      .from('programacao_itens')
      .update(input)
      .eq('id', itemId)

    if (error) throw new Error(this.traduzirErro(error.message, 'atualizar item'))
    return this.getById(programacaoId)
  }

  async removerItem(itemId: string, programacaoId: string): Promise<Programacao> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (this.supabase as any)
      .from('programacao_itens')
      .delete()
      .eq('id', itemId)

    if (error) throw new Error(this.traduzirErro(error.message, 'remover item'))
    return this.getById(programacaoId)
  }

  /** Faturamento confirma que o caminhão chegou — notifica a Logística via realtime. */
  async confirmarChegada(id: string, usuario: string): Promise<Programacao> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (this.supabase as any)
      .from('programacao_carregamento')
      .update({ confirmado_em: new Date().toISOString(), confirmado_por: usuario })
      .eq('id', id)

    if (error) throw new Error(this.traduzirErro(error.message, 'confirmar chegada'))
    return this.getById(id)
  }

  // ─── Fluxo transportadora/motorista ────────────────────────────────────

  /** Logística envia o agendamento para a transportadora escolhida. */
  async enviarParaTransportadora(id: string, transportadoraId: string): Promise<Programacao> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (this.supabase as any)
      .from('programacao_carregamento')
      .update({
        transportadora_id: transportadoraId,
        solicitacao_status: 'ENVIADO_TRANSPORTADORA',
        enviado_transportadora_em: new Date().toISOString(),
        // Reenvio pra outra transportadora zera o que a anterior preencheu.
        motorista_id: null,
        solicitado_em: null,
        liberado_em: null,
        liberado_por: null,
      })
      .eq('id', id)

    if (error) throw new Error(this.traduzirErro(error.message, 'enviar para transportadora'))
    return this.getById(id)
  }

  /** Transportadora anexa o motorista e envia a solicitação pra Logística liberar. */
  async enviarSolicitacao(id: string, motoristaId: string): Promise<Programacao> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (this.supabase as any)
      .from('programacao_carregamento')
      .update({
        motorista_id: motoristaId,
        solicitacao_status: 'SOLICITADO',
        solicitado_em: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) throw new Error(this.traduzirErro(error.message, 'enviar solicitação'))
    return this.getById(id)
  }

  /** Logística (Françoa) libera a solicitação — na sequência a interface abre o WhatsApp do motorista. */
  async liberarSolicitacao(id: string, usuario: string): Promise<Programacao> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (this.supabase as any)
      .from('programacao_carregamento')
      .update({
        solicitacao_status: 'LIBERADO',
        liberado_em: new Date().toISOString(),
        liberado_por: usuario,
      })
      .eq('id', id)

    if (error) throw new Error(this.traduzirErro(error.message, 'liberar solicitação'))
    return this.getById(id)
  }

  /** Solicitações aguardando ação da Logística (liberar ou abrir o WhatsApp) — aba Transportadoras. */
  async getPendentesLiberacao(): Promise<Programacao[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase as any)
      .from('programacao_carregamento')
      .select(SELECT_COM_ITENS)
      .in('solicitacao_status', ['SOLICITADO', 'LIBERADO'])
      .is('confirmado_em', null)
      .order('data', { ascending: true })
      .order('created_at', { ascending: true })
      .order('created_at', { foreignTable: 'programacao_itens', ascending: true })

    if (error) throw new Error(this.traduzirErro(error.message, 'carregar solicitações'))
    return data as Programacao[]
  }

  /** Agendamentos endereçados a uma transportadora (tela da transportadora). */
  async getDaTransportadora(transportadoraId: string): Promise<Programacao[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase as any)
      .from('programacao_carregamento')
      .select(SELECT_COM_ITENS)
      .eq('transportadora_id', transportadoraId)
      .not('solicitacao_status', 'is', null)
      .order('data', { ascending: true })
      .order('created_at', { ascending: true })
      .order('created_at', { foreignTable: 'programacao_itens', ascending: true })

    if (error) throw new Error(this.traduzirErro(error.message, 'carregar agendamentos'))
    return data as Programacao[]
  }

  /** Marca o agendamento como enviado para as Ordens do Dia (selo, não bloqueia reenvio). */
  async marcarEnviado(id: string): Promise<Programacao> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (this.supabase as any)
      .from('programacao_carregamento')
      .update({ enviado_em: new Date().toISOString() })
      .eq('id', id)

    if (error) throw new Error(this.traduzirErro(error.message, 'marcar como enviado'))
    return this.getById(id)
  }

  async deletar(id: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (this.supabase as any)
      .from('programacao_carregamento')
      .delete()
      .eq('id', id)

    if (error) throw new Error(this.traduzirErro(error.message, 'remover'))
  }

  private traduzirErro(msg: string, acao: string): string {
    if (msg.includes('row-level security') || msg.includes('new row violates'))
      return 'Sem permissão para esta operação.'
    if (msg.includes('check constraint'))
      return 'Valor inválido. Rode as migrations pendentes no banco.'
    if (msg.includes('programacao_itens'))
      return 'Tabela de itens da programação não encontrada — rode a migration 022 no Supabase.'
    console.error(`[ProgramacaoService.${acao}]`, msg)
    return `Erro ao ${acao} item da programação. Tente novamente.`
  }
}

export type { ProgramacaoItem }
