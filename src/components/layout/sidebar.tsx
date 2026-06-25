'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ClipboardList, Truck, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AppUser } from '@/types'

interface NavItem {
  href:  string
  label: string
  icon:  React.ElementType
  roles: AppUser['role'][]
}

const NAV_ITEMS: NavItem[] = [
  {
    href:  '/',
    label: 'Centro de Comando',
    icon:  LayoutDashboard,
    roles: ['admin'],
  },
  {
    href:  '/carregamento',
    label: 'Central de Solicitações',
    icon:  ClipboardList,
    roles: ['operador_carregamento', 'admin'],
  },
  {
    href:  '/pa',
    label: 'Centro Operacional',
    icon:  Truck,
    roles: ['operador_pa', 'admin'],
  },
]

interface SidebarProps {
  user:     AppUser | null
  isOpen?:  boolean
  onClose?: () => void
}

export function Sidebar({ user, isOpen = true, onClose }: SidebarProps) {
  const pathname     = usePathname()
  const visibleItems = NAV_ITEMS.filter(
    (item) => !user?.role || item.roles.includes(user.role)
  )

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-black/70 md:hidden" onClick={onClose} />
      )}

      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 flex w-56 flex-col border-r border-industrial-800 bg-industrial-950 transition-transform duration-200',
        'md:static md:translate-x-0',
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}>

        {/* Fechar mobile */}
        <div className="flex h-14 items-center justify-between border-b border-industrial-800 px-4 md:hidden">
          <span className="text-xs font-semibold uppercase tracking-widest text-industrial-400">Menu</span>
          <button onClick={onClose} className="rounded-md p-1.5 text-industrial-500 hover:bg-industrial-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 p-2 pt-3">
          {visibleItems.map((item) => {
            const Icon     = item.icon
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-brand-600/10 text-brand-700 border-2 border-brand-600/40 font-bold'
                    : 'text-industrial-400 border-2 border-transparent hover:bg-industrial-900 hover:text-industrial-100'
                )}
              >
                <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-brand-600' : 'text-industrial-600')} />
                <span className="leading-tight">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-industrial-800 px-3 py-3">
          <p className="text-[10px] font-medium uppercase tracking-widest text-industrial-500">
            Sistema de Carregamento
          </p>
        </div>
      </aside>
    </>
  )
}
