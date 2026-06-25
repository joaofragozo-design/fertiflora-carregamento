'use client'

import { useAuthContext } from '@/providers/auth-provider'

/**
 * Acessa o usuário autenticado e funções de auth.
 * Deve ser usado dentro de um componente envolvido pelo AuthProvider.
 */
export function useAuth() {
  return useAuthContext()
}
