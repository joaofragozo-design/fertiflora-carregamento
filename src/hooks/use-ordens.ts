'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { REALTIME_CHANNEL } from '@/constants/order'
import type { Carregamento } from '@/types'

const POLL_INTERVAL_MS = 15_000

export function useOrdens(
  initialOrdens: Carregamento[],
  fetchAll = false,
  onInsert?:  (item: Carregamento) => void,
  onDelete?:  (insumo: string) => void,
  onLiberar?: (item: Carregamento) => void,
) {
  const [ordens, setOrdens] = useState<Carregamento[]>(initialOrdens)
  const wasConnected  = useRef(false)
  const onInsertRef   = useRef(onInsert);  onInsertRef.current  = onInsert
  const onDeleteRef   = useRef(onDelete);  onDeleteRef.current  = onDelete
  const onLiberarRef  = useRef(onLiberar); onLiberarRef.current = onLiberar

  const supabase = useRef(createClient()).current

  const fetchOrdens = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('carregamentos')
      .select('*')
      .order('created_at', { ascending: false })

    if (!fetchAll) {
      // operador_pa: apenas itens ativos do novo fluxo
      query = query.in('status', ['SOLICITADO', 'LIBERADO'])
    }

    const { data } = await query
    if (!data) return
    setOrdens(data as Carregamento[])
  }, [supabase, fetchAll])

  useEffect(() => {
    const channel = supabase
      .channel(REALTIME_CHANNEL)
      // INSERT
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'carregamentos' },
        (payload) => {
          const novo = payload.new as Carregamento
          setOrdens((prev) =>
            prev.some((o) => o.id === novo.id) ? prev : [novo, ...prev]
          )
          onInsertRef.current?.(novo)
        }
      )
      // UPDATE
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'carregamentos' },
        (payload) => {
          const updated = payload.new as Carregamento

          if (updated.status === 'CANCELADO') {
            onDeleteRef.current?.(updated.insumo)
            setOrdens((prev) => prev.filter((o) => o.id !== updated.id))
            return
          }

          if (updated.status === 'LIBERADO') {
            onLiberarRef.current?.(updated)
          }

          // Para operador_pa: remove da lista quando CONCLUIDO
          if (!fetchAll && (updated.status === 'CONCLUIDO' || updated.status === 'CANCELADO')) {
            setOrdens((prev) => prev.filter((o) => o.id !== updated.id))
            return
          }

          setOrdens((prev) =>
            prev.map((o) => (o.id === updated.id ? updated : o))
          )
        }
      )
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          if (wasConnected.current) await fetchOrdens()
          wasConnected.current = true
        }
      })

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchOrdens()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    const pollTimer = setInterval(fetchOrdens, POLL_INTERVAL_MS)

    return () => {
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      clearInterval(pollTimer)
    }
  }, [supabase, fetchAll, fetchOrdens])

  return { ordens, setOrdens }
}
