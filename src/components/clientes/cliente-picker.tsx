'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils/cn'
import type { Cliente } from '@/types/cliente'

interface ClientePickerProps {
  value: string
  clientes: Cliente[]
  onChange: (nome: string) => void
  onCriar: (nome: string) => Promise<Cliente>
  placeholder?: string
  className?: string
}

/** Combobox de clientes: busca entre os já cadastrados ou cadastra um novo na hora. */
export function ClientePicker({ value, clientes, onChange, onCriar, placeholder = 'Selecionar cliente…', className }: ClientePickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [criando, setCriando] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    if (!query) return clientes.slice(0, 50)
    const q = query.toLowerCase()
    return clientes.filter((c) => c.nome.toLowerCase().includes(q)).slice(0, 50)
  }, [clientes, query])

  const existeExato = useMemo(
    () => clientes.some((c) => c.nome.toLowerCase() === query.trim().toLowerCase()),
    [clientes, query],
  )

  function fechar() {
    setOpen(false)
    setQuery('')
  }

  function abrir() {
    const r = btnRef.current?.getBoundingClientRect()
    if (r) setPos({ left: r.left, top: r.bottom + 4, width: Math.max(r.width, 260) })
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 40)
  }

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return
      fechar()
    }
    const onScroll = (e: Event) => {
      // Permite rolar a PRÓPRIA lista; só fecha se a rolagem for da página.
      if (popRef.current && e.target instanceof Node && popRef.current.contains(e.target)) return
      fechar()
    }
    const onResize = () => fechar()
    document.addEventListener('mousedown', onDocClick)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  function selecionar(nome: string) {
    onChange(nome)
    fechar()
  }

  async function cadastrarNovo() {
    const nome = query.trim()
    if (!nome) return
    setCriando(true)
    try {
      const novo = await onCriar(nome)
      onChange(novo.nome)
      fechar()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao cadastrar cliente.')
    } finally {
      setCriando(false)
    }
  }

  return (
    <div className={cn('relative', className)}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? fechar() : abrir())}
        className={cn(
          'w-full flex items-center justify-between gap-1 px-2 py-1 rounded text-xs',
          'bg-industrial-900 border border-industrial-600 text-left text-industrial-100',
          'hover:border-brand-600 focus:outline-none focus:border-brand-500',
        )}
      >
        <span className={cn('truncate font-medium', !value && 'text-industrial-500 font-normal')}>
          {value || placeholder}
        </span>
        <ChevronDown className="size-3 shrink-0 text-industrial-400" />
      </button>

      {open && pos && createPortal(
        <div
          ref={popRef}
          style={{
            position: 'fixed',
            left: pos.left,
            top: pos.top,
            width: pos.width,
            maxHeight: `calc(100vh - ${pos.top}px - 12px)`,
          }}
          className="z-[100] flex flex-col bg-industrial-900 border border-industrial-600 rounded shadow-industrial overflow-hidden"
        >
          <div className="p-1.5 border-b border-industrial-700 shrink-0">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar ou cadastrar cliente..."
              className="w-full bg-industrial-950 text-xs text-industrial-100 placeholder-industrial-500
                         px-2 py-1.5 rounded border border-industrial-600 focus:outline-none focus:border-brand-500"
            />
          </div>
          <ul className="overflow-y-auto py-1">
            {query.trim() && !existeExato && (
              <li>
                <button
                  type="button"
                  onClick={cadastrarNovo}
                  disabled={criando}
                  className="w-full text-left text-xs px-3 py-2 flex items-center gap-1.5 text-brand-700 font-semibold hover:bg-industrial-800 disabled:opacity-50"
                >
                  <Plus className="size-3.5" /> {criando ? 'Cadastrando…' : `Cadastrar "${query.trim()}"`}
                </button>
              </li>
            )}
            {filtered.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => selecionar(c.nome)}
                  className={cn(
                    'w-full text-left text-xs px-3 py-2 truncate hover:bg-industrial-800',
                    c.nome === value ? 'text-brand-700 font-semibold' : 'text-industrial-100',
                  )}
                >
                  {c.nome}
                </button>
              </li>
            ))}
            {filtered.length === 0 && !query && (
              <li className="text-xs text-industrial-500 px-3 py-2">Nenhum cliente cadastrado ainda.</li>
            )}
          </ul>
        </div>,
        document.body,
      )}
    </div>
  )
}
