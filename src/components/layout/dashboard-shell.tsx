'use client'

import { useState } from 'react'
import { Header } from './header'
import { Sidebar } from './sidebar'
import { useAuth } from '@/hooks/use-auth'
import { useRealtimeContext } from '@/providers/realtime-provider'
import type { AppUser } from '@/types'

interface DashboardShellProps {
  user: AppUser
  children: React.ReactNode
}

export function DashboardShell({ user, children }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user: authUser, signOut } = useAuth()
  const { connectionStatus } = useRealtimeContext()
  // Prefer live auth context (from profiles table) over SSR prop
  const displayUser = authUser ?? user

  // Logística usa navegação no cabeçalho (sem sidebar) e largura total da tela.
  const semSidebar = user.role === 'logistica' || user.role === 'logistica_02'

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        user={displayUser}
        connectionStatus={connectionStatus}
        onSignOut={signOut}
        onMenuToggle={semSidebar ? undefined : () => setSidebarOpen((prev) => !prev)}
      />
      <div className="flex flex-1 overflow-hidden">
        {!semSidebar && (
          <Sidebar
            user={user}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
        )}
        <main className="flex-1 overflow-y-auto">
          <div className={semSidebar ? 'w-full px-3 py-4 md:px-5' : 'app-container py-6'}>
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
