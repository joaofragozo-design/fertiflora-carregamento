import type { Transportadora, Motorista } from '@/types/transportadora'
import type { createClient } from '@/lib/supabase/client'

type DB = ReturnType<typeof createClient>

export class TransportadorasService {
  constructor(private supabase: DB) {}

  async listar(): Promise<Transportadora[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase as any)
      .from('transportadoras')
      .select('*')
      .eq('ativo', true)
      .order('nome', { ascending: true })

    if (error) throw new Error(this.traduzirErro(error.message, 'listar transportadoras'))
    return data as Transportadora[]
  }

  /** Transportadora do usuário logado (role transportadora). */
  async getMinha(profileId: string): Promise<Transportadora | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase as any)
      .from('transportadoras')
      .select('*')
      .eq('profile_id', profileId)
      .maybeSingle()

    if (error) throw new Error(this.traduzirErro(error.message, 'carregar transportadora'))
    return (data as Transportadora) ?? null
  }

  async listarMotoristas(transportadoraId: string): Promise<Motorista[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase as any)
      .from('motoristas')
      .select('*')
      .eq('transportadora_id', transportadoraId)
      .order('nome', { ascending: true })

    if (error) throw new Error(this.traduzirErro(error.message, 'listar motoristas'))
    return data as Motorista[]
  }

  /** Cadastra um motorista novo (WhatsApp obrigatório — recebe a liberação). */
  async criarMotorista(input: { transportadora_id: string; nome: string; whatsapp: string }): Promise<Motorista> {
    const nome = input.nome.trim()
    const whatsapp = input.whatsapp.trim()
    if (!nome) throw new Error('Informe o nome do motorista.')
    if (whatsapp.replace(/\D/g, '').length < 10) throw new Error('Informe o WhatsApp do motorista com DDD (obrigatório).')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase as any)
      .from('motoristas')
      .insert({ transportadora_id: input.transportadora_id, nome, whatsapp })
      .select('*')
      .single()

    if (error) throw new Error(this.traduzirErro(error.message, 'cadastrar motorista'))
    return data as Motorista
  }

  private traduzirErro(msg: string, acao: string): string {
    if (msg.includes('row-level security') || msg.includes('new row violates'))
      return 'Sem permissão para esta operação.'
    if (msg.includes('relation') && msg.includes('does not exist'))
      return 'Tabelas do fluxo de transportadora não encontradas — rode as migrations 057/058 no Supabase.'
    console.error(`[TransportadorasService.${acao}]`, msg)
    return `Erro ao ${acao}. Tente novamente.`
  }
}
