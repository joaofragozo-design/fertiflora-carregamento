'use client'

import { useState, useTransition, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { Plus, Trash2, ChevronDown, Check, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { OrdensDiariasService } from '@/services/ordens-diarias.service'
import { useOrdensDiarias, type EditableOrdem } from '@/hooks/use-ordens-diarias'
import { ROUTES } from '@/constants/routes'
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

// Badge de status (tema claro: fundo claro + texto escuro).
const STATUS_STYLES: Record<StatusOrdem, string> = {
  AGUARDANDO:   'bg-industrial-800 text-industrial-100',
  EM_ANDAMENTO: 'bg-amber-100 text-amber-800 border border-amber-400',
  FINALIZADO:   'bg-brand-100 text-brand-800 border border-brand-500',
}

// Fundo da LINHA inteira por status — bem visível, com texto escuro legível.
const ROW_STYLES: Record<StatusOrdem, string> = {
  AGUARDANDO:   'hover:bg-industrial-800/60',
  EM_ANDAMENTO: 'bg-amber-200',
  FINALIZADO:   'bg-brand-200',
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
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = formulas.find((f) => f.id === value)

  const filtered = useMemo(() => {
    if (!query) return formulas.slice(0, 50)
    const q = query.toLowerCase()
    return formulas.filter((f) => f.nome.toLowerCase().includes(q)).slice(0, 50)
  }, [formulas, query])

  function fechar() {
    setOpen(false)
    setQuery('')
  }

  function abrir() {
    const r = btnRef.current?.getBoundingClientRect()
    if (r) setPos({ left: r.left, top: r.bottom + 4, width: Math.max(r.width, 340) })
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
    // Fecha ao rolar/redimensionar para não desalinhar o popup fixo do botão.
    const onReposition = () => fechar()
    document.addEventListener('mousedown', onDocClick)
    window.addEventListener('scroll', onReposition, true)
    window.addEventListener('resize', onReposition)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      window.removeEventListener('scroll', onReposition, true)
      window.removeEventListener('resize', onReposition)
    }
  }, [open])

  return (
    <div className="relative min-w-[190px]">
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
        <span className={cn('truncate font-medium', !selected && 'text-industrial-500 font-normal')}>
          {selected?.nome ?? 'Selecionar fórmula…'}
        </span>
        <ChevronDown className="size-3 shrink-0 text-industrial-400" />
      </button>

      {/* Popup em portal: posição fixa, ocupa o espaço disponível até o rodapé
          da tela. Evita o recorte vertical causado pelo overflow-x-auto da tabela. */}
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
              placeholder="Buscar fórmula..."
              className="w-full bg-industrial-950 text-xs text-industrial-100 placeholder-industrial-500
                         px-2 py-1.5 rounded border border-industrial-600 focus:outline-none focus:border-brand-500"
            />
          </div>
          <ul className="overflow-y-auto py-1">
            <li>
              <button
                type="button"
                onClick={() => { onChange(null); fechar() }}
                className="w-full text-left text-xs px-3 py-2 text-industrial-400 hover:bg-industrial-800"
              >
                — Nenhuma —
              </button>
            </li>
            {filtered.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => { onChange(f.id); fechar() }}
                  className={cn(
                    'w-full text-left text-xs px-3 py-2 truncate hover:bg-industrial-800',
                    f.id === value ? 'text-brand-700 font-semibold' : 'text-industrial-100',
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
        </div>,
        document.body,
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
        'bg-transparent border-b border-industrial-600 hover:border-industrial-400 focus:border-brand-500',
        'focus:outline-none text-xs text-industrial-100 py-0.5 px-1 w-full',
        className,
      )}
    />
  )
}

/** Indicador de checkbox somente-leitura (para quem não pode marcar). */
function StatusReadOnly({ on }: { on: boolean }) {
  return on
    ? <Check className="size-4 text-brand-700 mx-auto" strokeWidth={3} />
    : <span className="inline-block size-3.5 rounded-sm border-2 border-industrial-500 mx-auto" />
}

export function OrdensParnel({ initialOrdens, initialFormulas, user, hoje }: OrdensParneProps) {
  const { ordens, setOrdens } = useOrdensDiarias(initialOrdens, hoje)
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
        setOrdens((prev) =>
          prev.some((o) => o.id === nova.id) ? prev : [...prev, nova],
        )
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

  const thCls = 'px-2 py-1.5 text-[10px] uppercase tracking-wider text-industrial-400 font-semibold whitespace-nowrap border-b border-industrial-700 bg-industrial-900'
  const tdCls = 'px-2 py-1 border-b border-industrial-800 align-middle'
  const COLUNAS = 12 + (podeEditarDados ? 1 : 0)

  return (
    <div className="flex flex-col gap-3">
      {/* Cabeçalho */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-industrial-100">Ordens Diárias de Carregamento</h1>
          <p className="text-xs text-industrial-400 mt-0.5 capitalize">
            {new Date(hoje + 'T12:00:00').toLocaleDateString('pt-BR', {
              weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
            })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={ROUTES.ORDENS_RELATORIO}
            className="flex items-center gap-1.5 rounded-lg border border-industrial-700 px-3 py-2 text-xs font-medium text-industrial-200 hover:border-brand-500 hover:text-brand-700 transition-colors"
          >
            <Printer className="size-4" />
            Relatório do dia
          </Link>
          <div className="text-right">
            <p className="text-xs text-industrial-400">Total do dia</p>
            <p className="text-2xl font-bold text-brand-600">
              {totalTons.toFixed(2)} <span className="text-sm font-normal text-industrial-400">ton</span>
            </p>
          </div>
        </div>
      </div>

      {/* Tabela (sem borda externa, aproveitando o espaço) */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className={cn(thCls, 'text-center w-8')}>#</th>
              <th className={cn(thCls, 'text-left min-w-[130px]')}>Cliente</th>
              <th className={cn(thCls, 'text-center w-24')}>Status</th>
              <th className={cn(thCls, 'text-center w-16')}>Iniciado</th>
              <th className={cn(thCls, 'text-center w-20')}>Finalizado</th>
              <th className={cn(thCls, 'text-left w-20')}>Placa</th>
              <th className={cn(thCls, 'text-center w-20')}>Envelopar</th>
              <th className={cn(thCls, 'text-right w-24')}>Quant.</th>
              <th className={cn(thCls, 'text-center w-24')}>Embalagem</th>
              <th className={cn(thCls, 'text-right w-16')}>Tons</th>
              <th className={cn(thCls, 'text-left min-w-[210px]')}>Fórmula</th>
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
                  className={cn('transition-colors', ROW_STYLES[status], ordem._saving && 'opacity-80')}
                >
                  {/* Sequência */}
                  <td className={cn(tdCls, 'text-center text-industrial-500 font-mono')}>{ordem.sequencia}</td>

                  {/* Cliente */}
                  <td className={tdCls}>
                    {editarDados ? (
                      <InlineInput
                        value={ordem.cliente}
                        onChange={(v) => updateLocal(ordem.id, { cliente: v })}
                        onBlur={() => handleBlurText(ordem.id, 'cliente', ordem.cliente)}
                      />
                    ) : (
                      <span className="text-industrial-100 font-medium">
                        {ordem.cliente || <span className="text-industrial-500 font-normal">—</span>}
                      </span>
                    )}
                  </td>

                  {/* Status */}
                  <td className={cn(tdCls, 'text-center')}>
                    <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold', STATUS_STYLES[status])}>
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
                        className="size-5 accent-brand-600 cursor-pointer"
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
                        className="size-5 accent-brand-600 cursor-pointer"
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
                        className="uppercase font-mono"
                      />
                    ) : (
                      <span className="text-industrial-100 uppercase font-mono font-medium">
                        {ordem.placa || <span className="text-industrial-500 font-normal normal-case">—</span>}
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
                            ? 'bg-brand-100 border-brand-500 text-brand-800'
                            : 'bg-industrial-900 border-industrial-600 text-industrial-500',
                        )}
                      >
                        {ordem.envelopar ? 'SIM' : 'NÃO'}
                      </button>
                    ) : (
                      <span className={cn('text-[11px] font-bold', ordem.envelopar ? 'text-brand-700' : 'text-industrial-500')}>
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
                      <span className="text-industrial-100 font-mono font-medium">{ordem.quantidade}</span>
                    )}
                  </td>

                  {/* Embalagem */}
                  <td className={cn(tdCls, 'text-center')}>
                    {editarDados ? (
                      <select
                        value={ordem.embalagem}
                        onChange={(e) => handleEmbalagem(ordem.id, e.target.value as Embalagem)}
                        className="bg-industrial-900 border border-industrial-600 rounded px-1 py-0.5 text-xs text-industrial-100 focus:outline-none focus:border-brand-500"
                      >
                        <option value="SACOS">SACOS</option>
                        <option value="BAGS">BAGS</option>
                      </select>
                    ) : (
                      <span className="text-industrial-100 font-medium">{ordem.embalagem}</span>
                    )}
                  </td>

                  {/* Tons */}
                  <td className={cn(tdCls, 'text-right font-mono text-brand-700 font-bold')}>
                    {tons.toFixed(2)}
                  </td>

                  {/* Fórmula — destacada para quem só visualiza (logística_02) */}
                  <td className={tdCls}>
                    {editarDados ? (
                      <FormulaCombobox
                        value={ordem.formula_id}
                        formulas={initialFormulas}
                        onChange={(id) => handleFormula(ordem.id, id)}
                      />
                    ) : (
                      <span className="text-[13px] font-bold text-industrial-50">
                        {formula?.nome ?? <span className="text-industrial-500 text-xs font-normal">—</span>}
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
                            className="inline-flex items-center gap-1 rounded bg-industrial-900 border border-industrial-700 px-1.5 py-0.5"
                          >
                            <span className="text-[10px] text-industrial-400">{ing.label}</span>
                            <span className="text-[10px] font-mono font-bold text-industrial-100">{fmtKg(kg)}</span>
                          </span>
                        ))}
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold border',
                            verifOk
                              ? 'bg-brand-100 border-brand-500 text-brand-800'
                              : 'bg-red-100 border-red-400 text-red-700',
                          )}
                          title="Soma total (deve fechar 1000)"
                        >
                          Σ {verificacao?.toFixed(0)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-industrial-500">Selecione uma fórmula</span>
                    )}
                  </td>

                  {/* Excluir */}
                  {podeEditarDados && (
                    <td className={cn(tdCls, 'text-center')}>
                      <button
                        type="button"
                        onClick={() => handleDelete(ordem.id)}
                        className="text-industrial-500 hover:text-red-600 transition-colors p-0.5 rounded"
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
                <td className="px-2 py-2 text-right font-mono font-bold text-brand-700">
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
