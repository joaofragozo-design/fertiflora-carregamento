import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getAuthContext } from '@/lib/supabase/get-user'
import { createClient } from '@/lib/supabase/server'
import { ROUTES } from '@/constants/routes'
import { CarregamentoPainel } from './_painel'
import type { Carregamento } from '@/types'

export const metadata: Metadata = {
  title: 'Painel de Carregamento',
}

export default async function CarregamentoPage() {
  const { sessionUser, profile } = await getAuthContext()

  if (!sessionUser || !profile) redirect(ROUTES.LOGIN)
  // Redirect por role já tratado no DashboardLayout.

  const supabase = await createClient()
  const { data: ativas } = await supabase
    .from('carregamentos')
    .select('*')
    .in('status', ['PENDENTE', 'CARREGANDO'])
    .order('created_at', { ascending: false })

  const { data: recentes } = await supabase
    .from('carregamentos')
    .select('*')
    .eq('status', 'CONCLUIDO')
    .order('finished_at', { ascending: false })
    .limit(20)

  const initialOrdens: Carregamento[] = [
    ...((ativas   ?? []) as Carregamento[]),
    ...((recentes ?? []) as Carregamento[]),
  ]

  return <CarregamentoPainel initialOrdens={initialOrdens} user={profile} />
}
