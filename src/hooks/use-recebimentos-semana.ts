'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RecebimentosService, type RecebimentoPrevisto } from '@/services/recebimentos.service'

const POLL_INTERVAL_MS = 20_000

/**
 * Estado do recebimento da semana com sincronização em tempo real — mesmo
 * padrão de use-programacao-semana.ts (canal + polling de reserva + refetch
 * ao voltar pra aba), necessário aqui porque Faturamento e Richardson
 * (logistica_02) costumam ter a tela aberta ao mesmo tempo que a Logística.
 */
export function useRecebimentosSemana(initial: RecebimentoPrevisto[], inicio: string, fim: string) {
  const [recebimentos, setRecebimentos] = useState<RecebimentoPrevisto[]>(initial)
  const supabase = useRef(createClient()).current
  const svc = useRef(new RecebimentosService(createClient())).current

  const refetch = useCallback(async () => {
    try {
      const fresh = await svc.getByRange(inicio, fim)
      setRecebimentos(fresh)
    } catch {
      /* silencioso: realtime e polling continuam tentando */
    }
  }, [svc, inicio, fim])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const agendarRefetch = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { refetch() }, 250)
    }

    const channel = supabase
      .channel(`recebimentos_changes_${inicio}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recebimentos_previstos' }, agendarRefetch)
      .subscribe()

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refetch()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    const pollTimer = setInterval(refetch, POLL_INTERVAL_MS)

    return () => {
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      clearInterval(pollTimer)
      if (timer) clearTimeout(timer)
    }
  }, [supabase, inicio, fim, refetch])

  return { recebimentos, setRecebimentos }
}
