import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getAuthContext } from '@/lib/supabase/get-user'
import { ROUTES } from '@/constants/routes'
import { Configuracoes } from './_configuracoes'

export const metadata: Metadata = {
  title: 'Configurações',
}

/** Configurações do próprio perfil: foto e nome de exibição. O login (username) não muda aqui. */
export default async function ConfiguracoesPage() {
  const { sessionUser, profile } = await getAuthContext()
  if (!sessionUser || !profile) redirect(ROUTES.LOGIN)

  return <Configuracoes perfil={profile} />
}
