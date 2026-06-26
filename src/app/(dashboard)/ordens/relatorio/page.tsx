import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getAuthContext } from '@/lib/supabase/get-user'
import { createClient } from '@/lib/supabase/server'
import { ROUTES } from '@/constants/routes'
import { RelatorioDiario } from './_relatorio'
import type { OrdemDiaria } from '@/types/formula'

export const metadata: Metadata = {
  title: 'Relatório Diário — Ordens de Carregamento',
}

function hojeStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export default async function RelatorioPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string }>
}) {
  const { sessionUser, profile } = await getAuthContext()
  if (!sessionUser || !profile) redirect(ROUTES.LOGIN)

  const sp = await searchParams
  const data = sp?.data && /^\d{4}-\d{2}-\d{2}$/.test(sp.data) ? sp.data : hojeStr()

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: ordens } = await (supabase as any)
    .from('ordens_diarias')
    .select(`
      *,
      formula:formulas (
        id, nome, mo, map, calcario_concha, sulfato_amonia, carbonato_ca_mg,
        ureia, cloreto_potassio, boro, enxofre_pastilhado, fte_br_12, oxmag_s, tsp, caltimag, hiphos_25,
        ativo, created_at, updated_at
      )
    `)
    .eq('data', data)
    .order('sequencia', { ascending: true })

  return <RelatorioDiario ordens={(ordens ?? []) as OrdemDiaria[]} data={data} />
}
