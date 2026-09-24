'use client'

import { useSyncExternalStore } from 'react'

/**
 * `window.matchMedia` reativo. No servidor (e durante a hidratação) devolve
 * `fallback`; no cliente acompanha mudanças de viewport/preferência.
 */
export function useMediaQuery(query: string, fallback = false): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => fallback,
  )
}
