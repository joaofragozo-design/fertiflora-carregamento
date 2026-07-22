import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getAuthContext } from '@/lib/supabase/get-user'
import { createClient } from '@/lib/supabase/server'
import { ROUTES, ROLE_DEFAULT_ROUTES } from '@/constants/routes'
import type { Transportadora } from '@/types/transportadora'
import { GestaoTransportadoras } from './_gestao'

export const metadata: Metadata = {
  title: 'Transportadoras',
}

export default async function TransportadorasPage() {
  const { sessionUser, profile } = await getAuthContext()
  if (!sessionUser || !profile) redirect(ROUTES.LOGIN)

  const podeGerenciar = profile.role === 'admin' || profile.role === 'logistica'
  if (!podeGerenciar) redirect(ROLE_DEFAULT_ROUTES[profile.role] ?? ROUTES.HOME)

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: transportadoras } = await (supabase as any)
    .from('transportadoras')
    .select('*')
    .order('nome', { ascending: true })

  return <GestaoTransportadoras initialTransportadoras={(transportadoras ?? []) as Transportadora[]} />
}
