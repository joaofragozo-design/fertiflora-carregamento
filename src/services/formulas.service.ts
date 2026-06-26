import type { Formula } from '@/types/formula'
import type { createClient } from '@/lib/supabase/client'

type DB = ReturnType<typeof createClient>

export class FormulasService {
  constructor(private supabase: DB) {}

  async getAll(): Promise<Formula[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase as any)
      .from('formulas')
      .select('*')
      .eq('ativo', true)
      .order('nome', { ascending: true })

    if (error) throw new Error('Erro ao carregar fórmulas.')
    return data as Formula[]
  }

  async getById(id: number): Promise<Formula | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase as any)
      .from('formulas')
      .select('*')
      .eq('id', id)
      .single()

    if (error) return null
    return data as Formula
  }

  async search(query: string): Promise<Formula[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase as any)
      .from('formulas')
      .select('*')
      .eq('ativo', true)
      .ilike('nome', `%${query}%`)
      .order('nome', { ascending: true })
      .limit(50)

    if (error) throw new Error('Erro ao buscar fórmulas.')
    return data as Formula[]
  }

  async upsertMany(formulas: Omit<Formula, 'id' | 'created_at' | 'updated_at'>[]): Promise<number> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase as any)
      .from('formulas')
      .upsert(formulas, { onConflict: 'nome', ignoreDuplicates: false })
      .select('id')

    if (error) throw new Error(`Erro ao importar fórmulas: ${error.message}`)
    return (data as { id: number }[]).length
  }

  async toggleAtivo(id: number, ativo: boolean): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (this.supabase as any)
      .from('formulas')
      .update({ ativo })
      .eq('id', id)

    if (error) throw new Error('Erro ao atualizar fórmula.')
  }
}
