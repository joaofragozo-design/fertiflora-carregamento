import type { AuthError } from '@supabase/supabase-js'
import type { AppUser } from '@/types'
import type { LoginInput } from '@/lib/validations'
import { usernameToEmail, emailToUsername } from '@/lib/validations/auth'
import type { createClient } from '@/lib/supabase/client'

type DB = ReturnType<typeof createClient>

function translateAuthError(error: AuthError): string {
  const msg    = error.message ?? ''
  const code   = (error as { code?: string }).code ?? ''
  const status = error.status ?? 0

  if (code === 'invalid_credentials' || msg.includes('Invalid login credentials') || msg.includes('invalid_grant'))
    return 'Usuário ou senha incorretos.'

  if (code === 'email_not_confirmed' || msg.includes('Email not confirmed'))
    return 'Conta não confirmada. Contate o administrador.'

  if (code === 'over_request_rate_limit' || msg.includes('rate limit') || status === 429)
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'

  if (code === 'user_not_found' || msg.includes('User not found'))
    return 'Usuário não cadastrado. Contate o administrador.'

  if (status === 0 || msg.includes('fetch') || msg.includes('network'))
    return 'Não foi possível conectar ao servidor. Verifique sua conexão.'

  return `Erro de autenticação: ${msg} (código ${code || status})`
}

export class AuthService {
  constructor(private supabase: DB) {}

  async signIn({ username, password }: LoginInput): Promise<AppUser> {
    const email = usernameToEmail(username)

    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password })

    if (error) {
      console.error('[AuthService.signIn] Erro Auth:', error)
      throw new Error(translateAuthError(error))
    }

    if (!data.user) throw new Error('Resposta inesperada do servidor. Tente novamente.')

    // Retorna dados mínimos da sessão. Role vem do banco via AuthProvider (SIGNED_IN).
    // Não usar metadata para role — profile é a fonte única de verdade.
    return {
      id:         data.user.id,
      username,
      role:       'operador_carregamento', // placeholder; AuthProvider sobrescreve com profile real
      created_at: data.user.created_at,
    }
  }

  async signOut(): Promise<void> {
    const { error } = await this.supabase.auth.signOut()
    if (error) throw new Error(`Erro ao sair: ${error.message}`)
  }

  async getProfile(userId: string): Promise<AppUser | null> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      if ((error as { code?: string }).code !== 'PGRST116') {
        console.error('[AuthService.getProfile] Erro:', error)
      }
      return null
    }

    return data as AppUser
  }

  async getOrCreateProfile(userId: string, username: string): Promise<AppUser> {
    // Upsert garante que o profile sempre existe — nunca bloqueia o login
    const { data, error } = await this.supabase
      .from('profiles')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert({ id: userId, username } as any, { onConflict: 'id' })
      .select()
      .single()

    if (!error && data) return data as AppUser

    console.error('[AuthService.getOrCreateProfile] Upsert falhou:', error)

    // Fallback sintético — nunca bloqueia o login
    return {
      id:         userId,
      username,
      role:       'operador_carregamento',
      created_at: new Date().toISOString(),
    }
  }

  async getCurrentUser(): Promise<AppUser | null> {
    const { data: { user }, error } = await this.supabase.auth.getUser()
    if (error || !user) return null
    const username = emailToUsername(user.email ?? '')
    return this.getOrCreateProfile(user.id, username)
  }
}

export { emailToUsername }
