import { createServerClient, type CookieMethodsServer } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'
import { getSupabaseUrl, getSupabaseAnonKey } from './config'

export async function createClient() {
  const cookieStore = await cookies()

  const cookieMethods: CookieMethodsServer = {
    getAll() {
      return cookieStore.getAll()
    },
    setAll(cookiesToSet) {
      try {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        )
      } catch {
        // setAll called from a Server Component — cookies set by middleware persist
      }
    },
  }

  return createServerClient<Database>(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
    { cookies: cookieMethods }
  )
}
