import { cache } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from './server'
import type { AppUser } from '@/types'

export interface AuthResult {
  sessionUser: User | null
  profile: AppUser | null
}

/**
 * Role vem exclusivamente da tabela profiles.
 * Sem fallback. Sem metadata. Sem auto-criação de profile.
 * Se não houver profile → profile: null → layout redireciona para login.
 */
export const getAuthContext = cache(async (): Promise<AuthResult> => {
  try {
    const supabase = await createClient()

    let { data: { user }, error: authError } = await supabase.auth.getUser()
    // Falha passageira (rede/5xx) ≠ sessão inválida: tenta mais uma vez antes de
    // o layout mandar a pessoa pro login.
    if (!user && authError && authError.name !== 'AuthSessionMissingError' && !(authError.status && authError.status < 500)) {
      await new Promise((resolve) => setTimeout(resolve, 400))
      ;({ data: { user }, error: authError } = await supabase.auth.getUser())
    }

    if (authError || !user) return { sessionUser: null, profile: null }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, role, created_at, apelido, avatar_url')
      .eq('id', user.id)
      .single()

    return {
      sessionUser: user,
      profile: (!error && data) ? (data as AppUser) : null,
    }
  } catch {
    return { sessionUser: null, profile: null }
  }
})

export async function getAuthUser(): Promise<AppUser | null> {
  const { profile } = await getAuthContext()
  return profile
}

export async function getAuthSession(): Promise<User | null> {
  const { sessionUser } = await getAuthContext()
  return sessionUser
}
