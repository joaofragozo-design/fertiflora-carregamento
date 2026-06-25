import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/supabase/get-user'
import { ROUTES } from '@/constants/routes'
import type { AppUser } from '@/types'

/**
 * Helper para Server Components: verifica autenticação e role.
 * Redireciona para login se não autenticado, ou para redirectTo se role inválido.
 */
export async function requireRole(
  allowedRoles: AppUser['role'][],
  redirectTo: string = ROUTES.HOME
): Promise<AppUser> {
  const user = await getAuthUser()

  if (!user) redirect(ROUTES.LOGIN)
  if (!allowedRoles.includes(user.role)) redirect(redirectTo)

  return user
}
