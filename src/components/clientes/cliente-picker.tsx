'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Plus, Pencil, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils/cn'
import type { Cliente } from '@/types/cliente'
import type { ClienteErp } from '@/types/cliente-erp'

interface ClientePickerProps {
  value: string
  clientes: Cliente[]
  /** Clientes reais do ERP (com código) -- mesclados com `clientes` na lista, preferidos em caso de nome repetido. */
  clientesErp?: ClienteErp[]
  onChange: (nome: string, codigo: number | null) => void
  onCriar: (nome: string) => Promise<Cliente>
  /** Corrige nome/código de um cliente cadastrado manualmente (clientes_carregamento). */
  onEditar?: (id: string, dados: { nome: string; codigo: number | null }) => Promise<Cliente>
  placeholder?: string
  className?: string
}

interface Opcao { nome: string; codigo: number | null; id: string | null }

function normalizar(nome: string): string {
  return nome.trim().toLowerCase()
}

/** Combobox de clientes: busca entre os já cadastrados/ERP ou cadastra um novo na hora. */
export function ClientePicker({ value, clientes, clientesErp = [], onChange, onCriar, onEditar, placeholder = 'Selecionar cliente…', className }: ClientePickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [criando, setCriando] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null)
  const [editando, setEditando] = useState<{ id: string; nome: string; codigo: string } | null>(null)
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Mescla cadastro manual (clientes_carregamento, com id editável) com o ERP (com
  // código real) -- em caso de nome repetido, o ERP vence no nome/código exibido,
  // mas mantém o `id` do cadastro manual pra continuar dando pra editar.
  const opcoes = useMemo(() => {
    const porNome = new Map<string, Opcao>()
    for (const c of clientes) porNome.set(normalizar(c.nome), { nome: c.nome, codigo: c.codigo, id: c.id })
    for (const c of clientesErp) {
      const existente = porNome.get(normalizar(c.nome))
      porNome.set(normalizar(c.nome), { nome: c.nome, codigo: c.codigo, id: existente?.id ?? null })
    }
    return [...porNome.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [clientes, clientesErp])

  const filtered = useMemo(() => {
    if (!query) return opcoes.slice(0, 50)
    const q = query.toLowerCase()
    return opcoes.filter((c) => c.nome.toLowerCase().includes(q)).slice(0, 50)
  }, [opcoes, query])

  const existeExato = useMemo(
    () => opcoes.some((c) => normalizar(c.nome) === normalizar(query)),
    [opcoes, query],
  )

  function fechar() {
    setOpen(false)
    setQuery('')
    setEditando(null)
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

  function selecionar(nome: string, codigo: number | null) {
    onChange(nome, codigo)
    fechar()
  }

  async function cadastrarNovo() {
    const nome = query.trim()
    if (!nome) return

    // Quem agenda costuma digitar o código do ERP como lembrete dentro do próprio nome, tipo
    // "AGROIZAK(274984)" -- se esse código bate com um cliente real do ERP, usa ele diretamente
    // (nome oficial + código de verdade) em vez de cadastrar um registro manual novo com
    // cliente_codigo nulo, que é o que sempre acontecia aqui e quebrava o vínculo com o vendedor.
    const codigoEmbutido = nome.match(/\((\d+)\)\s*$/)?.[1]
    if (codigoEmbutido) {
      const clienteErp = clientesErp.find((c) => c.codigo === Number(codigoEmbutido))
      if (clienteErp) {
        selecionar(clienteErp.nome, clienteErp.codigo)
        return
      }
    }

    setCriando(true)
    try {
      const novo = await onCriar(nome)
      onChange(novo.nome, null)
      fechar()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao cadastrar cliente.')
    } finally {
      setCriando(false)
    }
  }

  function abrirEdicao(c: Opcao) {
    if (!c.id) return
    setEditando({ id: c.id, nome: c.nome, codigo: c.codigo != null ? String(c.codigo) : '' })
  }

  async function salvarEdicao() {
    if (!editando || !onEditar) return
    const nome = editando.nome.trim()
    if (!nome) return
    setSalvandoEdicao(true)
    try {
      const codigo = editando.codigo.trim() ? Number(editando.codigo.trim()) : null
      const atualizado = await onEditar(editando.id, { nome, codigo })
      if (normalizar(value) === normalizar(editando.nome) || value === '') onChange(atualizado.nome, atualizado.codigo)
      setEditando(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar cliente.')
    } finally {
      setSalvandoEdicao(false)
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
          {editando ? (
            <div className="p-2.5 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-industrial-200">Editar cliente</span>
                <button type="button" onClick={() => setEditando(null)} className="text-industrial-400 hover:text-industrial-100">
                  <X className="size-3.5" />
                </button>
              </div>
              <label className="text-[10px] font-medium text-industrial-400">Nome
                <input
                  autoFocus
                  value={editando.nome}
                  onChange={(e) => setEditando({ ...editando, nome: e.target.value })}
                  className="mt-1 w-full bg-industrial-950 text-xs text-industrial-100 placeholder-industrial-500
                             px-2 py-1.5 rounded border border-industrial-600 focus:outline-none focus:border-brand-500"
                />
              </label>
              <label className="text-[10px] font-medium text-industrial-400">Código do ERP (opcional)
                <input
                  type="number"
                  value={editando.codigo}
                  onChange={(e) => setEditando({ ...editando, codigo: e.target.value })}
                  placeholder="ex.: 274984"
                  className="mt-1 w-full bg-industrial-950 text-xs text-industrial-100 placeholder-industrial-500
                             px-2 py-1.5 rounded border border-industrial-600 focus:outline-none focus:border-brand-500"
                />
              </label>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setEditando(null)}
                  className="rounded px-3 py-1.5 text-xs font-medium text-industrial-300 hover:bg-industrial-800">Cancelar</button>
                <button type="button" onClick={salvarEdicao} disabled={salvandoEdicao}
                  className="rounded bg-brand-700 hover:bg-brand-600 text-white px-3 py-1.5 text-xs font-medium disabled:opacity-50">
                  {salvandoEdicao ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </div>
          ) : (
            <>
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
                  <li key={`${c.codigo ?? 'manual'}-${c.nome}`} className="flex items-center gap-1 px-1">
                    <button
                      type="button"
                      onClick={() => selecionar(c.nome, c.codigo)}
                      className={cn(
                        'flex-1 min-w-0 text-left text-xs px-2 py-2 rounded truncate hover:bg-industrial-800 flex items-center justify-between gap-2',
                        c.nome === value ? 'text-brand-700 font-semibold' : 'text-industrial-100',
                      )}
                    >
                      <span className="truncate">{c.nome}</span>
                      {c.codigo != null && <span className="shrink-0 text-[10px] text-industrial-500">#{c.codigo}</span>}
                    </button>
                    {onEditar && c.id && (
                      <button
                        type="button"
                        onClick={() => abrirEdicao(c)}
                        title="Editar nome/código"
                        className="shrink-0 p-1.5 rounded text-industrial-500 hover:text-brand-700 hover:bg-industrial-800"
                      >
                        <Pencil className="size-3" />
                      </button>
                    )}
                  </li>
                ))}
                {filtered.length === 0 && !query && (
                  <li className="text-xs text-industrial-500 px-3 py-2">Nenhum cliente cadastrado ainda.</li>
                )}
              </ul>
            </>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}
