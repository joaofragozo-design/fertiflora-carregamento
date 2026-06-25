'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'

export interface InsumoPrefs {
  pinned: string[]
  hidden: string[]
  custom: string[]
}

const DEFAULT_PREFS: InsumoPrefs = {
  pinned: [],
  hidden: [],
  custom: [],
}

function parsePrefs(raw: unknown): InsumoPrefs {
  if (!raw || typeof raw !== 'object') return DEFAULT_PREFS

  const p = raw as Record<string, unknown>

  return {
    pinned: Array.isArray(p.pinned) ? (p.pinned as string[]) : [],
    hidden: Array.isArray(p.hidden) ? (p.hidden as string[]) : [],
    custom: Array.isArray(p.custom) ? (p.custom as string[]) : [],
  }
}

type ProfileRow = Database['public']['Tables']['profiles']['Row']

export function useInsumoPrefs(userId: string) {
  const [prefs, setPrefs] = useState<InsumoPrefs>(DEFAULT_PREFS)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!userId) return

    const supabase = createClient()

    const load = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('insumo_prefs')
        .eq('id', userId)
        .single()

      if (error || !data) return

      const row = data as Pick<ProfileRow, 'insumo_prefs'>

      if (row.insumo_prefs) {
        setPrefs(parsePrefs(row.insumo_prefs))
      }
    }

    load()
  }, [userId])

  const persist = useCallback(
    (next: InsumoPrefs) => {
      if (saveTimer.current) clearTimeout(saveTimer.current)

      saveTimer.current = setTimeout(async () => {
        const supabase = createClient()

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('profiles')
          .update({ insumo_prefs: next })
          .eq('id', userId)
      }, 600)
    },
    [userId]
  )

  const update = useCallback(
    (fn: (prev: InsumoPrefs) => InsumoPrefs) => {
      setPrefs((prev) => {
        const next = fn(prev)
        persist(next)
        return next
      })
    },
    [persist]
  )

  const pin = useCallback(
    (name: string) => {
      update((p) => ({
        ...p,
        pinned: p.pinned.includes(name) ? p.pinned : [...p.pinned, name],
        hidden: p.hidden.filter((h) => h !== name),
      }))
    },
    [update]
  )

  const unpin = useCallback(
    (name: string) => {
      update((p) => ({
        ...p,
        pinned: p.pinned.filter((h) => h !== name),
      }))
    },
    [update]
  )

  const hide = useCallback(
    (name: string) => {
      update((p) => ({
        ...p,
        hidden: p.hidden.includes(name) ? p.hidden : [...p.hidden, name],
        pinned: p.pinned.filter((h) => h !== name),
      }))
    },
    [update]
  )

  const restore = useCallback(
    (name: string) => {
      update((p) => ({
        ...p,
        hidden: p.hidden.filter((h) => h !== name),
        pinned: p.pinned.filter((h) => h !== name),
      }))
    },
    [update]
  )

  const addCustom = useCallback(
    (name: string, shouldPin: boolean) => {
      update((p) => ({
        ...p,
        custom: p.custom.includes(name)
          ? p.custom
          : [...p.custom, name],
        pinned: shouldPin
          ? p.pinned.includes(name)
            ? p.pinned
            : [...p.pinned, name]
          : p.pinned,
      }))
    },
    [update]
  )

  const resetAll = useCallback(() => {
    update(() => DEFAULT_PREFS)
  }, [update])

  return { prefs, pin, unpin, hide, restore, addCustom, resetAll }
}