'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Trash2, Pencil, X, ChevronLeft, ChevronRight, ChevronDown, Printer, Send, CheckCircle2, Truck, Container, RotateCcw, EyeOff, Eye } from 'lucide-react'
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
import { Ticket, TicketRule, TicketLabel } from '@/components/ui/ticket'
import { Stamp, type StampVariant } from '@/components/ui/stamp'

interface ProgramacaoSemanaProps {
  initialItens:    Programacao[]
  formulas:        { id: number; nome: string }[]
  initialClientes: Cliente[]
  clientesErp:     ClienteErp[]
  transportadoras: Transportadora[]
  semanaInicio:    string // segunda-feira (YYYY-MM-DD)
  semanaFim:       string // sábado (YYYY-MM-DD)
  hoje:            string
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
const COLUNA_OCULTA_DESKTOP = { flexGrow: 0, flexBasis: '0px', minWidth: '0px', marginLeft: -24, opacity: 0 } as const
const COLUNA_OCULTA_MOBILE = { height: 0, marginTop: -20, opacity: 0 } as const
const SAIDA_OVERFLOW = { overflow: 'hidden' } as const
/** Largura mínima de uma coluna aberta (mesmo valor do `md:min-w-[230px]` de antes: abaixo disso o
 *  carimbo e o nome do cliente já não cabem na ficha; em 1440 com a barra lateral aberta a 5ª coluna quebra
 *  de linha — comportamento anterior, mantido de propósito). */
const COLUNA_MIN_PX = 230
/** Tamanho em repouso da coluna (equivale a `md:flex-1 md:min-w-[200px]` / `md:w-[84px] md:shrink-0`, mas animável). */
function alvoColuna(colapsado: boolean) {
  return colapsado
    ? { flexGrow: 0, flexShrink: 0, flexBasis: '84px', minWidth: '84px', marginLeft: 0, height: 'auto', marginTop: 0, opacity: 1 }
    : { flexGrow: 1, flexShrink: 1, flexBasis: '0px', minWidth: `${COLUNA_MIN_PX}px`, marginLeft: 0, height: 'auto', marginTop: 0, opacity: 1 }
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
  initialItens, formulas, initialClientes, clientesErp, transportadoras, semanaInicio, semanaFim, hoje, podeEditar, podeConfirmar, usuario,
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
  const [diasColapsados, setDiasColapsados] = useState<Set<string>>(new Set())
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
    <div className="flex flex-col gap-4 font-mono">
      <div className="via-tag">
        <span className="via-num">2ª VIA</span>
        <span className="via-name">PROGRAMAÇÃO DE CARREGAMENTO</span>
        <span className="via-fill" />
      </div>

      {/* Cabeçalho + navegação de semana */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-fluid-title font-extrabold tracking-tight text-industrial-900">Programação de Carregamento</h1>
          <div className="flex items-center gap-1.5 mt-2">
            <button type="button" onClick={() => irParaSemana(addDiasIso(semanaInicio, -7))} aria-label="Semana anterior"
              className="rounded-[2px] border border-industrial-300 p-1.5 text-industrial-600 hover:text-industrial-900 hover:border-brand-500 transition-colors">
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-sm font-medium text-industrial-800 px-2">
              Semana de {ddmm(semanaInicio)} a {ddmm(semanaFim)}
            </span>
            <button type="button" onClick={() => irParaSemana(addDiasIso(semanaInicio, 7))} aria-label="Próxima semana"
              className="rounded-[2px] border border-industrial-300 p-1.5 text-industrial-600 hover:text-industrial-900 hover:border-brand-500 transition-colors">
              <ChevronRight className="size-4" />
            </button>
          </div>
          {!podeEditar && !podeConfirmar && (
            <p className="text-xs text-industrial-600 mt-1.5">Prévia (somente leitura) — quem programa é a Logística.</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {podeEditar && (
            <button
              type="button"
              onClick={alternarSabado}
              title={ocultarSabado ? 'Mostrar a coluna de sábado' : 'Ocultar a coluna de sábado'}
              className="flex items-center gap-1.5 rounded-[2px] border border-industrial-300 px-3 py-2 text-xs font-medium text-industrial-800 hover:border-brand-500 hover:text-brand-300 transition-colors"
            >
              {ocultarSabado ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
              {ocultarSabado ? 'Mostrar sábado' : 'Ocultar sábado'}
            </button>
          )}
          {podeEditar && (
            <Link
              href={ROUTES.ORDENS_RELATORIO}
              className="flex items-center gap-1.5 rounded-[2px] border border-industrial-300 px-3 py-2 text-xs font-medium text-industrial-800 hover:border-brand-500 hover:text-brand-300 transition-colors"
            >
              <Printer className="size-4" />
              Relatório do dia
            </Link>
          )}
          <div className="bg-industrial-50 border border-industrial-200 px-4 py-2 min-w-[180px]">
            <p className="text-[10px] tracking-[.1em] uppercase text-industrial-500">Total da semana</p>
            <p className="text-2xl font-extrabold text-brand-500 leading-none">
              {totalSemana.toFixed(2)}<span className="text-sm font-normal text-industrial-500 ml-1">ton</span>
            </p>
          </div>
        </div>
      </div>

      {/* Grade da semana */}
      <div className="grid grid-cols-1 gap-y-5 md:flex md:flex-wrap md:items-start md:gap-x-6 md:gap-y-6">
        <AnimatePresence initial={false}>
        {diasVisiveis.map(({ nome, data }, index) => {
          const ehAmanha = data === amanha
          const ehHoje = data === hoje
          const insumos = insumosDoDia(data)
          const colapsado = diasColapsados.has(data)
          const qtdCargas = agendamentosDoDia(data).length
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
                'flex h-full flex-col gap-3.5',
                index > 0 && 'md:border-l md:border-dashed md:border-industrial-300 md:pl-5',
                !colunasProntas.has(data) && 'overflow-hidden',
              )}
            >
              <button
                type="button"
                onClick={() => alternarColapso(data)}
                title={colapsado ? 'Mostrar o dia inteiro' : 'Minimizar o dia'}
                className="flex items-center justify-between gap-2 border-b-2 border-industrial-200 pb-2 text-left hover:border-brand-500/60 transition-colors"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {colapsado ? <ChevronRight className="size-3.5 text-industrial-500 shrink-0" /> : <ChevronDown className="size-3.5 text-industrial-500 shrink-0" />}
                  <div className="min-w-0">
                    <p className={cn('text-sm font-extrabold tracking-wide uppercase truncate', ehAmanha ? 'text-brand-500' : 'text-industrial-900')}>
                      {colapsado ? nome.slice(0, 3) : nome}
                    </p>
                    {!colapsado && (
                      <p className="text-xs text-industrial-500">
                        {ddmm(data)}{ehAmanha && <span className="ml-1 text-brand-500 font-semibold">· amanhã</span>}{ehHoje && <span className="ml-1 text-industrial-600 font-semibold">· hoje</span>}
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-xs font-bold text-industrial-600 shrink-0">{totalDia(data).toFixed(2)}</span>
              </button>

              {colapsado ? (
                qtdCargas > 0 && (
                  <p className="text-[11px] text-industrial-500">{qtdCargas} {qtdCargas === 1 ? 'carga' : 'cargas'}</p>
                )
              ) : (
              <>
              <div className="flex flex-col gap-4">
                <AnimatePresence initial={false}>
                {agendamentosDoDia(data).map((ag) => {
                  const stamp = stampInfo(ag)
                  return (
                    <motion.div
                      key={ag.id}
                      layout="position"
                      initial={reduceMotion ? false : FICHA_NO_AR}
                      animate={{ y: 0, opacity: 1, rotate: 0 }}
                      exit={reduceMotion ? { opacity: 0, transition: { duration: 0 } } : FICHA_RETIRADA}
                      transition={reduceMotion ? { duration: 0 } : TRANSICAO_FICHA}
                    >
                    <Ticket
                      seq={ag.numero_ordem ? `Nº ${String(ag.numero_ordem).padStart(6, '0')}` : undefined}
                      seqHref={ag.numero_ordem ? `/api/programacao/${ag.id}/ordem-pdf` : undefined}
                      seqTitle="Gerar ordem de carregamento em PDF"
                    >
                      <div className="flex items-start justify-between gap-2 pl-5">
                        <div className="min-w-0">
                          <TicketLabel>Cliente</TicketLabel>
                          <p
                            className="text-[17px] md:text-[14px] xl:text-[12.5px] font-extrabold uppercase leading-tight text-ticket-ink truncate"
                            title={ag.cliente ? `${ag.cliente}${ag.cliente_codigo != null ? ` #${ag.cliente_codigo}` : ''}` : undefined}
                          >
                            {ag.cliente || <span className="text-ticket-soft font-normal normal-case">Sem cliente</span>}
                            {ag.cliente_codigo != null && (
                              <span className="ml-1.5 text-[10px] font-normal normal-case text-ticket-soft">#{ag.cliente_codigo}</span>
                            )}
                          </p>
                        </div>
                        {podeEditar && (
                          <div className="flex gap-1.5 shrink-0 pt-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                            <button type="button" onClick={() => abrirEdicaoAgendamento(ag)} title="Editar data/cliente/observação"
                              className="text-ticket-soft hover:text-ticket-ink"><Pencil className="size-3.5" /></button>
                            <button type="button" onClick={() => excluirAgendamento(ag)} title="Remover agendamento"
                              className="text-ticket-soft hover:text-danger-600"><Trash2 className="size-3.5" /></button>
                          </div>
                        )}
                      </div>

                      <TicketRule />

                      <div className="flex flex-col">
                        {(ag.itens ?? []).map((item, i) => (
                          <div key={item.id} className={cn('flex items-start justify-between gap-3 py-2', i > 0 && 'ticket-dash')}>
                            <div className="min-w-0">
                              {item.formula?.nome && <p className="text-[13px] font-bold text-ticket-ink truncate">{item.formula.nome}</p>}
                              <p className="text-[12.5px] text-ticket-soft whitespace-nowrap">
                                {item.quantidade} {EMBALAGEM_LABEL[item.embalagem]} · <span className="font-bold text-ticket-ink">{(item.tons ?? 0).toFixed(2)} ton</span>
                              </p>
                            </div>
                            {podeEditar && (
                              <div className="flex gap-1 shrink-0 pt-0.5">
                                <button type="button" onClick={() => abrirEdicaoItem(ag, item)} title="Editar item"
                                  className="text-ticket-soft hover:text-ticket-ink"><Pencil className="size-3" /></button>
                                <button
                                  type="button" onClick={() => removerItem(ag, item)} title="Remover item"
                                  disabled={(ag.itens ?? []).length <= 1}
                                  className="text-ticket-soft hover:text-danger-600 disabled:opacity-20 disabled:cursor-not-allowed"
                                >
                                  <Trash2 className="size-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {(ag.observacao || ag.transportadora?.nome || ag.motorista?.nome) && (
                        <div className="ticket-dash pt-1.5 pb-0.5">
                          {ag.observacao && <p className="text-[11.5px] text-ticket-soft italic">{ag.observacao}</p>}
                          {(ag.transportadora?.nome || ag.motorista?.nome) && (
                            <p className="text-[11.5px] text-ticket-soft truncate flex items-center gap-1">
                              <Container className="size-3 shrink-0" />
                              {ag.transportadora?.nome}{ag.motorista?.nome ? ` · ${ag.motorista.nome}` : ''}
                            </p>
                          )}
                        </div>
                      )}

                      <TicketRule />

                      <div className="flex items-end justify-between gap-3 min-h-[54px]">
                        <div>
                          <TicketLabel>Total</TicketLabel>
                          <p className="text-[26px] font-extrabold leading-none text-ticket-ink">
                            {tonsDoAgendamento(ag).toFixed(2)}<small className="text-sm font-semibold text-ticket-soft ml-1">ton</small>
                          </p>
                          {ag.confirmado_em && (
                            <p className="text-[10.5px] text-ticket-soft mt-1">
                              Chegou às {new Date(ag.confirmado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </div>
                        {stamp && <Stamp variant={stamp.variant} lines={stamp.lines} rotate={stamp.rotate} />}
                      </div>

                      {podeEditar && (
                        <div className="flex flex-col gap-1.5 mt-2.5 pt-2 border-t border-dashed border-ticket-rule/40 text-[11px] font-semibold">
                          <button type="button" onClick={() => abrirNovoItem(ag)}
                            className="flex items-center gap-1 self-start text-ticket-soft hover:text-brand-600 transition-colors">
                            <Plus className="size-3" /> Adicionar item
                          </button>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <button
                              type="button"
                              onClick={() => setTranspModal({ agendamento: ag, transportadoraId: ag.transportadora_id ?? '' })}
                              title={ag.solicitacao_status ? 'Reenviar / trocar a transportadora' : 'Enviar para uma transportadora indicar o motorista'}
                              className={cn('flex items-center gap-1 whitespace-nowrap transition-colors', ag.solicitacao_status ? 'text-brand-600' : 'text-ticket-soft hover:text-brand-600')}
                            >
                              <Container className="size-3" />
                              {ag.solicitacao_status ? 'Transportadora ✓' : 'Transportadora'}
                            </button>
                            {ag.solicitacao_status === 'LIBERADO' && (
                              <button
                                type="button"
                                onClick={() => reverterLiberacao(ag)}
                                disabled={revertendoId === ag.id}
                                title="Reverter liberação — volta pra fila de Solicitações sem perder transportadora/motorista/número da ordem"
                                className="flex items-center gap-1 whitespace-nowrap text-stamp-enviado hover:opacity-75 transition-opacity disabled:opacity-50"
                              >
                                <RotateCcw className="size-3" />
                                {revertendoId === ag.id ? 'Revertendo…' : 'Reverter liberação'}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => enviarParaOrdens(ag)}
                              disabled={enviandoId === ag.id}
                              title={ag.enviado_em ? `Enviado em ${new Date(ag.enviado_em).toLocaleString('pt-BR')} — clique para reenviar` : 'Enviar para Ordens do Dia'}
                              className={cn('flex items-center gap-1 whitespace-nowrap transition-colors disabled:opacity-50', ag.enviado_em ? 'text-brand-600' : 'text-ticket-soft hover:text-brand-600')}
                            >
                              {ag.enviado_em ? <CheckCircle2 className="size-3" /> : <Send className="size-3" />}
                              {enviandoId === ag.id ? 'Enviando…' : ag.enviado_em ? 'Enviado' : 'Enviar p/ Ordens'}
                            </button>
                          </div>
                        </div>
                      )}

                      {podeConfirmar && (
                        <div className="mt-2 pt-2 border-t border-dashed border-ticket-rule/40 text-[11px] font-semibold">
                          {ag.confirmado_em ? (
                            <span className="flex items-center gap-1 text-stamp-confirmado">
                              <CheckCircle2 className="size-3" /> Confirmado
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => confirmarChegada(ag)}
                              disabled={confirmandoId === ag.id}
                              className="flex items-center gap-1 text-ticket-soft hover:text-brand-600 transition-colors disabled:opacity-50"
                            >
                              <Truck className="size-3" />
                              {confirmandoId === ag.id ? 'Confirmando…' : 'Confirmar chegada do caminhão'}
                            </button>
                          )}
                        </div>
                      )}
                    </Ticket>
                    </motion.div>
                  )
                })}
                </AnimatePresence>

                {agendamentosDoDia(data).length === 0 && (
                  <p className="text-xs text-industrial-500 text-center py-2">—</p>
                )}

                {podeEditar && (
                  <button type="button" onClick={() => abrirNovoAgendamento(data)}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-industrial-400 py-1.5 text-xs font-medium text-industrial-600 hover:border-brand-500 hover:text-brand-300 transition-colors">
                    <Plus className="size-3.5" /> Adicionar cliente
                  </button>
                )}
              </div>

              {insumos.length > 0 && (
                <div className="rounded-lg bg-industrial-50 border border-industrial-300 p-2 mt-auto">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-industrial-600 mb-1.5">Matéria-prima do dia</p>
                  <div className="flex flex-col gap-1">
                    {insumos.map((m) => (
                      <div key={m.label} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-industrial-600 truncate">{m.label}</span>
                        <span className="font-bold text-industrial-900 shrink-0">
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
function stampInfo(ag: Programacao): { variant: StampVariant; lines: [string] | [string, string]; rotate: number } | null {
  const rotate = rotFor(ag.id)
  if (ag.confirmado_em) return { variant: 'confirmado', lines: ['Confirmado'], rotate }
  if (ag.solicitacao_status === 'LIBERADO') return { variant: 'liberado', lines: ['Liberado'], rotate }
  if (ag.solicitacao_status === 'ENVIADO_TRANSPORTADORA') return { variant: 'enviado', lines: ['Enviado', 'Transportadora'], rotate }
  if (ag.solicitacao_status === 'SOLICITADO') return { variant: 'solicitado', lines: ['Solicitado'], rotate }
  return null
}

/** Rotação determinística (-6..6°) a partir do id — carimbos variam sem
 *  Math.random (que quebraria a hidratação SSR). */
function rotFor(id: string): number {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0
  return (Math.abs(h) % 13) - 6
}
