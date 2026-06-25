import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getAuthContext } from '@/lib/supabase/get-user'
import { createClient } from '@/lib/supabase/server'
import { ROUTES } from '@/constants/routes'
import { PaPainel } from './_painel'
import type { Carregamento } from '@/types'

export const metadata: Metadata = {
  title: 'Painel da Pá Carregadeira',
}

export default async function PaPage() {
  const { sessionUser, profile } = await getAuthContext()

  if (!sessionUser || !profile) redirect(ROUTES.LOGIN)
  // Redirect por role já tratado no DashboardLayout.

  const isAdmin  = profile.role === 'admin'
  const supabase = await createClient()

  let initialOrdens: Carregamento[]

  if (isAdmin) {
    const [{ data: ativos }, { data: concluidos }] = await Promise.all([
      supabase
        .from('carregamentos')
        .select('*')
        .in('status', ['PENDENTE', 'CARREGANDO'])
        .order('created_at', { ascending: true }),
      supabase
        .from('carregamentos')
        .select('*')
        .eq('status', 'CONCLUIDO')
        .order('finished_at', { ascending: false })
        .limit(50),
    ])
    initialOrdens = [
      ...((ativos    ?? []) as Carregamento[]),
      ...((concluidos ?? []) as Carregamento[]),
    ]
  } else {
    // operador_pa: apenas pendentes e em andamento (FIFO)
    const { data } = await supabase
      .from('carregamentos')
      .select('*')
      .in('status', ['PENDENTE', 'CARREGANDO'])
      .order('created_at', { ascending: true })
    initialOrdens = (data ?? []) as Carregamento[]
  }

  return <PaPainel initialOrdens={initialOrdens} user={profile} />
}
