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

      // Tom: dois pulsos rápidos (ping-ping industrial)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(1046, ctx.currentTime)          // C6
      osc.frequency.setValueAtTime(1318, ctx.currentTime + 0.12)   // E6

      gain.gain.setValueAtTime(0, ctx.currentTime)
      gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)

      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.35)

      osc.onended = () => ctx.close()
    } catch {
      // Silencia erros de autoplay policy
    }
  }, [])
}
