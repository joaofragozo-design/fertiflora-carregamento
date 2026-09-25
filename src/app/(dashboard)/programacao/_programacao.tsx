'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Trash2, Pencil, X, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Printer, Send, CheckCircle2, Truck, Container, RotateCcw, EyeOff, Eye, FileDown, CalendarCheck, CalendarRange, CalendarDays } from 'lucide-react'
import { toast } from 'sonner'
import { AnimatePresence, motion, useReducedMotion, type Transition } from 'motion/react'
import { createClient } from '@/lib/supabase/client'
import { ProgramacaoService } from '@/services/programacao.service'
import { OrdensDiariasService } from '@/services/ordens-diarias.service'
import { useProgramacaoSemana } from '@/hooks/use-programacao-semana'
import { useClientes } from '@/hooks/use-clientes'
import { useMediaQuery } from '@/hooks/use-media-query'
import { ClientePicker } from '@/components/clientes/cliente-picker'
import { ROUTES } from '@/constants/routes'
import type { Programacao, ProgramacaoItem } from '@/types/programacao'
import type { Embalagem, Formula } from '@/types/formula'
import type { Cliente } from '@/types/cliente'
import type { ClienteErp } from '@/types/cliente-erp'
import type { Transportadora } from '@/types/transportadora'
import { SOLICITACAO_STATUS_LABEL } from '@/types/transportadora'
import { MATERIAS_PRIMA, EMBALAGEM_LABEL, EMBALAGEM_OPCOES, calcularMateriaPrima, labelMateriaPrima, calcularTons } from '@/types/formula'
import { cn } from '@/lib/utils/cn'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ProgramacaoSemanaProps {
  initialItens:    Programacao[]
  formulas:        { id: number; nome: string }[]
  initialClientes: Cliente[]
  clientesErp:     ClienteErp[]
  transportadoras: Transportadora[]
  semanaInicio:    string // segunda-feira (YYYY-MM-DD)
  semanaFim:       string // sábado (YYYY-MM-DD)
  hoje:            string
  /** Dia escolhido no calendário (AAAA-MM-DD): a semana abre com só ele expandido. */
  diaFoco?:        string | null
  podeEditar:      boolean // admin/logistica — programa a semana
  podeConfirmar:   boolean // admin/faturamento — só confirma chegada do caminhão
  usuario:         string
}

const DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

/** Preferência da Logística de ocultar a coluna de sábado — por navegador, não trava a programação de outros usuários. */
const OCULTAR_SABADO_KEY = 'fertilog:programacao:ocultar-sabado'

// ─── Motion da prancheta (ver DESIGN.md → Motion) ──────────────────────────
// Só dois eventos físicos animam aqui: uma ficha NOVA cai na coluna e
// assenta (spring, sem overshoot exagerado) e a coluna de sábado desliza
// pra dentro/fora da prancheta. Nada anima no carregamento da página
// (`AnimatePresence initial={false}`) e tudo respeita prefers-reduced-motion.
const FICHA_NO_AR = { y: -64, opacity: 0, rotate: -3 }
const FICHA_RETIRADA = { opacity: 0, y: 10, transition: { duration: 0.16, ease: 'easeIn' } } as const
const TRANSICAO_FICHA: Transition = {
  y:       { type: 'spring', stiffness: 210, damping: 15, mass: 1 },
  rotate:  { type: 'spring', stiffness: 180, damping: 13 },
  opacity: { duration: 0.16 },
  layout:  { type: 'spring', stiffness: 380, damping: 34 },
}
const GLIDE = [0.16, 1, 0.3, 1] as const
const TRANSICAO_COLUNA: Transition = { type: 'tween', duration: 0.34, ease: GLIDE }
const SAIDA_COLUNA: Transition = { type: 'tween', duration: 0.26, ease: GLIDE }
/** Estado "fora da prancheta" da coluna — no desktop ela fecha na largura; no celular (grid de 1 coluna) fecha na altura.
 *  O `overflow: hidden` da saída é aplicado na hora pelo Motion (valor não animável); na entrada quem
 *  corta é o wrapper interno, via `colunasProntas`, porque `transitionEnd` não devolvia o overflow. */
const COLUNA_OCULTA_DESKTOP = { flexGrow: 0, flexBasis: '0px', minWidth: '0px', marginLeft: -16, opacity: 0 } as const
const COLUNA_OCULTA_MOBILE = { height: 0, marginTop: -20, opacity: 0 } as const
const SAIDA_OVERFLOW = { overflow: 'hidden' } as const
/** Largura mínima de uma coluna aberta (mesmo valor do `md:min-w-[230px]` de antes: abaixo disso o
 *  carimbo e o nome do cliente já não cabem na ficha; em 1440 com a barra lateral aberta a 5ª coluna quebra
 *  de linha — comportamento anterior, mantido de propósito). */
const COLUNA_MIN_PX = 240
/** Tamanho em repouso da coluna (equivale a `md:flex-1 md:min-w-[200px]` / `md:w-[84px] md:shrink-0`, mas animável). */
/** Teto de largura de uma coluna aberta: com dias minimizados, a(s) que sobra(m) não estica(m) até
 *  ocupar a prancheta inteira — ficam com largura de ficha e o conjunto se centraliza (`md:justify-center`). */
const COLUNA_MAX_PX = 380
function alvoColuna(colapsado: boolean) {
  return colapsado
    ? { flexGrow: 0, flexShrink: 0, flexBasis: '84px', minWidth: '84px', maxWidth: '84px', marginLeft: 0, height: 'auto', marginTop: 0, opacity: 1 }
    : { flexGrow: 1, flexShrink: 1, flexBasis: '0px', minWidth: `${COLUNA_MIN_PX}px`, maxWidth: `${COLUNA_MAX_PX}px`, marginLeft: 0, height: 'auto', marginTop: 0, opacity: 1 }
}

/** Botão de ícone dos cards: área de clique de verdade, hover com fundo — não um ícone solto. */
function IconBtn({ title, small, danger, className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { title: string; small?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      {...props}
      className={cn(
        'inline-flex items-center justify-center rounded-md text-industrial-500 transition-colors hover:bg-industrial-200 disabled:cursor-not-allowed disabled:opacity-25',
        small ? 'size-5' : 'size-6',
        danger ? 'hover:text-red-400' : 'hover:text-brand-300',
        className,
      )}
    >
      {children}
    </button>
  )
}

/** Ação de rodapé do card (ícone + texto), com estados neutro / ativo / alerta / primário. */
function ActionBtn({ tone = 'neutral', active, className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'neutral' | 'warn' | 'primary'; active?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50',
        tone === 'primary' && 'bg-brand-600 text-white hover:bg-brand-500',
        tone === 'warn' && 'text-amber-400 hover:bg-amber-400/10',
        tone === 'neutral' && (active ? 'text-brand-300 hover:bg-brand-500/10' : 'text-industrial-500 hover:bg-industrial-200 hover:text-brand-300'),
        className,
      )}
    >
      {children}
    </button>
  )
}

/**
 * Carga concluída (chegada confirmada pelo faturamento) recolhida a um card
 * verde de duas linhas: dentro do dia, só as cargas que ainda faltam aparecem
 * completas. Clicar abre o card inteiro; "Recolher" dentro dele devolve pra linha.
 */
function CardConcluido({ ag, hora, onAbrir }: { ag: Programacao; hora: string | null; onAbrir: () => void }) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      title="Carga concluída — clique pra abrir o card"
      className="flex w-full items-center gap-2 rounded-lg border border-brand-500 bg-brand-500/15 px-2.5 py-2 text-left transition-colors hover:bg-brand-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <CheckCircle2 className="size-4 shrink-0 text-brand-400" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-semibold leading-snug text-industrial-900">
          {ag.cliente || <span className="font-normal text-industrial-500">Sem cliente</span>}
        </p>
        <p className="text-[11px] text-industrial-600">
          <span className="font-mono font-bold text-industrial-800">{tonsDoAgendamento(ag).toFixed(2)} ton</span>
          {hora && ` · chegou ${hora}`}
        </p>
      </div>
      <ChevronDown className="size-4 shrink-0 text-industrial-500" aria-hidden="true" />
    </button>
  )
}

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

/** Soma as toneladas de todos os itens de um agendamento. */
function tonsDoAgendamento(ag: Programacao): number {
  return (ag.itens ?? []).reduce((s, it) => s + (it.tons ?? 0), 0)
}

/**
 * Ordem das cargas dentro do dia: o que ainda falta fica em cima (na ordem em
 * que foi programado); o que já chegou desce pro fim, por hora de confirmação.
 * Ao confirmar, o card desliza sozinho pro bloco das concluídas (layout animation).
 */
function ordenarCargasDoDia(cargas: Programacao[]): Programacao[] {
  const pendentes = cargas.filter((c) => !c.confirmado_em)
  const confirmadas = cargas
    .filter((c) => !!c.confirmado_em)
    .sort((a, b) => Date.parse(a.confirmado_em!) - Date.parse(b.confirmado_em!))
  return [...pendentes, ...confirmadas]
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
        className="w-full flex items-center justify-between gap-1 px-3 py-2 rounded-lg text-sm bg-industrial-50 border border-industrial-400 text-left text-industrial-900 hover:border-brand-600 focus:outline-none focus:border-brand-500"
      >
        <span className={cn('truncate', !selected && 'text-industrial-500')}>
          {selected?.nome ?? 'Selecionar fórmula…'}
        </span>
        <ChevronDown className="size-4 shrink-0 text-industrial-600" />
      </button>
      {open && (
        <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-industrial-100 border border-industrial-400 rounded-lg shadow-industrial">
          <div className="p-1.5 border-b border-industrial-300">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar fórmula..."
              className="w-full bg-industrial-50 text-sm text-industrial-900 placeholder-industrial-500 px-2 py-1.5 rounded border border-industrial-400 focus:outline-none focus:border-brand-500"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            <li>
              <button type="button" onClick={() => { onChange(null); setOpen(false); setQuery('') }}
                className="w-full text-left text-sm px-3 py-1.5 text-industrial-600 hover:bg-industrial-200">
                — Nenhuma —
              </button>
            </li>
            {filtered.map((f) => (
              <li key={f.id}>
                <button type="button" onClick={() => { onChange(f.id); setOpen(false); setQuery('') }}
                  className={cn('w-full text-left text-sm px-3 py-1.5 truncate hover:bg-industrial-200',
                    f.id === value ? 'text-brand-300 font-semibold' : 'text-industrial-900')}>
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

// ─── Formulário de ITEM (fórmula/quantidade/embalagem) ─────────────────────
// Cria um agendamento novo (com cliente/observação) OU adiciona/edita um item
// de um agendamento já existente.
interface ItemFormState {
  agendamentoId:    string | null // null = criar novo agendamento
  itemId:           string | null // null = novo item
  data:             string
  cliente:          string
  clienteCodigo:    number | null
  observacao:       string
  formula_id:       number | null
  quantidade:       number
  embalagem:        Embalagem
  transportadoraId: string // só usado ao criar um agendamento novo
}

const ITEM_FORM_VAZIO: Omit<ItemFormState, 'data' | 'agendamentoId'> = {
  itemId: null, cliente: '', clienteCodigo: null, observacao: '', formula_id: null, quantidade: 0, embalagem: 'SACOS', transportadoraId: '',
}

// ─── Formulário do AGENDAMENTO (cliente/data/observação) ───────────────────
interface AgendamentoFormState {
  id:            string
  data:          string
  cliente:       string
  clienteCodigo: number | null
  observacao:    string
}

export function ProgramacaoSemana({
  initialItens, formulas, initialClientes, clientesErp, transportadoras, semanaInicio, semanaFim, hoje, diaFoco = null, podeEditar, podeConfirmar, usuario,
}: ProgramacaoSemanaProps) {
  const { agendamentos, setAgendamentos } = useProgramacaoSemana(initialItens, semanaInicio, semanaFim)
  const { clientes, adicionarCliente, editarCliente } = useClientes(initialClientes)
  const reduceMotion = useReducedMotion()
  const desktop = useMediaQuery('(min-width: 768px)', true)
  const colunaOculta = desktop ? COLUNA_OCULTA_DESKTOP : COLUNA_OCULTA_MOBILE
  const [itemForm, setItemForm] = useState<ItemFormState | null>(null)
  const [agForm, setAgForm] = useState<AgendamentoFormState | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [enviandoId, setEnviandoId] = useState<string | null>(null)
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null)
  // Fluxo transportadora: modal de escolha + estado do botão de liberar
  const [transpModal, setTranspModal] = useState<{ agendamento: Programacao; transportadoraId: string } | null>(null)
  const [enviandoTranspId, setEnviandoTranspId] = useState<string | null>(null)
  const [revertendoId, setRevertendoId] = useState<string | null>(null)
  const [ocultarSabado, setOcultarSabado] = useState(false)
  // Veio do calendário com um dia em foco? Nasce com os outros dias recolhidos.
  const [diasColapsados, setDiasColapsados] = useState<Set<string>>(() => {
    if (!diaFoco) return new Set()
    const datas = DIAS.map((_, i) => addDiasIso(semanaInicio, i))
    return new Set(datas.filter((d) => d !== diaFoco))
  })
  const calendarioRef = useRef<HTMLInputElement>(null)
  function abrirCalendario() {
    const el = calendarioRef.current
    if (!el) return
    if (typeof el.showPicker === 'function') { try { el.showPicker(); return } catch { /* cai no focus */ } }
    el.focus()
    el.click()
  }
  // Cargas concluídas que o usuário abriu de propósito (por padrão ficam recolhidas a uma linha).
  const [fichasAbertas, setFichasAbertas] = useState<Set<string>>(new Set())
  const abrirFicha = (id: string) => setFichasAbertas((prev) => new Set(prev).add(id))
  const recolherFicha = (id: string) => setFichasAbertas((prev) => { const next = new Set(prev); next.delete(id); return next })
  const alternarColapso = (data: string) =>
    setDiasColapsados((prev) => {
      const next = new Set(prev)
      if (next.has(data)) next.delete(data)
      else next.add(data)
      return next
    })
  const svc = useMemo(() => new ProgramacaoService(createClient()), [])
  const ordensSvc = useMemo(() => new OrdensDiariasService(createClient()), [])
  const router = useRouter()

  const amanha = addDiasIso(hoje, 1)

  const dias = useMemo(
    () => DIAS.map((nome, i) => ({ nome, data: addDiasIso(semanaInicio, i) })),
    [semanaInicio],
  )
  const diasVisiveis = useMemo(
    () => (ocultarSabado ? dias.filter((d) => d.nome !== 'Sábado') : dias),
    [dias, ocultarSabado],
  )
  // Colunas que já terminaram de entrar na prancheta: só elas deixam a sombra
  // das fichas vazar pra fora; a que ainda está abrindo fica cortada. As que
  // já nascem na página contam como prontas.
  const [colunasProntas, setColunasProntas] = useState<Set<string>>(() => new Set(dias.map((d) => d.data)))

  // A preferência só é lida depois da hidratação; a primeira sincronização
  // remove o sábado SEM animar (senão a coluna "fecha" a cada abertura da página).
  const [preferenciaLida, setPreferenciaLida] = useState(false)
  const animarColunasRef = useRef(false)
  useEffect(() => {
    try {
      setOcultarSabado(localStorage.getItem(OCULTAR_SABADO_KEY) === '1')
    } catch { /* localStorage indisponível — mantém sábado visível */ }
    setPreferenciaLida(true)
  }, [])
  useEffect(() => {
    if (preferenciaLida) animarColunasRef.current = true
  }, [preferenciaLida])

  function alternarSabado() {
    setOcultarSabado((prev) => {
      const novo = !prev
      try { localStorage.setItem(OCULTAR_SABADO_KEY, novo ? '1' : '0') } catch { /* ignora */ }
      return novo
    })
    // Ao ocultar, sábado deixa de estar "pronto": quando voltar, entra cortado até terminar de abrir.
    const sabado = dias.find((d) => d.nome === 'Sábado')?.data
    if (sabado) setColunasProntas((prev) => { const next = new Set(prev); next.delete(sabado); return next })
  }

  // "Só hoje": recolhe todos os outros dias e deixa só o atual aberto; de novo, reabre a semana.
  const hojeNaSemana = dias.some((d) => d.data === hoje)
  const soHojeAtivo =
    hojeNaSemana && diasVisiveis.every((d) => (d.data === hoje ? !diasColapsados.has(d.data) : diasColapsados.has(d.data)))
  function alternarSoHoje() {
    if (!hojeNaSemana) return
    setDiasColapsados(soHojeAtivo ? new Set() : new Set(dias.filter((d) => d.data !== hoje).map((d) => d.data)))
  }

  const totalSemana = useMemo(() => agendamentos.reduce((s, ag) => s + tonsDoAgendamento(ag), 0), [agendamentos])
  const agendamentosDoDia = (data: string) => agendamentos.filter((ag) => ag.data === data)
  const totalDia = (data: string) => agendamentosDoDia(data).reduce((s, ag) => s + tonsDoAgendamento(ag), 0)

  // Matéria-prima consumida pelos agendamentos passados: Σ tons do item × kg/ton.
  // Agrupa por RÓTULO (não pela chave da coluna) porque a mesma coluna
  // `caltimag` pode representar CALTIMAG numa fórmula e FERTIMAG noutra.
  function materiaPrimaDosAgendamentos(ags: Programacao[]): { label: string; kg: number }[] {
    const acc: Record<string, number> = {}
    for (const ag of ags) {
      for (const item of ag.itens ?? []) {
        const f = item.formula as Formula | undefined
        if (!f) continue
        const tons = item.tons ?? calcularTons(item.quantidade, item.embalagem)
        for (const mp of MATERIAS_PRIMA) {
          const kgPorTon = calcularMateriaPrima(f, mp.key)
          if (kgPorTon > 0) {
            const label = labelMateriaPrima(f, mp.key)
            acc[label] = (acc[label] ?? 0) + tons * kgPorTon
          }
        }
      }
    }
    return Object.entries(acc).map(([label, kg]) => ({ label, kg })).sort((a, b) => b.kg - a.kg)
  }
  function insumosDoDia(data: string): { label: string; kg: number }[] {
    return materiaPrimaDosAgendamentos(agendamentosDoDia(data))
  }
  const materiaPrimaDaSemana = useMemo(() => materiaPrimaDosAgendamentos(agendamentos), [agendamentos])

  function irParaSemana(inicio: string) {
    router.push(`${ROUTES.PROGRAMACAO}?semana=${inicio}`)
  }

  function abrirNovoAgendamento(data: string) {
    setItemForm({ ...ITEM_FORM_VAZIO, data, agendamentoId: null })
  }
  function abrirNovoItem(ag: Programacao) {
    setItemForm({ ...ITEM_FORM_VAZIO, data: ag.data, agendamentoId: ag.id })
  }
  function abrirEdicaoItem(ag: Programacao, item: ProgramacaoItem) {
    setItemForm({
      agendamentoId: ag.id, itemId: item.id, data: ag.data, transportadoraId: '',
      cliente: ag.cliente, clienteCodigo: ag.cliente_codigo, observacao: ag.observacao,
      formula_id: item.formula_id, quantidade: item.quantidade, embalagem: item.embalagem,
    })
  }
  function abrirEdicaoAgendamento(ag: Programacao) {
    setAgForm({ id: ag.id, data: ag.data, cliente: ag.cliente, clienteCodigo: ag.cliente_codigo, observacao: ag.observacao })
  }

  async function salvarItem() {
    if (!itemForm) return
    if (!itemForm.quantidade || itemForm.quantidade <= 0) {
      toast.error('Informe uma quantidade maior que zero.')
      return
    }
    setSalvando(true)
    try {
      if (itemForm.agendamentoId && itemForm.itemId) {
        // Editar item existente
        const upd = await svc.atualizarItem(itemForm.itemId, itemForm.agendamentoId, {
          formula_id: itemForm.formula_id, quantidade: itemForm.quantidade, embalagem: itemForm.embalagem,
        })
        setAgendamentos((prev) => prev.map((a) => (a.id === upd.id ? upd : a)))
      } else if (itemForm.agendamentoId) {
        // Adicionar item a um agendamento existente
        const upd = await svc.adicionarItem(itemForm.agendamentoId, {
          formula_id: itemForm.formula_id, quantidade: itemForm.quantidade, embalagem: itemForm.embalagem,
        })
        setAgendamentos((prev) => prev.map((a) => (a.id === upd.id ? upd : a)))
      } else {
        // Criar agendamento novo com o primeiro item. Fecha o modal e mostra
        // na grade IMEDIATAMENTE após criar — antes de tentar enviar pra
        // transportadora — pra uma falha nesse segundo passo (rede, RLS) não
        // deixar o agendamento "invisível" e sujeito a ser duplicado se o
        // usuário, vendo só um erro genérico, clicar Salvar de novo.
        const novo = await svc.criar({
          data: itemForm.data,
          cliente: itemForm.cliente.trim(),
          cliente_codigo: itemForm.clienteCodigo,
          observacao: itemForm.observacao.trim(),
          formula_id: itemForm.formula_id,
          quantidade: itemForm.quantidade,
          embalagem: itemForm.embalagem,
        })
        setAgendamentos((prev) => [...prev, novo])
        setItemForm(null)

        if (itemForm.transportadoraId) {
          try {
            const atualizado = await svc.enviarParaTransportadora(novo.id, itemForm.transportadoraId)
            setAgendamentos((prev) => prev.map((a) => (a.id === atualizado.id ? atualizado : a)))
          } catch (err) {
            toast.error(
              `${novo.cliente || 'Agendamento'} foi criado, mas não foi possível enviar pra transportadora: ${err instanceof Error ? err.message : 'erro desconhecido'}. Use o botão "Transportadora" no card pra tentar de novo.`,
            )
          }
        }
        return
      }
      setItemForm(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setSalvando(false)
    }
  }

  async function salvarAgendamento() {
    if (!agForm) return
    setSalvando(true)
    try {
      const upd = await svc.atualizar(agForm.id, { data: agForm.data, cliente: agForm.cliente.trim(), cliente_codigo: agForm.clienteCodigo, observacao: agForm.observacao.trim() })
      setAgendamentos((prev) => prev.map((a) => (a.id === upd.id ? upd : a)))
      setAgForm(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setSalvando(false)
    }
  }

  async function removerItem(ag: Programacao, item: ProgramacaoItem) {
    try {
      const upd = await svc.removerItem(item.id, ag.id)
      setAgendamentos((prev) => prev.map((a) => (a.id === upd.id ? upd : a)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover item.')
    }
  }

  // Envia o agendamento (cliente + todos os itens) direto para as Ordens do
  // Dia daquela data — o Fransua não precisa redigitar nada. Placa e
  // envelopar ficam em branco/não, pois não existem na Programação.
  async function enviarParaOrdens(ag: Programacao) {
    const itens = ag.itens ?? []
    if (itens.length === 0) {
      toast.error('Adicione ao menos um item antes de enviar.')
      return
    }
    setEnviandoId(ag.id)
    try {
      await ordensSvc.criarComItens(
        { data: ag.data, cliente: ag.cliente, placa: '', envelopar: false, iniciado: false, finalizado: false, programacao_id: ag.id },
        itens.map((it) => ({ formula_id: it.formula_id, quantidade: it.quantidade, embalagem: it.embalagem })),
      )
      const upd = await svc.marcarEnviado(ag.id)
      setAgendamentos((prev) => prev.map((a) => (a.id === upd.id ? upd : a)))
      toast.success(`${ag.cliente || 'Cliente'} enviado para Ordens do Dia.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar para Ordens do Dia.')
    } finally {
      setEnviandoId(null)
    }
  }

  // Desfaz uma liberação feita por engano (ou que precisa de correção) sem
  // perder transportadora/motorista/número da ordem — volta pra SOLICITADO
  // pra reaparecer na fila de liberação e permitir liberar de novo.
  async function reverterLiberacao(ag: Programacao) {
    const aviso = `Reverter a liberação de ${ag.transportadora?.nome ?? 'transportadora'}${ag.motorista?.nome ? ' · ' + ag.motorista.nome : ''}${ag.numero_ordem ? ` (ordem nº ${String(ag.numero_ordem).padStart(6, '0')})` : ''}?\n\nA solicitação volta pra fila de liberação. Se o motorista já recebeu o WhatsApp de liberação, avise que o carregamento foi suspenso até nova liberação.`
    if (!window.confirm(aviso)) return

    setRevertendoId(ag.id)
    try {
      const upd = await svc.reverterLiberacao(ag.id)
      setAgendamentos((prev) => prev.map((a) => (a.id === upd.id ? upd : a)))
      toast.success('Liberação revertida — voltou pra fila de Solicitações.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao reverter a liberação.')
    } finally {
      setRevertendoId(null)
    }
  }

  // Faturamento confirma que o caminhão chegou — a Logística é notificada
  // (som + balão) via realtime, ouvindo a mudança de confirmado_em.
  async function confirmarChegada(ag: Programacao) {
    setConfirmandoId(ag.id)
    try {
      const upd = await svc.confirmarChegada(ag.id, usuario)
      setAgendamentos((prev) => prev.map((a) => (a.id === upd.id ? upd : a)))
      toast.success(`Chegada de ${ag.cliente || 'cliente'} confirmada.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao confirmar chegada.')
    } finally {
      setConfirmandoId(null)
    }
  }

  // ─── Fluxo transportadora/motorista ────────────────────────────────────
  // Liberar a solicitação e abrir o WhatsApp do motorista ficam na aba
  // Transportadoras (PainelSolicitacoes) — aqui só o envio inicial.

  async function enviarParaTransportadora() {
    if (!transpModal || !transpModal.transportadoraId) return
    const ag = transpModal.agendamento
    setEnviandoTranspId(ag.id)
    try {
      const upd = await svc.enviarParaTransportadora(ag.id, transpModal.transportadoraId)
      setAgendamentos((prev) => prev.map((a) => (a.id === upd.id ? upd : a)))
      setTranspModal(null)
      toast.success(`Enviado para ${upd.transportadora?.nome ?? 'a transportadora'} — ela vai indicar o motorista.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar para a transportadora.')
    } finally {
      setEnviandoTranspId(null)
    }
  }

  async function excluirAgendamento(ag: Programacao) {
    if (!window.confirm('Remover este agendamento (e todos os itens)?')) return
    try {
      await svc.deletar(ag.id)
      setAgendamentos((prev) => prev.filter((a) => a.id !== ag.id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover.')
    }
  }

  const tonsItemForm = itemForm ? calcularTons(itemForm.quantidade, itemForm.embalagem) : 0
  const editandoNovoAgendamento = itemForm && !itemForm.agendamentoId

  return (
    <div className="flex flex-col gap-4">
      {/* Cabeçalho + navegação de semana */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-fluid-title font-extrabold tracking-tight text-industrial-900">Programação de Carregamento</h1>
          <div className="mt-2 flex items-center gap-1.5">
            <button type="button" onClick={() => irParaSemana(addDiasIso(semanaInicio, -7))} aria-label="Semana anterior"
              className="rounded-lg border border-industrial-300 p-1.5 text-industrial-600 transition-colors hover:border-brand-500 hover:text-industrial-900">
              <ChevronLeft className="size-4" />
            </button>
            <span className="px-2 text-sm font-medium text-industrial-800">
              Semana de {ddmm(semanaInicio)} a {ddmm(semanaFim)}
            </span>
            <button type="button" onClick={() => irParaSemana(addDiasIso(semanaInicio, 7))} aria-label="Próxima semana"
              className="rounded-lg border border-industrial-300 p-1.5 text-industrial-600 transition-colors hover:border-brand-500 hover:text-industrial-900">
              <ChevronRight className="size-4" />
            </button>
            {/* Calendário: escolhe um dia qualquer e a tela puxa a semana dele com só aquele dia aberto. */}
            <span className="relative ml-1 inline-flex">
              <button
                type="button"
                onClick={abrirCalendario}
                title="Escolher um dia no calendário"
                className="flex items-center gap-1.5 rounded-lg border border-industrial-300 px-2.5 py-1.5 text-xs font-medium text-industrial-800 transition-colors hover:border-brand-500 hover:text-brand-300"
              >
                <CalendarDays className="size-4" />
                Ir para o dia
              </button>
              <input
                ref={calendarioRef}
                type="date"
                aria-label="Escolher um dia"
                value={diaFoco ?? ''}
                onChange={(e) => { if (e.target.value) router.push(`${ROUTES.PROGRAMACAO}?dia=${e.target.value}`) }}
                className="absolute bottom-0 left-0 h-px w-px opacity-0"
                tabIndex={-1}
              />
            </span>
          </div>
          {!podeEditar && !podeConfirmar && (
            <p className="mt-1.5 text-xs text-industrial-600">Prévia (somente leitura) — quem programa é a Logística.</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={alternarSoHoje}
            disabled={!hojeNaSemana}
            aria-pressed={soHojeAtivo}
            title={
              !hojeNaSemana
                ? 'Hoje não está na semana exibida'
                : soHojeAtivo ? 'Reabrir todos os dias da semana' : 'Recolher os outros dias e mostrar só hoje'
            }
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
              soHojeAtivo
                ? 'border-brand-500 bg-brand-500/15 text-brand-300 hover:bg-brand-500/25'
                : 'border-industrial-300 text-industrial-800 hover:border-brand-500 hover:text-brand-300',
            )}
          >
            {soHojeAtivo ? <CalendarRange className="size-4" /> : <CalendarCheck className="size-4" />}
            {soHojeAtivo ? 'Mostrar semana' : 'Só hoje'}
          </button>
          {podeEditar && (
            <button
              type="button"
              onClick={alternarSabado}
              title={ocultarSabado ? 'Mostrar a coluna de sábado' : 'Ocultar a coluna de sábado'}
              className="flex items-center gap-1.5 rounded-lg border border-industrial-300 px-3 py-2 text-xs font-medium text-industrial-800 transition-colors hover:border-brand-500 hover:text-brand-300"
            >
              {ocultarSabado ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
              {ocultarSabado ? 'Mostrar sábado' : 'Ocultar sábado'}
            </button>
          )}
          {podeEditar && (
            <Link
              href={ROUTES.ORDENS_RELATORIO}
              className="flex items-center gap-1.5 rounded-lg border border-industrial-300 px-3 py-2 text-xs font-medium text-industrial-800 transition-colors hover:border-brand-500 hover:text-brand-300"
            >
              <Printer className="size-4" />
              Relatório do dia
            </Link>
          )}
          <div className="min-w-[170px] rounded-lg border border-industrial-200 bg-industrial-50 px-4 py-2">
            <p className="font-display text-[10px] font-bold uppercase tracking-wide text-industrial-500">Total da semana</p>
            <p className="font-mono text-2xl font-extrabold leading-none text-brand-400">
              {totalSemana.toFixed(2)}<span className="ml-1 text-sm font-normal text-industrial-500">ton</span>
            </p>
          </div>
        </div>
      </div>

      {/* Grade da semana: quadros de largura igual, em linhas centradas; dia minimizado vira um quadro estreito. */}
      <div className="grid grid-cols-1 gap-y-4 md:flex md:flex-wrap md:items-start md:justify-center md:gap-4">
        <AnimatePresence initial={false}>
        {diasVisiveis.map(({ nome, data }) => {
          const ehAmanha = data === amanha
          const ehHoje = data === hoje
          const insumos = insumosDoDia(data)
          const colapsado = diasColapsados.has(data)
          const cargas = ordenarCargasDoDia(agendamentosDoDia(data))
          const qtdCargas = cargas.length
          const pendentes = cargas.filter((c) => !c.confirmado_em).length
          return (
            <motion.div
              key={data}
              initial={reduceMotion ? false : colunaOculta}
              animate={alvoColuna(colapsado)}
              exit={{ ...colunaOculta, ...SAIDA_OVERFLOW, transition: reduceMotion || !animarColunasRef.current ? { duration: 0 } : SAIDA_COLUNA }}
              transition={reduceMotion ? { duration: 0 } : TRANSICAO_COLUNA}
              onAnimationComplete={() => setColunasProntas((prev) => (prev.has(data) ? prev : new Set(prev).add(data)))}
            >
            <div
              className={cn(
                'flex h-full flex-col gap-2 rounded-xl border p-2.5',
                ehAmanha ? 'border-brand-500 bg-brand-500/10' : ehHoje ? 'border-industrial-500' : 'border-industrial-200',
                !colunasProntas.has(data) && 'overflow-hidden',
              )}
            >
              {/* Cabeçalho do dia */}
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => alternarColapso(data)}
                  title={colapsado ? 'Mostrar o dia inteiro' : 'Minimizar o dia'}
                  className="flex min-w-0 items-center gap-1.5 rounded-md text-left transition-colors hover:text-brand-300"
                >
                  {colapsado ? <ChevronRight className="size-3.5 shrink-0 text-industrial-500" /> : <ChevronDown className="size-3.5 shrink-0 text-industrial-500" />}
                  <div className="min-w-0">
                    <p className="font-display text-sm font-bold text-industrial-900">{colapsado ? nome.slice(0, 3) : nome}</p>
                    {!colapsado && (
                      <p className="text-xs text-industrial-600">
                        {ddmm(data)}{ehAmanha && <span className="ml-1 font-semibold text-brand-300">· amanhã</span>}{ehHoje && <span className="ml-1 font-semibold text-industrial-500">· hoje</span>}
                      </p>
                    )}
                  </div>
                </button>
                {!colapsado && (
                  <span className="shrink-0 font-mono text-xs font-bold text-brand-300" title="Toneladas programadas no dia">{totalDia(data).toFixed(2)}</span>
                )}
              </div>

              {colapsado ? (
                <div className="flex flex-col items-center gap-0.5 py-1 text-center">
                  <span className="font-mono text-xs font-bold text-brand-300">{totalDia(data).toFixed(2)}</span>
                  {qtdCargas > 0 && (
                    <span className="text-[10px] leading-tight text-industrial-500">
                      {qtdCargas} {qtdCargas === 1 ? 'carga' : 'cargas'}{pendentes > 0 && pendentes < qtdCargas ? ` · ${pendentes} falta${pendentes === 1 ? '' : 'm'}` : ''}
                    </span>
                  )}
                </div>
              ) : (
              <>
              <div className="flex flex-col gap-2">
                <AnimatePresence initial={false}>
                {cargas.map((ag) => {
                  const concluida = !!ag.confirmado_em
                  const compacta = concluida && !fichasAbertas.has(ag.id)
                  // Hora da chegada; se foi confirmada noutro dia (ex.: véspera), mostra a data junto —
                  // a ordem é cronológica real, e sem a data pareceria fora de ordem.
                  const chegada = ag.confirmado_em ? new Date(ag.confirmado_em) : null
                  const horaChegada = chegada
                    ? `${`${pad(chegada.getDate())}/${pad(chegada.getMonth() + 1)}` === ddmm(data) ? '' : `${pad(chegada.getDate())}/${pad(chegada.getMonth() + 1)} `}${chegada.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                    : null
                  return (
                    <motion.div
                      key={ag.id}
                      layout="position"
                      initial={reduceMotion ? false : FICHA_NO_AR}
                      animate={{ y: 0, opacity: 1, rotate: 0 }}
                      exit={reduceMotion ? { opacity: 0, transition: { duration: 0 } } : FICHA_RETIRADA}
                      transition={reduceMotion ? { duration: 0 } : TRANSICAO_FICHA}
                    >
                    {compacta ? (
                      <CardConcluido ag={ag} hora={horaChegada} onAbrir={() => abrirFicha(ag.id)} />
                    ) : (
                    <div
                      className={cn(
                        'rounded-lg border p-2.5 transition-colors',
                        concluida ? 'border-brand-500 bg-brand-500/15' : 'border-industrial-300 bg-industrial-100',
                      )}
                    >
                      {/* Cliente + ações do agendamento */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-semibold leading-snug text-industrial-900">
                            {ag.cliente || <span className="font-normal text-industrial-500">Sem cliente</span>}
                            {ag.cliente_codigo != null && (
                              <span className="ml-1.5 whitespace-nowrap text-[10px] font-normal text-industrial-500" title="Código do cliente no ERP">#{ag.cliente_codigo}</span>
                            )}
                          </p>
                          {concluida && (
                            <p
                              className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-brand-300"
                              title={`Caminhão chegou às ${new Date(ag.confirmado_em!).toLocaleTimeString('pt-BR')}${ag.confirmado_por ? ` · confirmado por ${ag.confirmado_por}` : ''}`}
                            >
                              <Truck className="size-3.5 shrink-0" /> Chegou às {horaChegada}
                            </p>
                          )}
                        </div>
                        {podeEditar && (
                          <div className="flex shrink-0 gap-0.5">
                            <IconBtn title="Editar data/cliente/observação" onClick={() => abrirEdicaoAgendamento(ag)}><Pencil className="size-3.5" /></IconBtn>
                            <IconBtn title="Remover agendamento" danger onClick={() => excluirAgendamento(ag)}><Trash2 className="size-3.5" /></IconBtn>
                          </div>
                        )}
                      </div>

                      {/* Itens (fórmula / quantidade) */}
                      <div className="mt-1.5 flex flex-col divide-y divide-industrial-200">
                        {(ag.itens ?? []).map((item) => (
                          <div key={item.id} className="flex items-start justify-between gap-2 py-1 first:pt-0 last:pb-0">
                            <div className="min-w-0">
                              {item.formula?.nome && <p className="break-words text-xs font-medium leading-snug text-brand-300">{item.formula.nome}</p>}
                              <p className="text-xs text-industrial-500">
                                {item.quantidade} {EMBALAGEM_LABEL[item.embalagem]} · <span className="font-mono font-bold text-industrial-700">{(item.tons ?? 0).toFixed(2)} ton</span>
                              </p>
                            </div>
                            {podeEditar && (
                              <div className="flex shrink-0 gap-0.5">
                                <IconBtn title="Editar item" small onClick={() => abrirEdicaoItem(ag, item)}><Pencil className="size-3" /></IconBtn>
                                <IconBtn title="Remover item" small danger disabled={(ag.itens ?? []).length <= 1} onClick={() => removerItem(ag, item)}><Trash2 className="size-3" /></IconBtn>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {ag.observacao && <p className="mt-1.5 break-words text-xs italic text-industrial-600">{ag.observacao}</p>}

                      {/* Total da carga */}
                      <div className="mt-1.5 flex items-center justify-between border-t border-industrial-200 pt-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-industrial-500">Total</span>
                        <span className="font-mono text-sm font-extrabold text-industrial-900">
                          {tonsDoAgendamento(ag).toFixed(2)} <span className="text-[10px] font-normal text-industrial-500">ton</span>
                        </span>
                      </div>

                      {/* Fluxo de transportadora */}
                      {ag.solicitacao_status && (
                        <p className={cn(
                          'mt-1.5 flex items-start gap-1 text-[11px] font-semibold',
                          ag.solicitacao_status === 'LIBERADO' ? 'text-brand-300' : 'text-amber-400',
                        )}>
                          <Container className="mt-px size-3 shrink-0" />
                          <span className="break-words">
                            {ag.transportadora?.nome ?? 'Transportadora'} · {SOLICITACAO_STATUS_LABEL[ag.solicitacao_status]}
                            {ag.solicitacao_status !== 'ENVIADO_TRANSPORTADORA' && ag.motorista?.nome ? ` · ${ag.motorista.nome}` : ''}
                          </span>
                        </p>
                      )}

                      {/* Documento pra portaria — só existe depois de liberado (numero_ordem). */}
                      {ag.numero_ordem && (
                        <a
                          href={`/api/programacao/${ag.id}/ordem-pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Gerar ordem de carregamento em PDF"
                          className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-300 transition-colors hover:underline"
                        >
                          <FileDown className="size-3" /> Ordem Nº {String(ag.numero_ordem).padStart(6, '0')} · PDF
                        </a>
                      )}

                      {podeEditar && (
                        <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-industrial-200 pt-1.5">
                          <ActionBtn onClick={() => abrirNovoItem(ag)}>
                            <Plus className="size-3" /> Adicionar item
                          </ActionBtn>
                          <ActionBtn
                            active={!!ag.solicitacao_status}
                            onClick={() => setTranspModal({ agendamento: ag, transportadoraId: ag.transportadora_id ?? '' })}
                            title={ag.solicitacao_status ? 'Reenviar / trocar a transportadora' : 'Enviar para uma transportadora indicar o motorista'}
                          >
                            <Container className="size-3" />
                            {ag.solicitacao_status ? 'Transportadora ✓' : 'Transportadora'}
                          </ActionBtn>
                          {ag.solicitacao_status === 'LIBERADO' && (
                            <ActionBtn
                              tone="warn"
                              onClick={() => reverterLiberacao(ag)}
                              disabled={revertendoId === ag.id}
                              title="Reverter liberação — volta pra fila de Solicitações sem perder transportadora/motorista/número da ordem"
                            >
                              <RotateCcw className="size-3" />
                              {revertendoId === ag.id ? 'Revertendo…' : 'Reverter liberação'}
                            </ActionBtn>
                          )}
                          <ActionBtn
                            active={!!ag.enviado_em}
                            onClick={() => enviarParaOrdens(ag)}
                            disabled={enviandoId === ag.id}
                            title={ag.enviado_em ? `Enviado em ${new Date(ag.enviado_em).toLocaleString('pt-BR')} — clique para reenviar` : 'Enviar para Ordens do Dia'}
                          >
                            {ag.enviado_em ? <CheckCircle2 className="size-3" /> : <Send className="size-3" />}
                            {enviandoId === ag.id ? 'Enviando…' : ag.enviado_em ? 'Enviado' : 'Enviar p/ Ordens'}
                          </ActionBtn>
                        </div>
                      )}

                      {podeConfirmar && (
                        <div className="mt-2 border-t border-industrial-200 pt-1.5">
                          {ag.confirmado_em ? (
                            <span className="flex items-center gap-1 text-[11px] font-semibold text-brand-300">
                              <CheckCircle2 className="size-3" /> Chegada confirmada
                            </span>
                          ) : (
                            <ActionBtn tone="primary" onClick={() => confirmarChegada(ag)} disabled={confirmandoId === ag.id}>
                              <Truck className="size-3.5" />
                              {confirmandoId === ag.id ? 'Confirmando…' : 'Confirmar chegada do caminhão'}
                            </ActionBtn>
                          )}
                        </div>
                      )}

                      {concluida && (
                        <button
                          type="button"
                          onClick={() => recolherFicha(ag.id)}
                          className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-industrial-500 transition-colors hover:text-brand-300"
                        >
                          <ChevronUp className="size-3" /> Recolher
                        </button>
                      )}
                    </div>
                    )}
                    </motion.div>
                  )
                })}
                </AnimatePresence>

                {qtdCargas === 0 && (
                  <p className="py-2 text-center text-xs text-industrial-500">—</p>
                )}

                {podeEditar && (
                  <button type="button" onClick={() => abrirNovoAgendamento(data)}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-industrial-400 py-1.5 text-xs font-medium text-industrial-600 transition-colors hover:border-brand-500 hover:text-brand-300">
                    <Plus className="size-3.5" /> Adicionar cliente
                  </button>
                )}
              </div>

              {insumos.length > 0 && (
                <div className="mt-auto rounded-lg border border-industrial-300 bg-industrial-50 p-2">
                  <p className="mb-1.5 font-display text-[10px] font-bold uppercase tracking-wide text-industrial-600">Matéria-prima do dia</p>
                  <div className="flex flex-col gap-1">
                    {insumos.map((m) => (
                      <div key={m.label} className="flex items-center justify-between gap-2 text-xs">
                        <span className="min-w-0 break-words text-industrial-600">{m.label}</span>
                        <span className="shrink-0 font-mono font-bold text-industrial-900">
                          {m.kg.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              </>
              )}
            </div>
            </motion.div>
          )
        })}
        </AnimatePresence>
      </div>

      {/* Total de matéria-prima carregado na semana inteira (todos os dias somados) */}
      {materiaPrimaDaSemana.length > 0 && (
        <div className="rounded-xl border border-industrial-200 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-industrial-600 mb-2">Matéria-prima da semana</p>
          <div className="flex flex-wrap gap-3">
            {materiaPrimaDaSemana.map((m) => (
              <div key={m.label} className="flex flex-col rounded-lg bg-industrial-50 border border-industrial-300 px-3 py-1.5 min-w-[110px]">
                <span className="text-[10px] text-industrial-600 truncate">{m.label}</span>
                <span className="font-bold text-brand-600">
                  {m.kg.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} <span className="text-[10px] font-normal text-industrial-500">kg</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de envio pra transportadora */}
      {transpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setTranspModal(null)}>
          <div className="w-full max-w-md rounded-xl bg-industrial-100 border border-industrial-300 p-5 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-industrial-900">
                Enviar pra transportadora · {transpModal.agendamento.cliente || 'sem cliente'}
              </h2>
              <button type="button" onClick={() => setTranspModal(null)} className="text-industrial-600 hover:text-industrial-900"><X className="size-5" /></button>
            </div>

            <p className="text-xs text-industrial-600">
              A transportadora recebe este carregamento na tela dela, indica o motorista (com WhatsApp) e envia a
              solicitação de volta — você libera na aba Transportadoras.
            </p>

            <label className="text-xs font-medium text-industrial-600">Transportadora
              <select
                value={transpModal.transportadoraId}
                onChange={(e) => setTranspModal({ ...transpModal, transportadoraId: e.target.value })}
                className="mt-1 w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-sm text-industrial-900 focus:outline-none focus:border-brand-500"
              >
                <option value="">Selecionar transportadora…</option>
                {transportadoras.map((t) => (
                  <option key={t.id} value={t.id}>{t.nome}{t.profile_id ? '' : ' (sem login criado)'}</option>
                ))}
              </select>
            </label>

            {transportadoras.length === 0 && (
              <p className="text-xs text-amber-400 font-medium">
                Nenhuma transportadora cadastrada — crie o acesso dela na tela Transportadoras.
              </p>
            )}

            {transpModal.agendamento.solicitacao_status && (
              <p className="text-xs text-amber-400 font-medium">
                Este agendamento já está com uma transportadora ({SOLICITACAO_STATUS_LABEL[transpModal.agendamento.solicitacao_status]}).
                Reenviar recomeça o fluxo do zero.
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setTranspModal(null)}
                className="rounded-lg border border-industrial-400 px-4 py-2 text-sm font-medium text-industrial-700 hover:bg-industrial-200">Cancelar</button>
              <button
                type="button"
                onClick={enviarParaTransportadora}
                disabled={enviandoTranspId != null || !transpModal.transportadoraId}
                className="rounded-lg bg-brand-700 hover:bg-brand-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {enviandoTranspId ? 'Enviando…' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de data/cliente/observação (nível agendamento) */}
      {agForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setAgForm(null)}>
          <div className="w-full max-w-md rounded-xl bg-industrial-100 border border-industrial-300 p-5 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-industrial-900">Editar agendamento</h2>
              <button type="button" onClick={() => setAgForm(null)} className="text-industrial-600 hover:text-industrial-900"><X className="size-5" /></button>
            </div>
            <label className="text-xs font-medium text-industrial-600">Data
              <input type="date" value={agForm.data} onChange={(e) => setAgForm({ ...agForm, data: e.target.value })}
                className="mt-1 w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-sm text-industrial-900 focus:outline-none focus:border-brand-500" />
            </label>
            <div className="text-xs font-medium text-industrial-600">Cliente
              <div className="mt-1">
                <ClientePicker
                  value={agForm.cliente}
                  clientes={clientes}
                  clientesErp={clientesErp}
                  onChange={(nome, codigo) => setAgForm({ ...agForm, cliente: nome, clienteCodigo: codigo })}
                  onCriar={adicionarCliente}
                  onEditar={editarCliente}
                  className="[&>button]:py-2 [&>button]:text-sm"
                />
              </div>
            </div>
            <label className="text-xs font-medium text-industrial-600">Observação / nº do pedido
              <input value={agForm.observacao} onChange={(e) => setAgForm({ ...agForm, observacao: e.target.value })}
                placeholder="ex.: PEDIDO 26092"
                className="mt-1 w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-sm text-industrial-900 placeholder-industrial-500 focus:outline-none focus:border-brand-500" />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setAgForm(null)}
                className="rounded-lg border border-industrial-400 px-4 py-2 text-sm font-medium text-industrial-700 hover:bg-industrial-200">Cancelar</button>
              <button type="button" onClick={salvarAgendamento} disabled={salvando}
                className="rounded-lg bg-brand-700 hover:bg-brand-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50">
                {salvando ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de item (fórmula/quantidade/embalagem) — cria agendamento ou adiciona/edita item */}
      {itemForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setItemForm(null)}>
          <div className="w-full max-w-md rounded-xl bg-industrial-100 border border-industrial-300 p-5 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-industrial-900">
                {itemForm.itemId ? 'Editar item' : editandoNovoAgendamento ? 'Novo cliente' : 'Novo item'} · {ddmm(itemForm.data)}
              </h2>
              <button type="button" onClick={() => setItemForm(null)} className="text-industrial-600 hover:text-industrial-900"><X className="size-5" /></button>
            </div>

            {editandoNovoAgendamento && (
              <>
                <div className="text-xs font-medium text-industrial-600">Cliente
                  <div className="mt-1">
                    <ClientePicker
                      value={itemForm.cliente}
                      clientes={clientes}
                      clientesErp={clientesErp}
                      onChange={(nome, codigo) => setItemForm({ ...itemForm, cliente: nome, clienteCodigo: codigo })}
                      onCriar={adicionarCliente}
                      onEditar={editarCliente}
                      className="[&>button]:py-2 [&>button]:text-sm"
                    />
                  </div>
                </div>
                <label className="text-xs font-medium text-industrial-600">Observação / nº do pedido
                  <input value={itemForm.observacao} onChange={(e) => setItemForm({ ...itemForm, observacao: e.target.value })}
                    placeholder="ex.: PEDIDO 26092"
                    className="mt-1 w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-sm text-industrial-900 placeholder-industrial-500 focus:outline-none focus:border-brand-500" />
                </label>
                <label className="text-xs font-medium text-industrial-600">Transportadora (opcional — já sai enviado pra ela)
                  <select
                    value={itemForm.transportadoraId}
                    onChange={(e) => setItemForm({ ...itemForm, transportadoraId: e.target.value })}
                    className="mt-1 w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-sm text-industrial-900 focus:outline-none focus:border-brand-500"
                  >
                    <option value="">— Definir depois —</option>
                    {transportadoras.map((t) => (
                      <option key={t.id} value={t.id}>{t.nome}</option>
                    ))}
                  </select>
                </label>
              </>
            )}

            <div className="text-xs font-medium text-industrial-600">Fórmula (opcional — deixe em branco se for fórmula química fora da planilha)
              <div className="mt-1"><FormulaPicker value={itemForm.formula_id} formulas={formulas} onChange={(id) => setItemForm({ ...itemForm, formula_id: id })} /></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-medium text-industrial-600">Quantidade
                <input type="number" min={1} value={itemForm.quantidade} onChange={(e) => setItemForm({ ...itemForm, quantidade: Number(e.target.value) || 0 })}
                  className="mt-1 w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-sm text-industrial-900 focus:outline-none focus:border-brand-500" />
              </label>
              <label className="text-xs font-medium text-industrial-600">Embalagem
                <select value={itemForm.embalagem} onChange={(e) => setItemForm({ ...itemForm, embalagem: e.target.value as Embalagem })}
                  className="mt-1 w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-sm text-industrial-900 focus:outline-none focus:border-brand-500">
                  {EMBALAGEM_OPCOES.map((opt) => <option key={opt} value={opt}>{EMBALAGEM_LABEL[opt]}</option>)}
                </select>
              </label>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-sm text-industrial-600">Total: <span className="font-bold text-brand-300">{tonsItemForm.toFixed(2)} ton</span></span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setItemForm(null)}
                  className="rounded-lg border border-industrial-400 px-4 py-2 text-sm font-medium text-industrial-700 hover:bg-industrial-200">Cancelar</button>
                <button type="button" onClick={salvarItem} disabled={salvando || itemForm.quantidade <= 0}
                  title={itemForm.quantidade <= 0 ? 'Informe uma quantidade maior que zero' : undefined}
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

/** Carimbo de status a exibir no ticket — `confirmado_em` (chegada) supera o
 *  `solicitacao_status`, porque uma carga confirmada já passou por liberação. */
