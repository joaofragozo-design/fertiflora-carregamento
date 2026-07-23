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

  /** Cadastra um motorista novo (documentos e placa cavalo/reboque 1 obrigatórios). */
  async criarMotorista(input: {
    transportadora_id: string
    nome:              string
    whatsapp:          string
    cpf:               string
    rg:                string
    cnh:               string
    placa_cavalo:      string
    placa_1:           string
    placa_2?:          string
    placa_3?:          string
    placa_4?:          string
  }): Promise<Motorista> {
    const nome = input.nome.trim()
    const whatsapp = input.whatsapp.trim()
    const cpf = input.cpf.trim()
    const rg = input.rg.trim()
    const cnh = input.cnh.trim()
    const placaCavalo = input.placa_cavalo.trim().toUpperCase()
    const placa1 = input.placa_1.trim().toUpperCase()

    if (!nome) throw new Error('Informe o nome do motorista.')
    if (whatsapp.replace(/\D/g, '').length < 10) throw new Error('Informe o WhatsApp do motorista com DDD (obrigatório).')
    if (cpf.replace(/\D/g, '').length !== 11) throw new Error('Informe um CPF válido (11 dígitos).')
    if (!rg) throw new Error('Informe o RG do motorista.')
    if (!cnh) throw new Error('Informe o número da CNH do motorista.')
    if (!placaCavalo) throw new Error('Informe a placa do cavalo.')
    if (!placa1) throw new Error('Informe a placa do reboque (placa 1).')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase as any)
      .from('motoristas')
      .insert({
        transportadora_id: input.transportadora_id,
        nome, whatsapp, cpf, rg, cnh,
        placa_cavalo: placaCavalo,
        placa_1: placa1,
        placa_2: input.placa_2?.trim().toUpperCase() || null,
        placa_3: input.placa_3?.trim().toUpperCase() || null,
        placa_4: input.placa_4?.trim().toUpperCase() || null,
      })
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
