'use client'

import { Wifi, WifiOff, LogOut, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LogoFull } from '@/components/brand/logo'
import { InstallButton } from '@/components/pwa/install-button'
import type { AppUser, ConnectionStatus } from '@/types'

interface HeaderProps {
  user: AppUser | null
  connectionStatus: ConnectionStatus
  onSignOut?: () => void
  onMenuToggle?: () => void
}

const ROLE_LABELS: Record<string, string> = {
  operador_carregamento: 'Carregamento',
  operador_pa:           'Operador',
  admin:                 'Admin',
  logistica:             'Logística',
  logistica_02:          'Logística 02',
}

export function Header({ user, connectionStatus, onSignOut, onMenuToggle }: HeaderProps) {
  const isConnected = connectionStatus === 'connected'

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-industrial-800 bg-industrial-950 px-4 md:px-6">

      <div className="flex items-center gap-3">
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="rounded-md p-1.5 text-industrial-400 hover:bg-industrial-800 hover:text-industrial-100 md:hidden"
            aria-label="Menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <LogoFull showTagline={false} />
      </div>

      <div className="flex items-center gap-2">

        {/* Status Realtime */}
        <div className={cn(
          'flex items-center gap-1.5 rounded-full border-2 px-2.5 py-1 text-xs font-bold',
          isConnected
            ? 'border-brand-600 text-brand-600'
            : 'border-industrial-700 text-industrial-500'
        )}>
          {isConnected
            ? <Wifi className="h-3 w-3" />
            : <WifiOff className="h-3 w-3" />
          }
          <span className="hidden sm:inline">
            {isConnected ? 'Online' : 'Offline'}
          </span>
        </div>

        {/* Usuário */}
        {user && (
          <div className="hidden items-center gap-2.5 border-l border-industrial-800 pl-3 md:flex">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white uppercase">
              {user.username.charAt(0)}
            </div>
            <div className="text-right leading-none">
              <p className="text-sm font-semibold text-industrial-100">{user.username}</p>
              <p className="text-[11px] text-industrial-500">{ROLE_LABELS[user.role] ?? user.role}</p>
            </div>
          </div>
        )}

        <InstallButton />

        {onSignOut && (
          <button
            onClick={onSignOut}
            title="Sair do sistema"
            className="ml-1 rounded-md p-1.5 text-industrial-500 hover:bg-industrial-800 hover:text-danger-400 transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
    </header>
  )
}
