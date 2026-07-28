'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ClipboardList, Truck, X, CalendarDays, CalendarRange, FileSpreadsheet, Container, Package, Tv, Inbox } from 'lucide-react'
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
    href:  '/ordens',
    label: 'Ordens do Dia',
    icon:  CalendarDays,
    roles: ['admin', 'logistica', 'logistica_02', 'faturamento'],
  },
  {
    href:  '/ordens?vista=tv',
    label: 'Painel TV',
    icon:  Tv,
    roles: ['logistica', 'faturamento'],
  },
  {
    href:  '/programacao',
    label: 'Programação',
    icon:  CalendarRange,
    roles: ['admin', 'logistica', 'logistica_02', 'faturamento'],
  },
  {
    href:  '/recebimento',
    label: 'Programação de Recebimento',
    icon:  Package,
    roles: ['admin', 'logistica', 'logistica_02', 'faturamento'],
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
  {
    href:  '/admin/formulas',
    label: 'Fórmulas',
    icon:  FileSpreadsheet,
    roles: ['admin', 'logistica'],
  },
  {
    href:  '/solicitacoes',
    label: 'Solicitações',
    icon:  Inbox,
    roles: ['admin', 'logistica'],
  },
  {
    href:  '/transportadoras',
    label: 'Transportadoras',
    icon:  Container,
    roles: ['admin', 'logistica'],
  },
  {
    href:  '/transportadora',
    label: 'Meus Carregamentos',
    icon:  Truck,
    roles: ['transportadora'],
  },
]

interface SidebarProps {
  user:       AppUser | null
  isOpen?:    boolean
  collapsed?: boolean
  onClose?:   () => void
}

export function Sidebar({ user, isOpen = true, collapsed = false, onClose }: SidebarProps) {
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
        'fixed inset-y-0 left-0 z-50 flex w-56 flex-col overflow-hidden bg-gradient-to-b from-spruce-800 via-spruce-900 to-spruce-900 transition-all duration-200 print:hidden',
        'md:static md:translate-x-0',
        isOpen ? 'translate-x-0' : '-translate-x-full',
        collapsed ? 'md:w-0 md:border-0' : 'md:w-56'
      )}>

        {/* Fechar mobile */}
        <div className="flex h-14 items-center justify-between border-b border-white/10 px-4 md:hidden">
          <span className="text-xs font-semibold uppercase tracking-widest text-paper-300">Menu</span>
          <button onClick={onClose} className="rounded-md p-1.5 text-paper-300 hover:bg-white/10">
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
                    ? 'bg-white/10 text-paper-50 border-2 border-leaf-400/50 font-bold'
                    : 'text-paper-300 border-2 border-transparent hover:bg-white/5 hover:text-paper-50'
                )}
              >
                <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-leaf-400' : 'text-paper-400')} />
                <span className="leading-tight">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-white/10 px-3 py-3">
          <p className="text-[10px] font-medium uppercase tracking-widest text-paper-400">
            Sistema de Carregamento
          </p>
        </div>
      </aside>
    </>
  )
}
