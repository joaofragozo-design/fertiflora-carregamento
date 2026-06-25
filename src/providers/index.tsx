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
          toastOptions={{
            style: {
              background: '#1a1a1a',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#f5f5f5',
            },
          }}
        />
      </RealtimeProvider>
    </AuthProvider>
  )
}
