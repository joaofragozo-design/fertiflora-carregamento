import { redirect } from 'next/navigation'
import { getAuthContext } from '@/lib/supabase/get-user'
import { ROLE_DEFAULT_ROUTES, ROUTES } from '@/constants/routes'

export default async function RootPage() {
  const { sessionUser, profile } = await getAuthContext()

  // Sem JWT → login
  if (!sessionUser) {
    redirect(ROUTES.LOGIN)
  }

  // Com profile → rota do role; sem profile (migration pendente) → rota padrão
  const destination = profile
    ? (ROLE_DEFAULT_ROUTES[profile.role] ?? ROUTES.CARREGAMENTO)
    : ROUTES.CARREGAMENTO

  redirect(destination)
}
