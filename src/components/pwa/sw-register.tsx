'use client'

import { useEffect } from 'react'

export function SwRegister() {
  useEffect(() => {
    // Desregistra qualquer SW anterior que possa estar interferindo
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister())
      })
    }
  }, [])
  return null
}
