import type { Cliente } from '@/types/cliente'
import type { createClient } from '@/lib/supabase/client'

type DB = ReturnType<typeof createClient>

export class ClientesService {
  constructor(private supabase: DB) {}

  async getAll(): Promise<Cliente[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase as any)
      .from('clientes_carregamento')
      .select('*')
      .order('nome', { ascending: true })

    if (error) throw new Error('Erro ao carregar clientes.')
    return data as Cliente[]
  }

  /** Cadastra um cliente novo. Se já existir (mesmo nome), retorna o existente. */
  async criar(nome: string): Promise<Cliente> {
    const nomeLimpo = nome.trim()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase as any)
      .from('clientes_carregamento')
      .insert({ nome: nomeLimpo })
      .select('*')
      .single()

    if (!error) return data as Cliente

    if (error.message.includes('duplicate') || error.message.includes('unique')) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existente } = await (this.supabase as any)
        .from('clientes_carregamento')
        .select('*')
        .ilike('nome', nomeLimpo)
        .single()
      if (existente) return existente as Cliente
    }

    if (error.message.includes('row-level security')) throw new Error('Sem permissão para cadastrar cliente.')
    console.error('[ClientesService.criar]', error.message)
    throw new Error('Erro ao cadastrar cliente. Tente novamente.')
  }
}
