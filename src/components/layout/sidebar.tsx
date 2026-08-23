'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { X, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV_ITEMS } from '@/constants/nav-items'
import { LogoMark } from '@/components/brand/logo'
import { ROLE_LABELS } from '@/constants/roles'
import type { AppUser } from '@/types'

interface SidebarProps {
  user:       AppUser | null
  isOpen?:    boolean
  collapsed?: boolean
  onClose?:   () => void
  onSignOut?: () => void
}

/** Sidebar no padrão do shell do Trilho STO: card flutuante arredondado com
 * gradiente spruce, marca no topo, navegação em pílulas e cartão de usuário. */
export function Sidebar({ user, isOpen = true, collapsed = false, onClose, onSignOut }: SidebarProps) {
  const pathname     = usePathname()
  const visibleItems = NAV_ITEMS.filter(
    (item) => !user?.role || item.roles.includes(user.role)
  )
  const inicial = (user?.username ?? '?').trim().charAt(0).toUpperCase()

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-black/70 md:hidden" onClick={onClose} />
      )}

      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 flex w-64 flex-col overflow-hidden bg-gradient-to-b from-spruce-700 via-spruce-800 to-spruce-900 transition-all duration-200 print:hidden',
        'md:static md:my-3 md:ml-3 md:rounded-3xl md:shadow-editorial',
        isOpen ? 'translate-x-0' : '-translate-x-full',
        collapsed ? 'md:w-0 md:ml-0 md:border-0' : 'md:w-64'
      )}>

        {/* Fechar mobile */}
        <div className="flex h-12 items-center justify-end px-4 md:hidden">
          <button onClick={onClose} className="rounded-md p-1.5 text-spruce-200/80 hover:bg-white/10" aria-label="Fechar menu">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Marca */}
        <div className="px-6 pb-5 md:pt-7">
          <div className="flex items-center gap-2.5">
            <LogoMark size={28} />
            <span className="font-display text-lg font-semibold tracking-tight text-white">FertiLog</span>
          </div>
          <p className="mt-1.5 text-xs text-spruce-200/80">Fertiflora · Carregamento</p>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
          {visibleItems.map((item) => {
            const Icon     = item.icon
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={
                  isActive
                    ? 'flex items-center gap-3 rounded-full bg-white/15 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200'
                    : 'flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium text-spruce-200/90 transition-colors duration-200 hover:bg-white/[0.07] hover:text-white'
                }
              >
                <Icon className={isActive ? 'h-[18px] w-[18px] shrink-0 text-brand-300' : 'h-[18px] w-[18px] shrink-0 text-spruce-200/70'} />
                <span className="leading-tight">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Usuário */}
        {user && (
          <div className="m-3 rounded-2xl bg-white/[0.07] p-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-300 font-display text-sm font-bold text-spruce-900">
                {inicial}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{user.username}</p>
                <p className="text-xs text-spruce-200/80">{ROLE_LABELS[user.role] ?? user.role}</p>
              </div>
            </div>
            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white transition-colors duration-200 hover:bg-white/20"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sair
              </button>
            )}
          </div>
        )}
      </aside>
    </>
  )
}
