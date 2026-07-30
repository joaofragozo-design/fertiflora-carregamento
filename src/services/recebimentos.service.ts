import type { createClient } from '@/lib/supabase/client'
import type { Fornecedor } from '@/types/fornecedor'
import type { Transportadora } from '@/types/transportadora'
import { formatPlacaCompleta } from '@/lib/utils/format'

type DB = ReturnType<typeof createClient>

// Alias diferente de `fornecedor` (a coluna de texto livre legada) de propósito
// -- `select('*, fornecedor:fornecedores(...)')` colidiria com a coluna real.
const SELECT_COMPLETO = `
  *,
  fornecedor_rel:fornecedores ( id, nome, created_at, updated_at ),
  transportadora:transportadoras ( id, nome, profile_id, ativo, created_at, updated_at )
`.trim()

// Previsão de chegada de matéria-prima ("Programação de Recebimento"), espelho
// da Programação de Carregamento: a Logística lança (data prevista, matéria-
// prima, quantidade, fornecedor, transportadora, motorista, placas, nota
// fiscal); o Faturamento confirma a chegada. `materia_prima`/`fornecedor`
// (texto livre) são o formato antigo (migration 058), mantidos só pra não
// quebrar registros lançados antes das migrations 063/065 — os demais campos
// estruturados são os usados daqui pra frente.
export interface RecebimentoPrevisto {
  id:                string
  data_prevista:     string
  materia_prima:     string
  materia_prima_key: string | null
  quantidade_ton:    number
  fornecedor:        string
  fornecedor_id:     string | null
  fornecedor_obj?:   Fornecedor | null
  transportadora_id: string | null
  transportadora?:   Transportadora | null
  motorista_nome:    string
  numero_nota:       string
  placa:             string
  placa_cavalo:      string
  placa_1:           string
  placa_2:           string | null
  placa_3:           string | null
  placa_4:           string | null
  observacao:        string
  recebido:          boolean
  confirmado_em:     string | null
  confirmado_por:    string | null
  iniciado_em:       string | null
  iniciado_por:      string | null
  finalizado_em:     string | null
  finalizado_por:    string | null
  motorista_lat:              number | null
  motorista_lng:              number | null
  motorista_localizacao_em:   string | null
  created_at:        string
  updated_at:        string
}

export type StatusRecebimento = 'AGUARDANDO_CHEGADA' | 'AGUARDANDO_FILA' | 'DESCARREGANDO' | 'FINALIZADO'

export const STATUS_RECEBIMENTO_LABEL: Record<StatusRecebimento, string> = {
  AGUARDANDO_CHEGADA: 'Aguardando chegada',
  AGUARDANDO_FILA:     'Aguardando na fila',
  DESCARREGANDO:       'Descarregando',
  FINALIZADO:          'Finalizado',
}

export function getStatusRecebimento(r: Pick<RecebimentoPrevisto, 'confirmado_em' | 'iniciado_em' | 'finalizado_em'>): StatusRecebimento {
  if (r.finalizado_em) return 'FINALIZADO'
  if (r.iniciado_em) return 'DESCARREGANDO'
  if (r.confirmado_em) return 'AGUARDANDO_FILA'
  return 'AGUARDANDO_CHEGADA'
}

/** Placa completa (cavalo + reboques) — ver formatPlacaCompleta. */
export const labelPlacaCompleta = formatPlacaCompleta

export interface RecebimentoInsert {
  data_prevista:     string
  materia_prima_key: string
  quantidade_ton:    number
  fornecedor_id:     string | null
  transportadora_id: string | null
  motorista_nome:    string
  numero_nota:       string
  placa_cavalo:      string
  placa_1:           string
  placa_2?:          string
  placa_3?:          string
  placa_4?:          string
  observacao:        string
}

export class RecebimentosService {
  constructor(private supabase: DB) {}

  /** Recebimentos de uma janela de datas (semana), com fornecedor/transportadora já resolvidos. */
  async getByRange(inicio: string, fim: string): Promise<RecebimentoPrevisto[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase as any)
      .from('recebimentos_previstos')
      .select(SELECT_COMPLETO)
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
      .select(SELECT_COMPLETO)
      .is('confirmado_em', null)
      .order('data_prevista', { ascending: true })

    if (aPartirDe) query = query.gte('data_prevista', aPartirDe)

    const { data, error } = await query
    if (error) throw new Error(this.traduzirErro(error.message, 'listar recebimentos'))
    return this.normalizar(data)
  }

  async criar(input: RecebimentoInsert): Promise<RecebimentoPrevisto> {
    const placaCavalo = input.placa_cavalo.trim().toUpperCase()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase as any)
      .from('recebimentos_previstos')
      .insert({
        data_prevista: input.data_prevista,
        materia_prima_key: input.materia_prima_key,
        materia_prima: input.materia_prima_key, // compat com telas/consultas antigas
        quantidade_ton: input.quantidade_ton,
        fornecedor_id: input.fornecedor_id,
        transportadora_id: input.transportadora_id,
        motorista_nome: input.motorista_nome.trim(),
        numero_nota: input.numero_nota.trim(),
        placa_cavalo: placaCavalo,
        placa: placaCavalo, // compat com telas/consultas antigas
        placa_1: input.placa_1.trim().toUpperCase(),
        placa_2: input.placa_2?.trim().toUpperCase() || null,
        placa_3: input.placa_3?.trim().toUpperCase() || null,
        placa_4: input.placa_4?.trim().toUpperCase() || null,
        observacao: input.observacao,
      })
      .select(SELECT_COMPLETO)
      .single()

    if (error) throw new Error(this.traduzirErro(error.message, 'lançar recebimento'))
    return this.normalizar([data])[0]
  }

  /** Corrige os dados de uma previsão já lançada (ex.: faltou o nome do
   *  motorista) — evita ter que excluir e lançar de novo. Mesma checagem de
   *  permissão da criação (admin/logistica, via RLS/trigger no banco). */
  async atualizar(id: string, input: RecebimentoInsert): Promise<RecebimentoPrevisto> {
    const placaCavalo = input.placa_cavalo.trim().toUpperCase()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase as any)
      .from('recebimentos_previstos')
      .update({
        data_prevista: input.data_prevista,
        materia_prima_key: input.materia_prima_key,
        materia_prima: input.materia_prima_key,
        quantidade_ton: input.quantidade_ton,
        fornecedor_id: input.fornecedor_id,
        transportadora_id: input.transportadora_id,
        motorista_nome: input.motorista_nome.trim(),
        numero_nota: input.numero_nota.trim(),
        placa_cavalo: placaCavalo,
        placa: placaCavalo,
        placa_1: input.placa_1.trim().toUpperCase(),
        placa_2: input.placa_2?.trim().toUpperCase() || null,
        placa_3: input.placa_3?.trim().toUpperCase() || null,
        placa_4: input.placa_4?.trim().toUpperCase() || null,
        observacao: input.observacao,
      })
      .eq('id', id)
      .select(SELECT_COMPLETO)
      .single()

    if (error) throw new Error(this.traduzirErro(error.message, 'editar recebimento'))
    return this.normalizar([data])[0]
  }

  /** Faturamento confirma que o caminhão de matéria-prima chegou. */
  async confirmarChegada(id: string, usuario: string): Promise<RecebimentoPrevisto> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase as any)
      .from('recebimentos_previstos')
      .update({ confirmado_em: new Date().toISOString(), confirmado_por: usuario, recebido: true })
      .eq('id', id)
      .select(SELECT_COMPLETO)
      .single()

    if (error) throw new Error(this.traduzirErro(error.message, 'confirmar chegada'))
    return this.normalizar([data])[0]
  }

  /** Faturamento marca que começou a descarregar o caminhão na fábrica. */
  async iniciarDescarga(id: string, usuario: string): Promise<RecebimentoPrevisto> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase as any)
      .from('recebimentos_previstos')
      .update({ iniciado_em: new Date().toISOString(), iniciado_por: usuario })
      .eq('id', id)
      .select(SELECT_COMPLETO)
      .single()

    if (error) throw new Error(this.traduzirErro(error.message, 'iniciar a descarga'))
    return this.normalizar([data])[0]
  }

  /** Faturamento marca que terminou de descarregar o caminhão — é esse evento
   *  que soma a matéria-prima no estoque (trigger movimentar_estoque_recebimento,
   *  migration 069). */
  async finalizarDescarga(id: string, usuario: string): Promise<RecebimentoPrevisto> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase as any)
      .from('recebimentos_previstos')
      .update({ finalizado_em: new Date().toISOString(), finalizado_por: usuario })
      .eq('id', id)
      .select(SELECT_COMPLETO)
      .single()

    if (error) throw new Error(this.traduzirErro(error.message, 'finalizar a descarga'))
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
    // Mensagens do trigger enforce_recebimento_update (068) já são amigáveis —
    // repassa direto em vez de esconder atrás do erro genérico (ex.: clique
    // duplo/duas abas tentando iniciar ou finalizar a mesma descarga ao mesmo tempo).
    if (msg.includes('A descarga') || msg.includes('Só é possível'))
      return msg
    console.error(`[RecebimentosService.${acao}]`, msg)
    return `Erro ao ${acao}. Tente novamente.`
  }
}
