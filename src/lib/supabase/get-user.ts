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

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) return { sessionUser: null, profile: null }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, role, created_at')
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
