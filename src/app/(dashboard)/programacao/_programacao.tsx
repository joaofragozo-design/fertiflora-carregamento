'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Trash2, Pencil, X, ChevronLeft, ChevronRight, ChevronDown, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { ProgramacaoService } from '@/services/programacao.service'
import { ROUTES } from '@/constants/routes'
import type { Programacao } from '@/types/programacao'
import type { Embalagem, Formula } from '@/types/formula'
import { INGREDIENTES, EMBALAGEM_LABEL, EMBALAGEM_OPCOES, calcularIngrediente, calcularTons } from '@/types/formula'
import { cn } from '@/lib/utils/cn'

interface ProgramacaoSemanaProps {
  initialItens:  Programacao[]
  formulas:      { id: number; nome: string }[]
  semanaInicio:  string // segunda-feira (YYYY-MM-DD)
  hoje:          string
  readOnly:      boolean
}

const DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta']

function pad(n: number): string {
  return String(n).padStart(2, '0')
}
function addDiasIso(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + n)
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}
function ddmm(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

function FormulaPicker({
  value,
  formulas,
  onChange,
}: {
  value: number | null
  formulas: { id: number; nome: string }[]
  onChange: (id: number | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const selected = formulas.find((f) => f.id === value)

  const filtered = useMemo(() => {
    if (!query) return formulas.slice(0, 40)
    const q = query.toLowerCase()
    return formulas.filter((f) => f.nome.toLowerCase().includes(q)).slice(0, 40)
  }, [formulas, query])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQuery('') }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-1 px-3 py-2 rounded-lg text-sm bg-industrial-950 border border-industrial-600 text-left text-industrial-100 hover:border-brand-600 focus:outline-none focus:border-brand-500"
      >
        <span className={cn('truncate', !selected && 'text-industrial-500')}>
          {selected?.nome ?? 'Selecionar fórmula…'}
        </span>
        <ChevronDown className="size-4 shrink-0 text-industrial-400" />
      </button>
      {open && (
        <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-industrial-900 border border-industrial-600 rounded-lg shadow-industrial">
          <div className="p-1.5 border-b border-industrial-700">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar fórmula..."
              className="w-full bg-industrial-950 text-sm text-industrial-100 placeholder-industrial-500 px-2 py-1.5 rounded border border-industrial-600 focus:outline-none focus:border-brand-500"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            <li>
              <button type="button" onClick={() => { onChange(null); setOpen(false); setQuery('') }}
                className="w-full text-left text-sm px-3 py-1.5 text-industrial-400 hover:bg-industrial-800">
                — Nenhuma —
              </button>
            </li>
            {filtered.map((f) => (
              <li key={f.id}>
                <button type="button" onClick={() => { onChange(f.id); setOpen(false); setQuery('') }}
                  className={cn('w-full text-left text-sm px-3 py-1.5 truncate hover:bg-industrial-800',
                    f.id === value ? 'text-brand-700 font-semibold' : 'text-industrial-100')}>
                  {f.nome}
                </button>
              </li>
            ))}
            {filtered.length === 0 && <li className="text-sm text-industrial-500 px-3 py-2">Nada encontrado.</li>}
          </ul>
        </div>
      )}
    </div>
  )
}

interface FormState {
  id: string | null
  data: string
  cliente: string
  formula_id: number | null
  quantidade: number
  embalagem: Embalagem
  observacao: string
}

const FORM_VAZIO: Omit<FormState, 'data'> = {
  id: null, cliente: '', formula_id: null, quantidade: 0, embalagem: 'SACOS', observacao: '',
}

export function ProgramacaoSemana({ initialItens, formulas, semanaInicio, hoje, readOnly }: ProgramacaoSemanaProps) {
  const [itens, setItens] = useState<Programacao[]>(initialItens)
  const [form, setForm] = useState<FormState | null>(null)
  const [salvando, setSalvando] = useState(false)
  const svc = useMemo(() => new ProgramacaoService(createClient()), [])
  const router = useRouter()

  const amanha = addDiasIso(hoje, 1)

  const dias = useMemo(
    () => DIAS.map((nome, i) => ({ nome, data: addDiasIso(semanaInicio, i) })),
    [semanaInicio],
  )

  const totalSemana = useMemo(() => itens.reduce((s, it) => s + (it.tons ?? 0), 0), [itens])
  const itensDoDia = (data: string) => itens.filter((it) => it.data === data)
  const totalDia = (data: string) => itensDoDia(data).reduce((s, it) => s + (it.tons ?? 0), 0)

  // Insumos (matéria-prima) consumidos pela programação do dia: Σ tons × kg/ton.
  function insumosDoDia(data: string): { label: string; kg: number }[] {
    const acc: Record<string, { label: string; kg: number }> = {}
    for (const it of itensDoDia(data)) {
      const f = it.formula as Formula | undefined
      if (!f) continue
      for (const ing of INGREDIENTES) {
        const kgPorTon = calcularIngrediente(f, ing.key)
        if (kgPorTon > 0) {
          acc[ing.key] = { label: ing.label, kg: (acc[ing.key]?.kg ?? 0) + (it.tons ?? 0) * kgPorTon }
        }
      }
    }
    return Object.values(acc).sort((a, b) => b.kg - a.kg)
  }

  function irParaSemana(inicio: string) {
    router.push(`${ROUTES.PROGRAMACAO}?semana=${inicio}`)
  }

  function abrirNovo(data: string) {
    setForm({ ...FORM_VAZIO, data })
  }
  function abrirEdicao(it: Programacao) {
    setForm({
      id: it.id, data: it.data, cliente: it.cliente, formula_id: it.formula_id,
      quantidade: it.quantidade, embalagem: it.embalagem, observacao: it.observacao,
    })
  }

  async function salvar() {
    if (!form) return
    setSalvando(true)
    const payload = {
      data: form.data,
      cliente: form.cliente.trim(),
      formula_id: form.formula_id,
      quantidade: form.quantidade,
      embalagem: form.embalagem,
      observacao: form.observacao.trim(),
    }
    try {
      if (form.id) {
        const upd = await svc.atualizar(form.id, payload)
        setItens((prev) => prev.map((it) => (it.id === upd.id ? upd : it)))
      } else {
        const novo = await svc.criar(payload)
        setItens((prev) => [...prev, novo])
      }
      setForm(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(it: Programacao) {
    if (!window.confirm('Remover este item da programação?')) return
    try {
      await svc.deletar(it.id)
      setItens((prev) => prev.filter((x) => x.id !== it.id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover.')
    }
  }

  const tonsForm = form ? calcularTons(form.quantidade, form.embalagem) : 0

  return (
    <div className="flex flex-col gap-4">
      {/* Cabeçalho + navegação de semana */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-industrial-100">Programação de Carregamento</h1>
          <div className="flex items-center gap-1.5 mt-2">
            <button type="button" onClick={() => irParaSemana(addDiasIso(semanaInicio, -7))} aria-label="Semana anterior"
              className="rounded-lg border border-industrial-700 p-1.5 text-industrial-400 hover:text-industrial-100 hover:border-brand-500 transition-colors">
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-sm font-medium text-industrial-200 px-2">
              Semana de {ddmm(semanaInicio)} a {ddmm(addDiasIso(semanaInicio, 4))}
            </span>
            <button type="button" onClick={() => irParaSemana(addDiasIso(semanaInicio, 7))} aria-label="Próxima semana"
              className="rounded-lg border border-industrial-700 p-1.5 text-industrial-400 hover:text-industrial-100 hover:border-brand-500 transition-colors">
              <ChevronRight className="size-4" />
            </button>
          </div>
          {readOnly && (
            <p className="text-xs text-industrial-400 mt-1.5">Prévia (somente leitura) — quem programa é a Logística.</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!readOnly && (
            <Link
              href={ROUTES.ORDENS_RELATORIO}
              className="flex items-center gap-1.5 rounded-lg border border-industrial-700 px-3 py-2 text-xs font-medium text-industrial-200 hover:border-brand-500 hover:text-brand-700 transition-colors"
            >
              <Printer className="size-4" />
              Relatório do dia
            </Link>
          )}
          <div className="text-right">
            <p className="text-xs text-industrial-400">Total da semana</p>
            <p className="text-2xl font-bold text-brand-600">{totalSemana.toFixed(2)} <span className="text-sm font-normal text-industrial-400">ton</span></p>
          </div>
        </div>
      </div>

      {/* Grade da semana */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {dias.map(({ nome, data }) => {
          const ehAmanha = data === amanha
          const ehHoje = data === hoje
          const insumos = insumosDoDia(data)
          return (
            <div
              key={data}
              className={cn(
                'flex flex-col gap-2 rounded-xl border p-2.5',
                ehAmanha ? 'border-brand-500 bg-brand-50' : ehHoje ? 'border-industrial-500' : 'border-industrial-800',
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-industrial-100">{nome}</p>
                  <p className="text-xs text-industrial-400">
                    {ddmm(data)}{ehAmanha && <span className="ml-1 text-brand-700 font-semibold">· amanhã</span>}{ehHoje && <span className="ml-1 text-industrial-500 font-semibold">· hoje</span>}
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-brand-700">{totalDia(data).toFixed(2)}</span>
              </div>

              <div className="flex flex-col gap-2">
                {itensDoDia(data).map((it) => (
                  <div key={it.id} className="rounded-lg border border-industrial-700 bg-industrial-900 p-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-industrial-100 text-sm leading-tight">
                        {it.cliente || <span className="text-industrial-500 font-normal">Sem cliente</span>}
                      </span>
                      {!readOnly && (
                        <div className="flex gap-1 shrink-0">
                          <button type="button" onClick={() => abrirEdicao(it)} title="Editar"
                            className="text-industrial-400 hover:text-brand-700"><Pencil className="size-3.5" /></button>
                          <button type="button" onClick={() => excluir(it)} title="Remover"
                            className="text-industrial-400 hover:text-red-600"><Trash2 className="size-3.5" /></button>
                        </div>
                      )}
                    </div>
                    {it.formula?.nome && <p className="text-xs font-medium text-brand-700 mt-0.5">{it.formula.nome}</p>}
                    <p className="text-xs text-industrial-500 mt-0.5">
                      {it.quantidade} {EMBALAGEM_LABEL[it.embalagem]} · <span className="font-bold text-industrial-300">{(it.tons ?? 0).toFixed(2)} ton</span>
                    </p>
                    {it.observacao && <p className="text-xs text-industrial-400 italic mt-0.5">{it.observacao}</p>}
                  </div>
                ))}

                {itensDoDia(data).length === 0 && (
                  <p className="text-xs text-industrial-500 text-center py-2">—</p>
                )}

                {!readOnly && (
                  <button type="button" onClick={() => abrirNovo(data)}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-industrial-600 py-1.5 text-xs font-medium text-industrial-400 hover:border-brand-500 hover:text-brand-700 transition-colors">
                    <Plus className="size-3.5" /> Adicionar
                  </button>
                )}
              </div>

              {insumos.length > 0 && (
                <div className="rounded-lg bg-industrial-950 border border-industrial-700 p-2 mt-auto">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-industrial-400 mb-1.5">Insumos do dia</p>
                  <div className="flex flex-col gap-1">
                    {insumos.map((m) => (
                      <div key={m.label} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-industrial-400 truncate">{m.label}</span>
                        <span className="font-mono font-bold text-industrial-100 shrink-0">
                          {m.kg.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal de cadastro/edição */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setForm(null)}>
          <div className="w-full max-w-md rounded-xl bg-industrial-900 border border-industrial-700 p-5 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-industrial-100">
                {form.id ? 'Editar item' : 'Novo item'} · {ddmm(form.data)}
              </h2>
              <button type="button" onClick={() => setForm(null)} className="text-industrial-400 hover:text-industrial-100"><X className="size-5" /></button>
            </div>

            <label className="text-xs font-medium text-industrial-400">Cliente
              <input value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })}
                className="mt-1 w-full bg-industrial-950 border border-industrial-600 rounded-lg px-3 py-2 text-sm text-industrial-100 focus:outline-none focus:border-brand-500" />
            </label>

            <div className="text-xs font-medium text-industrial-400">Fórmula
              <div className="mt-1"><FormulaPicker value={form.formula_id} formulas={formulas} onChange={(id) => setForm({ ...form, formula_id: id })} /></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-medium text-industrial-400">Quantidade
                <input type="number" value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: Number(e.target.value) || 0 })}
                  className="mt-1 w-full bg-industrial-950 border border-industrial-600 rounded-lg px-3 py-2 text-sm text-industrial-100 focus:outline-none focus:border-brand-500" />
              </label>
              <label className="text-xs font-medium text-industrial-400">Embalagem
                <select value={form.embalagem} onChange={(e) => setForm({ ...form, embalagem: e.target.value as Embalagem })}
                  className="mt-1 w-full bg-industrial-950 border border-industrial-600 rounded-lg px-3 py-2 text-sm text-industrial-100 focus:outline-none focus:border-brand-500">
                  {EMBALAGEM_OPCOES.map((opt) => <option key={opt} value={opt}>{EMBALAGEM_LABEL[opt]}</option>)}
                </select>
              </label>
            </div>

            <label className="text-xs font-medium text-industrial-400">Observação / nº do pedido
              <input value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                placeholder="ex.: PEDIDO 26092"
                className="mt-1 w-full bg-industrial-950 border border-industrial-600 rounded-lg px-3 py-2 text-sm text-industrial-100 placeholder-industrial-500 focus:outline-none focus:border-brand-500" />
            </label>

            <div className="flex items-center justify-between pt-1">
              <span className="text-sm text-industrial-400">Total: <span className="font-bold text-brand-700">{tonsForm.toFixed(2)} ton</span></span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setForm(null)}
                  className="rounded-lg border border-industrial-600 px-4 py-2 text-sm font-medium text-industrial-300 hover:bg-industrial-800">Cancelar</button>
                <button type="button" onClick={salvar} disabled={salvando}
                  className="rounded-lg bg-brand-700 hover:bg-brand-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50">
                  {salvando ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
