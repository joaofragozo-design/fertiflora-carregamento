'use client'

import { useState, useTransition, useMemo, useRef, useEffect } from 'react'
import { Plus, Trash2, ChevronDown, Check } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { OrdensDiariasService } from '@/services/ordens-diarias.service'
import type { AppUser } from '@/types'
import type { OrdemDiaria, Formula, Embalagem, StatusOrdem } from '@/types/formula'
import { INGREDIENTES, calcularIngrediente, calcularTons, getStatus } from '@/types/formula'
import { cn } from '@/lib/utils/cn'

interface OrdensParneProps {
  initialOrdens:    OrdemDiaria[]
  initialFormulas:  { id: number; nome: string }[]
  user:             AppUser
  hoje:             string
}

const STATUS_STYLES: Record<StatusOrdem, string> = {
  AGUARDANDO:   'bg-industrial-700 text-industrial-100',
  EM_ANDAMENTO: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
  FINALIZADO:   'bg-brand-600/25 text-brand-200 border border-brand-600/40',
}

const STATUS_LABEL: Record<StatusOrdem, string> = {
  AGUARDANDO:   'Aguardando',
  EM_ANDAMENTO: 'Em andamento',
  FINALIZADO:   'Finalizado',
}

/** Formata kg/ton sem zeros à toa: 408.0 → "408", 30.9 → "30.9". */
function fmtKg(n: number): string {
  return n.toFixed(1).replace(/\.0$/, '')
}

function FormulaCombobox({
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
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = formulas.find((f) => f.id === value)

  const filtered = useMemo(() => {
    if (!query) return formulas.slice(0, 30)
    const q = query.toLowerCase()
    return formulas.filter((f) => f.nome.toLowerCase().includes(q)).slice(0, 30)
  }, [formulas, query])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative min-w-[190px]">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o)
          setTimeout(() => inputRef.current?.focus(), 50)
        }}
        className={cn(
          'w-full flex items-center justify-between gap-1 px-2 py-1 rounded text-xs',
          'bg-industrial-800 border border-industrial-600 text-left text-industrial-100',
          'hover:border-brand-600 focus:outline-none focus:border-brand-500',
        )}
      >
        <span className={cn('truncate', !selected && 'text-industrial-500')}>
          {selected?.nome ?? 'Selecionar fórmula…'}
        </span>
        <ChevronDown className="size-3 shrink-0 text-industrial-400" />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 w-72 bg-industrial-900 border border-industrial-600 rounded shadow-lg">
          <div className="p-1.5 border-b border-industrial-700">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar fórmula..."
              className="w-full bg-industrial-800 text-xs text-industrial-100 placeholder-industrial-500
                         px-2 py-1 rounded border border-industrial-600 focus:outline-none focus:border-brand-500"
            />
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            <li>
              <button
                type="button"
                onClick={() => { onChange(null); setOpen(false); setQuery('') }}
                className="w-full text-left text-xs px-3 py-1.5 text-industrial-400 hover:bg-industrial-800"
              >
                — Nenhuma —
              </button>
            </li>
            {filtered.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => { onChange(f.id); setOpen(false); setQuery('') }}
                  className={cn(
                    'w-full text-left text-xs px-3 py-1.5 truncate',
                    'hover:bg-industrial-800',
                    f.id === value ? 'text-brand-400 font-medium' : 'text-industrial-100',
                  )}
                >
                  {f.nome}
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="text-xs text-industrial-500 px-3 py-2">Nenhuma fórmula encontrada.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

function InlineInput({
  value,
  onChange,
  onBlur,
  type = 'text',
  className,
}: {
  value: string | number
  onChange: (v: string) => void
  onBlur?: () => void
  type?: 'text' | 'number'
  className?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      className={cn(
        'bg-transparent border-b border-industrial-700 hover:border-industrial-500 focus:border-brand-500',
        'focus:outline-none text-xs text-industrial-100 py-0.5 px-1 w-full',
        className,
      )}
    />
  )
}

/** Indicador de checkbox somente-leitura (para quem não pode marcar). */
function StatusReadOnly({ on }: { on: boolean }) {
  return on
    ? <Check className="size-4 text-brand-400 mx-auto" />
    : <span className="inline-block size-3.5 rounded-sm border border-industrial-600 mx-auto" />
}

type EditableOrdem = OrdemDiaria & { _dirty?: boolean; _saving?: boolean }

export function OrdensParnel({ initialOrdens, initialFormulas, user, hoje }: OrdensParneProps) {
  const [ordens, setOrdens] = useState<EditableOrdem[]>(initialOrdens)
  const [isPending, startTransition] = useTransition()
  const svc = useMemo(() => new OrdensDiariasService(createClient()), [])

  // logistica   → edita os dados (cliente, placa, etc.), NÃO marca status
  // logistica_02 → SÓ marca Iniciado/Finalizado
  // admin        → faz tudo
  const podeEditarDados  = user.role === 'admin' || user.role === 'logistica'
  const podeMarcarStatus = user.role === 'admin' || user.role === 'logistica_02'

  const totalTons = useMemo(
    () => ordens.reduce((acc, o) => acc + (o.tons ?? 0), 0),
    [ordens],
  )

  function updateLocal(id: string, patch: Partial<EditableOrdem>) {
    setOrdens((prev) =>
      prev.map((o) => (o.id === id ? { ...o, ...patch, _dirty: true } : o)),
    )
  }

  async function saveField(id: string, patch: Partial<OrdemDiaria>) {
    setOrdens((prev) =>
      prev.map((o) => (o.id === id ? { ...o, _saving: true, _dirty: false } : o)),
    )
    try {
      const updated = await svc.atualizar(id, patch)
      setOrdens((prev) =>
        prev.map((o) => (o.id === id ? { ...updated, _saving: false } : o)),
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar.')
      setOrdens((prev) =>
        prev.map((o) => (o.id === id ? { ...o, _saving: false, _dirty: true } : o)),
      )
    }
  }

  async function handleAddRow() {
    startTransition(async () => {
      try {
        const nova = await svc.criar({
          data:       hoje,
          cliente:    '',
          placa:      '',
          envelopar:  false,
          quantidade: 0,
          embalagem:  'SACOS',
          formula_id: null,
          iniciado:   false,
          finalizado: false,
        })
        setOrdens((prev) => [...prev, nova])
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erro ao adicionar ordem.')
      }
    })
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Remover esta ordem?')) return
    try {
      await svc.deletar(id)
      setOrdens((prev) => prev.filter((o) => o.id !== id))
      toast.success('Ordem removida.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover.')
    }
  }

  async function handleToggleIniciado(ordem: EditableOrdem) {
    if (!podeMarcarStatus || ordem.finalizado) return
    const next = !ordem.iniciado
    updateLocal(ordem.id, { iniciado: next })
    await saveField(ordem.id, { iniciado: next })
  }

  async function handleToggleFinalizado(ordem: EditableOrdem) {
    if (!podeMarcarStatus) return
    const next = !ordem.finalizado
    updateLocal(ordem.id, { finalizado: next, iniciado: next ? true : ordem.iniciado })
    await saveField(ordem.id, { finalizado: next, iniciado: next ? true : ordem.iniciado })
  }

  function handleBlurText(id: string, field: keyof OrdemDiaria, localValue: string) {
    const ordem = ordens.find((o) => o.id === id)
    if (!ordem || !ordem._dirty) return
    saveField(id, { [field]: localValue })
  }

  async function handleFormula(id: string, formulaId: number | null) {
    updateLocal(id, { formula_id: formulaId })
    const full = initialFormulas.find((f) => f.id === formulaId)
    await saveField(id, { formula_id: formulaId })
    if (full) toast.success(`Fórmula: ${full.nome}`)
  }

  async function handleEmbalagem(id: string, emb: Embalagem) {
    updateLocal(id, { embalagem: emb })
    await saveField(id, { embalagem: emb })
  }

  async function handleEnvelopar(id: string, val: boolean) {
    updateLocal(id, { envelopar: val })
    await saveField(id, { envelopar: val })
  }

  const thCls = 'px-2 py-2 text-[10px] uppercase tracking-wider text-industrial-300 font-semibold whitespace-nowrap border-b border-industrial-700 bg-industrial-900'
  const tdCls = 'px-2 py-1.5 border-b border-industrial-800 align-middle'
  const COLUNAS = 12 + (podeEditarDados ? 1 : 0)

  return (
    <div className="flex flex-col gap-4">
      {/* Cabeçalho */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-industrial-50">Ordens Diárias de Carregamento</h1>
          <p className="text-xs text-industrial-300 mt-0.5 capitalize">
            {new Date(hoje + 'T12:00:00').toLocaleDateString('pt-BR', {
              weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
            })}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-industrial-300">Total do dia</p>
          <p className="text-2xl font-bold text-brand-400">
            {totalTons.toFixed(2)} <span className="text-sm font-normal text-industrial-300">ton</span>
          </p>
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-lg border border-industrial-700">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className={cn(thCls, 'text-center w-8')}>#</th>
              <th className={cn(thCls, 'text-left min-w-[130px]')}>Cliente</th>
              <th className={cn(thCls, 'text-center w-24')}>Status</th>
              <th className={cn(thCls, 'text-center w-16')}>Iniciado</th>
              <th className={cn(thCls, 'text-center w-20')}>Finalizado</th>
              <th className={cn(thCls, 'text-left min-w-[100px]')}>Placa</th>
              <th className={cn(thCls, 'text-center w-20')}>Envelopar</th>
              <th className={cn(thCls, 'text-right w-16')}>Quant.</th>
              <th className={cn(thCls, 'text-center w-24')}>Embalagem</th>
              <th className={cn(thCls, 'text-right w-16')}>Tons</th>
              <th className={cn(thCls, 'text-left min-w-[200px]')}>Fórmula</th>
              <th className={cn(thCls, 'text-left min-w-[280px]')}>Ingredientes (kg/ton)</th>
              {podeEditarDados && <th className={cn(thCls, 'w-8')} />}
            </tr>
          </thead>
          <tbody>
            {ordens.map((ordem) => {
              const status = getStatus(ordem)
              const editarDados = podeEditarDados && !ordem.finalizado
              const tons = calcularTons(ordem.quantidade, ordem.embalagem)

              const formula = ordem.formula as Formula | null | undefined
              const usados = formula
                ? INGREDIENTES
                    .map((ing) => ({ ing, kg: calcularIngrediente(formula, ing.key) }))
                    .filter((x) => x.kg > 0)
                : []
              const verificacao = formula
                ? +usados.reduce((s, x) => s + x.kg, 0).toFixed(1)
                : null
              const verifOk = verificacao !== null && Math.abs(verificacao - 1000) < 0.5

              return (
                <tr
                  key={ordem.id}
                  className={cn(
                    'transition-colors',
                    status === 'FINALIZADO'   ? 'bg-brand-950/30'
                      : status === 'EM_ANDAMENTO' ? 'bg-amber-950/20'
                      : 'hover:bg-industrial-800/40',
                    ordem._saving && 'opacity-70',
                  )}
                >
                  {/* Sequência */}
                  <td className={cn(tdCls, 'text-center text-industrial-400 font-mono')}>{ordem.sequencia}</td>

                  {/* Cliente */}
                  <td className={tdCls}>
                    {editarDados ? (
                      <InlineInput
                        value={ordem.cliente}
                        onChange={(v) => updateLocal(ordem.id, { cliente: v })}
                        onBlur={() => handleBlurText(ordem.id, 'cliente', ordem.cliente)}
                      />
                    ) : (
                      <span className="text-industrial-100">
                        {ordem.cliente || <span className="text-industrial-600">—</span>}
                      </span>
                    )}
                  </td>

                  {/* Status */}
                  <td className={cn(tdCls, 'text-center')}>
                    <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-semibold', STATUS_STYLES[status])}>
                      {STATUS_LABEL[status]}
                    </span>
                  </td>

                  {/* Iniciado */}
                  <td className={cn(tdCls, 'text-center')}>
                    {podeMarcarStatus && !ordem.finalizado ? (
                      <input
                        type="checkbox"
                        checked={ordem.iniciado}
                        onChange={() => handleToggleIniciado(ordem)}
                        className="size-4 accent-brand-500 cursor-pointer"
                      />
                    ) : (
                      <StatusReadOnly on={ordem.iniciado} />
                    )}
                  </td>

                  {/* Finalizado */}
                  <td className={cn(tdCls, 'text-center')}>
                    {podeMarcarStatus ? (
                      <input
                        type="checkbox"
                        checked={ordem.finalizado}
                        onChange={() => handleToggleFinalizado(ordem)}
                        className="size-4 accent-brand-500 cursor-pointer"
                      />
                    ) : (
                      <StatusReadOnly on={ordem.finalizado} />
                    )}
                  </td>

                  {/* Placa */}
                  <td className={tdCls}>
                    {editarDados ? (
                      <InlineInput
                        value={ordem.placa}
                        onChange={(v) => updateLocal(ordem.id, { placa: v.toUpperCase() })}
                        onBlur={() => handleBlurText(ordem.id, 'placa', ordem.placa)}
                        className="uppercase tracking-widest font-mono"
                      />
                    ) : (
                      <span className="text-industrial-100 uppercase tracking-widest font-mono">
                        {ordem.placa || <span className="text-industrial-600 tracking-normal">—</span>}
                      </span>
                    )}
                  </td>

                  {/* Envelopar */}
                  <td className={cn(tdCls, 'text-center')}>
                    {editarDados ? (
                      <button
                        type="button"
                        onClick={() => handleEnvelopar(ordem.id, !ordem.envelopar)}
                        className={cn(
                          'px-2 py-0.5 rounded text-[10px] font-bold border transition-colors',
                          ordem.envelopar
                            ? 'bg-brand-700/40 border-brand-600 text-brand-200'
                            : 'bg-industrial-800 border-industrial-600 text-industrial-300',
                        )}
                      >
                        {ordem.envelopar ? 'SIM' : 'NÃO'}
                      </button>
                    ) : (
                      <span className={cn('text-[10px] font-bold', ordem.envelopar ? 'text-brand-300' : 'text-industrial-400')}>
                        {ordem.envelopar ? 'SIM' : 'NÃO'}
                      </span>
                    )}
                  </td>

                  {/* Quantidade */}
                  <td className={cn(tdCls, 'text-right')}>
                    {editarDados ? (
                      <InlineInput
                        type="number"
                        value={ordem.quantidade}
                        onChange={(v) => updateLocal(ordem.id, { quantidade: Number(v) || 0 })}
                        onBlur={() => { if (ordem._dirty) saveField(ordem.id, { quantidade: ordem.quantidade }) }}
                        className="text-right"
                      />
                    ) : (
                      <span className="text-industrial-100 font-mono">{ordem.quantidade}</span>
                    )}
                  </td>

                  {/* Embalagem */}
                  <td className={cn(tdCls, 'text-center')}>
                    {editarDados ? (
                      <select
                        value={ordem.embalagem}
                        onChange={(e) => handleEmbalagem(ordem.id, e.target.value as Embalagem)}
                        className="bg-industrial-800 border border-industrial-600 rounded px-1 py-0.5 text-xs text-industrial-100 focus:outline-none focus:border-brand-500"
                      >
                        <option value="SACOS">SACOS</option>
                        <option value="BAGS">BAGS</option>
                      </select>
                    ) : (
                      <span className="text-industrial-100">{ordem.embalagem}</span>
                    )}
                  </td>

                  {/* Tons */}
                  <td className={cn(tdCls, 'text-right font-mono text-brand-400 font-semibold')}>
                    {tons.toFixed(2)}
                  </td>

                  {/* Fórmula */}
                  <td className={tdCls}>
                    {editarDados ? (
                      <FormulaCombobox
                        value={ordem.formula_id}
                        formulas={initialFormulas}
                        onChange={(id) => handleFormula(ordem.id, id)}
                      />
                    ) : (
                      <span className="text-industrial-100">
                        {formula?.nome ?? <span className="text-industrial-600">—</span>}
                      </span>
                    )}
                  </td>

                  {/* Ingredientes — só os usados (valor > 0) */}
                  <td className={tdCls}>
                    {formula ? (
                      <div className="flex flex-wrap items-center gap-1">
                        {usados.map(({ ing, kg }) => (
                          <span
                            key={ing.key}
                            className="inline-flex items-center gap-1 rounded bg-industrial-800 border border-industrial-700 px-1.5 py-0.5"
                          >
                            <span className="text-[10px] text-industrial-400">{ing.label}</span>
                            <span className="text-[10px] font-mono font-semibold text-industrial-100">{fmtKg(kg)}</span>
                          </span>
                        ))}
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold border',
                            verifOk
                              ? 'bg-brand-900/40 border-brand-700 text-brand-300'
                              : 'bg-red-950/50 border-red-800 text-red-300',
                          )}
                          title="Soma total (deve fechar 1000)"
                        >
                          Σ {verificacao?.toFixed(0)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-industrial-600">Selecione uma fórmula</span>
                    )}
                  </td>

                  {/* Excluir */}
                  {podeEditarDados && (
                    <td className={cn(tdCls, 'text-center')}>
                      <button
                        type="button"
                        onClick={() => handleDelete(ordem.id)}
                        className="text-industrial-500 hover:text-red-400 transition-colors p-0.5 rounded"
                        title="Remover ordem"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}

            {ordens.length === 0 && (
              <tr>
                <td colSpan={COLUNAS} className="text-center py-12 text-industrial-400">
                  {podeEditarDados
                    ? 'Nenhuma ordem para hoje. Clique em “Adicionar linha” para começar.'
                    : 'Nenhuma ordem para hoje ainda.'}
                </td>
              </tr>
            )}
          </tbody>

          {ordens.length > 0 && (
            <tfoot>
              <tr className="bg-industrial-900">
                <td colSpan={9} className="px-2 py-2 text-xs text-industrial-300 text-right font-semibold">
                  Total do dia:
                </td>
                <td className="px-2 py-2 text-right font-mono font-bold text-brand-400">
                  {totalTons.toFixed(2)}
                </td>
                <td colSpan={COLUNAS - 10} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Adicionar linha */}
      {podeEditarDados && (
        <button
          type="button"
          onClick={handleAddRow}
          disabled={isPending}
          className={cn(
            'self-start flex items-center gap-2 px-4 py-2 rounded-lg',
            'bg-brand-700 hover:bg-brand-600 text-white text-sm font-medium',
            'transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          <Plus className="size-4" />
          Adicionar linha
        </button>
      )}
    </div>
  )
}
