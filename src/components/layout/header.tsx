'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Wifi, WifiOff, LogOut, Menu, CalendarDays, CalendarRange, FileSpreadsheet, Tv } from 'lucide-react'
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
  faturamento:           'Faturamento',
}

// Navegação no cabeçalho (para perfis sem barra lateral). Demais perfis usam a Sidebar.
interface NavLink { href: string; label: string; icon: React.ElementType }
const HEADER_NAV: Record<string, NavLink[]> = {
  logistica: [
    { href: '/ordens',         label: 'Ordens do Dia', icon: CalendarDays },
    { href: '/ordens?vista=tv', label: 'Painel TV',    icon: Tv },
    { href: '/programacao',    label: 'Programação',   icon: CalendarRange },
    { href: '/admin/formulas', label: 'Fórmulas',      icon: FileSpreadsheet },
  ],
  logistica_02: [
    { href: '/ordens', label: 'Ordens do Dia', icon: CalendarDays },
  ],
  faturamento: [
    { href: '/ordens',          label: 'Ordens',      icon: CalendarDays },
    { href: '/ordens?vista=tv', label: 'Painel TV',   icon: Tv },
    { href: '/programacao',     label: 'Programação', icon: CalendarRange },
  ],
}

export function Header({ user, connectionStatus, onSignOut, onMenuToggle }: HeaderProps) {
  const isConnected = connectionStatus === 'connected'
  const pathname = usePathname()
  const nav = user ? (HEADER_NAV[user.role] ?? []) : []

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-industrial-800 bg-industrial-950 px-4 md:px-6 print:hidden">

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

        {/* Navegação inline (perfis de logística) */}
        {nav.length > 0 && (
          <nav className="ml-2 flex items-center gap-1 border-l border-industrial-800 pl-3">
            {nav.map((item) => {
              const Icon = item.icon
              const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-brand-600/15 text-brand-400 border border-brand-600/40'
                      : 'border border-transparent text-industrial-300 hover:bg-industrial-800 hover:text-industrial-100',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              )
            })}
          </nav>
        )}
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
