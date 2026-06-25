'use client'

import { useAuth } from './use-auth'

export type UserRole = 'operador_carregamento' | 'operador_pa' | 'admin' | null

export interface AuthRole {
  role:           UserRole
  isAdmin:        boolean
  isCarregamento: boolean
  isPa:           boolean
}

export function useAuthRole(): AuthRole {
  const { user } = useAuth()
  const role = (user?.role ?? null) as UserRole

  return {
    role,
    isAdmin:        role === 'admin',
    isCarregamento: role === 'operador_carregamento',
    isPa:           role === 'operador_pa',
  }
}
