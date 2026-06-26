import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getAuthContext } from '@/lib/supabase/get-user'
import { createClient } from '@/lib/supabase/server'
import { ROUTES } from '@/constants/routes'
import { OrdensParnel } from './_painel'
import type { OrdemDiaria } from '@/types/formula'

export const metadata: Metadata = {
  title: 'Ordens Diárias de Carregamento',
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export default async function OrdensPage() {
  const { sessionUser, profile } = await getAuthContext()

  if (!sessionUser || !profile) redirect(ROUTES.LOGIN)

  const hoje = toDateString(new Date())
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
    .eq('data', hoje)
    .order('sequencia', { ascending: true })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: formulas } = await (supabase as any)
    .from('formulas')
    .select('id, nome')
    .eq('ativo', true)
    .order('nome', { ascending: true })

  return (
    <OrdensParnel
      initialOrdens={(ordens ?? []) as OrdemDiaria[]}
      initialFormulas={(formulas ?? []) as { id: number; nome: string }[]}
      user={profile}
      hoje={hoje}
    />
  )
}
