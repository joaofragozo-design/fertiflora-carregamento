'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ProgramacaoService } from '@/services/programacao.service'
import type { Programacao } from '@/types/programacao'

const POLL_INTERVAL_MS = 20_000

/**
 * Estado da programação da semana com sincronização em tempo real.
 *
 * As edições aqui são todas feitas via modal (não digitação inline), então
 * não há risco de o refetch sobrescrever o que o usuário está digitando —
 * basta reidratar tudo sempre que algo mudar (itens, envio, confirmação).
 */
export function useProgramacaoSemana(initial: Programacao[], inicio: string, fim: string) {
  const [agendamentos, setAgendamentos] = useState<Programacao[]>(initial)
  const supabase = useRef(createClient()).current
  const svc = useRef(new ProgramacaoService(createClient())).current

  const refetch = useCallback(async () => {
    try {
      const fresh = await svc.getByRange(inicio, fim)
      setAgendamentos(fresh)
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
      .channel(`programacao_changes_${inicio}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'programacao_carregamento' }, agendarRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'programacao_itens' }, agendarRefetch)
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

  return { agendamentos, setAgendamentos }
}
