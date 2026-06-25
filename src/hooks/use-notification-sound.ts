'use client'

import { useCallback } from 'react'

/**
 * Gera um ping industrial curto via Web Audio API.
 * Sem arquivos de áudio externos — sintetizado no cliente.
 */
export function useNotificationSound() {
  return useCallback(() => {
    try {
      const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AudioCtx) return

      const ctx  = new AudioCtx()
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.connect(gain)
      gain.connect(ctx.destination)

      // Três bipes curtos e fortes (beep-beep-beep de alerta)
      function bipe(startTime: number) {
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.connect(g)
        g.connect(ctx.destination)
        o.type = 'square'
        o.frequency.setValueAtTime(880, startTime)
        g.gain.setValueAtTime(0, startTime)
        g.gain.linearRampToValueAtTime(1.0, startTime + 0.01)
        g.gain.setValueAtTime(1.0, startTime + 0.10)
        g.gain.linearRampToValueAtTime(0, startTime + 0.14)
        o.start(startTime)
        o.stop(startTime + 0.14)
      }

      bipe(ctx.currentTime)
      bipe(ctx.currentTime + 0.22)
      bipe(ctx.currentTime + 0.44)

      setTimeout(() => ctx.close(), 800)
    } catch {
      // Silencia erros de autoplay policy
    }
  }, [])
}
