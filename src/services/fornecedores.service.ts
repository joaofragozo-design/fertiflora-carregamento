import type { Fornecedor } from '@/types/fornecedor'
import type { createClient } from '@/lib/supabase/client'

type DB = ReturnType<typeof createClient>

export class FornecedoresService {
  constructor(private supabase: DB) {}

  async getAll(): Promise<Fornecedor[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase as any)
      .from('fornecedores')
      .select('*')
      .order('nome', { ascending: true })

    if (error) throw new Error('Erro ao carregar fornecedores.')
    return data as Fornecedor[]
  }

  /** Cadastra um fornecedor novo. Se já existir (mesmo nome), retorna o existente. */
  async criar(nome: string): Promise<Fornecedor> {
    const nomeLimpo = nome.trim()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase as any)
      .from('fornecedores')
      .insert({ nome: nomeLimpo })
      .select('*')
      .single()

    if (!error) return data as Fornecedor

    if (error.message.includes('duplicate') || error.message.includes('unique')) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existente } = await (this.supabase as any)
        .from('fornecedores')
        .select('*')
        .ilike('nome', nomeLimpo)
        .single()
      if (existente) return existente as Fornecedor
    }

    if (error.message.includes('row-level security')) throw new Error('Sem permissão para cadastrar fornecedor.')
    console.error('[FornecedoresService.criar]', error.message)
    throw new Error('Erro ao cadastrar fornecedor. Tente novamente.')
  }
}
