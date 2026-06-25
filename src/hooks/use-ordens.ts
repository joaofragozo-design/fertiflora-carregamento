'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { REALTIME_CHANNEL } from '@/constants/order'
import type { Carregamento } from '@/types'

// Polling de segurança: garante atualização mesmo se o WebSocket falhar silenciosamente.
// Reduz para 15 s para uso em tablet (conexão pode ser instável).
const POLL_INTERVAL_MS = 15_000

export function useOrdens(
  initialOrdens: Carregamento[],
  fetchAll = false,
  onInsert?: (item: Carregamento) => void,
) {
  const [ordens, setOrdens] = useState<Carregamento[]>(initialOrdens)
  const wasConnected  = useRef(false)
  const onInsertRef   = useRef(onInsert)
  onInsertRef.current = onInsert

  // Cliente Supabase estável — criado uma vez por montagem do hook
  const supabase = useRef(createClient()).current

  // ── Função de rebusca ────────────────────────────────────────────
  const fetchOrdens = useCallback(async () => {
    let query = supabase
      .from('carregamentos')
      .select('*')
      .order('created_at', { ascending: false })

    if (!fetchAll) {
      // operador_pa só precisa de ordens ativas
      query = query.neq('status', 'CONCLUIDO') as typeof query
    }

    const { data } = await query
    if (!data) return

    setOrdens((prev) => {
      const fresh    = data as Carregamento[]
      const freshIds = new Set(fresh.map((o) => o.id))

      if (fetchAll) return fresh

      // Mantém CONCLUIDO já presente no estado local (não traz todos os históricos)
      const concluidos = prev.filter(
        (o) => o.status === 'CONCLUIDO' && !freshIds.has(o.id)
      )
      return [...fresh, ...concluidos]
    })
  }, [supabase, fetchAll])

  useEffect(() => {
    // ── Canal Realtime ───────────────────────────────────────────
    const channel = supabase
      .channel(REALTIME_CHANNEL)
      // INSERT
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'carregamentos' },
        (payload) => {
          const novo = payload.new as Carregamento
          setOrdens((prev) =>
            prev.some((o) => o.id === novo.id)
              ? prev.map((o) => (o.id === novo.id ? novo : o))
              : [novo, ...prev]
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
          setOrdens((prev) =>
            prev.map((o) => (o.id === updated.id ? updated : o))
          )
        }
      )
      // Reconexão WebSocket — rebusca para recuperar eventos perdidos
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          if (wasConnected.current) await fetchOrdens()
          wasConnected.current = true
        }
      })

    // ── Page Visibility API ──────────────────────────────────────
    // Quando o tablet acorda ou o usuário volta à aba, sincroniza imediatamente.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchOrdens()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    // ── Polling de segurança ─────────────────────────────────────
    // Garante atualização mesmo se o WebSocket cair sem disparar reconexão.
    const pollTimer = setInterval(fetchOrdens, POLL_INTERVAL_MS)

    return () => {
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      clearInterval(pollTimer)
    }
  }, [supabase, fetchAll, fetchOrdens])

  return { ordens, setOrdens }
}
