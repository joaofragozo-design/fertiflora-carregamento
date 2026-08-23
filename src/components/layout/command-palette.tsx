'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Command } from 'cmdk'
import { Search, LogOut, PanelLeftClose } from 'lucide-react'
import { NAV_ITEMS } from '@/constants/nav-items'
import type { AppUser } from '@/types'

interface CommandPaletteProps {
  open:            boolean
  onOpenChange:    (open: boolean) => void
  user:            AppUser | null
  onSignOut?:      () => void
  onToggleSidebar?: () => void
}

/** Busca/navegação global (Cmd+K ou Ctrl+K, ou botão no header) — substitui
 *  ter que caçar item na sidebar. Só navegação por enquanto; buscar dados
 *  (ordens, clientes) fica pra uma v2 que precisa de uma rota de busca no
 *  servidor. */
export function CommandPalette({ open, onOpenChange, user, onSignOut, onToggleSidebar }: CommandPaletteProps) {
  const router = useRouter()

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onOpenChange])

  const itensVisiveis = NAV_ITEMS.filter(
    (item) => !user?.role || item.roles.includes(user.role)
  )

  function ir(href: string) {
    onOpenChange(false)
    router.push(href)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 p-4 pt-[12vh]"
      onClick={() => onOpenChange(false)}
    >
      <Command
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-xl border border-industrial-300 bg-industrial-100 shadow-industrial"
        loop
      >
        <div className="flex items-center gap-2.5 border-b border-industrial-200 px-4">
          <Search className="size-4 shrink-0 text-industrial-500" />
          <Command.Input
            autoFocus
            placeholder="Ir para… (ordens, recebimento, transportadoras)"
            className="w-full bg-transparent py-3 text-sm text-industrial-900 placeholder-industrial-500 outline-none"
          />
        </div>

        <Command.List className="max-h-80 overflow-y-auto p-2">
          <Command.Empty className="px-3 py-6 text-center text-sm text-industrial-500">
            Nada encontrado.
          </Command.Empty>

          <Command.Group heading="Navegação" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-industrial-500">
            {itensVisiveis.map((item) => {
              const Icon = item.icon
              return (
                <Command.Item
                  key={item.href}
                  value={item.label}
                  onSelect={() => ir(item.href)}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-industrial-800 aria-selected:bg-brand-600/10 aria-selected:text-brand-300"
                >
                  <Icon className="size-4 shrink-0" />
                  {item.label}
                </Command.Item>
              )
            })}
          </Command.Group>

          {(onToggleSidebar || onSignOut) && (
            <Command.Group heading="Ações" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-industrial-500">
              {onToggleSidebar && (
                <Command.Item
                  value="Mostrar ou ocultar menu lateral"
                  onSelect={() => { onOpenChange(false); onToggleSidebar() }}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-industrial-800 aria-selected:bg-brand-600/10 aria-selected:text-brand-300"
                >
                  <PanelLeftClose className="size-4 shrink-0" />
                  Mostrar ou ocultar menu lateral
                </Command.Item>
              )}
              {onSignOut && (
                <Command.Item
                  value="Sair do sistema"
                  onSelect={() => { onOpenChange(false); onSignOut() }}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-danger-400 aria-selected:bg-danger-500/10"
                >
                  <LogOut className="size-4 shrink-0" />
                  Sair do sistema
                </Command.Item>
              )}
            </Command.Group>
          )}
        </Command.List>

        <div className="flex items-center gap-3 border-t border-industrial-200 px-4 py-2 text-[11px] text-industrial-500">
          <span>↑↓ navegar</span>
          <span>↵ selecionar</span>
          <span>esc fechar</span>
        </div>
      </Command>
    </div>
  )
}
