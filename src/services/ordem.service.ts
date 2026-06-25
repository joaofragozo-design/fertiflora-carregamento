import type { Carregamento } from '@/types'
import type { CreateCarregamentoInput } from '@/lib/validations/order'
import type { createClient } from '@/lib/supabase/client'

type DB = ReturnType<typeof createClient>

export class OrdemService {
  constructor(private supabase: DB) {}

  async criar(input: CreateCarregamentoInput): Promise<Carregamento> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase as any)
      .from('carregamentos')
      .insert({ insumo: input.insumo, quantidade: input.quantidade })
      .select()
      .single()

    if (error) throw new Error(this.traduzirErro(error.message, 'criar'))
    return data as Carregamento
  }

  async iniciar(id: string): Promise<Carregamento> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase as any)
      .from('carregamentos')
      .update({ status: 'CARREGANDO' })
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(this.traduzirErro(error.message, 'iniciar'))
    return data as Carregamento
  }

  async cancelar(id: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (this.supabase as any)
      .from('carregamentos')
      .update({ status: 'CANCELADO' })
      .eq('id', id)
      .eq('status', 'PENDENTE')

    if (error) throw new Error(this.traduzirErro(error.message, 'cancelar'))
  }

  async concluir(id: string): Promise<Carregamento> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase as any)
      .from('carregamentos')
      .update({ status: 'CONCLUIDO' })
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(this.traduzirErro(error.message, 'concluir'))
    return data as Carregamento
  }

  private traduzirErro(msg: string, acao: string): string {
    if (msg.includes('Transição') || msg.includes('inválida')) return msg
    if (msg.includes('row-level security') || msg.includes('new row violates'))
      return 'Sem permissão para esta operação.'
    if (msg.includes('check constraint'))
      return 'Dados inválidos. Verifique os campos e tente novamente.'
    console.error(`[OrdemService.${acao}]`, msg)
    return `Erro ao ${acao}. Tente novamente.`
  }
}
