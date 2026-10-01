import {
  LayoutDashboard, ClipboardList, Truck, CalendarDays, CalendarRange, FileSpreadsheet, Container, Package, Tv, Inbox,
  BookUser, Route, CalendarCheck, Settings, Forklift,
} from 'lucide-react'
import type { AppUser } from '@/types'

export interface NavItem {
  href:  string
  label: string
  icon:  React.ElementType
  roles: AppUser['role'][]
}

/** Grupo recolhível do menu lateral. Só aparece pro perfil que enxerga ao menos um item dele. */
export interface NavGroup {
  id:    string
  label: string
  icon:  React.ElementType
  items: NavItem[]
}

/** Entrada de primeiro nível: um item solto ou um grupo recolhível. */
export type NavEntry = { kind: 'item'; item: NavItem } | { kind: 'group'; group: NavGroup }

const ordensDoDia: NavItem = {
  href:  '/ordens',
  label: 'Ordens do Dia',
  icon:  CalendarDays,
  roles: ['admin', 'logistica', 'logistica_02', 'faturamento'],
}
const programacaoCarregamento: NavItem = {
  href:  '/programacao',
  label: 'Programação de Carregamento',
  icon:  CalendarRange,
  roles: ['admin', 'logistica', 'logistica_02', 'faturamento'],
}
const programacaoRecebimento: NavItem = {
  href:  '/recebimento',
  label: 'Programação de Recebimento',
  icon:  Package,
  roles: ['admin', 'logistica', 'logistica_02', 'faturamento'],
}
const painelTv: NavItem = {
  href:  '/ordens?vista=tv',
  label: 'Painel TV',
  icon:  Tv,
  roles: ['logistica', 'faturamento'],
}
const cadastroTransportadoras: NavItem = {
  href:  '/transportadoras',
  label: 'Cadastro de Transportadoras',
  icon:  BookUser,
  roles: ['admin', 'logistica'],
}
const centralSolicitacoes: NavItem = {
  href:  '/carregamento',
  label: 'Central de Solicitações',
  icon:  ClipboardList,
  roles: ['operador_carregamento', 'admin'],
}
const centroOperacional: NavItem = {
  href:  '/pa',
  label: 'Centro Operacional',
  icon:  Truck,
  roles: ['operador_pa', 'admin'],
}
const solicitacoes: NavItem = {
  href:  '/solicitacoes',
  label: 'Solicitações',
  icon:  Inbox,
  roles: ['admin', 'logistica'],
}

/**
 * Estrutura do menu lateral (pedido da Logística em 2026-09-25): o que é
 * rotina da Logística fica dentro de "Logística", o painel de TV em
 * "Carregamento" e cadastro + solicitações em "Transportadoras". A pessoa
 * clica no grupo pra ver o que tem dentro e clica de novo pra recolher.
 */
export const NAV_ENTRIES: NavEntry[] = [
  {
    kind: 'item',
    item: { href: '/', label: 'Centro de Comando', icon: LayoutDashboard, roles: ['admin'] },
  },
  {
    // Resumo fica solto, fora dos grupos (pedido de 2026-09-25): agenda mensal do que foi carregado.
    kind: 'item',
    item: { href: '/resumo', label: 'Resumo', icon: CalendarCheck, roles: ['admin', 'logistica', 'logistica_02', 'faturamento'] },
  },
  {
    kind: 'group',
    group: { id: 'logistica', label: 'Logística', icon: Route, items: [ordensDoDia, programacaoCarregamento, programacaoRecebimento] },
  },
  {
    kind: 'group',
    group: { id: 'carregamento', label: 'Carregamento', icon: Truck, items: [painelTv] },
  },
  {
    kind: 'group',
    group: { id: 'transportadoras', label: 'Transportadoras', icon: Container, items: [cadastroTransportadoras, solicitacoes] },
  },
  {
    // Pá Carregadeira (2026-10-01): as duas telas da descarga num grupo só.
    // Cada operador continua vendo só a sua (Richardson → Central, Reginaldo →
    // Centro Operacional); o admin vê as duas.
    kind: 'group',
    group: { id: 'pa-carregadeira', label: 'Pá Carregadeira', icon: Forklift, items: [centralSolicitacoes, centroOperacional] },
  },
  {
    // Fórmulas saiu do perfil logistica (2026-09-25) — só admin mexe no catálogo.
    kind: 'item',
    item: { href: '/admin/formulas', label: 'Fórmulas', icon: FileSpreadsheet, roles: ['admin'] },
  },
  {
    kind: 'item',
    item: { href: '/transportadora', label: 'Meus Carregamentos', icon: Truck, roles: ['transportadora'] },
  },
  {
    // Configurações do próprio perfil (foto e nome de exibição) — não mexe no login.
    kind: 'item',
    item: { href: '/configuracoes', label: 'Configurações', icon: Settings, roles: ['admin', 'logistica', 'logistica_02', 'faturamento', 'operador_carregamento', 'operador_pa'] },
  },
]

/** Lista plana (ordem do menu) — usada pelo Command Palette e pelo cálculo de item ativo. */
export const NAV_ITEMS: NavItem[] = NAV_ENTRIES.flatMap((e) => (e.kind === 'item' ? [e.item] : e.group.items))

/** Entradas visíveis pra um perfil: item solto pelo próprio `roles`, grupo se tiver ao menos um item visível. */
export function navEntriesForRole(role: AppUser['role'] | undefined): NavEntry[] {
  const visivel = (item: NavItem) => !role || item.roles.includes(role)
  return NAV_ENTRIES.flatMap<NavEntry>((e) => {
    if (e.kind === 'item') return visivel(e.item) ? [e] : []
    const items = e.group.items.filter(visivel)
    return items.length ? [{ kind: 'group', group: { ...e.group, items } }] : []
  })
}
