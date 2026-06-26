import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getAuthContext } from '@/lib/supabase/get-user'
import { createClient } from '@/lib/supabase/server'
import { ROUTES } from '@/constants/routes'
import { CatalogoFormulas } from './_catalogo'
import type { Formula } from '@/types/formula'

export const metadata: Metadata = {
  title: 'Fórmulas — Admin',
}

export default async function AdminFormulasPage() {
  const { sessionUser, profile } = await getAuthContext()

  if (!sessionUser || !profile) redirect(ROUTES.LOGIN)
  if (profile.role !== 'admin' && profile.role !== 'logistica') redirect(ROUTES.ORDENS)

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: formulas } = await (supabase as any)
    .from('formulas')
    .select('*')
    .order('nome', { ascending: true })

  return <CatalogoFormulas formulas={(formulas ?? []) as Formula[]} />
}
