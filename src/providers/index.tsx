'use client'

import type { ReactNode } from 'react'
import { Toaster } from 'sonner'
import { AuthProvider } from './auth-provider'
import { RealtimeProvider } from './realtime-provider'
import type { AppUser } from '@/types'

interface ProvidersProps {
  children: ReactNode
  initialUser?: AppUser | null
}

export function Providers({ children, initialUser }: ProvidersProps) {
  return (
    <AuthProvider initialUser={initialUser}>
      <RealtimeProvider>
        {children}
        <Toaster
          position="top-right"
          theme="dark"
          richColors
          closeButton
          duration={4500}
          toastOptions={{
            // Mesma superfície/borda dos cards do app; richColors continua
            // colorindo sucesso/erro por cima.
            style: {
              background: '#191E11',
              border: '1px solid rgba(244,247,236,0.12)',
              color: '#F4F7EC',
              borderRadius: '12px',
              boxShadow: '0 16px 40px -16px rgba(0,0,0,0.85)',
            },
          }}
        />
      </RealtimeProvider>
    </AuthProvider>
  )
}
