'use client'

import { useState, useTransition, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Plus, Trash2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Check, Printer, GripVertical,
  Scale, Clock3, Truck, CheckCircle2, Play, Tag, Timer, PackageOpen, type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { OrdensDiariasService } from '@/services/ordens-diarias.service'
import { useOrdensDiarias, type EditableOrdem } from '@/hooks/use-ordens-diarias'
import { useClientes } from '@/hooks/use-clientes'
import { ClientePicker } from '@/components/clientes/cliente-picker'
import { ROUTES } from '@/constants/routes'
import type { AppUser } from '@/types'
import type { OrdemDiaria, OrdemItem, Formula, Embalagem, StatusOrdem } from '@/types/formula'
import type { Cliente } from '@/types/cliente'
import { MATERIAS_PRIMA, EMBALAGEM_LABEL, EMBALAGEM_OPCOES, calcularMateriaPrima, labelMateriaPrima, calcularTons, tonsDaOrdem, getStatus, formatDuracao } from '@/types/formula'
import { cn } from '@/lib/utils/cn'

interface OrdensParneProps {
  initialOrdens:    OrdemDiaria[]
  initialFormulas:  { id: number; nome: string }[]
  initialClientes:  Cliente[]
  user:             AppUser
  hoje:             string
}

// Pills de status (tema claro): fundo sólido + texto escuro do mesmo tom.
// EM_ANDAMENTO usa `info` (neutro/informativo), não `warning` — amber fica
// reservado só pra estados que pedem atenção (ex.: estoque baixo), senão o
// mesmo amarelo significaria coisas diferentes em telas diferentes.
const STATUS_STYLES: Record<StatusOrdem, string> = {
  AGUARDANDO:   'bg-industrial-200 text-industrial-900',
  EM_ANDAMENTO: 'bg-info-500 text-white',
  FINALIZADO:   'bg-brand-700 text-white',
}

// Tinta suave da linha por status (close-up do Fransua — discreto e limpo).
const ROW_STYLES: Record<StatusOrdem, string> = {
  AGUARDANDO:   'hover:bg-industrial-200/50',
  EM_ANDAMENTO: 'bg-info-500/10',
  FINALIZADO:   'bg-brand-500/15',
}

const STATUS_LABEL: Record<StatusOrdem, string> = {
  AGUARDANDO:   'Aguardando',
  EM_ANDAMENTO: 'Em andamento',
  FINALIZADO:   'Finalizado',
}

// Ícone da pílula de status e barra de acento na borda esquerda da linha —
// o status se lê pela cor E pela forma, não só pela cor.
const STATUS_ICON: Record<StatusOrdem, LucideIcon> = {
  AGUARDANDO:   Clock3,
  EM_ANDAMENTO: Truck,
  FINALIZADO:   CheckCircle2,
}
const STATUS_ACCENT: Record<StatusOrdem, string> = {
  AGUARDANDO:   'border-l-industrial-400',
  EM_ANDAMENTO: 'border-l-info-500',
  FINALIZADO:   'border-l-brand-500',
}

/** Placa como chapa: mono, caixa alta, borda — lê de longe na tela e casa com a Ficha da portaria. */
function PlacaChip({ placa }: { placa: string }) {
  if (!placa) return <span className="text-industrial-500">—</span>
  return (
    <span className="inline-flex items-center rounded-md border border-industrial-400 bg-industrial-50 px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-industrial-900">
      {placa}
    </span>
  )
}

function fmtKg(n: number): string {
  return n.toFixed(1).replace(/\.0$/, '')
}

/** Soma/subtrai dias de uma data 'YYYY-MM-DD' sem cair em armadilha de fuso. */
function shiftData(iso: string, dias: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + dias)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
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

  return (
    <div className="relative min-w-[190px]">
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? fechar() : abrir())}
        className={cn(
          'w-full flex items-center justify-between gap-1 px-2 py-1 rounded text-xs',
          'bg-industrial-100 border border-industrial-400 text-left text-industrial-900',
          'hover:border-brand-600 focus:outline-none focus:border-brand-500',
        )}
      >
        <span className={cn('truncate font-medium', !selected && 'text-industrial-500 font-normal')}>
          {selected?.nome ?? 'Selecionar fórmula…'}
        </span>
        <ChevronDown className="size-3 shrink-0 text-industrial-600" />
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
          className="z-[100] flex flex-col bg-industrial-100 border border-industrial-400 rounded shadow-industrial overflow-hidden"
        >
          <div className="p-1.5 border-b border-industrial-300 shrink-0">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar fórmula..."
              className="w-full bg-industrial-50 text-xs text-industrial-900 placeholder-industrial-500
                         px-2 py-1.5 rounded border border-industrial-400 focus:outline-none focus:border-brand-500"
            />
          </div>
          <ul className="overflow-y-auto py-1">
            <li>
              <button
                type="button"
                onClick={() => { onChange(null); fechar() }}
                className="w-full text-left text-xs px-3 py-2 text-industrial-600 hover:bg-industrial-200"
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
                    'w-full text-left text-xs px-3 py-2 truncate hover:bg-industrial-200',
                    f.id === value ? 'text-brand-300 font-semibold' : 'text-industrial-900',
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
        'bg-transparent border-b border-industrial-400 hover:border-industrial-600 focus:border-brand-500',
        'focus:outline-none text-xs text-industrial-900 py-0.5 px-1 w-full',
        className,
      )}
    />
  )
}

function StatusReadOnly({ on }: { on: boolean }) {
  return on
    ? <Check className="size-4 text-brand-300 mx-auto" strokeWidth={3} />
    : <span className="inline-block size-3.5 rounded-sm border-2 border-industrial-500 mx-auto" />
}

/** Cartão de indicador: ícone no canto, número grande em mono e uma linha de contexto embaixo. */
function Kpi({
  label, value, unit, tone = 'neutral', icon: Icon, caption,
}: {
  label: string
  value: string | number
  unit?: string
  tone?: 'neutral' | 'brand' | 'info'
  icon: LucideIcon
  caption?: React.ReactNode
}) {
  const cor = tone === 'brand' ? 'text-brand-400' : tone === 'info' ? 'text-info-400' : 'text-industrial-900'
  const fundoIcone = tone === 'brand' ? 'bg-brand-500/15 text-brand-300' : tone === 'info' ? 'bg-info-500/15 text-info-400' : 'bg-industrial-200 text-industrial-600'
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-industrial-200 bg-industrial-100 px-4 py-3">
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-industrial-600">{label}</p>
        <p className={cn('mt-1 font-mono text-2xl font-extrabold leading-none', cor)}>
          {value}{unit && <span className="ml-1 text-sm font-normal text-industrial-600">{unit}</span>}
        </p>
        {caption && <p className="mt-1.5 truncate text-[11px] text-industrial-600">{caption}</p>}
      </div>
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', fundoIcone)}>
        <Icon className="size-[18px]" />
      </span>
    </div>
  )
}

/** Célula com a matéria-prima (kg/ton) usada pelo item + selo de verificação (Σ 1000). */
function CelulaMateriaPrima({ formula }: { formula: Formula | null | undefined }) {
  const usados = formula
    ? MATERIAS_PRIMA.map((mp) => ({ mp, label: labelMateriaPrima(formula, mp.key), kg: calcularMateriaPrima(formula, mp.key) })).filter((x) => x.kg > 0)
    : []
  const soma = formula ? +usados.reduce((s, x) => s + x.kg, 0).toFixed(1) : null
  const ok = soma !== null && Math.abs(soma - 1000) < 0.5

  if (!formula) return <span className="text-industrial-500">Selecione uma fórmula</span>

  return (
    <div className="flex flex-wrap items-center gap-1">
      {usados.map(({ mp, label, kg }) => (
        <span key={mp.key} className="inline-flex items-center gap-1 rounded bg-industrial-100 border border-industrial-300 px-1.5 py-0.5">
          <span className="text-[10px] text-industrial-600">{label}</span>
          <span className="text-[10px] font-mono font-bold text-industrial-900">{fmtKg(kg)}</span>
        </span>
      ))}
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold border',
          ok ? 'bg-brand-500/15 border-brand-500 text-brand-300' : 'bg-red-500/15 border-red-400 text-red-400',
        )}
        title="Soma total (deve fechar 1000)"
      >
        Σ {soma?.toFixed(0)}
      </span>
    </div>
  )
}

export function OrdensParnel({ initialOrdens, initialFormulas, initialClientes, user, hoje }: OrdensParneProps) {
  const { ordens, setOrdens } = useOrdensDiarias(initialOrdens, hoje)
  const { clientes, adicionarCliente, editarCliente } = useClientes(initialClientes)
  const [isPending, startTransition] = useTransition()
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const svc = useMemo(() => new OrdensDiariasService(createClient()), [])
  const router = useRouter()

  const podeEditarDados  = user.role === 'admin' || user.role === 'logistica'
  const podeMarcarStatus = user.role === 'admin' || user.role === 'logistica_02'

  const totalTons = useMemo(() => ordens.reduce((acc, o) => acc + tonsDaOrdem(o), 0), [ordens])

  // Exibe na ordem de prioridade definida pelo Fransua (sequencia).
  const linhas = useMemo(() => [...ordens].sort((a, b) => a.sequencia - b.sequencia), [ordens])

  const counts = useMemo(() => {
    let aguardando = 0, andamento = 0, finalizado = 0
    for (const o of ordens) {
      const s = getStatus(o)
      if (s === 'FINALIZADO') finalizado++
      else if (s === 'EM_ANDAMENTO') andamento++
      else aguardando++
    }
    return { aguardando, andamento, finalizado }
  }, [ordens])

  const concluido = ordens.length ? Math.round((counts.finalizado / ordens.length) * 100) : 0

  // Contexto dos indicadores: tonelagem já carregada, caminhão na baia, próximo da fila e ritmo médio.
  const tonsFinalizadas = useMemo(() => ordens.filter((o) => o.finalizado).reduce((a, o) => a + tonsDaOrdem(o), 0), [ordens])
  const pctTons = totalTons > 0 ? Math.round((tonsFinalizadas / totalTons) * 100) : 0
  const emAndamento = useMemo(() => linhas.find((o) => o.iniciado && !o.finalizado) ?? null, [linhas])
  const proxima = useMemo(() => linhas.find((o) => !o.iniciado && !o.finalizado) ?? null, [linhas])
  const mediaDuracaoMs = useMemo(() => {
    const ds = ordens
      .filter((o) => o.finalizado && o.iniciado_em && o.finalizado_em)
      .map((o) => new Date(o.finalizado_em!).getTime() - new Date(o.iniciado_em!).getTime())
      .filter((d) => d > 0)
    return ds.length ? ds.reduce((a, b) => a + b, 0) / ds.length : null
  }, [ordens])
  // Relógio do cronômetro do caminhão em andamento — só no cliente (evita mismatch de hidratação).
  const [agora, setAgora] = useState<number | null>(null)
  useEffect(() => {
    setAgora(Date.now())
    const id = setInterval(() => setAgora(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])
  const decorridoMs = agora && emAndamento?.iniciado_em ? Math.max(0, agora - new Date(emAndamento.iniciado_em).getTime()) : null

  function navegar(d: string) {
    router.push(`${ROUTES.ORDENS}?data=${d}`)
  }
  function irHoje() {
    const n = new Date()
    navegar(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`)
  }

  function updateLocal(id: string, patch: Partial<EditableOrdem>) {
    setOrdens((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch, _dirty: true } : o)))
  }

  async function saveField(id: string, patch: Partial<OrdemDiaria>) {
    setOrdens((prev) => prev.map((o) => (o.id === id ? { ...o, _saving: true, _dirty: false } : o)))
    try {
      const updated = await svc.atualizar(id, patch)
      setOrdens((prev) => prev.map((o) => (o.id === id ? { ...updated, _saving: false } : o)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar.')
      setOrdens((prev) => prev.map((o) => (o.id === id ? { ...o, _saving: false, _dirty: true } : o)))
    }
  }

  // ─── Itens da carga (fórmula/quantidade/embalagem) ───────────────────────
  // Marca a ordem inteira como _dirty durante a edição de um item — reaproveita
  // a mesma proteção do hook de realtime (não sobrescreve edição em curso).
  function updateItemLocal(ordemId: string, itemId: string, patch: Partial<OrdemItem>) {
    setOrdens((prev) =>
      prev.map((o) =>
        o.id !== ordemId ? o : { ...o, itens: o.itens.map((it) => (it.id === itemId ? { ...it, ...patch } : it)), _dirty: true },
      ),
    )
  }

  async function saveItemField(ordemId: string, itemId: string, patch: Partial<OrdemItem>) {
    setOrdens((prev) => prev.map((o) => (o.id === ordemId ? { ...o, _saving: true, _dirty: false } : o)))
    try {
      const updated = await svc.atualizarItem(itemId, ordemId, patch)
      setOrdens((prev) => prev.map((o) => (o.id === ordemId ? { ...updated, _saving: false } : o)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar item.')
      setOrdens((prev) => prev.map((o) => (o.id === ordemId ? { ...o, _saving: false, _dirty: true } : o)))
    }
  }

  function handleBlurItemQuantidade(ordemId: string, itemId: string) {
    const ordem = ordens.find((o) => o.id === ordemId)
    const item = ordem?.itens.find((it) => it.id === itemId)
    if (!ordem?._dirty || !item) return
    saveItemField(ordemId, itemId, { quantidade: item.quantidade })
  }

  async function handleItemFormula(ordemId: string, itemId: string, formulaId: number | null) {
    updateItemLocal(ordemId, itemId, { formula_id: formulaId })
    await saveItemField(ordemId, itemId, { formula_id: formulaId })
  }

  async function handleItemEmbalagem(ordemId: string, itemId: string, emb: Embalagem) {
    updateItemLocal(ordemId, itemId, { embalagem: emb })
    await saveItemField(ordemId, itemId, { embalagem: emb })
  }

  async function handleAddItem(ordemId: string) {
    try {
      const updated = await svc.adicionarItem(ordemId, { formula_id: null, quantidade: 0, embalagem: 'SACOS' })
      setOrdens((prev) => prev.map((o) => (o.id === ordemId ? updated : o)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao adicionar item.')
    }
  }

  async function handleRemoveItem(ordemId: string, itemId: string) {
    try {
      const updated = await svc.removerItem(itemId, ordemId)
      setOrdens((prev) => prev.map((o) => (o.id === ordemId ? updated : o)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover item.')
    }
  }

  // ─── Caminhão/carga (cliente, placa, envelopar, status) ──────────────────
  async function handleAddRow() {
    startTransition(async () => {
      try {
        const nova = await svc.criar({
          data:       hoje,
          cliente:    '',
          placa:      '',
          envelopar:  false,
          iniciado:   false,
          finalizado: false,
          formula_id: null,
          quantidade: 0,
          embalagem:  'SACOS',
        })
        setOrdens((prev) => (prev.some((o) => o.id === nova.id) ? prev : [...prev, nova]))
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erro ao adicionar ordem.')
      }
    })
  }

  async function handleDeleteTruck(id: string) {
    if (!window.confirm('Remover este caminhão/carga (e todos os itens)?')) return
    try {
      await svc.deletar(id)
      setOrdens((prev) => prev.filter((o) => o.id !== id))
      toast.success('Carga removida.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover.')
    }
  }

  async function handleToggleIniciado(ordem: EditableOrdem) {
    if (!podeMarcarStatus || ordem.finalizado) return
    const next = !ordem.iniciado
    if (next) {
      const outra = ordens.find((o) => o.id !== ordem.id && o.iniciado && !o.finalizado)
      if (outra) { toast.error('Finalize a carga em andamento antes de iniciar outra.'); return }
    }
    updateLocal(ordem.id, { iniciado: next })
    await saveField(ordem.id, { iniciado: next })
  }

  async function handleToggleFinalizado(ordem: EditableOrdem) {
    if (!podeMarcarStatus) return
    const next = !ordem.finalizado
    if (next && !ordem.iniciado) { toast.error('Inicie a carga antes de finalizar.'); return }
    updateLocal(ordem.id, { finalizado: next })
    await saveField(ordem.id, { finalizado: next })
  }

  function handleBlurText(id: string, field: keyof OrdemDiaria, localValue: string) {
    const ordem = ordens.find((o) => o.id === id)
    if (!ordem || !ordem._dirty) return
    saveField(id, { [field]: localValue })
  }

  async function handleEnvelopar(id: string, val: boolean) {
    updateLocal(id, { envelopar: val })
    await saveField(id, { envelopar: val })
  }

  async function handleCliente(id: string, nome: string) {
    updateLocal(id, { cliente: nome })
    await saveField(id, { cliente: nome })
  }

  // Aplica uma nova ordem completa (sequencia = posição). Otimista + persiste.
  // Marca _saving nas linhas afetadas para o realtime ignorar o "flood" do
  // próprio reordenamento (evita as linhas piscarem fora de lugar).
  async function aplicarNovaOrdem(novo: EditableOrdem[]) {
    const anterior = ordens
    const pos = new Map(novo.map((o, i) => [o.id, i + 1]))
    setOrdens((prev) => prev.map((o) => (pos.has(o.id) ? { ...o, sequencia: pos.get(o.id)!, _saving: true } : o)))
    try {
      await svc.reordenar(hoje, novo.map((o) => o.id))
      setOrdens((prev) => prev.map((o) => (pos.has(o.id) ? { ...o, _saving: false } : o)))
    } catch (err) {
      setOrdens(anterior)
      toast.error(err instanceof Error ? err.message : 'Erro ao reordenar.')
    }
  }

  // Setas: troca com o vizinho.
  function handleMover(ordem: EditableOrdem, dir: -1 | 1) {
    const sorted = [...ordens].sort((a, b) => a.sequencia - b.sequencia)
    const idx = sorted.findIndex((o) => o.id === ordem.id)
    const alvo = idx + dir
    if (alvo < 0 || alvo >= sorted.length) return
    const novo = [...sorted]
    ;[novo[idx], novo[alvo]] = [novo[alvo], novo[idx]]
    aplicarNovaOrdem(novo)
  }

  // Arrastar: move a ordem arrastada para a posição da ordem-alvo.
  function handleDrop(targetId: string) {
    const sorted = [...ordens].sort((a, b) => a.sequencia - b.sequencia)
    const from = sorted.findIndex((o) => o.id === dragId)
    const to = sorted.findIndex((o) => o.id === targetId)
    setDragId(null)
    setOverId(null)
    if (from < 0 || to < 0 || from === to) return
    const novo = [...sorted]
    const [movida] = novo.splice(from, 1)
    novo.splice(to, 0, movida)
    aplicarNovaOrdem(novo)
  }

  const thCls = 'px-2 py-2 text-[10px] uppercase tracking-wider text-industrial-600 font-semibold whitespace-nowrap border-b border-industrial-300 bg-industrial-100'
  const tdCls = 'px-2 py-1 border-b border-industrial-200 align-middle'
  const COLUNAS = 12 + (podeEditarDados ? 2 : 0)

  const dataLonga = new Date(hoje + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })

  return (
    <div className="flex flex-col gap-4">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-lg font-semibold tracking-tight text-industrial-900">Ordens Diárias de Carregamento</h1>
          <div className="flex items-center gap-1.5 mt-2">
            <button
              type="button" onClick={() => navegar(shiftData(hoje, -1))} aria-label="Dia anterior"
              className="rounded-lg border border-industrial-300 p-1.5 text-industrial-600 hover:text-industrial-900 hover:border-brand-500 transition-colors"
            >
              <ChevronLeft className="size-4" />
            </button>
            <input
              type="date" value={hoje}
              onChange={(e) => { if (e.target.value) navegar(e.target.value) }}
              className="bg-industrial-100 border border-industrial-300 rounded-lg px-2 py-1.5 text-sm text-industrial-900 focus:outline-none focus:border-brand-500"
            />
            <button
              type="button" onClick={() => navegar(shiftData(hoje, 1))} aria-label="Próximo dia"
              className="rounded-lg border border-industrial-300 p-1.5 text-industrial-600 hover:text-industrial-900 hover:border-brand-500 transition-colors"
            >
              <ChevronRight className="size-4" />
            </button>
            <button
              type="button" onClick={irHoje}
              className="rounded-lg border border-industrial-300 px-3 py-1.5 text-sm font-medium text-industrial-700 hover:text-brand-300 hover:border-brand-500 transition-colors"
            >
              Hoje
            </button>
          </div>
          <p className="text-xs text-industrial-600 mt-1.5 capitalize">{dataLonga}</p>
        </div>
        <Link
          href={ROUTES.ORDENS_RELATORIO}
          className="flex items-center gap-1.5 rounded-lg border border-industrial-300 px-3 py-2 text-xs font-medium text-industrial-800 hover:border-brand-500 hover:text-brand-300 transition-colors"
        >
          <Printer className="size-4" />
          Relatório do dia
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi
          label="Total do dia" value={totalTons.toFixed(2)} unit="ton" tone="brand" icon={Scale}
          caption={ordens.length ? `${tonsFinalizadas.toFixed(2)} ton já carregadas · ${ordens.length} ${ordens.length === 1 ? 'caminhão' : 'caminhões'}` : 'Nenhuma ordem neste dia'}
        />
        <Kpi
          label="Aguardando" value={counts.aguardando} icon={Clock3}
          caption={proxima ? <>próximo: <span className="font-semibold text-industrial-800">{proxima.cliente || '—'}</span></> : 'fila vazia'}
        />
        <Kpi
          label="Em andamento" value={counts.andamento} tone="info" icon={Truck}
          caption={emAndamento ? <><span className="font-semibold text-industrial-800">{emAndamento.cliente || '—'}</span>{decorridoMs !== null ? ` · há ${formatDuracao(decorridoMs)}` : ''}</> : 'nenhum caminhão na baia'}
        />
        <Kpi
          label="Finalizado" value={counts.finalizado} tone="brand" icon={CheckCircle2}
          caption={mediaDuracaoMs ? `média de ${formatDuracao(mediaDuracaoMs)} por carga` : 'sem carga finalizada ainda'}
        />
      </div>

      {/* Progresso segmentado por status: verde finalizado, azul em andamento, cinza aguardando. */}
      <div className="rounded-xl border border-industrial-200 bg-industrial-100 px-4 py-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-medium text-industrial-800">Progresso do dia</span>
          <span className="text-industrial-600">
            <span className="font-mono font-bold text-brand-400">{concluido}%</span> dos caminhões · <span className="font-mono font-bold text-brand-400">{pctTons}%</span> da tonelagem
          </span>
        </div>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-industrial-200" role="progressbar" aria-valuenow={concluido} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso do dia">
          {ordens.length > 0 && (
            <>
              <div className="h-full bg-brand-500 transition-all" style={{ width: `${(counts.finalizado / ordens.length) * 100}%` }} />
              <div className="h-full bg-info-500 transition-all" style={{ width: `${(counts.andamento / ordens.length) * 100}%` }} />
            </>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-industrial-600">
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-brand-500" />{counts.finalizado} finalizado{counts.finalizado === 1 ? '' : 's'}</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-info-500" />{counts.andamento} em andamento</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-industrial-400" />{counts.aguardando} aguardando</span>
        </div>
      </div>

      {/* Caminhão na baia agora */}
      {emAndamento && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-info-500/40 bg-info-500/10 px-4 py-3">
          <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-info-400">
            <span className="flex size-7 items-center justify-center rounded-lg bg-info-500/20"><Truck className="size-4" /></span>
            Carregando agora
          </span>
          <span className="text-sm font-semibold text-industrial-900">{emAndamento.cliente || 'Sem cliente'}</span>
          <PlacaChip placa={emAndamento.placa} />
          <span className="text-xs text-industrial-700">
            {(emAndamento.itens ?? []).map((it) => it.formula?.nome).filter(Boolean).join(' + ') || 'sem fórmula'}
          </span>
          <span className="font-mono text-sm font-bold text-brand-400">{tonsDaOrdem(emAndamento).toFixed(2)} <span className="text-[10px] font-normal text-industrial-600">ton</span></span>
          {emAndamento.envelopar && (
            <span className="inline-flex items-center gap-1 rounded-md border border-brand-500 bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold text-brand-300"><Tag className="size-3" /> ENVELOPAR</span>
          )}
          {decorridoMs !== null && (
            <span className="ml-auto flex items-center gap-1.5 font-mono text-sm font-bold text-info-400" title={`Iniciado às ${new Date(emAndamento.iniciado_em!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}>
              <Timer className="size-4" /> {formatDuracao(decorridoMs)}
            </span>
          )}
        </div>
      )}

      {/* Tabela em card sutil */}
      <div className="rounded-xl border border-industrial-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="font-display">
              <tr>
                <th className={cn(thCls, 'text-center', podeEditarDados ? 'w-16' : 'w-8')}>#</th>
                <th className={cn(thCls, 'text-left min-w-[130px]')}>Cliente</th>
                <th className={cn(thCls, 'text-center w-24')}>Status</th>
                <th className={cn(thCls, 'text-center w-16')}>Iniciado</th>
                <th className={cn(thCls, 'text-center w-20')}>Finalizado</th>
                <th className={cn(thCls, 'text-left w-20')}>Placa</th>
                <th className={cn(thCls, 'text-center w-20')}>Envelopar</th>
                <th className={cn(thCls, 'text-right w-24')}>Quant.</th>
                <th className={cn(thCls, 'text-center w-32')}>Embalagem</th>
                <th className={cn(thCls, 'text-right w-16')}>Tons</th>
                <th className={cn(thCls, 'text-left min-w-[210px]')}>Fórmula</th>
                <th className={cn(thCls, 'text-left min-w-[280px]')}>Matéria Prima (kg/ton)</th>
                {podeEditarDados && <th className={cn(thCls, 'w-8')} />}
                {podeEditarDados && <th className={cn(thCls, 'w-8')} />}
              </tr>
            </thead>
            <tbody>
              {linhas.map((ordem, idx) => {
                const status = getStatus(ordem)
                const editarDados = podeEditarDados && !ordem.finalizado
                const itens = ordem.itens ?? []
                const tonsCarga = tonsDaOrdem(ordem)
                const rowSpan = itens.length + (editarDados ? 1 : 0)

                return itens.map((item, itemIdx) => {
                  const formula = item.formula as Formula | null | undefined
                  const tons = calcularTons(item.quantidade, item.embalagem)
                  const primeiraLinha = itemIdx === 0

                  return (
                    <tr
                      key={item.id}
                      onDragOver={podeEditarDados && primeiraLinha ? (e) => { e.preventDefault(); if (overId !== ordem.id) setOverId(ordem.id) } : undefined}
                      onDrop={podeEditarDados && primeiraLinha ? () => handleDrop(ordem.id) : undefined}
                      onDragEnd={podeEditarDados && primeiraLinha ? () => { setDragId(null); setOverId(null) } : undefined}
                      className={cn(
                        'transition-colors',
                        ROW_STYLES[status],
                        ordem._saving && 'opacity-80',
                        dragId === ordem.id && 'opacity-40',
                        overId === ordem.id && dragId && dragId !== ordem.id && primeiraLinha && 'border-t-2 border-brand-500',
                        !primeiraLinha && 'border-t border-dashed border-industrial-300/60',
                      )}
                    >
                      {primeiraLinha && (
                        <>
                          <td className={cn(tdCls, 'text-center border-l-2', STATUS_ACCENT[status])} rowSpan={rowSpan}>
                            <div className="flex items-center justify-center gap-1">
                              {podeEditarDados && (
                                <span
                                  draggable
                                  onDragStart={(e) => {
                                    setDragId(ordem.id)
                                    e.dataTransfer.effectAllowed = 'move'
                                    e.dataTransfer.setData('text/plain', ordem.id)
                                  }}
                                  className="cursor-grab active:cursor-grabbing text-industrial-600 hover:text-brand-300"
                                  title="Arraste para reordenar a prioridade"
                                  aria-label="Arraste para reordenar"
                                >
                                  <GripVertical className="size-4" />
                                </span>
                              )}
                              {podeEditarDados && (
                                <div className="flex flex-col -my-1">
                                  <button
                                    type="button"
                                    onClick={() => handleMover(ordem, -1)}
                                    disabled={idx === 0}
                                    aria-label="Aumentar prioridade"
                                    className="text-industrial-600 hover:text-brand-300 disabled:opacity-30 disabled:cursor-not-allowed"
                                  >
                                    <ChevronUp className="size-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMover(ordem, 1)}
                                    disabled={idx === linhas.length - 1}
                                    aria-label="Diminuir prioridade"
                                    className="text-industrial-600 hover:text-brand-300 disabled:opacity-30 disabled:cursor-not-allowed"
                                  >
                                    <ChevronDown className="size-3.5" />
                                  </button>
                                </div>
                              )}
                              <span className="text-industrial-500 font-mono">{ordem.sequencia}</span>
                            </div>
                          </td>

                          <td className={tdCls} rowSpan={rowSpan}>
                            {editarDados ? (
                              <ClientePicker
                                value={ordem.cliente}
                                clientes={clientes}
                                onChange={(nome) => handleCliente(ordem.id, nome)}
                                onCriar={adicionarCliente}
                                onEditar={editarCliente}
                              />
                            ) : (
                              <span className="text-industrial-900 font-medium">
                                {ordem.cliente || <span className="text-industrial-500 font-normal">—</span>}
                              </span>
                            )}
                            {ordem.programacao?.motorista?.nome && (
                              <div className="text-[10px] text-industrial-500 truncate" title="Motorista">
                                {ordem.programacao.motorista.nome}
                              </div>
                            )}
                          </td>

                          <td className={cn(tdCls, 'text-center')} rowSpan={rowSpan}>
                            {(() => { const Icon = STATUS_ICON[status]; return (
                              <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[10px] font-bold', STATUS_STYLES[status])}>
                                <Icon className="size-3" /> {STATUS_LABEL[status]}
                              </span>
                            ) })()}
                            {ordem.finalizado && ordem.iniciado_em && ordem.finalizado_em && (
                              <div className="text-[10px] text-industrial-500 mt-0.5" title="Tempo de carregamento">
                                ⏱ {formatDuracao(new Date(ordem.finalizado_em).getTime() - new Date(ordem.iniciado_em).getTime())}
                              </div>
                            )}
                          </td>

                          <td className={cn(tdCls, 'text-center')} rowSpan={rowSpan}>
                            {podeMarcarStatus && !ordem.finalizado ? (
                              <button
                                type="button"
                                onClick={() => handleToggleIniciado(ordem)}
                                disabled={!ordem.iniciado && ordens.some((x) => x.id !== ordem.id && x.iniciado && !x.finalizado)}
                                aria-pressed={ordem.iniciado}
                                title={ordem.iniciado ? 'Desfazer início' : 'Iniciar carregamento deste caminhão'}
                                className={cn(
                                  'mx-auto flex size-7 items-center justify-center rounded-full border-2 transition-colors disabled:cursor-not-allowed disabled:opacity-30',
                                  ordem.iniciado ? 'border-info-500 bg-info-500 text-white' : 'border-industrial-400 text-industrial-500 hover:border-info-500 hover:text-info-400',
                                )}
                              >
                                <Play className="size-3.5" fill={ordem.iniciado ? 'currentColor' : 'none'} />
                              </button>
                            ) : (
                              <StatusReadOnly on={ordem.iniciado} />
                            )}
                          </td>

                          <td className={cn(tdCls, 'text-center')} rowSpan={rowSpan}>
                            {podeMarcarStatus ? (
                              <button
                                type="button"
                                onClick={() => handleToggleFinalizado(ordem)}
                                disabled={!ordem.iniciado && !ordem.finalizado}
                                aria-pressed={ordem.finalizado}
                                title={ordem.finalizado ? 'Reabrir carregamento' : 'Finalizar carregamento'}
                                className={cn(
                                  'mx-auto flex size-7 items-center justify-center rounded-full border-2 transition-colors disabled:cursor-not-allowed disabled:opacity-30',
                                  ordem.finalizado ? 'border-brand-500 bg-brand-600 text-white' : 'border-industrial-400 text-industrial-500 hover:border-brand-500 hover:text-brand-300',
                                )}
                              >
                                <Check className="size-4" strokeWidth={3} />
                              </button>
                            ) : (
                              <StatusReadOnly on={ordem.finalizado} />
                            )}
                          </td>

                          <td className={tdCls} rowSpan={rowSpan}>
                            {editarDados ? (
                              <InlineInput
                                value={ordem.placa}
                                onChange={(v) => updateLocal(ordem.id, { placa: v.toUpperCase() })}
                                onBlur={() => handleBlurText(ordem.id, 'placa', ordem.placa)}
                                className="uppercase font-mono"
                              />
                            ) : (
                              <PlacaChip placa={ordem.placa} />
                            )}
                          </td>

                          <td className={cn(tdCls, 'text-center')} rowSpan={rowSpan}>
                            {editarDados ? (
                              <button
                                type="button"
                                onClick={() => handleEnvelopar(ordem.id, !ordem.envelopar)}
                                aria-pressed={ordem.envelopar}
                                title={ordem.envelopar ? 'Carga envelopada — clique pra desmarcar' : 'Marcar carga pra envelopar'}
                                className={cn(
                                  'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold transition-colors',
                                  ordem.envelopar
                                    ? 'border-brand-500 bg-brand-500/15 text-brand-300'
                                    : 'border-industrial-400 bg-industrial-100 text-industrial-500 hover:border-brand-500 hover:text-brand-300',
                                )}
                              >
                                <Tag className="size-3" /> {ordem.envelopar ? 'SIM' : 'NÃO'}
                              </button>
                            ) : (
                              <span className={cn('inline-flex items-center gap-1 text-[11px] font-bold', ordem.envelopar ? 'text-brand-300' : 'text-industrial-500')}>
                                {ordem.envelopar && <Tag className="size-3" />}{ordem.envelopar ? 'SIM' : 'NÃO'}
                              </span>
                            )}
                          </td>
                        </>
                      )}

                      <td className={cn(tdCls, 'text-right')}>
                        {editarDados ? (
                          <InlineInput
                            type="number"
                            value={item.quantidade}
                            onChange={(v) => updateItemLocal(ordem.id, item.id, { quantidade: Number(v) || 0 })}
                            onBlur={() => handleBlurItemQuantidade(ordem.id, item.id)}
                            className="text-right"
                          />
                        ) : (
                          <span className="text-industrial-900 font-mono font-medium">{item.quantidade}</span>
                        )}
                      </td>

                      <td className={cn(tdCls, 'text-center')}>
                        {editarDados ? (
                          <select
                            value={item.embalagem}
                            onChange={(e) => handleItemEmbalagem(ordem.id, item.id, e.target.value as Embalagem)}
                            className="bg-industrial-100 border border-industrial-400 rounded px-1 py-0.5 text-xs text-industrial-900 focus:outline-none focus:border-brand-500"
                          >
                            {EMBALAGEM_OPCOES.map((opt) => (
                              <option key={opt} value={opt}>{EMBALAGEM_LABEL[opt]}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-industrial-900 font-medium">{EMBALAGEM_LABEL[item.embalagem]}</span>
                        )}
                      </td>

                      <td className={cn(tdCls, 'text-right font-mono text-brand-300 font-bold')}>
                        {tons.toFixed(2)}
                      </td>

                      <td className={tdCls}>
                        {editarDados ? (
                          <FormulaCombobox
                            value={item.formula_id}
                            formulas={initialFormulas}
                            onChange={(id) => handleItemFormula(ordem.id, item.id, id)}
                          />
                        ) : (
                          <span className="text-[13px] font-bold text-industrial-950">
                            {formula?.nome ?? <span className="text-industrial-500 text-xs font-normal">—</span>}
                          </span>
                        )}
                      </td>

                      <td className={tdCls}>
                        <CelulaMateriaPrima formula={formula} />
                      </td>

                      {podeEditarDados && (
                        <td className={cn(tdCls, 'text-center')}>
                          {editarDados && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(ordem.id, item.id)}
                              disabled={itens.length <= 1}
                              className="text-industrial-500 hover:text-red-400 transition-colors p-0.5 rounded disabled:opacity-20 disabled:cursor-not-allowed"
                              title="Remover item"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </td>
                      )}

                      {primeiraLinha && podeEditarDados && (
                        <td className={cn(tdCls, 'text-center')} rowSpan={rowSpan}>
                          <button
                            type="button"
                            onClick={() => handleDeleteTruck(ordem.id)}
                            className="text-industrial-500 hover:text-red-400 transition-colors p-0.5 rounded"
                            title="Remover caminhão/carga"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                          <div className="text-[10px] font-mono font-bold text-brand-300 mt-2" title="Total do caminhão">
                            {tonsCarga.toFixed(2)}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })
                .concat(
                  editarDados ? [
                    <tr key={`${ordem.id}-add`} className={cn(ROW_STYLES[status])}>
                      <td colSpan={6} className="px-2 py-1.5">
                        <button
                          type="button"
                          onClick={() => handleAddItem(ordem.id)}
                          className="flex items-center gap-1.5 text-[11px] font-medium text-industrial-600 hover:text-brand-300 transition-colors"
                        >
                          <Plus className="size-3.5" /> Adicionar item ao mesmo caminhão (outra fórmula/embalagem)
                        </button>
                      </td>
                    </tr>,
                  ] : [],
                )
              })}

              {ordens.length === 0 && (
                <tr>
                  <td colSpan={COLUNAS} className="py-12 text-center text-industrial-600">
                    <PackageOpen className="mx-auto mb-2 size-8 text-industrial-400" />
                    {podeEditarDados
                      ? 'Nenhuma ordem para este dia. Clique em “Adicionar linha” para começar.'
                      : 'Nenhuma ordem para este dia ainda.'}
                  </td>
                </tr>
              )}
            </tbody>

            {ordens.length > 0 && (
              <tfoot>
                <tr className="bg-industrial-100">
                  <td colSpan={9} className="px-2 py-2 text-xs text-industrial-700 text-right font-semibold">
                    Total do dia:
                  </td>
                  <td className="px-2 py-2 text-right font-mono font-bold text-brand-300">
                    {totalTons.toFixed(2)}
                  </td>
                  <td colSpan={COLUNAS - 10} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

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
          Adicionar linha (novo caminhão)
        </button>
      )}
    </div>
  )
}
