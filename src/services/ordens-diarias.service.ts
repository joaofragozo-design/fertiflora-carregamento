import type { OrdemDiaria, OrdemDiariaInsert, OrdemDiariaUpdate } from '@/types/formula'
import type { createClient } from '@/lib/supabase/client'

type DB = ReturnType<typeof createClient>

const SELECT_WITH_FORMULA = `
  *,
  formula:formulas (
    id, nome, mo, map, calcario_concha, sulfato_amonia, carbonato_ca_mg,
    ureia, cloreto_potassio, boro, enxofre_pastilhado, fte_br_12, oxmag_s, tsp, caltimag, hiphos_25,
    ativo, created_at, updated_at
  )
`.trim()

export class OrdensDiariasService {
  constructor(private supabase: DB) {}

  async getByDate(data: string): Promise<OrdemDiaria[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rows, error } = await (this.supabase as any)
      .from('ordens_diarias')
      .select(SELECT_WITH_FORMULA)
      .eq('data', data)
      .order('sequencia', { ascending: true })

    if (error) throw new Error('Erro ao carregar ordens do dia.')
    return rows as OrdemDiaria[]
  }

  async criar(input: Omit<OrdemDiariaInsert, 'sequencia'>): Promise<OrdemDiaria> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase as any)
      .from('ordens_diarias')
      .insert(input)
      .select(SELECT_WITH_FORMULA)
      .single()

    if (error) throw new Error(this.traduzirErro(error.message, 'criar'))
    return data as OrdemDiaria
  }

  async atualizar(id: string, input: OrdemDiariaUpdate): Promise<OrdemDiaria> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase as any)
      .from('ordens_diarias')
      .update(input)
      .eq('id', id)
      .select(SELECT_WITH_FORMULA)
      .single()

    if (error) throw new Error(this.traduzirErro(error.message, 'atualizar'))
    return data as OrdemDiaria
  }

  async marcarIniciado(id: string): Promise<OrdemDiaria> {
    return this.atualizar(id, { iniciado: true })
  }

  async marcarFinalizado(id: string): Promise<OrdemDiaria> {
    return this.atualizar(id, { iniciado: true, finalizado: true })
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
    console.error(`[OrdensDiariasService.${acao}]`, msg)
    return `Erro ao ${acao} ordem. Tente novamente.`
  }
}
