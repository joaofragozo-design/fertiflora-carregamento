import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getAuthContext } from '@/lib/supabase/get-user'
import { ROUTES } from '@/constants/routes'
import { ImportarFormulasClient } from './_client'

export const metadata: Metadata = {
  title: 'Importar Fórmulas — Admin',
}

export default async function AdminFormulasPage() {
  const { sessionUser, profile } = await getAuthContext()

  if (!sessionUser || !profile) redirect(ROUTES.LOGIN)
  if (profile.role !== 'admin' && profile.role !== 'logistica') redirect(ROUTES.ORDENS)

  return <ImportarFormulasClient />
}
