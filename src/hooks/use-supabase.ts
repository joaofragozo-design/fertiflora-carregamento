'use client'

import { useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useSupabase() {
  // memo garante instância estável por render
  return useMemo(() => createClient(), [])
}
