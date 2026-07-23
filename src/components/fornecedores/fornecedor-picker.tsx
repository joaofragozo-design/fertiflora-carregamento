'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils/cn'
import type { Fornecedor } from '@/types/fornecedor'

interface FornecedorPickerProps {
  value:       string
  fornecedores: Fornecedor[]
  onChange:    (nome: string, id: string | null) => void
  onCriar:     (nome: string) => Promise<Fornecedor>
  placeholder?: string
  className?:  string
}

function normalizar(nome: string): string {
  return nome.trim().toLowerCase()
}

/** Combobox de fornecedores: busca entre os já cadastrados ou cadastra um novo na hora. */
export function FornecedorPicker({ value, fornecedores, onChange, onCriar, placeholder = 'Selecionar fornecedor…', className }: FornecedorPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [criando, setCriando] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    if (!query) return fornecedores.slice(0, 50)
    const q = query.toLowerCase()
    return fornecedores.filter((f) => f.nome.toLowerCase().includes(q)).slice(0, 50)
  }, [fornecedores, query])

  const existeExato = useMemo(
    () => fornecedores.some((f) => normalizar(f.nome) === normalizar(query)),
    [fornecedores, query],
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

  function selecionar(f: Fornecedor) {
    onChange(f.nome, f.id)
    fechar()
  }

  async function cadastrarNovo() {
    const nome = query.trim()
    if (!nome) return
    setCriando(true)
    try {
      const novo = await onCriar(nome)
      onChange(novo.nome, novo.id)
      fechar()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao cadastrar fornecedor.')
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
          'w-full flex items-center justify-between gap-1 px-3 py-2 rounded-lg text-sm',
          'bg-industrial-950 border border-industrial-600 text-left text-industrial-100',
          'hover:border-brand-600 focus:outline-none focus:border-brand-500',
        )}
      >
        <span className={cn('truncate', !value && 'text-industrial-500')}>
          {value || placeholder}
        </span>
        <ChevronDown className="size-4 shrink-0 text-industrial-400" />
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
          className="z-[100] flex flex-col bg-industrial-900 border border-industrial-600 rounded-lg shadow-industrial overflow-hidden"
        >
          <div className="p-1.5 border-b border-industrial-700 shrink-0">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar ou cadastrar fornecedor..."
              className="w-full bg-industrial-950 text-sm text-industrial-100 placeholder-industrial-500
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
                  className="w-full text-left text-sm px-3 py-2 flex items-center gap-1.5 text-brand-700 font-semibold hover:bg-industrial-800 disabled:opacity-50"
                >
                  <Plus className="size-3.5" /> {criando ? 'Cadastrando…' : `Cadastrar "${query.trim()}"`}
                </button>
              </li>
            )}
            {filtered.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => selecionar(f)}
                  className={cn(
                    'w-full text-left text-sm px-3 py-1.5 truncate hover:bg-industrial-800',
                    f.nome === value ? 'text-brand-700 font-semibold' : 'text-industrial-100',
                  )}
                >
                  {f.nome}
                </button>
              </li>
            ))}
            {filtered.length === 0 && !query && (
              <li className="text-sm text-industrial-500 px-3 py-2">Nenhum fornecedor cadastrado ainda.</li>
            )}
          </ul>
        </div>,
        document.body,
      )}
    </div>
  )
}
