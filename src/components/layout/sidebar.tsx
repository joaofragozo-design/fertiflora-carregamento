'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { X, LogOut, ChevronDown } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'
import { NAV_ITEMS, navEntriesForRole, type NavGroup, type NavItem } from '@/constants/nav-items'
import { LogoMark } from '@/components/brand/logo'
import { ROLE_LABELS } from '@/constants/roles'
import type { AppUser } from '@/types'

/** Preferência de grupos abertos — por navegador. */
const GRUPOS_KEY = 'fertilog:sidebar:grupos'

/**
 * Item ativo considerando a query string: "Painel TV" é /ordens?vista=tv —
 * só o pathname não distingue as duas entradas, e "Ordens do Dia" acendia
 * dentro do painel de TV.
 */
function isItemActive(href: string, pathname: string, search: URLSearchParams): boolean {
  const [path, query] = href.split('?')
  const pathMatch = pathname === path || (path !== '/' && pathname.startsWith(path))
  if (!pathMatch) return false

  if (query) {
    for (const [k, v] of new URLSearchParams(query)) {
      if (search.get(k) !== v) return false
    }
    return true
  }

  // Item sem query só fica ativo se nenhuma variante com query do mesmo
  // caminho (ex.: ?vista=tv) estiver ativa no momento.
  return !NAV_ITEMS.some((other) => {
    const [otherPath, otherQuery] = other.href.split('?')
    if (other.href === href || otherPath !== path || !otherQuery) return false
    for (const [k, v] of new URLSearchParams(otherQuery)) {
      if (search.get(k) !== v) return false
    }
    return true
  })
}

interface SidebarProps {
  user:       AppUser | null
  isOpen?:    boolean
  collapsed?: boolean
  onClose?:   () => void
  onSignOut?: () => void
}

const GLIDE = [0.16, 1, 0.3, 1] as const

/** Link de navegação — solto no primeiro nível ou aninhado dentro de um grupo. */
function NavLink({ item, active, nested, onClick }: { item: NavItem; active: boolean; nested?: boolean; onClick?: () => void }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm leading-tight transition-colors duration-200',
        active
          ? 'bg-spruce-50 font-semibold text-spruce-900 shadow-[0_8px_20px_-10px_rgba(0,0,0,0.7)]'
          : 'font-medium text-spruce-200/90 hover:bg-white/[0.07] hover:text-white',
      )}
    >
      {/* Barra de acento do item ativo: sobre a linha-guia quando aninhado, na borda do card quando solto. */}
      {active && (
        <span
          aria-hidden="true"
          className={cn('absolute top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-brand-500', nested ? '-left-[9px]' : '-left-3')}
        />
      )}
      <Icon className={cn('size-[18px] shrink-0 transition-colors', active ? 'text-brand-600' : 'text-spruce-200/70 group-hover:text-white')} />
      <span>{item.label}</span>
    </Link>
  )
}

/** Grupo recolhível: cabeçalho em caixa alta com chevron; itens recuados com linha-guia. */
function NavGroupBlock({
  group, aberto, temAtivo, reduceMotion, onToggle, renderItem,
}: {
  group: NavGroup
  aberto: boolean
  temAtivo: boolean
  reduceMotion: boolean
  onToggle: () => void
  renderItem: (item: NavItem) => React.ReactNode
}) {
  const Icon = group.icon
  const idItens = `nav-grupo-${group.id}`
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={aberto}
        aria-controls={idItens}
        className={cn(
          'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-200 hover:bg-white/[0.06]',
          temAtivo && !aberto && 'bg-white/[0.05]',
        )}
      >
        <Icon className={cn('size-[18px] shrink-0 transition-colors', temAtivo ? 'text-brand-300' : 'text-spruce-200/70')} />
        <span className="flex-1 font-display text-[11px] font-semibold uppercase tracking-[.18em] text-spruce-50/90">
          {group.label}
        </span>
        <motion.span
          aria-hidden="true"
          animate={{ rotate: aberto ? 0 : -90 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.22, ease: GLIDE }}
          className="inline-flex text-spruce-200/70"
        >
          <ChevronDown className="size-4" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {aberto && (
          <motion.div
            id={idItens}
            key="itens"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.24, ease: GLIDE }}
            className="overflow-hidden"
          >
            <div className="my-1 ml-[21px] flex flex-col gap-0.5 border-l border-white/10 pl-2">
              {group.items.map(renderItem)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Sidebar no padrão do shell do Trilho STO: card flutuante arredondado com
 * gradiente spruce, marca no topo, navegação em grupos recolhíveis e cartão de usuário. */
export function Sidebar({ user, isOpen = true, collapsed = false, onClose, onSignOut }: SidebarProps) {
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const reduceMotion = useReducedMotion() ?? false
  const entries      = useMemo(() => navEntriesForRole(user?.role), [user?.role])
  const inicial      = (user?.username ?? '?').trim().charAt(0).toUpperCase()

  const ativo = (item: NavItem) => isItemActive(item.href, pathname, searchParams)
  const grupoAtivoId = useMemo(
    () => entries.find((e): e is Extract<typeof e, { kind: 'group' }> => e.kind === 'group' && e.group.items.some(ativo))?.group.id ?? null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries, pathname, searchParams],
  )

  // Estado inicial determinístico (servidor e cliente): só o grupo da tela atual aberto.
  const [abertos, setAbertos] = useState<Record<string, boolean>>(() => (grupoAtivoId ? { [grupoAtivoId]: true } : {}))

  // Preferência salva entra depois da hidratação; o grupo da tela atual sempre começa aberto.
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(GRUPOS_KEY)
      if (salvo) setAbertos((prev) => ({ ...prev, ...(JSON.parse(salvo) as Record<string, boolean>), ...(grupoAtivoId ? { [grupoAtivoId]: true } : {}) }))
    } catch { /* localStorage indisponível — fica no padrão */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Navegou pra uma tela dentro de um grupo fechado (ex.: pelo Ctrl+K)? Abre o grupo.
  useEffect(() => {
    if (grupoAtivoId) setAbertos((prev) => (prev[grupoAtivoId] ? prev : { ...prev, [grupoAtivoId]: true }))
  }, [grupoAtivoId])

  const alternarGrupo = (id: string) =>
    setAbertos((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      try { localStorage.setItem(GRUPOS_KEY, JSON.stringify(next)) } catch { /* ignora */ }
      return next
    })

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-black/70 md:hidden" onClick={onClose} />
      )}

      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 flex w-64 flex-col overflow-hidden bg-gradient-to-b from-spruce-700 via-spruce-800 to-spruce-900 transition-all duration-200 print:hidden',
        'md:static md:translate-x-0 md:my-3 md:ml-3 md:rounded-3xl md:shadow-editorial',
        isOpen ? 'translate-x-0' : '-translate-x-full',
        collapsed ? 'md:w-0 md:ml-0 md:border-0' : 'md:w-64'
      )}>
        {/* Brilho suave no topo do card, como luz batendo na chapa. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_top,rgba(111,200,91,0.16),transparent_65%)]" />

        {/* Fechar mobile */}
        <div className="relative flex h-12 items-center justify-end px-4 md:hidden">
          <button onClick={onClose} className="rounded-md p-1.5 text-spruce-200/80 hover:bg-white/10" aria-label="Fechar menu">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Marca */}
        <div className="relative px-6 pb-4 md:pt-7">
          <div className="flex items-center gap-2.5">
            <LogoMark size={28} />
            <span className="font-display text-lg font-semibold tracking-tight text-white">FertiLog</span>
          </div>
          <p className="mt-1.5 text-xs text-spruce-200/80">Fertiflora · Carregamento</p>
        </div>
        <div aria-hidden="true" className="mx-5 border-t border-white/[0.08]" />

        <nav aria-label="Principal" className="relative flex flex-1 flex-col overflow-y-auto px-3 py-2">
          <div className="flex flex-col divide-y divide-white/[0.07]">
            {entries.map((entry) => (
              <div key={entry.kind === 'item' ? entry.item.href : entry.group.id} className="py-1">
                {entry.kind === 'item' ? (
                  <NavLink item={entry.item} active={ativo(entry.item)} onClick={onClose} />
                ) : (
                  <NavGroupBlock
                    group={entry.group}
                    aberto={!!abertos[entry.group.id]}
                    temAtivo={entry.group.id === grupoAtivoId}
                    reduceMotion={reduceMotion}
                    onToggle={() => alternarGrupo(entry.group.id)}
                    renderItem={(item) => <NavLink key={item.href} item={item} active={ativo(item)} nested onClick={onClose} />}
                  />
                )}
              </div>
            ))}
          </div>
        </nav>

        {/* Usuário */}
        {user && (
          <div className="relative m-3 rounded-2xl border border-white/[0.06] bg-white/[0.07] p-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-400 font-display text-sm font-bold text-spruce-900 shadow-[0_0_0_3px_rgba(111,200,91,0.18)]">
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
                className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition-colors duration-200 hover:bg-white/20"
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
