'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Plus, Pencil, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils/cn'
import type { Fornecedor } from '@/types/fornecedor'

interface FornecedorPickerProps {
  value:       string
  fornecedores: Fornecedor[]
  onChange:    (nome: string, id: string | null) => void
  onCriar:     (nome: string) => Promise<Fornecedor>
  onEditar?:   (fornecedor: Fornecedor, novoNome: string) => Promise<Fornecedor>
  placeholder?: string
  className?:  string
}

function normalizar(nome: string): string {
  return nome.trim().toLowerCase()
}

/** Combobox de fornecedores: busca entre os já cadastrados ou cadastra um novo na hora. */
export function FornecedorPicker({ value, fornecedores, onChange, onCriar, onEditar, placeholder = 'Selecionar fornecedor…', className }: FornecedorPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [criando, setCriando] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editValor, setEditValor] = useState('')
  const [salvandoEdit, setSalvandoEdit] = useState(false)
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
    setEditandoId(null)
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

  function abrirEdicao(f: Fornecedor, e: React.MouseEvent) {
    e.stopPropagation()
    setEditandoId(f.id)
    setEditValor(f.nome)
  }

  async function confirmarEdicao(f: Fornecedor) {
    const novoNome = editValor.trim()
    if (!novoNome || !onEditar) return
    if (novoNome === f.nome) {
      setEditandoId(null)
      return
    }
    setSalvandoEdit(true)
    try {
      const atualizado = await onEditar(f, novoNome)
      // Se o fornecedor renomeado é o que está selecionado neste formulário
      // agora, atualiza o texto exibido também — senão fica mostrando o nome
      // antigo até o form ser reaberto.
      if (f.nome === value) onChange(atualizado.nome, atualizado.id)
      setEditandoId(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao editar fornecedor.')
    } finally {
      setSalvandoEdit(false)
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
          'bg-industrial-50 border border-industrial-400 text-left text-industrial-900',
          'hover:border-brand-600 focus:outline-none focus:border-brand-500',
        )}
      >
        <span className={cn('truncate', !value && 'text-industrial-500')}>
          {value || placeholder}
        </span>
        <ChevronDown className="size-4 shrink-0 text-industrial-600" />
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
          className="z-[1200] flex flex-col bg-industrial-100 border border-industrial-400 rounded-lg shadow-industrial overflow-hidden"
        >
          <div className="p-1.5 border-b border-industrial-300 shrink-0">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar ou cadastrar fornecedor..."
              className="w-full bg-industrial-50 text-sm text-industrial-900 placeholder-industrial-500
                         px-2 py-1.5 rounded border border-industrial-400 focus:outline-none focus:border-brand-500"
            />
          </div>
          <ul className="overflow-y-auto py-1">
            {/* Sempre visível (não só depois de digitar) — senão fica escondido
             *  atrás de "digite um nome que ainda não existe", o que parecia
             *  "não deixa cadastrar" pra quem não percebia que precisava digitar. */}
            <li className="border-b border-industrial-200">
              <button
                type="button"
                onClick={cadastrarNovo}
                disabled={criando || !query.trim() || existeExato}
                className="w-full text-left text-sm px-3 py-2 flex items-center gap-1.5 text-brand-300 font-semibold hover:bg-industrial-200 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="size-3.5" />
                {criando
                  ? 'Cadastrando…'
                  : query.trim()
                    ? (existeExato ? 'Fornecedor já cadastrado' : `Cadastrar "${query.trim()}"`)
                    : 'Digite o nome acima pra cadastrar um fornecedor novo'}
              </button>
            </li>
            {filtered.map((f) => (
              <li key={f.id} className="flex items-center gap-1 px-1">
                {editandoId === f.id ? (
                  <div className="flex flex-1 items-center gap-1 py-1">
                    <input
                      autoFocus
                      value={editValor}
                      onChange={(e) => setEditValor(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') confirmarEdicao(f)
                        if (e.key === 'Escape') setEditandoId(null)
                      }}
                      disabled={salvandoEdit}
                      className="min-w-0 flex-1 bg-industrial-50 border border-brand-500 rounded px-2 py-1 text-sm text-industrial-900 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => confirmarEdicao(f)}
                      disabled={salvandoEdit || !editValor.trim()}
                      title="Salvar"
                      className="shrink-0 p-1 text-brand-300 hover:text-brand-300 disabled:opacity-40"
                    >
                      <Check className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditandoId(null)}
                      disabled={salvandoEdit}
                      title="Cancelar"
                      className="shrink-0 p-1 text-industrial-500 hover:text-industrial-800"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => selecionar(f)}
                      className={cn(
                        'flex-1 min-w-0 text-left text-sm px-2 py-1.5 rounded truncate hover:bg-industrial-200',
                        f.nome === value ? 'text-brand-300 font-semibold' : 'text-industrial-900',
                      )}
                    >
                      {f.nome}
                    </button>
                    {onEditar && (
                      <button
                        type="button"
                        onClick={(e) => abrirEdicao(f, e)}
                        title="Editar nome do fornecedor"
                        className="shrink-0 p-1.5 text-industrial-500 hover:text-brand-300"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    )}
                  </>
                )}
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
