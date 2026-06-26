'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { OrdensDiariasService } from '@/services/ordens-diarias.service'
import type { OrdemDiaria } from '@/types/formula'

const POLL_INTERVAL_MS = 15_000
const CHANNEL = 'ordens_diarias_changes'

export type EditableOrdem = OrdemDiaria & { _dirty?: boolean; _saving?: boolean }

/**
 * Estado das ordens do dia com sincronização em tempo real.
 *
 * Espelha o padrão de `useOrdens` (carregamentos): assina postgres_changes e
 * combina com defesa-em-profundidade (refetch no reconnect, ao focar a aba e
 * polling). Diferenças importantes para ordens_diarias:
 *  - o payload do realtime NÃO traz o join `formula` → reidratamos via getByDate
 *    (refetch debounced) sempre que chega um evento;
 *  - linhas em edição local (_dirty/_saving) nunca são sobrescritas pelo realtime;
 *  - ordenação por `sequencia`.
 */
export function useOrdensDiarias(initialOrdens: OrdemDiaria[], data: string) {
  const [ordens, setOrdens] = useState<EditableOrdem[]>(initialOrdens)
  const wasConnected = useRef(false)
  const supabase = useRef(createClient()).current
  const svc = useRef(new OrdensDiariasService(createClient())).current

  const fetchOrdens = useCallback(async () => {
    try {
      const fresh = await svc.getByDate(data)
      setOrdens((prev) => {
        // Preserva linhas em edição local — não sobrescreve o que o usuário digita.
        const emEdicao = new Map(
          prev.filter((o) => o._dirty || o._saving).map((o) => [o.id, o]),
        )
        return fresh.map((f) => emEdicao.get(f.id) ?? f)
      })
    } catch {
      /* silencioso: realtime e polling continuam tentando */
    }
  }, [svc, data])

  useEffect(() => {
    let refetchTimer: ReturnType<typeof setTimeout> | null = null
    const agendarRefetch = () => {
      if (refetchTimer) clearTimeout(refetchTimer)
      // Debounce: reidrata o join `formula` (ausente no payload do realtime).
      refetchTimer = setTimeout(() => { fetchOrdens() }, 250)
    }

    const channel = supabase
      .channel(CHANNEL)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ordens_diarias', filter: `data=eq.${data}` },
        (payload) => {
          const novo = payload.new as OrdemDiaria
          setOrdens((prev) =>
            prev.some((o) => o.id === novo.id)
              ? prev
              : [...prev, novo].sort((a, b) => a.sequencia - b.sequencia),
          )
          agendarRefetch()
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ordens_diarias', filter: `data=eq.${data}` },
        (payload) => {
          const updated = payload.new as OrdemDiaria
          setOrdens((prev) =>
            prev.map((o) => {
              if (o.id !== updated.id) return o
              if (o._dirty || o._saving) return o            // edição em curso: não toca
              return { ...o, ...updated, formula: o.formula } // preserva o join
            }),
          )
          agendarRefetch()
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'ordens_diarias' },
        (payload) => {
          const old = payload.old as { id?: string }
          if (old?.id) setOrdens((prev) => prev.filter((o) => o.id !== old.id))
        },
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
      if (refetchTimer) clearTimeout(refetchTimer)
    }
  }, [supabase, data, fetchOrdens])

  return { ordens, setOrdens }
}
