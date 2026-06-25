'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { createClient } from '@/lib/supabase/client'
import { REALTIME_CHANNEL } from '@/constants/order'
import type { ConnectionStatus } from '@/types'

interface RealtimeContextValue {
  connectionStatus: ConnectionStatus
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null)

export function useRealtimeContext() {
  const ctx = useContext(RealtimeContext)
  if (!ctx) throw new Error('useRealtimeContext must be inside RealtimeProvider')
  return ctx
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting')

  useEffect(() => {
    const supabase = createClient()

    // Canal leve: apenas para rastrear se o WebSocket está ativo.
    // Os dados ficam em useOrdens (canal separado, mesma conexão WS).
    const channel = supabase
      .channel(`${REALTIME_CHANNEL}_status`)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED')    setConnectionStatus('connected')
        if (status === 'TIMED_OUT')     setConnectionStatus('disconnected')
        if (status === 'CLOSED')        setConnectionStatus('disconnected')
        if (status === 'CHANNEL_ERROR') setConnectionStatus('error')
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return (
    <RealtimeContext.Provider value={{ connectionStatus }}>
      {children}
    </RealtimeContext.Provider>
  )
}
