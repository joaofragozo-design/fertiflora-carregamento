'use client'

import { useState } from 'react'
import { Header } from './header'
import { Sidebar } from './sidebar'
import { useAuth } from '@/hooks/use-auth'
import { useRealtimeContext } from '@/providers/realtime-provider'
import { ConfirmacaoChegadaListener } from '@/components/notifications/confirmacao-chegada-listener'
import type { AppUser } from '@/types'

interface DashboardShellProps {
  user: AppUser
  children: React.ReactNode
}

export function DashboardShell({ user, children }: DashboardShellProps) {
  // Overlay da sidebar em telas pequenas (some ao navegar/clicar fora)
  const [mobileOpen, setMobileOpen] = useState(false)
  // Recolher/expandir a sidebar em telas grandes (persiste até o usuário clicar de novo)
  const [collapsed, setCollapsed] = useState(false)
  const { user: authUser, signOut } = useAuth()
  const { connectionStatus } = useRealtimeContext()
  // Prefer live auth context (from profiles table) over SSR prop
  const displayUser = authUser ?? user

  function toggleSidebar() {
    setMobileOpen((prev) => !prev)
    setCollapsed((prev) => !prev)
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header
        user={displayUser}
        connectionStatus={connectionStatus}
        onSignOut={signOut}
        onMenuToggle={toggleSidebar}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          user={user}
          isOpen={mobileOpen}
          collapsed={collapsed}
          onClose={() => setMobileOpen(false)}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="app-container py-6">
            {children}
          </div>
        </main>
      </div>
      {user.role === 'logistica' && <ConfirmacaoChegadaListener />}
    </div>
  )
}
