import type { Programacao, ProgramacaoInsert, ProgramacaoUpdate } from '@/types/programacao'
import type { createClient } from '@/lib/supabase/client'

type DB = ReturnType<typeof createClient>

const SELECT = `*, formula:formulas (
  id, nome, mo, map, calcario_concha, sulfato_amonia, carbonato_ca_mg,
  ureia, cloreto_potassio, boro, enxofre_pastilhado, fte_br_12, oxmag_s, tsp, caltimag, hiphos_25,
  ativo, created_at, updated_at
)`

export class ProgramacaoService {
  constructor(private supabase: DB) {}

  async getByRange(inicio: string, fim: string): Promise<Programacao[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase as any)
      .from('programacao_carregamento')
      .select(SELECT)
      .gte('data', inicio)
      .lte('data', fim)
      .order('data', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) throw new Error('Erro ao carregar a programação.')
    return data as Programacao[]
  }

  async criar(input: ProgramacaoInsert): Promise<Programacao> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase as any)
      .from('programacao_carregamento')
      .insert(input)
      .select(SELECT)
      .single()

    if (error) throw new Error(this.traduzirErro(error.message, 'criar'))
    return data as Programacao
  }

  async atualizar(id: string, input: ProgramacaoUpdate): Promise<Programacao> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase as any)
      .from('programacao_carregamento')
      .update(input)
      .eq('id', id)
      .select(SELECT)
      .single()

    if (error) throw new Error(this.traduzirErro(error.message, 'atualizar'))
    return data as Programacao
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
    console.error(`[ProgramacaoService.${acao}]`, msg)
    return `Erro ao ${acao} item da programação. Tente novamente.`
  }
}
