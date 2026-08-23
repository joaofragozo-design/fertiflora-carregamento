'use client'

import { Wifi, WifiOff, LogOut, Menu, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LogoFull } from '@/components/brand/logo'
import { InstallButton } from '@/components/pwa/install-button'
import { ROLE_LABELS } from '@/constants/roles'
import type { AppUser, ConnectionStatus } from '@/types'

interface HeaderProps {
  user: AppUser | null
  connectionStatus: ConnectionStatus
  onSignOut?: () => void
  onMenuToggle?: () => void
  onOpenSearch?: () => void
}

export function Header({ user, connectionStatus, onSignOut, onMenuToggle, onOpenSearch }: HeaderProps) {
  const isConnected = connectionStatus === 'connected'

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between border-b border-industrial-200 bg-industrial-50 px-4 md:px-6 print:hidden">

      <div className="flex items-center gap-3">
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="rounded-md p-1.5 text-industrial-600 hover:bg-industrial-200 hover:text-industrial-900"
            aria-label="Mostrar ou ocultar menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        {/* No desktop a marca vive na sidebar (padrão STO); aqui só no mobile */}
        <div className="md:hidden">
          <LogoFull showTagline={false} />
        </div>

        {onOpenSearch && (
          <button
            type="button"
            onClick={onOpenSearch}
            className="ml-2 hidden items-center gap-2 rounded-lg border border-industrial-300 bg-industrial-100 px-3 py-1.5 text-xs text-industrial-500 hover:border-industrial-400 hover:text-industrial-700 transition-colors sm:flex"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Buscar…</span>
            <kbd className="ml-2 rounded border border-industrial-300 bg-industrial-50 px-1.5 py-0.5 font-mono text-[10px] text-industrial-500">
              ⌘K
            </kbd>
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">

        {/* Status Realtime */}
        <div className={cn(
          'flex items-center gap-1.5 rounded-full border-2 px-2.5 py-1 text-xs font-bold',
          isConnected
            ? 'border-brand-600 text-brand-600'
            : 'border-industrial-300 text-industrial-500'
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
          <div className="hidden items-center gap-2.5 border-l border-industrial-200 pl-3 md:flex">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white uppercase">
              {user.username.charAt(0)}
            </div>
            <div className="text-right leading-none">
              <p className="text-sm font-semibold text-industrial-900">{user.username}</p>
              <p className="text-[11px] text-industrial-500">{ROLE_LABELS[user.role] ?? user.role}</p>
            </div>
          </div>
        )}

        <InstallButton />

        {onSignOut && (
          <button
            onClick={onSignOut}
            title="Sair do sistema"
            className="ml-1 rounded-md p-1.5 text-industrial-500 hover:bg-industrial-200 hover:text-danger-400 transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
    </header>
  )
}
