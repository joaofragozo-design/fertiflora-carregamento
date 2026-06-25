'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AuthService } from '@/services/auth.service'
import type { AppUser } from '@/types'
import { ROUTES } from '@/constants/routes'

interface AuthContextValue {
  user: AppUser | null
  isLoading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuthContext() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider')
  return ctx
}

interface AuthProviderProps {
  children: ReactNode
  // Hidratação SSR: perfil buscado no servidor passado como prop.
  // undefined  = SSR não verificou (raro — root layout sempre busca)
  // null       = SSR confirmou sem usuário autenticado
  // AppUser    = SSR confirmou usuário com profile
  initialUser?: AppUser | null
}

export function AuthProvider({ children, initialUser = null }: AuthProviderProps) {
  const router = useRouter()
  const [user, setUser]       = useState<AppUser | null>(initialUser ?? null)
  // isLoading: true apenas enquanto não sabemos o estado de autenticação.
  // Se o SSR forneceu initialUser (mesmo null), o estado já é conhecido → false.
  // Só inicia true se initialUser não foi fornecido (undefined) → cliente precisa checar.
  const [isLoading, setIsLoading] = useState<boolean>(initialUser === undefined)

  const fetchProfile = useCallback(
    async (userId: string): Promise<AppUser | null> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error || !data) return null
      return data as AppUser
    },
    []
  )

  useEffect(() => {
    const supabase = createClient()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // INITIAL_SESSION: dispara uma vez na montagem com a sessão atual.
        if (event === 'INITIAL_SESSION') {
          if (initialUser != null) {
            // SSR hidratou um AppUser válido — sincroniza state com o prop atual
            // (pode ter mudado após router.refresh() ao trocar de usuário).
            setUser(initialUser)
            setIsLoading(false)
            return
          }
          // Sem initialUser: libera loading imediatamente, profile carrega em background.
          setIsLoading(false)
          if (session?.user) {
            fetchProfile(session.user.id).then((profile) => {
              if (profile) setUser(profile)
            })
          } else {
            setUser(null)
          }
          return
        }

        // SIGNED_IN: novo login — limpa estado anterior, libera loading, profile em background.
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(null)   // garante que dado do usuário anterior não vaza
          setIsLoading(false)
          fetchProfile(session.user.id).then((profile) => {
            if (profile) setUser(profile)
          })
          return
        }

        // SIGNED_OUT: logout local ou expiração de sessão.
        if (event === 'SIGNED_OUT') {
          setUser(null)
          setIsLoading(false)
          router.push(ROUTES.LOGIN)
          return
        }

        // TOKEN_REFRESHED / outros: garante que loading nunca fica preso.
        setIsLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
    // initialUser intencional: queremos re-avaliar se o prop mudar entre renders.
    // fetchProfile e router são estáveis (useCallback / Next.js).
  }, [initialUser, fetchProfile, router])

  const signOut = useCallback(async () => {
    const supabase = createClient()
    const service = new AuthService(supabase)
    await service.signOut()
    // onAuthStateChange SIGNED_OUT cuida do setUser(null) e redirect
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
