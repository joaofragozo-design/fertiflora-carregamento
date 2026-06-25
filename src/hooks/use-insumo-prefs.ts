'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface InsumoPrefs {
  pinned: string[]
  hidden: string[]
  custom: string[]
}

const DEFAULT_PREFS: InsumoPrefs = { pinned: [], hidden: [], custom: [] }

function parsePrefs(raw: unknown): InsumoPrefs {
  if (!raw || typeof raw !== 'object') return DEFAULT_PREFS
  const p = raw as Record<string, unknown>
  return {
    pinned: Array.isArray(p.pinned) ? (p.pinned as string[]) : [],
    hidden: Array.isArray(p.hidden) ? (p.hidden as string[]) : [],
    custom: Array.isArray(p.custom) ? (p.custom as string[]) : [],
  }
}

export function useInsumoPrefs(userId: string) {
  const [prefs, setPrefs] = useState<InsumoPrefs>(DEFAULT_PREFS)
  const saveTimer         = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Carrega prefs do banco na montagem
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('profiles')
      .select('insumo_prefs')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (data?.insumo_prefs) setPrefs(parsePrefs(data.insumo_prefs))
      })
  }, [userId])

  // Persiste no banco com debounce de 600 ms
  const persist = useCallback((next: InsumoPrefs) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const supabase = createClient()
      await supabase
        .from('profiles')
        .update({ insumo_prefs: next })
        .eq('id', userId)
    }, 600)
  }, [userId])

  const update = useCallback((fn: (prev: InsumoPrefs) => InsumoPrefs) => {
    setPrefs((prev) => {
      const next = fn(prev)
      persist(next)
      return next
    })
  }, [persist])

  const pin = useCallback((name: string) => {
    update((p) => ({
      ...p,
      pinned: p.pinned.includes(name) ? p.pinned : [...p.pinned, name],
      hidden: p.hidden.filter((h) => h !== name),
    }))
  }, [update])

  const unpin = useCallback((name: string) => {
    update((p) => ({ ...p, pinned: p.pinned.filter((h) => h !== name) }))
  }, [update])

  const hide = useCallback((name: string) => {
    update((p) => ({
      ...p,
      hidden: p.hidden.includes(name) ? p.hidden : [...p.hidden, name],
      pinned: p.pinned.filter((h) => h !== name),
    }))
  }, [update])

  const restore = useCallback((name: string) => {
    update((p) => ({
      ...p,
      hidden: p.hidden.filter((h) => h !== name),
      pinned: p.pinned.filter((h) => h !== name),
    }))
  }, [update])

  // Adiciona insumo customizado; se pin=true também o fixa no topo
  const addCustom = useCallback((name: string, shouldPin: boolean) => {
    update((p) => ({
      ...p,
      custom: p.custom.includes(name) ? p.custom : [...p.custom, name],
      pinned: shouldPin
        ? p.pinned.includes(name) ? p.pinned : [...p.pinned, name]
        : p.pinned,
    }))
  }, [update])

  const resetAll = useCallback(() => {
    update(() => DEFAULT_PREFS)
  }, [update])

  return { prefs, pin, unpin, hide, restore, addCustom, resetAll }
}
