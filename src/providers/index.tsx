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
              background: '#1C2213',
              border: '1px solid rgba(244,247,236,0.1)',
              color: '#F4F7EC',
            },
          }}
        />
      </RealtimeProvider>
    </AuthProvider>
  )
}
