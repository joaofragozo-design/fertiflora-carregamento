import { LayoutDashboard, ClipboardList, Truck, CalendarDays, CalendarRange, FileSpreadsheet, Container, Package, Tv, Inbox } from 'lucide-react'
import type { AppUser } from '@/types'

export interface NavItem {
  href:  string
  label: string
  icon:  React.ElementType
  roles: AppUser['role'][]
}

/** Fonte única da navegação — usada pela Sidebar e pelo Command Palette. */
export const NAV_ITEMS: NavItem[] = [
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
